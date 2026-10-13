import "server-only"

import { randomUUID } from "node:crypto"

import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm"

import { getDatabase, type LeadDatabase } from "@/db/client"
import {
  leadDeliveryOutbox,
  leadProviderAttempts,
  leadSubmissions,
  type LeadDeliveryChannel,
  type LeadDeliveryOutboxRow,
  type LeadDeliveryStatus,
  type LeadFormType,
  type LeadStatus,
  type LeadSubmissionRow,
  type NewLeadDeliveryOutboxRow,
} from "@/db/schema"

import { reserveProviderAttemptQuery } from "@/lib/contact/provider-attempt-query"
import { parseReviewReason, validPreparedRequest, type PreparedProviderRequest, type ProviderReservation } from "@/lib/contact/provider-request"
import type { DeliveryProviderResult } from "@/lib/contact/delivery-core"

const REDACTION_AGE_MS = 180 * 24 * 60 * 60 * 1_000
const DELETION_AGE_MS = 365 * 24 * 60 * 60 * 1_000
const DEFAULT_RETENTION_BATCH_SIZE = 500

// Reserved durable state within the deployed schema. Only dead_letter rows may
// use this prefix; provider error codes are normalized without ':' elsewhere.
// 14 prefix characters + the provider's maximum 64 characters fit varchar(80).
export const TERMINAL_ALERT_PREFIX = "alert_pending:"

export function pendingTerminalError(errorCode: string) {
  if (!/^[a-z0-9_-]{1,64}$/.test(errorCode)) throw new Error("InvalidTerminalErrorCode")
  return `${TERMINAL_ALERT_PREFIX}${errorCode}`
}

export type AcceptLeadInput = {
  requestId: string
  clientSubmissionId: string
  requestFingerprint: string
  schemaVersion: 1 | 2
  formType: LeadFormType
  intent: string
  name: string
  company: string
  email: string
  normalizedEmail: string
  role?: string | null
  buyerType?: string | null
  siteType?: string | null
  timeline?: string | null
  capacityRange?: string | null
  constraints?: string[] | null
  message?: string | null
  source: string
  ipHash: string
  turnstileHostname: string
  turnstileAction: string
  turnstileChallengeAt?: Date | null
  acceptedAt?: Date
  includeCrmWebhook?: boolean
}

export type AcceptLeadResult =
  | {
      kind: "accepted" | "duplicate"
      lead: LeadSubmissionRow
      leadId: string
      submissionId: string
      outboxIds: string[]
    }
  | {
      kind: "conflict"
      lead: LeadSubmissionRow
      leadId: string
      submissionId: string
      outboxIds: []
    }

export type LeadDeliveryContext = {
  delivery: LeadDeliveryOutboxRow
  lead: LeadSubmissionRow
}

export type OutboxMutationResult = {
  updated: boolean
  leadId?: string
  leadStatus?: LeadStatus
}

export type RetryOutboxInput = {
  nextAttemptAt: Date
  errorCode: string
}

export type DeadLetterOutboxInput = {
  reviewReason?: string
  errorCode: string
}

export type DueOutboxCandidate = {
  id: string
  channel: LeadDeliveryChannel
  status: LeadDeliveryStatus
  attemptCount: number
  dueAt: Date
}

export type OldestDueOutboxAge = {
  outboxId: string
  createdAt: Date
  dueAt: Date
  ageMs: number
}

export function deriveLeadStatus(
  deliveryStatuses: readonly LeadDeliveryStatus[]
): LeadStatus {
  if (deliveryStatuses.length === 0) {
    return "queued"
  }

  if (deliveryStatuses.every((status) => status === "delivered")) {
    return "delivered"
  }

  if (deliveryStatuses.every((status) => status === "dead_letter")) {
    return "dead_letter"
  }

  if (deliveryStatuses.some((status) => status === "delivered")) {
    return "partially_delivered"
  }

  if (deliveryStatuses.some((status) => status === "processing")) {
    return "processing"
  }

  return "queued"
}

function activeLead(now: Date) {
  return sql`EXISTS (SELECT 1 FROM ${leadSubmissions}
    WHERE ${leadSubmissions.id} = ${leadDeliveryOutbox.leadId}
      AND ${leadSubmissions.redactedAt} IS NULL
      AND ${leadSubmissions.redactAfter} > ${now.toISOString()}::timestamptz
      AND ${leadSubmissions.deleteAfter} > ${now.toISOString()}::timestamptz)`
}

