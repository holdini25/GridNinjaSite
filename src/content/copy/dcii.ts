import type { SectionCopy } from "@/types/site"

export const dciiHero: SectionCopy = {
  eyebrow: "DCII Project",
  headline: "Read-only validation for proof-backed AI data center capacity",
  body: "GridNinja's DCII project would validate safe, usable, auditable virtual capacity inside AI data centers without asking operators to trust hidden actuation or black-box autonomy.",
}

export const dciiSummary: SectionCopy = {
  eyebrow: "Project summary",
  headline: "A deployment-focused proof layer for constrained AI infrastructure",
  body: "The project starts in Shadow Mode, maps site telemetry and topology into declared policy, runs candidate capacity actions through deterministic checks and runtime assurance, and exports proof artifacts that operators, utilities, partners, and reviewers can inspect.",
}

export const dciiFundingCopy =
  "Elemental's public DCII page currently describes $500k to $5M of funding per project for deployments that can be integrated into data center environments. GridNinja copy should use that current public range, not stale single-award language."

export const dciiEvidenceOutputs = [
  "AI Data Center Load Passport",
  "Capacity Waterfall",
  "Accepted-Headroom Ledger",
  "Reserve-Floor Report",
  "No-Proof Gap Register",
  "Utility Evidence Packet",
]

export const dciiMilestones = [
  {
    phase: "Security and site scoping",
    timing: "Months 1-2",
    output: "Read-only boundary, telemetry map, role model, and proof schema.",
  },
  {
    phase: "Shadow integration",
    timing: "Months 2-4",
    output: "Topology model, baseline telemetry confidence, and first constraint map.",
  },
  {
    phase: "Proof artifact v1",
    timing: "Months 4-7",
    output: "Capacity Waterfall, Load Passport, reserve-floor report, and no-proof trace.",
  },
  {
    phase: "Scenario validation",
    timing: "Months 7-10",
    output: "Electrical, reserve, cooling, workload, and telemetry-confidence replay results.",
  },
  {
    phase: "Stakeholder evidence packets",
    timing: "Months 10-13",
    output: "Operator review package, utility packet, and partner validation summary.",
  },
  {
    phase: "Commercial readiness",
    timing: "Months 13-18",
    output: "Deployment learnings, risk register, design-partner criteria, and final memo.",
  },
]

export const dciiRisks = [
  {
    risk: "Operators fear hidden control risk",
    mitigation: "Lead with read-only Shadow Mode, no write credentials, no command VLAN, and explicit authority boundaries.",
  },
  {
    risk: "Software perceived as weak infrastructure fit",
    mitigation: "Tie outputs to reserve floors, bridge power, cooling constraints, ramp envelopes, and utility evidence packets.",
  },
  {
    risk: "Impact claims get challenged",
    mitigation: "Publish measured scenarios and methodology only; do not guarantee emissions, water, or avoided-overbuild outcomes.",
  },
  {
    risk: "Demo feels hypothetical",
    mitigation: "Label sample data clearly and show artifact structures that match what a live Capacity Audit would produce.",
  },
]

export const dciiSourceNotes = [
  {
    label: "Elemental DCII",
    href: "https://elementalimpact.com/data-center-innovation-initiative/",
    detail: "Use current public funding and deployment language.",
  },
  {
    label: "DOE / LBNL data center energy demand",
    href: "https://www.energy.gov/articles/doe-releases-new-report-evaluating-increase-electricity-demand-data-centers",
    detail: "Use only for sourced market context.",
  },
  {
    label: "NERC computational-load alert",
    href: "https://www.nerc.com/globalassets/programs/bpsa/alerts/level-3-computational-load-alert.pdf",
    detail: "Use for computational-load reliability context.",
  },
  {
    label: "EPRI DCFlex",
    href: "https://dcflex.epri.com/",
    detail: "Use for large-load flexibility framework context.",
  },
  {
    label: "Google 1 GW demand response",
    href: "https://blog.google/innovation-and-ai/infrastructure-and-cloud/global-network/demand-response-data-center-milestone/",
    detail: "Use as market signal, not as a GridNinja partnership claim.",
  },
]
