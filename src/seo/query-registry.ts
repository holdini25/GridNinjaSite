import { publicClaims } from "@/seo/claim-registry"
import { seoRoutes, type PublicPath } from "@/seo/route-manifest"

export type OperatorQuestion = {
  id: string
  question: string
  cluster: "category" | "operator" | "proof-safety" | "comparison" | "brand"
  intent: "learn" | "evaluate" | "compare" | "buy"
  weight: 1 | 2 | 3
  expectedRoute: PublicPath
  expectedClaimId: string | null
  country: "US"
  locale: "en-US"
  device: "mobile" | "desktop"
}

const seeds = [
  ["what-virtual-capacity-control-plane", "What is an AI Data Center Virtual Capacity Control Plane?", "category", "learn", 3, "/"],
  ["virtual-capacity-definition", "What is virtual capacity in an AI data center?", "category", "learn", 3, "/insights/virtual-capacity-control-plane"],
  ["proof-adjusted-capacity", "What is proof-adjusted data center capacity?", "category", "learn", 3, "/insights/proof-adjusted-data-center-capacity"],
  ["capacity-acceptance-layer", "What is a capacity-acceptance layer?", "category", "learn", 2, "/why-gridninja"],
  ["inside-fence-orchestration", "What is inside-the-fence orchestration?", "category", "learn", 2, "/platform"],
  ["runtime-assurance-definition", "What is runtime assurance for AI data centers?", "category", "learn", 3, "/insights/runtime-assurance-ai-data-centers"],
  ["dispatch-envelope-definition", "What is a data center dispatch envelope?", "category", "learn", 3, "/platform/dispatch-envelope"],
  ["load-passport-definition", "What is an AI data center Load Passport?", "category", "learn", 2, "/evidence/load-passport-specification"],
  ["headroom-ledger-definition", "What is an accepted-headroom ledger?", "category", "learn", 2, "/evidence/accepted-headroom-ledger"],
  ["safe-sellable-mw", "How is safe sellable MW calculated?", "operator", "evaluate", 3, "/solutions/colocation"],
  ["accelerate-time-to-power", "How can AI data centers accelerate time-to-power safely?", "operator", "evaluate", 3, "/solutions/ai-cloud"],
  ["bridge-power-ai", "How should bridge power support AI data centers?", "operator", "evaluate", 3, "/solutions/bridge-power"],
  ["coordinate-cooling-workloads", "How can cooling and AI workloads be coordinated for capacity?", "operator", "evaluate", 2, "/platform"],
  ["safe-oversubscription", "How can colocation operators oversubscribe capacity safely?", "operator", "evaluate", 3, "/solutions/colocation"],
  ["gpu-capacity-grid-delay", "How can GPU capacity come online before grid upgrades?", "operator", "evaluate", 3, "/solutions/ai-cloud"],
  ["binding-constraint", "How do operators identify the binding capacity constraint?", "operator", "learn", 2, "/insights/cross-domain-capacity-constraints"],
  ["water-aware-capacity", "How do water limits affect AI data center capacity?", "operator", "learn", 2, "/insights/cross-domain-capacity-constraints"],
  ["reserve-floor", "How do UPS and BESS reserve floors constrain flexible load?", "operator", "learn", 2, "/platform/dispatch-envelope"],
  ["sla-protection", "How can virtual capacity protect data center SLAs?", "operator", "evaluate", 3, "/platform"],
  ["capacity-audit-inputs", "What inputs are required for a Capacity Audit?", "operator", "buy", 3, "/methodology/capacity-audit"],
  ["capacity-audit-output", "What does an AI data center Capacity Audit deliver?", "operator", "buy", 3, "/roi"],
  ["shadow-mode", "What is Shadow Mode for data center control?", "proof-safety", "learn", 3, "/insights/data-center-shadow-mode"],
  ["proof-before-autonomy", "What does proof before autonomy mean?", "proof-safety", "learn", 3, "/proof"],
  ["bounded-autonomy", "What is bounded autonomy in critical infrastructure?", "proof-safety", "learn", 2, "/proof"],
  ["allow-repair-reject", "How do allow repair reject decisions work?", "proof-safety", "learn", 3, "/platform/dispatch-envelope"],
  ["no-proof-state", "When should a capacity request return no proof?", "proof-safety", "learn", 2, "/evidence/virtual-capacity-proof-test"],
  ["stale-telemetry", "How should stale telemetry affect a capacity claim?", "proof-safety", "learn", 2, "/evidence/virtual-capacity-proof-test"],
  ["topology-mismatch", "How should topology mismatch block data center control?", "proof-safety", "learn", 2, "/evidence/virtual-capacity-proof-test"],
  ["proof-pack", "What is inside a virtual capacity proof pack?", "proof-safety", "evaluate", 3, "/proof/proof-pack"],
  ["replay-audit", "How does replay support capacity audits?", "proof-safety", "learn", 2, "/proof"],
  ["rollback-control", "How is rollback proven for a data center capacity action?", "proof-safety", "learn", 2, "/evidence/sample-rta-trace"],
  ["claim-maturity", "How should data center capacity claims be labeled by maturity?", "proof-safety", "learn", 2, "/methodology/claims-and-evidence"],
  ["dcim-comparison", "How is GridNinja different from DCIM?", "comparison", "compare", 3, "/why-gridninja"],
  ["digital-twin-comparison", "How is capacity acceptance different from a digital twin?", "comparison", "compare", 3, "/why-gridninja"],
  ["aiops-comparison", "How is GridNinja different from data center AIOps?", "comparison", "compare", 2, "/why-gridninja"],
  ["demand-response-comparison", "Is GridNinja a demand response aggregator?", "comparison", "compare", 2, "/why-gridninja"],
  ["ems-comparison", "Is GridNinja energy management software?", "comparison", "compare", 2, "/why-gridninja"],
  ["grid-flexibility-safety", "How can data centers provide grid flexibility safely?", "comparison", "evaluate", 3, "/insights/safe-data-center-grid-flexibility"],
  ["vendor-agnostic", "Does GridNinja replace existing data center systems?", "comparison", "compare", 2, "/platform"],
  ["comparison-sources", "How does GridNinja substantiate competitor comparisons?", "comparison", "learn", 2, "/methodology/comparison-policy"],
  ["gridninja-definition", "What is GridNinja?", "brand", "learn", 3, "/"],
  ["gridninja-platform", "How does the GridNinja platform work?", "brand", "evaluate", 3, "/platform"],
  ["gridninja-proof-demo", "Can I see a GridNinja virtual capacity proof demo?", "brand", "buy", 2, "/demo"],
  ["gridninja-capacity-audit", "How do I request a GridNinja Capacity Audit?", "brand", "buy", 3, "/contact"],
  ["gridninja-evidence", "What public evidence does GridNinja provide?", "brand", "evaluate", 3, "/evidence"],
  ["gridninja-methods", "How does GridNinja govern public claims?", "brand", "learn", 2, "/methodology"],
  ["gridninja-dcii", "What is the GridNinja DCII project?", "brand", "learn", 1, "/dcii"],
  ["gridninja-partnership", "How can bridge power and DER partners work with GridNinja?", "brand", "buy", 2, "/contact"],
] as const

