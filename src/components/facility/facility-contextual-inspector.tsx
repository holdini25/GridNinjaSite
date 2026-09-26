"use client"

import { useEffect, useRef } from "react"
import { selectAssessment } from "@/lib/assessment/selectors"
import { facilityDestinations } from "@/lib/facility/navigation"
import type { PublicTopic } from "@/lib/public-topic"
import type { AssessmentRecord } from "@/types/assessment"
import type { FacilityInspectionTarget } from "@/types/facility"

export function FacilityContextualInspector({ record, target, topic, variant, hideRelatedContext = false, onReadingHoldChange }: { hideRelatedContext?: boolean; variant: "hero" | "demo"; record: AssessmentRecord; target: FacilityInspectionTarget; topic?: PublicTopic; onReadingHoldChange?: (held: boolean) => void }) {
  const conditions = useRef<HTMLDetailsElement>(null)
  const evidence = useRef<HTMLDetailsElement>(null)
  const updateReadingHold = () => onReadingHoldChange?.(!!conditions.current?.open || !!evidence.current?.open)
  useEffect(() => () => onReadingHoldChange?.(false), [onReadingHoldChange])
  const view = selectAssessment(record)
  const destinations = facilityDestinations(record, topic ?? target.system, variant === "hero" ? "home-decision-brief" : "demo-inspection-room")
  const relevantEvidence = record.evidence.filter(item => target.system === "power" ? item.id === "electrical" : target.system === "cooling" ? item.id === "cooling" : true)
  return <div className="facility-contextual" data-testid="facility-contextual-inspector">
    <section aria-label="Decision"><h3>Decision</h3><p>{view.screeningOutcome} · {view.modeled} modeled eligible increment. {view.conclusion}</p></section>
    <details ref={conditions} onToggle={updateReadingHold}><summary>Conditions</summary><p>{record.commercial.question}</p>{target.system === "storage" ? <p>Contribution and duration unassessed. No independent storage contribution or binding constraint is established.</p> : relevantEvidence.map(item => <p key={item.id}><strong>{item.status === "missing" ? "Missing evidence: " : "Authored evidence: "}</strong>{item.detail}</p>)}<p>Sequential attribution belongs to the complete assessment. Its final margin is not assigned to an illustrated cabinet.</p></details>
    <details ref={evidence} onToggle={updateReadingHold}><summary>Evidence</summary><p>Fixture {record.scenario.toUpperCase()} · publication v{record.publication.version}. The published brief identifies its PDF and technical record.</p><a className="facility-evidence-link" href={destinations.related[1].href}>{destinations.related[1].label}<span aria-hidden="true">↗</span></a></details>
    <details><summary>Next step</summary><p>{destinations.principal.purpose}</p><a className="facility-evidence-link" href={destinations.principal.href}>{destinations.principal.label}<span aria-hidden="true">↗</span></a>{!hideRelatedContext && <a className="facility-evidence-link" href={destinations.related[0].href}>{destinations.related[0].label}{destinations.related[0].status === "publication-pending" && " · Publication pending"}<span aria-hidden="true">↗</span></a>}</details>
  </div>
}
