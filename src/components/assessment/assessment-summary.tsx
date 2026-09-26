import { selectAssessment } from "@/lib/assessment/selectors"
import type { AssessmentRecord } from "@/types/assessment"
import { AssessmentCapacityComparison } from "./assessment-capacity-comparison"

export function AssessmentSummary({ record, compact = false, showLinks = true }: { record: AssessmentRecord; compact?: boolean; showLinks?: boolean }) {
  const view = selectAssessment(record)
  if (compact) return <section className="assessment-decision rounded-xl border border-border bg-surface p-4 sm:p-5" data-testid="assessment-summary" data-scenario={record.scenario} aria-label={`Fixture ${record.scenario.toUpperCase()} decision`}>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"><p className="font-medium text-primary">Synthetic · Fixture {record.scenario.toUpperCase()}</p><p>Model screen: {record.screeningOutcome}</p></div>
    <h2 className="sr-only">{record.title}</h2>
    <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,8em),1fr))] gap-4"><div className="flex flex-col justify-between"><dt className="text-sm leading-5 text-muted-foreground">Requested increment</dt><dd className="mt-1 text-2xl font-medium tabular-nums">{view.requested}</dd></div><div className="flex flex-col justify-between"><dt className="text-sm leading-5 text-muted-foreground">Modeled eligible increment</dt><dd className="mt-1 text-2xl font-medium tabular-nums">{view.modeled}</dd></div></dl>
    <p className="mt-3 text-sm leading-5 text-muted-foreground">Additional to the {view.reference} reference. {view.interval}.</p>
    <div className="mt-4 border-l-2 border-primary pl-3" data-decision-question><h3 className="text-base font-medium">Decision still to make</h3><p className="mt-1 text-base leading-6 text-muted-foreground">{record.commercial.question}</p></div>
    <p className="mt-3 text-sm leading-5 text-muted-foreground">Synthetic · Economics unestimated. No operational authority.</p>
    <details className="mt-2"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Result and assessment limits</summary><div className="space-y-3 pb-2 text-sm leading-6"><p>{view.conclusion}</p><AssessmentCapacityComparison record={record} /><p><span className="text-muted-foreground">Proposed revised increment:</span> {view.revised}</p><p className="text-muted-foreground">Economics unestimated. Operator acceptance and delivered capacity: not applicable. This synthetic model screen provides no operational authority.</p></div></details>
    {showLinks && <div className="mt-2 flex flex-wrap gap-x-6 text-sm"><a href={view.links.brief} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Read this decision brief</a><a href={view.links.pdf} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Download PDF</a></div>}
  </section>
  return (
    <div className={`rounded-xl border border-border bg-surface p-5 ${compact ? "assessment-decision" : "sm:p-7"}`} data-testid="assessment-summary" data-scenario={record.scenario}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm"><p className="font-medium text-primary">Synthetic example · {record.basis.siteId} · Fixture {record.scenario.toUpperCase()}</p><p className="rounded-full border border-border px-3 py-1 text-foreground">Model screen: {record.screeningOutcome}</p></div>
      <p className="mt-5 text-xl font-medium text-foreground sm:text-2xl">{record.title}</p>
      <div className={`grid gap-4 ${compact ? "mt-4 grid-cols-2" : "mt-6 sm:grid-cols-3"}`}><Metric label="Requested increment" value={view.requested} /><Metric label="Modeled eligible increment" value={view.modeled} /><Metric label="Proposed revised increment" value={view.revised} /></div>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">Additional load above the same {view.reference} reference. {view.interval}.</p>
      <AssessmentCapacityComparison record={record} />
      <p className={`${compact ? "mt-4 text-base leading-6" : "mt-5 leading-7"} max-w-3xl text-foreground`}>{view.conclusion}</p>
      <div className="mt-5 border-l-2 border-primary pl-4"><p className="font-medium text-foreground">Decision still to make</p><p className={`mt-1 text-muted-foreground ${compact ? "text-base leading-6" : "leading-7"}`}>{record.commercial.question}</p></div>
      {!compact && <p className="mt-5 leading-7 text-muted-foreground">{record.reasons.map((reason) => reason.detail).join(" ")}</p>}
      <p className="mt-5 text-sm leading-6 text-muted-foreground">Economics unestimated. Operator acceptance and delivered capacity: not applicable. This synthetic model screen provides no operational authority.</p>
      {showLinks && <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium"><a href={view.links.brief} className="text-primary underline underline-offset-4">Read this decision brief</a><a href={view.links.pdf} className="text-primary underline underline-offset-4">Download PDF</a></div>}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm leading-6 text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-medium tracking-tight text-foreground sm:text-3xl">{value}</p></div>
}
