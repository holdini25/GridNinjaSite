import { selectAssessment } from "@/lib/assessment/selectors"
import { FACILITY_LABELS, facilityWindowLabel } from "@/lib/facility/content"
import { facilitySelectionHref } from "@/lib/facility/navigation"
import { FACILITY_SYSTEMS, type FacilityVisualRelease } from "@/types/facility"
import type { AssessmentRecord } from "@/types/assessment"
import "./facility-inspection.css"

/** The initial home illustration and decision stay readable before viewer code loads. */
export function HomeInspectionShell({ record, release, mode }: { record: AssessmentRecord; release: FacilityVisualRelease; mode: "poster" | "manual" | "auto-desktop" | "auto-adaptive" }) {
  const view = selectAssessment(record)
  const selection = { status: "ready" as const, scenario: record.scenario, version: record.publication.version, perspective: "business" as const }
  const demoHref = facilitySelectionHref(selection, { system: "workloads", equipmentId: "rack-02" }).split("#")[0]
  const activationHref = `${demoHref}&interactive=1&activate=1#facility-construction`
  return <section className="facility-inspection facility-inspection--hero" data-testid="facility-inspection" data-phase="poster" data-release={release.release} data-night-inspection={release.profile.inspection ? true : undefined} data-engineering={release.profile.engineering ? true : undefined} data-ecosystem={release.profile.ecosystem ? true : undefined} data-scenario={record.scenario} data-view="overview" aria-labelledby="home-facility-heading" aria-describedby="home-facility-scope">
    <div className="facility-heading"><h2 id="home-facility-heading">Illustrative system view</h2><span className="facility-synthetic">Synthetic</span>{mode !== "poster" && <div className="facility-view-controls"><a href={activationHref} className="facility-action facility-action--activate" data-facility-activate=""><span className="facility-action-ready">Explore in 3D</span><span className="facility-action-loading">Preparing 3D…</span><span aria-hidden="true">↗</span></a></div>}</div>
    <div className="facility-stage" tabIndex={-1} role="group" aria-label="Facility model">
      <picture className="facility-poster">
        <source media="(max-width: 639px)" srcSet={release.posters.mobile.url} />
        <img src={release.posters.desktop.url} width={1360} height={800} alt="Architectural cutaway of a synthetic data center: server racks, electrical distribution, cooling units, and reserve-storage cabinets." loading="lazy" fetchPriority="low" decoding="async" />
      </picture>
    </div>
    <nav className="facility-systems" aria-label="Inspect a facility system in the demo">{FACILITY_SYSTEMS.map((system, index) => <a key={system} href={facilitySelectionHref(selection, { system })} aria-label={`Inspect ${FACILITY_LABELS[system]} in the demo`}><span className="facility-system-number" aria-hidden="true">0{index + 1}</span>{FACILITY_LABELS[system]}</a>)}</nav>
    <div className="facility-explanation"><div className="facility-explanation-heading"><div className="facility-explanation-titles"><strong>Inspect the physical context</strong></div><button type="button" className="facility-clear" disabled>Clear selection</button></div><div className="facility-explanation-copy"><p>Select Power, Cooling, Storage or Workloads to inspect their role in this assessment.</p></div></div>
    <div className="facility-assessment-caption" data-testid="facility-assessment-caption"><div className="facility-result-heading"><span>{facilityWindowLabel(record)}</span><span className="facility-outcome">Model screen: {view.screeningOutcome}</span></div><dl className="facility-quantities"><div><dt>Requested increment</dt><dd>{view.requested}</dd></div><div><dt>Modeled eligible increment</dt><dd>{view.modeled}</dd></div></dl><p>Additional to the {view.reference} reference.</p></div>
    <nav className="facility-journeys" aria-label="Continue facility inspection"><a href={`${demoHref}#facility-construction`}>Inspect rack construction <span aria-hidden="true">→</span></a><a href={`${demoHref}#workload-story`}>Follow one workload <span aria-hidden="true">→</span></a></nav>
    <p id="home-facility-scope" className="facility-scope">Synthetic illustration · Economics unestimated.<br />No site action is authorized. Accepted and delivered capacity: not applicable.</p>
    <noscript><p className="facility-motion-note">This is a static illustration. Read the assessment below for the modeled result and its evidence.</p></noscript>
  </section>
}
