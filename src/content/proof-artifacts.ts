import type { SectionCopy } from "@/types/site"

export type ProofArtifact = {
  title: string
  body: string
  audience: string
}

export type RtaDecisionState = "allow" | "repair" | "reject" | "no-proof"

export type EvidenceRow = {
  label: string
  value: string
}

export type WaterfallStep = {
  label: string
  value: number
  capacityAfter?: number
  detail: string
  tone?: "claim" | "constraint" | "proof"
  decision?: RtaDecisionState
  proofHint?: string
}

export type RtaDecisionMeta = {
  state: RtaDecisionState
  label: string
  description: string
  shape: string
  ariaLabel: string
}

export type ProofChainStage = {
  stage: string
  canDo: string
  cannotDo: string
  boundaryAfter?: boolean
  evidenceRows: EvidenceRow[]
}

export type ClaimToProofCard = {
  domain: string
  nominal: string
  bindingConstraint: string
  proofAdjusted: string
  decision: RtaDecisionState
  evidence: string
}

export type ReplayFixture = {
  tape: string
  topology: string
  policy: string
  proofRoot: string
  rows: EvidenceRow[]
  replayRuns: Array<{
    run: string
    timecode: string
    status: string
    rows: EvidenceRow[]
  }>
}

export type LoadPassportSection = {
  title: string
  evidence: string
  telemetrySource: string
  freshness: string
  proofRow: string
  artifactFiles: string[]
  chartPoints: number[]
  verified: boolean
}

export type ArtifactEvidence = {
  artifactTitle: string
  whoCares: string
  caveat: string
  cta: string
  sampleFiles: string[]
  rows: EvidenceRow[]
}

export type InstrumentEvent = {
  timecode: string
  label: string
  detail: string
  state: "written" | "locked" | "untrusted" | "verified" | RtaDecisionState
}

export type NoProofGap = {
  gap: string
  severity?: string
  status: string
  impact?: string
  owner: string
  remediation: string
  sourceEvidence: string
  sampleVerifiedState: string
  sampleDeltaMw: number
  proofRoot: string
  evidenceRows: EvidenceRow[]
}

export const rtaDecisionMeta: Record<RtaDecisionState, RtaDecisionMeta> = {
  allow: {
    state: "allow",
    label: "ALLOW",
    description: "Inside envelope. Proof row can be accepted.",
    shape: "solid lock",
    ariaLabel: "RTA decision allow, action is inside the declared envelope",
  },
  repair: {
    state: "repair",
    label: "REPAIR",
    description: "Requested action is clipped to safe margin.",
    shape: "split correction",
    ariaLabel: "RTA decision repair, action needs a smaller safe version",
  },
  reject: {
    state: "reject",
    label: "REJECT",
    description: "No safe repair under current policy.",
    shape: "hard stop",
    ariaLabel: "RTA decision reject, no safe action is available",
  },
  "no-proof": {
    state: "no-proof",
    label: "NO-PROOF",
    description: "Evidence is stale, missing, or ambiguous.",
    shape: "dashed evidence",
    ariaLabel: "RTA decision no-proof, evidence is not sufficient",
  },
}

export const proofArtifactIntro: SectionCopy = {
  eyebrow: "Proof objects",
  headline: "Every accepted MW should have evidence attached",
  body: "GridNinja turns site telemetry, topology, policy, reserve floors, and workload constraints into proof objects operators can inspect before control expands.",
}

export const proofArtifacts: ProofArtifact[] = [
  {
    title: "AI Data Center Load Passport",
    body: "A site-specific capacity identity that summarizes proof-adjusted virtual capacity, binding constraints, freshness posture, and declared operating policy.",
    audience: "Operators, hyperscalers, investors",
  },
  {
    title: "Capacity Waterfall",
    body: "A transparent reduction from nominal headroom to safe, usable, auditable capacity after electrical, reserve, thermal, workload, and telemetry checks.",
    audience: "Executives, operators, reviewers",
  },
  {
    title: "Accepted-Headroom Ledger",
    body: "A time-indexed record of accepted capacity states, rejected actions, no-proof intervals, and the proof root behind each decision.",
    audience: "Operators, auditors, fleet teams",
  },
  {
    title: "Reserve-Floor Report",
    body: "A resilience-first view of UPS, BESS, and bridge-power margins so flexibility does not spend emergency posture silently.",
    audience: "Facilities, BESS/UPS partners",
  },
  {
    title: "No-Proof Gap Register",
    body: "A remediation list for missing telemetry, incomplete topology, stale policy, or weak evidence that prevents safe approval.",
    audience: "Operators, CISOs, program owners",
  },
  {
    title: "Utility Evidence Packet",
    body: "A planning-facing summary of flexible MW, ramp limits, reconnection envelope, confidence posture, and exceptions.",
    audience: "Utilities, EMCs, partners",
  },
]

