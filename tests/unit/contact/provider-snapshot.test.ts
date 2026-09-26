// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { deliverToConfiguredProvider, prepareProviderRequest, type DeliveryRequest } from "@/lib/contact/providers"
const request: DeliveryRequest = { channel: "internal_email", eventId: "event", idempotencyKey: "original-key", lead: {
  id: "lead", schemaVersion: 2, formType: "contact", acceptedAt: new Date("2026-09-24T12:00:00Z"), name: "Test", company: "Fixture", email: "fixture@example.test", buyerType: null, siteType: null, timeline: null, capacityRange: null, intent: "other", source: "contact", role: null, constraints: [], message: "Test <input>",
} }
afterEach(() => vi.unstubAllEnvs())
describe("frozen provider requests", () => {
  it("reuses exact persisted bytes and key after recipient and template inputs change", async () => {
    vi.stubEnv("LEAD_EMAIL_FROM", "original@example.test"); vi.stubEnv("LEAD_EMAIL_TO", "authorized@example.test"); vi.stubEnv("RESEND_API_KEY", "fixture-token")
    const frozenRequest = prepareProviderRequest(request)
    vi.stubEnv("LEAD_EMAIL_TO", "changed@example.test")
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "provider-id" }))
    const result = await deliverToConfiguredProvider({ ...request, lead: { ...request.lead, message: "Changed" }, frozenRequest }, fetcher)
    expect(result).toEqual({ ok: true, status: 200, providerMessageId: "provider-id" })
    expect(fetcher).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ body: frozenRequest.body, headers: expect.objectContaining({ "Idempotency-Key": "original-key" }) }))
    expect(frozenRequest.body).not.toContain("changed@example.test")
  })
  it("classifies removed optional CRM URL or secret before first request preparation", () => {
    vi.stubEnv("LEAD_WEBHOOK_URL", ""); vi.stubEnv("LEAD_WEBHOOK_SIGNING_SECRET", "")
    expect(() => prepareProviderRequest({ ...request, channel: "crm_webhook" })).toThrow("crm_webhook_not_configured")
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://crm.example.test")
    expect(() => prepareProviderRequest({ ...request, channel: "crm_webhook" })).toThrow("crm_webhook_not_configured")
  })
  it("does not call a changed CRM target with frozen inquiry data", async () => {
    vi.stubEnv("LEAD_WEBHOOK_URL", "https://new.example.test"); vi.stubEnv("LEAD_WEBHOOK_SIGNING_SECRET", "s".repeat(32))
    const fetcher = vi.fn()
    expect(await deliverToConfiguredProvider({ ...request, channel: "crm_webhook", frozenRequest: { body: "private", targetUrl: "https://old.example.test" } }, fetcher)).toMatchObject({ ok: false, retryable: false, errorCode: "provider_target_changed" })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("treats success without a usable provider identity as uncertain and retries the same key", async () => {
    vi.stubEnv("RESEND_API_KEY", "fixture-token")
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "contains private information@example.test" }))
    expect(await deliverToConfiguredProvider({ ...request, frozenRequest: { body: "{}", targetUrl: "https://api.resend.com/emails" } }, fetcher)).toEqual({ ok: false, status: 200, errorCode: "resend_invalid_success", retryable: true })
  })
})
