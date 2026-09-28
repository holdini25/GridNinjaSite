import { formatKWAsMW } from "@/lib/assessment/format"
import { selectCapacityComparison } from "@/lib/assessment/selectors"
import type { AssessmentRecord } from "@/types/assessment"

/** Small HTML graphic with equivalent labels. No chart library or graphics state. */
export function AssessmentCapacityComparison({ record }: { record: AssessmentRecord }) {
  const comparison = selectCapacityComparison(record)
  return <figure className="mt-4" aria-label="Capacity increments compared from a common zero" data-testid="assessment-capacity-comparison">
    <div className="space-y-3">{comparison.rows.map(row => <div key={row.id}>
      <div className="flex flex-wrap justify-between gap-x-4 text-sm leading-6"><span>{row.label}</span><span className="tabular-nums">{row.valueKW === null ? "Unknown" : formatKWAsMW(row.valueKW)}</span></div>
      {row.valueKW !== null && <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-surface-2" aria-hidden="true"><div className={`h-full ${row.id === "modeled" ? "bg-primary" : row.id === "minimum" ? "bg-muted-foreground" : "bg-foreground/70"}`} style={{ width: `${row.valueKW / comparison.maximumKW * 100}%` }} /></div>}
    </div>)}</div>
    <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">All values are additional load at the same meter and for the same hour.{comparison.requestDifferenceKW !== null && comparison.requestDifferenceKW > 0 ? ` The request exceeds the modeled increment by ${formatKWAsMW(comparison.requestDifferenceKW)}.` : ""}</figcaption>
  </figure>
}
