// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const { allow } = vi.hoisted(() => ({ allow: vi.fn() }))
vi.mock("@/lib/security/csp-rate-limit", () => ({ allowCspReport: allow }))
import { POST } from "@/app/api/security/csp-report/route"
const report = { "csp-report": { "document-uri": "https://gridninja.ai/demo?secret=private", "effective-directive": "script-src-elem", "blocked-uri": "inline", "script-sample": "private form data" } }
const request = (body: unknown) => new Request("https://gridninja.ai/api/security/csp-report", { method: "POST", headers: { "content-type": "application/csp-report" }, body: JSON.stringify(body) })
beforeEach(() => { allow.mockReset().mockResolvedValue("allowed") })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
describe("CSP report endpoint", () => {
  it("accepts sanitized diagnostics without retaining source text or URLs", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    const response = await POST(request(report))
    expect(response.status).toBe(204)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0][0]).not.toMatch(/secret|private|https:/)
  })
  it("fails closed during rate-limit outages and never logs rejected input", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    allow.mockResolvedValueOnce("limited").mockResolvedValueOnce("unavailable")
    expect((await POST(request(report))).status).toBe(429)
    expect((await POST(request(report))).status).toBe(503)
    expect(log).not.toHaveBeenCalled()
  })
  it("terminates stalled input without logging payloads", async () => {
    vi.useFakeTimers()
    const cancel = vi.fn(), log = vi.spyOn(console, "info").mockImplementation(() => {})
    const body = new ReadableStream<Uint8Array>({ cancel })
    const incoming = new Request("https://gridninja.ai/api/security/csp-report", {
      method: "POST", headers: { "content-type": "application/csp-report" }, body,
      duplex: "half",
    } as RequestInit)
    const pending = POST(incoming)
    await vi.advanceTimersByTimeAsync(5_001)
    const response = await pending
    expect(response.status).toBe(408)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(cancel).toHaveBeenCalledOnce()
    expect(log).not.toHaveBeenCalled()
  })
  it("bounds both bytes and report count", async () => {
    expect((await POST(request({ data: "a".repeat(16_384) }))).status).toBe(413)
    expect((await POST(request(Array(21).fill(report)))).status).toBe(400)
    expect((await POST(new Request("https://gridninja.ai/api/security/csp-report", { method: "POST", body: "text" }))).status).toBe(415)
  })
})