export const illustrativeWaterfall: WaterfallStep[] = [
  {
    label: "Observed nominal headroom",
    value: 18.4,
    capacityAfter: 18.4,
    detail: "The starting claim before proof. Illustrative Atlas-3 scenario.",
    tone: "claim",
    decision: "no-proof",
    proofHint: "Claimed headroom before constraints, policy, or telemetry trust.",
  },
  {
    label: "Electrical constraint",
    value: -3.7,
    capacityAfter: 14.7,
    detail: "Feeders, transformers, PQ, and ramp behavior remove unsafe headroom.",
    tone: "constraint",
    decision: "repair",
    proofHint: "Transformer T2 and feeder ramp envelope bind the first reduction.",
  },
  {
    label: "UPS/BESS reserve floor",
    value: -3.5,
    capacityAfter: 11.2,
    detail: "Resilience reserve remains protected before flexibility is considered.",
    tone: "constraint",
    decision: "repair",
    proofHint: "Reserve floor remains unavailable to virtual capacity.",
  },
  {
    label: "Cooling and water margin",
    value: -2.3,
    capacityAfter: 8.9,
    detail: "Thermal and water posture reduce usable AI capacity in constrained intervals.",
    tone: "constraint",
    decision: "repair",
    proofHint: "Cooling loop B is the binding thermal-water margin.",
  },
  {
    label: "SLA/workload posture",
    value: -1.8,
    capacityAfter: 7.1,
    detail: "Latency, immovable workloads, and tenant commitments stay inside policy.",
    tone: "constraint",
    decision: "repair",
    proofHint: "SLA-locked inference lanes are excluded from dispatch.",
  },
  {
    label: "Telemetry trust discount",
    value: -1.3,
    capacityAfter: 5.8,
    detail: "Stale or incomplete evidence becomes a no-proof discount.",
    tone: "constraint",
    decision: "no-proof",
    proofHint: "Unknown rack telemetry remains visible as a discount, not hidden risk.",
  },
  {
    label: "Proof-adjusted safe capacity",
    value: 5.8,
    capacityAfter: 5.8,
    detail: "The illustrative accepted answer, not a guaranteed GridNinja outcome.",
    tone: "proof",
    decision: "allow",
    proofHint: "Accepted headroom after runtime assurance and operator evidence.",
  },
]

export const claimToProofCards: ClaimToProofCard[] = [
  {
    domain: "Power",
    nominal: "18.4 MW",
    bindingConstraint: "Transformer T2 ramp envelope",
    proofAdjusted: "14.7 MW",
    decision: "repair",
    evidence: "EPMS-A trusted, 184 ms age",
  },
  {
    domain: "Cooling",
    nominal: "12.6 MW",
    bindingConstraint: "Cooling loop B and water margin",
    proofAdjusted: "8.9 MW",
    decision: "repair",
    evidence: "Thermal model and loop state aligned",
  },
  {
    domain: "Storage",
    nominal: "7.0 MW",
    bindingConstraint: "UPS/BESS reserve floor",
    proofAdjusted: "3.5 MW held back",
    decision: "reject",
    evidence: "Reserve below policy if action passes",
  },
  {
    domain: "Workloads",
    nominal: "4.2 MW",
    bindingConstraint: "SLA-locked inference lanes",
    proofAdjusted: "2.4 MW dispatchable",
    decision: "no-proof",
    evidence: "One rack group has stale telemetry",
  },
]

