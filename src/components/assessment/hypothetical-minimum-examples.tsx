import { formatKWAsMW } from "@/lib/assessment/format"
import { compareHypotheticalMinimum, HYPOTHETICAL_MINIMUM_PRESETS, parseHypotheticalMinimum, type HypotheticalMinimumSource } from "@/lib/assessment/hypothetical-minimum"
import type { AssessmentRecord } from "@/types/assessment"

/** Also rendered in the server preview: no graphics or JavaScript is needed to read it. */
export function HypotheticalMinimumExamples({ record, source }: { record: AssessmentRecord; source: HypotheticalMinimumSource }) {
  return <div className="overflow-x-auto"><table className="mt-4 w-full text-left text-sm leading-6">
    <caption className="pb-3 text-left text-muted-foreground">Hypothetical examples compared with the recorded 5.8 MW revision.</caption>
    <thead><tr className="border-b border-divider"><th scope="col" className="py-2 pr-4 font-medium">Assumed minimum</th><th scope="col" className="py-2 font-medium">Revision minus minimum</th></tr></thead>
    <tbody>{HYPOTHETICAL_MINIMUM_PRESETS.map(value => {
      const parsed = parseHypotheticalMinimum(value)
      const result = parsed.ok ? compareHypotheticalMinimum(record, source, { origin: "visitor-assumption", source, minimumKW: parsed.minimumKW }) : null
      return result && <tr key={value} className="border-b border-divider"><th scope="row" className="py-2 pr-4 font-normal">{value} MW</th><td className="py-2 tabular-nums">{result.marginKW > 0 ? "+" : result.marginKW < 0 ? "−" : ""}{formatKWAsMW(Math.abs(result.marginKW))}</td></tr>
    })}</tbody>
  </table></div>
}

export function HypotheticalMinimumScope() {
  return <p className="mt-3 text-sm leading-6 text-muted-foreground">This arithmetic comparison does not change fixture B, establish feasibility, or assign a workload to equipment. All recorded conditions and operational and commercial reviews still apply. Economics remain unestimated.</p>
}
