import { SYNTHETIC_SCENARIO_CAVEAT, type EvidenceMaturity } from "@/seo/evidence"
import type { IsoDate, PublicPath } from "@/seo/route-manifest"

export type PublicClaim = {
  id: string
  exactText: string
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
  status: "active" | "expired" | "retracted"
  snippetPolicy: "eligible" | "exclude-value"
}

const common = {
  maturity: "DESIGN TARGET" as const,
  environment: "synthetic" as const,
  evidenceUrl: "/proof/proof-pack" as const,
  sourceIds: ["gridninja-synthetic-scenario-v1"] as const,
  technicalOwner: "GridNinja technical review",
  caveat: SYNTHETIC_SCENARIO_CAVEAT,
  approvalDate: "2026-07-13" as const,
  reviewExpiry: "2027-07-13" as const,
  status: "active" as const,
  snippetPolicy: "exclude-value" as const,
}

export const publicClaims = [
  claim("home-illustrative-virtual-capacity", "+18 MW illustrative virtual capacity", "numeric", "Sample nominal planning upside before the dispatch envelope is applied.", ["/"]),
  claim("home-illustrative-time-to-power", "4.2 months illustrative time-to-power impact", "outcome", "Sample planning scenario with coordinated bridge power and bounded proof workflow.", ["/"]),
  claim("home-unsafe-actions-accepted", "0 unsafe actions accepted in the synthetic Shadow Mode path", "capability", "Synthetic target posture; this is not a production safety-rate claim.", ["/"]),
  claim("home-illustrative-evidence-coverage", "93% illustrative evidence coverage", "numeric", "Synthetic share of intervals with sufficient telemetry, topology, and policy confidence.", ["/"]),
  claim("home-safe-headroom", "11.6 MW illustrative safe headroom", "numeric", "Synthetic headroom before the feeder thermal envelope binds.", ["/"]),
  claim("home-binding-margin", "5.4% illustrative remaining thermal margin", "numeric", "Synthetic feeder binding state.", ["/"]),
  claim("home-replay-confidence", "94% illustrative replay confidence", "numeric", "Synthetic Shadow Mode replay bundle.", ["/"]),
  claim("home-flex-delivered", "7.3 MW illustrative coordinated flexibility", "numeric", "Synthetic coordination of cooling, reserve, and workload actions.", ["/"]),
  claim("home-actions-blocked", "14 illustrative actions blocked", "numeric", "Synthetic actions rejected before potential SLA or reserve impact.", ["/"]),
  claim("home-sla-exposure", "$2.4M illustrative SLA exposure avoided", "outcome", "Synthetic avoided-exposure scenario across constrained intervals.", ["/"]),
  claim("ai-cloud-gpu-hours", "+14.8% illustrative billable GPU-hours", "outcome", "Synthetic scenario reducing broad derates during constrained intervals.", ["/solutions/ai-cloud"]),
  claim("ai-cloud-earlier-revenue", "$18.2M illustrative earlier revenue", "outcome", "Synthetic annualized bridge-power planning scenario.", ["/solutions/ai-cloud"]),
  claim("ai-cloud-avoided-exposure", "$4.1M illustrative avoided exposure", "outcome", "Synthetic bounded-coordination planning scenario.", ["/solutions/ai-cloud"]),
  claim("colocation-recovered-capacity", "+9.4 MW illustrative recovered capacity", "outcome", "Synthetic separation of dynamic headroom from static buffers.", ["/solutions/colocation"]),
  claim("colocation-uptime-posture", "99.99% illustrative uptime posture", "outcome", "Synthetic target posture, not a measured customer SLA result.", ["/solutions/colocation"]),
  claim("colocation-capacity-value", "$5.2M illustrative capacity value", "outcome", "Synthetic kW-month planning scenario.", ["/solutions/colocation"]),
  claim("illustrative-capacity-waterfall", "Illustrative capacity-waterfall MW values", "numeric", "Synthetic nominal headroom, constraint deductions, and proof-adjusted capacity.", ["/", "/demo", "/roi", "/proof/proof-pack"]),
  claim("roi-proof-adjusted-mw", "5.8 MW illustrative proof-adjusted headroom", "numeric", "Synthetic Capacity Audit output after policy, constraint, and telemetry-trust discounts.", ["/roi"]),
  claim("roi-no-proof-gaps", "3 illustrative no-proof gaps", "numeric", "Synthetic evidence-gap register.", ["/roi"]),
  claim("roi-decision-states", "4 illustrative decision states", "capability", "Synthetic output covering allow, repair, reject, and no-proof.", ["/roi"]),
  claim("roi-proof-artifacts", "6 illustrative proof artifacts", "numeric", "Synthetic Capacity Audit artifact set.", ["/roi"]),
  claim("demo-contracted-service", "120 MW illustrative contracted service", "numeric", "Synthetic Atlas-3 campus scenario input.", ["/demo"]),
  claim("demo-candidate-action", "3.0 MW for 45 minutes illustrative candidate action", "numeric", "Synthetic workload-shift request.", ["/demo"]),
  claim("demo-freshness-window", "15-second illustrative telemetry freshness requirement", "numeric", "Synthetic evidence policy.", ["/demo"]),
  claim("demo-allow-margin", "+4.6 MW illustrative proof-adjusted capacity", "numeric", "Synthetic allow trace.", ["/demo"]),
  claim("demo-repair-envelope", "2.1 MW for 30 minutes illustrative repaired envelope", "numeric", "Synthetic repair trace.", ["/demo"]),
  claim("dispatch-requested-envelope", "4.0 MW illustrative requested envelope", "numeric", "Synthetic dispatch-envelope request.", ["/platform/dispatch-envelope"]),
  claim("dispatch-accepted-envelope", "2.8 MW illustrative accepted envelope", "numeric", "Synthetic runtime-assurance repair.", ["/platform/dispatch-envelope"]),
  claim("dispatch-binding-source", "UPS / BESS illustrative binding source", "capability", "Synthetic binding-constraint classification.", ["/platform/dispatch-envelope"]),
  claim("proof-pack-repair-log", "4% illustrative cluster-cap repair", "numeric", "Synthetic proof-log decision.", ["/proof/proof-pack"]),
  claim("proof-pack-margin-log", "+3.2% illustrative remaining margin", "numeric", "Synthetic proof-log margin.", ["/proof/proof-pack"]),
] as const satisfies readonly PublicClaim[]

