import { DispatchEnvelopeDTOSchema } from "@/schemas/dispatch-envelope.schema"
import { DISPATCH_DOMAIN_IDS, DISPATCH_DOMAIN_META } from "@/lib/dispatch-envelope/constants"
import { buildDimensionAudit } from "@/lib/dispatch-envelope/dimension-audit"
import { assertDispatchEnvelopeInvariants } from "@/lib/dispatch-envelope/invariants"
import { buildEnvelopeSamples, envelopeEndMinute } from "@/lib/dispatch-envelope/normalize"
import { rankConstraints } from "@/lib/dispatch-envelope/binding-rank"
import type {
  ConstraintState,
  DispatchBinding,
  DispatchDecision,
  DispatchDomainConstraint,
  DispatchEnvelopeDTO,
  DispatchEnvelopeSpec,
  DomainId,
  ProofEligibility,
} from "@/types/dispatch-envelope"
import type { SectionCopy } from "@/types/site"

export type {
  ConstraintState,
  DispatchDecision,
  DispatchEnvelopeDTO,
  DispatchEnvelopeSpec,
  DomainId as DispatchDomainId,
}

export type DispatchScenario = {
  id: string
  label: string
  subtitle: string
  primaryReason: string
  plainReason: string
  blockMinute?: number
  dto: DispatchEnvelopeDTO
}

export type DispatchEventMarker = {
  label: string
  short: string
  time: number
}

export const dispatchEnvelopeHero: SectionCopy = {
  eyebrow: "AI Data Center Virtual Capacity Control Plane",
  headline:
    "How much virtual capacity is safe, for how long, and under which evidence?",
  body: "GridNinja turns constrained infrastructure into safe, usable, auditable capacity by rendering a signed dispatch envelope: the requested MW, the accepted MW, the binding constraints, and the proof trail behind every allow / repair / reject / no-proof decision.",
}

export const dispatchEnvelopeSections = {
  roleMap: {
    eyebrow: "Dispatch Envelope",
    headline: "The runtime-assured capacity aperture, not a dashboard claim",
    body: "The dispatch envelope shows what an AI data center can safely use, sell, defer, or refuse inside declared electrical, storage, cooling, bridge-power, workload, telemetry, and policy limits. It is designed for Shadow Mode first, then bounded autonomy only after proof accumulates.",
  },
  proof: {
    eyebrow: "Proof Artifacts",
    headline: "Every accepted MW should point to replayable evidence",
    body: "The visual exposes proof roots, policy versions, topology hashes, freshness, confidence, and artifact names so operators can inspect why a capacity claim was allowed, repaired, rejected, or withheld as no-proof.",
  },
  cta: {
    headline: "Turn site constraints into a Capacity Audit",
    body: "Use Shadow Mode to quantify safe sellable MW, binding constraints, proof gaps, and the decision path before autonomy or capacity commitments expand.",
  },
} satisfies Record<string, SectionCopy>

export const dispatchEnvelopeOutcomeCards = [
  {
    label: "Requested envelope",
    value: "4.0 MW",
    body: "The operator or workload plan asks for a timed capacity maneuver.",
  },
  {
    label: "Accepted envelope",
    value: "2.8 MW",
    body: "Runtime assurance repairs the request into the safe, usable envelope.",
  },
  {
    label: "Binding source",
    value: "UPS / BESS",
    body: "The evidence trail identifies the limiting domain instead of hiding it.",
  },
] as const

export const dispatchDomainMeta = DISPATCH_DOMAIN_META

const issuedAt = "2026-06-18T00:00:00.000Z"

