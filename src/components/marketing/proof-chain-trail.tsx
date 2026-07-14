"use client"

import { useState } from "react"

import type { ProofChainStage } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

import { EvidenceDrawer } from "@/components/marketing/evidence-drawer"

export function ProofChainTrail({
  stages,
  proofRoot = "8f4c...91a",
}: {
  stages: ProofChainStage[]
  proofRoot?: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeStage = stages[activeIndex] ?? stages[0]

  return (
    <div className="gn-panel px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow">Proof chain</p>
          <h3 className="mt-3 text-[2rem] font-medium text-foreground">
            Proposal to proof pack with authority boundaries visible
          </h3>
        </div>
        <p className="rounded-full border border-border/70 bg-background/45 px-3 py-1 font-mono text-sm text-muted-foreground">
          proof_root: {proofRoot}
        </p>
      </div>

      <div className="gn-proof-chain mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stages.map((stage, index) => {
          const isActive = index === activeIndex

          return (
            <EvidenceDrawer
              key={stage.stage}
              title={`${stage.stage} evidence`}
              description={`${stage.canDo} ${stage.cannotDo}`}
              rows={stage.evidenceRows}
              proofRoot={proofRoot}
              trigger={
                <button
                  type="button"
                  aria-pressed={isActive}
                  data-boundary={stage.boundaryAfter ? "true" : "false"}
                  onFocus={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "gn-chain-stage gn-panel-interactive rounded-[1rem] border border-border/70 bg-background px-4 py-4 text-left",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
                    isActive && "border-primary/70 bg-surface-2"
                  )}
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-full border border-border/80 bg-surface font-mono text-sm text-primary">
                    {index + 1}
                  </span>
                  <span className="mt-4 block text-lg font-medium text-foreground">
                    {stage.stage}
                  </span>
                  <span className="mt-3 block text-sm leading-6 text-muted-foreground">
                    {stage.canDo}
                  </span>
                </button>
              }
            />
          )
        })}
      </div>

      {activeStage ? (
        <div className="mt-6 grid gap-px overflow-hidden rounded-[1rem] border border-border/70 bg-border/70 md:grid-cols-2">
          <div className="bg-background/45 px-4 py-4">
            <p className="font-mono text-xs tracking-[0.16em] text-signal uppercase">
              Can do
            </p>
            <p className="mt-2 text-base leading-7 text-foreground">
              {activeStage.canDo}
            </p>
          </div>
          <div className="bg-background/45 px-4 py-4">
            <p className="font-mono text-xs tracking-[0.16em] text-warning uppercase">
              Cannot do
            </p>
            <p className="mt-2 text-base leading-7 text-foreground">
              {activeStage.cannotDo}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
