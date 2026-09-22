"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { AssessmentSummary } from "@/components/assessment/assessment-summary"
import { AssessmentDetails } from "@/components/assessment/assessment-details"
import { Button } from "@/components/ui/button"
import { ASSESSMENT_SCENARIOS } from "@/content/assessments/constants"
import { assessmentLinks, assessmentSelectionHref, resolveAssessmentSelection } from "@/lib/assessment/selectors"
import { trackGridNinjaEvent, type AnalyticsEventName } from "@/lib/analytics"
import type { AssessmentPerspective, AssessmentRecord, AssessmentScenario, AssessmentSelection } from "@/types/assessment"

const defaultSelection = resolveAssessmentSelection(new URLSearchParams())

// Records cross the server boundary only after fixture schema/invariant validation.
// This island selects already-validated authored records; it never loads model data.
export function AssessmentExplorer({ initialSelection, records }: {
  initialSelection: AssessmentSelection
  records: Readonly<Record<AssessmentScenario, AssessmentRecord>>
}) {
  const [selection, setSelection] = useState(initialSelection)
  const [previousRouteSelection, setPreviousRouteSelection] = useState(initialSelection)
  const [resetRevision, setResetRevision] = useState(0)
  const [announcement, setAnnouncement] = useState("")
  const sampleOpened = useRef(false)

  useEffect(() => {
    if (selection.status !== "ready" || sampleOpened.current) return
    sampleOpened.current = true
    trackSelection("sample_opened", selection, records[selection.scenario])
  }, [selection, records])

  // A same-page Next navigation can preserve this island after local history changes.
  // The new server selection must replace its previous local selection immediately.
  if (previousRouteSelection !== initialSelection) {
    setPreviousRouteSelection(initialSelection)
    setSelection(initialSelection)
    setResetRevision((value) => value + 1)
  }

  useEffect(() => {
    const onHistory = () => {
      const next = resolveAssessmentSelection(new URLSearchParams(window.location.search))
      setSelection(next)
      setResetRevision((value) => value + 1)
      setAnnouncement(next.status === "ready" ? `Fixture ${next.scenario.toUpperCase()}: ${records[next.scenario].title}. ${next.perspective} perspective.` : next.reason)
    }
    window.addEventListener("popstate", onHistory)
    return () => window.removeEventListener("popstate", onHistory)
  }, [records])

  function update(next: AssessmentSelection, reset = false, eventName?: "scenario_selected" | "perspective_selected") {
    if (next.status !== "ready") return
    if (eventName) trackSelection(eventName, next, records[next.scenario])
    window.history.pushState(null, "", assessmentSelectionHref(next))
    setSelection(next)
    if (reset) setResetRevision((value) => value + 1)
    setAnnouncement(`${reset ? "Reset. " : ""}Fixture ${next.scenario.toUpperCase()}: ${records[next.scenario].title}. ${next.perspective} perspective.`)
  }

  if (selection.status === "unavailable") return <section className="rounded-2xl border border-border p-6" aria-labelledby="sample-unavailable"><h2 id="sample-unavailable" className="text-2xl font-medium">Requested example unavailable</h2><p className="mt-4 leading-7 text-muted-foreground">{selection.reason}</p><Button asChild className="mt-5"><Link href="/demo" prefetch={false}>Open the default example</Link></Button></section>
  const record = records[selection.scenario]
  const links = assessmentLinks(record)

  return <div className="scroll-mt-28 space-y-8" id="decision-brief" data-testid="assessment-explorer">
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-end gap-5">
        <label className="grid min-w-full flex-1 gap-2 text-sm font-medium sm:min-w-48" htmlFor="assessment-scenario">Scenario<select id="assessment-scenario" className="min-h-12 w-full rounded-lg border border-input bg-surface-2 px-3 text-foreground" value={selection.scenario} onChange={(event) => update({ ...selection, scenario: event.target.value as AssessmentScenario }, false, "scenario_selected")}>{ASSESSMENT_SCENARIOS.map((scenario) => <option key={scenario} value={scenario}>Fixture {scenario.toUpperCase()} · {records[scenario].screeningOutcome}</option>)}</select></label>
        <label className="grid min-w-full flex-1 gap-2 text-sm font-medium sm:min-w-48" htmlFor="assessment-perspective">Perspective<select id="assessment-perspective" className="min-h-12 w-full rounded-lg border border-input bg-surface-2 px-3 text-foreground" value={selection.perspective} onChange={(event) => update({ ...selection, perspective: event.target.value as AssessmentPerspective }, false, "perspective_selected")}><option value="business">Business decision</option><option value="engineering">Engineering evidence</option></select></label>
        <Button type="button" variant="outline" onClick={() => update(defaultSelection, true)}>Reset example</Button>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Both perspectives use the same record. ALLOW / REPAIR / REJECT / NO-PROOF describe model screening only. Publication v{record.publication.version}.</p>
      <noscript><p className="mt-3 text-sm">JavaScript is unavailable. The selected example is fully readable below. Open a different fixture: {ASSESSMENT_SCENARIOS.map((scenario) => <a key={scenario} href={`/demo?scenario=${scenario}&version=1.0.0&perspective=business`} className="ml-3 text-primary underline">{scenario.toUpperCase()}</a>)}. <a href={`/demo?scenario=${selection.scenario}&version=1.0.0&perspective=engineering`} className="text-primary underline">Engineering evidence</a>.</p></noscript>
    </div>
    <p aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
    <AssessmentSummary record={record} showLinks={false} />
    <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium" aria-label="Current example downloads"><a href={links.brief} onClick={() => trackSelection("evidence_artifact_view", selection, record)} className="text-primary underline underline-offset-4">Read the versioned brief</a><a href={links.pdf} onClick={() => trackSelection("sample_download_clicked", selection, record)} className="text-primary underline underline-offset-4">Download this PDF</a><a href={links.json} onClick={() => trackSelection("sample_download_clicked", selection, record)} className="text-primary underline underline-offset-4">Download this technical record</a></div>
    <AssessmentDetails key={`${record.scenario}-${resetRevision}`} record={record} perspective={selection.perspective} />
  </div>
}

function trackSelection(name: AnalyticsEventName, selection: Extract<AssessmentSelection, { status: "ready" }>, record: AssessmentRecord) {
  trackGridNinjaEvent(name, {
    source: "assessment-explorer", scenario: selection.scenario,
    perspective: selection.perspective, artifact: record.publication.id,
    version: record.publication.version,
  })
}
