export type DispatchDecision = "allow" | "repair" | "reject" | "no-proof"

export type EvidenceClass =
  | "illustrative"
  | "replay-validated"
  | "shadow-validated"
  | "operator-accepted"

export type DomainId =
  | "electrical"
  | "storage"
  | "cooling-water"
  | "bridge-power"
  | "workload-sla"
  | "telemetry-policy"

export type ConstraintState =
  | "binding"
  | "available"
  | "repair"
  | "hard-block"
  | "no-proof"
  | "unknown"

export type ProofEligibility =
  | "eligible"
  | "not-eligible"
  | "partial"
  | "illustrative-only"

export interface DispatchEnvelopeSpec {
  startMinute: number
  rampUpMwPerMin: number
  maxMw: number
  holdMinutes: number
  rampDownMwPerMin: number
  recoveryMinutes: number
  reboundLimitMw: number
}

export interface DispatchLimitSample {
  minute: number
  maxMw: number
  lowerConfidenceMw?: number
  upperConfidenceMw?: number
  trusted: boolean
}

export interface DispatchProofInterval {
  startMinute: number
  endMinute: number
  eligibility: "eligible" | "not-eligible"
  reasonCode: string
}

export interface DispatchDomainConstraint {
  id: DomainId
  label: string
  shortLabel: string
  state: ConstraintState
  isDecisionCritical: boolean
  isTrusted: boolean
  maxMw: number
  maxHoldMinutes: number
  maxRampUpMwPerMin: number
  earliestStartMinute: number
  requiredRecoveryMinutes: number
  reboundLimitMw: number
  telemetryAgeMs: number | null
  confidencePct: number | null
  reason: string
  reasonCode: string
  evidenceArtifact: string
  proofEligibility: ProofEligibility
  limitSamples?: DispatchLimitSample[]
}

export interface DispatchBinding {
  domainId: DomainId
  field:
    | "mw"
    | "hold"
    | "ramp-up"
    | "start"
    | "recovery"
    | "rebound"
    | "trust"
  requested: number | string
  accepted: number | string
  delta: number | string
  reasonCode: string
  severity: "info" | "repair" | "reject" | "no-proof"
}

export interface DispatchEnvelopeDTO {
  schemaVersion: "dispatch-envelope.v1"
  siteId: string
  scenarioId: string
  tapeId: string
  topologyHash: string
  policyBundleVersion: string
  telemetryManifestId: string
  decision: DispatchDecision
  request: DispatchEnvelopeSpec
  accepted: DispatchEnvelopeSpec | null
  constraints: DispatchDomainConstraint[]
  bindings: DispatchBinding[]
  proofIntervals: DispatchProofInterval[]
  proofRoot: string
  evidenceClass: EvidenceClass
  issuedAt: string
  signature: string
  authority: "illustrative-demo" | "signed-read-only"
}

export interface EnvelopeSample {
  minute: number
  requestedMw: number
  acceptedMw: number
  repairDeltaMw: number
  limits: Record<DomainId, number | null>
  trusted: Record<DomainId, boolean>
  lowerConfidence: Partial<Record<DomainId, number>>
  upperConfidence: Partial<Record<DomainId, number>>
  bindingDomainId: DomainId | null
  proofEligible: boolean
}
