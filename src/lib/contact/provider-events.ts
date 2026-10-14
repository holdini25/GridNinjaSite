import { Webhook } from "svix"

export const DELIVERY_EVENT_TYPES = ["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.failed", "email.complained", "email.suppressed"] as const
export type DeliveryEventType = typeof DELIVERY_EVENT_TYPES[number]
export type ProviderDeliveryEvent = {
  accountRef: string
  eventId: string
  providerMessageId: string
  eventType: DeliveryEventType
  occurredAt: Date
}

// The maintained Svix verifier enforces timestamp tolerance and signs the raw
// payload. Never parse/re-serialize before this boundary or log this payload.
export function verifyResendPayload(body: string, headers: Headers, secrets: readonly string[]): unknown {
  const id = headers.get("svix-id") ?? ""
  const timestamp = headers.get("svix-timestamp") ?? ""
  const signature = headers.get("svix-signature") ?? ""
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id) || !/^\d{10,11}$/.test(timestamp) || signature.length > 2048) throw new Error("InvalidProviderSignature")
  for (const secret of secrets) {
    try { new Webhook(secret).verify(body, { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature }) } catch { continue }
    // Svix 2 verifies without parsing. Only parse after authentication succeeds.
    return JSON.parse(body) as unknown
  }
  throw new Error("InvalidProviderSignature")
}

export function parseProviderDeliveryEvent(value: unknown, eventId: string, accountRef: string): ProviderDeliveryEvent | null {
  if (!value || typeof value !== "object" || !/^[A-Za-z0-9_-]{1,200}$/.test(eventId) || !/^[A-Za-z0-9_-]{1,64}$/.test(accountRef)) return null
  const envelope = value as Record<string, unknown>
  if (!DELIVERY_EVENT_TYPES.includes(envelope.type as DeliveryEventType)) return null
  const data = envelope.data as Record<string, unknown> | undefined
  if (!data || typeof data.email_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(data.email_id)
    || typeof envelope.created_at !== "string") return null
  const occurredAt = new Date(envelope.created_at)
  if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 300_000) return null
  return { accountRef, eventId, providerMessageId: data.email_id, eventType: envelope.type as DeliveryEventType, occurredAt }
}

export function deriveDeliveryObservation(providerAccepted: boolean, events: readonly Pick<ProviderDeliveryEvent, "eventType">[], acknowledged: boolean) {
  const types = new Set(events.map(event => event.eventType))
  const adverse = ["email.bounced", "email.failed", "email.complained", "email.suppressed"].some(type => types.has(type as DeliveryEventType))
  return {
    durableAcceptance: true,
    providerAcceptance: providerAccepted || types.size > 0 ? "accepted" : "unknown",
    recipientDelivery: adverse ? "failed" : types.has("email.delivered") ? "delivered" : types.has("email.delivery_delayed") ? "delayed" : "unknown",
    operatorAcknowledgement: acknowledged ? "acknowledged" : "unknown",
  } as const
}
