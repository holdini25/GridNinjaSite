import type { SectionCopy } from "@/types/site"

export const bridgePowerHero: SectionCopy = {
  eyebrow: "Bridge Power & DER",
  headline: "Make bridge power provably useful",
  body: "Coordinate behind-the-meter generation, batteries, cooling, and workload posture so the site can energize faster inside a visible dispatch envelope and reserve-floor proof.",
}

export const bridgePowerProblem = {
  title: "Bridge power solves supply. GridNinja solves the operating problem.",
  body: "Mode transitions, reserve posture, telemetry confidence, and thermal coupling decide whether bridge power becomes safe sellable MW or an unsupported temporary workaround.",
  bullets: [
    "Mode changes create the highest operational risk.",
    "Reserve posture has to move with thermal demand and workload posture.",
    "Workloads, cooling, and DER assets need one runtime-assured control loop.",
    "Reserve-safe dispatch must be proven before bridge assets are treated as capacity.",
  ],
}

export const bridgePowerModes = [
  {
    title: "Energize earlier",
    body: "Use bridge assets to bring the site online before the interconnect catches up.",
  },
  {
    title: "Hold reserve posture",
    body: "Keep enough margin to absorb load swings, cooling changes, and unexpected failures.",
  },
  {
    title: "Coordinate mode transitions",
    body: "Gate generator, battery, cooling, and workload actions through one bounded decision path.",
  },
  {
    title: "Prove dispatch readiness",
    body: "Produce Shadow Mode evidence, reserve-floor reports, replay logs, and operator-readable dispatch envelopes.",
  },
]

export const bridgePowerOutcomes = [
  {
    title: "Faster energization",
    body: "Bring capacity online ahead of grid timelines without giving up runtime assurance.",
  },
  {
    title: "Safer reserve utilization",
    body: "Use only the margin that survives the reserve-floor proof, not a static buffer frozen at commissioning.",
  },
  {
    title: "Cleaner multi-asset coordination",
    body: "Make generation, batteries, cooling, and workload changes move together inside one control loop.",
  },
]

export const bridgePowerTopology = [
  {
    title: "Utility feed",
    body: "Incoming capacity and delivery constraints.",
  },
  {
    title: "Bridge assets",
    body: "Generators, batteries, and reserve posture.",
  },
  {
    title: "Cooling",
    body: "Thermal response and dispatch headroom.",
  },
  {
    title: "Workload",
    body: "Compute posture that can flex safely.",
  },
  {
    title: "Proof system",
    body: "Action logs, replay, and audit-ready envelopes.",
  },
]

export const bridgePowerFinalCta: SectionCopy = {
  eyebrow: "Next Step",
  headline: "See how bridge power behaves inside a runtime-assured proof loop",
  body: "Start with a Capacity Audit or partnership conversation to map assets, reserve floors, dispatch envelopes, and the evidence path for your site.",
}
