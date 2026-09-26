"use client"

import { NativeSelectControl } from "@/components/forms/native-select-control"

import Link from "next/link"
import { FacilityInspection } from "@/components/facility/facility-inspection"
import type { FacilityInspectionTarget, FacilityMode, FacilityVisualRelease } from "@/types/facility"
import { useEffect, useRef, useState } from "react"
import { AssessmentSummary } from "@/components/assessment/assessment-summary"
import { HypotheticalMinimum } from "@/components/assessment/hypothetical-minimum"
import type { HypotheticalMinimumSource } from "@/lib/assessment/hypothetical-minimum"
import { writeAssessmentHistory } from "@/lib/assessment/history"
import { AssessmentDetails } from "@/components/assessment/assessment-details"
import { Button } from "@/components/ui/button"
import { ASSESSMENT_SCENARIOS } from "@/content/assessments/constants"
import { assessmentLinks, resolveAssessmentSelection } from "@/lib/assessment/selectors"
import { trackGridNinjaEvent, type AnalyticsEventName } from "@/lib/analytics"
import type { AssessmentPerspective, AssessmentRecord, AssessmentScenario, AssessmentSelection } from "@/types/assessment"

import { facilityFocusKey, facilitySelectionHref, resolveFacilityFocus, resolveFacilityTopic } from "@/lib/facility/navigation"
import type { PublicTopic } from "@/lib/public-topic"

const scenarioLabels: Record<AssessmentScenario, string> = {
  a: "Request fits the modeled screen", b: "Smaller commitment needs review",
  c: "Minimum cannot be met", d: "Cooling evidence missing",
}
const defaultSelection = resolveAssessmentSelection(new URLSearchParams())

