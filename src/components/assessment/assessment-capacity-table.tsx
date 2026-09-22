import { selectAssessment } from "@/lib/assessment/selectors"
import type { AssessmentRecord } from "@/types/assessment"

export function AssessmentCapacityTable({ record }: { record: AssessmentRecord }) {
  const view = selectAssessment(record)
  const rows = [
    ["Nominal increment", view.nominal, "Authored nameplate/headroom input; not a screened operating commitment."],
    ["Requested workload", view.requested, record.requestedProfile.id],
    ["Modeled eligible increment", view.modeled, record.modeledEligible.status === "known" ? "Subject to the stated synthetic assumptions and conditions." : record.modeledEligible.reason],
    ["Proposed revised workload", view.revised, record.revisedProfile?.id ?? "No revised profile is proposed."],
    ["Minimum viable increment", view.minimumViable, "Specific to this workload; not inherited from another fixture."],
    ["Operator-accepted increment", view.operatorAccepted, record.operatorAccepted.status !== "known" ? record.operatorAccepted.reason : ""],
    ["Observed delivered increment", view.delivered, record.observedDelivered.status !== "known" ? record.observedDelivered.reason : ""],
  ]
  return <div className="overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label="Assessment quantities; scroll horizontally if needed"><table className="w-full min-w-[35rem] border-collapse text-left text-sm" data-testid="assessment-capacity-table"><caption className="px-5 py-4 text-left leading-6 text-muted-foreground">All quantities share the {record.basis.meterBoundary.toLowerCase()}, {view.reference} reference, and {view.interval} window. Values are additional load, not total facility capability.</caption><thead className="bg-surface-2 text-foreground"><tr><th scope="col" className="p-4 font-medium">Quantity</th><th scope="col" className="p-4 font-medium">Value</th><th scope="col" className="p-4 font-medium">Meaning</th></tr></thead><tbody>{rows.map(([label, value, meaning]) => <tr key={label} className="border-t border-border"><th scope="row" className="p-4 font-medium text-foreground">{label}</th><td className="whitespace-nowrap p-4 text-foreground">{value}</td><td className="max-w-sm p-4 leading-6 break-words text-muted-foreground">{meaning}</td></tr>)}</tbody></table></div>
}