export const proofChainStages: ProofChainStage[] = [
  {
    stage: "Proposal",
    canDo: "Rank candidate workload, cooling, and bridge-power bundles.",
    cannotDo: "Cannot approve site actions or mutate authority.",
    boundaryAfter: true,
    evidenceRows: [
      { label: "source", value: "shadow_candidate_bundle" },
      { label: "scope", value: "recommendation only" },
      { label: "authority", value: "none" },
    ],
  },
  {
    stage: "Solver",
    canDo: "Check topology, policy, and deterministic feasibility.",
    cannotDo: "Cannot ignore declared reserve floors.",
    evidenceRows: [
      { label: "topology", value: "ATL1_v0.3" },
      { label: "policy", value: "SHADOW_READ_ONLY" },
      { label: "margin", value: "+5.8 MW accepted headroom" },
    ],
  },
  {
    stage: "RTA",
    canDo: "Allow, repair, reject, or no-proof the action.",
    cannotDo: "Cannot accept stale or missing evidence.",
    evidenceRows: [
      { label: "decision", value: "REPAIR" },
      { label: "binding", value: "UPS_RESERVE_FLOOR" },
      { label: "repair", value: "+1.1 MW for 30 min" },
    ],
  },
  {
    stage: "Edge Receipt",
    canDo: "Record the accepted or refused decision at the site boundary.",
    cannotDo: "Cannot hide no-proof intervals.",
    evidenceRows: [
      { label: "receipt_id", value: "edge-004921" },
      { label: "mode", value: "shadow_readonly" },
      { label: "write_access", value: "none" },
    ],
  },
  {
    stage: "Cold-Path Replay",
    canDo: "Re-run the same tape and verify the proof root.",
    cannotDo: "Cannot invent missing telemetry after the fact.",
    evidenceRows: [
      { label: "tape", value: "URI_STRESS_2021_02_15" },
      { label: "replay", value: "deterministic" },
      { label: "root", value: "8f4c...91a" },
    ],
  },
  {
    stage: "Proof Pack",
    canDo: "Export evidence for operators, CISOs, utilities, and reviewers.",
    cannotDo: "Cannot become an approval by itself.",
    evidenceRows: [
      { label: "manifest", value: "manifest.json" },
      { label: "trace", value: "rta_trace.csv" },
      { label: "ledger", value: "accepted_headroom.parquet" },
    ],
  },
]

export const replayRuns: ReplayFixture["replayRuns"] = [
  {
    run: "Run 1",
    timecode: "T+00:18",
    status: "proof root locked",
    rows: [
      { label: "run_id", value: "shadow-replay-001" },
      { label: "event_tape_hash", value: "sha256:6c18...b2f0" },
      { label: "topology_hash", value: "sha256:37bb...6a11" },
      { label: "policy_hash", value: "sha256:bb40...97dd" },
      { label: "proof_root", value: "8f4c...91a" },
    ],
  },
  {
    run: "Run 2",
    timecode: "T+00:42",
    status: "same proof root",
    rows: [
      { label: "run_id", value: "shadow-replay-002" },
      { label: "event_tape_hash", value: "sha256:6c18...b2f0" },
      { label: "topology_hash", value: "sha256:37bb...6a11" },
      { label: "policy_hash", value: "sha256:bb40...97dd" },
      { label: "proof_root", value: "8f4c...91a" },
    ],
  },
]

export const replayFixture: ReplayFixture = {
  tape: "URI_STRESS_2021_02_15",
  topology: "ATL1_v0.3",
  policy: "SHADOW_READ_ONLY",
  proofRoot: "8f4c...91a",
  rows: [
    { label: "event_tape", value: "loaded 4,921 ordered rows" },
    { label: "solver", value: "reserve floor binds at T+00:18" },
    { label: "rta", value: "REPAIR requested +2.4 MW to +1.1 MW" },
    { label: "receipt", value: "edge-004921 written read-only" },
    { label: "proof_root", value: "8f4c...91a" },
  ],
  replayRuns,
}

