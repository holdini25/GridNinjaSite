import type { StatItem } from "@/types/site"

export const proofStats: StatItem[] = [
  {
    label: "Illustrative Virtual Capacity",
    value: "+18 MW",
    claimId: "home-illustrative-virtual-capacity",
    body: "Sample nominal planning upside that must be reduced into proof-backed dispatch envelope.",
  },
  {
    label: "Illustrative Time-to-Power",
    value: "4.2 mo",
    claimId: "home-illustrative-time-to-power",
    body: "Potential planning impact from coordinated bridge power and bounded proof workflow.",
  },
  {
    label: "Unsafe Actions Accepted",
    value: "0",
    claimId: "home-unsafe-actions-accepted",
    body: "Target Shadow Mode posture: no unsafe accepted actions in the sample evidence path.",
  },
  {
    label: "Illustrative Evidence Coverage",
    value: "93%",
    claimId: "home-illustrative-evidence-coverage",
    body: "Sample share of intervals with enough telemetry, topology, and policy confidence to evaluate.",
  },
]

export const homeKpis: StatItem[] = [
  {
    label: "Safe MW Headroom",
    value: "11.6 MW",
    claimId: "home-safe-headroom",
    body: "Illustrative safe headroom before the feeder thermal envelope binds.",
  },
  {
    label: "Binding Constraint",
    value: "Feeder",
    claimId: "home-binding-margin",
    body: "Thermal envelope, 5.4% remaining margin.",
  },
  {
    label: "Confidence",
    value: "94%",
    claimId: "home-replay-confidence",
    body: "Shadow-mode replay confidence across the active bundle.",
  },
  {
    label: "Flex Delivered",
    value: "7.3 MW",
    claimId: "home-flex-delivered",
    body: "Illustrative coordinated cooling, reserve, and workload actions.",
  },
  {
    label: "Actions Blocked",
    value: "14",
    claimId: "home-actions-blocked",
    body: "Rejected before they could threaten SLA or reserve posture.",
  },
  {
    label: "SLA Penalty Avoided",
    value: "$2.4M",
    claimId: "home-sla-exposure",
    body: "Illustrative avoided exposure across constrained intervals.",
  },
]

export const eventLog = [
  "14:05 — Allow: battery discharge within reserve floor",
  "14:06 — Repair: reduce noncritical cluster cap by 4%",
  "14:06 — Reject: tower mode switch would violate thermal margin",
]

export const solutionTeasers = [
  {
    title: "AI Cloud Providers",
    body: "Bring GPU capacity online faster, avoid throttling, and protect billable compute.",
    href: "/solutions/ai-cloud",
  },
  {
    title: "Colocation & REITs",
    body: "Increase sellable kW, oversubscribe more safely, and defend uptime.",
    href: "/solutions/colocation",
  },
  {
    title: "Bridge Power & DER",
    body: "Make bridge power, batteries, and on-site generation usable inside a visible dispatch envelope.",
    href: "/solutions/bridge-power",
  },
]
