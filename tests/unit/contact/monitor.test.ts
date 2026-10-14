import { describe, expect, it, vi } from "vitest"
import { evaluateMonitor, runIndependentMonitor, type IncidentState, type IncidentStore, type MonitorSnapshot } from "@/lib/contact/monitor"
import { getMonitorSink, getMonitorThresholds, isObservationConfigurationReady } from "@/lib/contact/operational-config"
import { requestDigest } from "@/lib/contact/provider-request"

vi.mock("server-only", () => ({}))
const now = new Date("2026-10-12T12:00:00Z")
const healthy: MonitorSnapshot = { oldestDueMs: null, deadLetters: 0, needsReview: 0, recipientFailures: 0, unmatchedEvents: 0,
  eventConflicts: 0, missingRecipientObservations: 0, unhandledInquiries: 0, sweepCompletedAt: now, retentionCompletedAt: now }
function memoryStore() {
  const states = new Map<string, IncidentState>()
  const store: IncidentStore = { get: async code => states.get(code) ?? null, set: async (code, state) => { states.set(code, state) } }
  return { store, states }
}

describe("independent operational monitor", () => {
  it("observes missing recipient delivery and handling separately", () => {
    expect(evaluateMonitor({ ...healthy, missingRecipientObservations: 1, unhandledInquiries: 1 }, now)).toMatchObject({ recipient_observation_missing: true, handling_missing: true, recipient_failure: false })
  })
  it("does not mistake future/stale or absent heartbeats for health", () => {
    expect(evaluateMonitor({ ...healthy, sweepCompletedAt: new Date(now.getTime() + 61000), retentionCompletedAt: null }, now)).toMatchObject({ sweep_missing: true, retention_missing: true })
  })
  it("sends once per incident and one recovery", async () => {
    const { store } = memoryStore()
    const sendAlert = vi.fn()
    const options = { now, configured: true, store, readSnapshot: async () => ({ ...healthy, needsReview: 1 }), sendAlert }
    await runIndependentMonitor(options)
    await runIndependentMonitor(options)
    expect(sendAlert).toHaveBeenCalledTimes(1)
    await runIndependentMonitor({ ...options, readSnapshot: async () => healthy })
    expect(sendAlert).toHaveBeenCalledTimes(2)
    expect(sendAlert.mock.calls[1][0].type).toBe("monitor_recovery")
  })
  it("retries uncertain sink response using the persisted incident identity", async () => {
    const { store } = memoryStore()
    const sendAlert = vi.fn().mockRejectedValueOnce(new Error("uncertain"))
    const options = { now, configured: true, store, readSnapshot: async () => ({ ...healthy, recipientFailures: 1 }), sendAlert }
    expect((await runIndependentMonitor(options)).degraded).toBe(true)
    await runIndependentMonitor(options)
    const incidents = sendAlert.mock.calls.map(call => call[0]).filter(alert => alert.errorCode === "recipient_failure")
    expect(incidents).toHaveLength(2)
    expect(incidents[0].eventId).toBe(incidents[1].eventId)
  })
  it("does not resolve a delivery incident while the database is unknown", async () => {
    const { store, states } = memoryStore()
    const sendAlert = vi.fn()
    await runIndependentMonitor({ now, configured: true, store, readSnapshot: async () => ({ ...healthy, deadLetters: 1 }), sendAlert })
    const result = await runIndependentMonitor({ now, configured: true, store, readSnapshot: async () => { throw new Error("DB outage") }, sendAlert })
    expect(result.databaseAvailable).toBe(false)
    expect(states.get("dead_letter")?.active).toBe(true)
    expect(sendAlert.mock.calls.some(call => call[0].type === "monitor_recovery")).toBe(false)
  })
  it("new adverse evidence changes the incident without requiring a healthy interval", async () => {
    const { store } = memoryStore()
    const sendAlert = vi.fn()
    const options = { now, configured: true, store, sendAlert }
    await runIndependentMonitor({ ...options, readSnapshot: async () => ({ ...healthy, recipientFailures: 1, fingerprints: { recipient_failure: "one" } }) })
    await runIndependentMonitor({ ...options, readSnapshot: async () => ({ ...healthy, recipientFailures: 1, fingerprints: { recipient_failure: "two" } }) })
    expect(sendAlert).toHaveBeenCalledTimes(2)
    expect(sendAlert.mock.calls[0][0].eventId).not.toBe(sendAlert.mock.calls[1][0].eventId)
  })
  it("reports direct degraded alerts without the incident store", async () => {
    const sendAlert = vi.fn()
    const result = await runIndependentMonitor({ now, configured: true, store: null, readSnapshot: async () => ({ ...healthy, oldestDueMs: 300001 }), sendAlert })
    expect(result).toMatchObject({ healthy: false, degraded: true })
    expect(sendAlert.mock.calls.map(call => call[0].errorCode)).toContain("queue_overdue")
  })
  it("missing thresholds are a configuration incident, not an invented DB outage", async () => {
    const { store } = memoryStore()
    const sendAlert = vi.fn()
    const result = await runIndependentMonitor({ now, configured: false, store, sendAlert })
    expect(result).toMatchObject({ healthy: false, databaseAvailable: null })
    expect(sendAlert.mock.calls.map(call => call[0].errorCode)).toEqual(["configuration_failure"])
  })
})

