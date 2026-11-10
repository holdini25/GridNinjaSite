import { DispatchEnvelopeDTOSchema } from "@/schemas/dispatch-envelope.schema"
import type { DispatchCurveViolation, DispatchDomainConstraint, DispatchEnvelopeDTO, DispatchEnvelopeSpec, DomainId } from "@/types/dispatch-envelope"

import { constraintLimitAt, DISPATCH_EPSILON, envelopeBreakpoints, envelopeEndMinute, envelopeMwAt } from "./curves"

export type { DispatchCurveViolation } from "@/types/dispatch-envelope"

export type DispatchEvidenceIssue = DispatchCurveViolation | Readonly<{
  reason: "invalid-record" | "invalid-curve" | "scalar-limit"
  message: string
  domainId?: DomainId
  minute?: number
}>

export type DispatchEvidenceEvaluation = Readonly<{
  eligible: boolean
  decisionEndMinute: number | null
  issues: readonly DispatchEvidenceIssue[]
}>

type ScalarLimits = Pick<DispatchDomainConstraint, "maxMw" | "maxHoldMinutes" | "maxRampUpMwPerMin" | "earliestStartMinute" | "requiredRecoveryMinutes" | "reboundLimitMw">

function exceedsScalarLimits(accepted: DispatchEnvelopeSpec, constraint: ScalarLimits) {
  return accepted.maxMw > constraint.maxMw + DISPATCH_EPSILON
    || accepted.holdMinutes > constraint.maxHoldMinutes + DISPATCH_EPSILON
    || accepted.rampUpMwPerMin > constraint.maxRampUpMwPerMin + DISPATCH_EPSILON
    || accepted.startMinute + DISPATCH_EPSILON < constraint.earliestStartMinute
    || accepted.recoveryMinutes + DISPATCH_EPSILON < constraint.requiredRecoveryMinutes
    || accepted.reboundLimitMw > constraint.reboundLimitMw + DISPATCH_EPSILON
}

