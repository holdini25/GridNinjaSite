import { z } from "@/lib/browser-zod"
import { ASSESSMENT_PERSPECTIVES, ASSESSMENT_SCENARIOS } from "@/content/assessments/constants"

export const assessmentScenarioSchema = z.enum(ASSESSMENT_SCENARIOS)
export const assessmentPerspectiveSchema = z.enum(ASSESSMENT_PERSPECTIVES)
const identifier = z.string().regex(/^[a-z0-9][a-z0-9-]*$/)
const nonempty = z.string().min(1)
const kw = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const assessmentQuantitySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("known"), valueKW: kw, unit: z.literal("kW"), basisId: identifier }).strict(),
  z.object({ status: z.literal("unknown"), reason: nonempty, basisId: identifier }).strict(),
  z.object({ status: z.literal("not-applicable"), reason: nonempty, basisId: identifier }).strict(),
])

const profileSchema = z.object({
  id: identifier,
  familyId: identifier,
  basisId: identifier,
  label: nonempty,
  incrementKW: kw,
}).strict()

export const assessmentRecordSchema = z.object({
  schemaVersion: z.literal("assessment.v1"),
  scenario: assessmentScenarioSchema,
  title: nonempty,
  datasetId: identifier,
  modelVersion: nonempty,
  publication: z.object({
    id: identifier,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    narrativeVersion: nonempty,
    templateVersion: nonempty,
  }).strict(),
  provenance: z.literal("synthetic"),
  operationalAuthority: z.literal("none"),
  basis: z.object({
    id: identifier,
    siteId: nonempty,
    meterBoundary: nonempty,
    referenceLoadKW: kw,
    startUTC: z.iso.datetime(),
    endUTC: z.iso.datetime(),
    quantityBasis: z.literal("additional-to-reference"),
  }).strict(),
  nominal: assessmentQuantitySchema,
  modeledEligible: assessmentQuantitySchema,
  operatorAccepted: assessmentQuantitySchema,
  observedDelivered: assessmentQuantitySchema,
  requestedProfile: profileSchema,
  revisedProfile: profileSchema.nullable(),
  minimumViableIncrementKW: kw.nullable(),
  screeningOutcome: z.enum(["ALLOW", "REPAIR", "REJECT", "NO-PROOF"]),
  conclusion: nonempty,
  commercial: z.object({
    status: z.enum(["requires-review", "not-viable", "undetermined"]),
    question: nonempty,
  }).strict(),
  economics: z.object({ status: z.literal("unestimated"), reason: nonempty }).strict(),
  reportAcceptance: z.object({ status: z.literal("not-applicable"), reason: nonempty }).strict(),
  reasons: z.array(z.object({ id: identifier, label: nonempty, detail: nonempty }).strict()).min(1),
  assumptions: z.array(nonempty).min(1),
  limitations: z.array(nonempty).min(1),
  evidence: z.array(z.object({ id: identifier, label: nonempty, status: z.enum(["synthetic", "missing"]), detail: nonempty }).strict()).min(1),
  attribution: z.array(z.object({ id: identifier, label: nonempty, reductionKW: kw }).strict()),
  investigationOptions: z.array(z.object({ id: identifier, label: nonempty, status: z.literal("unassessed") }).strict()),
}).strict().superRefine((record, ctx) => {
  const fail = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path })
  if (Date.parse(record.basis.endUTC) <= Date.parse(record.basis.startUTC)) fail("Assessment interval must have a positive duration", ["basis", "endUTC"])
  for (const name of ["nominal", "modeledEligible", "operatorAccepted", "observedDelivered"] as const) {
    if (record[name].basisId !== record.basis.id) fail("Quantity scope and interval must match the assessment basis", [name, "basisId"])
  }
  if (record.nominal.status !== "known") fail("The synthetic nominal increment must be known", ["nominal"])
  for (const name of ["operatorAccepted", "observedDelivered"] as const) {
    if (record[name].status !== "not-applicable") fail("Synthetic assessment cannot claim operational acceptance or delivery", [name])
  }
  for (const profile of [record.requestedProfile, record.revisedProfile].filter((item) => item !== null)) {
    if (profile.basisId !== record.basis.id) fail("Profile scope and interval must match the assessment basis")
  }
  if (record.publication.id !== `demo-01-${record.scenario}`) fail("Publication identity must match its scenario", ["publication", "id"])
  if (record.minimumViableIncrementKW !== null && record.requestedProfile.incrementKW < record.minimumViableIncrementKW) fail("Requested profile must meet its own stated minimum", ["requestedProfile", "incrementKW"])
  const modeled = record.modeledEligible.status === "known" ? record.modeledEligible.valueKW : null
  if (record.nominal.status === "known" && modeled !== null && modeled > record.nominal.valueKW) fail("Modeled increment cannot exceed nominal increment")
  if (record.revisedProfile) {
    if (record.revisedProfile.id === record.requestedProfile.id) fail("Requested and revised profiles require distinct identities")
    if (record.revisedProfile.familyId !== record.requestedProfile.familyId) fail("Revised profile must retain the request profile family")
  }
  if (record.screeningOutcome === "NO-PROOF") {
    if (record.modeledEligible.status !== "unknown" || record.revisedProfile || record.attribution.length) fail("NO-PROOF requires unknown modeled capacity, no revision, and no attribution endpoint")
    if (!record.evidence.some((item) => item.status === "missing")) fail("NO-PROOF requires missing decision evidence")
    if (record.commercial.status !== "undetermined") fail("NO-PROOF cannot establish commercial usefulness")
  } else {
    if (modeled === null) fail("A screening conclusion requires a known modeled increment")
    if (record.evidence.some((item) => item.status === "missing")) fail("Missing decision evidence must prevent a favorable screening conclusion")
    if (record.screeningOutcome === "ALLOW" && (modeled === null || record.requestedProfile.incrementKW > modeled || record.revisedProfile)) fail("ALLOW requires the unchanged request to fit the modeled increment")
    if (record.screeningOutcome === "REPAIR" && (modeled === null || !record.revisedProfile || record.requestedProfile.incrementKW <= modeled || record.revisedProfile.incrementKW > modeled || record.revisedProfile.incrementKW >= record.requestedProfile.incrementKW)) fail("REPAIR requires a distinct reduced profile within the modeled increment")
    if (record.screeningOutcome === "REJECT" && (modeled === null || record.revisedProfile || record.minimumViableIncrementKW === null || record.minimumViableIncrementKW <= modeled || record.minimumViableIncrementKW > record.requestedProfile.incrementKW)) fail("REJECT requires an unmet stated minimum and no admissible revision")
    if (record.screeningOutcome === "REJECT" && record.commercial.status !== "not-viable") fail("REJECT must preserve the unmet minimum in its commercial conclusion")
    if (record.screeningOutcome !== "REJECT" && record.commercial.status !== "requires-review") fail("Model screening does not establish commercial acceptance")
    if (record.revisedProfile && record.minimumViableIncrementKW !== null && record.revisedProfile.incrementKW < record.minimumViableIncrementKW) fail("A proposed revision cannot fall below a stated minimum")
    if (record.attribution.length && record.nominal.status === "known" && record.nominal.valueKW - record.attribution.reduce((sum, item) => sum + item.reductionKW, 0) !== modeled) fail("Sequential attribution must reconcile exactly to the modeled increment")
  }
  for (const [name, items] of Object.entries({ reasons: record.reasons, evidence: record.evidence, attribution: record.attribution, investigationOptions: record.investigationOptions })) {
    if (new Set(items.map((item) => item.id)).size !== items.length) fail("Identifiers must be unique within a collection", [name])
  }
})