describe("explicit operational activation", () => {
  it("requires positive owner-configured thresholds and supplies no implicit SLA", () => {
    expect(() => getMonitorThresholds({})).toThrow()
    expect(() => getMonitorThresholds({ LEAD_RECIPIENT_OBSERVATION_SECONDS: "0", LEAD_HANDLING_SECONDS: "86400" })).toThrow()
    expect(getMonitorThresholds({ LEAD_RECIPIENT_OBSERVATION_SECONDS: "1800", LEAD_HANDLING_SECONDS: "86400" })).toEqual({ recipientObservationMs: 1800000, handlingMs: 86400000 })
  })
  it("requires an authenticated HTTPS sink without URL credentials", () => {
    expect(() => getMonitorSink({ LEAD_ALERT_WEBHOOK_URL: "https://user:secret@example.test/alerts", LEAD_ALERT_WEBHOOK_TOKEN: "x".repeat(32) })).toThrow()
    expect(() => getMonitorSink({ LEAD_ALERT_WEBHOOK_URL: "https://example.test/alerts" })).toThrow()
    expect(getMonitorSink({ LEAD_ALERT_WEBHOOK_URL: "https://example.test/alerts", LEAD_ALERT_WEBHOOK_TOKEN: "x".repeat(32) })).toHaveProperty("alertWebhookUrl", "https://example.test/alerts")
  })
  it("does not activate without named distinct primary and backup operators", () => {
    expect(isObservationConfigurationReady({})).toBe(false)
    const env = { DATABASE_URL: "present", RESEND_ACCOUNT_REF: "account", RESEND_API_KEY: "synthetic-key", RESEND_ACCOUNT_BINDING_REF: "private-approval", RESEND_APPROVED_KEY_SHA256: requestDigest("synthetic-key"), RESEND_WEBHOOK_SECRET: "whsec_example", LEAD_OPERATIONS_SECRET: "x".repeat(32), LEAD_MONITOR_NAMESPACE: "staging", LEAD_OPERATOR_REFERENCES: "primary,backup", LEAD_RECIPIENT_OBSERVATION_SECONDS: "1800", LEAD_HANDLING_SECONDS: "86400" }
    expect(isObservationConfigurationReady(env)).toBe(true)
    expect(isObservationConfigurationReady({ ...env, LEAD_OPERATOR_REFERENCES: "primary,primary" })).toBe(false)
    expect(isObservationConfigurationReady({ ...env, RESEND_API_KEY: "unapproved-key" })).toBe(false)
    expect(isObservationConfigurationReady({ ...env, LEAD_WEBHOOK_ENABLED: "true" })).toBe(false)
  })
})
