import type { RtaDecisionState } from "@/content/proof-artifacts"
import type { SectionCopy } from "@/types/site"

export type WhyGridNinjaMaturity =
  | "DESIGN TARGET"
  | "IMPLEMENTED"
  | "REPLAY-VALIDATED"
  | "SHADOW-VALIDATED"
  | "OPERATOR-ACCEPTED"
  | "THIRD-PARTY-VALIDATED"
  | "PLANNED"

export type WhyGridNinjaMaturityFilter =
  | "all"
  | "validated"
  | "operator"
  | "design"
  | "planned"

export type WhyGridNinjaMaturityEvidence = {
  maturity: WhyGridNinjaMaturity
  scope: string
  validationMethod: string
  scenario: string
  lastValidated: string
  artifact: string
  knownLimitation: string
}

export type WhyGridNinjaSourceRecord = {
  id: string
  organization: string
  title: string
  sourceType: string
  url: string
  retrievalDate: string
  officialClaim: string
  establishes: string
  doesNotEstablish: string
  gridNinjaInterpretation: string
  confidence: "High" | "Medium"
}

export type WhyGridNinjaProofRequirement = {
  id: string
  label: string
  shortLabel: string
  buyerQuestion: string
  whyItMatters: string
  weakAnswer: string
  strongAnswer: string
  artifact: string
  maturity: WhyGridNinjaMaturity
  caveat: string
}

export type WhyGridNinjaComparisonCell = {
  label: string
  tone: "core" | "documented" | "varies" | "target" | "input"
  sourceIds?: string[]
}

export type WhyGridNinjaComparisonRow = {
  capability: string
  dcim: WhyGridNinjaComparisonCell
  digitalTwin: WhyGridNinjaComparisonCell
  aiOps: WhyGridNinjaComparisonCell
  gridFlex: WhyGridNinjaComparisonCell
  gridNinja: WhyGridNinjaComparisonCell
}

export type WhyGridNinjaResponsibilityStageId =
  | "observe"
  | "model"
  | "propose"
  | "verify"
  | "rta"
  | "account"
  | "prove"

export type WhyGridNinjaCompetitorClaimKind =
  | "public-materials"
  | "shared-terrain"
  | "gridninja-responsibility"
  | "proof-threshold"

export type WhyGridNinjaCompetitorClaim = {
  eyebrow: string
  body: string
  kind: WhyGridNinjaCompetitorClaimKind
  sourceIds: readonly string[]
}

export type WhyGridNinjaCompetitorProfile = {
  id: string
  name: string
  category: string
  summary: string
  tags: readonly string[]
  claims: {
    publicMaterials: WhyGridNinjaCompetitorClaim
    sharedTerrain: WhyGridNinjaCompetitorClaim
    gridNinjaResponsibility: WhyGridNinjaCompetitorClaim
    proofThreshold: WhyGridNinjaCompetitorClaim
  }
  responsibilityMap: {
    profile: readonly WhyGridNinjaResponsibilityStageId[]
    shared: readonly WhyGridNinjaResponsibilityStageId[]
    gridNinja: readonly WhyGridNinjaResponsibilityStageId[]
  }
}

export type WhyGridNinjaScenario = {
  id: string
  label: string
  request: string
  withoutRows: string[]
  withRows: Array<{ label: string; value: string; state: RtaDecisionState }>
  acceptedEnvelope: string
  artifacts: string[]
}

export type WhyGridNinjaPersona = {
  id: string
  label: string
  lead: string
  points: string[]
  ctaSource: string
}

export const whyGridNinjaHero: SectionCopy & {
  primaryCtaLabel: string
  secondaryCtaLabel: string
} = {
  eyebrow: "The capacity-acceptance layer",
  headline: "Before you trust another megawatt, ask what proves it.",
  body: "GridNinja sits between a capacity claim and operator acceptance. It tests the claim against electrical, cooling, storage, workload, water, telemetry, and policy constraints, then returns allow, repair, reject, or no-proof with replayable evidence.",
  primaryCtaLabel: "Run the 10-point proof test",
  secondaryCtaLabel: "Inspect a sample proof pack",
}

export const whyGridNinjaChapters = [
  { id: "thesis", label: "Thesis" },
  { id: "roles", label: "Market roles" },
  { id: "acceptance-boundary", label: "Acceptance" },
  { id: "proof-standard", label: "Proof test" },
  { id: "comparison", label: "Comparison" },
  { id: "competitors", label: "Competitors" },
  { id: "proof-room", label: "Proof room" },
  { id: "site-specific-proof", label: "Capacity Audit" },
] as const

export const whyGridNinjaTrustItems = [
  "Read-only first",
  "No command VLAN",
  "No write credentials",
  "Four-state runtime assurance",
  "Replayable evidence",
] as const

export const whyGridNinjaRoleCards = [
  {
    code: "DC",
    title: "DCIM",
    body: "Observe, inventory, plan, model, and monitor infrastructure.",
    output: "Site context",
    gridNinjaUse: "Constraint and topology input.",
  },
  {
    code: "DT",
    title: "Digital Twin",
    body: "Simulate designs, operating conditions, and what-if scenarios.",
    output: "Modeled possibility",
    gridNinjaUse: "Scenario and design input.",
  },
  {
    code: "AI",
    title: "AI Operations",
    body: "Tune cooling, power, workloads, reliability, and efficiency.",
    output: "Optimized proposal",
    gridNinjaUse: "Candidate action input.",
  },
  {
    code: "HW",
    title: "Hardware Systems",
    body: "Monitor and manage UPS, distribution, cooling, and equipment state.",
    output: "Device state",
    gridNinjaUse: "Telemetry and reserve input.",
  },
  {
    code: "GF",
    title: "Grid Flexibility",
    body: "Connect data-center demand, on-site energy, and grid needs.",
    output: "Flexibility request",
    gridNinjaUse: "External request input.",
  },
  {
    code: "AG",
    title: "Aggregators",
    body: "Provide program access, dispatch operations, and settlement paths.",
    output: "Market signal",
    gridNinjaUse: "Partner interface input.",
  },
] as const