export const dispatchScenarios: DispatchScenario[] = [
  buildScenario({
    id: "grid-stress",
    label: "Grid stress",
    subtitle: "Reserve-limited",
    decision: "repair",
    request: spec(4, 0, 20, 1, 1, 6, 1),
    accepted: spec(2.8, 1, 20, 0.7, 0.8, 12, 0.8),
    primaryReason:
      "UPS reserve floor clipped the request from 4.0 MW to 2.8 MW; cooling margin delayed start by one minute.",
    plainReason:
      "The site can support the requested 20-minute event, but the declared UPS/BESS reserve floor limits the action to 2.8 MW. Cooling conditions require a one-minute delayed start.",
    proofRoot: "8f4c2d16...91a7",
    policy: "operator-policy-v14",
    topology: "83c4...91f",
    constraints: [
      constraint("electrical", 3.5, 26, 1.1, 0, 8, 1, "available", 99, 184, {
        reasonCode: "T2_FEEDER_MARGIN_CLEAR",
        reason: "T2 feeder margin remains positive throughout the event.",
        artifact: "electrical_margin_trace.json",
      }),
      constraint("storage", 2.8, 20, 0.7, 0, 12, 0.8, "binding", 97, 212, {
        reasonCode: "UPS_RESERVE_FLOOR",
        reason:
          "Emergency reserve floor must remain above the operator-declared minimum.",
        artifact: "reserve_floor_report.csv",
      }),
      constraint("cooling-water", 3.2, 24, 0.8, 1, 9, 0.9, "binding", 96, 246, {
        reasonCode: "COOLING_SAFE_START",
        reason: "Loop B thermal margin requires a one-minute delayed start.",
        artifact: "cooling_water_envelope.json",
      }),
      constraint("bridge-power", 4.4, 30, 1.2, 0, 6, 1.2, "available", 98, 305, {
        reasonCode: "BRIDGE_AVAILABLE_UNUSED",
        reason:
          "Bridge-power assets remain available but are not required by the accepted envelope.",
        artifact: "bridge_power_state.json",
        isDecisionCritical: false,
      }),
      constraint("workload-sla", 3.8, 28, 1, 0, 7, 1, "available", 99, 128, {
        reasonCode: "SLA_FLEX_CLEAR",
        reason: "Flexible training workload remains inside SLA policy.",
        artifact: "sla_constraint_manifest.json",
      }),
      constraint("telemetry-policy", 4, 28, 1, 0, 8, 1, "available", 99, 184, {
        reasonCode: "TELEMETRY_CURRENT",
        reason:
          "Decision-critical telemetry is current and topology-consistent.",
        artifact: "telemetry_manifest.json",
      }),
    ],
    bindings: [
      binding("storage", "mw", 4, 2.8, "UPS_RESERVE_FLOOR", "repair"),
      binding("cooling-water", "start", "T+0", "T+1", "COOLING_SAFE_START", "repair"),
      binding("storage", "ramp-up", 1, 0.7, "UPS_RESERVE_FLOOR", "repair"),
      binding("storage", "recovery", 6, 12, "UPS_RESERVE_FLOOR", "repair"),
      binding("storage", "rebound", 1, 0.8, "UPS_RESERVE_FLOOR", "repair"),
    ],
  }),
  buildScenario({
    id: "normal",
    label: "Normal operation",
    subtitle: "All limits clear",
    decision: "allow",
    request: spec(3, 0, 15, 0.75, 0.75, 6, 0.6),
    accepted: spec(3, 0, 15, 0.75, 0.75, 6, 0.6),
    primaryReason: "The complete request remains inside every trusted envelope.",
    plainReason:
      "Electrical, storage, cooling, workload, and evidence constraints all remain clear for the requested dispatch.",
    proofRoot: "24bc91af...c8d2",
    policy: "operator-policy-v14",
    topology: "83c4...91f",
    constraints: [
      constraint("electrical", 4.2, 30, 1.2, 0, 7, 0.8, "available", 99, 170, {
        reasonCode: "ELECTRICAL_MARGIN_CLEAR",
        reason: "Electrical margin remains above 1.2 MW.",
        artifact: "electrical_margin_trace.json",
      }),
      constraint("storage", 3.6, 23, 0.9, 0, 9, 0.7, "available", 98, 201, {
        reasonCode: "RESERVE_CLEAR",
        reason: "UPS/BESS reserve remains above policy floor.",
        artifact: "reserve_floor_report.csv",
      }),
      constraint("cooling-water", 3.8, 26, 1, 0, 8, 0.8, "available", 98, 228, {
        reasonCode: "THERMAL_MARGIN_CLEAR",
        reason: "Thermal margin remains inside envelope.",
        artifact: "cooling_water_envelope.json",
      }),
      constraint("bridge-power", 5, 35, 1.4, 0, 6, 0.9, "available", 98, 295, {
        reasonCode: "BRIDGE_AVAILABLE_UNUSED",
        reason: "Bridge-power capacity is available but unused.",
        artifact: "bridge_power_state.json",
        isDecisionCritical: false,
      }),
      constraint("workload-sla", 3.5, 24, 0.9, 0, 7, 0.6, "available", 99, 121, {
        reasonCode: "WORKLOAD_FLEX_CLEAR",
        reason: "Workload class is flexible and within SLA.",
        artifact: "sla_constraint_manifest.json",
      }),
      constraint("telemetry-policy", 4, 25, 1, 0, 7, 0.6, "available", 99, 170, {
        reasonCode: "TELEMETRY_CURRENT",
        reason: "All decision-critical sources are current.",
        artifact: "telemetry_manifest.json",
      }),
    ],
    bindings: [],
  }),
  buildScenario({
    id: "cooling-contingency",
    label: "Cooling contingency",
    subtitle: "Hard thermal block",
    decision: "reject",
    request: spec(4.5, 0, 18, 0.9, 0.8, 10, 1.1),
    accepted: null,
    primaryReason:
      "A trusted cooling hard constraint makes the requested dispatch unavailable.",
    plainReason:
      "Cooling Loop B is in a contingency state. Current thermal capacity cannot support the requested workload ramp, and no bounded repair exists.",
    proofRoot: "cf98180e...2a17",
    policy: "operator-policy-v14",
    topology: "83c4...91f",
    blockMinute: 4,
    constraints: [
      constraint("electrical", 4, 24, 1, 0, 8, 1.1, "available", 99, 190, {
        reasonCode: "ELECTRICAL_NOT_LIMITING",
        reason: "Electrical system is not the limiting domain.",
        artifact: "electrical_margin_trace.json",
      }),
      constraint("storage", 3.5, 20, 0.8, 0, 10, 1, "available", 98, 225, {
        reasonCode: "RESERVE_CANNOT_REPAIR_THERMAL",
        reason: "Reserve floor cannot repair the thermal block.",
        artifact: "reserve_floor_report.csv",
      }),
      constraint("cooling-water", 0, 0, 0, 0, 20, 0, "hard-block", 99, 202, {
        reasonCode: "COOLING_LOOP_B_CONTINGENCY",
        reason: "Cooling Loop B contingency removes the safe thermal envelope.",
        artifact: "cooling_contingency_report.json",
      }),
      constraint("bridge-power", 4.6, 28, 1.2, 0, 7, 1.2, "available", 98, 310, {
        reasonCode: "POWER_CANNOT_REPAIR_THERMAL",
        reason: "Additional power cannot repair a thermal hard block.",
        artifact: "bridge_power_state.json",
        isDecisionCritical: false,
      }),
      constraint("workload-sla", 4, 20, 0.9, 0, 8, 1.1, "available", 98, 139, {
        reasonCode: "WORKLOAD_FLEX_INSUFFICIENT",
        reason:
          "Workload flexibility exists but cannot be accepted without cooling margin.",
        artifact: "sla_constraint_manifest.json",
      }),
      constraint("telemetry-policy", 4.5, 24, 1, 0, 9, 1.1, "available", 99, 190, {
        reasonCode: "EVIDENCE_CURRENT_REJECT",
        reason: "Evidence is current; the rejection is a trusted safety result.",
        artifact: "telemetry_manifest.json",
      }),
    ],
    bindings: [
      binding("cooling-water", "mw", 4.5, 0, "COOLING_LOOP_B_CONTINGENCY", "reject"),
    ],
  }),
  buildScenario({
    id: "telemetry-loss",
    label: "Telemetry loss",
    subtitle: "BESS evidence stale",
    decision: "no-proof",
    request: spec(2.2, 0, 12, 0.7, 0.7, 8, 0.5),
    accepted: null,
    primaryReason:
      "GridNinja cannot establish a reserve-safe dispatch envelope because BESS SOC evidence is stale.",
    plainReason:
      "The physical request may be feasible, but decision-critical BESS state-of-charge telemetry is outside the declared freshness limit. The correct result is no-proof.",
    proofRoot: "NO_PROOF_GAP_0317",
    policy: "operator-policy-v14",
    topology: "83c4...91f",
    constraints: [
      constraint("electrical", 3.8, 24, 1, 0, 7, 0.6, "available", 99, 192, {
        reasonCode: "ELECTRICAL_EVIDENCE_CURRENT",
        reason: "Electrical evidence is current.",
        artifact: "electrical_margin_trace.json",
      }),
      constraint("storage", 2.8, 20, 0.7, 0, 12, 0.5, "no-proof", 41, 18400, {
        reasonCode: "BESS_SOC_STALE",
        reason:
          "BESS SOC telemetry exceeds the 500 ms decision-critical freshness policy.",
        artifact: "no_proof_gap_register.json",
        isTrusted: false,
        proofEligibility: "not-eligible",
      }),
      constraint("cooling-water", 3.2, 22, 0.9, 0, 8, 0.5, "available", 98, 230, {
        reasonCode: "COOLING_EVIDENCE_CURRENT",
        reason: "Cooling evidence is current.",
        artifact: "cooling_water_envelope.json",
      }),
      constraint("bridge-power", 4, 28, 1.1, 0, 6, 0.5, "available", 97, 302, {
        reasonCode: "BRIDGE_CANNOT_SUBSTITUTE_TRUST",
        reason: "Bridge power cannot substitute for unknown reserve state.",
        artifact: "bridge_power_state.json",
        isDecisionCritical: false,
      }),
      constraint("workload-sla", 3, 18, 0.8, 0, 7, 0.5, "available", 99, 132, {
        reasonCode: "WORKLOAD_EVIDENCE_CURRENT",
        reason: "Workload evidence is current.",
        artifact: "sla_constraint_manifest.json",
      }),
      constraint("telemetry-policy", 0, 0, 0, 0, 0, 0, "no-proof", 58, 18400, {
        reasonCode: "DECISION_EVIDENCE_INCOMPLETE",
        reason: "Decision-critical evidence path is incomplete.",
        artifact: "telemetry_manifest.json",
        isTrusted: false,
        proofEligibility: "not-eligible",
      }),
    ],
    bindings: [
      binding(
        "telemetry-policy",
        "trust",
        "trusted evidence",
        "no-proof",
        "DECISION_EVIDENCE_INCOMPLETE",
        "no-proof"
      ),
    ],
  }),
  buildScenario({
    id: "bridge-power",
    label: "Bridge power",
    subtitle: "Fuel-window limited",
    decision: "repair",
    request: spec(5, 0, 24, 1.25, 1, 8, 1.2),
    accepted: spec(3.4, 0, 18, 0.85, 0.85, 14, 0.9),
    primaryReason:
      "Bridge-power fuel policy clips the event to 3.4 MW for 18 minutes and extends recovery to 14 minutes.",
    plainReason:
      "The site can support a bounded bridge-power event, but the declared fuel window and recovery reserve reduce both MW and duration.",
    proofRoot: "7a33c2b1...d9f0",
    policy: "bridge-policy-v6",
    topology: "83c4...91f",
    constraints: [
      constraint("electrical", 4.6, 28, 1.2, 0, 8, 1.1, "available", 99, 183, {
        reasonCode: "ELECTRICAL_REPAIRED_CLEAR",
        reason: "Electrical margin supports the repaired envelope.",
        artifact: "electrical_margin_trace.json",
      }),
      constraint("storage", 3.8, 22, 0.9, 0, 11, 1, "available", 98, 208, {
        reasonCode: "STORAGE_REPAIRED_CLEAR",
        reason: "Storage reserve remains above emergency floor.",
        artifact: "reserve_floor_report.csv",
      }),
      constraint("cooling-water", 4.1, 24, 1, 0, 9, 1.1, "available", 97, 244, {
        reasonCode: "COOLING_REPAIRED_CLEAR",
        reason: "Cooling remains inside the repaired envelope.",
        artifact: "cooling_water_envelope.json",
      }),
      constraint("bridge-power", 3.4, 18, 0.85, 0, 14, 0.9, "binding", 96, 287, {
        reasonCode: "BRIDGE_FUEL_WINDOW",
        reason: "Fuel window and reserve policy limit MW, hold time, and recovery.",
        artifact: "bridge_power_fuel_window.json",
      }),
      constraint("workload-sla", 4.2, 26, 1, 0, 8, 1.1, "available", 99, 126, {
        reasonCode: "WORKLOAD_AVAILABLE",
        reason: "Workload flexibility remains available.",
        artifact: "sla_constraint_manifest.json",
      }),
      constraint("telemetry-policy", 5, 26, 1.2, 0, 9, 1.2, "available", 98, 183, {
        reasonCode: "EVIDENCE_CURRENT",
        reason: "All evidence is current and policy-compatible.",
        artifact: "telemetry_manifest.json",
      }),
    ],
    bindings: [
      binding("bridge-power", "mw", 5, 3.4, "BRIDGE_FUEL_WINDOW", "repair"),
      binding("bridge-power", "hold", 24, 18, "BRIDGE_FUEL_WINDOW", "repair"),
      binding("bridge-power", "ramp-up", 1.25, 0.85, "BRIDGE_FUEL_WINDOW", "repair"),
      binding("bridge-power", "recovery", 8, 14, "BRIDGE_FUEL_WINDOW", "repair"),
      binding("bridge-power", "rebound", 1.2, 0.9, "BRIDGE_FUEL_WINDOW", "repair"),
    ],
  }),
]

