import "server-only"

import type { LeadDeliveryContext } from "@/server/leads/repository"
import {
  claimNextDueOutbox,
  claimOutboxById,
  deleteExpiredLeads,
  getOldestDueOutboxAge,
  listDueOrLeaseExpiredOutbox,
  markOutboxDeadLetter,
  markOutboxDelivered,
  isOutboxSendAllowed,
  isOutboxAlertAllowed,
  markTerminalAlertPublished,
  TERMINAL_ALERT_PREFIX,
  redactExpiredLeads,
  rescheduleOutbox,
} from "@/server/leads/repository"

import type {
  ClaimedDelivery,
  DeliveryOperationsRepository,
} from "@/lib/contact/operations"

export const deliveryOperationsRepository: DeliveryOperationsRepository = {
  async claimNextDueOutbox(now, leaseMs) {
    return mapClaim(await claimNextDueOutbox(now, leaseMs))
  },
  async claimOutboxById(id, now, leaseMs) {
    return mapClaim(await claimOutboxById(id, now, leaseMs))
  },
  isOutboxSendAllowed,
  isOutboxAlertAllowed,
  markTerminalAlertPublished,
  async markOutboxDelivered(id, leaseToken, providerMessageId) {
    const result = await markOutboxDelivered(
      id,
      leaseToken,
      providerMessageId
    )
    return result.updated
  },
  async rescheduleOutbox(id, leaseToken, update) {
    const result = await rescheduleOutbox(id, leaseToken, update)
    return result.updated
  },
  async markOutboxDeadLetter(id, leaseToken, update, now) {
    const result = await markOutboxDeadLetter(id, leaseToken, update, now)
    return result.updated
  },
  async getOldestDueOutboxAge(now) {
    const oldest = await getOldestDueOutboxAge(now)
    return oldest?.ageMs ?? null
  },
  async listDueOrLeaseExpiredOutbox(now, limit) {
    return listDueOrLeaseExpiredOutbox(now, limit)
  },
  async redactExpiredLeads(cutoff, limit) {
    return (await redactExpiredLeads(cutoff, limit)).length
  },
  async deleteExpiredLeads(cutoff, limit) {
    return (await deleteExpiredLeads(cutoff, limit)).length
  },
}

export function mapClaim(context: LeadDeliveryContext | null): ClaimedDelivery | null {
  if (!context) return null

  const { delivery, lead } = context

  if (!delivery.leaseToken) {
    throw new Error("ClaimedDeliveryMissingLeaseToken")
  }

  const lease = {
    id: delivery.id, leadId: delivery.leadId, channel: delivery.channel,
    attemptCount: delivery.attemptCount, leaseToken: delivery.leaseToken,
    idempotencyKey: delivery.idempotencyKey,
  }
  if (delivery.status === "dead_letter") {
    if (!delivery.deadLetteredAt || !delivery.lastErrorCode?.startsWith(TERMINAL_ALERT_PREFIX)) throw new Error("ClaimedDeliveryMissingTerminalAlert")
    return { kind: "alert", delivery: lease, errorCode: delivery.lastErrorCode.slice(TERMINAL_ALERT_PREFIX.length), terminalAt: delivery.deadLetteredAt }
  }

  if (
    !lead.name ||
    !lead.company ||
    !lead.email ||
    !lead.source
  ) {
    // Retention may commit between the claim statement and context read. It has
    // already invalidated this lease and retired the work; do not poison-retry it.
    if (lead.redactedAt) return null
    throw new Error("ClaimedDeliveryLeadWasRedacted")
  }

  if (
    (lead.schemaVersion !== 1 && lead.schemaVersion !== 2) ||
    (lead.schemaVersion === 2 && lead.formType !== "contact")
  ) {
    throw new Error("ClaimedDeliverySchemaVersionUnsupported")
  }

  if (
    lead.schemaVersion === 1 &&
    (!lead.buyerType || !lead.siteType || !lead.timeline)
  ) {
    throw new Error("ClaimedDeliveryLegacyQualificationMissing")
  }

  return {
    kind: "send",
    delivery: lease,
    lead: {
      id: lead.id,
      schemaVersion: lead.schemaVersion,
      acceptedAt: lead.acceptedAt,
      formType: lead.formType,
      name: lead.name,
      company: lead.company,
      email: lead.email,
      buyerType: lead.buyerType,
      siteType: lead.siteType,
      timeline: lead.timeline,
      capacityRange: lead.capacityRange,
      intent: lead.intent,
      source: lead.source,
      role: lead.role,
      constraints: lead.constraints ?? [],
      message: lead.message,
    },
  }
}