function claim(
  id: string,
  exactText: string,
  claimType: PublicClaim["claimType"],
  scope: string,
  approvedSurfaces: readonly PublicPath[]
): PublicClaim {
  return { id, exactText, claimType, scope, approvedSurfaces, ...common }
}

const claimMap = new Map<string, PublicClaim>(publicClaims.map((claimRecord) => [claimRecord.id, claimRecord]))

export function getPublicClaim(id: string): PublicClaim {
  const claimRecord = claimMap.get(id)
  if (!claimRecord) throw new Error(`Unknown public claim: ${id}`)
  return claimRecord
}

export function validatePublicClaims(asOf = new Date()): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const today = asOf.toISOString().slice(0, 10)

  for (const claimRecord of publicClaims) {
    if (ids.has(claimRecord.id)) errors.push(`Duplicate claim id: ${claimRecord.id}`)
    ids.add(claimRecord.id)
    if (claimRecord.status !== "active") errors.push(`Non-active public claim: ${claimRecord.id}`)
    if (claimRecord.reviewExpiry < today) errors.push(`Expired public claim: ${claimRecord.id}`)
    if (claimRecord.approvedSurfaces.length === 0) errors.push(`Claim has no approved surface: ${claimRecord.id}`)
    if (claimRecord.environment === "synthetic" && claimRecord.caveat !== SYNTHETIC_SCENARIO_CAVEAT) {
      errors.push(`Synthetic claim lacks standard caveat: ${claimRecord.id}`)
    }
  }

  return errors
}

export function assertClaimApprovedForSurface(id: string, surface: PublicPath): PublicClaim {
  const claimRecord = getPublicClaim(id)
  if (claimRecord.status !== "active" || !claimRecord.approvedSurfaces.includes(surface)) {
    throw new Error(`Claim ${id} is not active and approved for ${surface}`)
  }
  return claimRecord
}
