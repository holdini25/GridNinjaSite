export type NavDestination = {
  label: string
  href: string
  description: string
}

export type NavItem = {
  label: string
  href: string
  children?: readonly NavDestination[]
}

export const headerCapacityAuditHref =
  "/assessment" as const

export const navItems = [
  {
    label: "Platform",
    href: "/platform",
    children: [
      {
        label: "Platform Overview",
        href: "/platform",
        description:
          "Understand the intended control-plane architecture and current assessment offer.",
      },
      {
        label: "Dispatch Envelope",
        href: "/platform/dispatch-envelope",
        description: "Inspect a separate synthetic timed-dispatch example.",
      },
    ],
  },
  {
    label: "Solutions",
    href: "/solutions/ai-cloud",
    children: [
      {
        label: "AI Cloud Providers",
        href: "/solutions/ai-cloud",
        description:
          "Review the next workload increment before a service commitment.",
      },
      {
        label: "Colocation & REITs",
        href: "/solutions/colocation",
        description:
          "Review a proposed tenant increment before commercial commitment.",
      },
      {
        label: "Bridge Power & DER",
        href: "/solutions/bridge-power",
        description:
          "Scope the investigation of on-site power and operating constraints.",
      },
    ],
  },
  {
    label: "Proof",
    href: "/proof",
    children: [
      {
        label: "Proof Before Autonomy",
        href: "/proof",
        description:
          "See how Shadow Mode and staged authority establish evidence before control.",
      },
      {
        label: "Proof Pack",
        href: "/proof/proof-pack",
        description:
          "Inspect constraints, decisions, provenance, replay, and rollback evidence.",
      },
      {
        label: "Sample decision brief",
        href: "/demo",
        description:
          "Compare synthetic profiles, model results, and the unresolved business question.",
      },
    ],
  },
  {
    label: "Resources",
    href: "/insights",
    children: [
      {
        label: "Insights",
        href: "/insights",
        description:
          "Read operator-focused explainers on virtual capacity and runtime assurance.",
      },
      {
        label: "Evidence Library",
        href: "/evidence",
        description:
          "Review synthetic traces, ledgers, specifications, and proof artifacts.",
      },
      {
        label: "Methodology",
        href: "/methodology",
        description:
          "Understand how GridNinja governs claims, comparisons, and capacity methods.",
      },
      {
        label: "Capacity assessment",
        href: "/assessment",
        description:
          "Scope one historical-data decision, its inputs, deliverables, and review.",
      },
      {
        label: "DCII Project",
        href: "/dcii",
        description:
          "Explore the proof-backed AI capacity project for operators and partners.",
      },
    ],
  },
  {
    label: "Why GridNinja",
    href: "/why-gridninja",
  },
] as const satisfies readonly NavItem[]

export const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "Platform", href: "/platform" },
      { label: "Dispatch Envelope", href: "/platform/dispatch-envelope" },
      { label: "Why GridNinja", href: "/why-gridninja" },
      { label: "Proof Before Autonomy", href: "/proof" },
      { label: "Proof Pack", href: "/proof/proof-pack" },
      { label: "Proof Demo", href: "/demo" },
      { label: "Insights", href: "/insights" },
      { label: "Evidence", href: "/evidence" },
      { label: "Methodology", href: "/methodology" },
      { label: "DCII Project", href: "/dcii" },
      { label: "Capacity assessment", href: "/assessment" },
      { label: "Data handling", href: "/data-handling" },
      { label: "About", href: "/about" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "AI Cloud", href: "/solutions/ai-cloud" },
      { label: "Colocation & REITs", href: "/solutions/colocation" },
      { label: "Bridge Power & DER", href: "/solutions/bridge-power" },
      { label: "DCII Project", href: "/dcii" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "Scope an assessment", href: "/assessment#scope" },
      { label: "See Shadow Mode", href: "/proof" },
      { label: "Sample decision brief", href: "/demo#decision-brief" },
      { label: "Request DCII Memo", href: "/contact?intent=dcii-memo&source=footer" },
      { label: "Download Proof Pack", href: "/proof/proof-pack" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const
