import type { z } from "zod"
import type { assessmentPerspectiveSchema, assessmentQuantitySchema, assessmentRecordSchema, assessmentScenarioSchema } from "@/schemas/assessment.schema"

export type AssessmentRecord = z.infer<typeof assessmentRecordSchema>
export type AssessmentQuantity = z.infer<typeof assessmentQuantitySchema>
export type AssessmentScenario = z.infer<typeof assessmentScenarioSchema>
export type AssessmentPerspective = z.infer<typeof assessmentPerspectiveSchema>

export type AssessmentSelection =
  | { status: "ready"; scenario: AssessmentScenario; version: string; perspective: AssessmentPerspective }
  | { status: "unavailable"; reason: string }
