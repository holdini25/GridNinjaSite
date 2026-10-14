import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { getDatabase, type LeadDatabase } from "@/db/client"
import type { MonitorSnapshot, MonitorCode } from "@/lib/contact/monitor"
import type { MonitorThresholds } from "@/lib/contact/operational-config"
import { deriveDeliveryObservation, type ProviderDeliveryEvent } from "@/lib/contact/provider-events"

// Production and isolated integration tests use the same query builders.
export function createObservationsRepository(database: LeadDatabase) {
  async function receiveProviderEvent(event: ProviderDeliveryEvent) {
    const result = await database.execute(sql`
      WITH matches AS (
        SELECT id FROM lead_delivery_outbox WHERE provider_account_ref = ${event.accountRef} AND provider_message_id = ${event.providerMessageId}
        UNION SELECT outbox_id AS id FROM lead_provider_attempts WHERE provider_account_ref = ${event.accountRef} AND provider_message_id = ${event.providerMessageId}
      ), matched AS (SELECT min(id::text)::uuid AS id FROM matches HAVING count(*) = 1)
      INSERT INTO lead_provider_events (id, provider_account_ref, provider_event_id, provider_message_id, outbox_id, event_type, provider_occurred_at)
      VALUES (${randomUUID()}::uuid, ${event.accountRef}, ${event.eventId}, ${event.providerMessageId}, (SELECT id FROM matched), ${event.eventType}, ${event.occurredAt.toISOString()}::timestamptz)
      ON CONFLICT (provider_account_ref, provider_event_id) DO UPDATE SET conflicted_at =
        CASE WHEN lead_provider_events.provider_message_id <> excluded.provider_message_id
          OR lead_provider_events.event_type <> excluded.event_type
          OR lead_provider_events.provider_occurred_at <> excluded.provider_occurred_at
          THEN COALESCE(lead_provider_events.conflicted_at, clock_timestamp()) ELSE lead_provider_events.conflicted_at END
      RETURNING id, conflicted_at`)
    return { conflict: result.rows[0]?.conflicted_at !== null }
  }

  async function reconcileProviderEvents() {
    // Never guess by recipient, event payload tags or arbitrary outbox IDs.
    // Limit uniquely resolvable work, so older unrelated callbacks cannot keep
    // an early callback waiting forever after its acceptance becomes known.
    const result = await database.execute(sql`
      WITH candidates AS (
        SELECT e.id, matched.matched_id FROM lead_provider_events e
        CROSS JOIN LATERAL (
          SELECT min(m.id::text)::uuid AS matched_id FROM (
            SELECT o.id FROM lead_delivery_outbox o WHERE o.provider_account_ref = e.provider_account_ref AND o.provider_message_id = e.provider_message_id
            UNION SELECT a.outbox_id FROM lead_provider_attempts a WHERE a.provider_account_ref = e.provider_account_ref AND a.provider_message_id = e.provider_message_id
          ) m HAVING count(*) = 1
        ) matched
        WHERE e.outbox_id IS NULL AND e.conflicted_at IS NULL ORDER BY e.received_at, e.id LIMIT 1000
      ) UPDATE lead_provider_events e SET outbox_id = c.matched_id FROM candidates c
        WHERE e.id = c.id AND e.outbox_id IS NULL AND c.matched_id IS NOT NULL RETURNING e.id`)
    return result.rows.length
  }

  async function pruneUnmatchedProviderEvents() {
    await reconcileProviderEvents()
    const result = await database.execute(sql`
      DELETE FROM lead_provider_events WHERE outbox_id IS NULL AND id IN (
        SELECT id FROM lead_provider_events WHERE outbox_id IS NULL
          AND received_at < clock_timestamp() - interval '7 days' ORDER BY received_at, id LIMIT 1000
      ) RETURNING id`)
    return result.rows.length
  }

  async function acknowledgeDelivery(outboxId: string, operatorReference: string, reviewedThrough: Date) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(operatorReference) || !Number.isFinite(reviewedThrough.getTime())) throw new Error("InvalidAcknowledgement")
    const result = await database.execute(sql`
      WITH eligible AS (
        SELECT id FROM lead_delivery_outbox WHERE id = ${outboxId}::uuid
          AND ${reviewedThrough.toISOString()}::timestamptz BETWEEN created_at AND clock_timestamp()
      ), recorded AS (
        INSERT INTO lead_delivery_acknowledgements (id, outbox_id, operator_reference, reviewed_through)
        SELECT ${randomUUID()}::uuid, id, ${operatorReference}, ${reviewedThrough.toISOString()}::timestamptz FROM eligible
        ON CONFLICT (outbox_id, operator_reference, reviewed_through) DO NOTHING RETURNING id
      ) SELECT id FROM eligible`)
    return result.rows.length > 0
  }

  async function getDeliveryObservation(outboxId: string) {
    const result = await database.execute(sql`
      SELECT (o.status = 'delivered' OR EXISTS (SELECT 1 FROM lead_provider_attempts p WHERE p.outbox_id = o.id AND p.result_category = 'provider_accepted')) AS provider_accepted,
        EXISTS (SELECT 1 FROM lead_delivery_acknowledgements a WHERE a.outbox_id = o.id) AS acknowledged,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('eventType', e.event_type)) FROM lead_provider_events e WHERE e.outbox_id = o.id AND e.conflicted_at IS NULL), '[]'::jsonb) AS events
      FROM lead_delivery_outbox o WHERE o.id = ${outboxId}::uuid`)
    const row = result.rows[0]
    return row ? deriveDeliveryObservation(row.provider_accepted as boolean, row.events as Pick<ProviderDeliveryEvent, "eventType">[], row.acknowledged as boolean) : null
  }

  async function recordHeartbeat(job: "sweep" | "retention") {
    await database.execute(sql`INSERT INTO lead_operations_heartbeats (job, completed_at) VALUES (${job}, clock_timestamp())
      ON CONFLICT (job) DO UPDATE SET completed_at = greatest(lead_operations_heartbeats.completed_at, excluded.completed_at)`)
  }

  async function readMonitorSnapshot(now: Date, thresholds: MonitorThresholds): Promise<MonitorSnapshot> {
    await reconcileProviderEvents()
    const result = await database.execute(sql`
      WITH reviewed AS (SELECT outbox_id, max(reviewed_through) AS cutoff FROM lead_delivery_acknowledgements GROUP BY outbox_id),
      observations AS (
        SELECT outbox_id,
          min(received_at) AS first_observation,
          bool_or(event_type IN ('email.delivered', 'email.bounced', 'email.failed', 'email.complained', 'email.suppressed')) AS has_recipient_observation,
          max(received_at) FILTER (WHERE event_type IN ('email.bounced', 'email.failed', 'email.complained', 'email.suppressed')) AS adverse_at
        FROM lead_provider_events WHERE outbox_id IS NOT NULL AND conflicted_at IS NULL GROUP BY outbox_id
      ), accepted_attempts AS (
        SELECT outbox_id, min(completed_at) AS accepted_at FROM lead_provider_attempts
          WHERE result_category = 'provider_accepted' GROUP BY outbox_id
      ), items AS (
        SELECT o.*, l.accepted_at, l.redacted_at, l.redact_after, l.delete_after, r.cutoff,
          e.first_observation, e.has_recipient_observation, e.adverse_at,
          COALESCE(o.delivered_at, p.accepted_at, e.first_observation) AS provider_accepted_at,
          CASE WHEN o.status = 'processing' THEN o.lease_expires_at ELSE o.next_attempt_at END AS due_at
        FROM lead_delivery_outbox o JOIN lead_submissions l ON l.id = o.lead_id
        LEFT JOIN reviewed r ON r.outbox_id = o.id LEFT JOIN observations e ON e.outbox_id = o.id
        LEFT JOIN accepted_attempts p ON p.outbox_id = o.id
      ), signals AS (
        SELECT id, 'dead_letter' AS code, dead_lettered_at AS revision FROM items
          WHERE status = 'dead_letter' AND last_error_code <> 'retention_expired' AND (cutoff IS NULL OR dead_lettered_at > cutoff)
        UNION ALL SELECT id, 'needs_review', review_required_at FROM items WHERE review_required_at IS NOT NULL AND (cutoff IS NULL OR review_required_at > cutoff)
        UNION ALL SELECT id, 'recipient_failure', adverse_at FROM items WHERE adverse_at IS NOT NULL AND (cutoff IS NULL OR adverse_at > cutoff)
        UNION ALL SELECT id, 'recipient_observation_missing', provider_accepted_at + ${thresholds.recipientObservationMs} * interval '1 millisecond' FROM items
          WHERE channel = 'internal_email' AND provider_accepted_at IS NOT NULL
          AND NOT COALESCE(has_recipient_observation, false)
          AND provider_accepted_at < ${new Date(now.getTime() - thresholds.recipientObservationMs).toISOString()}::timestamptz
          AND (cutoff IS NULL OR provider_accepted_at + ${thresholds.recipientObservationMs} * interval '1 millisecond' > cutoff)
        UNION ALL SELECT id, 'handling_missing', accepted_at FROM items WHERE channel = 'internal_email' AND cutoff IS NULL
          AND accepted_at < ${new Date(now.getTime() - thresholds.handlingMs).toISOString()}::timestamptz
          AND delete_after > ${now.toISOString()}::timestamptz
        UNION ALL SELECT id, 'unmatched_provider_events', received_at FROM lead_provider_events WHERE outbox_id IS NULL
          AND received_at < ${new Date(now.getTime() - 300_000).toISOString()}::timestamptz
        UNION ALL SELECT e.id, 'provider_event_conflict', e.conflicted_at FROM lead_provider_events e LEFT JOIN reviewed r ON r.outbox_id = e.outbox_id
          WHERE e.conflicted_at IS NOT NULL AND (r.cutoff IS NULL OR e.conflicted_at > r.cutoff)
      ) SELECT
        (SELECT extract(epoch FROM (${now.toISOString()}::timestamptz - min(due_at))) * 1000 FROM items
          WHERE status IN ('pending', 'retry_scheduled', 'processing') AND due_at <= ${now.toISOString()}::timestamptz
          AND redacted_at IS NULL AND redact_after > ${now.toISOString()}::timestamptz AND delete_after > ${now.toISOString()}::timestamptz) AS oldest_due_ms,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('code', code, 'count', total, 'revision', revision)) FROM (
          SELECT code, count(*) AS total, max(revision) AS revision FROM signals GROUP BY code
        ) grouped), '[]'::jsonb) AS signals,
        (SELECT completed_at FROM lead_operations_heartbeats WHERE job = 'sweep') AS sweep_completed_at,
        (SELECT completed_at FROM lead_operations_heartbeats WHERE job = 'retention') AS retention_completed_at`)
    const row = result.rows[0]
    if (!row) throw new Error("MonitorSnapshotUnavailable")
    const signals = row.signals as Array<{ code: MonitorCode; count: number; revision: string }>
    const count = (code: MonitorCode) => Number(signals.find(item => item.code === code)?.count ?? 0)
    const fingerprints = Object.fromEntries(signals.map(item => [item.code, createHash("sha256").update(`${item.count}:${item.revision}`).digest("hex").slice(0, 20)]))
    const date = (value: unknown) => value ? new Date(String(value)) : null
    return {
      oldestDueMs: row.oldest_due_ms == null ? null : Number(row.oldest_due_ms),
      deadLetters: count("dead_letter"), needsReview: count("needs_review"), recipientFailures: count("recipient_failure"),
      unmatchedEvents: count("unmatched_provider_events"), eventConflicts: count("provider_event_conflict"),
      missingRecipientObservations: count("recipient_observation_missing"), unhandledInquiries: count("handling_missing"),
      sweepCompletedAt: date(row.sweep_completed_at), retentionCompletedAt: date(row.retention_completed_at), fingerprints,
    }
  }

  return { receiveProviderEvent, reconcileProviderEvents, pruneUnmatchedProviderEvents, acknowledgeDelivery, getDeliveryObservation, recordHeartbeat, readMonitorSnapshot }
}

export const observationsRepository = () => createObservationsRepository(getDatabase())