export const whyGridNinjaBoundary = {
  inputs: [
    "DCIM capacity and topology",
    "BMS / EPMS telemetry",
    "Digital-twin outputs",
    "UPS / BESS state",
    "Cooling and water state",
    "Workload scheduler",
    "Grid or aggregator request",
    "Operator policy",
  ],
  logic: [
    "Telemetry quality gate",
    "Topology and constraint model",
    "Deterministic verification",
    "Runtime assurance",
    "Operator policy enforcement",
    "Receipt validation",
    "Replay eligibility",
    "No-proof discipline",
  ],
  outputs: [
    "Proof-adjusted MW",
    "Dispatch envelope",
    "Accepted-headroom ledger",
    "No-proof gap register",
    "AI Factory Load Passport",
    "Safe reconnection envelope",
    "Utility evidence packet",
    "Proof pack",
  ],
}

export const whyGridNinjaProofRequirements: WhyGridNinjaProofRequirement[] = [
  {
    id: "shadow-mode",
    label: "Read-only Shadow Mode",
    shortLabel: "Shadow Mode",
    buyerQuestion: "Can the system demonstrate decisions without live authority?",
    whyItMatters: "The first proof posture should not require write credentials, command VLAN access, or hidden actuation.",
    weakAnswer: "A sandbox demo disconnected from real site telemetry.",
    strongAnswer: "A productized, read-only deployment using current telemetry, topology, and policy with no command credentials.",
    artifact: "shadow_decision_tape.jsonl",
    maturity: "IMPLEMENTED",
    caveat: "Evidence maturity applies to the defined Shadow Mode implementation and scenario, not every possible site topology.",
  },
  {
    id: "four-state-rta",
    label: "Four-state runtime assurance",
    shortLabel: "Four-state RTA",
    buyerQuestion: "Can the system allow, repair, reject, and explicitly return no-proof?",
    whyItMatters: "Capacity software needs a safe unknown state instead of forcing every request into yes or no.",
    weakAnswer: "A binary confidence score or generic recommendation.",
    strongAnswer: "A versioned decision contract with reason codes, margins, repairs, and an explicit unknown-evidence state.",
    artifact: "rta_trace.csv",
    maturity: "REPLAY-VALIDATED",
    caveat: "Replay validation shows decision repeatability for eligible inputs; live authority still requires operator approval.",
  },
  {
    id: "binding-constraints",
    label: "Binding-constraint traceability",
    shortLabel: "Binding constraints",
    buyerQuestion: "Can it identify the exact limiting constraint and post-action margin?",
    whyItMatters: "A sellable MW number is not credible unless operators can see what constraint made it safe or unsafe.",
    weakAnswer: "A global risk score without the binding physical cause.",
    strongAnswer: "Constraint identity, source freshness, threshold, margin, repair, and post-action state.",
    artifact: "binding_constraint_trace.json",
    maturity: "REPLAY-VALIDATED",
    caveat: "Constraint names and thresholds must be mapped per site before results become operator-reviewable.",
  },
  {
    id: "cross-domain-checks",
    label: "Cross-domain constraints",
    shortLabel: "Cross-domain checks",
    buyerQuestion: "Does it evaluate power, cooling, storage, workload, water, policy, and telemetry together?",
    whyItMatters: "The limiting constraint can move across subsystems as workloads, thermal state, and reserve posture change.",
    weakAnswer: "Separate dashboards with manual reconciliation.",
    strongAnswer: "One candidate action checked against each active domain before an envelope is accepted.",
    artifact: "capacity_waterfall.json",
    maturity: "DESIGN TARGET",
    caveat: "The public page should mark cross-domain scope by deployment phase and adapter coverage.",
  },
  {
    id: "mixed-vendor-overlay",
    label: "Mixed-vendor overlay",
    shortLabel: "Mixed-vendor overlay",
    buyerQuestion: "Can the system consume existing infrastructure without forcing a single-vendor estate?",
    whyItMatters: "AI data centers already run mixed DCIM, BMS, EPMS, cooling, storage, and scheduler systems.",
    weakAnswer: "A rip-and-replace controller stack.",
    strongAnswer: "Read-only adapters and topology reconciliation that preserve local authority boundaries.",
    artifact: "connector_manifest.yaml",
    maturity: "IMPLEMENTED",
    caveat: "Adapter readiness must be confirmed for each source system before a Capacity Audit.",
  },
  {
    id: "dispatch-envelope",
    label: "Dispatch envelope",
    shortLabel: "Dispatch envelope",
    buyerQuestion: "Can it state how much flexibility exists, for how long, and under which assumptions?",
    whyItMatters: "Grid, bridge-power, and commercial teams need bounded MW, duration, ramp, rebound, and policy context.",
    weakAnswer: "A single available-capacity number.",
    strongAnswer: "A versioned envelope with MW, duration, ramp limits, reserve floor, rebound behavior, and proof lineage.",
    artifact: "dispatch_envelope.json",
    maturity: "REPLAY-VALIDATED",
    caveat: "Replay-backed envelopes remain advisory until site operators accept the policy and evidence scope.",
  },
  {
    id: "measurement-evidence",
    label: "Measurement evidence",
    shortLabel: "Measurement evidence",
    buyerQuestion: "Can it separate requested, approved, applied, and observed behavior?",
    whyItMatters: "Operators and partners need to distinguish a proposed action from actual measured response.",
    weakAnswer: "A chart that blends planned and observed values.",
    strongAnswer: "Request, decision, receipt, and measurement rows with source freshness and caveats.",
    artifact: "receipt_reconciliation.csv",
    maturity: "IMPLEMENTED",
    caveat: "Measurement confidence depends on telemetry quality and settlement-grade instrumentation.",
  },
  {
    id: "degraded-mode",
    label: "Degraded-mode behavior",
    shortLabel: "Degraded mode",
    buyerQuestion: "What happens under stale telemetry, topology ambiguity, cloud loss, or asset faults?",
    whyItMatters: "The safe answer should degrade into no-proof or repair before an unsafe MW claim becomes accepted.",
    weakAnswer: "A fallback estimate presented like a normal recommendation.",
    strongAnswer: "Explicit no-proof and repair states with reason codes, operator-visible gaps, and replay evidence.",
    artifact: "no_proof_gap_register.json",
    maturity: "REPLAY-VALIDATED",
    caveat: "No-proof behavior is only as strong as the configured trust policy and freshness thresholds.",
  },
  {
    id: "reproducible-replay",
    label: "Reproducible replay",
    shortLabel: "Replay",
    buyerQuestion: "Can eligible inputs reproduce the same decision evidence?",
    whyItMatters: "Auditability depends on showing how a decision was made after the operational moment has passed.",
    weakAnswer: "A screenshot or transient dashboard state.",
    strongAnswer: "Versioned inputs, policy, topology, decision rows, and proof roots that support deterministic replay.",
    artifact: "replay_manifest.json",
    maturity: "REPLAY-VALIDATED",
    caveat: "Replay does not replace external certification or settlement validation where those are required.",
  },
  {
    id: "commercial-proof-pack",
    label: "Commercial proof pack",
    shortLabel: "Proof pack",
    buyerQuestion: "Can operators, utilities, partners, and buyers inspect a usable evidence bundle?",
    whyItMatters: "Virtual capacity becomes commercially useful only when the evidence can move across decision makers.",
    weakAnswer: "A marketing summary with no artifact lineage.",
    strongAnswer: "Human-readable and machine-verifiable artifacts with scope, maturity, dates, hashes, and caveats.",
    artifact: "signed_proof_pack.zip",
    maturity: "IMPLEMENTED",
    caveat: "Public proof packs should redact protected site detail while preserving methodology and evidence class.",
  },
]

