import type { SectionCopy } from "@/types/site"

export const contactHero: SectionCopy = {
  eyebrow: "Capacity assessment",
  headline: "Tell us where capacity is constrained.",
  body: "Share the capacity decision in front of your team. Scoping establishes fit, authorized historical inputs, deliverables and price for one bounded paid assessment.",
}

export const contactTrustCommitments = [
  "Read-only first",
  "No control credentials required",
  "Evidence defined before authority",
  "No confidential topology submitted through this form",
] as const

export const contactNextSteps = [
  {
    title: "Review",
    body: "GridNinja assesses the operating decision and engagement fit.",
  },
  {
    title: "Evidence map",
    body: "We identify the authorized historical inputs, constraints, permission roles and unresolved evidence gaps.",
  },
  {
    title: "Scoped next step",
    body: "If there is a fit, agree the decision boundary, deliverables, review rounds and price before a paid assessment begins.",
  },
] as const