export function decisionLabel(decision: DispatchDecision) {
  return decision === "no-proof" ? "NO-PROOF" : decision.toUpperCase()
}

export function statusLabel(status: ConstraintState) {
  const labels: Record<ConstraintState, string> = {
    available: "Available",
    binding: "Binding",
    repair: "Repair",
    "hard-block": "Hard block",
    "no-proof": "No-proof",
    unknown: "Unknown",
  }

  return labels[status]
}

export function formatMw(value: number | null | undefined) {
  return value == null ? "-" : `${value.toFixed(1)} MW`
}

export function formatMin(value: number | null | undefined) {
  return value == null ? "-" : `${value} min`
}

export function isBindingStatus(status: ConstraintState) {
  return status === "binding" || status === "hard-block" || status === "no-proof"
}

export function getOrderedConstraints(scenario: DispatchScenario) {
  const samples = buildEnvelopeSamples(scenario.dto)
  const ranked = rankConstraints({
    samples,
    constraints: scenario.dto.constraints,
  })

  return ranked.map((rankedConstraint) => {
    const constraint = getConstraint(scenario, rankedConstraint.domainId)

    return {
      id: rankedConstraint.domainId,
      constraint,
      meta: dispatchDomainMeta[rankedConstraint.domainId],
      scoreLabel: rankedConstraint.scoreLabel,
      score: rankedConstraint.score,
    }
  })
}

