import { describe, expect, it } from "vitest"
import { qualificationEndpoint, summarizeOpportunityCohort, type AssessmentOpportunity } from "@/lib/measurement/opportunity-cohorts"

const base: AssessmentOpportunity = {
  id: "fictional-1", qualifiedAt: "2026-01-01T00:00:00Z", source: "website-sourced",
  qualification: { namedDecision: true, boundedScope: true, decisionOwner: true, agreedNextStep: true },
  agreementExecutedAt: null, paidScopeConfirmed: false, outcomeKnownThrough: "2026-05-01T00:00:00Z",
}
const report = { month: "2026-01", asOf: "2026-05-01T00:00:00Z" }

describe("fixed-age assessment opportunity cohorts", () => {
  it("includes the exact individual endpoint but excludes a later agreement", () => {
    const endpoint = qualificationEndpoint(base.qualifiedAt)
    const result = summarizeOpportunityCohort([
      { ...base, agreementExecutedAt: endpoint, paidScopeConfirmed: true },
      { ...base, id: "fictional-2", agreementExecutedAt: "2026-04-01T00:00:01Z", paidScopeConfirmed: true },
    ], report)
    expect(result).toMatchObject({ converted: 1, notConverted: 1, lateConversions: 1, fixedAgeRate: 0.5 })
  })
  it("waits for every member's own endpoint, not the first member's anniversary", () => {
    expect(summarizeOpportunityCohort([{ ...base, outcomeKnownThrough: "2026-04-02T00:00:00Z" }, { ...base, id: "second", qualifiedAt: "2026-01-31T00:00:00Z", outcomeKnownThrough: "2026-04-02T00:00:00Z" }],
      { ...report, asOf: "2026-04-02T00:00:00Z" })).toMatchObject({ pending: 1, fixedAgeRate: null })
  })
  it("keeps unknown outcomes in the denominator and suppresses the point rate", () => {
    expect(summarizeOpportunityCohort([{ ...base, outcomeKnownThrough: null }], report))
      .toMatchObject({ denominator: 1, unknownFollowUp: 1, notConverted: 0, fixedAgeRate: null })
    expect(summarizeOpportunityCohort([], report)).toMatchObject({ denominator: 0, fixedAgeRate: null, followUpCoverage: null })
  })
  it("uses explicit merges and preserves assisted/unknown attribution", () => {
    const records = [base, { ...base, id: "second", mergedInto: base.id }, { ...base, id: "third", source: "website-assisted" as const }]
    expect(summarizeOpportunityCohort(records, report).denominator).toBe(2)
    expect(summarizeOpportunityCohort(records, { ...report, source: "website-sourced" }).denominator).toBe(1)
    expect(() => summarizeOpportunityCohort([base, { ...base, id: "earlier", qualifiedAt: "2025-12-31T00:00:00Z", mergedInto: base.id }], report)).toThrow("earliest")
  })
  it("rejects fabricated qualification, cyclic merges and pre-existing contracts", () => {
    expect(() => summarizeOpportunityCohort([{ ...base, qualification: { ...base.qualification, namedDecision: false } }], report)).toThrow("four")
    expect(() => summarizeOpportunityCohort([{ ...base, mergedInto: base.id }], report)).toThrow("merge")
    expect(() => summarizeOpportunityCohort([{ ...base, agreementExecutedAt: "2025-12-31T00:00:00Z" }], report)).toThrow("predates")
  })
  it("uses UTC qualification month and exactly 90 elapsed days across leap days", () => {
    expect(qualificationEndpoint("2024-01-01T00:00:00Z")).toBe("2024-03-31T00:00:00.000Z")
    expect(summarizeOpportunityCohort([{ ...base, qualifiedAt: "2026-02-01T00:30:00+01:00" }], report).denominator).toBe(1)
  })
  it("does not estimate a rate before maturity even for an observed early conversion", () => {
    const result = summarizeOpportunityCohort([{ ...base, agreementExecutedAt: "2026-01-02T00:00:00Z", paidScopeConfirmed: true, outcomeKnownThrough: "2026-01-03T00:00:00Z" }], { ...report, asOf: "2026-01-03T00:00:00Z" })
    expect(result).toMatchObject({ denominator: 1, pending: 1, converted: 0, fixedAgeRate: null })
  })
  it("preserves unknown and assisted source categories without treating them as website sourced", () => {
    const records = [base, { ...base, id: "assisted", source: "website-assisted" as const }, { ...base, id: "unknown", source: "unknown" as const }]
    for (const source of ["website-sourced", "website-assisted", "unknown"] as const) {
      expect(summarizeOpportunityCohort(records, { ...report, source })).toMatchObject({ denominator: 1, source })
    }
    expect(() => summarizeOpportunityCohort(records, { ...report, source: "inferred-website" as never })).toThrow("attribution")
  })
  it("does not count voided or unpaid agreements as a contracted paid assessment", () => {
    const records = [
      { ...base, agreementExecutedAt: "2026-01-03T00:00:00Z", paidScopeConfirmed: true, agreementVoided: true },
      { ...base, id: "unpaid", agreementExecutedAt: "2026-01-03T00:00:00Z" },
    ]
    expect(summarizeOpportunityCohort(records, report)).toMatchObject({ converted: 0, notConverted: 2, fixedAgeRate: 0 })
  })
  it("requires explicit reconciliation before a merge can hide an agreement or coverage", () => {
    const alias = { ...base, id: "alias", mergedInto: base.id, agreementExecutedAt: "2026-01-05T00:00:00Z", paidScopeConfirmed: true }
    expect(() => summarizeOpportunityCohort([base, alias], report)).toThrow("reconcile the earliest paid agreement")
    const reconciled = { ...base, agreementExecutedAt: alias.agreementExecutedAt, paidScopeConfirmed: true }
    expect(summarizeOpportunityCohort([reconciled, alias], report)).toMatchObject({ denominator: 1, converted: 1, fixedAgeRate: 1 })
    expect(() => summarizeOpportunityCohort([{ ...base, outcomeKnownThrough: null }, { ...base, id: "coverage", mergedInto: base.id }], report)).toThrow("follow-up coverage")
  })
  it("follows merge chains and rejects missing destinations and longer cycles", () => {
    const middle = { ...base, id: "middle", mergedInto: base.id }
    const alias = { ...base, id: "alias", mergedInto: middle.id }
    expect(summarizeOpportunityCohort([base, middle, alias], report).denominator).toBe(1)
    expect(() => summarizeOpportunityCohort([{ ...base, mergedInto: "absent" }], report)).toThrow("merge")
    expect(() => summarizeOpportunityCohort([{ ...base, mergedInto: middle.id }, middle], report)).toThrow("merge")
  })
  it.each(["2026-02-30T00:00:00Z", "2026-01-01T00:00:00", "2026-13-01T00:00:00Z"])("rejects invalid or zoneless dates %s", qualifiedAt => {
    expect(() => qualificationEndpoint(qualifiedAt)).toThrow("valid calendar date")
  })
  it("rejects wrong qualification keys, truthy values and unreviewed agreement flags", () => {
    expect(() => summarizeOpportunityCohort([{ ...base, qualification: { one: true, two: true, three: true, four: true } as never }], report)).toThrow("four")
    expect(() => summarizeOpportunityCohort([{ ...base, qualification: { ...base.qualification, namedDecision: "yes" as never } }], report)).toThrow("four")
    expect(() => summarizeOpportunityCohort([{ ...base, paidScopeConfirmed: "yes" as never }], report)).toThrow("explicit booleans")
  })
  it("validates follow-up timestamps even when an early conversion would otherwise short-circuit", () => {
    const record = { ...base, agreementExecutedAt: "2026-01-05T00:00:00Z", paidScopeConfirmed: true, outcomeKnownThrough: "2026-06-01T00:00:00Z" }
    expect(() => summarizeOpportunityCohort([record], report)).toThrow("Follow-up cannot occur after")
    expect(() => summarizeOpportunityCohort([{ ...base, outcomeKnownThrough: "2025-12-01T00:00:00Z" }], report)).toThrow("predate qualification")
    expect(() => summarizeOpportunityCohort([{ ...base, agreementExecutedAt: "2026-06-01T00:00:00Z" }], report)).toThrow("Agreement cannot occur after")
  })

})
