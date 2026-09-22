import { describe, expect, it } from "vitest"
import fc from "fast-check"
import { ASSESSMENT_SCENARIOS, assessmentFixtures } from "@/content/assessments/fixtures"
import { formatAssessmentQuantity, formatKWAsMW } from "@/lib/assessment/format"
import { parseAssessment, serializeAssessment } from "@/lib/assessment/invariants"
import { assessmentSelectionHref, resolveAssessmentSelection, selectAssessment, selectAttribution } from "@/lib/assessment/selectors"
import { assessmentQuantitySchema } from "@/schemas/assessment.schema"

describe("assessment evidence contract", () => {
  it("validates every authored fixture and round-trips exact technical records", () => {
    for (const scenario of ASSESSMENT_SCENARIOS) {
      const record = assessmentFixtures[scenario]
      expect(parseAssessment(record)).toEqual(record)
      expect(JSON.parse(serializeAssessment(record))).toEqual(record)
      expect(record.basis.referenceLoadKW).toBe(20_000)
      expect(record.operationalAuthority).toBe("none")
      expect(record.operatorAccepted.status).toBe("not-applicable")
      expect(record.observedDelivered.status).toBe("not-applicable")
      expect(record.economics.status).toBe("unestimated")
    }
  })

  it("keeps B's commercial question separate from C's minimum and preserves profile identities", () => {
    expect(assessmentFixtures.b.minimumViableIncrementKW).toBeNull()
    expect(assessmentFixtures.c.minimumViableIncrementKW).toBe(6_500)
    expect(assessmentFixtures.b.revisedProfile?.incrementKW).toBe(5_800)
    expect(assessmentFixtures.b.revisedProfile?.id).not.toBe(assessmentFixtures.b.requestedProfile.id)
    expect(assessmentFixtures.b.commercial.status).toBe("requires-review")
    expect(assessmentFixtures.b.investigationOptions.every((option) => option.status === "unassessed")).toBe(true)
    expect(assessmentFixtures.c.revisedProfile).toBeNull()
  })

  it("distinguishes zero, unknown, and not-applicable without invented numeric values", () => {
    expect(formatKWAsMW(0)).toBe("0.0 MW")
    expect(formatAssessmentQuantity(assessmentFixtures.d.modeledEligible)).toBe("Unknown")
    expect(formatAssessmentQuantity(assessmentFixtures.d.operatorAccepted)).toBe("Not applicable")
    expect(assessmentQuantitySchema.safeParse({ ...assessmentFixtures.d.modeledEligible, valueKW: 0 }).success).toBe(false)
    expect(assessmentQuantitySchema.safeParse({ ...assessmentFixtures.d.operatorAccepted, valueKW: 0 }).success).toBe(false)
    expect(assessmentQuantitySchema.safeParse({ status: "known", valueKW: 1.25, unit: "kW", basisId: "basis" }).success).toBe(false)
    expect(assessmentQuantitySchema.safeParse({ status: "known", valueKW: 5_800, unit: "MW", basisId: "basis" }).success).toBe(false)
  })

  it("rejects contradictory authority, scope, profiles, interval, and conclusions", () => {
    const b = assessmentFixtures.b
    const d = assessmentFixtures.d
    const cases = [
      { ...b, operatorAccepted: b.modeledEligible },
      { ...b, operationalAuthority: "execute" },
      { ...b, nominal: { ...b.nominal, basisId: "other-window" } },
      { ...b, requestedProfile: { ...b.requestedProfile, basisId: "other-meter" } },
      { ...b, revisedProfile: { ...b.revisedProfile, id: b.requestedProfile.id } },
      { ...b, revisedProfile: { ...b.revisedProfile, familyId: "other-workload" } },
      { ...b, basis: { ...b.basis, endUTC: b.basis.startUTC } },
      { ...b, screeningOutcome: "ALLOW" },
      { ...b, revisedProfile: null },
      { ...b, minimumViableIncrementKW: 6_500 },
      { ...b, publication: { ...b.publication, id: "demo-01-c" } },
      { ...assessmentFixtures.c, revisedProfile: b.revisedProfile },
      { ...assessmentFixtures.c, minimumViableIncrementKW: 5_000 },
      { ...assessmentFixtures.a, minimumViableIncrementKW: 5_500 },
      { ...d, modeledEligible: b.modeledEligible },
      { ...d, attribution: b.attribution },
      { ...d, evidence: b.evidence },
    ]
    for (const record of cases) expect(() => parseAssessment(record)).toThrow()
  })

  it("conserves attribution exactly and rejects arbitrary nonzero stale reductions", () => {
    const rows = selectAttribution(assessmentFixtures.b)
    expect(rows.map((row) => row.endKW)).toEqual([10_000, 8_500, 7_300, 5_800])
    expect(selectAttribution(assessmentFixtures.d)).toEqual([])
    fc.assert(fc.property(fc.integer({ min: 1, max: 100_000 }), (delta) => {
      const record = structuredClone(assessmentFixtures.b)
      record.attribution[0].reductionKW += delta
      expect(() => parseAssessment(record)).toThrow(/reconcile exactly/)
    }))
  })

  it("all 16 transitions derive quantities and links exclusively from the next record", () => {
    for (const from of ASSESSMENT_SCENARIOS) for (const to of ASSESSMENT_SCENARIOS) {
      selectAssessment(assessmentFixtures[from])
      const next = selectAssessment(assessmentFixtures[to])
      expect(next.screeningOutcome).toBe(assessmentFixtures[to].screeningOutcome)
      expect(next.links.json).toBe(`/downloads/assessment/demo-01-${to}/v1.0.0/json`)
      expect(next.modeled).toBe(to === "d" ? "Unknown" : "5.8 MW")
      expect(next.revised).toBe(to === "b" ? "5.8 MW" : "No proposed revision")
    }
  })
})

describe("assessment deep links", () => {
  it("defaults to B business and preserves valid exact selections", () => {
    expect(resolveAssessmentSelection({})).toEqual({ status: "ready", scenario: "b", version: "1.0.0", perspective: "business" })
    const selection = resolveAssessmentSelection({ scenario: "d", version: "1.0.0", perspective: "engineering" })
    expect(selection.status).toBe("ready")
    if (selection.status === "ready") expect(assessmentSelectionHref(selection)).toBe("/demo?scenario=d&version=1.0.0&perspective=engineering#decision-brief")
  })

  it.each(["scenario=x", "scenario=", "version=2.0.0", "perspective=operator", "scenario=a&scenario=b", "version=1.0.0&version=1.0.0"])("does not silently substitute unavailable selection %s", (search) => {
    expect(resolveAssessmentSelection(new URLSearchParams(search)).status).toBe("unavailable")
  })
})