export const whyGridNinjaSourceRecords: WhyGridNinjaSourceRecord[] = [
  {
    id: "emerald-home",
    organization: "Emerald AI",
    title: "Emerald AI homepage",
    sourceType: "Official product page",
    url: "https://www.emeraldai.co/",
    retrievalDate: "June 18, 2026",
    officialClaim: "Emerald publicly positions Conductor around AI power flexibility, data center and grid coordination, workload and on-site energy orchestration, and auditable M&V reporting.",
    establishes: "Grid-facing AI flexibility, workload coordination, on-site energy coordination, fleet-level flexibility, and measurement reporting are central public themes.",
    doesNotEstablish: "This source does not establish a GridNinja-style site-local accepted-headroom ledger, four-state RTA contract, or no-proof register.",
    gridNinjaInterpretation: "Treat Emerald as a strong grid-flexibility and orchestration peer; distinguish GridNinja by local acceptance, runtime assurance, and proof lineage.",
    confidence: "High",
  },
  {
    id: "emerald-svp-pilot",
    organization: "Emerald AI / Silicon Valley Power",
    title: "SVP flexible data center pilot announcement",
    sourceType: "Official announcement",
    url: "https://www.emeraldai.co/blog/silicon-valley-power-and-emerald-ai-launch-pilot-to-demonstrate-flexible-data-centers-in-santa-clara",
    retrievalDate: "June 18, 2026",
    officialClaim: "The announcement describes a pilot to demonstrate flexible data center operation in response to utility conditions while protecting AI workload performance.",
    establishes: "Emerald has public utility-pilot positioning around flexible operations, SVP signals, and AI workload performance protection.",
    doesNotEstablish: "The announcement does not define GridNinja's acceptance contract, proof-row model, or no-proof behavior.",
    gridNinjaInterpretation: "Use this as evidence that flexible AI data centers are becoming real; GridNinja must prove the inside-the-fence acceptance layer.",
    confidence: "High",
  },
  {
    id: "phaidra-home",
    organization: "Phaidra",
    title: "Phaidra homepage",
    sourceType: "Official product page",
    url: "https://www.phaidra.ai/",
    retrievalDate: "June 18, 2026",
    officialClaim: "Phaidra positions AI agents for the complex power, cooling, and workload systems that underpin AI factories.",
    establishes: "Power, cooling, workload management, and tokens-per-watt AI factory outcomes are public Phaidra themes.",
    doesNotEstablish: "This source does not describe GridNinja's four-state runtime assurance, accepted-headroom ledger, or proof-pack contract.",
    gridNinjaInterpretation: "Respect Phaidra as an AI factory operations peer; position GridNinja around accepted capacity evidence rather than broad AI operations.",
    confidence: "High",
  },
  {
    id: "phaidra-factory",
    organization: "Phaidra",
    title: "Phaidra Factory product page",
    sourceType: "Official product page",
    url: "https://www.phaidra.ai/products/phaidra-factory",
    retrievalDate: "June 18, 2026",
    officialClaim: "Phaidra Factory materials describe AI agents that prevent thermal spikes and stranded power while improving AI factory operating outcomes.",
    establishes: "Thermal stability, stranded power, compute footprint, time-to-first-token, and integrated AI factory operations are public themes.",
    doesNotEstablish: "The page does not define an accepted-headroom accounting layer or no-proof evidence register.",
    gridNinjaInterpretation: "Use Phaidra as a strong AI-operations comparison; GridNinja still must show proof-adjusted MW and authority boundaries.",
    confidence: "High",
  },
  {
    id: "schneider-etap-ai-factory",
    organization: "Schneider Electric / ETAP / NVIDIA",
    title: "AI Factory power digital twin announcement",
    sourceType: "Official press release",
    url: "https://www.se.com/us/en/about-us/newsroom/news/press-releases/etap-and-schneider-electric-unveil-world%E2%80%99s-first-digital-twin-to-simulate-ai-factory-power-requirements-from-grid-to-chip-level-using-nvidia-omniverse-67d8f1bae06184512a0b9f48/",
    retrievalDate: "June 18, 2026",
    officialClaim: "The announcement describes electrical digital-twin work for AI factory power requirements using ETAP technology and NVIDIA Omniverse.",
    establishes: "Design, simulation, what-if analysis, real-time electrical infrastructure insight, and predictive maintenance are public themes.",
    doesNotEstablish: "It does not establish GridNinja's site-local four-state acceptance contract or accepted-headroom ledger.",
    gridNinjaInterpretation: "Treat digital twins as valuable context inputs; GridNinja's proof authority should remain in runtime acceptance and replay.",
    confidence: "High",
  },
  {
    id: "nvidia-dsx-blueprint",
    organization: "NVIDIA",
    title: "Omniverse DSX Blueprint overview",
    sourceType: "Official documentation",
    url: "https://docs.omniverse.nvidia.com/dsx/latest/index.html",
    retrievalDate: "June 18, 2026",
    officialClaim: "NVIDIA documentation describes an AI Factory digital twin blueprint using OpenUSD, SimReady assets, and real-time power, thermal, and operational simulations.",
    establishes: "Interactive digital twins, thermal/electrical simulations, and design-through-operation workflows are public DSX Blueprint themes.",
    doesNotEstablish: "The docs do not make GridNinja's accepted MW, no-proof, or proof-pack claims.",
    gridNinjaInterpretation: "Digital twin outputs should be inputs to GridNinja's proof path, not the final acceptance authority.",
    confidence: "High",
  },
  {
    id: "sunbird-capacity",
    organization: "Sunbird DCIM",
    title: "Data center capacity management",
    sourceType: "Official product page",
    url: "https://www.sunbirddcim.com/product/data-center-capacity-management",
    retrievalDate: "June 18, 2026",
    officialClaim: "Sunbird public materials emphasize end-to-end capacity visibility, planning, and analysis across power, space, cooling, ports, inventory, and related resources.",
    establishes: "Asset and capacity visibility, 2D/3D planning, and multi-resource analysis are central DCIM themes.",
    doesNotEstablish: "This source does not define a GridNinja-style runtime assurance decision or proof-adjusted dispatch envelope.",
    gridNinjaInterpretation: "Use DCIM as an important system of record and topology input; GridNinja turns claims into accepted envelopes.",
    confidence: "High",
  },
  {
    id: "sunbird-power",
    organization: "Sunbird DCIM",
    title: "Data center power management",
    sourceType: "Official product page",
    url: "https://www.sunbirddcim.com/product/data-center-power-management",
    retrievalDate: "June 18, 2026",
    officialClaim: "Sunbird public materials describe power monitoring, generated single-line diagrams, live readings, and power-chain planning support.",
    establishes: "Power visibility, monitoring, planning, and multi-vendor infrastructure views are public Sunbird themes.",
    doesNotEstablish: "This source does not establish GridNinja's allow / repair / reject / no-proof decision model.",
    gridNinjaInterpretation: "Treat power monitoring as a high-value input into the acceptance boundary, not as the accepted MW contract.",
    confidence: "High",
  },
  {
    id: "gridninja-proof-standard",
    organization: "GridNinja",
    title: "Proof Before Autonomy standard",
    sourceType: "GridNinja public product standard",
    url: "/proof",
    retrievalDate: "July 11, 2026",
    officialClaim: "GridNinja describes a staged proof path built around read-only operation, runtime assurance, replayable evidence, and bounded autonomy.",
    establishes: "GridNinja's stated responsibility is to turn a capacity claim into a policy-bound acceptance decision with evidence, rather than to replace every system that produces an input.",
    doesNotEstablish: "This internal source does not establish a competitor's public capability or validate a GridNinja claim for every site.",
    gridNinjaInterpretation: "Use this source only for GridNinja responsibility and proof-threshold claims, never as evidence about a competitor.",
    confidence: "High",
  },
  {
    id: "enel-x-demand-response",
    organization: "Enel X",
    title: "Demand Response",
    sourceType: "Official product page",
    url: "https://www.enelx.com/uk/en/demand-response",
    retrievalDate: "July 11, 2026",
    officialClaim: "Enel X publicly describes demand-response enrolment, virtual-power-plant participation, real-time dispatch operations, and payment for flexible commercial and industrial energy use.",
    establishes: "Market access, programme enrolment, dispatch operations, flexibility measurement, and commercial value are credible public responsibilities for a demand-response provider.",
    doesNotEstablish: "This representative source does not establish identical capabilities for every market-access provider or a GridNinja-style inside-the-fence acceptance contract.",
    gridNinjaInterpretation: "Treat market access as a partner interface; GridNinja must still verify that a site-side response is feasible, SLA-preserving, and proof-ready before it is offered externally.",
    confidence: "High",
  },
  {
    id: "eaton-brightlayer-dcim",
    organization: "Eaton",
    title: "Brightlayer DCIM software",
    sourceType: "Official product page",
    url: "https://www.eaton.com/us/en-us/digital/brightlayer/brightlayer-data-centers-suite/data-center-performance-management-software.html",
    retrievalDate: "July 11, 2026",
    officialClaim: "Eaton publicly describes Brightlayer DCIM as vendor-neutral monitoring and management for data-center power, space, cooling, and IT and OT infrastructure.",
    establishes: "Critical-infrastructure suites can provide monitoring, management, lifecycle context, capacity visibility, and integration across facility systems.",
    doesNotEstablish: "This representative source does not establish a vendor-neutral GridNinja acceptance layer or equivalent capabilities across every hardware and infrastructure vendor.",
    gridNinjaInterpretation: "Treat hardware and infrastructure suites as essential telemetry and constraint inputs; GridNinja's role is the cross-domain proof-gated decision above them.",
    confidence: "High",
  },
]