/** This is an authored-record consistency check, never a feasibility solver or operating permission. */
export function evaluateDispatchEvidence(dto: DispatchEnvelopeDTO): DispatchEvidenceEvaluation {
  // Display callers can receive unvalidated runtime values despite the DTO type.
  // Validate every supplied field/domain, including NO-PROOF and noncritical curves.
  const structure = DispatchEnvelopeDTOSchema.safeParse(dto)
  if (!structure.success) return {
    eligible: false,
    decisionEndMinute: null,
    issues: structure.error.issues.map((issue) => ({
      reason: issue.path.includes("limitSamples") ? "invalid-curve" as const : "invalid-record" as const,
      message: issue.message,
    })),
  }
  const issues: DispatchEvidenceIssue[] = []
  const invalid = (message: string) => issues.push({ reason: "invalid-record", message })
  let decisionEndMinute: number | null = null
  try {
    // Validate both geometries even when the selected decision uses only one.
    envelopeBreakpoints(dto.request)
    if (dto.accepted) envelopeBreakpoints(dto.accepted)
    decisionEndMinute = envelopeEndMinute(dto.accepted ?? dto.request)
    const end = decisionEndMinute
    if (end <= 0) invalid("Decision window must have positive duration")
    const critical = dto.constraints.filter((constraint) => constraint.isDecisionCritical)
    if (!critical.length) invalid("At least one decision-critical domain is required")
    const hasCapacity = dto.decision === "allow" || dto.decision === "repair"
    if (hasCapacity && (!dto.accepted || dto.accepted.maxMw <= 0)) invalid("ALLOW and REPAIR require a positive accepted envelope")
    if (!hasCapacity && dto.accepted !== null) invalid("REJECT and NO-PROOF must not include accepted envelope")
    if (hasCapacity && critical.some((constraint) => constraint.isTrusted && constraint.state === "hard-block")) invalid("Accepted capacity cannot coexist with a trusted decision-critical hard block")
    if (dto.decision === "reject" && !critical.some((constraint) => constraint.state === "hard-block" && constraint.isTrusted && dto.bindings.some((binding) => binding.domainId === constraint.id && binding.reasonCode === constraint.reasonCode && binding.severity === "reject"))) invalid("REJECT requires a trusted decision-critical hard block and matching binding")
    const sameSpecs = dto.accepted !== null && (Object.keys(dto.request) as Array<keyof DispatchEnvelopeSpec>).every((key) => dto.request[key] === dto.accepted![key])
    if (dto.decision === "allow" && !sameSpecs) invalid("ALLOW accepted envelope must exactly equal request")
    if (dto.decision === "repair" && (sameSpecs || !dto.bindings.length)) invalid("REPAIR requires a positive repair delta and repair bindings")
    for (const binding of dto.bindings) {
      const constraint = dto.constraints.find((candidate) => candidate.id === binding.domainId)
      if (!constraint || constraint.reasonCode !== binding.reasonCode || binding.severity !== (dto.decision === "allow" ? "info" : dto.decision)
        || (typeof binding.delta === "number" && (!Number.isFinite(binding.delta) || binding.delta <= 0))) invalid("Binding must match the decision, domain reason, and positive delta")
    }
    if (dto.evidenceClass !== "illustrative" && dto.authority !== "signed-read-only") invalid("Validated envelopes must be signed-read-only")
    else if (dto.evidenceClass === "illustrative" ? dto.authority !== "illustrative-demo" || dto.signature !== "illustrative:unsigned" : !dto.signature.startsWith("ed25519:")) invalid("Evidence class, authority, and signature must agree")

    const intervals = dto.proofIntervals
    if (Math.abs(intervals.at(-1)!.endMinute - end) > DISPATCH_EPSILON) invalid("Proof intervals must cover the complete decision window, including recovery")
    if (intervals.some((interval) => interval.eligibility !== "eligible")) invalid("Proof-bearing decisions cannot contain ineligible intervals")

    if (dto.accepted) {
      const requestLimits: ScalarLimits = { maxMw: dto.request.maxMw, maxHoldMinutes: dto.request.holdMinutes, maxRampUpMwPerMin: dto.request.rampUpMwPerMin, earliestStartMinute: dto.request.startMinute, requiredRecoveryMinutes: dto.request.recoveryMinutes, reboundLimitMw: dto.request.reboundLimitMw }
      if (exceedsScalarLimits(dto.accepted, requestLimits)) issues.push({ reason: "scalar-limit", message: "Accepted envelope exceeds the request" })
    }

    for (const constraint of critical) {
      if (dto.accepted && exceedsScalarLimits(dto.accepted, constraint)) issues.push({ reason: "scalar-limit", domainId: constraint.id, message: `Accepted envelope exceeds trusted ${constraint.id} limits` })
      const breakpoints = [...new Set([
        ...envelopeBreakpoints(dto.accepted ?? dto.request),
        ...(constraint.limitSamples ?? []).map((point) => point.minute),
        ...intervals.flatMap((interval) => [interval.startMinute, interval.endMinute]),
      ].filter((minute) => minute >= 0 && minute <= end))].sort((left, right) => left - right)
      // A difference of continuous linear pieces has extrema at their joint endpoints.
      // Midpoints also test trust on the open interpolation intervals.
      const times = [...breakpoints, ...breakpoints.slice(1).map((minute, index) => (minute + breakpoints[index]) / 2)]
      for (const minute of times) {
        const limit = constraintLimitAt(constraint, minute)
        if (!limit) issues.push({ reason: "missing-coverage", domainId: constraint.id, minute, message: `${constraint.id} lacks evidence coverage at minute ${minute}` })
        else if (!limit.trusted || constraint.proofEligibility !== "eligible") issues.push({ reason: "untrusted", domainId: constraint.id, minute, message: `${constraint.id} evidence is untrusted at minute ${minute}` })
        else if (dto.accepted && envelopeMwAt(dto.accepted, minute) > limit.maxMw + DISPATCH_EPSILON) issues.push({ reason: "mw-exceeded", domainId: constraint.id, minute, message: `Accepted envelope exceeds ${constraint.id} curve at minute ${minute}` })
      }
    }
  } catch {
    invalid("Dispatch record contains invalid envelope geometry")
  }
  return { eligible: dto.decision !== "no-proof" && issues.length === 0, decisionEndMinute, issues }
}

export function dispatchProofEligibleAt(evaluation: DispatchEvidenceEvaluation, minute: number) {
  return evaluation.eligible && Number.isFinite(minute) && minute >= 0
    && evaluation.decisionEndMinute !== null && minute <= evaluation.decisionEndMinute
}


/**
 * Curve-only diagnostics from the shared evidence evaluator. A legitimate null
 * accepted envelope has no accepted-curve violations, including REJECT/NO-PROOF.
 * Malformed structure/geometry throws because an empty list would hide that no
 * evaluation occurred. An empty list is NOT proof eligibility: callers must use
 * evaluateDispatchEvidence for scalar, decision, binding, and authority checks.
 */
export function acceptedCurveViolations(dto: DispatchEnvelopeDTO): readonly DispatchCurveViolation[] {
  const evaluation = evaluateDispatchEvidence(dto)
  if (evaluation.decisionEndMinute === null) throw new Error(`Cannot evaluate accepted curve: ${evaluation.issues[0]?.message ?? "invalid dispatch record"}`)
  if (dto.accepted === null) return []
  return evaluation.issues.filter((issue): issue is DispatchCurveViolation =>
    issue.reason === "missing-coverage" || issue.reason === "untrusted" || issue.reason === "mw-exceeded")
}
