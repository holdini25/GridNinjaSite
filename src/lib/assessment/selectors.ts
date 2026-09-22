import { ASSESSMENT_PERSPECTIVES, ASSESSMENT_PUBLICATION_VERSION, ASSESSMENT_SCENARIOS, DEFAULT_ASSESSMENT_SCENARIO } from "@/content/assessments/constants"
import { formatAssessmentInterval, formatAssessmentQuantity, formatKWAsMW } from "@/lib/assessment/format"
import type { AssessmentPerspective, AssessmentRecord, AssessmentScenario, AssessmentSelection } from "@/types/assessment"

export function assessmentLinks(record: AssessmentRecord) {
  const base = `/downloads/assessment/${record.publication.id}/v${record.publication.version}`
  return { brief: `/evidence/assessments/${record.publication.id}/v${record.publication.version}`, pdf: `${base}/pdf`, json: `${base}/json`, html: `${base}/html`, demo: `/demo?scenario=${record.scenario}&version=${record.publication.version}&perspective=business` }
}

export function selectAssessment(record: AssessmentRecord) {
  return {
    title: record.title, conclusion: record.conclusion, screeningOutcome: record.screeningOutcome,
    requested: formatKWAsMW(record.requestedProfile.incrementKW),
    revised: record.revisedProfile ? formatKWAsMW(record.revisedProfile.incrementKW) : "No proposed revision",
    nominal: formatAssessmentQuantity(record.nominal), modeled: formatAssessmentQuantity(record.modeledEligible),
    minimumViable: record.minimumViableIncrementKW === null ? "Not specified" : formatKWAsMW(record.minimumViableIncrementKW),
    operatorAccepted: formatAssessmentQuantity(record.operatorAccepted), delivered: formatAssessmentQuantity(record.observedDelivered),
    reference: formatKWAsMW(record.basis.referenceLoadKW), interval: formatAssessmentInterval(record.basis.startUTC, record.basis.endUTC), links: assessmentLinks(record),
  }
}

export function selectAttribution(record: AssessmentRecord) {
  if (record.modeledEligible.status !== "known" || record.nominal.status !== "known" || !record.attribution.length) return []
  let endpointKW = record.nominal.valueKW
  return record.attribution.map((item) => { const startKW = endpointKW; endpointKW -= item.reductionKW; return { ...item, startKW, endKW: endpointKW } })
}

type SearchInput = URLSearchParams | Record<string, string | string[] | undefined>

export function resolveAssessmentSelection(search: SearchInput): AssessmentSelection {
  const read = (key: string): string[] => {
    if (search instanceof URLSearchParams) return search.getAll(key)
    const value = search[key]
    return value === undefined ? [] : Array.isArray(value) ? value : [value]
  }
  const scenarioInput = read("scenario"), versionInput = read("version"), perspectiveInput = read("perspective")
  if ([scenarioInput, versionInput, perspectiveInput].some((values) => values.length > 1)) return { status: "unavailable", reason: "This link contains conflicting selection values. Choose the default example to continue." }
  const scenario = scenarioInput[0] ?? DEFAULT_ASSESSMENT_SCENARIO
  const perspective = perspectiveInput[0] ?? "business"
  const version = versionInput[0] ?? ASSESSMENT_PUBLICATION_VERSION
  if (!isAssessmentScenario(scenario) || !isAssessmentPerspective(perspective) || version !== ASSESSMENT_PUBLICATION_VERSION) return { status: "unavailable", reason: "The requested example, perspective, or publication version is unavailable. No other result has been substituted." }
  return { status: "ready", scenario, version, perspective }
}

function isAssessmentScenario(value: string): value is AssessmentScenario {
  return ASSESSMENT_SCENARIOS.some((scenario) => scenario === value)
}

function isAssessmentPerspective(value: string): value is AssessmentPerspective {
  return ASSESSMENT_PERSPECTIVES.some((perspective) => perspective === value)
}

export function assessmentSelectionHref(selection: Extract<AssessmentSelection, { status: "ready" }>) {
  return `/demo?${new URLSearchParams({ scenario: selection.scenario, version: selection.version, perspective: selection.perspective }).toString()}#decision-brief`
}
