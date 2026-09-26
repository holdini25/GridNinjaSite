import { selectAssessment } from "@/lib/assessment/selectors"
import type { AssessmentRecord } from "@/types/assessment"
import { AssessmentCapacityComparison } from "@/components/assessment/assessment-capacity-comparison"

/** A readable excerpt of the authoritative record, not a new assessment. */
export function DecisionBriefPreview({ record }: { record: AssessmentRecord }) {
  const view = selectAssessment(record)
  return <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface [overflow-wrap:anywhere]" aria-label={`Decision brief preview, fixture ${record.scenario.toUpperCase()}`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-5 py-4 sm:px-7">
      <p className="font-mono text-xs tracking-wide text-muted-foreground">{record.publication.id.toUpperCase()} / v{record.publication.version}</p>
      <span className="text-xs font-medium text-primary">Synthetic example</span>
    </div>
    <div className="p-5 sm:p-7">
      <p className="text-sm text-muted-foreground">Model screen · <span className="font-medium text-foreground">{view.screeningOutcome}</span></p>
      <h3 className="mt-3 text-2xl leading-tight font-medium">{view.title}</h3>
      <dl className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,7em),1fr))] gap-4 border-y border-divider py-5">
        <div><dt className="text-sm leading-6 text-muted-foreground">Requested increment</dt><dd className="mt-1 text-3xl font-medium tracking-tight">{view.requested}</dd></div>
        <div><dt className="text-sm leading-6 text-muted-foreground">Modeled eligible increment</dt><dd className="mt-1 text-3xl font-medium tracking-tight">{view.modeled}</dd></div>
      </dl>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Additional to the {view.reference} reference. {view.interval}.</p>
      <AssessmentCapacityComparison record={record} />
      <p className="mt-4 leading-7">{view.conclusion}</p>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Economics unestimated. Operator acceptance and delivered capacity: not applicable. No operational authority.</p>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={view.links.brief}>Read this decision brief</a>
        <a className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={view.links.pdf}>Download PDF</a>
        {record.scenario === "b" && <a className="inline-flex min-h-11 items-center text-primary underline underline-offset-4" href={`${view.links.demo}#hypothetical-minimum`}>Explore a hypothetical minimum</a>}
      </div>
    </div>
  </article>
}
