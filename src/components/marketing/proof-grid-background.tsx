import { cn } from "@/lib/utils"

const defaultLabels = [
  "UPS_RESERVE_FLOOR",
  "THERMAL_MARGIN",
  "SLA_LOCK",
  "NO_PROOF",
]

export function ProofGridBackground({
  labels = defaultLabels,
  pulses = true,
  density = "hero",
  className,
}: {
  labels?: string[]
  pulses?: boolean
  density?: "hero" | "panel"
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("gn-proof-grid-bg", className)}
      data-density={density}
      data-labels={labels.join("   ")}
      data-pulses={pulses ? "true" : "false"}
    />
  )
}
