import "server-only"

import { formatResearchCitation, researchCatalog, researchPresentation, researchStripFooter, researchStudyLabels } from "@/content/research"

/** External sources are separate from GridNinja publications and evidence stages. */
export function ResearchBibliography({ className }: { className?: string }) {
  return <section id="research" className={["gn-research", "gn-research-bibliography", className].filter(Boolean).join(" ")} aria-labelledby="research-heading">
    <header className="gn-research-header">
      <h2 id="research-heading">{researchPresentation.sectionHeading}</h2>
      <p className="gn-research-introduction">{researchPresentation.introduction}</p>
      <p>These seven peer-reviewed journal articles inform different questions. Their methods, settings and limitations matter as much as their findings.</p>
    </header>
    <ol className="gn-research-bibliography-list">
      {researchCatalog.map(source => <li key={source.id} id={`research-${source.id}`} data-research-id={source.id} className="gn-research-reference">
        <article aria-labelledby={`research-title-${source.id}`}>
          <p className="gn-research-topic">{researchStudyLabels[source.studyType]}</p>
          <h3 id={`research-title-${source.id}`} className="gn-research-title"><a href={source.primaryUrl}>{source.title}</a></h3>
          <p className="gn-research-authors">{source.authors.join("; ")}.</p>
          <p className="gn-research-citation">{formatResearchCitation(source)} <a href={`https://doi.org/${source.doi}`}>DOI: {source.doi}</a></p>
          <p className="gn-research-dates">{source.dateNote}</p>
          <dl className="gn-research-context">
            <div><dt>Setting</dt><dd>{source.setting.geography}. {source.setting.systemOrPopulation}.{source.setting.observationPeriod ? ` ${source.setting.observationPeriod}.` : ""}</dd></div>
            <div><dt>Supported idea</dt><dd>{source.supportedMarketingSentence}</dd></div>
          </dl>
          <div className="gn-research-limits">
            <h4>Study limits</h4>
            <ul>{source.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
          </div>
          <p className="gn-research-interests"><strong>Interests and context: </strong>{source.conflictsOrInterests}</p>
          <div className="gn-research-review">
            <p><strong>Review and access: </strong>{source.verification.contentReviewed} {source.verification.accessLimitations}</p>
            <p>Source review: <time dateTime={source.reviewedOn}>10 October 2026</time>. {source.updateReview.crossmarkStatus === "current"
              ? <>The <a href={source.updateReview.crossmarkUrl}>Crossmark record</a> reported this document current on that date.</>
              : <>A <a href={source.updateReview.crossmarkUrl}>Crossmark status record</a> was unavailable; the update check used publisher-indexed content, deposited metadata and targeted notice searches.</>}</p>
          </div>
        </article>
      </li>)}
    </ol>
    <footer className="gn-research-footer">
      <p>{researchStripFooter}</p>
      <p>No correction or retraction notice was found in the records checked on 10 October 2026. This is a bounded source check, not a guarantee that no update exists. Full methods, data and code were not independently reproduced.</p>
    </footer>
  </section>
}
