import { resolvePublicTopic, type PublicTopic } from "@/lib/public-topic"
import {
  contactConversationTypes,
  leadIntents,
  type ContactConversationType,
} from "@/lib/constants"
import type { LeadIntent } from "@/types/site"
import { isLeadSource } from "@/lib/lead"

export const contactSubmissionStorageKey = "gridninja.contactSubmission"

export type ContactAttribution = {
  intent: LeadIntent
  conversationType: ContactConversationType
  source: string
  topic?: PublicTopic
}

export function resolveContactAttribution(
  search: string,
  defaults: { intent?: LeadIntent; source?: string; topic?: PublicTopic } = {}
): ContactAttribution {
  const query = new URLSearchParams(search)
  const requestedIntent = query.get("intent")
  const requestedSource = query.get("source")
  const intent = isLeadIntent(requestedIntent)
    ? requestedIntent
    : defaults.intent ?? "capacity-audit"

  return {
    intent,
    topic: query.has("topic") ? resolvePublicTopic(query.getAll("topic").length === 1 ? query.get("topic") : undefined) : defaults.topic,
    conversationType: conversationTypeForIntent(intent),
    source:
      requestedSource && isLeadSource(requestedSource)
        ? requestedSource
        : defaults.source && isLeadSource(defaults.source) ? defaults.source : "contact-page",
  }
}

export function conversationTypeForIntent(
  intent: LeadIntent
): ContactConversationType {
  if (intent === "capacity-audit" || intent === "sellable-capacity") {
    return "capacity-audit"
  }

  if (intent === "shadow-mode" || intent === "partnership") {
    return intent
  }

  return "other"
}

export function intentAfterConversationSelection(
  conversationType: ContactConversationType
): LeadIntent {
  return conversationType
}

function isLeadIntent(value: string | null): value is LeadIntent {
  return Boolean(value && (leadIntents as readonly string[]).includes(value))
}

export function isContactConversationType(
  value: string
): value is ContactConversationType {
  return (contactConversationTypes as readonly string[]).includes(value)
}