export function getInitialConstraintId(scenario: DispatchScenario) {
  return getOrderedConstraints(scenario)[0]?.id ?? "electrical"
}

export function getConstraint(scenario: DispatchScenario, domainId: DomainId) {
  const constraint = scenario.dto.constraints.find(
    (candidate) => candidate.id === domainId
  )

  if (!constraint) {
    throw new Error(`Missing dispatch constraint: ${domainId}`)
  }

  return constraint
}

export function getDispatchDimensions(scenario: DispatchScenario) {
  return buildDimensionAudit(scenario.dto)
}

export function getEventMarkers(
  spec: DispatchEnvelopeSpec | null | undefined
): DispatchEventMarker[] {
  if (!spec || spec.maxMw <= 0) {
    return []
  }

  const rampEnd =
    spec.startMinute + spec.maxMw / Math.max(spec.rampUpMwPerMin, 0.001)
  const holdEnd = rampEnd + spec.holdMinutes
  const dispatchEnd =
    holdEnd + spec.maxMw / Math.max(spec.rampDownMwPerMin, 0.001)
  const recoveryEnd = dispatchEnd + spec.recoveryMinutes

  return [
    {
      label: "Start allowed",
      short: `T+${spec.startMinute.toFixed(0)}`,
      time: spec.startMinute,
    },
    {
      label: "Full accepted ramp",
      short: `T+${rampEnd.toFixed(0)}`,
      time: rampEnd,
    },
    {
      label: "Hold complete",
      short: `T+${holdEnd.toFixed(0)}`,
      time: holdEnd,
    },
    {
      label: "Recovery complete",
      short: `T+${recoveryEnd.toFixed(0)}`,
      time: recoveryEnd,
    },
  ]
}

