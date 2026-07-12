import "server-only"

import { randomUUID } from "node:crypto"

import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm"

import { getDatabase, type LeadDatabase } from "@/db/client"
import {
  leadDeliveryOutbox,
  leadSubmissions,
  type LeadDeliveryChannel,
  type LeadDeliveryOutboxRow,
  type LeadDeliveryStatus,
  type LeadFormType,
  type LeadStatus,
  type LeadSubmissionRow,
  type NewLeadDeliveryOutboxRow,
} from "@/db/schema"

const REDACTION_AGE_MS = 180 * 24 * 60 * 60 * 1_000
const DELETION_AGE_MS = 365 * 24 * 60 * 60 * 1_000
const DEFAULT_RETENTION_BATCH_SIZE = 500

export type AcceptLeadInput = {
  requestId: string
  clientSubmissionId: string
  requestFingerprint: string
  schemaVersion: number
  formType: LeadFormType
  intent: string
  name: string
  company: string
  email: string
  normalizedEmail: string
  role?: string | null
  buyerType: string
  siteType: string
  timeline: string
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

function dueOrLeaseExpired(now: Date) {
  return or(
    and(
      inArray(leadDeliveryOutbox.status, ["pending", "retry_scheduled"]),
      lte(leadDeliveryOutbox.nextAttemptAt, now)
    ),
    and(
      eq(leadDeliveryOutbox.status, "processing"),
      lte(leadDeliveryOutbox.leaseExpiresAt, now)
    )
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
        buyerType: input.buyerType,
        siteType: input.siteType,
        timeline: input.timeline,
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
        status: "processing",
        leaseToken,
        leaseExpiresAt,
        lastAttemptAt: now,
        attemptCount: sql`${leadDeliveryOutbox.attemptCount} + 1`,
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
      throw new Error("Claimed outbox delivery has no associated lead.")
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

  async function markOutboxDelivered(
    outboxId: string,
    leaseToken: string,
    providerMessageId?: string | null,
    now = new Date()
  ): Promise<OutboxMutationResult> {
    const [updatedRows, refreshedLeads] = await database.batch([
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
            eq(leadDeliveryOutbox.leaseToken, leaseToken)
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
    const [updatedRows, refreshedLeads] = await database.batch([
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
            eq(leadDeliveryOutbox.leaseToken, leaseToken)
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
    const [updatedRows, refreshedLeads] = await database.batch([
      database
        .update(leadDeliveryOutbox)
        .set({
          status: "dead_letter",
          deadLetteredAt: now,
          lastErrorCode: input.errorCode,
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(leadDeliveryOutbox.id, outboxId),
            eq(leadDeliveryOutbox.status, "processing"),
            eq(leadDeliveryOutbox.leaseToken, leaseToken)
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
    const candidates = database
      .select({ id: leadSubmissions.id })
      .from(leadSubmissions)
      .where(
        and(
          isNull(leadSubmissions.redactedAt),
          lte(leadSubmissions.redactAfter, cutoff)
        )
      )
      .orderBy(asc(leadSubmissions.redactAfter))
      .limit(Math.max(1, Math.min(limit, 5_000)))
      .for("update", { skipLocked: true })

    const redacted = await database
      .update(leadSubmissions)
      .set({
        requestFingerprint: null,
        name: null,
        company: null,
        email: null,
        normalizedEmail: null,
        role: null,
        buyerType: null,
        siteType: null,
        timeline: null,
        constraints: null,
        message: null,
        source: null,
        ipHash: null,
        turnstileHostname: null,
        turnstileAction: null,
        turnstileChallengeAt: null,
        redactedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(sql`${leadSubmissions.id} IN (${candidates})`)
      .returning({ id: leadSubmissions.id })

    return redacted.map(({ id }) => id)
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
    markOutboxDelivered,
    rescheduleOutbox,
    markOutboxDeadLetter,
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
