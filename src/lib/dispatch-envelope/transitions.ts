import { interpolateNumber } from "d3-interpolate"

import type { DispatchEnvelopeSpec } from "@/types/dispatch-envelope"

export function interpolateEnvelopeSpec(
  from: DispatchEnvelopeSpec,
  to: DispatchEnvelopeSpec,
  ratio: number
): DispatchEnvelopeSpec {
  const clamped = Math.min(Math.max(ratio, 0), 1)

  return {
    startMinute: interpolateNumber(from.startMinute, to.startMinute)(clamped),
    rampUpMwPerMin: interpolateNumber(from.rampUpMwPerMin, to.rampUpMwPerMin)(
      clamped
    ),
    maxMw: interpolateNumber(from.maxMw, to.maxMw)(clamped),
    holdMinutes: interpolateNumber(from.holdMinutes, to.holdMinutes)(clamped),
    rampDownMwPerMin: interpolateNumber(
      from.rampDownMwPerMin,
      to.rampDownMwPerMin
    )(clamped),
    recoveryMinutes: interpolateNumber(
      from.recoveryMinutes,
      to.recoveryMinutes
    )(clamped),
    reboundLimitMw: interpolateNumber(from.reboundLimitMw, to.reboundLimitMw)(
      clamped
    ),
  }
}
