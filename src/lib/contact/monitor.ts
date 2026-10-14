import type { OperatorAlert } from "@/lib/contact/alerts"

export const MONITOR_CODES = ["configuration_failure", "database_failure", "sweep_missing", "queue_overdue", "dead_letter", "needs_review", "recipient_failure", "unmatched_provider_events", "provider_event_conflict", "recipient_observation_missing", "handling_missing", "retention_missing"] as const
export type MonitorCode = typeof MONITOR_CODES[number]
export type MonitorSnapshot = {
  fingerprints?: Partial<Record<MonitorCode, string>>
  oldestDueMs: number | null
  deadLetters: number
  needsReview: number
  recipientFailures: number
  unmatchedEvents: number
  eventConflicts: number
  missingRecipientObservations: number
  unhandledInquiries: number
  sweepCompletedAt: Date | null
  retentionCompletedAt: Date | null
}
export type IncidentState = { active: boolean; notified: boolean; incidentId: string; fingerprint?: string }
export type IncidentStore = { get(code: string): Promise<IncidentState | null>; set(code: string, state: IncidentState): Promise<void> }

export function evaluateMonitor(snapshot: MonitorSnapshot, now: Date) {
  const stale = (value: Date | null, maximum: number) => !value || !Number.isFinite(value.getTime()) || now.getTime() - value.getTime() > maximum || value.getTime() - now.getTime() > 60_000
  return {
    sweep_missing: stale(snapshot.sweepCompletedAt, 180_000),
    queue_overdue: snapshot.oldestDueMs !== null && snapshot.oldestDueMs > 300_000,
    dead_letter: snapshot.deadLetters > 0,
    needs_review: snapshot.needsReview > 0,
    recipient_failure: snapshot.recipientFailures > 0,
    unmatched_provider_events: snapshot.unmatchedEvents > 0,
    provider_event_conflict: snapshot.eventConflicts > 0,
    recipient_observation_missing: snapshot.missingRecipientObservations > 0,
    handling_missing: snapshot.unhandledInquiries > 0,
    retention_missing: stale(snapshot.retentionCompletedAt, 26 * 3_600_000),
  }
}

export async function runIndependentMonitor(options: {
  now?: Date
  configured: boolean
  store: IncidentStore | null
  readSnapshot?: (now: Date) => Promise<MonitorSnapshot>
  sendAlert: (alert: OperatorAlert) => Promise<unknown>
}) {
  const now = options.now ?? new Date()
  const states: Partial<Record<MonitorCode, boolean>> = { configuration_failure: !options.configured }
  let fingerprints: MonitorSnapshot["fingerprints"]
  let databaseAvailable: boolean | null = null
  if (options.readSnapshot) try {
    const snapshot = await options.readSnapshot(now)
    fingerprints = snapshot.fingerprints
    Object.assign(states, evaluateMonitor(snapshot, now), { database_failure: false })
    databaseAvailable = true
  } catch { states.database_failure = true; databaseAvailable = false }
  // Unknown database state leaves earlier queue/delivery incidents unchanged.
  let unavailable = !options.store
  let notificationFailures = 0
  const alert = (code: string, eventId: string, recovery: boolean): OperatorAlert => ({
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
        const incident: IncidentState = existing?.active && existing.fingerprint === fingerprint ? existing : {
          active: true, notified: false, fingerprint,
          incidentId: `monitor/${code}/${now.getTime()}${fingerprint ? `/${fingerprint}` : ""}`,
        }
        if (incident.notified) return
        await options.store.set(code, incident)
        attempted = true
        await options.sendAlert(alert(code, incident.incidentId, false))
        await options.store.set(code, { ...incident, notified: true })
      } else if (existing?.active) {
        attempted = true
        await options.sendAlert(alert(code, `${existing.incidentId}/recovered`, true))
        await options.store.set(code, { ...existing, active: false, notified: true })
      }
    } catch {
      unavailable = true
      if (attempted) notificationFailures++
      // Stable bounded fallback IDs require receiver-side deduplication. A failed
      // incident store may repeat alerts but can never be described as healthy.
      if (active && !attempted) try {
        await options.sendAlert(alert(code, `monitor-fallback/${code}/${Math.floor(now.getTime() / 300_000)}`, false))
      } catch { notificationFailures++ }
    }
  }))
  if (unavailable) try {
    await options.sendAlert(alert("monitor_store_or_sink_failure", `monitor-fallback/monitoring/${Math.floor(now.getTime() / 300_000)}`, false))
  } catch { notificationFailures++ }
  return {
    healthy: !unavailable && !notificationFailures && !Object.values(states).some(Boolean),
    activeIncidents: Object.values(states).filter(Boolean).length,
    notificationFailures, degraded: unavailable, databaseAvailable,
  }
}
