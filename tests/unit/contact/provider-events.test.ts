// @vitest-environment node
import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { deriveDeliveryObservation, parseProviderDeliveryEvent, verifyResendSignature } from "@/lib/contact/provider-events"
import { hasInternalBearer } from "@/lib/contact/internal-auth"
const now = Date.parse("2026-09-24T12:00:00Z")
const secret = `whsec_${Buffer.from("a sufficiently long test secret").toString("base64")}`
const payload = JSON.stringify({ type: "email.delivered", created_at: new Date(now).toISOString(), data: { email_id: "provider-id", to: ["private@example.test"], subject: "Private", html: "Private" } })
function headers(body = payload, timestamp = Math.floor(now / 1000).toString()) {
  const signature = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`msg_test.${timestamp}.${body}`).digest("base64")
  return new Headers({ "svix-id": "msg_test", "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` })
}
describe("Resend callback authentication and minimal delivery observations", () => {
  it("matches the published Svix test vector", () => {
    expect(verifyResendSignature('{"event_type":"ping","data":{"success":true}}', new Headers({
      "svix-id": "msg_loFOjxBNrRLzqYUf", "svix-timestamp": "1731705121", "svix-signature": "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=",
    }), ["whsec_plJ3nmyCDGBKInavdOK15jsl"], 1731705121_000)).toBe(true)
  })
  it("authenticates exact bytes, bounded timestamps, versions, and rotating secrets", () => {
    expect(verifyResendSignature(payload, headers(), [secret], now)).toBe(true)
    expect(verifyResendSignature(payload + " ", headers(), [secret], now)).toBe(false)
    expect(verifyResendSignature(payload, headers(), [secret], now + 301_000)).toBe(false)
    expect(verifyResendSignature(payload, headers(payload, String(now / 1000 + 301)), [secret], now)).toBe(false)
    expect(verifyResendSignature(payload, headers(), ["whsec_aW52YWxpZA==", secret], now)).toBe(true)
    const version = headers(); version.set("svix-signature", version.get("svix-signature")!.replace("v1", "v2"))
    expect(verifyResendSignature(payload, version, [secret], now)).toBe(false)
    const rotation = headers(); rotation.set("svix-signature", `v1,${Buffer.alloc(32).toString("base64")} ${headers().get("svix-signature")}`)
    expect(verifyResendSignature(payload, rotation, [secret], now)).toBe(true)
  })
  it("projects no recipient, subject, body, open or click data into persistence", () => {
    const event = parseProviderDeliveryEvent(JSON.parse(payload), "msg_test")
    expect(event).toEqual({ eventId: "msg_test", providerMessageId: "provider-id", eventType: "email.delivered", occurredAt: new Date(now) })
    expect(JSON.stringify(event)).not.toMatch(/Private|private@|subject|html/)
    for (const type of ["email.opened", "email.clicked", "contact.created"]) expect(parseProviderDeliveryEvent({ ...JSON.parse(payload), type }, "id")).toBeNull()
  })
  it("does not backfill delivery from legacy provider acceptance or late sent events", () => {
    expect(deriveDeliveryObservation(true, [], false)).toMatchObject({ providerAcceptance: "accepted", recipientDelivery: "unknown", operatorAcknowledgement: "unknown" })
    const events = [{ eventType: "email.delivered" as const, occurredAt: new Date(now) }, { eventType: "email.sent" as const, occurredAt: new Date(now - 1000) }]
    expect(deriveDeliveryObservation(false, events, true)).toMatchObject({ recipientDelivery: "delivered", operatorAcknowledgement: "acknowledged" })
    expect(deriveDeliveryObservation(true, [...events, { eventType: "email.bounced", occurredAt: new Date(now + 1) }], false).recipientDelivery).toBe("failed")
    expect(deriveDeliveryObservation(true, [...events].reverse(), false).recipientDelivery).toBe("delivered")
  })
  it("requires a long exact internal bearer and never accepts missing configuration", () => {
    const token = "x".repeat(32)
    expect(hasInternalBearer(new Request("https://example.test", { headers: { authorization: `Bearer ${token}` } }), token)).toBe(true)
    expect(hasInternalBearer(new Request("https://example.test"), undefined)).toBe(false)
    expect(hasInternalBearer(new Request("https://example.test", { headers: { authorization: `Bearer ${token}x` } }), token)).toBe(false)
  })
})
