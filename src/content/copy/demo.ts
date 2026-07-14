import type { SectionCopy } from "@/types/site"
import { illustrativeWaterfall } from "@/content/proof-artifacts"

export const demoHero: SectionCopy = {
  eyebrow: "Illustrative Proof Demo",
  headline: "Inspect how claimed headroom becomes proof-adjusted capacity",
  body: "Use a bounded Atlas-3 AI Campus scenario to walk from nominal headroom through constraints, candidate action checks, and an allow / repair / reject / no-proof trace.",
}

export const demoScenario = {
  siteName: "Atlas-3 AI Campus",
  disclaimer:
    "Synthetic illustrative scenario—not a customer or production result. It shows the artifact shape GridNinja would produce after a site-specific Capacity Audit.",
  contractedService: "120 MW",
  contractedServiceClaimId: "demo-contracted-service",
  candidateAction:
    "Shift 3.0 MW of training load for 45 minutes while preserving declared UPS reserve floor and thermal-water margin.",
  candidateActionClaimId: "demo-candidate-action",
  freshnessRequirement: "Fresh telemetry within 15 seconds at all key nodes",
  freshnessRequirementClaimId: "demo-freshness-window",
  waterfall: illustrativeWaterfall,
  modes: ["Operator", "Utility", "Investor", "DCII Review"] as const,
  traces: [
    {
      outcome: "ALLOW",
      check: "Candidate action inside dispatch envelope",
      reason: "Reserve floor, cooling margin, and workload policy remain inside declared limits.",
      margin: "+4.6 MW proof-adjusted capacity",
      claimId: "demo-allow-margin",
    },
    {
      outcome: "REPAIR",
      check: "Requested action exceeds thermal margin",
      reason: "Action can pass if load shift is reduced or ramped more slowly.",
      margin: "Repair to 2.1 MW for 30 minutes",
      claimId: "demo-repair-envelope",
    },
    {
      outcome: "REJECT",
      check: "UPS/BESS reserve floor crossed",
      reason: "Flexibility would spend resilience margin below the site minimum.",
      margin: "No safe repair under current policy",
      claimId: undefined,
    },
    {
      outcome: "NO-PROOF",
      check: "Telemetry confidence insufficient",
      reason: "Evidence is stale or topology coverage is incomplete at one or more key nodes.",
      margin: "Remediate evidence gap before approval",
      claimId: undefined,
    },
  ],
}

export const demoFinalCta: SectionCopy = {
  eyebrow: "Next step",
  headline: "Turn the illustrative inspection flow into a site-specific Capacity Audit",
  body: "GridNinja starts with Shadow Mode evidence, proof objects, and operator review before any bounded autonomy is considered.",
}
