import "server-only"

import type { OperatorAlert } from "@/lib/contact/alerts"
import {
  type DeliveryChannel,
  type DeliveryProviderResult,
  getNextAttemptAt,
  type LeadDeliveryPayload,
  MAX_DELIVERY_ATTEMPTS,
} from "@/lib/contact/delivery-core"
import { logContactEvent } from "@/lib/contact/log"
import { deliverToConfiguredProvider, prepareProviderRequest, preparedRequestAuthorization } from "@/lib/contact/providers"
import { ProviderConfigurationError, PROVIDER_RETRY_WINDOW_MS, type PreparedProviderRequest, type ProviderReservation } from "@/lib/contact/provider-request"

const DELIVERY_LEASE_MS = 30_000
const QUEUE_AGE_ALERT_MS = 5 * 60_000
const RETENTION_BATCH_SIZE = 1_000

type DeliveryLease = {
  delivery: {
    id: string
    leadId: string
    channel: DeliveryChannel
    attemptCount: number
    leaseToken: string
    idempotencyKey: string
  }
}
export type ClaimedDelivery = DeliveryLease & (
  | { kind: "send"; lead: LeadDeliveryPayload }
  | { kind: "alert"; errorCode: string; terminalAt: Date }
)

export type DeliveryOperationsRepository = {
  claimNextDueOutbox(now: Date, leaseMs: number): Promise<ClaimedDelivery | null>
  claimOutboxById(
    id: string,
    now: Date,
    leaseMs: number
  ): Promise<ClaimedDelivery | null>
  prepareAndReserveProviderAttempt(id: string, leaseToken: string, request: PreparedProviderRequest): Promise<ProviderReservation>
  recordProviderAttemptResult(reservationId: string, result: DeliveryProviderResult): Promise<boolean>
  isOutboxSendAllowed(id: string, leaseToken: string, now: Date): Promise<boolean>
  isOutboxAlertAllowed(id: string, leaseToken: string, now: Date): Promise<boolean>
  markOutboxDelivered(
    id: string,
    leaseToken: string,
    providerMessageId?: string
  ): Promise<boolean>
  rescheduleOutbox(
    id: string,
    leaseToken: string,
    update: { nextAttemptAt: Date; errorCode: string }
  ): Promise<boolean>
  markOutboxDeadLetter(
    id: string,
    leaseToken: string,
    update: { errorCode: string; reviewReason?: string },
    now: Date
  ): Promise<boolean>
  markTerminalAlertPublished(id: string, leaseToken: string, now: Date): Promise<boolean>
  getOldestDueOutboxAge(now: Date): Promise<number | null>
  listDueOrLeaseExpiredOutbox(
    now: Date,
    limit: number
  ): Promise<Array<{ id: string }>>
  redactExpiredLeads(cutoff: Date, limit: number): Promise<number>
  deleteExpiredLeads(cutoff: Date, limit: number): Promise<number>
}

type PublishAlert = (alert: OperatorAlert) => Promise<unknown>

