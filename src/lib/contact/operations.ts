import "server-only"

import type { OperatorAlert } from "@/lib/contact/alerts"
import {
  type DeliveryChannel,
  getNextAttemptAt,
  type LeadDeliveryPayload,
  MAX_DELIVERY_ATTEMPTS,
} from "@/lib/contact/delivery-core"
import { logContactEvent } from "@/lib/contact/log"
import { deliverToConfiguredProvider, prepareProviderRequest, ProviderConfigurationError, type FrozenProviderRequest } from "@/lib/contact/providers"

export const PROVIDER_RETRY_WINDOW_MS = 23 * 60 * 60_000

const DELIVERY_LEASE_MS = 30_000
const QUEUE_AGE_ALERT_MS = 5 * 60_000
const RETENTION_BATCH_SIZE = 1_000

export type ClaimedDelivery = {
  delivery: {
    id: string
    leadId: string
    channel: DeliveryChannel
    attemptCount: number
    leaseToken: string
    idempotencyKey: string
    firstProviderAttemptAt: Date | null
    frozenRequest: FrozenProviderRequest | null
  }
  lead: LeadDeliveryPayload
}

export type DeliveryOperationsRepository = {
  claimNextDueOutbox(now: Date, leaseMs: number): Promise<ClaimedDelivery | null>
  claimOutboxById(
    id: string,
    now: Date,
    leaseMs: number
  ): Promise<ClaimedDelivery | null>
  beginProviderAttempt(id: string, leaseToken: string, request: FrozenProviderRequest, now: Date): Promise<{ firstProviderAttemptAt: Date; frozenRequest: FrozenProviderRequest } | null>
  recordHeartbeat(operation: "sweep" | "retention", now: Date): Promise<void>
  pruneProviderEvents(cutoff: Date): Promise<void>
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
    update: { errorCode: string; reviewRequiredAt?: Date }
  ): Promise<boolean>
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

  const { delivery, lead } = claimed

  logContactEvent("info", "lead_delivery_started", {
    submissionId: delivery.leadId,
    outboxId: delivery.id,
    channel: delivery.channel,
    attemptCount: delivery.attemptCount,
    state: "processing",
  })

  const stopForReview = async () => {
    const reviewTime = options.now ?? new Date()
    const updated = await repository.markOutboxDeadLetter(delivery.id, delivery.leaseToken, {
      errorCode: "needs_review_idempotency_window", reviewRequiredAt: reviewTime,
    })
    // Persist the stop before alerting. The independent monitor observes it even
    // when QStash is unavailable, and no subsequent worker can resend it.
    if (updated) await bestEffortAlert(options.publishAlert, {
      schemaVersion: 1, eventId: `review/${delivery.id}`, type: "dead_letter",
      occurredAt: reviewTime.toISOString(), outboxId: delivery.id, submissionId: delivery.leadId,
      channel: delivery.channel, errorCode: "needs_review_idempotency_window",
    })
    return { state: updated ? "needs_review" as const : "stale" as const }
  }

  if (delivery.channel === "internal_email" && delivery.firstProviderAttemptAt &&
      now.getTime() - delivery.firstProviderAttemptAt.getTime() >= PROVIDER_RETRY_WINDOW_MS) return stopForReview()

  let request: FrozenProviderRequest
  try {
    request = delivery.frozenRequest ?? prepareProviderRequest({
      channel: delivery.channel, eventId: delivery.id, idempotencyKey: delivery.idempotencyKey, lead,
    })
  } catch (error) {
    if (!(error instanceof ProviderConfigurationError)) throw error
    const updated = await repository.markOutboxDeadLetter(delivery.id, delivery.leaseToken, {
      errorCode: error.errorCode,
    })
    if (updated) await bestEffortAlert(options.publishAlert, {
      schemaVersion: 1, eventId: `configuration/${delivery.id}`, type: "configuration_failure",
      occurredAt: now.toISOString(), outboxId: delivery.id, submissionId: delivery.leadId,
      channel: delivery.channel, errorCode: error.errorCode,
    })
    logContactEvent("error", "lead_delivery_configuration_stopped", {
      outboxId: delivery.id, errorCode: error.errorCode, state: updated ? "configuration_failure" : "stale_lease",
    })
    return { state: updated ? "configuration_failure" as const : "stale" as const }
  }
  const persisted = await repository.beginProviderAttempt(delivery.id, delivery.leaseToken, request, now)
  if (!persisted) return { state: "stale" as const }
  // Recheck the durable value immediately before sending, including database
  // latency. Injected clocks remain deterministic in tests.
  const sendTime = options.now?.getTime() ?? Date.now()
  if (delivery.channel === "internal_email" &&
      sendTime - persisted.firstProviderAttemptAt.getTime() >= PROVIDER_RETRY_WINDOW_MS) return stopForReview()
  const result = await deliverToConfiguredProvider({
    channel: delivery.channel,
    eventId: delivery.id,
    idempotencyKey: delivery.idempotencyKey,
    lead,
    frozenRequest: persisted.frozenRequest,
  })

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

    return { state: updated ? ("provider_accepted" as const) : ("stale" as const) }
  }

  const shouldDeadLetter =
    !result.retryable || delivery.attemptCount >= MAX_DELIVERY_ATTEMPTS

  if (shouldDeadLetter) {
    const updated = await repository.markOutboxDeadLetter(
      delivery.id, delivery.leaseToken, { errorCode: result.errorCode }
    )
    if (updated) await bestEffortAlert(options.publishAlert, {
      schemaVersion: 1, eventId: `dead-letter/${delivery.id}`,
      type: result.errorCode.endsWith("_not_configured") ? "configuration_failure" : "dead_letter",
      occurredAt: now.toISOString(), outboxId: delivery.id, submissionId: delivery.leadId,
      channel: delivery.channel, attemptCount: delivery.attemptCount, errorCode: result.errorCode,
    })

    logContactEvent("error", "lead_delivery_dead_lettered", {
      submissionId: delivery.leadId,
      outboxId: delivery.id,
      channel: delivery.channel,
      attemptCount: delivery.attemptCount,
      errorCode: result.errorCode,
      latencyMs: Date.now() - startedAt,
      state: updated ? "dead_letter" : "stale_lease",
    })

    return { state: updated ? ("dead_letter" as const) : ("stale" as const) }
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

  await repository.recordHeartbeat("sweep", now)

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

  await repository.pruneProviderEvents(now)
  await repository.recordHeartbeat("retention", now)

  logContactEvent("info", "lead_retention_completed", {
    count: redacted + deleted,
    state: "completed",
  })

  return { redacted, deleted }
}

async function bestEffortAlert(publish: PublishAlert, alert: OperatorAlert) {
  try { await publish(alert) } catch {
    logContactEvent("error", "lead_alert_publish_failed", { state: "independent_monitor_required", errorCode: "alert_unavailable" })
  }
}
