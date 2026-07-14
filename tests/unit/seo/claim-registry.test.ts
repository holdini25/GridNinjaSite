import { describe, expect, it } from "vitest"

import {
  getPublicClaim,
  publicClaims,
  validatePublicClaims,
} from "@/seo/claim-registry"
import { seoRoutes } from "@/seo/route-manifest"
import { expectUnique, expectValidatorToPass } from "../../support/seo-contracts"

const syntheticDisclosure =
  "Synthetic illustrative scenario—not a customer or production result."

describe("public claim registry", () => {
  it("passes its fail-closed validator", () => {
    expectValidatorToPass(validatePublicClaims, "claim registry")
  })

  it("keeps claims attributable, scoped, reviewable, and surface-bound", () => {
    expect(publicClaims.length).toBeGreaterThan(0)
    expectUnique(
      publicClaims.map((claim) => claim.id),
      "claim IDs"
    )
    const publicPaths = new Set(seoRoutes.map((route) => route.path))

    for (const claim of publicClaims) {
      expect(getPublicClaim(claim.id)).toEqual(claim)
      expect(claim.status, claim.id).toBe("active")
      expect(new Date(`${claim.reviewExpiry}T23:59:59Z`).getTime(), claim.id).toBeGreaterThan(
        Date.now()
      )
      expect(claim.sourceIds.length, claim.id).toBeGreaterThan(0)
      expect(claim.technicalOwner.trim().length, claim.id).toBeGreaterThan(0)
      expect(claim.caveat.trim().length, claim.id).toBeGreaterThan(0)
      expect(claim.approvedSurfaces.length, claim.id).toBeGreaterThan(0)
      expect(publicPaths.has(claim.evidenceUrl), claim.id).toBe(true)

      for (const surface of claim.approvedSurfaces) {
        expect(publicPaths.has(surface), `${claim.id} -> ${surface}`).toBe(true)
      }

      if (claim.environment === "synthetic") {
        expect(claim.caveat, claim.id).toContain(syntheticDisclosure)
      }

      expect(["eligible", "exclude-value"], claim.id).toContain(
        claim.snippetPolicy
      )
    }
  })
})
