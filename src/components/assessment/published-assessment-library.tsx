import { ASSESSMENT_SCENARIOS } from "@/content/assessments/constants"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { readAssessmentPublication } from "@/lib/assessment/publications"
import { assessmentLinks } from "@/lib/assessment/selectors"
import { isPublicationPromotable } from "@/seo/publication-eligibility"

/** Promotion uses the same integrity reader as the exact downloadable artifacts. */
export async function PublishedAssessmentLibrary() {
  const publications = await Promise.all(ASSESSMENT_SCENARIOS.map(async scenario => {
    const identity = assessmentFixtures[scenario].publication
    try {
      const result = await readAssessmentPublication(identity.id, `v${identity.version}`, "json")
      return result.status === 200 && isPublicationPromotable(result.manifest.status) ? result.record : null
    } catch { return null }
  }))
  return <section aria-labelledby="published-assessment-heading">
    <h2 id="published-assessment-heading" className="text-2xl font-medium">Published synthetic decision briefs</h2>
    <p className="mt-3 max-w-3xl text-base leading-8 text-muted-foreground">Four authored scenarios show how a request, its conditions, and missing evidence change the decision. Each brief has a matched PDF and technical record. These are illustrative assessments, not customer outcomes or operating permission.</p>
    <div className="mt-6 grid gap-5 lg:grid-cols-2">{publications.map((record, index) => {
      if (!record) return <article key={ASSESSMENT_SCENARIOS[index]} className="rounded-xl border border-border bg-surface p-6"><h3 className="text-xl font-medium">Fixture {ASSESSMENT_SCENARIOS[index].toUpperCase()}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">This publication is currently unavailable. No alternative assessment has been substituted.</p></article>
      const links = assessmentLinks(record)
      return <article key={record.publication.id} className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm text-muted-foreground">Synthetic · Fixture {record.scenario.toUpperCase()} · v{record.publication.version}</p>
        <h3 className="mt-3 text-xl font-medium"><a href={links.brief} className="hover:text-primary">{record.title}</a></h3>
        <p className="mt-3 leading-7 text-muted-foreground">{record.commercial.question}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm"><a href={links.brief} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Read fixture {record.scenario.toUpperCase()} brief</a><a href={links.pdf} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Download fixture {record.scenario.toUpperCase()} PDF</a><a href={links.json} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Download fixture {record.scenario.toUpperCase()} technical record</a></div>
      </article>
    })}</div>
    <a className="mt-5 inline-flex min-h-11 items-center text-primary underline underline-offset-4" href="/demo#decision-brief">Inspect the assessment and equipment relationships →</a>
  </section>
}
