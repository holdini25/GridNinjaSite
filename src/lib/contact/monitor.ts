import type { OperatorAlert } from "@/lib/contact/alerts"

export type MonitorSnapshot = {
  fingerprints?: Partial<Record<MonitorCode, string>>
  oldestDueMs: number | null
  deadLetters: number
  needsReview: number
  configurationFailures: number
  recipientFailures: number
  unmatchedEvents: number
  sweepCompletedAt: Date | null
  retentionCompletedAt: Date | null
}
export const MONITOR_CODES = ["configuration_failure", "database_failure", "sweep_missing", "queue_overdue", "dead_letter", "needs_review", "recipient_failure", "unmatched_provider_events", "retention_missing"] as const
export type MonitorCode = typeof MONITOR_CODES[number]
export type IncidentState = { active: boolean; notified: boolean; incidentId: string; fingerprint?: string }
export type IncidentStore = { get(code: string): Promise<IncidentState | null>; set(code: string, state: IncidentState): Promise<void> }

export function evaluateMonitor(snapshot: MonitorSnapshot, now: Date): Record<Exclude<MonitorCode, "configuration_failure" | "database_failure">, boolean> {
  const stale = (value: Date | null, maximum: number) => !value || !Number.isFinite(value.getTime()) || now.getTime() - value.getTime() > maximum || value.getTime() - now.getTime() > 60_000
  return {
    sweep_missing: stale(snapshot.sweepCompletedAt, 180_000),
    queue_overdue: snapshot.oldestDueMs !== null && snapshot.oldestDueMs > 300_000,
    dead_letter: snapshot.deadLetters > 0,
    needs_review: snapshot.needsReview > 0,
    recipient_failure: snapshot.recipientFailures > 0,
    unmatched_provider_events: snapshot.unmatchedEvents > 0,
    retention_missing: stale(snapshot.retentionCompletedAt, 26 * 3_600_000),
  }
}

export async function runIndependentMonitor(options: {
  now?: Date
  configured: boolean
  store: IncidentStore | null
  readSnapshot: (now: Date) => Promise<MonitorSnapshot>
  sendAlert: (alert: OperatorAlert) => Promise<unknown>
}) {
  const now = options.now ?? new Date()
  const states: Partial<Record<MonitorCode, boolean>> = { configuration_failure: !options.configured }
  let fingerprints: MonitorSnapshot["fingerprints"]
  try {
    const snapshot = await options.readSnapshot(now)
    fingerprints = snapshot.fingerprints
    Object.assign(states, evaluateMonitor(snapshot, now), { database_failure: false, configuration_failure: !options.configured || snapshot.configurationFailures > 0 })
  } catch { states.database_failure = true }
  // Unknown database state cannot resolve a previously observed queue incident.
  let unavailable = !options.store
  let notificationFailures = 0
  const makeAlert = (code: string, eventId: string, recovery: boolean): OperatorAlert => ({
    schemaVersion: 1, eventId, type: recovery ? "monitor_recovery" : "monitor_incident",
    occurredAt: now.toISOString(), errorCode: code,
  })
  await Promise.all(Object.entries(states).map(async ([code, active]) => {
    let attempted = false
    try {
      if (!options.store) throw new Error("IncidentStoreUnavailable")
      const existing = await options.store.get(code)
      if (active) {
        const fingerprint = fingerprints?.[code as MonitorCode]
        const incident = existing?.active && existing.fingerprint === fingerprint ? existing : { active: true, notified: false, fingerprint, incidentId: `monitor/${code}/${now.getTime()}${fingerprint ? `/${encodeURIComponent(fingerprint).slice(0, 80)}` : ""}` }
        if (incident.notified) return
        // Persist stable identity before attempting the sink. Failed sends retry
        // the same ID; successful sends are not repeated each minute.
        await options.store.set(code, incident)
        attempted = true
        await options.sendAlert(makeAlert(code, incident.incidentId, false))
        await options.store.set(code, { ...incident, notified: true })
      } else if (existing?.active) {
        attempted = true
        await options.sendAlert(makeAlert(code, `${existing.incidentId}/recovered`, true))
        await options.store.set(code, { ...existing, active: false, notified: true })
      }
    } catch {
      unavailable = true
      if (attempted) notificationFailures++
      // An independent direct sink attempt still occurs if Redis or the DB is
      // down. The receiver must honor these bounded five-minute idempotency IDs.
      if (active && !attempted) try {
        await options.sendAlert(makeAlert(code, `monitor-fallback/${code}/${Math.floor(now.getTime() / 300_000)}`, false))
      } catch { notificationFailures++ }
    }
  }))
  if (unavailable) try {
    await options.sendAlert(makeAlert("monitor_store_or_sink_failure", `monitor-fallback/monitoring/${Math.floor(now.getTime() / 300_000)}`, false))
  } catch { notificationFailures++ }
  return { healthy: !unavailable && !notificationFailures && !Object.values(states).some(Boolean),
    activeIncidents: Object.values(states).filter(Boolean).length, notificationFailures,
    degraded: unavailable, databaseAvailable: !states.database_failure }
}
