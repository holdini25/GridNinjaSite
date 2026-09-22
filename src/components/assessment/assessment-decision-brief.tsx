import { AssessmentSummary } from "@/components/assessment/assessment-summary"
import { AssessmentDetails } from "@/components/assessment/assessment-details"
import type { AssessmentRecord } from "@/types/assessment"

export function AssessmentDecisionBrief({ record }: { record: AssessmentRecord }) {
  return <article className="space-y-8"><AssessmentSummary record={record} showLinks={false} /><AssessmentDetails record={record} /><p className="break-words text-sm leading-6 text-muted-foreground">Publication {record.publication.id} · v{record.publication.version} · narrative {record.publication.narrativeVersion} · template {record.publication.templateVersion}. Synthetic example.</p></article>
}
