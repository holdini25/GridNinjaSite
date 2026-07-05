import type {
  DispatchDomainConstraint,
  DomainId,
  EnvelopeSample,
} from "@/types/dispatch-envelope"

export interface RankedConstraint {
  domainId: DomainId
  label: string
  shortLabel: string
  state: DispatchDomainConstraint["state"]
  score: number
  scoreLabel: string
  maxMw: number
  telemetryAgeMs: number | null
  confidencePct: number | null
  reasonCode: string
  evidenceArtifact: string
}

export function rankConstraints(args: {
  samples: EnvelopeSample[]
  constraints: DispatchDomainConstraint[]
}): RankedConstraint[] {
  const { samples, constraints } = args

  return constraints
    .map((constraint) => {
      const score = integrateBindingPressure(samples, constraint.id)

      return {
        domainId: constraint.id,
        label: constraint.label,
        shortLabel: constraint.shortLabel,
        state: constraint.state,
        score,
        scoreLabel: formatBindingScore(score),
        maxMw: constraint.maxMw,
        telemetryAgeMs: constraint.telemetryAgeMs,
        confidencePct: constraint.confidencePct,
        reasonCode: constraint.reasonCode,
        evidenceArtifact: constraint.evidenceArtifact,
      }
    })
    .sort((left, right) => {
      const stateDelta = stateWeight(right.state) - stateWeight(left.state)

      return stateDelta || right.score - left.score || left.label.localeCompare(right.label)
    })
}

function integrateBindingPressure(samples: EnvelopeSample[], domainId: DomainId) {
  let area = 0

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    const previousLimit = previous.limits[domainId]
    const currentLimit = current.limits[domainId]

    if (previousLimit === null || currentLimit === null) {
      continue
    }

    const previousPressure = Math.max(0, previous.requestedMw - previousLimit)
    const currentPressure = Math.max(0, current.requestedMw - currentLimit)
    const deltaTime = current.minute - previous.minute

    area += ((previousPressure + currentPressure) / 2) * deltaTime
  }

  return area
}

function stateWeight(state: DispatchDomainConstraint["state"]) {
  if (state === "hard-block") {
    return 5
  }

  if (state === "no-proof") {
    return 4
  }

  if (state === "binding") {
    return 3
  }

  if (state === "repair") {
    return 2
  }

  if (state === "available") {
    return 1
  }

  return 0
}

function formatBindingScore(score: number) {
  if (score < 0.05) {
    return "clear"
  }

  return `${score.toFixed(1)} MW-min`
}
