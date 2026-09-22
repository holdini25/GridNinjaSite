import { assessmentRecordSchema } from "@/schemas/assessment.schema"
import type { AssessmentRecord } from "@/types/assessment"

/** These invariants establish consistency of a synthetic record, not physical feasibility. */
export function parseAssessment(value: unknown): AssessmentRecord {
  return assessmentRecordSchema.parse(value)
}

export function assertAssessmentInvariants(value: unknown): asserts value is AssessmentRecord {
  assessmentRecordSchema.parse(value)
}

export function serializeAssessment(value: AssessmentRecord): string {
  return `${JSON.stringify(parseAssessment(value), null, 2)}\n`
}