function pendingTerminalAlert() {
  return and(eq(leadDeliveryOutbox.status, "dead_letter"), sql`left(${leadDeliveryOutbox.lastErrorCode}, ${TERMINAL_ALERT_PREFIX.length}) = ${TERMINAL_ALERT_PREFIX}`)
}

function dueOrLeaseExpired(now: Date) {
  return or(
    and(activeLead(now), or(and(
      inArray(leadDeliveryOutbox.status, ["pending", "retry_scheduled"]),
      lte(leadDeliveryOutbox.nextAttemptAt, now)
    ),
    and(
      eq(leadDeliveryOutbox.status, "processing"),
      lte(leadDeliveryOutbox.leaseExpiresAt, now)
    ))),
    and(pendingTerminalAlert(), lte(leadDeliveryOutbox.nextAttemptAt, now),
      or(isNull(leadDeliveryOutbox.leaseExpiresAt), lte(leadDeliveryOutbox.leaseExpiresAt, now)))
  )
}

export function createLeadRepository(database: LeadDatabase) {
  async function findLeadByClientSubmissionId(clientSubmissionId: string) {
    const [lead] = await database
      .select()
      .from(leadSubmissions)
      .where(eq(leadSubmissions.clientSubmissionId, clientSubmissionId))
      .limit(1)

    return lead ?? null
  }

  async function acceptLead(input: AcceptLeadInput): Promise<AcceptLeadResult> {
    const acceptedAt = input.acceptedAt ?? new Date()
    const leadId = randomUUID()
    const internalEmailOutboxId = randomUUID()
    const crmWebhookOutboxId = input.includeCrmWebhook ? randomUUID() : null
    const existing = await findLeadByClientSubmissionId(
      input.clientSubmissionId
    )

    if (existing) {
      return existingAcceptanceResult(existing, input.requestFingerprint)
    }

    const insertLead = database
      .insert(leadSubmissions)
      .values({
        id: leadId,
        clientSubmissionId: input.clientSubmissionId,
        requestId: input.requestId,
        requestFingerprint: input.requestFingerprint,
        schemaVersion: input.schemaVersion,
        formType: input.formType,
        intent: input.intent,
        name: input.name,
        company: input.company,
        email: input.email,
        normalizedEmail: input.normalizedEmail,
        role: input.role ?? null,
        buyerType: input.buyerType ?? null,
        siteType: input.siteType ?? null,
        timeline: input.timeline ?? null,
        capacityRange: input.capacityRange ?? null,
        constraints: input.constraints ?? null,
        message: input.message ?? null,
        source: input.source,
        ipHash: input.ipHash,
        turnstileHostname: input.turnstileHostname,
        turnstileAction: input.turnstileAction,
        turnstileChallengeAt: input.turnstileChallengeAt ?? null,
        acceptedAt,
        redactAfter: new Date(acceptedAt.getTime() + REDACTION_AGE_MS),
        deleteAfter: new Date(acceptedAt.getTime() + DELETION_AGE_MS),
        createdAt: acceptedAt,
        updatedAt: acceptedAt,
      })
      .returning()

    const internalEmailRow: NewLeadDeliveryOutboxRow = {
      id: internalEmailOutboxId,
      leadId,
      channel: "internal_email",
      idempotencyKey: `lead-notification/${leadId}`,
      nextAttemptAt: acceptedAt,
      createdAt: acceptedAt,
      updatedAt: acceptedAt,
    }
    const insertInternalEmail = database
      .insert(leadDeliveryOutbox)
      .values(internalEmailRow)
      .returning({ id: leadDeliveryOutbox.id })

    try {
      if (crmWebhookOutboxId) {
        const crmWebhookRow: NewLeadDeliveryOutboxRow = {
          id: crmWebhookOutboxId,
          leadId,
          channel: "crm_webhook",
          idempotencyKey: `lead-webhook/${leadId}`,
          nextAttemptAt: acceptedAt,
          createdAt: acceptedAt,
          updatedAt: acceptedAt,
        }
        const insertCrmWebhook = database
          .insert(leadDeliveryOutbox)
          .values(crmWebhookRow)
          .returning({ id: leadDeliveryOutbox.id })
        const [insertedLeads, emailRows, webhookRows] = await database.batch([
          insertLead,
          insertInternalEmail,
          insertCrmWebhook,
        ])
        const insertedLead = insertedLeads[0]

        if (!insertedLead) {
          throw new Error("Lead batch insert did not return the accepted lead.")
        }

        return {
          kind: "accepted",
          lead: insertedLead,
          leadId: insertedLead.id,
          submissionId: insertedLead.id,
          outboxIds: [...emailRows, ...webhookRows].map(({ id }) => id),
        }
      }

      const [insertedLeads, emailRows] = await database.batch([
        insertLead,
        insertInternalEmail,
      ])
      const insertedLead = insertedLeads[0]

      if (!insertedLead) {
        throw new Error("Lead batch insert did not return the accepted lead.")
      }

      return {
        kind: "accepted",
        lead: insertedLead,
        leadId: insertedLead.id,
        submissionId: insertedLead.id,
        outboxIds: emailRows.map(({ id }) => id),
      }
    } catch (error) {
      // A concurrent request can win the unique client-submission insert. The
      // Neon batch rolls back the losing lead and outbox writes atomically.
      const concurrentExisting = await findLeadByClientSubmissionId(
        input.clientSubmissionId
      )

      if (concurrentExisting) {
        return existingAcceptanceResult(
          concurrentExisting,
          input.requestFingerprint
        )
      }

      throw error
    }
  }

  async function existingAcceptanceResult(
    existingLead: LeadSubmissionRow,
    requestFingerprint: string
  ): Promise<AcceptLeadResult> {
    if (existingLead.requestFingerprint !== requestFingerprint) {
      return {
        kind: "conflict",
        lead: existingLead,
        leadId: existingLead.id,
        submissionId: existingLead.id,
        outboxIds: [],
      }
    }

    const existingOutbox = await database
      .select({ id: leadDeliveryOutbox.id })
      .from(leadDeliveryOutbox)
      .where(eq(leadDeliveryOutbox.leadId, existingLead.id))
      .orderBy(asc(leadDeliveryOutbox.createdAt))

    return {
      kind: "duplicate",
      lead: existingLead,
      leadId: existingLead.id,
      submissionId: existingLead.id,
      outboxIds: existingOutbox.map(({ id }) => id),
    }
  }

  async function getLeadDeliveryContext(
    outboxId: string
  ): Promise<LeadDeliveryContext | null> {
    const [context] = await database
      .select({ delivery: leadDeliveryOutbox, lead: leadSubmissions })
      .from(leadDeliveryOutbox)
      .innerJoin(
        leadSubmissions,
        eq(leadSubmissions.id, leadDeliveryOutbox.leadId)
      )
      .where(eq(leadDeliveryOutbox.id, outboxId))
      .limit(1)

    return context ?? null
  }

  async function claimOutbox(
    now: Date,
    leaseMs: number,
    outboxId?: string
  ): Promise<LeadDeliveryContext | null> {
    if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
      throw new Error("Outbox lease duration must be a positive number.")
    }

    const leaseToken = randomUUID()
    const leaseExpiresAt = new Date(now.getTime() + leaseMs)
    const eligibility = dueOrLeaseExpired(now)
    const candidate = database
      .select({ id: leadDeliveryOutbox.id })
      .from(leadDeliveryOutbox)
      // Lock both rows with SKIP LOCKED. Retention locks leads before retiring
      // their outboxes; claims must not wait while holding the opposite lock.
      .innerJoin(leadSubmissions, eq(leadSubmissions.id, leadDeliveryOutbox.leadId))
      .where(
        outboxId
          ? and(eq(leadDeliveryOutbox.id, outboxId), eligibility)
          : eligibility
      )
      .orderBy(
        asc(leadDeliveryOutbox.nextAttemptAt),
        asc(leadDeliveryOutbox.createdAt)
      )
      .limit(1)
      .for("update", { skipLocked: true })

    const [delivery] = await database
      .update(leadDeliveryOutbox)
      .set({
        status: sql`CASE WHEN ${leadDeliveryOutbox.status} = 'dead_letter' THEN 'dead_letter'::lead_delivery_status ELSE 'processing'::lead_delivery_status END`,
        leaseToken,
        leaseExpiresAt,
        lastAttemptAt: sql`CASE WHEN ${leadDeliveryOutbox.status} = 'dead_letter' THEN ${leadDeliveryOutbox.lastAttemptAt} ELSE ${now.toISOString()}::timestamptz END`,
        attemptCount: sql`CASE WHEN ${leadDeliveryOutbox.status} = 'dead_letter' THEN ${leadDeliveryOutbox.attemptCount} ELSE ${leadDeliveryOutbox.attemptCount} + 1 END`,
        updatedAt: now,
      })
      .where(sql`${leadDeliveryOutbox.id} = (${candidate})`)
      .returning()

    if (!delivery) {
      return null
    }

    const [, leads] = await database.batch([
      refreshLeadStatusForOutbox(delivery.id, now),
      database
        .select()
        .from(leadSubmissions)
        .where(eq(leadSubmissions.id, delivery.leadId))
        .limit(1),
    ])
    const lead = leads[0]

    if (!lead) {
      // A concurrent retention deletion cascades the claimed outbox. There is
      // no remaining lease or work to recover, and no provider may be called.
      return null
    }

    return { delivery, lead }
  }

  async function claimNextDueOutbox(now: Date, leaseMs: number) {
    return claimOutbox(now, leaseMs)
  }

  async function claimOutboxById(
    outboxId: string,
    now: Date,
    leaseMs: number
  ) {
    return claimOutbox(now, leaseMs, outboxId)
  }

  async function prepareAndReserveProviderAttempt(outboxId: string, leaseToken: string, request: PreparedProviderRequest): Promise<ProviderReservation> {
    if (!validPreparedRequest(request)) throw new Error("InvalidPreparedProviderRequest")
    const result = await database.execute(reserveProviderAttemptQuery(outboxId, leaseToken, randomUUID(), request))
    const row = result.rows[0]
    if (!row) return { kind: "stale" }
    // Only SQL NULL means sending was not stopped. Unknown/empty values from a
    // mismatched database deployment must never fall through to send permission.
    if (row.stop_reason !== null) return { kind: "stopped", reason: parseReviewReason(row.stop_reason), terminalAt: row.dead_lettered_at instanceof Date ? row.dead_lettered_at : new Date(String(row.dead_lettered_at)) }
    if (!row.reservation_id) return { kind: "already_reserved" }
    return { kind: "ready", reservationId: String(row.reservation_id), firstAttemptAt: row.first_provider_attempt_at instanceof Date ? row.first_provider_attempt_at : new Date(String(row.first_provider_attempt_at)),
      request: { version: 1, channel: row.channel as PreparedProviderRequest["channel"], idempotencyKey: String(row.idempotency_key), bodyUtf8: String(row.provider_request_body), bodySha256: String(row.provider_request_body_sha256),
        targetUrl: String(row.provider_target_url), accountRef: String(row.provider_account_ref), destinationRef: String(row.provider_destination_ref) } }
  }

  async function recordProviderAttemptResult(reservationId: string, result: DeliveryProviderResult) {
    // A late result is evidence only: it cannot alter the outbox or recreate PII.
    // FK deletion and the deadline predicate prevent resurrecting deleted work.
    const rows = await database.update(leadProviderAttempts).set({
      resultCategory: result.ok ? "provider_accepted" : result.retryable ? "uncertain" : "rejected",
      providerMessageId: result.ok ? result.providerMessageId ?? null : null,
      resultCode: result.ok ? null : result.errorCode,
      resultHttpStatus: result.status,
      completedAt: sql`clock_timestamp()`,
    }).where(and(eq(leadProviderAttempts.id, reservationId), isNull(leadProviderAttempts.completedAt), sql`EXISTS (
      SELECT 1 FROM lead_delivery_outbox o JOIN lead_submissions l ON l.id = o.lead_id
      WHERE o.id = ${leadProviderAttempts.outboxId} AND l.delete_after > clock_timestamp()
    )`)).returning({ id: leadProviderAttempts.id })
    return rows.length === 1
  }

  async function isOutboxSendAllowed(outboxId: string, leaseToken: string, now = new Date()) {
    const rows = await database.select({ id: leadDeliveryOutbox.id }).from(leadDeliveryOutbox).where(and(
      eq(leadDeliveryOutbox.id, outboxId), eq(leadDeliveryOutbox.status, "processing"),
      eq(leadDeliveryOutbox.leaseToken, leaseToken), gt(leadDeliveryOutbox.leaseExpiresAt, now), activeLead(now),
      sql`${leadDeliveryOutbox.leaseExpiresAt} > clock_timestamp()`,
      sql`${leadDeliveryOutbox.firstProviderAttemptAt} <= clock_timestamp() AND ${leadDeliveryOutbox.firstProviderAttemptAt} > clock_timestamp() - interval '23 hours'`,
      isNull(leadDeliveryOutbox.reviewRequiredAt),
      sql`EXISTS (SELECT 1 FROM lead_submissions l WHERE l.id = ${leadDeliveryOutbox.leadId}
        AND l.redacted_at IS NULL AND l.redact_after > clock_timestamp() AND l.delete_after > clock_timestamp())`,
      sql`EXISTS (SELECT 1 FROM lead_provider_attempts a WHERE a.outbox_id = ${leadDeliveryOutbox.id} AND a.lease_token = ${leaseToken}::uuid)`
    )).limit(1)
    // This is the final local authorization check, not a cancellation mechanism
    // for a request already handed to an external provider.
    return rows.length === 1
  }

  async function isOutboxAlertAllowed(outboxId: string, leaseToken: string, now = new Date()) {
    const rows = await database.select({ id: leadDeliveryOutbox.id }).from(leadDeliveryOutbox).where(and(
      eq(leadDeliveryOutbox.id, outboxId), pendingTerminalAlert(),
      eq(leadDeliveryOutbox.leaseToken, leaseToken), gt(leadDeliveryOutbox.leaseExpiresAt, now)
    )).limit(1)
    return rows.length === 1
  }

  async function markOutboxDelivered(
    outboxId: string,
    leaseToken: string,
    providerMessageId?: string | null,
    now = new Date()
  ): Promise<OutboxMutationResult> {
    const [, updatedRows, refreshedLeads] = await database.batch([
      lockLeadForOutbox(outboxId),
      database
        .update(leadDeliveryOutbox)
        .set({
          status: "delivered",
          deliveredAt: now,
          providerMessageId: providerMessageId ?? null,
          lastErrorCode: null,
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(leadDeliveryOutbox.id, outboxId),
            eq(leadDeliveryOutbox.status, "processing"),
            eq(leadDeliveryOutbox.leaseToken, leaseToken),
            gt(leadDeliveryOutbox.leaseExpiresAt, now)
          )
        )
        .returning({ leadId: leadDeliveryOutbox.leadId }),
      refreshLeadStatusForOutbox(outboxId, now),
    ])
    const updated = updatedRows[0]
    const refreshedLead = refreshedLeads[0]

    return updated
      ? {
          updated: true,
          leadId: updated.leadId,
          leadStatus: refreshedLead?.status,
        }
      : { updated: false }
  }

  async function rescheduleOutbox(
    outboxId: string,
    leaseToken: string,
    input: RetryOutboxInput,
    now = new Date()
  ): Promise<OutboxMutationResult> {
    const [, updatedRows, refreshedLeads] = await database.batch([
      lockLeadForOutbox(outboxId),
      database
        .update(leadDeliveryOutbox)
        .set({
          status: "retry_scheduled",
          nextAttemptAt: input.nextAttemptAt,
          lastErrorCode: input.errorCode,
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(leadDeliveryOutbox.id, outboxId),
            eq(leadDeliveryOutbox.status, "processing"),
            eq(leadDeliveryOutbox.leaseToken, leaseToken),
            gt(leadDeliveryOutbox.leaseExpiresAt, now)
          )
        )
        .returning({ leadId: leadDeliveryOutbox.leadId }),
      refreshLeadStatusForOutbox(outboxId, now),
    ])
    const updated = updatedRows[0]
    const refreshedLead = refreshedLeads[0]

    return updated
      ? {
          updated: true,
          leadId: updated.leadId,
          leadStatus: refreshedLead?.status,
        }
      : { updated: false }
  }

  async function markOutboxDeadLetter(
    outboxId: string,
    leaseToken: string,
    input: DeadLetterOutboxInput,
    now = new Date()
  ): Promise<OutboxMutationResult> {
    const [, updatedRows, refreshedLeads] = await database.batch([
      lockLeadForOutbox(outboxId),
      database
        .update(leadDeliveryOutbox)
        .set({
          status: "dead_letter",
          deadLetteredAt: now,
          lastErrorCode: pendingTerminalError(input.errorCode),
          reviewRequiredAt: input.reviewReason ? now : leadDeliveryOutbox.reviewRequiredAt,
          reviewReason: input.reviewReason ?? leadDeliveryOutbox.reviewReason,
          // Keep this worker's lease for the alert-only phase. Failed publication
          // remains recoverable after lease expiry, but can never resume sending.
          nextAttemptAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(leadDeliveryOutbox.id, outboxId),
            eq(leadDeliveryOutbox.status, "processing"),
            eq(leadDeliveryOutbox.leaseToken, leaseToken),
            gt(leadDeliveryOutbox.leaseExpiresAt, now)
          )
        )
        .returning({ leadId: leadDeliveryOutbox.leadId }),
      refreshLeadStatusForOutbox(outboxId, now),
    ])
    const updated = updatedRows[0]
    const refreshedLead = refreshedLeads[0]

    return updated
      ? {
          updated: true,
          leadId: updated.leadId,
          leadStatus: refreshedLead?.status,
        }
      : { updated: false }
  }

  async function markTerminalAlertPublished(outboxId: string, leaseToken: string, now = new Date()) {
    const rows = await database.update(leadDeliveryOutbox).set({
      lastErrorCode: sql`substring(${leadDeliveryOutbox.lastErrorCode} from ${TERMINAL_ALERT_PREFIX.length + 1}::integer)`,
      leaseToken: null, leaseExpiresAt: null, updatedAt: now,
    }).where(and(eq(leadDeliveryOutbox.id, outboxId), pendingTerminalAlert(),
      eq(leadDeliveryOutbox.leaseToken, leaseToken), gt(leadDeliveryOutbox.leaseExpiresAt, now)
    )).returning({ id: leadDeliveryOutbox.id })
    return rows.length === 1
  }

  function lockLeadForOutbox(outboxId: string) {
    // All multi-row transactions take the lead lock before the outbox lock,
    // matching retention and avoiding opposing completion/retention lock order.
    return database.select({ id: leadSubmissions.id }).from(leadSubmissions)
      .where(sql`${leadSubmissions.id} = (SELECT ${leadDeliveryOutbox.leadId} FROM ${leadDeliveryOutbox} WHERE ${leadDeliveryOutbox.id} = ${outboxId})`)
      .for("update")
  }

  function refreshLeadStatusForOutbox(outboxId: string, now: Date) {
    const derivedStatus = sql<LeadStatus>`(
      SELECT CASE
        WHEN count(*) FILTER (WHERE ${leadDeliveryOutbox.status} <> 'delivered') = 0
          THEN 'delivered'::lead_status
        WHEN count(*) FILTER (WHERE ${leadDeliveryOutbox.status} <> 'dead_letter') = 0
          THEN 'dead_letter'::lead_status
        WHEN count(*) FILTER (WHERE ${leadDeliveryOutbox.status} = 'delivered') > 0
          THEN 'partially_delivered'::lead_status
        WHEN count(*) FILTER (WHERE ${leadDeliveryOutbox.status} = 'processing') > 0
          THEN 'processing'::lead_status
        ELSE 'queued'::lead_status
      END
      FROM ${leadDeliveryOutbox}
      WHERE ${leadDeliveryOutbox.leadId} = ${leadSubmissions.id}
    )`
    const leadId = database
      .select({ leadId: leadDeliveryOutbox.leadId })
      .from(leadDeliveryOutbox)
      .where(eq(leadDeliveryOutbox.id, outboxId))
      .limit(1)

    return database
      .update(leadSubmissions)
      .set({ status: derivedStatus, updatedAt: now })
      .where(sql`${leadSubmissions.id} = (${leadId})`)
      .returning({ status: leadSubmissions.status })
  }

  async function listDueOrLeaseExpiredOutbox(
    now: Date,
    limit = 100
  ): Promise<DueOutboxCandidate[]> {
    const rows = await database
      .select({
        id: leadDeliveryOutbox.id,
        channel: leadDeliveryOutbox.channel,
        status: leadDeliveryOutbox.status,
        attemptCount: leadDeliveryOutbox.attemptCount,
        nextAttemptAt: leadDeliveryOutbox.nextAttemptAt,
        leaseExpiresAt: leadDeliveryOutbox.leaseExpiresAt,
      })
      .from(leadDeliveryOutbox)
      .where(dueOrLeaseExpired(now))
      .orderBy(
        asc(leadDeliveryOutbox.nextAttemptAt),
        asc(leadDeliveryOutbox.createdAt)
      )
      .limit(Math.max(1, Math.min(limit, 500)))

    return rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      status: row.status,
      attemptCount: row.attemptCount,
      dueAt:
        row.status === "processing" && row.leaseExpiresAt
          ? row.leaseExpiresAt
          : row.nextAttemptAt,
    }))
  }

  async function getOldestDueOutboxAge(
    now: Date
  ): Promise<OldestDueOutboxAge | null> {
    const effectiveDueAt = sql`CASE
      WHEN ${leadDeliveryOutbox.status} = 'processing'
        THEN ${leadDeliveryOutbox.leaseExpiresAt}
      ELSE ${leadDeliveryOutbox.nextAttemptAt}
    END`
    const [oldest] = await database
      .select({
        id: leadDeliveryOutbox.id,
        createdAt: leadDeliveryOutbox.createdAt,
        status: leadDeliveryOutbox.status,
        nextAttemptAt: leadDeliveryOutbox.nextAttemptAt,
        leaseExpiresAt: leadDeliveryOutbox.leaseExpiresAt,
      })
      .from(leadDeliveryOutbox)
      .where(dueOrLeaseExpired(now))
      .orderBy(asc(effectiveDueAt))
      .limit(1)

    if (!oldest) {
      return null
    }

    const dueAt =
      oldest.status === "processing" && oldest.leaseExpiresAt
        ? oldest.leaseExpiresAt
        : oldest.nextAttemptAt

    return {
      outboxId: oldest.id,
      createdAt: oldest.createdAt,
      dueAt,
      ageMs: Math.max(0, now.getTime() - dueAt.getTime()),
    }
  }

  async function redactExpiredLeads(
    cutoff: Date,
    limit = DEFAULT_RETENTION_BATCH_SIZE
  ): Promise<string[]> {
    /* Retire work and redact in one statement/transaction. A provider call that
     * already passed its last lease check may finish externally; its invalidated
     * lease cannot restore fields or commit delivery state after this transaction.
     * Pending terminal alerts contain no inquiry body and retain their event data.
     */
    const result = await database.execute<{ id: string }>(sql`
      WITH candidates AS MATERIALIZED (
        SELECT id FROM lead_submissions l
        WHERE (redacted_at IS NULL AND (redact_after <= ${cutoff.toISOString()}::timestamptz OR delete_after <= ${cutoff.toISOString()}::timestamptz))
          OR (redacted_at IS NOT NULL AND EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND (o.status IN ('pending', 'retry_scheduled', 'processing') OR o.provider_request_body IS NOT NULL OR o.provider_target_url IS NOT NULL)))
        ORDER BY redact_after LIMIT ${Math.max(1, Math.min(limit, 5_000))}
        FOR UPDATE SKIP LOCKED
      ), retired AS (
        UPDATE lead_delivery_outbox o SET status = CASE WHEN o.status = 'delivered' THEN o.status ELSE 'dead_letter'::lead_delivery_status END,
          provider_request_body = NULL, provider_target_url = NULL, provider_request_body_sha256 = NULL, provider_destination_ref = NULL,
          dead_lettered_at = CASE WHEN o.status = 'delivered' THEN o.dead_lettered_at ELSE COALESCE(o.dead_lettered_at, ${cutoff.toISOString()}::timestamptz) END,
          last_error_code = CASE WHEN o.status IN ('dead_letter','delivered') THEN o.last_error_code ELSE 'retention_expired' END,
          lease_token = NULL, lease_expires_at = NULL, updated_at = ${cutoff.toISOString()}::timestamptz
        FROM candidates c WHERE o.lead_id = c.id
        RETURNING o.id
      )
      UPDATE lead_submissions l SET
        request_fingerprint = NULL, name = NULL, company = NULL, email = NULL, normalized_email = NULL,
        role = NULL, buyer_type = NULL, site_type = NULL, timeline = NULL, capacity_range = NULL,
        constraints = NULL, message = NULL, source = NULL, ip_hash = NULL, turnstile_hostname = NULL,
        turnstile_action = NULL, turnstile_challenge_at = NULL,
        redacted_at = COALESCE(l.redacted_at, ${cutoff.toISOString()}::timestamptz), updated_at = ${cutoff.toISOString()}::timestamptz,
        status = CASE
          WHEN NOT EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND o.status <> 'delivered') THEN 'delivered'::lead_status
          WHEN EXISTS (SELECT 1 FROM lead_delivery_outbox o WHERE o.lead_id = l.id AND o.status = 'delivered') THEN 'partially_delivered'::lead_status
          ELSE 'dead_letter'::lead_status END
      FROM candidates c WHERE l.id = c.id RETURNING l.id
    `)
    return result.rows.map(row => row.id)
  }

  async function deleteExpiredLeads(
    cutoff: Date,
    limit = DEFAULT_RETENTION_BATCH_SIZE
  ): Promise<string[]> {
    const candidates = database
      .select({ id: leadSubmissions.id })
      .from(leadSubmissions)
      .where(lte(leadSubmissions.deleteAfter, cutoff))
      .orderBy(asc(leadSubmissions.deleteAfter))
      .limit(Math.max(1, Math.min(limit, 5_000)))
      .for("update", { skipLocked: true })

    const deleted = await database
      .delete(leadSubmissions)
      .where(sql`${leadSubmissions.id} IN (${candidates})`)
      .returning({ id: leadSubmissions.id })

    return deleted.map(({ id }) => id)
  }

  return {
    findLeadByClientSubmissionId,
    acceptLead,
    getLeadDeliveryContext,
    claimNextDueOutbox,
    claimOutboxById,
    prepareAndReserveProviderAttempt,
    recordProviderAttemptResult,
    isOutboxSendAllowed,
    isOutboxAlertAllowed,
    markOutboxDelivered,
    rescheduleOutbox,
    markOutboxDeadLetter,
    markTerminalAlertPublished,
    listDueOrLeaseExpiredOutbox,
    getOldestDueOutboxAge,
    redactExpiredLeads,
    deleteExpiredLeads,
  }
}

