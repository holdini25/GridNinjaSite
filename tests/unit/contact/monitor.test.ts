// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { evaluateMonitor, runIndependentMonitor, type IncidentState, type IncidentStore, type MonitorSnapshot } from "@/lib/contact/monitor"
const now = new Date("2026-09-24T12:00:00Z")
const healthy: MonitorSnapshot = { oldestDueMs: null, deadLetters: 0, needsReview: 0, configurationFailures: 0, recipientFailures: 0, unmatchedEvents: 0, sweepCompletedAt: now, retentionCompletedAt: now }
function store(): IncidentStore {
  const states = new Map<string, IncidentState>()
  return { get: async (key) => states.get(key) ?? null, set: async (key, value) => { states.set(key, value) } }
}
describe("independent inquiry monitor", () => {
  it("applies precise heartbeat/age thresholds and detects terminal and recipient failures", () => {
    expect(Object.values(evaluateMonitor(healthy, now)).some(Boolean)).toBe(false)
    const issues = evaluateMonitor({ ...healthy, oldestDueMs: 300001, deadLetters: 1, needsReview: 1, recipientFailures: 1, unmatchedEvents: 1, sweepCompletedAt: new Date(now.getTime() - 180001), retentionCompletedAt: new Date(now.getTime() - 26 * 3_600_000 - 1) }, now)
    expect(Object.values(issues).every(Boolean)).toBe(true)
    expect(evaluateMonitor({ ...healthy, sweepCompletedAt: new Date("invalid"), retentionCompletedAt: new Date(now.getTime() + 120_000) }, now)).toMatchObject({ sweep_missing: true, retention_missing: true })
    expect(evaluateMonitor({ ...healthy, sweepCompletedAt: null, retentionCompletedAt: null }, now)).toMatchObject({ sweep_missing: true, retention_missing: true })
  })
  it("deduplicates active incidents and sends one recovery without a queue dependency", async () => {
    const incidentStore = store(), sendAlert = vi.fn().mockResolvedValue(undefined)
    const readSnapshot = vi.fn().mockResolvedValue({ ...healthy, deadLetters: 1 })
    const options = { now, configured: true, store: incidentStore, sendAlert, readSnapshot }
    await runIndependentMonitor(options); await runIndependentMonitor(options)
    expect(sendAlert).toHaveBeenCalledTimes(1)
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ type: "monitor_incident", errorCode: "dead_letter" }))
    readSnapshot.mockResolvedValue(healthy)
    await runIndependentMonitor(options); await runIndependentMonitor(options)
    expect(sendAlert).toHaveBeenCalledTimes(2)
    expect(sendAlert).toHaveBeenLastCalledWith(expect.objectContaining({ type: "monitor_recovery", errorCode: "dead_letter" }))
  })
  it("alerts on new failure evidence even if a prior incident has not yet observed recovery", async () => {
    const incidentStore = store(), sendAlert = vi.fn().mockResolvedValue(undefined)
    const readSnapshot = vi.fn().mockResolvedValue({ ...healthy, recipientFailures: 1, fingerprints: { recipient_failure: "1:first-event" } })
    const options = { now, configured: true, store: incidentStore, sendAlert, readSnapshot }
    await runIndependentMonitor(options)
    readSnapshot.mockResolvedValue({ ...healthy, recipientFailures: 1, fingerprints: { recipient_failure: "1:later-event" } })
    await runIndependentMonitor(options)
    expect(sendAlert).toHaveBeenCalledTimes(2)
    expect(sendAlert.mock.calls[0][0].eventId).not.toBe(sendAlert.mock.calls[1][0].eventId)
  })
  it("keeps the same incident identity after an uncertain sink response", async () => {
    const incidentStore = store(), sendAlert = vi.fn().mockRejectedValueOnce(new Error("lost response")).mockResolvedValue(undefined)
    const options = { now, configured: true, store: incidentStore, sendAlert, readSnapshot: async () => ({ ...healthy, deadLetters: 1 }) }
    await runIndependentMonitor(options)
    await runIndependentMonitor({ ...options, now: new Date(now.getTime() + 1000) })
    const incidentCalls = sendAlert.mock.calls.filter(([alert]) => alert.errorCode === "dead_letter")
    expect(incidentCalls).toHaveLength(2)
    expect(incidentCalls[0][0].eventId).toBe(incidentCalls[1][0].eventId)
  })
  it("reports DB and dedup-store outages directly without resolving unknown queue state", async () => {
    const incidentStore = store(), sendAlert = vi.fn().mockResolvedValue(undefined)
    await runIndependentMonitor({ now, configured: true, store: incidentStore, sendAlert, readSnapshot: async () => ({ ...healthy, deadLetters: 1 }) })
    sendAlert.mockClear()
    const result = await runIndependentMonitor({ now, configured: true, store: incidentStore, sendAlert, readSnapshot: async () => { throw new Error("private DB url") } })
    expect(result.databaseAvailable).toBe(false)
    expect(sendAlert).not.toHaveBeenCalledWith(expect.objectContaining({ type: "monitor_recovery", errorCode: "dead_letter" }))
    sendAlert.mockClear()
    await runIndependentMonitor({ now, configured: false, store: null, sendAlert, readSnapshot: async () => { throw new Error("offline") } })
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "database_failure" }))
    expect(sendAlert).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "monitor_store_or_sink_failure" }))
    expect(JSON.stringify(sendAlert.mock.calls)).not.toMatch(/private|offline|url/)
  })
})
