import type { ComparisonRow, SectionCopy } from "@/types/site"

export const homeHero: SectionCopy & {
  primaryCtaLabel: string
  secondaryCtaLabel: string
} = {
  eyebrow: "AI Data Center Virtual Capacity Control Plane",
  headline: "Claimed headroom is not proven capacity",
  body: "GridNinja is a runtime-assured virtual capacity engine that proves which AI data center power, cooling, storage, and workload flexibility is safe before control, dispatch, or grid commitments are trusted.",
  primaryCtaLabel: "Request Capacity Audit",
  secondaryCtaLabel: "Inspect Proof Demo",
}

export const powerWallSection: SectionCopy & { bullets: string[] } = {
  eyebrow: "The Problem",
  headline: "The Power Wall is now the gating factor for AI growth",
  body: "AI data centers are colliding with a new operational reality: compute demand moves at software speed, while grid upgrades, interconnection approvals, cooling buildout, and physical capacity expansion move at infrastructure speed. The result is claimed headroom that cannot be sold until it is proven.",
  bullets: [
    "Interconnection delays can stretch for years while AI demand expects deployment now.",
    "Static safety buffers leave capacity stranded when operators need safe sellable MW.",
    "High-density AI racks turn thermal constraints into revenue constraints.",
    "Behind-the-meter power is growing, but it still needs proof-backed dispatch envelopes.",
  ],
}

export const comparisonSection: SectionCopy = {
  eyebrow: "Why Existing Tools Stop Short",
  headline: "Visibility and simulation do not make MW operator-accepted",
  body: "Most products in this space stop at dashboards, subsystem tuning, or grid-facing program participation. GridNinja is the inside-the-fence proof and runtime assurance layer that turns possible MW into safe, usable, auditable capacity.",
}

export const comparisonRows: ComparisonRow[] = [
  {
    name: "Monitoring / DCIM",
    bullets: [
      "Reads the environment",
      "Identifies stranded capacity",
      "Alerts operators",
      "Does not prove which headroom is actually usable",
    ],
  },
  {
    name: "Cooling Optimization",
    bullets: [
      "Improves thermal efficiency",
      "Tunes one subsystem well",
      "Does not connect thermal margin to accepted virtual capacity",
    ],
  },
  {
    name: "DR / VPP Orchestration",
    bullets: [
      "Connects sites to grid and market programs",
      "Monetizes flexibility",
      "Does not establish the site evidence needed before flexibility is trusted",
    ],
  },
  {
    name: "GridNinja",
    emphasis: true,
    bullets: [
      "Coordinates workloads, cooling, on-site power, and reserve",
      "Gates every action through runtime assurance",
      "Produces Load Passports, capacity waterfalls, and proof packs before autonomy",
      "Converts constrained infrastructure into safe, sellable capacity",
    ],
  },
]

export const engineSection: SectionCopy = {
  eyebrow: "What GridNinja Is",
  headline: "A runtime-assured virtual capacity engine",
  body: "GridNinja coordinates workloads, cooling, and on-site power assets to unlock virtual capacity inside strict safety and SLA envelopes. It starts in Shadow Mode, shows why a candidate action is allowed, repaired, rejected, or no-proofed, and keeps authority bounded until evidence accumulates.",
}

export const enginePillars = [
  {
    title: "Unlock Capacity",
    body: "Turn stranded power, cooling, and reserve margins into proof-adjusted safe, usable infrastructure.",
  },
  {
    title: "Protect Uptime",
    body: "Gate every action through runtime assurance with visible margins, reason codes, and fallback behavior.",
  },
  {
    title: "Prove Execution",
    body: "Generate Load Passports, capacity waterfalls, accepted-headroom ledgers, and procurement-ready proof packs.",
  },
]

export const controlLoopSection: SectionCopy & {
  steps: Array<{ title: string; body: string }>
} = {
  eyebrow: "How It Works",
  headline: "From telemetry to proof, inside one bounded loop",
  body: "GridNinja keeps the path from site signal to operator evidence explicit.",
  steps: [
    {
      title: "Observe",
      body: "Ingest telemetry across power, cooling, workload behavior, reserves, and site constraints.",
    },
    {
      title: "Model",
      body: "Combine deterministic physics with structured residual learning to estimate feasible headroom, risk, and likely outcomes.",
    },
    {
      title: "Decide",
      body: "Construct candidate action bundles across workloads, cooling modes, and on-site assets, then test them against hard constraints.",
    },
    {
      title: "Assure",
      body: "Every action is evaluated through runtime assurance that can allow, repair, reject, or return no-proof based on margin, evidence, and policy.",
    },
    {
      title: "Prove",
      body: "Produce replay, Shadow Mode evidence, accepted-headroom ledgers, Load Passports, and operator-readable decision logs.",
    },
  ],
}

export const homeFinalCta = {
  headline: "Request a Capacity Audit before promising flexible MW",
  body: "Start with a Shadow Mode baseline. Quantify constraints, identify no-proof gaps, and generate evidence before autonomy or grid commitments are discussed.",
  label: "Request Capacity Audit",
}
