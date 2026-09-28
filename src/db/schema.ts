import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const leadFormType = pgEnum("lead_form_type", [
  "capacity_audit",
  "contact",
])

export const leadStatus = pgEnum("lead_status", [
  "queued",
  "processing",
  "partially_delivered",
  "delivered",
  "dead_letter",
])

export const leadDeliveryChannel = pgEnum("lead_delivery_channel", [
  "internal_email",
  "crm_webhook",
])

export const leadDeliveryStatus = pgEnum("lead_delivery_status", [
  "pending",
  "processing",
  "retry_scheduled",
  "delivered",
  "dead_letter",
])

export const leadSubmissions = pgTable(
  "lead_submissions",
  {
    id: uuid("id").primaryKey(),
    clientSubmissionId: uuid("client_submission_id").notNull(),
    requestId: uuid("request_id").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    formType: leadFormType("form_type").notNull(),
    status: leadStatus("status").notNull().default("queued"),
    intent: varchar("intent", { length: 64 }).notNull(),

    // These values are nullable so the retention job can remove PII in place.
    requestFingerprint: varchar("request_fingerprint", { length: 64 }),
    name: varchar("name", { length: 120 }),
    company: varchar("company", { length: 160 }),
    email: varchar("email", { length: 254 }),
    normalizedEmail: varchar("normalized_email", { length: 254 }),
    role: varchar("role", { length: 120 }),
    buyerType: varchar("buyer_type", { length: 120 }),
    siteType: varchar("site_type", { length: 120 }),
    timeline: varchar("timeline", { length: 120 }),
    capacityRange: varchar("capacity_range", { length: 80 }),
    constraints: jsonb("constraints").$type<string[]>(),
    message: text("message"),
    source: varchar("source", { length: 120 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    turnstileHostname: varchar("turnstile_hostname", { length: 253 }),
    turnstileAction: varchar("turnstile_action", { length: 64 }),
    turnstileChallengeAt: timestamp("turnstile_challenge_at", {
      withTimezone: true,
      mode: "date",
    }),

    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    redactAfter: timestamp("redact_after", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    deleteAfter: timestamp("delete_after", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    redactedAt: timestamp("redacted_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("lead_submissions_client_submission_id_uidx").on(
      table.clientSubmissionId
    ),
    index("lead_submissions_redact_after_idx").on(table.redactAfter),
    index("lead_submissions_delete_after_idx").on(table.deleteAfter),
  ]
)

export const leadDeliveryOutbox = pgTable(
  "lead_delivery_outbox",
  {
    id: uuid("id").primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leadSubmissions.id, { onDelete: "cascade" }),
    channel: leadDeliveryChannel("channel").notNull(),
    status: leadDeliveryStatus("status").notNull().default("pending"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastAttemptAt: timestamp("last_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
      mode: "date",
    }),
    deadLetteredAt: timestamp("dead_lettered_at", {
      withTimezone: true,
      mode: "date",
    }),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    lastErrorCode: varchar("last_error_code", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("lead_delivery_outbox_lead_channel_uidx").on(
      table.leadId,
      table.channel
    ),
    uniqueIndex("lead_delivery_outbox_idempotency_key_uidx").on(
      table.idempotencyKey
    ),
    index("lead_delivery_outbox_due_idx").on(
      table.status,
      table.nextAttemptAt
    ),
    index("lead_delivery_outbox_lease_idx").on(
      table.status,
      table.leaseExpiresAt
    ),
  ]
)

export type LeadSubmissionRow = typeof leadSubmissions.$inferSelect
export type NewLeadSubmissionRow = typeof leadSubmissions.$inferInsert
export type LeadDeliveryOutboxRow = typeof leadDeliveryOutbox.$inferSelect
export type NewLeadDeliveryOutboxRow = typeof leadDeliveryOutbox.$inferInsert
export type LeadFormType = (typeof leadFormType.enumValues)[number]
export type LeadStatus = (typeof leadStatus.enumValues)[number]
export type LeadDeliveryChannel =
  (typeof leadDeliveryChannel.enumValues)[number]
export type LeadDeliveryStatus = (typeof leadDeliveryStatus.enumValues)[number]