export function buildDispatchEvidenceRecord(scenario: DispatchScenario) {
  const bindings = getOrderedConstraints(scenario).filter(({ constraint }) =>
    isBindingStatus(constraint.state)
  )

  return {
    schema_version: scenario.dto.schemaVersion,
    scenario: scenario.id,
    mode: "illustrative_read_only",
    requested_mw: scenario.dto.request.maxMw,
    accepted_mw: scenario.dto.accepted?.maxMw ?? null,
    decision: scenario.dto.decision,
    binding_constraints: bindings.map(({ id }) => id),
    proof_eligible: scenario.dto.constraints.every(
      (constraint) => constraint.state !== "no-proof"
    ),
    policy_version: scenario.dto.policyBundleVersion,
    topology_hash: scenario.dto.topologyHash,
    proof_root: scenario.dto.proofRoot,
    evidence_class: scenario.dto.evidenceClass,
    signature: scenario.dto.signature,
    authority: scenario.dto.authority,
  }
}

export function buildDispatchArtifactList(scenario: DispatchScenario) {
  return [
    "dispatch_envelope.json",
    "rta_trace.json",
    "accepted_headroom_ledger.parquet",
    "constraint_manifest.json",
    "proof_root.txt",
    ...scenario.dto.constraints.map((constraint) => constraint.evidenceArtifact),
  ].filter((artifact, index, artifacts) => artifacts.indexOf(artifact) === index)
}

