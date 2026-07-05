import { bisector } from "d3-array"
import type { ScaleLinear } from "d3-scale"

import type { DomainId, EnvelopeSample } from "@/types/dispatch-envelope"

const bisectMinute = bisector<EnvelopeSample, number>(
  (sample) => sample.minute
).center

export interface ProofLensSnapshot {
  minute: number
  requestedMw: number
  acceptedMw: number
  repairDeltaMw: number
  margins: Partial<Record<DomainId, number>>
  bindingDomainId: DomainId | null
  proofEligible: boolean
}

export function getProofLensSnapshot(args: {
  samples: EnvelopeSample[]
  xScale: ScaleLinear<number, number>
  pointerX: number
}): ProofLensSnapshot {
  const { samples, xScale, pointerX } = args
  const minute = xScale.invert(pointerX)

  return getProofLensSnapshotAtMinute(samples, minute)
}

export function getProofLensSnapshotAtMinute(
  samples: EnvelopeSample[],
  minute: number
): ProofLensSnapshot {
  const index = bisectMinute(samples, minute)
  const sample = samples[Math.min(Math.max(index, 0), samples.length - 1)] ?? samples[0]

  return {
    minute: sample.minute,
    requestedMw: sample.requestedMw,
    acceptedMw: sample.acceptedMw,
    repairDeltaMw: sample.repairDeltaMw,
    margins: computeMargins(sample),
    bindingDomainId: sample.bindingDomainId,
    proofEligible: sample.proofEligible,
  }
}

function computeMargins(sample: EnvelopeSample): Partial<Record<DomainId, number>> {
  const margins: Partial<Record<DomainId, number>> = {}

  for (const [domainId, limit] of Object.entries(sample.limits)) {
    if (limit === null) {
      continue
    }

    margins[domainId as DomainId] = limit - sample.acceptedMw
  }

  return margins
}