export const loadPassportSectionEvidence: LoadPassportSection[] = [
  {
    title: "Site Identity",
    evidence: "Telemetry boundary, site role, and declared operating policy.",
    telemetrySource: "Site registry + read-only connector manifest",
    freshness: "manifest sampled T-00:09",
    proofRow: "lp.site_identity.row_001",
    artifactFiles: ["site_identity.json", "connector_manifest.json"],
    chartPoints: [30, 38, 42, 42, 44, 46, 48, 50],
    verified: true,
  },
  {
    title: "Load Behavior Profile",
    evidence: "Observed ramp behavior and workload classes.",
    telemetrySource: "Scheduler shadow export + rack group meter joins",
    freshness: "workload map sampled T-00:12",
    proofRow: "lp.behavior_profile.row_017",
    artifactFiles: ["workload_classes.csv", "ramp_observations.parquet"],
    chartPoints: [22, 34, 46, 58, 54, 61, 66, 64],
    verified: true,
  },
  {
    title: "Rack Ramp-Rate Envelope",
    evidence: "Line chart from accepted ramp limits and SLA locks.",
    telemetrySource: "EPMS ramp trace + SLA exclusion map",
    freshness: "184 ms source age",
    proofRow: "lp.ramp_envelope.row_034",
    artifactFiles: ["ramp_envelope.csv", "sla_locks.json"],
    chartPoints: [26, 42, 57, 51, 64, 72, 68, 81],
    verified: true,
  },
  {
    title: "UPS/BESS Reserve Floor",
    evidence: "Minimum reserve policy and post-action margin.",
    telemetrySource: "UPS/BESS reserve policy + read-only BMS telemetry",
    freshness: "reserve snapshot sampled T-00:07",
    proofRow: "lp.reserve_floor.row_041",
    artifactFiles: ["reserve_floor_report.pdf", "bess_margin_trace.csv"],
    chartPoints: [80, 78, 72, 68, 70, 69, 71, 73],
    verified: true,
  },
  {
    title: "Cooling/Water Constraint Envelope",
    evidence: "Thermal loop state and water-constrained operating intervals.",
    telemetrySource: "Cooling loop state + water-aware dispatch caveat",
    freshness: "thermal source age 2.1 s",
    proofRow: "lp.cooling_water.row_056",
    artifactFiles: ["cooling_envelope.json", "water_caveats.md"],
    chartPoints: [70, 68, 64, 55, 49, 53, 58, 61],
    verified: true,
  },
  {
    title: "Telemetry Trust Score",
    evidence: "Freshness, coverage, source age, and no-proof exceptions.",
    telemetrySource: "Trust scorer over EPMS, BMS, scheduler, and policy feeds",
    freshness: "one rack group stale at T-00:31",
    proofRow: "lp.telemetry_trust.row_063",
    artifactFiles: ["telemetry_trust.csv", "no_proof_exceptions.csv"],
    chartPoints: [86, 84, 82, 76, 64, 58, 61, 66],
    verified: true,
  },
  {
    title: "Accepted Headroom Ledger",
    evidence: "Time-indexed accepted MW, refusal rows, and proof root.",
    telemetrySource: "RTA receipt stream + cold-path replay",
    freshness: "ledger row written T+00:19",
    proofRow: "lp.accepted_headroom.row_077",
    artifactFiles: ["accepted_headroom.parquet", "receipt_edge_004921.json"],
    chartPoints: [28, 35, 44, 52, 58, 58, 58, 58],
    verified: true,
  },
  {
    title: "Utility Evidence Packet",
    evidence: "Ramp, reconnection, flexible MW, and caveat exports.",
    telemetrySource: "Proof pack export + utility-facing exception table",
    freshness: "packet compiled T+00:51",
    proofRow: "lp.utility_packet.row_089",
    artifactFiles: ["utility_evidence_packet.pdf", "ramp_limits.csv"],
    chartPoints: [12, 24, 39, 47, 55, 59, 58, 58],
    verified: true,
  },
]

export const loadPassportSections = loadPassportSectionEvidence

export const instrumentEvents: InstrumentEvent[] = [
  {
    timecode: "T+00:03",
    label: "event tape compiled",
    detail: "4,921 ordered rows staged for replay",
    state: "verified",
  },
  {
    timecode: "T+00:09",
    label: "untrusted telemetry isolated",
    detail: "rack group RG-17 held as dashed no-proof evidence",
    state: "untrusted",
  },
  {
    timecode: "T+00:18",
    label: "proof root locked",
    detail: "same tape, topology, and policy produce 8f4c...91a",
    state: "locked",
  },
  {
    timecode: "T+00:19",
    label: "receipt written",
    detail: "edge-004921 recorded read-only",
    state: "written",
  },
]

