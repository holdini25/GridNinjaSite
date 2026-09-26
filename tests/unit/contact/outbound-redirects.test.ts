// @vitest-environment node
import { createServer } from "node:http"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sendOperatorAlert } from "@/lib/contact/alerts"
import { deliverToConfiguredProvider, type DeliveryRequest } from "@/lib/contact/providers"
import { verifyTurnstile } from "@/lib/contact/turnstile"

const nativeFetch = globalThis.fetch
const request: DeliveryRequest = {
  channel: "internal_email", eventId: "event", idempotencyKey: "original-key",
  lead: { id: "lead", schemaVersion: 2, formType: "contact", acceptedAt: new Date("2026-09-24T12:00:00Z"), name: "Test", company: "Fixture", email: "fixture@example.test", buyerType: null, siteType: null, timeline: null, capacityRange: null, intent: "other", source: "contact", role: null, constraints: [], message: "Synthetic fixture" },
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("sensitive outbound redirect containment", () => {
  it.each(["resend", "crm", "alert", "turnstile"] as const)("does not forward %s credentials or payload to a 307 destination", async (channel) => {
    let initialRequests = 0, destinationRequests = 0
    const server = createServer((incoming, response) => {
      if (incoming.url === "/destination") { destinationRequests++; response.end("Unexpected forwarding"); return }
      initialRequests++; incoming.resume(); response.writeHead(307, { Location: "/destination" }); response.end()
    })
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("fixture_server_address")
    const origin = `http://127.0.0.1:${address.port}`
    const fetcher = vi.fn<typeof fetch>((_url, init) => nativeFetch(origin, init))
    try {
      vi.stubEnv("RESEND_API_KEY", "fixture-api-secret")
      vi.stubEnv("LEAD_WEBHOOK_URL", "https://crm.example.test")
      vi.stubEnv("LEAD_WEBHOOK_SIGNING_SECRET", "fixture-signing-secret")
      if (channel === "resend" || channel === "crm") {
        const result = await deliverToConfiguredProvider({ ...request, channel: channel === "resend" ? "internal_email" : "crm_webhook", frozenRequest: { body: '{"synthetic":"private"}', targetUrl: channel === "resend" ? "https://api.resend.com/emails" : "https://crm.example.test" } }, fetcher)
        expect(result).toMatchObject({ ok: false, retryable: true })
        if (channel === "crm") expect(fetcher.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({ "X-GridNinja-Signature": expect.stringMatching(/^v1=[a-f0-9]{64}$/) }))
      } else if (channel === "alert") {
        await expect(sendOperatorAlert({ alertWebhookUrl: "https://alerts.example.test", alertWebhookToken: "fixture-alert-secret" }, { schemaVersion: 1, eventId: "incident", type: "monitor_incident", occurredAt: new Date().toISOString() }, fetcher)).rejects.toThrow()
      } else {
        vi.stubGlobal("fetch", fetcher)
        expect(await verifyTurnstile({ token: "fixture-token", remoteIp: "127.0.0.1", requestId: "fixture-request", expectedAction: "contact", secretKey: "fixture-verification-secret", allowedHostnames: new Set(["gridninja.test"]) })).toEqual({ status: "unavailable", errorCode: "request_failed" })
      }
      expect(fetcher).toHaveBeenCalledOnce()
      expect(fetcher.mock.calls[0][1]?.redirect).toBe("error")
      expect(initialRequests).toBe(1)
      expect(destinationRequests).toBe(0)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
})
