import { FacilityPreviewPoster } from "@/components/facility/facility-preview-poster"
import { AssessmentDetails } from "@/components/assessment/assessment-details"
import { HypotheticalMinimumExamples, HypotheticalMinimumScope } from "@/components/assessment/hypothetical-minimum-examples"
import { canCompareHypotheticalMinimum, type HypotheticalMinimumSource } from "@/lib/assessment/hypothetical-minimum"
import { AssessmentSummary } from "@/components/assessment/assessment-summary"
import { NativeSelectControl } from "@/components/forms/native-select-control"
import { ASSESSMENT_SCENARIOS } from "@/content/assessments/constants"
import { assessmentLinks, assessmentSelectionHref } from "@/lib/assessment/selectors"
import { facilitySystemDescription } from "@/lib/facility/content"
import { ECOSYSTEM_STORY_SCOPE, ecosystemNarrative } from "@/lib/facility/ecosystem-narrative"
import type { PublicTopic } from "@/lib/public-topic"
import type { AssessmentRecord, AssessmentScenario, AssessmentSelection } from "@/types/assessment"
import type { FacilityInspectionTarget, FacilityMode, FacilityVisualRelease } from "@/types/facility"
import "@/components/facility/facility-inspection.css"

const scenarioLabels: Record<AssessmentScenario, string> = {
  a: "Request fits the modeled screen",
  b: "Smaller commitment needs review",
  c: "Minimum cannot be met",
  d: "Cooling evidence missing",
}

