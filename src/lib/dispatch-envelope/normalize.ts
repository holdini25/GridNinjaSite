import type {
  DispatchDomainConstraint,
  DispatchEnvelopeDTO,
  DispatchEnvelopeSpec,
  DispatchLimitSample,
  DomainId,
  EnvelopeSample,
} from "@/types/dispatch-envelope"

import { DISPATCH_DOMAIN_IDS } from "./constants"

type PreparedConstraint = {
  constraint: DispatchDomainConstraint
  limitSamples: DispatchLimitSample[]
}

export function buildEnvelopeSamples(
  dto: DispatchEnvelopeDTO,
  sampleCount = 96
): EnvelopeSample[] {
  const endMinute = getVisualizationEndMinute(dto.request, dto.accepted)
  if (!Number.isInteger(sampleCount) || sampleCount < 2) throw new Error("Envelope sampling requires at least two samples")
  const step = endMinute / (sampleCount - 1)
  const constraints = prepareConstraints(dto.constraints)

  return Array.from({ length: sampleCount }, (_, index) => {
    const minute = round(index * step, 3)
    const requestedMw = envelopeMwAt(dto.request, minute)
    const acceptedMw = dto.accepted ? envelopeMwAt(dto.accepted, minute) : 0
    const limits = {} as Record<DomainId, number | null>
    const trusted = {} as Record<DomainId, boolean>
    const lowerConfidence: Partial<Record<DomainId, number>> = {}
    const upperConfidence: Partial<Record<DomainId, number>> = {}

    for (const domainId of DISPATCH_DOMAIN_IDS) {
      const limit = constraintLimitAt(constraints.get(domainId), minute)

      limits[domainId] = limit?.maxMw ?? null
      trusted[domainId] = limit?.trusted ?? false

      if (limit?.lowerConfidenceMw != null) {
        lowerConfidence[domainId] = limit.lowerConfidenceMw
      }

      if (limit?.upperConfidenceMw != null) {
        upperConfidence[domainId] = limit.upperConfidenceMw
      }
    }

    return {
      minute,
      requestedMw,
      acceptedMw,
      repairDeltaMw: Math.max(0, requestedMw - acceptedMw),
      limits,
      trusted,
      lowerConfidence,
      upperConfidence,
      bindingDomainId: findBindingDomain(limits, trusted, requestedMw),
      proofEligible: proofEligibleAt(dto, minute),
    }
  })
}

export function envelopeMwAt(spec: DispatchEnvelopeSpec, minute: number) {
  assertFeasibleSpec(spec)
  if (!Number.isFinite(minute)) throw new Error("Envelope minute must be finite")
  if (spec.maxMw === 0) return 0
  const rampStart = spec.startMinute
  const rampEnd =
    rampStart + spec.maxMw / spec.rampUpMwPerMin
  const holdEnd = rampEnd + spec.holdMinutes
  const rampDownEnd =
    holdEnd + spec.maxMw / spec.rampDownMwPerMin

  if (minute < rampStart) {
    return 0
  }

  if (minute <= rampEnd) {
    return clamp((minute - rampStart) * spec.rampUpMwPerMin, 0, spec.maxMw)
  }

  if (minute <= holdEnd) {
    return spec.maxMw
  }

  if (minute <= rampDownEnd) {
    return clamp(
      spec.maxMw - (minute - holdEnd) * spec.rampDownMwPerMin,
      0,
      spec.maxMw
    )
  }

  return 0
}

export function envelopeEndMinute(spec: DispatchEnvelopeSpec) {
  assertFeasibleSpec(spec)
  if (spec.maxMw === 0) return spec.startMinute + spec.holdMinutes + spec.recoveryMinutes
  return (
    spec.startMinute +
    spec.maxMw / spec.rampUpMwPerMin +
    spec.holdMinutes +
    spec.maxMw / spec.rampDownMwPerMin +
    spec.recoveryMinutes
  )
}

function proofEligibleAt(dto: DispatchEnvelopeDTO, minute: number) {
  const interval = dto.proofIntervals.find((candidate, index) =>
    minute >= candidate.startMinute && (minute < candidate.endMinute || (index === dto.proofIntervals.length - 1 && minute <= candidate.endMinute))
  )
  if (!interval || interval.eligibility !== "eligible") return false
  return dto.constraints.filter((constraint) => constraint.isDecisionCritical).every((constraint) => constraintLimitAt({ constraint, limitSamples: constraint.limitSamples ?? [] }, minute)?.trusted === true)
}

