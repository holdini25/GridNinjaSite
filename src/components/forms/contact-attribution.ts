import {
  contactConversationTypes,
  leadIntents,
  type ContactConversationType,
} from "@/lib/constants"
import type { LeadIntent } from "@/types/site"

const approvedContactSources = new Set([
  "contact-page",
  "header",
  "footer",
  "staging-canary",
  "e2e-autofill",
])

export const contactSubmissionStorageKey = "gridninja.contactSubmission"

export type ContactAttribution = {
  intent: LeadIntent
  conversationType: ContactConversationType
  source: string
}

export function resolveContactAttribution(search: string): ContactAttribution {
  const query = new URLSearchParams(search)
  const requestedIntent = query.get("intent")
  const requestedSource = query.get("source")
  const intent = isLeadIntent(requestedIntent)
    ? requestedIntent
    : "capacity-audit"

  return {
    intent,
    conversationType: conversationTypeForIntent(intent),
    source:
      requestedSource && approvedContactSources.has(requestedSource)
        ? requestedSource
        : "contact-page",
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
