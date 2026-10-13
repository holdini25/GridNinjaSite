import { DispatchEnvelopeDTOSchema } from "@/schemas/dispatch-envelope.schema"
import type { DispatchBinding, DispatchEnvelopeDTO, DispatchEnvelopeSpec } from "@/types/dispatch-envelope"

import { DISPATCH_DOMAIN_IDS } from "./constants"
import { envelopeEndMinute } from "./curves"
import { evaluateDispatchEvidence } from "./evidence"

const EPSILON = 1e-9

export function assertDispatchEnvelopeInvariants(dto: DispatchEnvelopeDTO) {
  const domains = dto.constraints.map((constraint) => constraint.id)
  if (domains.length !== DISPATCH_DOMAIN_IDS.length || domains.some((id, index) => id !== DISPATCH_DOMAIN_IDS[index])) throw new Error("Constraints must contain every canonical domain exactly once")

  if ((dto.decision === "allow" || dto.decision === "repair") && dto.accepted === null) throw new Error(`${dto.decision.toUpperCase()} requires accepted envelope`)
  if ((dto.decision === "reject" || dto.decision === "no-proof") && dto.accepted !== null) throw new Error(`${dto.decision.toUpperCase()} must not include accepted envelope`)

  if (dto.decision === "allow") {
    if (!dto.accepted || !specsEqual(dto.request, dto.accepted)) throw new Error("ALLOW accepted envelope must exactly equal request")
    if (dto.bindings.some((binding) => binding.severity !== "info")) throw new Error("ALLOW cannot carry repair, reject, or no-proof bindings")
  }

  if (dto.decision === "repair") {
    if (!dto.accepted || specsEqual(dto.request, dto.accepted)) throw new Error("REPAIR requires a positive repair delta")
    if (!dto.bindings.length || dto.bindings.some((binding) => binding.severity !== "repair")) throw new Error("REPAIR requires repair bindings")
  }

  if (dto.decision === "reject") {
    const hardBlocks = dto.constraints.filter((constraint) => constraint.state === "hard-block" && constraint.isTrusted && constraint.isDecisionCritical)
    if (!hardBlocks.length) throw new Error("REJECT requires a trusted decision-critical hard block")
    if (!dto.bindings.some((binding) => binding.severity === "reject" && hardBlocks.some((constraint) => constraint.id === binding.domainId))) throw new Error("REJECT binding must reference the hard block")
  }

  if (dto.decision === "no-proof") {
    const gaps = dto.constraints.filter((constraint) => constraint.state === "no-proof" && constraint.isDecisionCritical && !constraint.isTrusted)
    if (!gaps.length || !dto.proofIntervals.some((interval) => interval.eligibility === "not-eligible")) throw new Error("NO-PROOF requires a decision-critical evidence gap")
    if (!dto.bindings.some((binding) => binding.severity === "no-proof" && gaps.some((constraint) => constraint.id === binding.domainId))) throw new Error("NO-PROOF binding must reference the evidence gap")
  }

  // A legitimate NO-PROOF record still has to satisfy the complete structural contract.
  DispatchEnvelopeDTOSchema.parse(dto)
  for (const binding of dto.bindings) assertBinding(dto, binding)
  if (dto.decision !== "no-proof") {
    const evaluation = evaluateDispatchEvidence(dto)
    if (!evaluation.eligible) throw new Error(evaluation.issues[0]?.message ?? "Dispatch evidence is not eligible")
  }

  const expectedEnd = envelopeEndMinute(dto.accepted ?? dto.request)
  const finalInterval = dto.proofIntervals.at(-1)
  if (!finalInterval || Math.abs(finalInterval.endMinute - expectedEnd) > EPSILON) throw new Error("Proof intervals must cover the complete decision window, including recovery")
  if (dto.decision !== "no-proof" && dto.proofIntervals.some((interval) => interval.eligibility !== "eligible")) throw new Error("Proof-bearing decisions cannot contain ineligible intervals")

  if (dto.evidenceClass !== "illustrative" && dto.authority !== "signed-read-only") throw new Error("Validated envelopes must be signed-read-only")
  if (dto.evidenceClass === "illustrative" && dto.authority !== "illustrative-demo") throw new Error("Illustrative envelopes require illustrative authority")
}

function assertBinding(dto: DispatchEnvelopeDTO, binding: DispatchBinding) {
  const constraint = dto.constraints.find((candidate) => candidate.id === binding.domainId)
  if (!constraint) throw new Error(`Binding references missing domain ${binding.domainId}`)
  if (constraint.reasonCode !== binding.reasonCode) throw new Error(`Binding reason does not match ${binding.domainId}`)
  const expected = dto.decision === "allow" ? "info" : dto.decision
  if (binding.severity !== expected) throw new Error(`Binding severity must match ${dto.decision}`)
  if (typeof binding.delta === "number" && binding.delta <= 0) throw new Error("Numeric binding deltas must be positive")
}

function specsEqual(left: DispatchEnvelopeSpec, right: DispatchEnvelopeSpec) {
  return (Object.keys(left) as Array<keyof DispatchEnvelopeSpec>).every((key) => left[key] === right[key])
}
