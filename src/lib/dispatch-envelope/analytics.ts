import type { DispatchDecision, DomainId, EvidenceClass } from "@/types/dispatch-envelope"

export type DispatchEnvelopeEvent =
  | {
      name: "dispatch_visual_view"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
    }
  | {
      name: "dispatch_scenario_select"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
    }
  | {
      name: "dispatch_mode_change"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
    }
  | {
      name: "dispatch_constraint_select"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
    }
  | {
      name: "dispatch_proof_lens_pin"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
      minute: number
    }
  | {
      name: "dispatch_evidence_drawer_open"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
    }
  | {
      name: "dispatch_table_open"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
    }
  | {
      name: "dispatch_copy_proof_root"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
    }
  | {
      name: "dispatch_shadow_cta_click"
      scenarioId: string
      decision: DispatchDecision
      selectedDomainId: DomainId
      viewMode: string
      evidenceClass: EvidenceClass
      requestedMw: number
      acceptedMw: number | null
    }

export function emitDispatchEnvelopeEvent(event: DispatchEnvelopeEvent) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(
    new CustomEvent("gridninja:dispatch-envelope", {
      detail: event,
    })
  )
}
