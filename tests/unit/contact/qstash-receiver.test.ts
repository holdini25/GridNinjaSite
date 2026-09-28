// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { withVerifiedQstashSignature } from "@/lib/contact/qstash-receiver"
import { CONTACT_MAX_BODY_BYTES } from "@/lib/contact/request"
const mocks = vi.hoisted(() => ({ verify: vi.fn(), config: vi.fn(), log: vi.fn() }))
vi.mock("@upstash/qstash", () => ({ Receiver: class { verify = mocks.verify } }))
vi.mock("@/lib/contact/config", () => ({ getContactRuntimeConfig: mocks.config, ContactConfigurationError: class extends Error {} }))
vi.mock("@/lib/contact/log", () => ({ classifyContactError: () => "Error", logContactEvent: mocks.log }))
const request = (body: string, headers = {}) => new Request("http://localhost/api/internal/lead-delivery", { method: "POST", body, headers: { "upstash-signature": "signed-test", ...headers } })
beforeEach(() => { vi.clearAllMocks(); mocks.config.mockReturnValue({ publicBaseUrl: "https://preview.example.test", qstashCurrentSigningKey: "current", qstashNextSigningKey: "next" }); mocks.verify.mockResolvedValue(true) })
describe("internal queue ingress is bounded and fail-closed", () => {
  it("rejects an unsigned body without consuming it or resolving credentials", async () => {
    const req = new Request("http://localhost/api/internal/lead-delivery", { method: "POST", body: "x".repeat(CONTACT_MAX_BODY_BYTES + 1) })
    const handler = vi.fn(), response = await withVerifiedQstashSignature(handler)(req)
    expect(response.status).toBe(401); expect(req.bodyUsed).toBe(false)
    expect(mocks.config).not.toHaveBeenCalled(); expect(handler).not.toHaveBeenCalled()
  })
  it("rejects declared and undeclared oversized UTF-8 bodies before verifying or parsing", async () => {
    for (const req of [request("x", { "content-length": String(CONTACT_MAX_BODY_BYTES + 1) }), request("é".repeat(CONTACT_MAX_BODY_BYTES))]) {
      expect((await withVerifiedQstashSignature(vi.fn())(req)).status).toBe(413)
    }
    expect(mocks.verify).not.toHaveBeenCalled()
  })
  it("returns a non-cacheable timeout for a stalled signed body before verification", async () => {
    vi.useFakeTimers()
    try {
      const cancel = vi.fn(), handler = vi.fn()
      const req = new Request("http://localhost/api/internal/lead-delivery", Object.assign({ method: "POST", headers: { "upstash-signature": "signed-test" }, body: new ReadableStream({ cancel }) }, { duplex: "half" }))
      const result = withVerifiedQstashSignature(handler)(req)
      await vi.advanceTimersByTimeAsync(5001)
      const response = await result
      expect(response.status).toBe(408); expect(response.headers.get("cache-control")).toBe("no-store")
      expect(cancel).toHaveBeenCalledOnce(); expect(mocks.verify).not.toHaveBeenCalled(); expect(handler).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })
  it("authenticates exact raw bytes against canonical handler URL before parsing", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("ok")), body = '{ "outboxId": "test" }'
    expect((await withVerifiedQstashSignature(handler)(request(body))).status).toBe(200)
    expect(mocks.verify).toHaveBeenCalledWith({ body, signature: "signed-test", url: "https://preview.example.test/api/internal/lead-delivery" })
    expect(handler).toHaveBeenCalledWith(expect.any(Request), { outboxId: "test" })
  })
  it("never invokes a worker for invalid signatures or malformed authenticated JSON", async () => {
    const handler = vi.fn(); mocks.verify.mockResolvedValue(false)
    expect((await withVerifiedQstashSignature(handler)(request("{}"))).status).toBe(401)
    mocks.verify.mockResolvedValue(true)
    expect((await withVerifiedQstashSignature(handler)(request("{"))).status).toBe(400)
    expect(handler).not.toHaveBeenCalled()
  })
})
