import "server-only"

import { homepageResearch, researchPresentation, researchStripFooter } from "@/content/research"

/** Server-rendered reading strip; qualifications remain visible beside each finding. */
export function ResearchNotes({ className }: { className?: string }) {
  return <section id="research-notes" className={["gn-research", "gn-research-notes", className].filter(Boolean).join(" ")} aria-labelledby="research-notes-heading">
    <header className="gn-research-header">
      <h2 id="research-notes-heading">{researchPresentation.sectionHeading}</h2>
      <p className="gn-research-introduction">{researchPresentation.introduction}</p>
    </header>
    <ol className="gn-research-notes-list">
      {homepageResearch.map(source => <li key={source.id} data-research-id={source.id} className="gn-research-note">
        <p className="gn-research-topic">{source.homepageNote.topic}</p>
        <h3 className="gn-research-title"><a href={source.primaryUrl}>{source.title}</a></h3>
        <p className="gn-research-citation">{source.homepageNote.linkLabel}</p>
        <p className="gn-research-finding">{source.homepageNote.text}</p>
        <p className="gn-research-limitation"><strong>Study limit: </strong>{source.homepageNote.adjacentLimitation}</p>
      </li>)}
    </ol>
    <footer className="gn-research-footer">
      <p>{researchStripFooter}</p>
      <a href={researchPresentation.fullBibliographyHref}>{researchPresentation.fullBibliographyLinkLabel}</a>
    </footer>
  </section>
}
