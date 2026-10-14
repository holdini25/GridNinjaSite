import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Webhook } from "svix"
import { POST as callback } from "@/app/api/webhooks/resend/route"
import { POST as acknowledge } from "@/app/api/internal/lead-acknowledgement/route"
import { GET as monitor } from "@/app/api/internal/lead-monitor/route"

const mocks = vi.hoisted(() => ({ receiveProviderEvent: vi.fn(), acknowledgeDelivery: vi.fn(), getDeliveryObservation: vi.fn(), readMonitorSnapshot: vi.fn(), sendOperatorAlert: vi.fn(), redisSet: vi.fn(), redisGet: vi.fn(), redisEval: vi.fn() }))
vi.mock("@/server/leads/observations-repository", () => ({ observationsRepository: () => mocks }))
vi.mock("@/lib/contact/alerts", () => ({ sendOperatorAlert: mocks.sendOperatorAlert }))
vi.mock("@/lib/contact/log", () => ({ logContactEvent: vi.fn() }))
vi.mock("@upstash/redis", () => ({ Redis: class { set = mocks.redisSet; get = mocks.redisGet; eval = mocks.redisEval } }))

const secret = `whsec_${Buffer.alloc(32, 4).toString("base64")}`
const operatorSecret = "o".repeat(32)
const monitorSecret = "m".repeat(32)
const id = "0703371a-ac91-4c5e-a757-59487ca9ef5b"
function signed(payload: unknown, key = secret) {
  const body = JSON.stringify(payload)
  const now = new Date()
  return new Request("https://staging.example.test/api/webhooks/resend", { method: "POST", body, headers: {
    "svix-id": "msg_test", "svix-timestamp": String(Math.floor(now.getTime() / 1000)), "svix-signature": new Webhook(key).sign("msg_test", now, body),
  } })
}
const delivered = () => ({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: "email_test", to: ["private@example.test"] } })
function ack(body: unknown, token = operatorSecret) {
  return new Request("https://staging.example.test/api/internal/lead-acknowledgement", { method: "POST", body: JSON.stringify(body), headers: { authorization: `Bearer ${token}` } })
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("RESEND_ACCOUNT_REF", "account_a")
  vi.stubEnv("RESEND_WEBHOOK_SECRET", secret)
  vi.stubEnv("RESEND_WEBHOOK_SECRET_PREVIOUS", "")
  vi.stubEnv("LEAD_OPERATIONS_SECRET", operatorSecret)
  vi.stubEnv("LEAD_OPERATOR_REFERENCES", "primary,backup")
  vi.stubEnv("LEAD_MONITOR_SECRET", monitorSecret)
  mocks.receiveProviderEvent.mockResolvedValue({ conflict: false })
  mocks.acknowledgeDelivery.mockResolvedValue(true)
  mocks.getDeliveryObservation.mockResolvedValue({ recipientDelivery: "unknown", operatorAcknowledgement: "acknowledged" })
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe("authenticated operational boundaries", () => {
  it("authenticates raw callbacks before projecting account-bound minimal data", async () => {
    expect((await callback(signed(delivered()))).status).toBe(200)
    expect(mocks.receiveProviderEvent).toHaveBeenCalledWith(expect.objectContaining({ accountRef: "account_a", providerMessageId: "email_test" }))
    expect(JSON.stringify(mocks.receiveProviderEvent.mock.calls)).not.toContain("private@example.test")
  })
  it("rejects wrong-account secret, modified bytes and missing signatures without database access", async () => {
    const wrong = `whsec_${Buffer.alloc(32, 7).toString("base64")}`
    expect((await callback(signed(delivered(), wrong))).status).toBe(401)
    const request = signed(delivered())
    expect((await callback(new Request(request.url, { method: "POST", headers: request.headers, body: "{}" }))).status).toBe(401)
    expect((await callback(new Request(request.url, { method: "POST", body: "{}" }))).status).toBe(401)
    expect(mocks.receiveProviderEvent).not.toHaveBeenCalled()
  })
  it("binds rotated webhook secrets to their explicitly verified provider account", async () => {
    const previous = `whsec_${Buffer.alloc(32, 7).toString("base64")}`
    vi.stubEnv("RESEND_WEBHOOK_SECRET_PREVIOUS", previous)
    vi.stubEnv("RESEND_WEBHOOK_PREVIOUS_ACCOUNT_REF", "")
    expect((await callback(signed(delivered(), previous))).status).toBe(503)
    vi.stubEnv("RESEND_WEBHOOK_PREVIOUS_ACCOUNT_REF", "previous_account")
    expect((await callback(signed(delivered(), previous))).status).toBe(200)
    expect(mocks.receiveProviderEvent).toHaveBeenLastCalledWith(expect.objectContaining({ accountRef: "previous_account" }))
  })
  it("discards signed open/click payloads and rejects malformed subscribed events", async () => {
    expect(await (await callback(signed({ type: "email.opened", data: { ip: "private" } }))).json()).toMatchObject({ ignored: true })
    expect((await callback(signed({ type: "email.delivered", data: {} }))).status).toBe(400)
    expect(mocks.receiveProviderEvent).not.toHaveBeenCalled()
  })
  it("limits callback bytes and acknowledges only durable persistence", async () => {
    expect((await callback(signed({ ...delivered(), unused: "x".repeat(17000) }))).status).toBe(413)
    mocks.receiveProviderEvent.mockRejectedValue(new Error("DB unavailable"))
    const response = await callback(signed(delivered()))
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.text()).not.toContain("DB unavailable")
  })
  it("times out a stalled signed request without touching persistence", async () => {
    vi.useFakeTimers()
    const request = new Request("https://staging.example.test/callback", { method: "POST", body: new ReadableStream(), headers: signed({}).headers, duplex: "half" } as RequestInit)
    const pending = callback(request)
    await vi.advanceTimersByTimeAsync(5001)
    expect((await pending).status).toBe(408)
    expect(mocks.receiveProviderEvent).not.toHaveBeenCalled()
  })
  it("requires the dedicated operations bearer and an allowlisted operator", async () => {
    const body = { outboxId: id, operatorReference: "primary", reviewedThrough: new Date(Date.now() - 1000).toISOString() }
    expect((await acknowledge(ack(body, monitorSecret))).status).toBe(401)
    expect((await acknowledge(ack({ ...body, operatorReference: "unknown" }))).status).toBe(400)
    expect((await acknowledge(ack({ ...body, reviewedThrough: new Date(Date.now() + 60000).toISOString() }))).status).toBe(400)
    expect(mocks.acknowledgeDelivery).not.toHaveBeenCalled()
    expect((await acknowledge(ack(body))).status).toBe(200)
    expect(mocks.acknowledgeDelivery).toHaveBeenCalledTimes(1)
  })
  it("rejects oversized acknowledgement and never exposes database errors", async () => {
    expect((await acknowledge(ack({ body: "x".repeat(1025) }))).status).toBe(413)
    mocks.acknowledgeDelivery.mockRejectedValue(new Error("private database detail"))
    const response = await acknowledge(ack({ outboxId: id, operatorReference: "primary", reviewedThrough: new Date(Date.now() - 1000).toISOString() }))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("private")
  })
  it("uses monitor authentication and does not report missing configuration as healthy", async () => {
    const url = "https://staging.example.test/api/internal/lead-monitor"
    expect((await monitor(new Request(url))).status).toBe(401)
    vi.stubEnv("LEAD_ALERT_WEBHOOK_URL", "")
    expect((await monitor(new Request(url, { headers: { authorization: `Bearer ${monitorSecret}` } }))).status).toBe(503)
    expect(mocks.sendOperatorAlert).not.toHaveBeenCalled()
  })
  it("alerts directly with isolated namespace even when QStash and Redis are absent", async () => {
    vi.stubEnv("LEAD_ALERT_WEBHOOK_URL", "https://alerts.example.test/")
    vi.stubEnv("LEAD_ALERT_WEBHOOK_TOKEN", "a".repeat(32))
    vi.stubEnv("LEAD_MONITOR_NAMESPACE", "isolated_staging")
    vi.stubEnv("LEAD_RECIPIENT_OBSERVATION_SECONDS", "")
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.stubEnv("QSTASH_TOKEN", "")
    const response = await monitor(new Request("https://staging.example.test/api/internal/lead-monitor", { headers: { authorization: `Bearer ${monitorSecret}` } }))
    expect(response.status).toBe(503)
    expect(mocks.sendOperatorAlert.mock.calls.every(call => call[1].eventId.startsWith("isolated_staging/"))).toBe(true)
    expect(mocks.sendOperatorAlert).toHaveBeenCalled()
    expect(mocks.readMonitorSnapshot).not.toHaveBeenCalled()
  })
})