export const proofLoadingSteps = [
  "Compiling event tape...",
  "Checking telemetry trust...",
  "Running solver verification...",
  "Applying RTA policy...",
  "Writing proof row...",
]

export const evidenceDrawerRows: Record<string, EvidenceRow[]> = {
  replayRoot: [
    { label: "tape", value: "URI_STRESS_2021_02_15" },
    { label: "topology", value: "ATL1_v0.3" },
    { label: "policy", value: "SHADOW_READ_ONLY" },
    { label: "proof_root", value: "8f4c...91a" },
  ],
  receipt: [
    { label: "receipt_id", value: "edge-004921" },
    { label: "mode", value: "shadow_readonly" },
    { label: "authority", value: "RTA gate only" },
    { label: "write_access", value: "none" },
  ],
}

export const artifactFiles: ArtifactEvidence[] = [
  {
    artifactTitle: "AI Data Center Load Passport",
    whoCares: "Operators, hyperscalers, investors",
    caveat: "Illustrative sample shape. Site-specific evidence is produced during a Capacity Audit.",
    cta: "Request Load Passport",
    sampleFiles: ["load_passport.json", "site_identity.json", "proof_root.txt"],
    rows: [
      { label: "proof_row", value: "lp.accepted_headroom.row_077" },
      { label: "freshness", value: "all required sample sections present" },
      { label: "scope", value: "one illustrative Atlas-3 site" },
    ],
  },
  {
    artifactTitle: "Capacity Waterfall",
    whoCares: "Executives, operators, reviewers",
    caveat: "MW values are illustrative until validated against GridNinja deployment evidence.",
    cta: "Inspect Proof Demo",
    sampleFiles: ["capacity_waterfall.csv", "constraint_reductions.json"],
    rows: [
      { label: "nominal_headroom", value: "18.4 MW illustrative" },
      { label: "proof_adjusted", value: "5.8 MW illustrative" },
      { label: "binding", value: "reserve floor + telemetry trust" },
    ],
  },
  {
    artifactTitle: "Accepted-Headroom Ledger",
    whoCares: "Operators, auditors, fleet teams",
    caveat: "A ledger row records accepted evidence; it is not a hidden approval path.",
    cta: "Review Proof Pack",
    sampleFiles: ["accepted_headroom.parquet", "receipt_edge_004921.json"],
    rows: [
      { label: "row_id", value: "ledger.004921" },
      { label: "decision", value: "REPAIR" },
      { label: "authority", value: "runtime assurance boundary" },
    ],
  },
  {
    artifactTitle: "Reserve-Floor Report",
    whoCares: "Facilities, BESS/UPS partners",
    caveat: "Reserve margins remain protected; GridNinja does not spend emergency posture silently.",
    cta: "Request Capacity Audit",
    sampleFiles: ["reserve_floor_report.pdf", "bess_margin_trace.csv"],
    rows: [
      { label: "reserve_floor", value: "policy declared" },
      { label: "post_action_margin", value: "+4.8 MW illustrative" },
      { label: "rta_decision", value: "REPAIR" },
    ],
  },
  {
    artifactTitle: "No-Proof Gap Register",
    whoCares: "Operators, CISOs, program owners",
    caveat: "Local verification only updates this illustrative register, not live site state.",
    cta: "See Shadow Mode",
    sampleFiles: ["no_proof_register.csv", "telemetry_trust.csv"],
    rows: [
      { label: "open_gaps", value: "3 illustrative" },
      { label: "discount", value: "-1.3 MW illustrative" },
      { label: "remediation", value: "owner-assigned evidence path" },
    ],
  },
  {
    artifactTitle: "Utility Evidence Packet",
    whoCares: "Utilities, EMCs, partners",
    caveat: "Planning-facing evidence does not replace utility approval or interconnection studies.",
    cta: "Request DCII Memo",
    sampleFiles: ["utility_evidence_packet.pdf", "ramp_limits.csv"],
    rows: [
      { label: "flexible_mw", value: "proof-adjusted sample" },
      { label: "ramp_limit", value: "+1.1 MW / 30 min" },
      { label: "exceptions", value: "telemetry trust caveat included" },
    ],
  },
]

