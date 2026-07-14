import { describe, expect, it } from "vitest"

import {
  operatorQuestions,
  validateQueryRegistry,
} from "@/seo/query-registry"
import { publicClaims } from "@/seo/claim-registry"
import { seoRoutes } from "@/seo/route-manifest"
import { expectUnique, expectValidatorToPass } from "../../support/seo-contracts"

describe("operator-question portfolio", () => {
  it("passes its fail-closed validator", () => {
    expectValidatorToPass(validateQueryRegistry, "query registry")
  })

  it("holds a controlled 40–60 question observation set", () => {
    expect(operatorQuestions.length).toBeGreaterThanOrEqual(40)
    expect(operatorQuestions.length).toBeLessThanOrEqual(60)

    const records = operatorQuestions as readonly Record<string, unknown>[]
    const questions = records.map((record) => String(record.question))
    expectUnique(questions, "operator questions")
    expect(questions.every((question) => question.trim().endsWith("?"))).toBe(true)
  })

  it("maps every observation to a known route and explicit market context", () => {
    const paths = new Set(seoRoutes.map((route) => route.path))
    const claimIds = new Set(publicClaims.map((claim) => claim.id))

    for (const record of operatorQuestions as readonly Record<string, unknown>[]) {
      const expectedRoute = String(
        record.expectedRoute ?? record.expectedPath ?? record.path ?? ""
      )
      expect(paths.has(expectedRoute as never), String(record.question)).toBe(true)
      expect(Number(record.weight), String(record.question)).toBeGreaterThan(0)
      expect(String(record.intent ?? "").trim().length).toBeGreaterThan(0)
      expect(String(record.country ?? "").trim().length).toBeGreaterThan(0)
      expect(String(record.locale ?? "").trim().length).toBeGreaterThan(0)
      expect(String(record.device ?? "").trim().length).toBeGreaterThan(0)
      expect(
        "expectedClaim" in record ||
          "expectedClaimId" in record ||
          "expectedClaimIds" in record,
        `${String(record.question)} must declare its expected claim mapping`
      ).toBe(true)
      if (record.expectedClaimId !== null) {
        expect(
          claimIds.has(String(record.expectedClaimId)),
          `${String(record.question)} references an unknown expected claim`
        ).toBe(true)
      }
    }

    expect(
      operatorQuestions.some((record) => record.expectedClaimId !== null),
      "claim-bearing observations must map to at least one governed public claim"
    ).toBe(true)
  })
})
