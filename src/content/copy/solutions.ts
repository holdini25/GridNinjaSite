import type { SolutionPageConfig } from "@/types/site"

export const solutionPages: Record<"ai-cloud" | "colocation", SolutionPageConfig> =
  {
    "ai-cloud": {
      slug: "ai-cloud",
      path: "/solutions/ai-cloud",
      hero: {
        eyebrow: "Solution / AI Cloud",
        headline: "For AI Clouds Racing Against the Grid",
        body: "Bring compute online faster, avoid power-driven throttling, and convert constrained infrastructure into billable capacity.",
      },
      whyThisMatters:
        "Every month of delay can strand high-value GPU inventory and postpone revenue. GridNinja helps operators separate nominal headroom from proof-adjusted virtual capacity before they promise more load.",
      buyerAnxiety:
        "Does the site really have enough electrical, reserve, cooling, workload, and telemetry confidence to support the next AI capacity step?",
      artifact: "AI Data Center Load Passport",
      caveat:
        "Outputs are site-specific and depend on telemetry freshness, topology completeness, policy declaration, and workload portability.",
      stakeholderProof: [
        "Capacity Waterfall from nominal headroom to safe usable MW",
        "Dispatch envelope for candidate workload shifts",
        "No-proof gaps that block credible time-to-power claims",
      ],
      painPoints: [
        "Interconnection delays",
        "GPU monetization pressure",
        "Thermal hotspots in dense clusters",
        "Limited contracted headroom",
        "Need for bridge power coordination",
      ],
      outcomes: [
        "Accelerate time-to-power",
        "Avoid broad throttling",
        "Preserve SLA-critical workloads",
        "Coordinate bridge power, batteries, and cooling",
      ],
      metrics: [
        {
          label: "Illustrative billable GPU-hours",
          value: "+14.8%",
          claimId: "ai-cloud-gpu-hours",
          body: "Sample output from reducing broad derates during constrained intervals.",
        },
        {
          label: "Illustrative earlier revenue",
          value: "$18.2M",
          claimId: "ai-cloud-earlier-revenue",
          body: "Sample annualized value from earlier bridge-power operation.",
        },
        {
          label: "Illustrative avoided exposure",
          value: "$4.1M",
          claimId: "ai-cloud-avoided-exposure",
          body: "Sample exposure evaluated through bounded coordination and runtime assurance.",
        },
      ],
      ctaLabel: "Book an AI Capacity Audit",
      ctaSource: "ai-cloud-page",
    },
    colocation: {
      slug: "colocation",
      path: "/solutions/colocation",
      hero: {
        eyebrow: "Solution / Colocation & REITs",
        headline: "For Operators Selling Capacity in Constrained Markets",
        body: "Increase sellable kW, oversubscribe more safely, and protect uptime with proof-backed control.",
      },
      whyThisMatters:
        "In power-constrained markets, every recoverable megawatt needs evidence before it becomes sellable. GridNinja helps operators convert constrained infrastructure into safe, usable, auditable capacity without relying on static assumptions.",
      buyerAnxiety:
        "Can the business sell more capacity without creating an unsupported oversubscription or SLA risk?",
      artifact: "Accepted-Headroom Ledger",
      caveat:
        "Sellable-capacity outputs remain bounded by declared site policy, tenant commitments, reserve posture, and evidence quality.",
      stakeholderProof: [
        "Accepted-headroom ledger for reviewable capacity states",
        "Reserve-floor report before dynamic oversubscription",
        "Operator-readable reject and no-proof reasons",
      ],
      painPoints: [
        "Stranded buffer capacity",
        "Pressure to monetize scarce power",
        "Risk of oversubscription incidents",
        "Tenant SLA sensitivity",
        "Investor and regulatory scrutiny",
      ],
      outcomes: [
        "Unlock stranded capacity",
        "Support dynamic oversubscription with guardrails",
        "Protect tenant SLAs",
        "Produce auditable evidence for internal and external stakeholders",
      ],
      metrics: [
        {
          label: "Illustrative recovered capacity",
          value: "+9.4 MW",
          claimId: "colocation-recovered-capacity",
          body: "Sample dynamic headroom separated from static buffers and fixed reserve posture.",
        },
        {
          label: "Illustrative uptime posture",
          value: "99.99%",
          claimId: "colocation-uptime-posture",
          body: "Sample target posture with actions bounded by feeder, reserve, and thermal margins.",
        },
        {
          label: "Illustrative capacity value",
          value: "$5.2M",
          claimId: "colocation-capacity-value",
          body: "Sample kW-month recovery across a constrained market footprint.",
        },
      ],
      ctaLabel: "Request Capacity Audit",
      ctaSource: "colocation-page",
    },
  }