export async function processOneLeadDelivery(
  repository: DeliveryOperationsRepository,
  options: {
    outboxId?: string
    now?: Date
    random?: () => number
    publishAlert: PublishAlert
  }
) {
  const now = options.now ?? new Date()
  const startedAt = Date.now()
  const claimed = options.outboxId
    ? await repository.claimOutboxById(
        options.outboxId,
        now,
        DELIVERY_LEASE_MS
      )
    : await repository.claimNextDueOutbox(now, DELIVERY_LEASE_MS)

  if (!claimed) {
    return { state: "idle" as const }
  }

  const { delivery } = claimed
  const currentTime = () => options.now ?? new Date()
  const configurationFailure = (code: string) => code.endsWith("_not_configured") || code === "resend_account_binding_invalid"

  async function publishTerminalAlerts(errorCode: string, terminalAt: Date) {
    const types = configurationFailure(errorCode)
      ? ["configuration_failure", "dead_letter"] as const : ["dead_letter"] as const
    for (const type of types) {
      if (!await repository.isOutboxAlertAllowed(delivery.id, delivery.leaseToken, currentTime())) return { state: "stale" as const }
      await options.publishAlert({
        schemaVersion: 1,
        eventId: `${type === "configuration_failure" ? "configuration" : "dead-letter"}/${delivery.id}`,
        type, occurredAt: terminalAt.toISOString(), outboxId: delivery.id,
        submissionId: delivery.leadId, channel: delivery.channel,
        attemptCount: delivery.attemptCount, errorCode,
      })
    }
    const updated = await repository.markTerminalAlertPublished(delivery.id, delivery.leaseToken, currentTime())
    return { state: updated ? "dead_letter" as const : "stale" as const }
  }

  async function stopSending(errorCode: string, review = false) {
    const terminalAt = currentTime()
    const stopped = await repository.markOutboxDeadLetter(delivery.id, delivery.leaseToken, { errorCode, ...(review ? { reviewReason: errorCode } : {}) }, terminalAt)
    if (!stopped) return { state: "stale" as const }
    // The terminal state and alert-pending marker are already durable. Queue
    // failure can retry notification only, never another provider send.
    return publishTerminalAlerts(errorCode, terminalAt)
  }

  if (claimed.kind === "alert") return publishTerminalAlerts(claimed.errorCode, claimed.terminalAt)

  // Claims reserve an attempt before sending. A final-attempt crash/expired
  // lease therefore conservatively exhausts the budget, even if no send occurred.
  if (delivery.attemptCount > MAX_DELIVERY_ATTEMPTS) return stopSending("attempt_limit_reached", true)
  let proposed: PreparedProviderRequest
  try {
    proposed = prepareProviderRequest({ channel: delivery.channel, eventId: delivery.id, idempotencyKey: delivery.idempotencyKey, lead: claimed.lead })
  } catch (error) {
    if (error instanceof ProviderConfigurationError) return stopSending(error.errorCode, true)
    throw error
  }
  const reserved = await repository.prepareAndReserveProviderAttempt(delivery.id, delivery.leaseToken, proposed)
  if (reserved.kind === "stopped") return publishTerminalAlerts(reserved.reason, reserved.terminalAt)
  if (reserved.kind !== "ready") return { state: reserved.kind }
  const clockError = !Number.isFinite(reserved.firstAttemptAt.getTime())
  if (clockError) return stopSending("provider_clock_invalid", true)
  if (currentTime().getTime() - reserved.firstAttemptAt.getTime() >= PROVIDER_RETRY_WINDOW_MS) return stopSending("provider_retry_window_expired", true)
  const authorizationError = preparedRequestAuthorization(delivery.channel, reserved.request)
  if (authorizationError) return stopSending(authorizationError, true)
  if (!await repository.isOutboxSendAllowed(delivery.id, delivery.leaseToken, currentTime())) return { state: "stale" as const }
  // Fresh local time after DB latency; there is no await between this check and HTTP.
  if (currentTime().getTime() - reserved.firstAttemptAt.getTime() >= PROVIDER_RETRY_WINDOW_MS) return stopSending("provider_retry_window_expired", true)

  logContactEvent("info", "lead_delivery_started", {
    submissionId: delivery.leadId,
    outboxId: delivery.id,
    channel: delivery.channel,
    attemptCount: delivery.attemptCount,
    state: "processing",
  })

  const result = await deliverToConfiguredProvider({
    channel: delivery.channel,
    eventId: delivery.id,
    idempotencyKey: delivery.idempotencyKey,
    preparedRequest: reserved.request,
  })

  await repository.recordProviderAttemptResult(reserved.reservationId, result)

  if (result.ok) {
    const updated = await repository.markOutboxDelivered(
      delivery.id,
      delivery.leaseToken,
      result.providerMessageId
    )

    logContactEvent(updated ? "info" : "warn", "lead_delivery_completed", {
      submissionId: delivery.leadId,
      outboxId: delivery.id,
      channel: delivery.channel,
      attemptCount: delivery.attemptCount,
      latencyMs: Date.now() - startedAt,
      state: updated ? "provider_accepted" : "stale_lease",
    })

    return { state: updated ? ("delivered" as const) : ("stale" as const) }
  }

  const shouldDeadLetter =
    !result.retryable || delivery.attemptCount >= MAX_DELIVERY_ATTEMPTS

  if (shouldDeadLetter) {
    return stopSending(result.errorCode, result.retryable || result.errorCode.startsWith("provider_") || configurationFailure(result.errorCode))
  }

  const nextAttemptAt = getNextAttemptAt(
    delivery.attemptCount,
    now,
    options.random
  )

  if (!nextAttemptAt) {
    throw new Error("RetryScheduleExhausted")
  }

  const updated = await repository.rescheduleOutbox(
    delivery.id,
    delivery.leaseToken,
    { nextAttemptAt, errorCode: result.errorCode }
  )

  logContactEvent("warn", "lead_delivery_rescheduled", {
    submissionId: delivery.leadId,
    outboxId: delivery.id,
    channel: delivery.channel,
    attemptCount: delivery.attemptCount,
    errorCode: result.errorCode,
    latencyMs: Date.now() - startedAt,
    state: updated ? "retry_scheduled" : "stale_lease",
  })

  return {
    state: updated ? ("retry_scheduled" as const) : ("stale" as const),
    nextAttemptAt,
  }
}

export async function sweepLeadDeliveryQueue(
  repository: DeliveryOperationsRepository,
  options: {
    now?: Date
    publishWake: (outboxIds: readonly string[]) => Promise<unknown>
    publishAlert: PublishAlert
  }
) {
  const now = options.now ?? new Date()
  const due = await repository.listDueOrLeaseExpiredOutbox(now, 25)

  if (due.length > 0) {
    await options.publishWake(due.map((item) => item.id))
  }

  const queueAgeMs = await repository.getOldestDueOutboxAge(now)

  if (queueAgeMs !== null && queueAgeMs > QUEUE_AGE_ALERT_MS) {
    const fiveMinuteBucket = Math.floor(now.getTime() / QUEUE_AGE_ALERT_MS)

    await options.publishAlert({
      schemaVersion: 1,
      eventId: `queue-age/${fiveMinuteBucket}`,
      type: "queue_age",
      occurredAt: now.toISOString(),
      queueAgeMs,
    })
  }

  logContactEvent("info", "lead_delivery_sweep_completed", {
    count: due.length,
    queueAgeMs: queueAgeMs ?? undefined,
    state: "completed",
  })

  return { queued: due.length, queueAgeMs }
}

export async function enforceLeadRetention(
  repository: DeliveryOperationsRepository,
  now = new Date()
) {
  const redacted = await repository.redactExpiredLeads(
    now,
    RETENTION_BATCH_SIZE
  )
  const deleted = await repository.deleteExpiredLeads(
    now,
    RETENTION_BATCH_SIZE
  )

  logContactEvent("info", "lead_retention_completed", {
    count: redacted + deleted,
    state: "completed",
  })

  return { redacted, deleted }
}