function assertFeasibleSpec(spec: DispatchEnvelopeSpec) {
  if (spec.maxMw > 0 && (spec.rampUpMwPerMin <= 0 || spec.rampDownMwPerMin <= 0)) throw new Error("Positive envelopes require positive ramp rates")
}

export function getVisualizationEndMinute(
  request: DispatchEnvelopeSpec,
  accepted: DispatchEnvelopeSpec | null
) {
  const max = Math.max(envelopeEndMinute(request), accepted ? envelopeEndMinute(accepted) : 0, 34)

  return Math.ceil(max / 5) * 5
}

function constraintLimitAt(
  prepared: PreparedConstraint | undefined,
  minute: number
) {
  if (!prepared) {
    return null
  }

  const { constraint, limitSamples } = prepared

  if (limitSamples.length) {
    const exact = limitSamples.find((sample) => sample.minute === minute)

    if (exact) {
      return exact
    }

    const rightIndex = limitSamples.findIndex((sample) => sample.minute > minute)
    const leftIndex =
      rightIndex === -1 ? limitSamples.length - 1 : Math.max(0, rightIndex - 1)
    const left = limitSamples[leftIndex]
    const right =
      rightIndex >= 0 ? limitSamples[rightIndex] : limitSamples[limitSamples.length - 1]

    if (!left || !right || left.minute === right.minute) {
      return left ?? right ?? null
    }

    const ratio = (minute - left.minute) / (right.minute - left.minute)

    return {
      minute,
      trusted: left.trusted && right.trusted,
      maxMw: interpolateNumber(left.maxMw, right.maxMw, ratio),
      lowerConfidenceMw:
        left.lowerConfidenceMw != null && right.lowerConfidenceMw != null
          ? interpolateNumber(left.lowerConfidenceMw, right.lowerConfidenceMw, ratio)
          : undefined,
      upperConfidenceMw:
        left.upperConfidenceMw != null && right.upperConfidenceMw != null
          ? interpolateNumber(left.upperConfidenceMw, right.upperConfidenceMw, ratio)
          : undefined,
    }
  }

  if (minute < constraint.earliestStartMinute) {
    return {
      minute,
      maxMw: 0,
      lowerConfidenceMw: 0,
      upperConfidenceMw: 0,
      trusted: constraint.isTrusted,
    }
  }

  const confidenceWidth = Math.max(0.04, (100 - (constraint.confidencePct ?? 100)) / 100)
  const spread = Math.max(0.05, constraint.maxMw * confidenceWidth * 0.18)

  return {
    minute,
    maxMw: constraint.maxMw,
    lowerConfidenceMw: Math.max(0, constraint.maxMw - spread),
    upperConfidenceMw: constraint.maxMw + spread,
    trusted: constraint.isTrusted,
  }
}

function findBindingDomain(
  limits: Record<DomainId, number | null>,
  trusted: Record<DomainId, boolean>,
  requestedMw: number
): DomainId | null {
  const trustedLimits = DISPATCH_DOMAIN_IDS.map((domainId) => ({
    domainId,
    value: limits[domainId],
    trusted: trusted[domainId],
  })).filter(
    (entry): entry is { domainId: DomainId; value: number; trusted: boolean } =>
      entry.value !== null && entry.trusted
  )

  if (!trustedLimits.length || requestedMw <= 0) {
    return null
  }

  return trustedLimits.reduce((best, current) =>
    current.value < best.value ? current : best
  ).domainId
}

function prepareConstraints(constraints: DispatchDomainConstraint[]) {
  const entries: Array<[DomainId, PreparedConstraint]> = constraints.map((constraint) => [
    constraint.id,
    {
      constraint,
      limitSamples: [...(constraint.limitSamples ?? [])].sort(
        (left, right) => left.minute - right.minute
      ),
    },
  ])

  return new Map(entries)
}

function interpolateNumber(start: number, end: number, ratio: number) {
  return start + (end - start) * clamp(ratio, 0, 1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round(value: number, digits: number) {
  const multiplier = 10 ** digits

  return Math.round(value * multiplier) / multiplier
}
