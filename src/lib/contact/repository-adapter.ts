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
  async markOutboxDeadLetter(id, leaseToken, update) {
    const result = await markOutboxDeadLetter(id, leaseToken, update)
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

function mapClaim(context: LeadDeliveryContext | null): ClaimedDelivery | null {
  if (!context) return null

  const { delivery, lead } = context

  if (!delivery.leaseToken) {
    throw new Error("ClaimedDeliveryMissingLeaseToken")
  }

  if (
    !lead.name ||
    !lead.company ||
    !lead.email ||
    !lead.buyerType ||
    !lead.siteType ||
    !lead.timeline ||
    !lead.source
  ) {
    throw new Error("ClaimedDeliveryLeadWasRedacted")
  }

  return {
    delivery: {
      id: delivery.id,
      leadId: delivery.leadId,
      channel: delivery.channel,
      attemptCount: delivery.attemptCount,
      leaseToken: delivery.leaseToken,
      idempotencyKey: delivery.idempotencyKey,
    },
    lead: {
      id: lead.id,
      acceptedAt: lead.acceptedAt,
      formType: lead.formType,
      name: lead.name,
      company: lead.company,
      email: lead.email,
      buyerType: lead.buyerType,
      siteType: lead.siteType,
      timeline: lead.timeline,
      intent: lead.intent,
      source: lead.source,
      role: lead.role,
      constraints: lead.constraints ?? [],
      message: lead.message,
    },
  }
}
