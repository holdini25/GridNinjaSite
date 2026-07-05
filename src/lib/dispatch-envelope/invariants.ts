import type { DispatchEnvelopeDTO } from "@/types/dispatch-envelope"

export function assertDispatchEnvelopeInvariants(dto: DispatchEnvelopeDTO) {
  if (dto.decision === "allow" && dto.accepted === null) {
    throw new Error("ALLOW requires accepted envelope")
  }

  if (dto.decision === "repair" && dto.accepted === null) {
    throw new Error("REPAIR requires accepted envelope")
  }

  if (
    (dto.decision === "reject" || dto.decision === "no-proof") &&
    dto.accepted !== null
  ) {
    throw new Error(`${dto.decision.toUpperCase()} must not include accepted envelope`)
  }

  if (dto.decision === "no-proof") {
    const hasNoProof = dto.constraints.some(
      (constraint) =>
        constraint.state === "no-proof" && constraint.isDecisionCritical
    )

    if (!hasNoProof) {
      throw new Error("NO-PROOF requires a decision-critical no-proof constraint")
    }
  }

  if (dto.decision === "reject") {
    const hasHardBlock = dto.constraints.some(
      (constraint) => constraint.state === "hard-block" && constraint.isTrusted
    )

    if (!hasHardBlock) {
      throw new Error("REJECT requires a trusted hard-blocking constraint")
    }
  }

  if (dto.evidenceClass !== "illustrative" && dto.authority !== "signed-read-only") {
    throw new Error("Validated envelopes must be signed-read-only")
  }
}
