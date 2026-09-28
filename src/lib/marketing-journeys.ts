import { assessmentSelectionHref } from "@/lib/assessment/selectors"
import { ASSESSMENT_PUBLICATION_VERSION, DEFAULT_ASSESSMENT_SCENARIO } from "@/content/assessments/constants"
import type { LeadSource } from "@/lib/lead"
import type { PublicTopic } from "@/lib/public-topic"

/** Only public, editable context crosses a marketing link. */
export function assessmentScopeHref(source?: LeadSource, topic?: PublicTopic) {
  const query = new URLSearchParams()
  if (source) query.set("source", source)
  if (topic) query.set("topic", topic)
  return `/assessment${query.size ? `?${query}` : ""}#scope`
}

export function sampleBriefHref(topic?: PublicTopic) {
  const href = assessmentSelectionHref({ status: "ready", scenario: DEFAULT_ASSESSMENT_SCENARIO, version: ASSESSMENT_PUBLICATION_VERSION, perspective: "business" })
  if (!topic) return href
  const url = new URL(href, "https://gridninja.invalid")
  url.searchParams.set("topic", topic)
  return `${url.pathname}${url.search}${url.hash}`
}

export const decisionPageJourney: Partial<Record<string, { source?: LeadSource; topic?: PublicTopic }>> = {
  "/platform": { source: "platform-hero" },
  "/proof": { source: "proof-hero" },
  "/proof/proof-pack": { source: "proof-pack-hero" },
  "/about": { source: "about-hero" },
  "/why-gridninja": { source: "why-gridninja-contextual" },
  "/solutions/ai-cloud": { source: "ai-cloud-page", topic: "ai-cloud" },
  "/solutions/colocation": { source: "colocation-page", topic: "colocation" },
  "/solutions/bridge-power": { source: "bridge-power-page", topic: "power" },
  "/dcii": { source: "dcii-hero" },
}
