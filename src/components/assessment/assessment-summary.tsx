import { selectAssessment } from "@/lib/assessment/selectors"
import type { AssessmentRecord } from "@/types/assessment"

export function AssessmentSummary({ record, compact = false, showLinks = true }: { record: AssessmentRecord; compact?: boolean; showLinks?: boolean }) {
  const view = selectAssessment(record)
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-7" data-testid="assessment-summary" data-scenario={record.scenario}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm"><p className="font-medium text-primary">Synthetic example · {record.basis.siteId} · Fixture {record.scenario.toUpperCase()}</p><p className="rounded-full border border-border px-3 py-1 text-foreground">Model screen: {record.screeningOutcome}</p></div>
      <p className="mt-5 text-xl font-medium text-foreground sm:text-2xl">{record.title}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-3"><Metric label="Requested increment" value={view.requested} /><Metric label="Modeled eligible increment" value={view.modeled} /><Metric label="Proposed revised increment" value={view.revised} /></div>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">Additional load above the same {view.reference} reference. {view.interval}.</p>
      <p className="mt-5 max-w-3xl leading-7 text-foreground">{view.conclusion}</p>
      <div className="mt-5 border-l-2 border-primary pl-4"><p className="font-medium text-foreground">Decision still to make</p><p className="mt-1 leading-7 text-muted-foreground">{record.commercial.question}</p></div>
      {!compact && <p className="mt-5 leading-7 text-muted-foreground">{record.reasons.map((reason) => reason.detail).join(" ")}</p>}
      <p className="mt-5 text-sm leading-6 text-muted-foreground">Economics unestimated. Operator acceptance and delivered capacity: not applicable. This synthetic model screen provides no operational authority.</p>
      {showLinks && <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium"><a href={view.links.brief} className="text-primary underline underline-offset-4">Read this decision brief</a><a href={view.links.pdf} className="text-primary underline underline-offset-4">Download PDF</a></div>}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm leading-6 text-muted-foreground">{label}</p><p className="mt-1 break-words text-2xl font-medium tracking-tight text-foreground sm:text-3xl">{value}</p></div>
}
