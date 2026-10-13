import { afterEach, describe, expect, it, vi } from "vitest"
import { Webhook } from "svix"
import { deriveDeliveryObservation, parseProviderDeliveryEvent, verifyResendPayload } from "@/lib/contact/provider-events"

const secret = `whsec_${Buffer.alloc(32, 3).toString("base64")}`
const prior = `whsec_${Buffer.alloc(32, 9).toString("base64")}`
const now = new Date("2026-10-12T12:00:00Z")
function signed(body: string, key = secret, timestamp = now) {
  return new Headers({ "svix-id": "msg_event_1", "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)), "svix-signature": new Webhook(key).sign("msg_event_1", timestamp, body) })
}
afterEach(() => vi.useRealTimers())

describe("account-bound minimal provider observations", () => {
  it("uses maintained signature verification on exact bytes and rotation secrets", () => {
    vi.useFakeTimers().setSystemTime(now)
    const body = '{"value": 1}'
    expect(verifyResendPayload(body, signed(body, prior), [secret, prior])).toEqual({ value: 1 })
    expect(() => verifyResendPayload('{"value":1}', signed(body), [secret])).toThrow()
    expect(() => verifyResendPayload(body, signed(body), [prior])).toThrow()
  })
  it.each([-301000, 301000])("rejects replay/future timestamp offset %s", offset => {
    vi.useFakeTimers().setSystemTime(now)
    expect(() => verifyResendPayload("{}", signed("{}", secret, new Date(now.getTime() + offset)), [secret])).toThrow()
  })
  it("rejects missing and oversized signature headers", () => {
    expect(() => verifyResendPayload("{}", new Headers(), [secret])).toThrow()
    const headers = signed("{}")
    headers.set("svix-signature", "x".repeat(2049))
    expect(() => verifyResendPayload("{}", headers, [secret])).toThrow()
  })
  it("projects only operational identity; no raw recipient or body persists", () => {
    vi.useFakeTimers().setSystemTime(now)
    const event = parseProviderDeliveryEvent({ type: "email.delivered", created_at: now.toISOString(), data: {
      email_id: "email_123", to: ["private@example.test"], subject: "private", html: "secret", outbox_id: "attacker-choice",
    } }, "msg_123", "verified_account")
    expect(event).toEqual({ accountRef: "verified_account", eventId: "msg_123", providerMessageId: "email_123", eventType: "email.delivered", occurredAt: now })
  })
  it.each(["email.opened", "email.clicked", "unknown"])("discards unused event %s", type => {
    expect(parseProviderDeliveryEvent({ type, created_at: now.toISOString(), data: { email_id: "id" } }, "msg", "account")).toBeNull()
  })
  it("rejects malformed identity and future event date", () => {
    vi.useFakeTimers().setSystemTime(now)
    const payload = { type: "email.sent", created_at: new Date(now.getTime() + 301000).toISOString(), data: { email_id: "id" } }
    expect(parseProviderDeliveryEvent(payload, "msg", "account")).toBeNull()
    expect(parseProviderDeliveryEvent({ ...payload, created_at: now.toISOString() }, "bad event", "account")).toBeNull()
  })
  it("preserves adverse evidence after delivered/sent and distinguishes human handling", () => {
    expect(deriveDeliveryObservation(true, [{ eventType: "email.delivered" }, { eventType: "email.bounced" }, { eventType: "email.sent" }], false)).toEqual({
      durableAcceptance: true, providerAcceptance: "accepted", recipientDelivery: "failed", operatorAcknowledgement: "unknown",
    })
    expect(deriveDeliveryObservation(true, [], true)).toMatchObject({ recipientDelivery: "unknown", operatorAcknowledgement: "acknowledged" })
  })
})
