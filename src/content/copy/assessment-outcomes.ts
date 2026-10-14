import type { AssessmentRecord } from "@/types/assessment"

/** Plain-language wrapper copy; it never changes the immutable publication. */
export const assessmentOutcomeExplanations = {
  ALLOW: "The request fits the modeled conditions. Business approval and operating permission remain separate.",
  REPAIR: "A smaller profile needs service and commercial review. The model does not approve the commitment.",
  REJECT: "The stated minimum cannot be met under this fixture's conditions. No acceptable revision is recorded.",
  "NO-PROOF": "The evidence is insufficient to assess the request. The modeled increment remains unknown.",
} satisfies Record<AssessmentRecord["screeningOutcome"], string>
