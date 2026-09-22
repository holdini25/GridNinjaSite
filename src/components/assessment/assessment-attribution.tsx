import { formatKWAsMW } from "@/lib/assessment/format"
import { selectAttribution } from "@/lib/assessment/selectors"
import type { AssessmentRecord } from "@/types/assessment"

export function AssessmentAttribution({ record }: { record: AssessmentRecord }) {
  const rows = selectAttribution(record)
  if (!rows.length || record.nominal.status !== "known") return <p className="rounded-xl border border-border p-5 leading-7 text-muted-foreground">No attribution chart is available: the modeled increment is unknown. Missing cooling evidence must be resolved first.</p>
  const maximum = record.nominal.valueKW
  return <figure className="rounded-xl border border-border bg-surface p-5" data-testid="assessment-attribution"><figcaption className="text-lg font-medium text-foreground">Illustrative sequential attribution</figcaption><p className="mt-2 text-sm leading-6 text-muted-foreground">These authored reductions explain this example only. Order matters; interacting constraints may overlap. The sequence is not a physical decomposition or a count of independent benefits.</p><ol className="mt-5 space-y-4"><li><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Nominal increment</span><span>{formatKWAsMW(maximum)}</span></div><div className="mt-2 h-2 rounded bg-muted-foreground/70" aria-hidden="true" /></li>{rows.map((row) => <li key={row.id}><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{row.label} (−{formatKWAsMW(row.reductionKW)})</span><span>{formatKWAsMW(row.endKW)} remaining</span></div><div className="mt-2 h-2 rounded bg-surface-2" aria-hidden="true"><div className="h-full rounded bg-primary" style={{ width: `${(row.endKW / maximum) * 100}%` }} /></div></li>)}</ol><p className="mt-4 text-sm leading-6 text-muted-foreground">Final endpoint: modeled eligible increment. It is not operator-accepted or delivered capacity.</p></figure>
}
