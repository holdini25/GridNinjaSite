import type { RtaDecisionState } from "@/content/proof-artifacts"

export const gnEase = {
  out: [0.16, 1, 0.3, 1] as const,
  lock: [0.2, 0.8, 0.2, 1] as const,
  stop: [0.7, 0, 0.84, 0] as const,
}

export const gnDuration = {
  micro: 0.16,
  chip: 0.24,
  panel: 0.34,
  section: 0.62,
  trace: 1.15,
}

export const gnSpring = {
  soft: { type: "spring", stiffness: 180, damping: 24, mass: 0.7 },
  precise: { type: "spring", stiffness: 260, damping: 30, mass: 0.55 },
  heavy: { type: "spring", stiffness: 120, damping: 22, mass: 0.9 },
} as const

export const decisionTone: Record<
  RtaDecisionState,
  {
    label: string
    textClass: string
    borderClass: string
    bgClass: string
    lineClass: string
  }
> = {
  allow: {
    label: "ALLOW",
    textClass: "text-signal",
    borderClass: "border-signal/50",
    bgClass: "bg-signal/10",
    lineClass: "bg-signal",
  },
  repair: {
    label: "REPAIR",
    textClass: "text-warning",
    borderClass: "border-warning/55",
    bgClass: "bg-warning/10",
    lineClass: "bg-warning",
  },
  reject: {
    label: "REJECT",
    textClass: "text-danger",
    borderClass: "border-danger/55",
    bgClass: "bg-danger",
    lineClass: "bg-danger",
  },
  "no-proof": {
    label: "NO-PROOF",
    textClass: "text-muted-foreground",
    borderClass: "border-muted-foreground/45 border-dashed",
    bgClass: "bg-muted-foreground/10",
    lineClass: "bg-muted-foreground",
  },
}

export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: gnDuration.section,
      ease: gnEase.out,
    },
  },
}

export const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.075,
      delayChildren: 0.05,
    },
  },
}

export function formatMw(value: number) {
  return `${value.toFixed(1)} MW`
}