export const whyGridNinjaComparisonRows: WhyGridNinjaComparisonRow[] = [
  {
    capability: "Asset and capacity visibility",
    dcim: { label: "CORE", tone: "core", sourceIds: ["sunbird-capacity"] },
    digitalTwin: { label: "DOCUMENTED", tone: "documented", sourceIds: ["nvidia-dsx-blueprint"] },
    aiOps: { label: "ADJACENT", tone: "documented", sourceIds: ["phaidra-home"] },
    gridFlex: { label: "ADJACENT", tone: "documented", sourceIds: ["emerald-home"] },
    gridNinja: { label: "INTEGRATION INPUT", tone: "input" },
  },
  {
    capability: "Design / what-if simulation",
    dcim: { label: "ADJACENT", tone: "documented", sourceIds: ["sunbird-capacity"] },
    digitalTwin: { label: "CORE", tone: "core", sourceIds: ["schneider-etap-ai-factory", "nvidia-dsx-blueprint"] },
    aiOps: { label: "DOCUMENTED", tone: "documented", sourceIds: ["phaidra-factory"] },
    gridFlex: { label: "DOCUMENTED", tone: "documented", sourceIds: ["emerald-home"] },
    gridNinja: { label: "INTEGRATION INPUT", tone: "input" },
  },
  {
    capability: "Cooling optimization",
    dcim: { label: "ADJACENT", tone: "documented", sourceIds: ["sunbird-capacity"] },
    digitalTwin: { label: "DOCUMENTED", tone: "documented", sourceIds: ["schneider-etap-ai-factory", "nvidia-dsx-blueprint"] },
    aiOps: { label: "CORE", tone: "core", sourceIds: ["phaidra-home", "phaidra-factory"] },
    gridFlex: { label: "ADJACENT", tone: "documented", sourceIds: ["emerald-home"] },
    gridNinja: { label: "CONSTRAINT INPUT", tone: "input" },
  },
  {
    capability: "Grid-program participation",
    dcim: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["sunbird-power"] },
    digitalTwin: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["nvidia-dsx-blueprint"] },
    aiOps: { label: "ADJACENT", tone: "documented", sourceIds: ["phaidra-home"] },
    gridFlex: { label: "CORE", tone: "core", sourceIds: ["emerald-home", "emerald-svp-pilot"] },
    gridNinja: { label: "PARTNER INTERFACE", tone: "input" },
  },
  {
    capability: "Read-only counterfactual evaluation",
    dcim: { label: "PUBLIC DETAIL VARIES", tone: "varies", sourceIds: ["sunbird-capacity"] },
    digitalTwin: { label: "SIMULATION", tone: "documented", sourceIds: ["nvidia-dsx-blueprint"] },
    aiOps: { label: "PUBLIC DETAIL VARIES", tone: "varies", sourceIds: ["phaidra-factory"] },
    gridFlex: { label: "PUBLIC DETAIL VARIES", tone: "varies", sourceIds: ["emerald-svp-pilot"] },
    gridNinja: { label: "CORE PROOF TARGET", tone: "target" },
  },
  {
    capability: "Allow / repair / reject / no-proof",
    dcim: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["sunbird-power"] },
    digitalTwin: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["nvidia-dsx-blueprint"] },
    aiOps: { label: "PUBLIC DETAIL VARIES", tone: "varies", sourceIds: ["phaidra-home"] },
    gridFlex: { label: "PUBLIC DETAIL VARIES", tone: "varies", sourceIds: ["emerald-home"] },
    gridNinja: { label: "CORE PROOF TARGET", tone: "target" },
  },
  {
    capability: "Accepted-headroom ledger",
    dcim: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["sunbird-capacity"] },
    digitalTwin: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["schneider-etap-ai-factory"] },
    aiOps: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["phaidra-factory"] },
    gridFlex: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["emerald-svp-pilot"] },
    gridNinja: { label: "CORE PROOF TARGET", tone: "target" },
  },
  {
    capability: "Reproducible proof root",
    dcim: { label: "NOT CENTRAL", tone: "varies", sourceIds: ["sunbird-power"] },
    digitalTwin: { label: "MODEL / VERSION CONTROL", tone: "documented", sourceIds: ["nvidia-dsx-blueprint"] },
    aiOps: { label: "PUBLIC DETAIL VARIES", tone: "varies", sourceIds: ["phaidra-home"] },
    gridFlex: { label: "M&V-ORIENTED", tone: "documented", sourceIds: ["emerald-home"] },
    gridNinja: { label: "CORE PROOF TARGET", tone: "target" },
  },
]