/** Readable before enhancement, including when JavaScript is unavailable. */
export function AssessmentPreview({ selection, record, release, topic, target, hypotheticalSource = null, mode }: {
  mode?: FacilityMode
  hypotheticalSource?: HypotheticalMinimumSource | null
  selection: Extract<AssessmentSelection, { status: "ready" }>
  record: AssessmentRecord
  release: FacilityVisualRelease | null
  topic?: PublicTopic
  target?: FacilityInspectionTarget | null
}) {
  const links = assessmentLinks(record)
  const narrative = ecosystemNarrative(record)
  const interactiveHref = `/demo?${new URLSearchParams({ scenario: selection.scenario, version: selection.version, perspective: selection.perspective, ...(target ? { focus: target.equipmentId ?? target.system } : {}), ...(topic ? { topic } : {}), interactive: "1", activate: "1" })}#decision-brief`
  const focused = target ? facilitySystemDescription(record, target.system) : null

  return <div className="scroll-mt-28 space-y-6" id="decision-brief" tabIndex={-1} data-testid="assessment-explorer">

    <div className={release ? "grid items-start gap-6 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]" : undefined}>
      <div><AssessmentSummary record={record} compact showLinks={false} /><details data-assessment-controls open={selection.perspective === "engineering"} className="mt-4 rounded-xl border border-border bg-surface p-4"><summary className="min-h-11 cursor-pointer content-center font-medium">Change scenario or perspective</summary>
    <form action="/demo#decision-brief" method="get" data-assessment-preview-form className="mt-4">
      <input type="hidden" name="version" value={selection.version} />
      {topic && <input type="hidden" name="topic" value={topic} />}
      <div className="flex flex-wrap items-end gap-4">
        <label className="grid min-w-full flex-1 gap-2 text-sm font-medium sm:min-w-48" htmlFor="assessment-scenario">Scenario<NativeSelectControl id="assessment-scenario" name="scenario" className="min-h-12 w-full rounded-lg border border-input bg-surface-2 px-3 text-foreground" defaultValue={selection.scenario}>{ASSESSMENT_SCENARIOS.map(scenario => <option key={scenario} value={scenario}>{scenario.toUpperCase()} · {scenarioLabels[scenario]}</option>)}</NativeSelectControl></label>
        <label className="grid min-w-full flex-1 gap-2 text-sm font-medium sm:min-w-48" htmlFor="assessment-perspective">Perspective<NativeSelectControl id="assessment-perspective" name="perspective" className="min-h-12 w-full rounded-lg border border-input bg-surface-2 px-3 text-foreground" defaultValue={selection.perspective}><option value="business">Business decision</option><option value="engineering">Engineering evidence</option></NativeSelectControl></label>
        <button type="submit" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-medium text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Apply selection</button>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Same assessment record in both perspectives · Publication v{record.publication.version}.</p>
      <noscript><p className="mt-3 text-sm">Open a different fixture: {ASSESSMENT_SCENARIOS.map(scenario => <a key={scenario} href={assessmentSelectionHref({ ...selection, scenario })} className="ml-3 text-primary underline">{scenario.toUpperCase()}</a>)}. <a href={assessmentSelectionHref({ ...selection, perspective: "engineering" })} className="text-primary underline">Engineering evidence</a>.</p></noscript>
    </form>
</details>
      {record.scenario === "b" && record.publication.version === "1.0.0" && <details id="hypothetical-minimum" tabIndex={-1} className="mt-4 scroll-mt-28 rounded-xl border border-border bg-surface p-4"><summary className="min-h-11 cursor-pointer content-center font-medium">Explore a hypothetical minimum</summary>{canCompareHypotheticalMinimum(record, hypotheticalSource) ? <><p className="mt-3 text-sm leading-6 text-muted-foreground">Fixture B records no minimum. These assumptions do not change the assessment.</p><HypotheticalMinimumExamples record={record} source={hypotheticalSource} /><HypotheticalMinimumScope /><a href={`/demo?${new URLSearchParams({ scenario: selection.scenario, version: selection.version, perspective: selection.perspective, ...(target ? { focus: target.equipmentId ?? target.system } : {}), ...(topic ? { topic } : {}), interactive: "1" })}#hypothetical-minimum`} className="mt-3 inline-flex min-h-11 items-center text-primary underline underline-offset-4">Use an interactive minimum</a></> : <p className="mt-3 text-sm leading-6 text-muted-foreground">The publication needed for this comparison is temporarily unavailable. The assessment and its exact evidence links remain available.</p>}</details>}
      </div>
      {release && <section className="facility-inspection facility-inspection--demo min-w-0 overflow-hidden rounded-xl border border-border bg-background" data-testid="facility-inspection" data-release={release.release} data-phase="poster" data-night-inspection={Boolean(release.profile.inspection) || undefined} data-scenario={record.scenario} aria-label="Synthetic facility preview">
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground"><span>Facility context</span><span>Synthetic example</span></div>
        <div id="facility-construction" tabIndex={-1} className="facility-stage relative aspect-[4/3] overflow-hidden bg-background sm:aspect-[1.7]" role="group" aria-label="Facility model">
          <FacilityPreviewPoster desktopUrl={release.posters.desktop.url} mobileUrl={release.posters.mobile.url} deferMobile={Boolean(release.profile.inspection)} alt="Architectural cutaway of a synthetic data center: server racks, electrical distribution, cooling units, and reserve-storage cabinets." />
        </div>
        <div className="px-4 py-3">{focused ? <><p className="facility-target-label text-sm font-medium">Selected equipment: {release.equipmentIndex?.equipment.find(item => item.id === target?.equipmentId)?.label ?? focused.label}</p><div className="facility-explanation-copy mt-2 text-sm leading-6 text-muted-foreground"><p>{focused.body}</p></div><details data-testid="facility-contextual-inspector" className="mt-3"><summary className="min-h-11 cursor-pointer content-center font-medium">Evidence</summary><a href={links.brief} className="text-primary underline underline-offset-4">Read this versioned decision brief</a></details></> : <p className="text-sm leading-6 text-muted-foreground">Inspect the equipment relationships behind this authored assessment.</p>}<a href={interactiveHref} data-assessment-preview-activate className="mt-2 inline-flex min-h-11 items-center text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{mode === "poster" ? "Inspect this example" : "Explore the facility in 3D"}</a><a href={release.posters.desktop.url} className="ml-4 mt-2 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4">View still illustration</a></div>
      </section>}
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium" aria-label="Current example downloads"><a href={links.brief} className="text-primary underline underline-offset-4">Read the versioned brief</a><a href={links.pdf} className="text-primary underline underline-offset-4">Download this PDF</a><a href={links.json} className="text-primary underline underline-offset-4">Download this technical record</a></div>
    <details data-assessment-conditions open={selection.perspective === "engineering"} className="rounded-xl border border-border bg-surface p-5 sm:p-7"><summary className="min-h-11 cursor-pointer content-center text-lg font-medium">Conditions and assessment evidence</summary><div className="mt-6"><AssessmentDetails record={record} perspective={selection.perspective} /></div></details>
    <details id="workload-story" tabIndex={-1} className="facility-ecosystem-transcript scroll-mt-[86px] rounded-xl bg-surface p-5 sm:p-7"><summary>Read “Follow one workload”</summary><p>{ECOSYSTEM_STORY_SCOPE}</p><ol>{narrative.chapters.map(chapter => <li key={chapter.id}><h3>{chapter.title}</h3><p>{chapter.body}</p><p>{chapter.evidence}</p></li>)}</ol>{narrative.comparison && <p>Requested: {narrative.comparison.requested}. Proposed revision: {narrative.comparison.revised}. {narrative.comparison.question}</p>}<p><a href={links.brief}>Read the versioned brief</a> · <a href={links.pdf}>Download this PDF</a> · <a href={links.json}>Download this technical record</a></p></details>
  </div>
}
