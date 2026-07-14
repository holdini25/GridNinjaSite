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
  "/contact?intent=capacity-audit&source=header" as const

export const navItems = [
  {
    label: "Platform",
    href: "/platform",
    children: [
      {
        label: "Platform Overview",
        href: "/platform",
        description:
          "See how GridNinja converts constrained infrastructure into proof-adjusted virtual capacity.",
      },
      {
        label: "Dispatch Envelope",
        href: "/platform/dispatch-envelope",
        description: "Define the safe operating boundary before execution.",
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
          "Accelerate time-to-power while protecting infrastructure and workload SLAs.",
      },
      {
        label: "Colocation & REITs",
        href: "/solutions/colocation",
        description:
          "Turn constrained infrastructure into proof-backed sellable capacity.",
      },
      {
        label: "Bridge Power & DER",
        href: "/solutions/bridge-power",
        description:
          "Coordinate on-site power, cooling, storage, and workloads inside strict envelopes.",
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
        label: "Interactive Proof Demo",
        href: "/demo",
        description:
          "Walk through an illustrative allow, repair, reject, and no-proof decision.",
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
        label: "Capacity Audit & ROI",
        href: "/roi",
        description:
          "Quantify proof-adjusted capacity, evidence gaps, and commercial value.",
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
      { label: "ROI / Capacity Audit", href: "/roi" },
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
      { label: "Request Capacity Audit", href: "/contact?intent=capacity-audit&source=footer" },
      { label: "See Shadow Mode", href: "/proof" },
      { label: "Book Demo", href: "/contact?intent=book-demo&source=footer" },
      { label: "Request DCII Memo", href: "/contact?intent=dcii-memo&source=footer" },
      { label: "Download Proof Pack", href: "/proof/proof-pack" },
      { label: "Contact", href: "/contact" },
    ],
  },
] as const