export const whyGridNinjaResponsibilityStages = [
  {
    id: "observe",
    shortLabel: "Observe",
    fullLabel: "Observe site and grid state",
  },
  {
    id: "model",
    shortLabel: "Model",
    fullLabel: "Model or simulate behavior",
  },
  {
    id: "propose",
    shortLabel: "Propose",
    fullLabel: "Generate candidate actions",
  },
  {
    id: "verify",
    shortLabel: "Verify",
    fullLabel: "Verify feasibility and constraints",
  },
  {
    id: "rta",
    shortLabel: "RTA",
    fullLabel: "Allow, repair, reject, or no-proof",
  },
  {
    id: "account",
    shortLabel: "Account",
    fullLabel: "Account for accepted headroom",
  },
  {
    id: "prove",
    shortLabel: "Prove",
    fullLabel: "Emit replay and proof evidence",
  },
] as const satisfies readonly {
  id: WhyGridNinjaResponsibilityStageId
  shortLabel: string
  fullLabel: string
}[]

export const whyGridNinjaCompetitorProfiles = [
  {
    id: "emerald-ai",
    name: "Emerald AI",
    category: "Grid-facing AI flexibility and orchestration",
    summary:
      "A credible grid-flexibility profile. GridNinja should distinguish itself through site-local acceptance, runtime assurance, and proof-rooted headroom accounting.",
    tags: ["Grid flexibility", "M&V", "Workload modulation"],
    claims: {
      publicMaterials: {
        eyebrow: "What public materials show",
        body: "Grid connectivity, workload and on-site energy orchestration, fleet flexibility, digital-twin modeling, and auditable measurement and verification.",
        kind: "public-materials",
        sourceIds: ["emerald-home", "emerald-svp-pilot"],
      },
      sharedTerrain: {
        eyebrow: "Shared terrain",
        body: "Data-center flexibility, workload coordination, measurement, and grid-facing value.",
        kind: "shared-terrain",
        sourceIds: ["emerald-home"],
      },
      gridNinjaResponsibility: {
        eyebrow: "GridNinja responsibility",
        body: "Site-local acceptance: deterministic constraint verification, four-state runtime assurance, no-proof exits, accepted-headroom accounting, receipts, and replay evidence.",
        kind: "gridninja-responsibility",
        sourceIds: ["gridninja-proof-standard"],
      },
      proofThreshold: {
        eyebrow: "Proof GridNinja must produce",
        body: "Cross-domain Shadow Mode replay, reserve-floor traces, operator-reviewed ledgers, stable proof roots, and examples where facility constraints require repair or refusal.",
        kind: "proof-threshold",
        sourceIds: ["gridninja-proof-standard"],
      },
    },
    responsibilityMap: {
      profile: ["observe"],
      shared: ["model", "propose"],
      gridNinja: ["verify", "rta", "account", "prove"],
    },
  },
  {
    id: "phaidra",
    name: "Phaidra",
    category: "AI-operated power, cooling, and workload systems",
    summary:
      "A strong thermal and AI-control profile. GridNinja should lead with proof-adjusted usable capacity rather than an efficiency-only comparison.",
    tags: ["Thermal AI", "Cooling", "AI operations"],
    claims: {
      publicMaterials: {
        eyebrow: "What public materials show",
        body: "AI agents, cooling and thermal stability, workload-related AI-factory operations, and greater useful compute outcomes.",
        kind: "public-materials",
        sourceIds: ["phaidra-home", "phaidra-factory"],
      },
      sharedTerrain: {
        eyebrow: "Shared terrain",
        body: "Cross-domain AI-factory operations, capacity-related outcomes, and workload performance preservation.",
        kind: "shared-terrain",
        sourceIds: ["phaidra-home"],
      },
      gridNinjaResponsibility: {
        eyebrow: "GridNinja responsibility",
        body: "Virtual capacity rather than PUE: usable MW under power, thermal, water, workload, reserve, trust, policy, and SLA constraints with final solver and runtime-assurance authority.",
        kind: "gridninja-responsibility",
        sourceIds: ["gridninja-proof-standard"],
      },
      proofThreshold: {
        eyebrow: "Proof GridNinja must produce",
        body: "Incremental safe MW or protected GPU-hours attributable to coordinated actions, with margin traces, runtime-assurance outcomes, and SLA-preserving replay evidence.",
        kind: "proof-threshold",
        sourceIds: ["gridninja-proof-standard"],
      },
    },
    responsibilityMap: {
      profile: ["observe"],
      shared: ["model", "propose"],
      gridNinja: ["verify", "rta", "account", "prove"],
    },
  },
  {
    id: "schneider-etap-nvidia",
    name: "Schneider / ETAP / NVIDIA",
    category: "Grid-to-chip design and digital twins",
    summary:
      "A strong design and simulation ecosystem. GridNinja should integrate with twin outputs while owning runtime acceptance, policy, and proof.",
    tags: ["Digital twin", "Grid-to-chip", "Reference design"],
    claims: {
      publicMaterials: {
        eyebrow: "What public materials show",
        body: "Electrical, mechanical, thermal, and operational digital-twin modeling for design, simulation, and what-if analysis.",
        kind: "public-materials",
        sourceIds: ["schneider-etap-ai-factory", "nvidia-dsx-blueprint"],
      },
      sharedTerrain: {
        eyebrow: "Shared terrain",
        body: "Constraint understanding, simulation context, and AI-factory planning.",
        kind: "shared-terrain",
        sourceIds: ["schneider-etap-ai-factory", "nvidia-dsx-blueprint"],
      },
      gridNinjaResponsibility: {
        eyebrow: "GridNinja responsibility",
        body: "Treat digital-twin outputs as inputs to current-state, policy-bound runtime acceptance, not as the final authority on a capacity claim.",
        kind: "gridninja-responsibility",
        sourceIds: ["gridninja-proof-standard"],
      },
      proofThreshold: {
        eyebrow: "Proof GridNinja must produce",
        body: "Twin adapters, runtime parity, policy traces, receipts, and deterministic replay that an operator can inspect.",
        kind: "proof-threshold",
        sourceIds: ["gridninja-proof-standard"],
      },
    },
    responsibilityMap: {
      profile: ["observe"],
      shared: ["model"],
      gridNinja: ["propose", "verify", "rta", "account", "prove"],
    },
  },
  {
    id: "sunbird-dcim",
    name: "Sunbird / DCIM",
    category: "Infrastructure inventory, capacity, and monitoring",
    summary:
      "A trusted observability and planning substrate. GridNinja should present as the proof-gated acceptance layer above DCIM, not as a replacement dashboard.",
    tags: ["Monitoring", "Inventory", "Capacity planning"],
    claims: {
      publicMaterials: {
        eyebrow: "What public materials show",
        body: "Planning, provisioning, capacity, power monitoring, topology views, and multi-resource infrastructure context.",
        kind: "public-materials",
        sourceIds: ["sunbird-capacity", "sunbird-power"],
      },
      sharedTerrain: {
        eyebrow: "Shared terrain",
        body: "Topology, capacity context, telemetry, and operator workflows.",
        kind: "shared-terrain",
        sourceIds: ["sunbird-capacity"],
      },
      gridNinjaResponsibility: {
        eyebrow: "GridNinja responsibility",
        body: "Consume the infrastructure record and produce a policy-bound capacity acceptance decision with binding constraints, margins, and replay evidence.",
        kind: "gridninja-responsibility",
        sourceIds: ["gridninja-proof-standard"],
      },
      proofThreshold: {
        eyebrow: "Proof GridNinja must produce",
        body: "A DCIM adapter, topology reconciliation, and accepted-headroom lineage that preserves local system authority.",
        kind: "proof-threshold",
        sourceIds: ["gridninja-proof-standard"],
      },
    },
    responsibilityMap: {
      profile: ["model"],
      shared: ["observe"],
      gridNinja: ["propose", "verify", "rta", "account", "prove"],
    },
  },
  {
    id: "market-access-aggregators",
    name: "Market-access aggregators",
    category: "Demand response, virtual power plants, and market access",
    summary:
      "A mature external-market layer. GridNinja should partner beneath it as the site-side source of safe, verified flexibility envelopes.",
    tags: ["Market access", "Demand response", "Settlement"],
    claims: {
      publicMaterials: {
        eyebrow: "What public materials show",
        body: "Representative demand-response material describes programme enrolment, virtual-power-plant participation, dispatch operations, flexibility measurement, and commercial value.",
        kind: "public-materials",
        sourceIds: ["enel-x-demand-response"],
      },
      sharedTerrain: {
        eyebrow: "Shared terrain",
        body: "Dispatchable flexibility, telemetry, measurement and verification, grid programmes, and economic value.",
        kind: "shared-terrain",
        sourceIds: ["enel-x-demand-response"],
      },
      gridNinjaResponsibility: {
        eyebrow: "GridNinja responsibility",
        body: "Operate inside the fence: determine which workload, cooling, power, storage, and reserve actions are feasible, SLA-preserving, and proof-ready before external dispatch is accepted.",
        kind: "gridninja-responsibility",
        sourceIds: ["gridninja-proof-standard"],
      },
      proofThreshold: {
        eyebrow: "Proof GridNinja must produce",
        body: "A joint pilot showing repeatable MW response, dispatch-envelope accuracy, SLA protection, and automated evidence suitable for partner verification or settlement workflows.",
        kind: "proof-threshold",
        sourceIds: ["gridninja-proof-standard"],
      },
    },
    responsibilityMap: {
      profile: ["observe"],
      shared: ["propose"],
      gridNinja: ["verify", "rta", "account", "prove"],
    },
  },
  {
    id: "hardware-infrastructure-suites",
    name: "Hardware & infrastructure suites",
    category: "Power, cooling, EPMS, UPS, and lifecycle systems",
    summary:
      "A trusted installed-base and service-channel category. GridNinja should be the vendor-neutral assurance overlay across mixed fleets.",
    tags: ["Installed base", "UPS / EPMS", "Lifecycle service"],
    claims: {
      publicMaterials: {
        eyebrow: "What public materials show",
        body: "Representative infrastructure-suite material covers vendor-neutral monitoring and management of power, space, cooling, and IT and OT assets.",
        kind: "public-materials",
        sourceIds: ["eaton-brightlayer-dcim"],
      },
      sharedTerrain: {
        eyebrow: "Shared terrain",
        body: "Power hardware, cooling systems, site telemetry, automation, and critical-facility operations.",
        kind: "shared-terrain",
        sourceIds: ["eaton-brightlayer-dcim"],
      },
      gridNinjaResponsibility: {
        eyebrow: "GridNinja responsibility",
        body: "Act as the neutral assurance layer across mixed UPS, cooling, storage, generator, workload, and telemetry ecosystems with no rip-and-replace requirement.",
        kind: "gridninja-responsibility",
        sourceIds: ["gridninja-proof-standard"],
      },
      proofThreshold: {
        eyebrow: "Proof GridNinja must produce",
        body: "Mixed-vendor orchestration in Shadow Mode or advisory mode with deterministic safety outcomes, adapter qualification evidence, and auditable proof artifacts.",
        kind: "proof-threshold",
        sourceIds: ["gridninja-proof-standard"],
      },
    },
    responsibilityMap: {
      profile: ["propose"],
      shared: ["observe", "model"],
      gridNinja: ["verify", "rta", "account", "prove"],
    },
  },
] as const satisfies readonly WhyGridNinjaCompetitorProfile[]