// Records cross the server boundary only after fixture schema/invariant validation.
// This island selects already-validated authored records; it never loads model data.
export function AssessmentExplorer({ initialSelection, records, facilityRelease = null, facilityMode = "auto-adaptive", initialTarget = null, initialTopic, activateOnMount = false, initialControlsOpen, hypotheticalSource = null, initialHypotheticalOpen = false, initialConditionsOpen }: {
  initialConditionsOpen?: boolean
  hypotheticalSource?: HypotheticalMinimumSource | null
  initialHypotheticalOpen?: boolean
  initialControlsOpen?: boolean
  initialTarget?: FacilityInspectionTarget | null
  initialTopic?: PublicTopic
  initialSelection: AssessmentSelection
  records: Readonly<Record<AssessmentScenario, AssessmentRecord>>
  facilityRelease?: FacilityVisualRelease | null
  facilityMode?: FacilityMode
  activateOnMount?: boolean
}) {
  const [target, setTarget] = useState(initialTarget)
  const [topic, setTopic] = useState(initialTopic)
  const [selection, setSelection] = useState(initialSelection)
  const [previousRouteSelection, setPreviousRouteSelection] = useState(initialSelection)
  const [resetRevision, setResetRevision] = useState(0)
  const [inspectionExpanded, setInspectionExpanded] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(initialControlsOpen ?? (initialSelection.status === "ready" && initialSelection.perspective === "engineering"))
  const [readingState, setReadingState] = useState({ revision: 0, conditions: initialConditionsOpen ?? (initialSelection.status === "ready" && initialSelection.perspective === "engineering"), hypothetical: initialHypotheticalOpen })
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
    setTarget(initialTarget)
    setTopic(initialTopic)
    if (initialSelection.status === "unavailable") setInspectionExpanded(false)
    setResetRevision((value) => value + 1)
  }

  useEffect(() => {
    const onHistory = () => {
      const search = new URLSearchParams(window.location.search)
      const next = resolveAssessmentSelection(search)
      setTarget(resolveFacilityFocus(search, facilityRelease))
      setTopic(resolveFacilityTopic(search))
      setSelection(next)
      if (next.status === "unavailable") setInspectionExpanded(false)
      setResetRevision((value) => value + 1)
      setAnnouncement(next.status === "ready" ? `Fixture ${next.scenario.toUpperCase()}: ${records[next.scenario].title}. ${next.perspective} perspective.` : next.reason)
    }
    window.addEventListener("popstate", onHistory)
    return () => window.removeEventListener("popstate", onHistory)
  }, [records, facilityRelease])

  function update(next: AssessmentSelection, reset = false, eventName?: "scenario_selected" | "perspective_selected") {
    if (next.status !== "ready") return
    if (!writeAssessmentHistory(facilitySelectionHref(next, null, topic))) return
    if (eventName) trackSelection(eventName, next, records[next.scenario])
    setTarget(null)
    setSelection(next)
    setResetRevision((value) => value + 1)
    setAnnouncement(`${reset ? "Reset. " : ""}Fixture ${next.scenario.toUpperCase()}: ${records[next.scenario].title}. ${next.perspective} perspective.`)
  }

  function commitTarget(next: FacilityInspectionTarget | null) {
    if (selection.status !== "ready") return
    // Routes and specimen parts remain local; only public system/equipment IDs enter history.
    const publicTarget = resolveFacilityFocus({ focus: facilityFocusKey(next) }, facilityRelease)
    const href = facilitySelectionHref(selection, publicTarget, topic)
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== href && !writeAssessmentHistory(href)) return
    setTarget(publicTarget)
  }

  if (selection.status === "unavailable") return <section className="rounded-2xl border border-border p-6" aria-labelledby="sample-unavailable"><h2 id="sample-unavailable" className="text-2xl font-medium">Requested example unavailable</h2><p className="mt-4 leading-7 text-muted-foreground">{selection.reason}</p><Button asChild className="mt-5"><Link href="/demo" prefetch={false}>Open the default example</Link></Button></section>
  const record = records[selection.scenario]
  const links = assessmentLinks(record)
  const currentReading = readingState.revision === resetRevision ? readingState : { revision: resetRevision, conditions: selection.perspective === "engineering", hypothetical: false }
  const readingHold = currentReading.conditions || currentReading.hypothetical
  const defaultConditionsOpen = selection.perspective === "engineering"
  function updateReading(kind: "conditions" | "hypothetical", open: boolean) {
    setReadingState(previous => ({ ...(previous.revision === resetRevision ? previous : { revision: resetRevision, conditions: defaultConditionsOpen, hypothetical: false }), [kind]: open }))
  }

  return <div className="scroll-mt-28 space-y-6" id="decision-brief" tabIndex={-1} data-testid="assessment-explorer">

    <p aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
    <div className={facilityRelease ? `grid items-start gap-6${inspectionExpanded ? "" : " xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]"}` : undefined}>
      <div><AssessmentSummary record={record} compact showLinks={false} />    <details data-assessment-controls open={controlsOpen} onToggle={event => setControlsOpen(event.currentTarget.open)} className="mt-4 rounded-xl border border-border bg-surface p-4"><summary className="min-h-11 cursor-pointer content-center font-medium">Change scenario or perspective</summary>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="grid min-w-full flex-1 gap-2 text-sm font-medium sm:min-w-48" htmlFor="assessment-scenario">Scenario<NativeSelectControl id="assessment-scenario" className="min-h-12 w-full rounded-lg border border-input bg-surface-2 px-3 text-foreground" value={selection.scenario} onChange={(event) => update({ ...selection, scenario: event.target.value as AssessmentScenario }, false, "scenario_selected")}>{ASSESSMENT_SCENARIOS.map((scenario) => <option key={scenario} value={scenario}>{scenario.toUpperCase()} · {scenarioLabels[scenario]}</option>)}</NativeSelectControl></label>
        <label className="grid min-w-full flex-1 gap-2 text-sm font-medium sm:min-w-48" htmlFor="assessment-perspective">Perspective<NativeSelectControl id="assessment-perspective" className="min-h-12 w-full rounded-lg border border-input bg-surface-2 px-3 text-foreground" value={selection.perspective} onChange={(event) => update({ ...selection, perspective: event.target.value as AssessmentPerspective }, false, "perspective_selected")}><option value="business">Business decision</option><option value="engineering">Engineering evidence</option></NativeSelectControl></label>
        <Button type="button" variant="outline" onClick={() => update(defaultSelection, true)}>Reset example</Button>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Same assessment record in both perspectives · Publication v{record.publication.version}.</p>
      <noscript><p className="mt-3 text-sm">JavaScript is unavailable. The selected example is fully readable below. Open a different fixture: {ASSESSMENT_SCENARIOS.map((scenario) => <a key={scenario} href={`/demo?scenario=${scenario}&version=1.0.0&perspective=business`} className="ml-3 text-primary underline">{scenario.toUpperCase()}</a>)}. <a href={`/demo?scenario=${selection.scenario}&version=1.0.0&perspective=engineering`} className="text-primary underline">Engineering evidence</a>.</p></noscript>
    </details>
      <HypotheticalMinimum key={`${record.publication.id}-${record.publication.version}-${selection.perspective}-${resetRevision}`} record={record} source={hypotheticalSource} initiallyOpen={initialHypotheticalOpen && resetRevision === 0} onOpenChange={open => updateReading("hypothetical", open)} />
      </div>
      {facilityRelease && <FacilityInspection readingHold={readingHold} showAssessmentCaption={false} record={record} release={facilityRelease} variant="demo" loadingPolicy="auto-adaptive" mode={facilityMode} resetRevision={resetRevision} initialTarget={target} onCommittedTarget={commitTarget} topic={topic} onExpandedChange={setInspectionExpanded} activateOnMount={activateOnMount} />}
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium" aria-label="Current example downloads"><a href={links.brief} onClick={() => trackSelection("evidence_artifact_view", selection, record)} className="text-primary underline underline-offset-4">Read the versioned brief</a><a href={links.pdf} onClick={() => trackSelection("sample_download_clicked", selection, record)} className="text-primary underline underline-offset-4">Download this PDF</a><a href={links.json} onClick={() => trackSelection("sample_download_clicked", selection, record)} className="text-primary underline underline-offset-4">Download this technical record</a></div>
    <details data-assessment-conditions key={`${record.scenario}-${resetRevision}`} open={currentReading.conditions} onToggle={event => updateReading("conditions", event.currentTarget.open)} className="rounded-xl border border-border bg-surface p-5 sm:p-7">
      <summary className="min-h-11 cursor-pointer content-center text-lg font-medium">Conditions and assessment evidence</summary>
      <div className="mt-6"><AssessmentDetails record={record} perspective={selection.perspective} /></div>
    </details>
  </div>
}

function trackSelection(name: AnalyticsEventName, selection: Extract<AssessmentSelection, { status: "ready" }>, record: AssessmentRecord) {
  trackGridNinjaEvent(name, {
    source: "assessment-explorer", scenario: selection.scenario,
    perspective: selection.perspective, artifact: record.publication.id,
    version: record.publication.version,
  })
}