export function buildDispatchExport(scenario: DispatchScenario) {
  return {
    ...scenario.dto,
    issuedAt: new Date().toISOString(),
  }
}

export function getScenarioProofEligible(scenario: DispatchScenario) {
  return scenario.dto.decision !== "no-proof"
}

export function getScenarioById(id: string | undefined) {
  return dispatchScenarios.find((scenario) => scenario.id === id)
}

export function getScenarioEventEnd(scenario: DispatchScenario) {
  return envelopeEndMinute(scenario.dto.accepted ?? scenario.dto.request)
}

function spec(
  maxMw: number,
  startMinute: number,
  holdMinutes: number,
  rampUpMwPerMin: number,
  rampDownMwPerMin: number,
  recoveryMinutes: number,
  reboundLimitMw: number
): DispatchEnvelopeSpec {
  return {
    startMinute,
    rampUpMwPerMin,
    maxMw,
    holdMinutes,
    rampDownMwPerMin,
    recoveryMinutes,
    reboundLimitMw,
  }
}

function constraint(
  id: DomainId,
  maxMw: number,
  maxHoldMinutes: number,
  maxRampUpMwPerMin: number,
  earliestStartMinute: number,
  requiredRecoveryMinutes: number,
  reboundLimitMw: number,
  state: ConstraintState,
  confidencePct: number,
  telemetryAgeMs: number,
  options: {
    reasonCode: string
    reason: string
    artifact: string
    isDecisionCritical?: boolean
    isTrusted?: boolean
    proofEligibility?: ProofEligibility
  }
): DispatchDomainConstraint {
  const isTrusted = options.isTrusted ?? state !== "no-proof"
  const isDecisionCritical =
    options.isDecisionCritical ??
    (id !== "bridge-power" ||
      state === "binding" ||
      state === "hard-block" ||
      state === "no-proof")

  return {
    id,
    label: dispatchDomainMeta[id].label,
    shortLabel: dispatchDomainMeta[id].short,
    state,
    isDecisionCritical,
    isTrusted,
    maxMw,
    maxHoldMinutes,
    maxRampUpMwPerMin,
    earliestStartMinute,
    requiredRecoveryMinutes,
    reboundLimitMw,
    telemetryAgeMs,
    confidencePct,
    reason: options.reason,
    reasonCode: options.reasonCode,
    evidenceArtifact: options.artifact,
    proofEligibility:
      options.proofEligibility ?? (isTrusted ? "eligible" : "not-eligible"),
    limitSamples: buildLimitSamples(maxMw, confidencePct, isTrusted),
  }
}

