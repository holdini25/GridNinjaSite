import { assessmentScopeHref } from "@/lib/marketing-journeys"

export type NavDestination = { label: string; href: string; description: string }
export type NavItem = { label: string; href: string; children?: readonly NavDestination[] }

export const headerCapacityAuditHref = assessmentScopeHref("header")

export const navItems = [
  {
    label: "How it works", href: "/assessment",
    children: [
      { label: "Capacity assessment", href: "/assessment", description: "The paid scope, inputs, deliverables, and review process." },
      { label: "Platform direction", href: "/platform", description: "The intended control-plane architecture and its development boundaries." },
      { label: "Dispatch Envelope", href: "/platform/dispatch-envelope", description: "Inspect a separate synthetic timed-dispatch example." },
    ],
  },
  {
    label: "Solutions", href: "/solutions/ai-cloud",
    children: [
      { label: "AI Cloud Providers", href: "/solutions/ai-cloud", description: "Review the next workload increment before a service commitment." },
      { label: "Colocation & REITs", href: "/solutions/colocation", description: "Review a proposed tenant increment before commercial commitment." },
      { label: "Bridge Power & DER", href: "/solutions/bridge-power", description: "Scope the investigation of on-site power and operating constraints." },
    ],
  },
  { label: "Sample brief", href: "/demo#decision-brief" },
  {
    label: "Evidence", href: "/evidence",
    children: [
      { label: "Evidence library", href: "/evidence", description: "Published synthetic examples and their supporting records." },
      { label: "Proof before autonomy", href: "/proof", description: "How evidence, commercial usefulness, and authority stay distinct." },
      { label: "Methodology", href: "/methodology", description: "Assessment methods, claim boundaries, and corrections." },
      { label: "Insights", href: "/insights", description: "Operator-focused explanations of capacity and runtime assurance." },
    ],
  },
  {
    label: "Company", href: "/about",
    children: [
      { label: "About GridNinja", href: "/about", description: "The work today, development direction, and delivery responsibilities." },
      { label: "Why GridNinja", href: "/why-gridninja", description: "A bounded decision alongside your existing operational systems." },
      { label: "Contact", href: "/contact", description: "Start an assessment or partnership conversation." },
    ],
  },
] as const satisfies readonly NavItem[]

export const footerGroups = [
  { title: "Start here", links: [
    { label: "Capacity assessment", href: "/assessment" },
    { label: "Sample decision brief", href: "/demo#decision-brief" },
    { label: "Platform direction", href: "/platform" },
  ] },
  { title: "Solutions", links: [
    { label: "AI Cloud", href: "/solutions/ai-cloud" },
    { label: "Colocation & REITs", href: "/solutions/colocation" },
    { label: "Bridge Power & DER", href: "/solutions/bridge-power" },
  ] },
  { title: "Evidence", links: [
    { label: "Evidence library", href: "/evidence" },
    { label: "Review the proof pack", href: "/proof/proof-pack" },
    { label: "Methodology", href: "/methodology" },
    { label: "Insights", href: "/insights" },
  ] },
  { title: "Company", links: [
    { label: "About", href: "/about" },
    { label: "Why GridNinja", href: "/why-gridninja" },
    { label: "Contact", href: "/contact" },
    { label: "Data handling", href: "/data-handling" },
  ] },
] as const