const expectedClaimByQuestionId: Readonly<Record<string, string>> = {
  "safe-sellable-mw": "colocation-recovered-capacity",
  "accelerate-time-to-power": "home-illustrative-time-to-power",
  "gpu-capacity-grid-delay": "ai-cloud-earlier-revenue",
  "sla-protection": "home-sla-exposure",
  "gridninja-capacity-audit": "home-safe-headroom",
}

export const operatorQuestions: readonly OperatorQuestion[] = seeds.map(
  ([id, question, cluster, intent, weight, expectedRoute], index) => ({
    id,
    question,
    cluster,
    intent,
    weight,
    expectedRoute,
    expectedClaimId: expectedClaimByQuestionId[id] ?? null,
    country: "US",
    locale: "en-US",
    device: index % 2 === 0 ? "mobile" : "desktop",
  }) as OperatorQuestion
)

export function validateQueryRegistry(): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const paths = new Set<string>(seoRoutes.map((route) => route.path))
  const claimIds = new Set<string>(publicClaims.map((claim) => claim.id))
  if (operatorQuestions.length < 40 || operatorQuestions.length > 60) {
    errors.push(`Question portfolio must contain 40-60 records; found ${operatorQuestions.length}`)
  }
  for (const entry of operatorQuestions) {
    if (ids.has(entry.id)) errors.push(`Duplicate question id: ${entry.id}`)
    ids.add(entry.id)
    if (!entry.question.endsWith("?")) errors.push(`Question must end with ?: ${entry.id}`)
    if (!paths.has(entry.expectedRoute)) errors.push(`Unknown expected route: ${entry.id}`)
    if (entry.expectedClaimId && !claimIds.has(entry.expectedClaimId)) {
      errors.push(`Unknown expected claim: ${entry.id}`)
    }
  }
  if (!operatorQuestions.some((entry) => entry.expectedClaimId)) {
    errors.push("Question portfolio must map claim-bearing observations to public claims")
  }
  return errors
}
