"use client"

import { rtaDecisionMeta, type RtaDecisionState } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

import { ProofTooltip } from "@/components/marketing/proof-tooltip"

const stateClasses: Record<RtaDecisionState, string> = {
  allow: "gn-status-allow",
  repair: "gn-status-repair",
  reject: "gn-status-reject",
  "no-proof": "gn-status-no-proof",
}

export function RtaDecisionChip({
  state,
  className,
  focusable = true,
  tooltip = true,
}: {
  state: RtaDecisionState
  className?: string
  focusable?: boolean
  tooltip?: boolean
}) {
  const meta = rtaDecisionMeta[state]
  const chip = (
    <span
      className={cn(
        "gn-rta-chip px-3 py-1",
        stateClasses[state],
        className
      )}
      data-state={state}
      aria-label={meta.ariaLabel}
      tabIndex={focusable ? 0 : undefined}
    >
      <span className="relative z-10">{meta.label}</span>
    </span>
  )

  if (!tooltip) {
    return chip
  }

  return <ProofTooltip label={meta.description}>{chip}</ProofTooltip>
}
