import type { DispatchEnvelopeDTO, DispatchEnvelopeSpec, DomainId, EnvelopeSample } from "@/types/dispatch-envelope"

import { DISPATCH_DOMAIN_IDS } from "./constants"
import { constraintLimitAt, envelopeBreakpoints, envelopeEndMinute, envelopeMwAt } from "./curves"
import { dispatchProofEligibleAt, evaluateDispatchEvidence } from "./evidence"

export { constraintLimitAt, envelopeBreakpoints, envelopeEndMinute, envelopeMwAt } from "./curves"
export { acceptedCurveViolations, type DispatchCurveViolation } from "./evidence"

export function buildEnvelopeSamples(dto: DispatchEnvelopeDTO, sampleCount = 96): EnvelopeSample[] {
  const endMinute = getVisualizationEndMinute(dto.request, dto.accepted)
  if (!Number.isInteger(sampleCount) || sampleCount < 2) throw new Error("Envelope sampling requires at least two samples")
  const step = endMinute / (sampleCount - 1)
  const constraints = new Map(dto.constraints.map((constraint) => [constraint.id, constraint]))
  const criticalIds = dto.constraints.filter((constraint) => constraint.isDecisionCritical).map((constraint) => constraint.id)
  const evaluation = evaluateDispatchEvidence(dto)
  const minutes = [...new Set([
    ...Array.from({ length: sampleCount }, (_, index) => Math.round(index * step * 1000) / 1000),
    ...envelopeBreakpoints(dto.request),
    ...(dto.accepted ? envelopeBreakpoints(dto.accepted) : []),
    ...dto.constraints.flatMap((constraint) => (constraint.limitSamples ?? []).map((point) => point.minute)),
    ...dto.proofIntervals.flatMap((interval) => [interval.startMinute, interval.endMinute]),
  ].filter((minute) => minute >= 0 && minute <= endMinute))].sort((left, right) => left - right)

  return minutes.map((minute) => {
    const requestedMw = envelopeMwAt(dto.request, minute)
    const acceptedMw = dto.accepted ? envelopeMwAt(dto.accepted, minute) : 0
    const limits = {} as Record<DomainId, number | null>
    const trusted = {} as Record<DomainId, boolean>
    const lowerConfidence: Partial<Record<DomainId, number>> = {}
    const upperConfidence: Partial<Record<DomainId, number>> = {}
    for (const domainId of DISPATCH_DOMAIN_IDS) {
      const constraint = constraints.get(domainId)
      const limit = constraint ? constraintLimitAt(constraint, minute) : null
      limits[domainId] = limit?.maxMw ?? null
      trusted[domainId] = limit?.trusted ?? false
      if (limit?.lowerConfidenceMw != null) lowerConfidence[domainId] = limit.lowerConfidenceMw
      if (limit?.upperConfidenceMw != null) upperConfidence[domainId] = limit.upperConfidenceMw
    }
    const binding = criticalIds.filter((id) => trusted[id] && limits[id] !== null)
      .reduce<DomainId | null>((best, id) => best === null || limits[id]! < limits[best]! ? id : best, null)
    return {
      minute, requestedMw, acceptedMw,
      repairDeltaMw: Math.max(0, requestedMw - acceptedMw),
      limits, trusted, lowerConfidence, upperConfidence,
      bindingDomainId: requestedMw > 0 ? binding : null,
      proofEligible: dispatchProofEligibleAt(evaluation, minute),
    }
  })
}

/** Chart padding is display space, not an extension of the decision's evidence window. */
export function getVisualizationEndMinute(request: DispatchEnvelopeSpec, accepted: DispatchEnvelopeSpec | null) {
  const max = Math.max(envelopeEndMinute(request), accepted ? envelopeEndMinute(accepted) : 0, 34)
  return Math.ceil(max / 5) * 5
}
