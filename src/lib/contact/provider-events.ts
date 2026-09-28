import { createHmac, timingSafeEqual } from "node:crypto"

export const DELIVERY_EVENT_TYPES = ["email.sent", "email.delivered", "email.delivery_delayed", "email.bounced", "email.failed", "email.complained", "email.suppressed"] as const
export type DeliveryEventType = (typeof DELIVERY_EVENT_TYPES)[number]
export type ProviderDeliveryEvent = {
  eventId: string
  providerMessageId: string
  eventType: DeliveryEventType
  occurredAt: Date
}

// Resend uses Svix: authenticate the exact raw body, not reserialized JSON.
// https://docs.svix.com/receiving/verifying-payloads/how-manual
export function verifyResendSignature(body: string, headers: Headers, secrets: readonly string[], now = Date.now()) {
  const id = headers.get("svix-id") ?? ""
  const timestamp = headers.get("svix-timestamp") ?? ""
  const signatures = headers.get("svix-signature") ?? ""
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id) || !/^\d{10,11}$/.test(timestamp) ||
      signatures.length > 2048 || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  return secrets.some((secret) => {
    if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) return false
    const key = Buffer.from(secret.slice(6), "base64")
    if (key.length < 16) return false
    const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest()
    return signatures.split(" ").some((entry) => {
      if (!/^v1,[A-Za-z0-9+/]{43}=$/.test(entry)) return false
      const received = Buffer.from(entry.slice(3), "base64")
      return received.length === expected.length && timingSafeEqual(received, expected)
    })
  })
}

export function parseProviderDeliveryEvent(value: unknown, eventId: string): ProviderDeliveryEvent | null {
  if (!value || typeof value !== "object") return null
  const envelope = value as Record<string, unknown>
  if (!DELIVERY_EVENT_TYPES.includes(envelope.type as DeliveryEventType)) return null
  const data = envelope.data as Record<string, unknown> | undefined
  if (!data || typeof data.email_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(data.email_id) ||
      typeof envelope.created_at !== "string") return null
  const occurredAt = new Date(envelope.created_at)
  if (!Number.isFinite(occurredAt.getTime())) return null
  // Explicit projection: visitor/recipient addresses, HTML, subjects, and arbitrary
  // provider fields never cross the persistence boundary.
  return { eventId, providerMessageId: data.email_id, eventType: envelope.type as DeliveryEventType, occurredAt }
}

export type DeliveryObservation = {
  durableAcceptance: true
  providerAcceptance: "accepted" | "unknown"
  recipientDelivery: "delivered" | "failed" | "delayed" | "unknown"
  operatorAcknowledgement: "acknowledged" | "unknown"
}

export function deriveDeliveryObservation(providerAccepted: boolean, events: readonly Pick<ProviderDeliveryEvent, "eventType" | "occurredAt">[], acknowledged: boolean): DeliveryObservation {
  // Terminal negative evidence is never erased by a late 'sent' or 'delivered'
  // callback. All observations remain available for operator reconciliation.
  const types = new Set(events.map((event) => event.eventType))
  const failed = ["email.bounced", "email.failed", "email.complained", "email.suppressed"].some((type) => types.has(type as DeliveryEventType))
  return {
    durableAcceptance: true,
    providerAcceptance: providerAccepted || types.size > 0 ? "accepted" : "unknown",
    recipientDelivery: failed ? "failed" : types.has("email.delivered") ? "delivered" : types.has("email.delivery_delayed") ? "delayed" : "unknown",
    operatorAcknowledgement: acknowledged ? "acknowledged" : "unknown",
  }
}
