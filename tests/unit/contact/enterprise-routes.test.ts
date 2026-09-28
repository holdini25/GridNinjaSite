// @vitest-environment node
import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ receive: vi.fn(), acknowledge: vi.fn(), observation: vi.fn(), readSnapshot: vi.fn(), runMonitor: vi.fn(), send: vi.fn(), lock: null as string | null, states: new Map<string, unknown>() }))
vi.mock("@/server/leads/enterprise-repository", () => ({ receiveProviderEvent: mocks.receive, acknowledgeDelivery: mocks.acknowledge, getDeliveryObservation: mocks.observation, readMonitorSnapshot: mocks.readSnapshot }))
vi.mock("@/lib/contact/monitor", () => ({ runIndependentMonitor: mocks.runMonitor }))
vi.mock("@/lib/contact/config", () => ({ getContactRuntimeConfig: () => ({}) }))
vi.mock("@/lib/contact/alerts", () => ({ sendOperatorAlert: mocks.send }))
vi.mock("@/lib/contact/log", () => ({ logContactEvent: vi.fn() }))
vi.mock("@upstash/redis", () => ({ Redis: class {
  async set(key: string, value: unknown, opts?: { nx?: boolean }) {
    if (opts?.nx) { if (mocks.lock) return null; mocks.lock = value as string; return "OK" }
    mocks.states.set(key, value); return "OK"
  }
  async get(key: string) { return mocks.states.get(key) ?? null }
  async eval(_script: string, _keys: string[], tokens: string[]) { if (mocks.lock === tokens[0]) mocks.lock = null }
} }))
import { POST } from "@/app/api/webhooks/resend/route"
import { POST as ACK } from "@/app/api/internal/lead-acknowledgement/route"
import { GET } from "@/app/api/internal/lead-monitor/route"
const secret = `whsec_${Buffer.from("a strong fixture webhook key").toString("base64")}`
function request(body: string, signed = true) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`msg_route.${timestamp}.${body}`).digest("base64")
  return new Request("https://gridninja.test/api/webhooks/resend", { method: "POST", body, headers: signed ? { "svix-id": "msg_route", "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` } : {} })
}
beforeEach(() => {
  vi.clearAllMocks(); vi.unstubAllEnvs(); mocks.lock = null; mocks.states.clear()
  vi.stubEnv("RESEND_WEBHOOK_SECRET", secret)
  mocks.receive.mockResolvedValue(undefined)
})
describe("enterprise authenticated routes", () => {
  it("rejects unsigned and oversized callbacks without invoking persistence", async () => {
    const bad = await POST(request("{}", false)); expect(bad.status).toBe(401); expect(bad.headers.get("cache-control")).toBe("no-store")
    expect((await POST(request(" ".repeat(16385)))).status).toBe(413)
    expect(mocks.receive).not.toHaveBeenCalled()
  })
  it("bounds a stalled signed request body without retaining a reader", async () => {
    vi.useFakeTimers()
    try {
      const cancel = vi.fn()
      const stream = new ReadableStream({ cancel })
      const incoming = new Request("https://gridninja.test/api/webhooks/resend", Object.assign({ method: "POST", body: stream, headers: request("{}").headers }, { duplex: "half" }))
      const result = POST(incoming)
      await vi.advanceTimersByTimeAsync(5001)
      expect((await result).status).toBe(408)
      expect(cancel).toHaveBeenCalledOnce()
      expect(mocks.receive).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })
  it("bounds the authenticated acknowledgement body and never touches storage on timeout", async () => {
    vi.stubEnv("LEAD_OPERATIONS_SECRET", "o".repeat(32))
    vi.useFakeTimers()
    try {
      const cancel = vi.fn()
      const incoming = new Request("https://gridninja.test/api/internal/lead-acknowledgement", Object.assign({ method: "POST", headers: { authorization: `Bearer ${"o".repeat(32)}` }, body: new ReadableStream({ cancel }) }, { duplex: "half" }))
      const result = ACK(incoming)
      await vi.advanceTimersByTimeAsync(5001)
      const response = await result
      expect(response.status).toBe(408); expect(response.headers.get("cache-control")).toBe("no-store")
      expect(cancel).toHaveBeenCalledOnce(); expect(mocks.acknowledge).not.toHaveBeenCalled(); expect(mocks.observation).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })
  it("projects authenticated events and requests provider retry on unavailable storage", async () => {
    const body = JSON.stringify({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: "message-id", to: ["private@example.test"], subject: "Private" } })
    expect((await POST(request(body))).status).toBe(200)
    expect(mocks.receive).toHaveBeenCalledWith(expect.objectContaining({ eventId: "msg_route", eventType: "email.delivered", providerMessageId: "message-id" }))
    expect(JSON.stringify(mocks.receive.mock.calls)).not.toMatch(/private@|Private/)
    mocks.receive.mockRejectedValueOnce(new Error("private database details"))
    const failure = await POST(request(body)); expect(failure.status).toBe(503); expect(await failure.text()).not.toContain("private")
    mocks.receive.mockClear()
    expect((await POST(request(JSON.stringify({ type: "email.opened", data: { to: "private" } })))).status).toBe(200)
    expect(mocks.receive).not.toHaveBeenCalled()
  })
  it("serializes overlapping monitor invocations using an atomic independent lease", async () => {
    vi.stubEnv("CRON_SECRET", "c".repeat(32)); vi.stubEnv("LEAD_OPERATIONS_SECRET", "o".repeat(32))
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token")
    vi.stubEnv("LEAD_ALERT_WEBHOOK_URL", "https://sink.test/alerts")
    let finish: (result: unknown) => void = () => {}
    mocks.runMonitor.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const req = () => new Request("https://gridninja.test/api/internal/lead-monitor", { headers: { authorization: `Bearer ${"c".repeat(32)}` } })
    const first = GET(req())
    await vi.waitFor(() => expect(mocks.runMonitor).toHaveBeenCalledTimes(1))
    const second = await GET(req())
    expect(await second.json()).toEqual({ ok: true, busy: true })
    expect(mocks.runMonitor).toHaveBeenCalledTimes(1)
    finish({ healthy: true, degraded: false, notificationFailures: 0, activeIncidents: 0 })
    expect((await first).status).toBe(200)
    expect(mocks.lock).toBeNull()
  })
})
