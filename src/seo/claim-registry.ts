import { SYNTHETIC_SCENARIO_CAVEAT, type EvidenceMaturity } from "@/seo/evidence"
import type { IsoDate, PublicPath } from "@/seo/route-manifest"

export type PublicClaim = {
  id: string
  exactText: string
  displayValue: string
  claimType: "numeric" | "comparative" | "capability" | "outcome"
  maturity: EvidenceMaturity
  scope: string
  environment: "synthetic" | "lab" | "replay" | "shadow" | "pilot" | "production"
  measurementWindow?: string
  sampleSize?: string
  baselineOrCounterfactual?: string
  evidenceUrl: PublicPath
  artifactHash?: string
  sourceIds: readonly string[]
  technicalOwner: string
  caveat: string
  approvedSurfaces: readonly PublicPath[]
  approvalDate: IsoDate
  reviewExpiry: IsoDate
  status: "active" | "expired" | "retracted" | "withheld"
  publicationPermission: "synthetic-public-example" | "authorized-publication" | "not-approved"
  snippetPolicy: "eligible" | "exclude-value"
}

const common = {
  maturity: "Specified" as const,
  environment: "synthetic" as const,
  technicalOwner: "GridNinja website fixture maintainers; site validation not established",
  caveat: SYNTHETIC_SCENARIO_CAVEAT,
  approvalDate: "2026-09-22" as const,
  reviewExpiry: "2027-09-22" as const,
  status: "active" as const,
  publicationPermission: "synthetic-public-example" as const,
  snippetPolicy: "exclude-value" as const,
}

// The user-approved synthetic specification permits these examples only. It is
// not evidence for customer, safety, economic, or live-control claims.
export const publicClaims: readonly PublicClaim[] = [
  {
    ...common, id: "assessment-b-model-limit", exactText: "5.8 MW modeled increment in synthetic fixture B", displayValue: "5.8 MW", claimType: "numeric",
    scope: "DEMO-01 facility-meter boundary; additional load above a 20.0 MW reference; fixture B only.",
    measurementWindow: "2026-09-22T00:00:00Z–2026-09-22T01:00:00Z (authored synthetic hour)",
    evidenceUrl: "/demo", sourceIds: ["demo-01-b", "assessment-fixtures-v1.0.0"], approvedSurfaces: ["/", "/demo", "/assessment"],
  },
  {
    ...common, id: "dispatch-requested-envelope", exactText: "4.0 MW illustrative requested envelope", displayValue: "4.0 MW", claimType: "numeric",
    scope: "Separate synthetic timed-dispatch teaching example; not DEMO-01.", evidenceUrl: "/platform/dispatch-envelope",
    sourceIds: ["dispatch-envelope-grid-stress-v1"], approvedSurfaces: ["/platform/dispatch-envelope"],
  },
  {
    ...common, id: "dispatch-accepted-envelope", exactText: "2.8 MW illustrative model-screened envelope", displayValue: "2.8 MW", claimType: "numeric",
    scope: "Synthetic timed-dispatch repair; no operational acceptance or equipment authority.", evidenceUrl: "/platform/dispatch-envelope",
    sourceIds: ["dispatch-envelope-grid-stress-v1"], approvedSurfaces: ["/platform/dispatch-envelope"],
  },
  {
    ...common, id: "dispatch-binding-source", exactText: "UPS / BESS illustrative binding source", displayValue: "UPS / BESS", claimType: "capability",
    scope: "Synthetic timed-dispatch binding-constraint classification.", evidenceUrl: "/platform/dispatch-envelope",
    sourceIds: ["dispatch-envelope-grid-stress-v1"], approvedSurfaces: ["/platform/dispatch-envelope"],
  },
]

const claimMap = new Map(publicClaims.map(claim => [claim.id, claim]))
export function getPublicClaim(id: string): PublicClaim {
  const claim = claimMap.get(id)
  if (!claim) throw new Error(`Unknown or withdrawn public claim: ${id}`)
  return claim
}

export function validatePublicClaim(claim: PublicClaim, asOf = new Date()): string[] {
  const errors: string[] = []
  const today = asOf.toISOString().slice(0, 10)
  if (claim.status !== "active") errors.push(`Non-active public claim: ${claim.id}`)
  if (claim.reviewExpiry < today) errors.push(`Expired public claim: ${claim.id}`)
  if (claim.approvalDate > today) errors.push(`Unapproved future claim: ${claim.id}`)
  if (!claim.exactText.trim() || !claim.displayValue.trim() || !claim.scope.trim() || !claim.technicalOwner.trim() || !claim.sourceIds.length) errors.push(`Incomplete public claim: ${claim.id}`)
  if (!claim.approvedSurfaces.length) errors.push(`Claim has no approved surface: ${claim.id}`)
  if (claim.publicationPermission === "not-approved") errors.push(`Claim has no publication permission: ${claim.id}`)
  if (claim.environment === "synthetic" && claim.caveat !== SYNTHETIC_SCENARIO_CAVEAT) errors.push(`Synthetic claim lacks standard caveat: ${claim.id}`)
  if (claim.environment === "synthetic" && claim.maturity !== "Specified" && claim.maturity !== "Implemented and tested in a stated environment") errors.push(`Synthetic claim cannot imply site or customer acceptance: ${claim.id}`)
  return errors
}
export function validatePublicClaims(asOf = new Date()): string[] {
  const ids = new Set<string>()
  return publicClaims.flatMap(claim => {
    const duplicate = ids.has(claim.id) ? [`Duplicate claim id: ${claim.id}`] : []
    ids.add(claim.id)
    return [...duplicate, ...validatePublicClaim(claim, asOf)]
  })
}
export function assertClaimApprovedForSurface(id: string, surface: PublicPath, asOf = new Date()): PublicClaim {
  const claim = getPublicClaim(id)
  if (validatePublicClaim(claim, asOf).length || !claim.approvedSurfaces.includes(surface)) throw new Error(`Claim ${id} is not active and approved for ${surface}`)
  return claim
}
