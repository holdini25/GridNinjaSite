import type { SectionCopy } from "@/types/site"

export const proofPackHero: SectionCopy = {
  eyebrow: "Sample Proof Pack",
  headline: "Review the proof objects before a live review",
  body: "Inspect the evidence package behind Shadow Mode, Load Passports, capacity waterfalls, RTA traces, reserve-floor reports, and no-proof gaps before the first operator session.",
}

export const proofPackDownloadHref = "/downloads/sample-proof-pack"

export const proofPackIncludes = [
  "AI Data Center Load Passport",
  "Capacity Waterfall",
  "RTA Allow / Repair / Reject / No-Proof Trace",
  "Reserve-Floor Report",
  "No-Proof Gap Register",
  "Utility Evidence Packet",
]

export const proofPackChecklist = [
  "Binding constraint, remaining margin, and reason code are visible.",
  "The action bundle is written in operator language, not model jargon.",
  "No-proof gaps are treated as safety outcomes, not hidden uncertainty.",
  "Replay, rollback, and audit evidence are readable without a dashboard.",
]

export const proofPackPreview = [
  { label: "Scope", value: "Shadow Mode baseline and Load Passport" },
  { label: "Decision path", value: "Allow, repair, reject, no-proof" },
  { label: "Evidence", value: "Waterfall, ledger, reserve floor, utility packet" },
]

export const proofPackSampleLog = [
  { label: "14:05:12", value: "REPAIR Cluster cap reduced 4%", claimId: "proof-pack-repair-log" },
  { label: "Reason", value: "PCC margin projected below threshold" },
  { label: "Constraint", value: "Feeder thermal envelope" },
  { label: "Margin", value: "+3.2%", claimId: "proof-pack-margin-log" },
  { label: "SLA impact", value: "None predicted" },
  { label: "Proof posture", value: "Accepted after repair, not autonomous approval" },
]

export const proofPackFinalCta: SectionCopy = {
  eyebrow: "Review",
  headline: "Use the sample pack to decide whether the site is ready for Shadow Mode",
  body: "If the artifact structure is useful, request a Capacity Audit, inspect the demo flow, or request a Load Passport sample mapped to your stakeholder question.",
}