export const productBoundaryStatements = {
  does: [
    "Turns constrained AI infrastructure into safe, usable, auditable capacity.",
    "Runs Shadow Mode before bounded autonomy.",
    "Exports Load Passports, ledgers, RTA traces, and no-proof registers.",
    "Keeps operators, declared policy, and runtime assurance at the boundary.",
  ],
  doesNot: [
    "Does not replace DCIM, EMS, or utility interconnection studies.",
    "Does not approve live actions from ML, frontend state, or fleet dashboards.",
    "Does not hide stale telemetry inside optimistic capacity claims.",
    "Does not present illustrative MW as guaranteed site capacity.",
  ],
}

export const proofInstrumentRoadmap = [
  { fixture: "View transitions", phase: "v2 deferred", reason: "Premium continuity after the proof object model stabilizes." },
  { fixture: "Constraint Braid", phase: "v2 deferred", reason: "Visually dominant; should follow validated page hierarchy." },
  { fixture: "Fleet Swarm Map", phase: "v2 deferred", reason: "Needs real FleetOS story and filtering scope." },
  { fixture: "Scroll-snap proof story", phase: "v2 deferred", reason: "Higher choreography risk for mobile and reduced-motion users." },
  { fixture: "Inspect / Explain / Export cursor modes", phase: "v2 deferred", reason: "Groundwork exists in demo controls; cursor behavior waits." },
  { fixture: "Data center X-ray reveal", phase: "v2 deferred", reason: "Should be a signature visual only if asset quality is high." },
  { fixture: "Before / after proof slider", phase: "v2 deferred", reason: "Good investor explainer, but lower priority than proof chain and Load Passport." },
]

export const trustBoundaryItems = [
  "Read-only Shadow Mode first",
  "No write credentials in first deployment posture",
  "No command VLAN requirement for proof generation",
  "No hidden actuation path from ML, frontend state, or fleet software",
  "Operator policy and runtime assurance remain the approval boundary",
]

export const remediationPaths: NoProofGap[] = [
  {
    gap: "Telemetry freshness",
    severity: "High",
    status: "Open",
    impact: "-1.2 MW proof discount",
    owner: "Site integration",
    remediation: "Confirm 15-second freshness across feeder, reserve, thermal, and workload nodes.",
    sourceEvidence: "EPMS-A, BMS-B, and workload scheduler feeds sampled in Shadow Mode.",
    sampleVerifiedState: "Freshness sample verified for RG-17 in this local fixture.",
    sampleDeltaMw: 0.7,
    proofRoot: "8f4c...91a",
    evidenceRows: [
      { label: "gap_id", value: "np.telemetry_freshness" },
      { label: "source_age", value: "31 s before remediation sample" },
      { label: "owner", value: "Site integration" },
      { label: "row_id", value: "no_proof.row_012" },
    ],
  },
  {
    gap: "Topology mapping",
    severity: "High",
    status: "In review",
    impact: "no-proof for thermal envelope",
    owner: "Facilities",
    remediation: "Bind rack groups, feeders, cooling zones, UPS strings, and bridge assets to one proof graph.",
    sourceEvidence: "Read-only topology import and cooling-zone crosswalk.",
    sampleVerifiedState: "Rack group to cooling-zone binding verified in this local fixture.",
    sampleDeltaMw: 0.4,
    proofRoot: "8f4c...91a",
    evidenceRows: [
      { label: "gap_id", value: "np.topology_mapping" },
      { label: "binding", value: "rack_group -> feeder -> cooling_zone" },
      { label: "owner", value: "Facilities" },
      { label: "row_id", value: "no_proof.row_019" },
    ],
  },
  {
    gap: "Policy declaration",
    severity: "Medium",
    status: "Required",
    impact: "no reserve-safe dispatch",
    owner: "Operations",
    remediation: "Declare reserve floors, SLA exclusions, allowed repair bands, and rollback posture.",
    sourceEvidence: "Operator-declared reserve floor and SLA exclusion fixture.",
    sampleVerifiedState: "Reserve floor declaration accepted in this local fixture.",
    sampleDeltaMw: 0.2,
    proofRoot: "8f4c...91a",
    evidenceRows: [
      { label: "gap_id", value: "np.policy_declaration" },
      { label: "policy", value: "SHADOW_READ_ONLY" },
      { label: "owner", value: "Operations" },
      { label: "row_id", value: "no_proof.row_027" },
    ],
  },
]

export const noProofGaps = remediationPaths
