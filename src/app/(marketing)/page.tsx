/* eslint-disable @next/next/no-img-element -- Immutable pre-rendered supporting assets keep explicit dimensions and lazy loading without a client image runtime. */
import type { Metadata } from "next"
import Link from "next/link"
import { AssessmentCapacityComparison } from "@/components/assessment/assessment-capacity-comparison"
import { AssessmentMechanismIcon } from "@/components/marketing/assessment-mechanism-icon"
import { FacilityHero } from "@/components/marketing/facility-hero"
import { SeoPageJsonLd } from "@/components/seo/json-ld"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { cinematicHome } from "@/content/copy/cinematic-home"
import { selectAssessment } from "@/lib/assessment/selectors"
import { getCinematicRelease } from "@/lib/cinematic/releases"
import { selectedCinematicReleaseId } from "@/lib/cinematic/selection.mjs"
import { getFacilityRelease } from "@/lib/facility/releases"
import { assessmentScopeHref, sampleBriefHref } from "@/lib/marketing-journeys"
import { createPageMetadata } from "@/lib/seo"
import { getSeoRoute } from "@/seo/route-manifest"
import "@/components/marketing/cinematic-home.css"

export async function generateMetadata(): Promise<Metadata> { return createPageMetadata({ path: "/" }) }

