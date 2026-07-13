import Image from "next/image"

import type { EvidenceChainStatus } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

export const GRIDNINJA_PROOF_SEAL_LABEL =
  "Illustrative sample · evidence chain complete"

type GridNinjaProofSealProps = {
  status: EvidenceChainStatus
  withheld?: boolean
  className?: string
}

/**
 * Presentation-only evidence marker. The copper artwork never communicates an
 * allow / repair / reject decision and is withheld unless the evidence chain
 * is explicitly complete.
 */
export function GridNinjaProofSeal({
  status,
  withheld = false,
  className,
}: GridNinjaProofSealProps) {
  if (status !== "complete" || withheld) {
    return null
  }

  return (
    <span
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full border border-[#F58220]/45 bg-[#F58220]/8 px-3 py-1.5 font-mono text-xs text-[#FF9A2E]",
        className
      )}
      data-evidence-chain-status="complete"
    >
      <Image
        src="/brand/gridninja-proof-star.svg"
        width={20}
        height={20}
        alt=""
        aria-hidden="true"
        className="size-5 shrink-0"
      />
      <span>{GRIDNINJA_PROOF_SEAL_LABEL}</span>
    </span>
  )
}
