import type { SectionCopy } from "@/types/site"

export const contactHero: SectionCopy = {
  eyebrow: "Capacity assessment",
  headline: "Tell us where capacity is constrained.",
  body: "Share the operating decision, site constraint, or proof gap in front of your team. GridNinja will determine the safest evidence path—from a read-only Capacity Audit to Shadow Mode.",
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
    body: "We identify the required telemetry, constraints and visible no-proof gaps.",
  },
  {
    title: "Scoped next step",
    body: "We recommend a Capacity Audit, Shadow Mode evaluation or partner workflow.",
  },
] as const
