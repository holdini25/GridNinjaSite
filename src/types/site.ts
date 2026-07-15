export type LeadIntent =
  | "capacity-audit"
  | "shadow-mode"
  | "sellable-capacity"
  | "partnership"
  | "book-demo"
  | "dcii-memo"
  | "load-passport"
  | "other"

export interface SectionCopy {
  eyebrow?: string
  headline: string
  body: string
}

export interface StatItem {
  label: string
  value?: string
  claimId: string
  body: string
  annotation?: string
}

export interface ComparisonRow {
  name: string
  bullets: string[]
  emphasis?: boolean
}

export interface SolutionPageConfig {
  slug: "ai-cloud" | "colocation"
  path: "/solutions/ai-cloud" | "/solutions/colocation"
  hero: SectionCopy
  whyThisMatters: string
  buyerAnxiety: string
  artifact: string
  caveat: string
  stakeholderProof: string[]
  painPoints: string[]
  outcomes: string[]
  metrics: StatItem[]
  ctaLabel: string
  ctaSource: string
}

export interface LeadSubmission {
  name: string
  company: string
  role?: string
  email: string
  buyerType?: string
  siteType?: string
  timeline?: string
  constraints?: string[]
  message?: string
  capacityRange?: string
  intent: LeadIntent
  source: string
}