export function validateWhyGridNinjaCompetitorProfiles(
  profiles: readonly WhyGridNinjaCompetitorProfile[] = whyGridNinjaCompetitorProfiles,
  sources: readonly WhyGridNinjaSourceRecord[] = whyGridNinjaSourceRecords
): void {
  if (profiles.length < 1 || profiles.length > 6) {
    throw new Error("Competitor profiles must contain between one and six entries")
  }

  const profileIds = new Set<string>()
  const sourceIds = new Set(sources.map((source) => source.id))

  for (const profile of profiles) {
    if (profileIds.has(profile.id)) {
      throw new Error(`Duplicate competitor profile id: ${profile.id}`)
    }
    profileIds.add(profile.id)

    for (const [claimKey, claim] of Object.entries(profile.claims)) {
      if (!claim.body.trim()) {
        throw new Error(`${profile.id}.${claimKey}: claim body cannot be empty`)
      }

      if (claim.sourceIds.length < 1) {
        throw new Error(
          `${profile.id}.${claimKey}: at least one source id is required`
        )
      }

      for (const sourceId of claim.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          throw new Error(
            `${profile.id}.${claimKey}: unknown source id ${sourceId}`
          )
        }
      }
    }
  }
}

validateWhyGridNinjaCompetitorProfiles()

