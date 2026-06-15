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
  "GridNinja is seeking deployment validation funding to support a read-only proof project inside constrained AI data center environments. Funding would support site scoping, telemetry integration, proof artifact development, scenario validation, stakeholder evidence packets, and commercial readiness work."

export const dciiFundingAsk = {
  label: "Funding ask",
  value: "$500k to $5M per project",
  body: "Aligned to current public Elemental DCII program language for deployment projects that can be integrated into data center environments. The final scope should be calibrated to site access, integration depth, and stakeholder review needs.",
}

export const dciiEvidenceOutputs = [
  "AI Data Center Load Passport",
  "Capacity Waterfall",
  "Accepted-Headroom Ledger",
  "Reserve-Floor Report",
  "No-Proof Gap Register",
  "Utility Evidence Packet",
]

export const dciiUseOfFunds = [
  {
    category: "Site scoping and security review",
    output: "Read-only boundary, stakeholder map, data-access plan, and no-write deployment posture.",
  },
  {
    category: "Read-only telemetry integration",
    output: "Connector manifest across power, cooling, workload, reserve, bridge-power, and topology sources.",
  },
  {
    category: "Capacity Waterfall and Load Passport",
    output: "Proof-adjusted virtual capacity artifacts with binding constraints and no-proof gaps visible.",
  },
  {
    category: "Runtime assurance and replay validation",
    output: "Allow / repair / reject / no-proof traces, proof roots, and repeatable scenario replay package.",
  },
  {
    category: "Utility / EMC evidence packet",
    output: "Planning-facing dispatch envelope, ramp limits, caveats, and exception table.",
  },
  {
    category: "Operator review package",
    output: "CISO/operator review notes, evidence tables, and commercial readiness summary.",
  },
]

export const dciiEvidenceClasses = [
  {
    className: "Technical data",
    output: "Telemetry completeness, constraint map, replay traces, RTA outcomes.",
  },
  {
    className: "Operational data",
    output: "Operator review time, no-proof gaps, policy exceptions, workload and cooling constraints.",
  },
  {
    className: "Commercial data",
    output: "Proof-adjusted MW, accepted-headroom ledger, design-partner conversion criteria.",
  },
  {
    className: "Impact data",
    output: "Grid-readiness posture, dispatch envelope, local reliability support potential.",
  },
]

export const dciiBenefits = [
  "Helps operators evaluate safe sellable MW without granting write credentials.",
  "Gives utilities and energy partners a clearer evidence packet for flexible-load conversations.",
  "Supports local reliability planning by making reserve floors, ramp limits, and no-proof gaps explicit.",
  "Keeps emissions, water, and interconnection claims measured and caveated instead of guaranteed.",
]

export const dciiCategoryFit = [
  {
    title: "Energy Storage & Power Infrastructure fit",
    body: "GridNinja ties virtual capacity to reserve floors, bridge power, UPS/BESS posture, and ramp envelopes so software proof supports infrastructure deployment rather than replacing it.",
  },
  {
    title: "Cooling and water fit",
    body: "Cooling and water intervals are treated as binding constraints inside the Capacity Waterfall, not as sustainability claims or generic optimization wins.",
  },
  {
    title: "Why read-only software belongs",
    body: "The project produces the evidence layer needed before operators, utilities, or infrastructure partners trust flexible MW from constrained AI sites.",
  },
]

export const dciiPublicPrivateBoundaries = [
  {
    label: "Public",
    body: "Project scope, read-only boundary, artifact types, source notes, methodology summary, and non-confidential findings.",
  },
  {
    label: "Private / gated",
    body: "Site topology, security-sensitive telemetry, customer data, exact operating limits, and reviewer-specific evidence packets.",
  },
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
    detail: "Current public DCII program context and funding range.",
  },
  {
    label: "DOE / LBNL data center energy demand",
    href: "https://www.energy.gov/articles/doe-releases-new-report-evaluating-increase-electricity-demand-data-centers",
    detail: "Market context for data center electricity demand growth.",
  },
  {
    label: "NERC computational-load alert",
    href: "https://www.nerc.com/globalassets/programs/bpsa/alerts/level-3-computational-load-alert.pdf",
    detail: "Reliability context for large computational loads.",
  },
  {
    label: "EPRI DCFlex",
    href: "https://dcflex.epri.com/",
    detail: "Large-load flexibility framework context.",
  },
  {
    label: "Google 1 GW demand response",
    href: "https://blog.google/innovation-and-ai/infrastructure-and-cloud/global-network/demand-response-data-center-milestone/",
    detail: "Market signal for data center demand-response participation, not a GridNinja partnership claim.",
  },
]
