import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core"
import { leadDeliveryOutbox } from "./schema"

// Minimal operational observations only. No raw callback, address, subject or body.
export const leadProviderEvents = pgTable("lead_provider_events", {
  id: uuid("id").primaryKey(),
  providerAccountRef: varchar("provider_account_ref", { length: 64 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 200 }).notNull(),
  providerMessageId: varchar("provider_message_id", { length: 128 }).notNull(),
  outboxId: uuid("outbox_id").references(() => leadDeliveryOutbox.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  providerOccurredAt: timestamp("provider_occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  conflictedAt: timestamp("conflicted_at", { withTimezone: true, mode: "date" }),
}, table => [
  uniqueIndex("lead_provider_events_account_event_uidx").on(table.providerAccountRef, table.providerEventId),
  index("lead_provider_events_account_message_idx").on(table.providerAccountRef, table.providerMessageId),
  index("lead_provider_events_outbox_received_idx").on(table.outboxId, table.receivedAt),
])

export const leadDeliveryAcknowledgements = pgTable("lead_delivery_acknowledgements", {
  id: uuid("id").primaryKey(),
  outboxId: uuid("outbox_id").notNull().references(() => leadDeliveryOutbox.id, { onDelete: "cascade" }),
  operatorReference: varchar("operator_reference", { length: 64 }).notNull(),
  reviewedThrough: timestamp("reviewed_through", { withTimezone: true, mode: "date" }).notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, table => [
  uniqueIndex("lead_delivery_acknowledgements_review_uidx").on(table.outboxId, table.operatorReference, table.reviewedThrough),
  index("lead_delivery_acknowledgements_outbox_idx").on(table.outboxId, table.reviewedThrough),
])

export const leadOperationsHeartbeats = pgTable("lead_operations_heartbeats", {
  job: varchar("job", { length: 32 }).primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }).notNull(),
})
