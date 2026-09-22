import type { LeadIntent } from "@/types/site"

// Public placement identifiers, never arbitrary query values or visitor data.
export const leadSources = [
  "contact-page", "assessment-page", "assessment-hero", "assessment-final", "header", "footer",
  "home-hero", "home-final", "home-sample", "home-decision-brief", "proof-operating-hero", "roi-page",
  "demo-hero", "demo-final", "demo-inspection-room", "assessment-explorer", "decision-brief",
  "platform-hero", "platform-final", "dispatch-envelope-hero", "dispatch-envelope-final",
  "proof-hero", "proof-final", "proof-page", "proof-pack-hero", "proof-pack-sample", "proof-pack-final",
  "about-hero", "about-mission", "about-final", "ai-cloud-page", "colocation-page",
  "bridge-power-hero", "bridge-power-final", "bridge-power-page", "dcii-hero", "dcii-source-note", "dcii-final",
  "why-gridninja-contextual", "why-gridninja-final", "why-gridninja-persona-operator",
  "why-gridninja-persona-ciso", "why-gridninja-persona-utility", "why-gridninja-persona-ai-cloud",
  "why-gridninja-persona-investor", "why-gridninja-persona-partner", "evidence-resource",
  "insights-hub", "evidence-hub", "methodology-hub",
  "gridninja-insights-hub", "gridninja-evidence-hub", "gridninja-methodology-hub",
  "insight-virtual-capacity-control-plane", "insight-proof-adjusted-data-center-capacity",
  "insight-runtime-assurance-ai-data-centers", "insight-data-center-shadow-mode",
  "insight-cross-domain-capacity-constraints", "insight-safe-data-center-grid-flexibility",
  "insight-ai-data-center-time-to-power", "evidence-virtual-capacity-proof-test",
  "evidence-sample-rta-trace", "evidence-accepted-headroom-ledger", "evidence-load-passport-specification",
  "methodology-claims-and-evidence", "methodology-comparison-policy", "methodology-editorial-corrections",
  "methodology-capacity-audit", "staging-canary", "e2e-autofill",
] as const

export type LeadSource = (typeof leadSources)[number]

export function isLeadSource(value: string): value is LeadSource {
  return (leadSources as readonly string[]).includes(value)
}

export function buildLeadHref(
  intent: LeadIntent,
  source: string,
  context?: Record<string, string | undefined>
) {
  const params = new URLSearchParams({
    intent,
    source,
  })

  Object.entries(context ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value)
    }
  })

  return `/contact?${params.toString()}`
}

export function getFirstQueryValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}
