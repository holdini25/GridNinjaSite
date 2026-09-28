import "server-only"
import { monitorCountsQuery } from "@/lib/contact/monitor-query"
import { and, eq, isNull, lt, sql } from "drizzle-orm"
import { createDatabase, getDatabase } from "@/db/client"
import { leadDeliveryOutbox, leadOperationHeartbeats, leadProviderEvents } from "@/db/schema"
import type { ProviderDeliveryEvent } from "@/lib/contact/provider-events"
import { deriveDeliveryObservation } from "@/lib/contact/provider-events"
import type { MonitorSnapshot } from "@/lib/contact/monitor"

export async function recordOperationHeartbeat(operation: "sweep" | "retention", completedAt: Date) {
  await getDatabase().insert(leadOperationHeartbeats).values({ operation, completedAt }).onConflictDoUpdate({
    target: leadOperationHeartbeats.operation, set: { completedAt },
  })
}

export async function reconcileProviderEvents(database = getDatabase()) {
  // Also called by the independent monitor: repairs the race where a callback
  // arrives before the worker records the provider's message ID.
  await database.execute(sql`UPDATE lead_provider_events e SET outbox_id = o.id
    FROM lead_delivery_outbox o WHERE e.outbox_id IS NULL
    AND o.channel = 'internal_email' AND o.provider_message_id = e.provider_message_id`)
}

export async function receiveProviderEvent(event: ProviderDeliveryEvent) {
  const database = getDatabase()
  await database.insert(leadProviderEvents).values(event).onConflictDoNothing({ target: leadProviderEvents.eventId })
  await reconcileProviderEvents()
}

export async function pruneProviderEvents(now: Date) {
  // Matched events cascade with their inquiry at 365 days; events that cannot
  // be associated (including another application's mail) live for seven days.
  const database = getDatabase()
  const expired = database.select({ id: leadProviderEvents.eventId }).from(leadProviderEvents)
    .where(and(isNull(leadProviderEvents.outboxId), lt(leadProviderEvents.receivedAt, new Date(now.getTime() - 7 * 86_400_000))))
    .limit(1000).for("update", { skipLocked: true })
  await database.delete(leadProviderEvents).where(sql`${leadProviderEvents.eventId} IN (${expired})`)
}

export async function acknowledgeDelivery(outboxId: string, operatorReference: string, reviewedThrough: Date, now = new Date()) {
  if (!Number.isFinite(reviewedThrough.getTime()) || reviewedThrough > now) return false
  const [row] = await getDatabase().update(leadDeliveryOutbox).set({
    operatorAcknowledgedAt: sql`coalesce(${leadDeliveryOutbox.operatorAcknowledgedAt}, ${now})`,
    operatorReference: sql`coalesce(${leadDeliveryOutbox.operatorReference}, ${operatorReference})`,
    operatorReviewedThrough: sql`greatest(${leadDeliveryOutbox.operatorReviewedThrough}, ${reviewedThrough})`,
  }).where(and(eq(leadDeliveryOutbox.id, outboxId), eq(leadDeliveryOutbox.channel, "internal_email"), sql`${leadDeliveryOutbox.createdAt} <= ${reviewedThrough}`))
    .returning({ id: leadDeliveryOutbox.id })
  return !!row
}

export async function getDeliveryObservation(outboxId: string) {
  const database = getDatabase()
  const [outbox] = await database.select({ status: leadDeliveryOutbox.status, acknowledged: leadDeliveryOutbox.operatorAcknowledgedAt })
    .from(leadDeliveryOutbox).where(eq(leadDeliveryOutbox.id, outboxId)).limit(1)
  if (!outbox) return null
  const events = await database.select().from(leadProviderEvents).where(eq(leadProviderEvents.outboxId, outboxId))
  return deriveDeliveryObservation(outbox.status === "delivered", events as ProviderDeliveryEvent[], !!outbox.acknowledged)
}

export async function readMonitorSnapshot(now: Date): Promise<MonitorSnapshot> {
  const database = createDatabase(process.env.DATABASE_URL ?? "", { signal: AbortSignal.timeout(10_000) })
  await reconcileProviderEvents(database)
  const [counts, heartbeats] = await database.batch([
    database.execute(monitorCountsQuery(now)),
    database.select().from(leadOperationHeartbeats),
  ])
  const row = counts.rows[0] as Record<string, string | number | null>
  return {
    fingerprints: {
      dead_letter: `${row.dead_letters}:${row.dead_letter_revision ?? "none"}`,
      needs_review: `${row.needs_review}:${row.review_revision ?? "none"}`,
      recipient_failure: `${row.recipient_failures}:${row.recipient_revision ?? "none"}`,
    },
    oldestDueMs: row.oldest_due_ms === null ? null : Number(row.oldest_due_ms),
    deadLetters: Number(row.dead_letters), needsReview: Number(row.needs_review),
    configurationFailures: Number(row.configuration_failures), recipientFailures: Number(row.recipient_failures),
    unmatchedEvents: Number(row.unmatched_events),
    sweepCompletedAt: heartbeats.find((item) => item.operation === "sweep")?.completedAt ?? null,
    retentionCompletedAt: heartbeats.find((item) => item.operation === "retention")?.completedAt ?? null,
  }
}