function repository() {
  return createLeadRepository(getDatabase())
}

export const findLeadByClientSubmissionId = (clientSubmissionId: string) =>
  repository().findLeadByClientSubmissionId(clientSubmissionId)

export const acceptLead = (input: AcceptLeadInput) =>
  repository().acceptLead(input)

export const getLeadDeliveryContext = (outboxId: string) =>
  repository().getLeadDeliveryContext(outboxId)

export const claimNextDueOutbox = (now: Date, leaseMs: number) =>
  repository().claimNextDueOutbox(now, leaseMs)

export const claimOutboxById = (
  outboxId: string,
  now: Date,
  leaseMs: number
) => repository().claimOutboxById(outboxId, now, leaseMs)

export const isOutboxSendAllowed = (outboxId: string, leaseToken: string, now?: Date) => repository().isOutboxSendAllowed(outboxId, leaseToken, now)
export const isOutboxAlertAllowed = (outboxId: string, leaseToken: string, now?: Date) => repository().isOutboxAlertAllowed(outboxId, leaseToken, now)
export const markTerminalAlertPublished = (outboxId: string, leaseToken: string, now?: Date) => repository().markTerminalAlertPublished(outboxId, leaseToken, now)

export const markOutboxDelivered = (
  outboxId: string,
  leaseToken: string,
  providerMessageId?: string | null,
  now?: Date
) =>
  repository().markOutboxDelivered(
    outboxId,
    leaseToken,
    providerMessageId,
    now
  )

