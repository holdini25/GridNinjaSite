import type { DispatchDomainConstraint, DispatchEnvelopeSpec, DispatchLimitSample } from "@/types/dispatch-envelope"

export const DISPATCH_EPSILON = 1e-9

function assertSpec(spec: DispatchEnvelopeSpec) {
  if ([spec.startMinute, spec.rampUpMwPerMin, spec.maxMw, spec.holdMinutes, spec.rampDownMwPerMin, spec.recoveryMinutes, spec.reboundLimitMw].some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Envelope values must be finite and nonnegative")
  if (spec.maxMw > 0 && (spec.rampUpMwPerMin <= 0 || spec.rampDownMwPerMin <= 0)) throw new Error("Positive envelopes require positive ramp rates")
}

/** All curves are continuous and piecewise linear. Zero MW never divides by a ramp. */
export function envelopeBreakpoints(spec: DispatchEnvelopeSpec): number[] {
  assertSpec(spec)
  const rampEnd = spec.startMinute + (spec.maxMw === 0 ? 0 : spec.maxMw / spec.rampUpMwPerMin)
  const holdEnd = rampEnd + spec.holdMinutes
  const rampDownEnd = holdEnd + (spec.maxMw === 0 ? 0 : spec.maxMw / spec.rampDownMwPerMin)
  const points = [0, spec.startMinute, rampEnd, holdEnd, rampDownEnd, rampDownEnd + spec.recoveryMinutes]
  if (points.some((minute) => !Number.isFinite(minute))) throw new Error("Envelope timing must be finite")
  return [...new Set(points)].sort((left, right) => left - right)
}

export function envelopeEndMinute(spec: DispatchEnvelopeSpec) {
  return envelopeBreakpoints(spec).at(-1)!
}

export function envelopeMwAt(spec: DispatchEnvelopeSpec, minute: number) {
  assertSpec(spec)
  if (!Number.isFinite(minute)) throw new Error("Envelope minute must be finite")
  if (spec.maxMw === 0 || minute < spec.startMinute) return 0
  const rampEnd = spec.startMinute + spec.maxMw / spec.rampUpMwPerMin
  const holdEnd = rampEnd + spec.holdMinutes
  if (minute <= rampEnd) return Math.min(spec.maxMw, (minute - spec.startMinute) * spec.rampUpMwPerMin)
  if (minute <= holdEnd) return spec.maxMw
  return Math.max(0, spec.maxMw - (minute - holdEnd) * spec.rampDownMwPerMin)
}

export function hasValidLimitCurve(constraint: DispatchDomainConstraint) {
  const points = constraint.limitSamples
  if (points === undefined) return Number.isFinite(constraint.maxMw) && constraint.maxMw >= 0
  return Array.isArray(points) && points.length >= 2 && points.every((point, index) =>
    point !== null && typeof point === "object" &&
    Number.isFinite(point.minute) && point.minute >= 0 && Number.isFinite(point.maxMw) && point.maxMw >= 0
    && typeof point.trusted === "boolean" && (index === 0 || point.minute > points[index - 1].minute)
    && ((point.lowerConfidenceMw === undefined && point.upperConfidenceMw === undefined)
      || (Number.isFinite(point.lowerConfidenceMw) && Number.isFinite(point.upperConfidenceMw)
        && point.lowerConfidenceMw! >= 0 && point.lowerConfidenceMw! <= point.maxMw && point.upperConfidenceMw! >= point.maxMw)))
}

/** Omitted samples mean a constant scalar limit. Supplied curves never extrapolate. */
export function constraintLimitAt(constraint: DispatchDomainConstraint, minute: number): DispatchLimitSample | null {
  if (!Number.isFinite(minute) || minute < 0 || !hasValidLimitCurve(constraint)) return null
  const points = constraint.limitSamples
  if (points === undefined) return { minute, maxMw: constraint.maxMw, trusted: constraint.isTrusted }
  if (minute < points[0].minute || minute > points.at(-1)!.minute) return null
  const exact = points.find((point) => point.minute === minute)
  if (exact) return { ...exact, trusted: constraint.isTrusted && exact.trusted }
  const rightIndex = points.findIndex((point) => point.minute > minute)
  const left = points[rightIndex - 1]
  const right = points[rightIndex]
  const ratio = (minute - left.minute) / (right.minute - left.minute)
  const interpolate = (a: number, b: number) => a + (b - a) * ratio
  return {
    minute,
    maxMw: interpolate(left.maxMw, right.maxMw),
    trusted: constraint.isTrusted && left.trusted && right.trusted,
    ...(left.lowerConfidenceMw != null && right.lowerConfidenceMw != null && left.upperConfidenceMw != null && right.upperConfidenceMw != null ? {
      lowerConfidenceMw: interpolate(left.lowerConfidenceMw, right.lowerConfidenceMw),
      upperConfidenceMw: interpolate(left.upperConfidenceMw, right.upperConfidenceMw),
    } : {}),
  }
}
