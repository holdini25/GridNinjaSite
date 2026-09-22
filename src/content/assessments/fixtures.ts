import { parseAssessment } from "@/lib/assessment/invariants"
import { ASSESSMENT_PUBLICATION_VERSION } from "@/content/assessments/constants"
import type { AssessmentQuantity, AssessmentRecord, AssessmentScenario } from "@/types/assessment"

export { DEFAULT_ASSESSMENT_SCENARIO, ASSESSMENT_PUBLICATION_VERSION, ASSESSMENT_SCENARIOS } from "@/content/assessments/constants"

const basisId = "demo-01-meter-hour-20260922"
const known = (valueKW: number): AssessmentQuantity => ({ status: "known", valueKW, unit: "kW", basisId })
const notApplicable = (reason: string): AssessmentQuantity => ({ status: "not-applicable", reason, basisId })

const common = {
  schemaVersion: "assessment.v1",
  datasetId: "demo-01-synthetic-v1",
  modelVersion: "illustrative-assessment-1.0.0",
  provenance: "synthetic",
  operationalAuthority: "none",
  basis: { id: basisId, siteId: "DEMO-01", meterBoundary: "Fictional facility electrical meter", referenceLoadKW: 20_000, startUTC: "2026-09-22T00:00:00Z", endUTC: "2026-09-22T01:00:00Z", quantityBasis: "additional-to-reference" },
  nominal: known(12_000),
  modeledEligible: known(5_800),
  operatorAccepted: notApplicable("No operator has accepted this synthetic result."),
  observedDelivered: notApplicable("No workload was operated or measured for this example."),
  minimumViableIncrementKW: null,
  revisedProfile: null,
  economics: { status: "unestimated", reason: "No price, utilization, investment cost, or commercial service requirement has been assessed." },
  reportAcceptance: { status: "not-applicable", reason: "This is an authored example, not an accepted customer report." },
  assumptions: ["Every MW quantity is additional load above a steady 20.0 MW reference at the same fictional facility meter.", "The authored assessment window is one hour; the example does not model ramp, rebound, or workload transitions.", "For A–C, the example assumes the listed evidence is sufficient for the stated modeled screen."],
  limitations: ["All inputs and results are synthetic. They are not measured customer results or a guarantee of recoverable capacity.", "The model screen provides no permission to operate equipment or commit capacity.", "Site validation, authorized data, operational review, and commercial review would be required for a real decision."],
  evidence: [
    { id: "electrical", label: "Electrical boundary", status: "synthetic", detail: "Authored nominal headroom and reference load; no connection to a live facility." },
    { id: "cooling", label: "Cooling constraint", status: "synthetic", detail: "Authored cooling margin for the fixed window; no physical feasibility validation." },
    { id: "operating-reserve", label: "Operating reserve and service conditions", status: "synthetic", detail: "Authored assumptions, not agreed operating envelopes or SLAs." },
  ],
  attribution: [
    { id: "electrical-reserve", label: "Electrical reserve", reductionKW: 2_000 },
    { id: "cooling-margin", label: "Cooling margin", reductionKW: 1_500 },
    { id: "service-reserve", label: "Service reserve", reductionKW: 1_200 },
    { id: "evidence-margin", label: "Evidence margin", reductionKW: 1_500 },
  ],
  investigationOptions: [
    { id: "phase", label: "Phase the workload", status: "unassessed" },
    { id: "reschedule", label: "Assess another time window", status: "unassessed" },
    { id: "cooling-investment", label: "Investigate cooling investment", status: "unassessed" },
    { id: "bridge-power", label: "Investigate bridge power", status: "unassessed" },
  ],
} satisfies Partial<AssessmentRecord>

function fixture(scenario: AssessmentScenario, overrides: Partial<AssessmentRecord>): AssessmentRecord {
  return parseAssessment({ ...common, scenario, publication: { id: `demo-01-${scenario}`, version: ASSESSMENT_PUBLICATION_VERSION, narrativeVersion: "1.0.0", templateVersion: "1.0.0" }, requestedProfile: { id: `demo-01-${scenario}-requested`, familyId: `demo-01-${scenario}-workload`, basisId, label: "Requested workload", incrementKW: scenario === "a" || scenario === "d" ? 5_000 : 7_000 }, ...overrides })
}

export const assessmentFixtures: Record<AssessmentScenario, AssessmentRecord> = {
  a: fixture("a", {
    title: "Request fits the modeled conditions",
    screeningOutcome: "ALLOW",
    conclusion: "The proposed 5.0 MW increment fits within the fixture’s modeled 5.8 MW increment. The unchanged workload still requires operational and commercial review.",
    commercial: { status: "requires-review", question: "Do the workload’s service requirements and the site’s operating conditions support this commitment?" },
    reasons: [{ id: "request-fits", label: "Request within the modeled increment", detail: "5.0 MW is below 5.8 MW for this fictional meter and hour. This is a model screening result only." }],
  }),
  b: fixture("b", {
    title: "A smaller commitment needs review",
    screeningOutcome: "REPAIR",
    revisedProfile: { id: "demo-01-b-revised", familyId: "demo-01-b-workload", basisId, label: "Proposed reduced workload", incrementKW: 5_800 },
    conclusion: "The proposed 7.0 MW increment exceeds the fixture’s modeled 5.8 MW increment. A reduced workload profile requires review.",
    commercial: { status: "requires-review", question: "Would the reduced 5.8 MW profile still meet the service and commercial requirement?" },
    reasons: [{ id: "request-exceeds", label: "Request exceeds the modeled increment", detail: "The proposed revision is 1.2 MW below the request. No minimum commercially viable workload is specified for this fixture." }],
  }),
  c: fixture("c", {
    title: "No admissible revision under the stated minimum",
    screeningOutcome: "REJECT",
    minimumViableIncrementKW: 6_500,
    conclusion: "The 7.0 MW request cannot fit the modeled 5.8 MW increment, and the stated 6.5 MW minimum prevents an admissible revision in this fixture.",
    commercial: { status: "not-viable", question: "Which assumption or investment option should be investigated before this capacity commitment is reconsidered?" },
    reasons: [{ id: "minimum-exceeds", label: "Stated minimum exceeds the modeled increment", detail: "6.5 MW is required for the workload in this fixture. A 5.8 MW revision would not satisfy that minimum." }],
  }),
  d: fixture("d", {
    title: "Missing evidence prevents assessment",
    screeningOutcome: "NO-PROOF",
    modeledEligible: { status: "unknown", basisId, reason: "Decision-critical cooling evidence is missing for the assessment window." },
    conclusion: "Missing cooling evidence prevents assessment of the 5.0 MW request. The modeled eligible increment is unknown; no favorable conclusion or revision is available.",
    commercial: { status: "undetermined", question: "Can authorized cooling evidence be obtained for the same facility boundary and time window?" },
    reasons: [{ id: "cooling-evidence-missing", label: "Cooling evidence missing", detail: "Neither nominal headroom nor a previous scenario can replace the missing cooling evidence." }],
    evidence: common.evidence.map((item) => item.id === "cooling" ? { ...item, status: "missing", detail: "No cooling evidence is supplied for this fixture’s assessment window." } : item),
    attribution: [],
  }),
}