function buildLimitSamples(maxMw: number, confidencePct: number, trusted: boolean) {
  const spread = Math.max(0.04, maxMw * ((100 - confidencePct) / 100) * 0.24)

  return [0, 8, 20, 34, 48].map((minute, index) => {
    const modifier = maxMw === 0 ? 0 : index % 2 === 0 ? 0.98 : 1
    const value = maxMw * modifier

    return {
      minute,
      maxMw: value,
      lowerConfidenceMw: Math.max(0, value - spread),
      upperConfidenceMw: value + spread,
      trusted,
    }
  })
}

function binding(
  domainId: DomainId,
  field: DispatchBinding["field"],
  requested: number | string,
  accepted: number | string,
  reasonCode: string,
  severity: DispatchBinding["severity"]
): DispatchBinding {
  return {
    domainId,
    field,
    requested,
    accepted,
    delta:
      typeof requested === "number" && typeof accepted === "number"
        ? Math.abs(requested - accepted)
        : "changed",
    reasonCode,
    severity,
  }
}

function buildScenario(args: {
  id: string
  label: string
  subtitle: string
  decision: DispatchDecision
  request: DispatchEnvelopeSpec
  accepted: DispatchEnvelopeSpec | null
  primaryReason: string
  plainReason: string
  proofRoot: string
  policy: string
  topology: string
  constraints: DispatchDomainConstraint[]
  bindings: DispatchBinding[]
  blockMinute?: number
}): DispatchScenario {
  const parsed = DispatchEnvelopeDTOSchema.parse({
    schemaVersion: "dispatch-envelope.v1",
    siteId: "GRIDNINJA-DEMO-SITE",
    scenarioId: args.id,
    tapeId: `demo-tape-${args.id}`,
    topologyHash: args.topology,
    policyBundleVersion: args.policy,
    telemetryManifestId: `telemetry-manifest-${args.id}`,
    decision: args.decision,
    request: args.request,
    accepted: args.accepted,
    constraints: sortConstraints(args.constraints),
    bindings: args.bindings,
    proofRoot: args.proofRoot,
    evidenceClass: "illustrative",
    issuedAt,
    signature: "illustrative-demo-only",
    authority: "illustrative-demo",
  }) as DispatchEnvelopeDTO

  assertDispatchEnvelopeInvariants(parsed)

  return {
    id: args.id,
    label: args.label,
    subtitle: args.subtitle,
    primaryReason: args.primaryReason,
    plainReason: args.plainReason,
    blockMinute: args.blockMinute,
    dto: parsed,
  }
}

function sortConstraints(constraints: DispatchDomainConstraint[]) {
  return DISPATCH_DOMAIN_IDS.map((id) => {
    const constraint = constraints.find((candidate) => candidate.id === id)

    if (!constraint) {
      throw new Error(`Missing canonical dispatch domain: ${id}`)
    }

    return constraint
  })
}
