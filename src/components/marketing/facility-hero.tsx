import Link from "next/link"
import { FacilityHeroVideo } from "@/components/marketing/facility-hero-video"
import { FacilityHeroAnnotations } from "@/components/marketing/facility-hero-annotations"
import { cinematicHome } from "@/content/copy/cinematic-home"
import { selectAssessment } from "@/lib/assessment/selectors"
import { assessmentScopeHref, sampleBriefHref } from "@/lib/marketing-journeys"
import type { AssessmentRecord } from "@/types/assessment"
import type { CinematicRelease } from "@/types/cinematic"
import type { FacilityVisualRelease } from "@/types/facility"

type Props = { record: AssessmentRecord; release: CinematicRelease | null; fallback: FacilityVisualRelease | null; cinematicUnavailable?: boolean }

/** Marketing media and selector-backed meaning stay separate from the Three viewer. */
export function FacilityHero({ record, release, fallback, cinematicUnavailable = false }: Props) {
  const view = selectAssessment(record)
  const poster = fallback ? <picture className="cinematic-poster">
    <source media="(max-width: 639px)" srcSet={fallback.posters.mobile.url} />
    <img {...{ elementtiming: "cinematic-poster" }} src={fallback.posters.desktop.url} width="1360" height="800" fetchPriority="high" loading="eager" decoding="async" alt="Synthetic facility showing server racks, cooling, electrical distribution and reserve storage." />
  </picture> : null
  return <section className="gn-home-hero" aria-labelledby="home-heading">
    <div className="gn-home-container gn-home-hero-grid">
      <div className="gn-home-intro">
        <p className="gn-home-eyebrow">{cinematicHome.eyebrow}</p>
        <h1 id="home-heading">Understand your capacity.<br /> Know the limits.</h1>
        <p className="gn-home-lead">{cinematicHome.body}</p>
        <div className="gn-home-actions">
          <Link href={assessmentScopeHref("home-hero")} prefetch={false} className="gn-home-button" data-analytics-event="assessment_cta_selected" data-analytics-source="home-hero">Scope an assessment <span aria-hidden="true">↗</span></Link>
          <Link href={sampleBriefHref()} prefetch={false} className="gn-home-text-link">See a sample decision brief <span aria-hidden="true">→</span></Link>
        </div>
        <p className="gn-home-trust">{cinematicHome.trust}</p>
      </div>
      <div className="gn-home-facility">
        <figure className="gn-home-facility-figure">
          <figcaption className="gn-home-figure-caption"><span>Illustrative facility {release?.mode === "auto" ? "animation" : "view"} <span className="gn-home-figure-synthetic">· Synthetic</span></span><Link href={`${view.links.demo}&activate=1#facility-construction`} prefetch={false} className="gn-home-figure-inspect" aria-label="Inspect the illustrative facility">Inspect facility <span aria-hidden="true">↗</span></Link></figcaption>
          {cinematicUnavailable && <p className="gn-home-media-notice" role="status">Animation unavailable. {fallback ? "A static facility illustration is shown." : "The sample decision remains readable below."}</p>}
          {release ? <FacilityHeroVideo release={release}>{release.release === "cinematic-v1" && <FacilityHeroAnnotations />}</FacilityHeroVideo> : <div className="cinematic-stage">{poster ?? <div className="gn-home-media-unavailable">The illustrative facility is unavailable. The sample decision remains readable below.</div>}</div>}
        </figure>
        <article className="gn-home-decision" aria-label="Synthetic capacity decision, fixture B">
          <div className="gn-home-decision-top"><span>Synthetic example · {view.durationHours}-hour window</span><span className="gn-home-screen">Model screen: {view.screeningOutcome}</span></div>
          <dl><div><dt>Requested increment</dt><dd>{view.requested}</dd></div><div><dt>Modeled eligible increment</dt><dd>{view.modeled}</dd></div></dl>
          <p className="gn-home-decision-basis">Additional to the {view.reference} reference. {view.interval}.</p>
          <div className="gn-home-decision-bottom"><p>Economics unestimated. No site action is authorized.<br />Accepted and delivered capacity: not applicable.</p><a href={view.links.brief} aria-label={`Read ${record.publication.id} version ${record.publication.version}`}><span>{record.publication.id.toUpperCase()}</span><span>v{record.publication.version} ↗</span></a></div>
        </article>
      </div>
    </div>
  </section>
}
