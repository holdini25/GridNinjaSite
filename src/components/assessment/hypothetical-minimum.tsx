"use client"

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { formatKWAsMW } from "@/lib/assessment/format"
import { canCompareHypotheticalMinimum, compareHypotheticalMinimum, HYPOTHETICAL_MINIMUM_PRESETS, parseHypotheticalMinimum, type HypotheticalMinimumSource } from "@/lib/assessment/hypothetical-minimum"
import type { AssessmentRecord } from "@/types/assessment"
import { HypotheticalMinimumExamples, HypotheticalMinimumScope } from "./hypothetical-minimum-examples"

export function HypotheticalMinimum({ record, source, initiallyOpen = false, onOpenChange }: {
  record: AssessmentRecord
  source?: HypotheticalMinimumSource | null
  initiallyOpen?: boolean
  onOpenChange: (open: boolean) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState("")
  const [applied, setApplied] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(initiallyOpen)
  if (record.scenario !== "b" || record.publication.version !== "1.0.0") return null
  const eligible = canCompareHypotheticalMinimum(record, source)
  const result = eligible && applied !== null ? compareHypotheticalMinimum(record, source, { origin: "visitor-assumption", source, minimumKW: applied }) : null
  function apply(value: string) {
    const parsed = parseHypotheticalMinimum(value)
    setError(parsed.ok ? "" : parsed.error)
    setApplied(parsed.ok ? parsed.minimumKW : null)
  }
  return <details id="hypothetical-minimum" tabIndex={-1} open={open} onToggle={event => { const next = event.currentTarget.open; setOpen(next); onOpenChange(next) }} className="mt-4 scroll-mt-28 rounded-xl border border-border bg-surface p-4" data-testid="hypothetical-minimum">
    <summary className="min-h-11 cursor-pointer content-center font-medium">Explore a hypothetical minimum</summary>
    {eligible ? <div className="mt-3">
      <p className="text-sm leading-6 text-muted-foreground">Fixture B records no minimum. Compare your own assumption with its published revision, without changing the assessment.</p>
      <form noValidate onSubmit={event => { event.preventDefault(); apply(draft) }} className="mt-4">
        <label htmlFor={id} className="block text-sm font-medium">Hypothetical minimum increment (MW)</label>
        <input id={id} type="number" inputMode="decimal" min="0" max="7" step="0.1" value={draft} onChange={event => { setDraft(event.target.value); setApplied(null); setError("") }} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-surface-2 px-3 py-2 text-base" />
        <p id={`${id}-help`} className="mt-2 text-sm text-muted-foreground">0–7.0 MW, in steps of 0.1 MW. This value is not saved or sent.</p>
        {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Hypothetical minimum presets">{HYPOTHETICAL_MINIMUM_PRESETS.map(value => <Button key={value} type="button" variant="outline" onClick={() => { setDraft(value); apply(value) }}>{value} MW</Button>)}</div>
        <div className="mt-3 flex flex-wrap gap-3"><Button type="submit">Compare minimum</Button><Button type="button" variant="outline" onClick={() => { setDraft(""); setApplied(null); setError("") }}>Reset comparison</Button></div>
      </form>
      <div role="status" aria-live="polite" aria-atomic="true" className="mt-4 text-sm leading-6" data-testid="hypothetical-result">
        {result ? <><h3 className="font-medium">Hypothetical comparison</h3><p className="mt-1">The recorded {formatKWAsMW(result.recordedRevisionKW)} revision is {result.relation === "equal" ? "equal to" : `${formatKWAsMW(Math.abs(result.marginKW))} ${result.relation}`} the assumed {formatKWAsMW(result.minimumKW)} minimum.</p>{result.relation === "equal" && <p>There is no additional numerical margin in this comparison.</p>}</> : <p className="text-muted-foreground">{draft ? "Apply the updated minimum to compare it." : "Enter a minimum or choose an example to compare."}</p>}
      </div>
      <HypotheticalMinimumScope />
      <details className="mt-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Read the example comparisons</summary><HypotheticalMinimumExamples record={record} source={source} /></details>
    </div> : <p className="mt-3 text-sm leading-6 text-muted-foreground">The publication needed for this comparison is temporarily unavailable. The assessment and its exact evidence links remain available.</p>}
  </details>
}
