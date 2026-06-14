import type { SectionCopy } from "@/types/site"

export const proofHero: SectionCopy = {
  eyebrow: "Proof Before Autonomy",
  headline: "Trust starts with boundaries",
  body: "GridNinja begins read-only and keeps authority where operators, CISOs, and utilities expect it. If evidence is stale, incomplete, or outside policy, the correct answer is no-proof.",
}

export const ladderSteps = [
  {
    title: "Shadow Mode",
    body: "Generate recommendations, safety outcomes, and proof artifacts without write credentials or actuation.",
  },
  {
    title: "Advisory Mode",
    body: "Operators review action bundles, no-proof gaps, and Load Passport outputs with real decision context.",
  },
  {
    title: "Bounded Autonomy",
    body: "Enable a narrow actuator set only inside declared dispatch envelopes and runtime assurance checks.",
  },
  {
    title: "Expanded Autonomy",
    body: "Add coordinated multi-asset control as evidence and confidence accumulate.",
  },
]

export const proofArtifacts = [
  "AI Data Center Load Passport",
  "Capacity Waterfall",
  "Accepted-Headroom Ledger",
  "Reserve-Floor Report",
  "No-Proof Gap Register",
  "Utility Evidence Packet",
]

export const proofLog = {
  time: "14:05:12",
  action: "REPAIR",
  summary: "Cluster cap reduced 4%",
  reason: "PCC margin projected below threshold",
  constraint: "feeder thermal envelope",
  margin: "+3.2%",
  impact: "none predicted",
}

export const proofSafetyCopy =
  "GridNinja can operate in monitoring-only Shadow Mode, advisory mode, or bounded autonomy. The first deployment posture is read-only: no write credentials, no command VLAN, no hidden actuation path, and no approval authority delegated to ML, LLMs, frontend state, or fleet-level software."

export const operatorFaqs = [
  {
    question: "Does GridNinja need control access on day one?",
    answer: "No. The first posture is Shadow Mode evidence generation with read-only telemetry and no hidden actuation path.",
  },
  {
    question: "What happens when telemetry is delayed or ambiguous?",
    answer: "The result is no-proof until freshness, topology, or policy evidence is strong enough to support a safe answer.",
  },
  {
    question: "Can Fleet-level software approve site actions?",
    answer: "No. Fleet views can aggregate proof objects, but local site policy and operator authority remain the approval boundary.",
  },
]

export const cisoFaqs = [
  {
    question: "What credentials are required for Shadow Mode?",
    answer: "The intended first deployment uses read-only data paths scoped to explicit telemetry sources and logging boundaries.",
  },
  {
    question: "How are exports handled?",
    answer: "Proof artifacts should be gated, redacted where needed, and traceable to a source, policy, and export event.",
  },
  {
    question: "What is the failure mode?",
    answer: "If trust assumptions break, GridNinja fails closed into no-proof instead of presenting unsafe capacity as accepted.",
  },
]
