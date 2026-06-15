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

export type RtaDecisionCandidate = {
  id: string
  label: string
  requestedMw: number
  acceptedMw: number
  duration: string
  target: string
  decision: RtaDecisionState
  reason: string
  proofRow: string
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

export type ConstraintBraidDomain = {
  id: string
  title: string
  input: string
  bindingConstraint: string
  proofObject: string
  acceptedPosture: string
  trustScore: number
  state: RtaDecisionState
  evidenceRows: EvidenceRow[]
}

export type FleetSwarmState =
  | "shadow"
  | "advisory"
  | "bounded"
  | "production"
  | "no-proof"

export type FleetSwarmSite = {
  id: string
  name: string
  region: string
  state: FleetSwarmState
  stateLabel: string
  role: string
  proofRoot: string
  acceptedMw: string
  acceptedMwValue: number
  noProofGaps: number
  detail: string
}

export type FleetEventPhase = {
  id: string
  label: string
  gridEvent: string
  multiplier: number
}

export type ProofStoryStep = {
  id: string
  eyebrow: string
  title: string
  body: string
  artifact: string
  state: RtaDecisionState
  rows: EvidenceRow[]
}

export type DemoMode = "Inspect" | "Explain" | "Export"

export type DemoModeOverlayFixture = {
  mode: DemoMode
  title: string
  body: string
  focusLabel: string
  rows: EvidenceRow[]
}

export type XrayLayer = {
  id: string
  title: string
  layer: string
  body: string
  proofObject: string
  state: RtaDecisionState
  telemetry: string
  contribution?: string
}

export type ProofComparisonFixture = {
  title: string
  body: string
  beforeLabel: string
  afterLabel: string
  beforeMw: string
  afterMw: string
  beforeRows: EvidenceRow[]
  afterRows: EvidenceRow[]
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

export const rtaDecisionCandidates: RtaDecisionCandidate[] = [
  {
    id: "repair-ups-floor",
    label: "Shift flexible AI training load",
    requestedMw: 2.4,
    acceptedMw: 1.1,
    duration: "14 min",
    target: "Cluster B / UPS Group 2",
    decision: "repair",
    reason: "UPS reserve floor would fall below operator policy, so the runtime assurance layer clips the action to a safer dispatch envelope.",
    proofRow: "rta_row_004921",
  },
  {
    id: "allow-cooling-clear",
    label: "Use cooling-safe training window",
    requestedMw: 0.8,
    acceptedMw: 0.8,
    duration: "9 min",
    target: "Cluster D / Loop A",
    decision: "allow",
    reason: "All power, cooling, workload, and telemetry margins remain inside the declared proof envelope.",
    proofRow: "rta_row_004922",
  },
  {
    id: "no-proof-telemetry",
    label: "Dispatch storage-backed capacity",
    requestedMw: 1.6,
    acceptedMw: 0,
    duration: "12 min",
    target: "BESS Block 1",
    decision: "no-proof",
    reason: "BESS state-of-charge telemetry is stale, so reserve-safe dispatch cannot be proven.",
    proofRow: "no_proof_gap_000317",
  },
  {
    id: "reject-thermal",
    label: "Ramp high-density rack zone",
    requestedMw: 3.2,
    acceptedMw: 0,
    duration: "18 min",
    target: "GPU Hall 3",
    decision: "reject",
    reason: "Thermal margin cannot be repaired under current cooling state without violating the declared SLA envelope.",
    proofRow: "rta_reject_000071",
  },
]

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
  { fixture: "View transitions", phase: "v2 progressive", reason: "Same-document continuity only inside proof islands, disabled for reduced motion." },
  { fixture: "Constraint Braid", phase: "v2 shipped", reason: "Connects binding domains to RTA outcomes without replacing the waterfall." },
  { fixture: "Fleet Swarm Map", phase: "v2 shipped", reason: "Read-only proof aggregation with explicit local authority boundaries." },
  { fixture: "Scroll-snap proof story", phase: "v2 shipped", reason: "Desktop enhancement with normal stacked fallback." },
  { fixture: "Inspect / Explain / Export cursor modes", phase: "v2 shipped", reason: "Accessible overlays ship; custom cursor behavior remains excluded." },
  { fixture: "Data center X-ray reveal", phase: "v2 shipped", reason: "Code-native proof-object visual, not generic data-center decoration." },
  { fixture: "Before / after proof slider", phase: "v2 shipped", reason: "Keyboard-accessible ROI/DCII explainer for claimed versus proof-adjusted capacity." },
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

export const constraintBraidDomains: ConstraintBraidDomain[] = [
  {
    id: "power",
    title: "Power",
    input: "Utility feed, transformer, PCC, bridge-power posture",
    bindingConstraint: "Transformer T2 ramp envelope",
    proofObject: "Capacity Waterfall row 002",
    acceptedPosture: "Repair to declared ramp limit before acceptance",
    trustScore: 86,
    state: "repair",
    evidenceRows: [
      { label: "source", value: "EPMS-A + PCC telemetry" },
      { label: "constraint", value: "T2_RAMP_LIMIT" },
      { label: "proof_row", value: "waterfall.power.row_002" },
    ],
  },
  {
    id: "cooling",
    title: "Cooling",
    input: "Loop state, thermal margin, water caveat",
    bindingConstraint: "Cooling loop B and water interval",
    proofObject: "Load Passport cooling-water section",
    acceptedPosture: "Clip accepted headroom during constrained intervals",
    trustScore: 79,
    state: "repair",
    evidenceRows: [
      { label: "source", value: "BMS-B + cooling loop state" },
      { label: "constraint", value: "COOLING_WATER_MARGIN" },
      { label: "proof_row", value: "lp.cooling_water.row_056" },
    ],
  },
  {
    id: "storage",
    title: "UPS / BESS",
    input: "Reserve floor, state of charge, transition margin",
    bindingConstraint: "Reserve floor cannot be spent",
    proofObject: "Reserve-Floor Report",
    acceptedPosture: "Reject action that spends resilience margin",
    trustScore: 92,
    state: "reject",
    evidenceRows: [
      { label: "source", value: "UPS/BESS policy + read-only BMS" },
      { label: "constraint", value: "UPS_RESERVE_FLOOR" },
      { label: "proof_row", value: "reserve_floor.report_004" },
    ],
  },
  {
    id: "workload",
    title: "Workload",
    input: "Scheduler lanes, SLA locks, rack group eligibility",
    bindingConstraint: "SLA-locked inference lane",
    proofObject: "Accepted-Headroom Ledger",
    acceptedPosture: "Allow only eligible training load shift",
    trustScore: 81,
    state: "allow",
    evidenceRows: [
      { label: "source", value: "scheduler shadow export" },
      { label: "constraint", value: "SLA_LOCKED_LANE" },
      { label: "proof_row", value: "ledger.004921" },
    ],
  },
  {
    id: "telemetry",
    title: "Telemetry Trust",
    input: "Freshness, coverage, topology completeness",
    bindingConstraint: "Rack group source age exceeds policy",
    proofObject: "No-Proof Gap Register",
    acceptedPosture: "Discount capacity until evidence is restored",
    trustScore: 58,
    state: "no-proof",
    evidenceRows: [
      { label: "source", value: "trust scorer over EPMS/BMS/scheduler" },
      { label: "constraint", value: "SOURCE_AGE_EXCEEDED" },
      { label: "proof_row", value: "no_proof.row_012" },
    ],
  },
]

export const fleetEventPhases: FleetEventPhase[] = [
  {
    id: "baseline",
    label: "Baseline",
    gridEvent: "Normal operating posture",
    multiplier: 0.72,
  },
  {
    id: "stress",
    label: "Grid Stress",
    gridEvent: "Utility requests flexible-load posture",
    multiplier: 0.94,
  },
  {
    id: "rta",
    label: "RTA Decision",
    gridEvent: "Site envelopes apply local policy",
    multiplier: 1,
  },
  {
    id: "recovery",
    label: "Recovery",
    gridEvent: "Safe reconnection envelope verified",
    multiplier: 0.86,
  },
]

export const fleetSwarmSites: FleetSwarmSite[] = [
  {
    id: "atl-1",
    name: "ATL-1",
    region: "Southeast",
    state: "shadow",
    stateLabel: "Shadow",
    role: "AI training campus",
    proofRoot: "8f4c...91a",
    acceptedMw: "5.8 MW illustrative",
    acceptedMwValue: 5.8,
    noProofGaps: 3,
    detail: "Read-only proof collection with no write credentials.",
  },
  {
    id: "phx-4",
    name: "PHX-4",
    region: "Southwest",
    state: "advisory",
    stateLabel: "Advisory",
    role: "Inference cluster",
    proofRoot: "4a20...b8e",
    acceptedMw: "3.1 MW illustrative",
    acceptedMwValue: 3.1,
    noProofGaps: 1,
    detail: "Operators review repaired actions before any dispatch envelope change.",
  },
  {
    id: "dfw-2",
    name: "DFW-2",
    region: "ERCOT",
    state: "bounded",
    stateLabel: "Bounded",
    role: "Hybrid power campus",
    proofRoot: "bb91...0e5",
    acceptedMw: "4.4 MW illustrative",
    acceptedMwValue: 4.4,
    noProofGaps: 0,
    detail: "Narrow actuator set inside declared envelope and runtime assurance.",
  },
  {
    id: "iad-7",
    name: "IAD-7",
    region: "Mid-Atlantic",
    state: "production",
    stateLabel: "Production",
    role: "Colocation facility",
    proofRoot: "c712...af0",
    acceptedMw: "2.9 MW illustrative",
    acceptedMwValue: 2.9,
    noProofGaps: 0,
    detail: "Evidence aggregation only; site policy remains the approval boundary.",
  },
  {
    id: "reno-1",
    name: "RNO-1",
    region: "West",
    state: "no-proof",
    stateLabel: "No-Proof",
    role: "Bridge power deployment",
    proofRoot: "pending",
    acceptedMw: "0.0 MW accepted",
    acceptedMwValue: 0,
    noProofGaps: 4,
    detail: "Fleet view refuses capacity until topology and telemetry trust recover.",
  },
]

export const proofStorySteps: ProofStoryStep[] = [
  {
    id: "claim",
    eyebrow: "Step 01",
    title: "Start with claimed headroom",
    body: "The story begins with a capacity claim that has not yet earned operator trust.",
    artifact: "Observed nominal headroom",
    state: "no-proof",
    rows: [
      { label: "nominal_headroom", value: "18.4 MW illustrative" },
      { label: "proof_posture", value: "claim only" },
    ],
  },
  {
    id: "constraints",
    eyebrow: "Step 02",
    title: "Bind every active constraint",
    body: "Power, cooling, reserve, workload, and telemetry trust each reduce unsupported headroom.",
    artifact: "Constraint braid",
    state: "repair",
    rows: [
      { label: "binding", value: "reserve floor + telemetry trust" },
      { label: "capacity_after", value: "5.8 MW illustrative" },
    ],
  },
  {
    id: "rta",
    eyebrow: "Step 03",
    title: "Run the RTA decision",
    body: "The runtime assurance layer allows, repairs, rejects, or returns no-proof before authority expands.",
    artifact: "RTA trace",
    state: "allow",
    rows: [
      { label: "decision", value: "ALLOW after repair" },
      { label: "authority", value: "solver + RTA gate" },
    ],
  },
  {
    id: "export",
    eyebrow: "Step 04",
    title: "Export the proof pack",
    body: "Accepted capacity becomes an inspectable proof object, not a hidden dashboard claim.",
    artifact: "Proof Pack",
    state: "allow",
    rows: [
      { label: "artifact", value: "Load Passport + ledger + evidence packet" },
      { label: "proof_root", value: "8f4c...91a" },
    ],
  },
]

export const demoModeOverlays: DemoModeOverlayFixture[] = [
  {
    mode: "Inspect",
    title: "Inspect evidence",
    body: "Shows telemetry freshness, binding constraints, and margin to limit for the selected scenario.",
    focusLabel: "Evidence lens",
    rows: [
      { label: "telemetry", value: "freshness, coverage, topology" },
      { label: "constraint", value: "active binding limit" },
      { label: "output", value: "proof row and margin" },
    ],
  },
  {
    mode: "Explain",
    title: "Explain authority",
    body: "Follows proposal generation into deterministic solver checks and runtime assurance decisions.",
    focusLabel: "Authority lens",
    rows: [
      { label: "proposal", value: "advisory only" },
      { label: "gate", value: "solver + RTA" },
      { label: "failure", value: "no-proof, reject, or repaired action" },
    ],
  },
  {
    mode: "Export",
    title: "Export proof",
    body: "Maps the selected trace to Load Passport, ledger, RTA trace, and utility evidence packet objects.",
    focusLabel: "Export lens",
    rows: [
      { label: "manifest", value: "proof_pack_manifest.json" },
      { label: "ledger", value: "accepted_headroom.parquet" },
      { label: "packet", value: "utility_evidence_packet.pdf" },
    ],
  },
]

export const xrayLayers: XrayLayer[] = [
  {
    id: "facility",
    title: "Facility layer",
    layer: "Feeders, transformers, UPS/BESS, cooling loops",
    body: "Physical infrastructure becomes a typed topology graph before any capacity is counted.",
    proofObject: "Topology map",
    state: "repair",
    telemetry: "EPMS-A, BMS-B, UPS/BESS read-only feeds",
    contribution: "-7.2 MW",
  },
  {
    id: "workload",
    title: "Workload layer",
    layer: "Training lanes, inference locks, rack groups",
    body: "Workload eligibility separates movable training demand from protected SLA lanes.",
    proofObject: "Load Behavior Profile",
    state: "allow",
    telemetry: "scheduler shadow export",
    contribution: "-1.8 MW",
  },
  {
    id: "trust",
    title: "Trust layer",
    layer: "Freshness, source coverage, topology confidence",
    body: "Weak or stale evidence becomes no-proof, not hidden capacity.",
    proofObject: "Telemetry Trust Score",
    state: "no-proof",
    telemetry: "trust scorer",
    contribution: "-1.3 MW",
  },
  {
    id: "proof",
    title: "Proof layer",
    layer: "RTA trace, ledger, utility packet",
    body: "Accepted virtual capacity is exported as evidence for operators and stakeholders.",
    proofObject: "Proof Pack",
    state: "allow",
    telemetry: "receipt stream + cold-path replay",
    contribution: "5.8 MW",
  },
]

export const proofComparison: ProofComparisonFixture = {
  title: "Claimed headroom versus proof-adjusted capacity",
  body: "Illustrative sample. The right side is not a guarantee; it shows the evidence shape after constraints, policy, and no-proof gaps are applied.",
  beforeLabel: "Before proof",
  afterLabel: "After proof",
  beforeMw: "18.4 MW claimed",
  afterMw: "5.8 MW proof-adjusted",
  beforeRows: [
    { label: "capacity_basis", value: "nominal headroom" },
    { label: "constraint_status", value: "unknown active limits" },
    { label: "evidence", value: "no accepted proof root" },
    { label: "risk", value: "static buffers and no-proof gaps hidden" },
  ],
  afterRows: [
    { label: "capacity_basis", value: "accepted-headroom ledger" },
    { label: "constraint_status", value: "known binding constraints" },
    { label: "evidence", value: "proof_root 8f4c...91a" },
    { label: "risk", value: "no-proof gaps visible and owner-assigned" },
  ],
}

export const viewTransitionTargets = {
  waterfallAccepted: "gn-waterfall-accepted",
  rtaTrace: "gn-rta-trace",
  proofArtifact: "gn-proof-artifact",
  proofExport: "gn-proof-export",
} as const
