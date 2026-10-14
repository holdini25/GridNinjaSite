// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deliverToConfiguredProvider, prepareProviderRequest } from "@/lib/contact/providers"
import { parseReviewReason, qualifiedCrmConfiguration, requestDigest } from "@/lib/contact/provider-request"
import type { LeadDeliveryPayload } from "@/lib/contact/delivery-core"

const lead: LeadDeliveryPayload = { id: "lead", schemaVersion: 2, formType: "contact", acceptedAt: new Date("2026-10-12T12:00:00Z"),
  name: "Test", company: "Fixture", email: "fixture@example.test", buyerType: null, siteType: null,
  timeline: null, capacityRange: null, intent: "other", source: "contact", role: null, constraints: [], message: "Original text" }
const input = { channel: "internal_email" as const, eventId: "event", idempotencyKey: "original-key", lead }
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "synthetic-first-key")
  vi.stubEnv("RESEND_ACCOUNT_REF", "verified-account")
  vi.stubEnv("RESEND_ACCOUNT_BINDING_REF", "private-approved-binding")
  vi.stubEnv("RESEND_APPROVED_KEY_SHA256", requestDigest("synthetic-first-key"))
  vi.stubEnv("LEAD_EMAIL_FROM", "from@example.test")
  vi.stubEnv("LEAD_EMAIL_TO", "to@example.test")
  vi.stubEnv("LEAD_WEBHOOK_ENABLED", "false")
})
afterEach(() => vi.unstubAllEnvs())
function enableCrm() {
  vi.stubEnv("LEAD_WEBHOOK_ENABLED", "true")
  vi.stubEnv("LEAD_WEBHOOK_URL", "https://crm.example.test/inquiry")
  vi.stubEnv("LEAD_WEBHOOK_SIGNING_SECRET", "s".repeat(32))
  vi.stubEnv("LEAD_WEBHOOK_ACCOUNT_REF", "crm-account")
  vi.stubEnv("LEAD_WEBHOOK_CONTRACT_REF", "qualified-contract-v1")
  vi.stubEnv("LEAD_WEBHOOK_DEDUPLICATION_HOURS", "24")
}
describe("prepared provider requests", () => {
  it.each([undefined, null, "", "unknown_database_reason"])("rejects unknown database review reason %s", reason => {
    expect(() => parseReviewReason(reason)).toThrow("InvalidProviderReviewReason")
  })
  it("rejects an unapproved credential rotation and missing private binding evidence", async () => {
    const preparedRequest = prepareProviderRequest(input), fetcher = vi.fn()
    vi.stubEnv("RESEND_API_KEY", "synthetic-other-account-key")
    expect(await deliverToConfiguredProvider({ ...input, preparedRequest }, fetcher)).toMatchObject({ errorCode: "resend_account_binding_invalid" })
    vi.stubEnv("RESEND_APPROVED_KEY_SHA256", requestDigest("synthetic-other-account-key"))
    vi.stubEnv("RESEND_ACCOUNT_BINDING_REF", "")
    expect(await deliverToConfiguredProvider({ ...input, preparedRequest }, fetcher)).toMatchObject({ errorCode: "resend_account_binding_invalid" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each(["key", "channel"])("rejects a changed durable %s identity", async identity => {
    const preparedRequest = prepareProviderRequest(input), fetcher = vi.fn()
    const request = { ...input, preparedRequest }
    expect(await deliverToConfiguredProvider(identity === "key" ? { ...request, idempotencyKey: "different-key" } : { ...request, channel: "crm_webhook" }, fetcher))
      .toMatchObject({ ok: false, errorCode: "provider_request_identity_changed" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("sends frozen exact bytes/key across a same-account credential rotation", async () => {
    const preparedRequest = prepareProviderRequest(input)
    expect(preparedRequest.bodySha256).toBe(requestDigest(preparedRequest.bodyUtf8))
    vi.stubEnv("RESEND_API_KEY", "synthetic-rotated-key")
    vi.stubEnv("RESEND_APPROVED_KEY_SHA256", requestDigest("synthetic-rotated-key"))
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "provider-id" }))
    expect(await deliverToConfiguredProvider({ channel: input.channel, eventId: input.eventId, idempotencyKey: "original-key", preparedRequest }, fetcher))
      .toEqual({ ok: true, status: 200, providerMessageId: "provider-id" })
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ body: preparedRequest.bodyUtf8,
      headers: expect.objectContaining({ Authorization: "Bearer synthetic-rotated-key", "Idempotency-Key": "original-key" }) }))
  })
  it.each(["account", "recipient", "sender", "bytes"])("stops a changed %s before sending", async kind => {
    const preparedRequest = prepareProviderRequest(input)
    if (kind === "account") vi.stubEnv("RESEND_ACCOUNT_REF", "different-account")
    if (kind === "recipient") vi.stubEnv("LEAD_EMAIL_TO", "different@example.test")
    if (kind === "sender") vi.stubEnv("LEAD_EMAIL_FROM", "different@example.test")
    const candidate = kind === "bytes" ? { ...preparedRequest, bodyUtf8: "tampered" } : preparedRequest
    const fetcher = vi.fn()
    expect(await deliverToConfiguredProvider({ channel: input.channel, eventId: input.eventId, idempotencyKey: input.idempotencyKey, preparedRequest: candidate }, fetcher)).toMatchObject({ ok: false, retryable: false })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([undefined, "", "private@example.test", "x".repeat(129)])("treats 2xx with unusable identity %s as uncertain", async id => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(id === undefined ? {} : { id }))
    expect(await deliverToConfiguredProvider({ channel: input.channel, eventId: input.eventId, idempotencyKey: input.idempotencyKey, preparedRequest: prepareProviderRequest(input) }, fetcher))
      .toMatchObject({ ok: false, retryable: true, errorCode: "resend_invalid_success" })
  })
  it("bounds streamed provider response bodies before parsing", async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(64 * 1024 + 1)) }, cancel })
    const fetcher = vi.fn().mockResolvedValue(new Response(stream))
    expect(await deliverToConfiguredProvider({ ...input, preparedRequest: prepareProviderRequest(input) }, fetcher))
      .toMatchObject({ ok: false, retryable: true, errorCode: "resend_invalid_success" })
    expect(cancel).toHaveBeenCalledOnce()
  })
  it("keeps a timed-out response body uncertain", async () => {
    vi.useFakeTimers()
    try {
      const fetcher = vi.fn().mockResolvedValue(new Response(new ReadableStream()))
      const result = deliverToConfiguredProvider({ ...input, preparedRequest: prepareProviderRequest(input) }, fetcher)
      await vi.advanceTimersByTimeAsync(8_001)
      await expect(result).resolves.toMatchObject({ ok: false, retryable: true, errorCode: "provider_timeout" })
    } finally { vi.useRealTimers() }
  })
  it("does not create optional CRM delivery merely because a URL and key exist", () => {
    enableCrm(); vi.stubEnv("LEAD_WEBHOOK_ENABLED", "false")
    expect(qualifiedCrmConfiguration()).toBeNull()
    expect(() => prepareProviderRequest({ ...input, channel: "crm_webhook" })).toThrow("crm_contract_not_configured")
  })
  it.each(["", "23", "24.5", "NaN"])("rejects unqualified CRM deduplication hours %s", hours => {
    enableCrm(); vi.stubEnv("LEAD_WEBHOOK_DEDUPLICATION_HOURS", hours)
    expect(qualifiedCrmConfiguration()).toBeNull()
  })
  it("accepts a qualified CRM 204 without inventing an email message identity", async () => {
    enableCrm()
    const preparedRequest = prepareProviderRequest({ ...input, channel: "crm_webhook" })
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    expect(await deliverToConfiguredProvider({ channel: "crm_webhook", eventId: "event", idempotencyKey: input.idempotencyKey, preparedRequest }, fetcher)).toEqual({ ok: true, status: 204 })
    expect(fetcher.mock.calls[0][1]).toMatchObject({ body: preparedRequest.bodyUtf8, redirect: "error" })
  })
  it("stops an existing CRM request if its contract or destination is removed", async () => {
    enableCrm()
    const preparedRequest = prepareProviderRequest({ ...input, channel: "crm_webhook" }), fetcher = vi.fn()
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://different.example.test")
    expect(await deliverToConfiguredProvider({ channel: "crm_webhook", eventId: "event", idempotencyKey: input.idempotencyKey, preparedRequest }, fetcher)).toMatchObject({ errorCode: "provider_destination_changed" })
    vi.stubEnv("LEAD_WEBHOOK_CONTRACT_REF", "")
    expect(await deliverToConfiguredProvider({ channel: "crm_webhook", eventId: "event", idempotencyKey: input.idempotencyKey, preparedRequest }, fetcher)).toMatchObject({ errorCode: "crm_contract_not_configured" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("stops an existing CRM request if its contract changes at the same destination", async () => {
    enableCrm()
    const preparedRequest = prepareProviderRequest({ ...input, channel: "crm_webhook" }), fetcher = vi.fn()
    vi.stubEnv("LEAD_WEBHOOK_CONTRACT_REF", "qualified-contract-v2")
    expect(await deliverToConfiguredProvider({ ...input, channel: "crm_webhook", preparedRequest }, fetcher)).toMatchObject({ errorCode: "provider_destination_changed" })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