export const rescheduleOutbox = (
  outboxId: string,
  leaseToken: string,
  input: RetryOutboxInput,
  now?: Date
) => repository().rescheduleOutbox(outboxId, leaseToken, input, now)

export const markOutboxDeadLetter = (
  outboxId: string,
  leaseToken: string,
  input: DeadLetterOutboxInput,
  now?: Date
) => repository().markOutboxDeadLetter(outboxId, leaseToken, input, now)

export const listDueOrLeaseExpiredOutbox = (now: Date, limit?: number) =>
  repository().listDueOrLeaseExpiredOutbox(now, limit)

export const getOldestDueOutboxAge = (now: Date) =>
  repository().getOldestDueOutboxAge(now)

export const redactExpiredLeads = (cutoff: Date, limit?: number) =>
  repository().redactExpiredLeads(cutoff, limit)

export const deleteExpiredLeads = (cutoff: Date, limit?: number) =>
  repository().deleteExpiredLeads(cutoff, limit)

export const prepareAndReserveProviderAttempt = (outboxId: string, leaseToken: string, request: PreparedProviderRequest) => repository().prepareAndReserveProviderAttempt(outboxId, leaseToken, request)
export const recordProviderAttemptResult = (reservationId: string, result: DeliveryProviderResult) => repository().recordProviderAttemptResult(reservationId, result)
