import "server-only"

import { Client } from "@upstash/qstash"

import type { ContactRuntimeConfig } from "@/lib/contact/config"
import { PROVIDER_TIMEOUT_MS } from "@/lib/contact/delivery-core"

export type OperatorAlert = {
  schemaVersion: 1
  eventId: string
  type:
    | "dead_letter"
    | "queue_age"
    | "database_failure"
    | "configuration_failure"
  occurredAt: string
  outboxId?: string
  submissionId?: string
  channel?: string
  attemptCount?: number
  errorCode?: string
  queueAgeMs?: number
}

const ALERT_KEYS = new Set([
  "schemaVersion",
  "eventId",
  "type",
  "occurredAt",
  "outboxId",
  "submissionId",
  "channel",
  "attemptCount",
  "errorCode",
  "queueAgeMs",
])

export function parseOperatorAlert(value: unknown): OperatorAlert | null {
  if (!value || typeof value !== "object") return null

  const alert = value as Partial<OperatorAlert>
  const valuesAreSafe = Object.keys(alert).every((key) => ALERT_KEYS.has(key))
  const validType = [
    "dead_letter",
    "queue_age",
    "database_failure",
    "configuration_failure",
  ].includes(alert.type ?? "")
  const validOptionalString = (candidate: unknown, maxLength: number) =>
    candidate === undefined ||
    (typeof candidate === "string" && candidate.length <= maxLength)
  const validOptionalNumber = (candidate: unknown) =>
    candidate === undefined ||
    (typeof candidate === "number" &&
      Number.isSafeInteger(candidate) &&
      candidate >= 0)

  if (
    !(
      valuesAreSafe &&
      alert.schemaVersion === 1 &&
      typeof alert.eventId === "string" &&
      alert.eventId.length > 0 &&
      alert.eventId.length <= 200 &&
      validType &&
      typeof alert.occurredAt === "string" &&
      !Number.isNaN(Date.parse(alert.occurredAt)) &&
      validOptionalString(alert.outboxId, 128) &&
      validOptionalString(alert.submissionId, 128) &&
      validOptionalString(alert.channel, 32) &&
      validOptionalString(alert.errorCode, 80) &&
      validOptionalNumber(alert.attemptCount) &&
      validOptionalNumber(alert.queueAgeMs)
    )
  ) {
    return null
  }

  return alert as OperatorAlert
}

export async function publishOperatorAlert(
  config: ContactRuntimeConfig,
  alert: OperatorAlert
) {
  const qstash = new Client({ token: config.qstashToken })

  return qstash.publishJSON({
    url: `${config.publicBaseUrl}/api/internal/lead-alert`,
    body: alert,
    deduplicationId: `lead-alert/${alert.eventId}`,
    retries: 5,
    timeout: "15s",
  })
}

export async function sendOperatorAlert(
  config: ContactRuntimeConfig,
  alert: OperatorAlert,
  fetcher: typeof fetch = fetch
) {
  if (!config.alertWebhookUrl) {
    // Non-production environments may intentionally have no alert sink.
    return { delivered: false, skipped: true }
  }

  const body = JSON.stringify(alert)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const response = await fetcher(config.alertWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": alert.eventId,
      "X-GridNinja-Alert-Id": alert.eventId,
      "X-GridNinja-Timestamp": timestamp,
      ...(config.alertWebhookToken
        ? { Authorization: `Bearer ${config.alertWebhookToken}` }
        : {}),
    },
    body,
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  })

  // Never read or log an alert provider's response body.
  if (!response.ok) {
    throw new Error(`AlertDeliveryHttp${response.status}`)
  }

  return { delivered: true, skipped: false }
}