export const whyGridNinjaScenarios: WhyGridNinjaScenario[] = [
  {
    id: "utility-request",
    label: "Utility requests 4 MW for 20 minutes",
    request: "External request: 4.0 MW / 20 min",
    withoutRows: [
      "DCIM: 6.2 MW available",
      "Scheduler: 4.8 MW flexible",
      "BESS: 3.9 MW discharge",
      "Cooling model: 5.4 MW thermal margin",
      "Aggregator request: 4.0 MW asserted",
    ],
    withRows: [
      { label: "Versioned claim", value: "4.0 MW / 20 min", state: "allow" },
      { label: "Reserve-floor repair", value: "-1.1 MW", state: "repair" },
      { label: "Telemetry discount", value: "-0.4 MW", state: "repair" },
      { label: "Cooling margin", value: "accepted", state: "allow" },
      { label: "SLA policy", value: "accepted", state: "allow" },
    ],
    acceptedEnvelope: "2.5 MW / 20 min",
    artifacts: ["RTA trace", "Dispatch envelope", "Accepted-headroom ledger", "Proof root"],
  },
  {
    id: "stale-telemetry",
    label: "Cooling telemetry becomes stale",
    request: "Candidate action: shift batch training during thermal uncertainty",
    withoutRows: [
      "Cooling dashboard shows last known margin",
      "Scheduler sees flexible work",
      "Power view still reports electrical headroom",
      "Operator must manually reconcile freshness",
    ],
    withRows: [
      { label: "Telemetry quality", value: "stale source", state: "no-proof" },
      { label: "Electrical margin", value: "inside envelope", state: "allow" },
      { label: "Cooling proof", value: "not eligible", state: "no-proof" },
      { label: "RTA output", value: "NO-PROOF", state: "no-proof" },
    ],
    acceptedEnvelope: "0 MW until evidence refreshes",
    artifacts: ["No-proof register", "Freshness trace", "Operator gap list"],
  },
  {
    id: "storage-backed",
    label: "BESS partner proposes storage-backed headroom",
    request: "Partner claim: 3.2 MW storage-backed capacity",
    withoutRows: [
      "BESS reports discharge capability",
      "UPS reserve policy sits elsewhere",
      "Commercial value assumes full discharge",
      "Recovery and rebound are not commonly recorded",
    ],
    withRows: [
      { label: "Storage claim", value: "3.2 MW", state: "allow" },
      { label: "UPS reserve floor", value: "-1.4 MW", state: "repair" },
      { label: "Reconnection ramp", value: "bounded", state: "allow" },
      { label: "Partner receipt", value: "required", state: "repair" },
    ],
    acceptedEnvelope: "1.8 MW / 14 min",
    artifacts: ["Reserve-floor report", "Safe reconnection envelope", "Partner receipt"],
  },
]

