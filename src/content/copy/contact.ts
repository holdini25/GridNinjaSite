import type { SectionCopy } from "@/types/site"

export const contactHero: SectionCopy = {
  eyebrow: "Capacity assessment",
  headline: "Tell us where capacity is constrained.",
  body: "Tell us about the capacity decision your team is facing. We will discuss whether an assessment can help, what historical inputs are available, and the work and price to agree before starting.",
}

export const contactTrustCommitments = [
  "Historical inputs, by agreement",
  "No control credentials required",
  "Scope and permissions agreed first",
  "Keep operational data out of this form",
] as const

export const contactNextSteps = [
  {
    title: "Review your inquiry",
    body: "We review your capacity question and whether an assessment could help.",
  },
  {
    title: "Confirm the inputs",
    body: "We discuss the historical inputs available, permission to share them, and gaps that could limit the assessment.",
  },
  {
    title: "Agree the scope",
    body: "If there is a fit, we agree the deliverables, review rounds, schedule and price before work begins.",
  },
] as const
