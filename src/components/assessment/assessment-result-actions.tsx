import { assessmentLinks } from "@/lib/assessment/selectors"
import { assessmentScopeHref } from "@/lib/marketing-journeys"
import type { PublicTopic } from "@/lib/public-topic"
import type { AssessmentPerspective, AssessmentRecord } from "@/types/assessment"

export type AssessmentResultActionsProps = {
  record: AssessmentRecord
  perspective: AssessmentPerspective
  topic?: PublicTopic
}

/** Native actions work before enhancement. The existing delegated observer owns telemetry. */
export function AssessmentResultActions({ record, perspective, topic }: AssessmentResultActionsProps) {
  const links = assessmentLinks(record)
  const attribution = {
    "data-analytics-source": "assessment-explorer",
    "data-analytics-scenario": record.scenario,
    "data-analytics-perspective": perspective,
    "data-analytics-artifact": record.publication.id,
    "data-analytics-version": record.publication.version,
  }
  const linkClass = "inline-flex min-h-11 items-center text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  return <div data-assessment-result-actions role="group" aria-label="Current example actions" className="mt-4 space-y-3">
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium">
      <a href={links.brief} {...attribution} data-analytics-event="evidence_artifact_view" className={linkClass}>Read the versioned brief</a>
      <a href={links.pdf} {...attribution} data-analytics-event="sample_download_clicked" className={linkClass}>Download this PDF</a>
      <a href={links.json} {...attribution} data-analytics-event="sample_download_clicked" className={linkClass}>Download this technical record</a>
    </div>
    <a href={assessmentScopeHref("assessment-explorer", topic)} data-analytics-event="assessment_cta_selected" data-analytics-source="assessment-explorer" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Contact Us</a>
  </div>
}