export const whyGridNinjaIndispensabilityConditions = [
  {
    label: "01 / GRID REQUEST",
    title: "External flexibility must respect local limits.",
    body: "A utility or aggregator request cannot resolve UPS reserve, cooling margin, workload SLA, rebound risk, and operator policy by itself.",
    artifact: "RTA trace + dispatch envelope",
  },
  {
    label: "02 / CONFLICTING HEADROOM",
    title: "Multiple systems produce different MW values.",
    body: "Operations, commercial teams, and fleet software need one versioned definition of accepted capacity.",
    artifact: "Accepted-headroom ledger",
  },
  {
    label: "03 / TELEMETRY TRUST",
    title: "Evidence quality varies by subsystem.",
    body: "Capacity should degrade explicitly when telemetry is stale, incomplete, misaligned, or topologically ambiguous.",
    artifact: "No-proof gap register",
  },
  {
    label: "04 / FLEET AGGREGATION",
    title: "Sites need comparable local envelopes.",
    body: "Fleet-level capacity becomes credible only when each site contributes a locally accepted, versioned envelope.",
    artifact: "FleetOS registry",
  },
  {
    label: "05 / STORAGE-BACKED MW",
    title: "Commercial flexibility must preserve emergency reserve.",
    body: "UPS and BESS partners need a clear boundary between available support and protected resilience capacity.",
    artifact: "Reserve-floor report",
  },
  {
    label: "06 / DILIGENCE",
    title: "Buyers need more than claimed MW.",
    body: "Investors, operators, and partners must distinguish nominal, modeled, replay-validated, and operator-accepted capacity.",
    artifact: "Load Passport + proof pack",
  },
] as const

export const whyGridNinjaProofRoomArtifacts = [
  {
    code: "CW",
    title: "Capacity Waterfall",
    body: "Nominal headroom reduced through explicit constraint layers.",
    maturity: "REPLAY-VALIDATED" as WhyGridNinjaMaturity,
    hash: "8f4c...91a",
    scenario: "Utility request",
  },
  {
    code: "RT",
    title: "RTA Decision Trace",
    body: "Allow, repair, reject, and no-proof with reasons and margins.",
    maturity: "IMPLEMENTED" as WhyGridNinjaMaturity,
    hash: "004921",
    scenario: "Repair",
  },
  {
    code: "BC",
    title: "Binding Constraint Report",
    body: "Constraint identity, source quality, threshold, and post-action state.",
    maturity: "REPLAY-VALIDATED" as WhyGridNinjaMaturity,
    hash: "T2",
    scenario: "Power margin",
  },
  {
    code: "NP",
    title: "No-Proof Register",
    body: "Missing or stale evidence and its impact on accepted capacity.",
    maturity: "IMPLEMENTED" as WhyGridNinjaMaturity,
    hash: "3 gaps",
    scenario: "Stale telemetry",
  },
  {
    code: "RF",
    title: "Reserve-Floor Report",
    body: "Emergency reserve protected from commercial flexibility claims.",
    maturity: "DESIGN TARGET" as WhyGridNinjaMaturity,
    hash: "UPS-2",
    scenario: "Storage-backed MW",
  },
  {
    code: "CW",
    title: "Cooling / Water Envelope",
    body: "Thermal and water constraints linked to capacity acceptance.",
    maturity: "DESIGN TARGET" as WhyGridNinjaMaturity,
    hash: "LOOP-B",
    scenario: "Cooling state",
  },
  {
    code: "HL",
    title: "Accepted-Headroom Ledger",
    body: "Versioned record of accepted MW, policy, and proof lineage.",
    maturity: "IMPLEMENTED" as WhyGridNinjaMaturity,
    hash: "5.8 MW",
    scenario: "Accepted envelope",
  },
  {
    code: "LP",
    title: "AI Factory Load Passport",
    body: "A portable operating identity for capacity and flexibility evidence.",
    maturity: "DESIGN TARGET" as WhyGridNinjaMaturity,
    hash: "ATL1",
    scenario: "Commercial review",
  },
  {
    code: "SR",
    title: "Safe Reconnection Envelope",
    body: "Ramp, rebound, and recovery behavior after a flexibility event.",
    maturity: "PLANNED" as WhyGridNinjaMaturity,
    hash: "v0.1",
    scenario: "Rebound",
  },
  {
    code: "PP",
    title: "Signed Proof Pack",
    body: "Human-readable and machine-verifiable evidence bundle.",
    maturity: "IMPLEMENTED" as WhyGridNinjaMaturity,
    hash: "SHA256",
    scenario: "Capacity Audit",
  },
]

export const whyGridNinjaPersonas: WhyGridNinjaPersona[] = [
  {
    id: "operator",
    label: "Operator",
    lead: "See the binding constraint, inspect every repair, keep authority local, and return no-proof when evidence is weak.",
    points: ["Binding constraint trace", "RTA repair history", "Accepted-headroom ledger", "No-proof register"],
    ctaSource: "why-gridninja-persona-operator",
  },
  {
    id: "ciso",
    label: "CISO",
    lead: "Start read-only, separate proposal systems from authority, track versions and receipts, and fail closed when trust degrades.",
    points: ["No command VLAN", "No write credentials", "Versioned policy", "Degraded-mode evidence"],
    ctaSource: "why-gridninja-persona-ciso",
  },
  {
    id: "utility-emc",
    label: "Utility / EMC",
    lead: "Receive ramp, duration, rebound, confidence, and reconnection evidence alongside the flexible-MW number.",
    points: ["Dispatch envelope", "Safe reconnection", "Telemetry quality", "Utility evidence packet"],
    ctaSource: "why-gridninja-persona-utility",
  },
  {
    id: "ai-cloud",
    label: "AI Cloud",
    lead: "Translate constrained infrastructure into proof-adjusted capacity while preserving workload, reserve, and facility policy.",
    points: ["GPU capacity waterfall", "SLA policy", "Reserve-floor report", "Load Passport"],
    ctaSource: "why-gridninja-persona-ai-cloud",
  },
  {
    id: "investor",
    label: "Investor",
    lead: "Separate claimed MW, modeled opportunity, replay-validated capacity, operator-accepted capacity, and settled outcomes.",
    points: ["Evidence maturity", "Accepted-headroom ledger", "Fleet registry", "Commercial proof pack"],
    ctaSource: "why-gridninja-persona-investor",
  },
  {
    id: "partner",
    label: "Partner",
    lead: "Show how storage, cooling, or bridge-power equipment contributes to a bounded and inspectable capacity envelope.",
    points: ["Partner adapter", "Reserve-safe envelope", "Cooling/water proof", "Deployment-readiness report"],
    ctaSource: "why-gridninja-persona-partner",
  },
]