export default async function HomePage() {
  const release = await getCinematicRelease()
  const fallback = release ? null : await getFacilityRelease()
  const record = assessmentFixtures.b
  const view = selectAssessment(record)
  const seoRoute = getSeoRoute("/")
  const fallbackImage = release?.renditions.desktop.poster ?? fallback?.posters.desktop
  const construction = release?.stills?.construction ?? fallbackImage
  const cooling = release?.stills?.cooling ?? fallbackImage
  return <>
    <SeoPageJsonLd path="/" includeSiteIdentity />
    <div className="gn-home" data-seo-related-source="/" data-seo-related-paths={JSON.stringify(seoRoute.relatedPaths)} data-seo-route-tier={seoRoute.tier}>
      <FacilityHero record={record} release={release} fallback={fallback} cinematicUnavailable={Boolean(selectedCinematicReleaseId()) && !release} />

      <section className="gn-home-light gn-home-section gn-home-mechanism" aria-labelledby="mechanism-heading">
        <div className="gn-home-container">
          <p className="gn-home-purpose">{cinematicHome.purpose}</p>
          <p className="gn-home-eyebrow">The assessment mechanism</p>
          <h2 id="mechanism-heading">From physical constraints<br className="gn-home-desktop-break" /> to inspectable decisions.</h2>
          <ol className="gn-home-mechanism-grid">{cinematicHome.mechanism.map((step, index) => <li key={step.title}>
            <div className="gn-home-mechanism-icon"><AssessmentMechanismIcon step={index} /></div>
            <div><h3><span>0{index + 1}</span>{step.title}</h3><p>{step.body}</p></div>
          </li>)}</ol>
        </div>
      </section>

      <section id="decision-brief" className="gn-home-light gn-home-section gn-home-worked" aria-labelledby="worked-heading">
        <div className="gn-home-container gn-home-worked-grid">
          <div className="gn-home-section-intro">
            <p className="gn-home-eyebrow">A worked decision · synthetic</p>
            <h2 id="worked-heading">The limit is a finding.<br />The commitment is a decision.</h2>
            <p>Fixture B records a proposed increment and a smaller modeled revision. The next question belongs to the service and commercial decision owner.</p>
            <p className="gn-home-inline-boundary">A useful assessment can also return a negative result or identify missing evidence.</p>
            <Link href={sampleBriefHref()} prefetch={false} className="gn-home-text-link">Compare the four scenarios <span aria-hidden="true">→</span></Link>
          </div>
          <article className="gn-home-brief" aria-labelledby="brief-question">
            <div className="gn-home-brief-heading"><span>{record.publication.id.toUpperCase()} / v{record.publication.version}</span><span>Model screen · {view.screeningOutcome}</span></div>
            <h3 id="brief-question">{record.commercial.question}</h3>
            <AssessmentCapacityComparison record={record} />
            <p className="gn-home-brief-basis">Additional to the {view.reference} reference. {view.interval}.</p>
            <p className="gn-home-brief-conclusion">{view.conclusion}</p>
            <p className="gn-home-brief-limit">Synthetic. Economics unestimated. Accepted and delivered capacity: not applicable. No operational authority.</p>
            <div className="gn-home-brief-links"><a href={view.links.brief}>Read this decision brief <span aria-hidden="true">↗</span></a><a href={view.links.pdf}>Download PDF <span aria-hidden="true">↓</span></a></div>
          </article>
        </div>
      </section>

      <section id="solutions" className="gn-home-light gn-home-section gn-home-fit" aria-labelledby="fit-heading">
        <div className="gn-home-container">
          <div className="gn-home-section-heading"><div><p className="gn-home-eyebrow">Start with your decision</p><h2 id="fit-heading">What are you ready to commit?</h2></div><p>One clear question. The right evidence.<br /> An accountable decision owner.</p></div>
          <div className="gn-home-buyer-grid">{cinematicHome.buyers.map((buyer, index) => <article className="gn-home-buyer" key={buyer.href}>
            {construction && <div className={`gn-home-buyer-image gn-home-buyer-image--${index}`} aria-hidden="true"><img src={construction.url} width="720" height="450" alt="" loading="lazy" decoding="async" /></div>}
            <div><p className="gn-home-card-label">{buyer.audience}</p><h3>{buyer.title}</h3><p>{buyer.body}</p><Link href={buyer.href} prefetch={false} className="gn-home-text-link">Explore the decision <span aria-hidden="true">→</span></Link></div>
          </article>)}</div>
          <p className="gn-home-fit-note">Considering cooling investment or <Link href="/solutions/bridge-power" prefetch={false}>bridge power and on-site generation</Link>? Feasibility and economics require a separate assessment scope.</p>
        </div>
      </section>

      <section id="evidence" className="gn-home-light gn-home-section gn-home-evidence" aria-labelledby="evidence-heading">
        <div className="gn-home-container">
          <div className="gn-home-section-heading"><div><p className="gn-home-eyebrow">Inspect the basis</p><h2 id="evidence-heading">Engineering you can inspect.</h2><p>Start with the sample output. Review the method and the platform direction.</p></div><Link href="/evidence" prefetch={false} className="gn-home-text-link">Explore public evidence <span aria-hidden="true">→</span></Link></div>
          <div className="gn-home-evidence-grid">{cinematicHome.evidence.map(card => {
            const still = card.image === "construction" ? construction : cooling
            return <article key={card.href} className="gn-home-evidence-card">
              <div className={`gn-home-evidence-image gn-home-evidence-image--${card.image}`} aria-hidden="true">
                {card.image === "brief" ? <div className="gn-home-paper"><div><span>GRIDNINJA</span><span>DECISION BRIEF</span></div><p>{record.publication.id.toUpperCase()} · v{record.publication.version}</p><strong>{view.title}</strong><div className="gn-home-paper-numbers"><span>Requested<b>{view.requested}</b></span><span>Modeled eligible<b>{view.modeled}</b></span></div><span className="gn-home-paper-rule" /><small>Synthetic example · No operational authority</small></div> : still ? <img src={still.url} width="720" height="450" alt="" loading="lazy" decoding="async" /> : <AssessmentMechanismIcon step={card.image === "construction" ? 0 : 1} />}
                <span className="gn-home-evidence-caption">{card.image === "brief" ? "Decision brief excerpt" : card.image === "construction" ? "Illustrative facility" : "Illustrative cooling assembly"}</span>
              </div>
              <div className="gn-home-evidence-copy"><p className="gn-home-card-label">{card.status}{card.image === "brief" && ` · v${record.publication.version}`}</p><h3>{card.title}</h3><p>{card.body}</p><Link href={card.image === "brief" ? sampleBriefHref() : card.href} prefetch={false} className="gn-home-text-link" data-seo-related-target={card.href === "/platform" || card.href === "/proof" ? card.href : undefined}>{card.link} <span aria-hidden="true">→</span></Link></div>
            </article>
          })}</div>
          <div className="gn-home-development"><p>GridNinja is developing an <strong>AI Data Center Virtual Capacity Control Plane</strong> and a <strong>runtime-assured virtual capacity engine</strong> for inside-the-fence orchestration. Proof before autonomy.</p><div><p>Delivery responsibilities, relevant experience and reviewer availability are established during scoping. Public team credentials and customer outcomes are not yet published.</p><Link href="/about" prefetch={false} className="gn-home-text-link">About the work <span aria-hidden="true">→</span></Link></div></div>
        </div>
      </section>

      <section id="assessment-process" className="gn-home-light gn-home-section gn-home-scope" aria-labelledby="scope-heading">
        <div className="gn-home-container gn-home-scope-grid"><div><p className="gn-home-eyebrow">A bounded, paid assessment</p><h2 id="scope-heading">One question.<br />A reviewable answer.</h2></div><div><p className="gn-home-scope-lead">Agree the decision, evidence and responsibilities before analysis begins.</p><dl><div><dt>You bring</dt><dd>A capacity question, a decision owner, a facility boundary and permission to use the relevant historical inputs.</dd></div><div><dt>You receive</dt><dd>A decision brief, assumptions and evidence gaps, a supporting model record, and a review of unresolved questions.</dd></div></dl><p className="gn-home-scope-note">Deliverables, review rounds, exclusions, price and schedule are agreed during scoping. Do not send operational files or credentials through this website.</p><div className="gn-home-scope-links"><Link href="/assessment#deliverables" prefetch={false} data-seo-related-target="/assessment">Review the deliverables <span aria-hidden="true">→</span></Link><Link href="/data-handling" prefetch={false}>Data handling and permissions <span aria-hidden="true">→</span></Link></div></div></div>
      </section>

      <section className="gn-home-invitation" aria-labelledby="invitation-heading"><div className="gn-home-container"><div><p className="gn-home-eyebrow">Your next capacity decision</p><h2 id="invitation-heading">Start with your operating constraints.</h2><p>A scoping conversation establishes fit. Paid work starts only after agreement.</p></div><Link href={assessmentScopeHref("home-final")} prefetch={false} className="gn-home-button" data-analytics-event="assessment_cta_selected" data-analytics-source="home-final">Scope an assessment <span aria-hidden="true">↗</span></Link></div></section>
    </div>
  </>
}
