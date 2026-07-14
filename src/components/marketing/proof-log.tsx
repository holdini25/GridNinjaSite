"use client"

import type { CSSProperties } from "react"

import type { EvidenceRow } from "@/content/proof-artifacts"

import { EvidenceDrawer } from "@/components/marketing/evidence-drawer"
import { PublicClaimValue } from "@/components/seo/public-claim"

export function ProofLog({
  lines,
}: {
  lines: Array<{
    label: string
    value: string
    evidenceRows?: EvidenceRow[]
    proofRoot?: string
    claimId?: string
  }>
}) {
  return (
    <div className="gn-panel p-5">
      <div className="rounded-[1.4rem] border border-border/70 bg-background/70 p-5 font-mono text-base text-foreground">
        {lines.map((line, index) => (
          <div
            key={line.label}
            className="border-b border-border/50 last:border-b-0"
            style={{ "--line-index": index } as CSSProperties}
          >
            <EvidenceDrawer
              title={`${line.label} proof row`}
              description="Inspect the illustrative evidence row behind this proof log entry."
              rows={
                line.evidenceRows ?? [
                  { label: line.label, value: line.value },
                  { label: "row_id", value: `proof_log.${index + 1}` },
                ]
              }
              proofRoot={line.proofRoot ?? "8f4c...91a"}
              trigger={
                <button
                  type="button"
                  className="gn-terminal-line w-full py-3 text-left focus-visible:ring-3 focus-visible:ring-ring/45"
                  style={{ "--line-index": index } as CSSProperties}
                >
                  <span className="text-muted-foreground">{line.label}: </span>
                  <span>
                    {line.claimId ? (
                      <PublicClaimValue claimId={line.claimId} value={line.value} />
                    ) : (
                      line.value
                    )}
                  </span>
                </button>
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}
