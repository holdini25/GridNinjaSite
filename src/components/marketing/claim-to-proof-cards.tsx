"use client"

import { useState } from "react"

import type { ClaimToProofCard } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"

export function ClaimToProofCards({
  cards,
}: {
  cards: ClaimToProofCard[]
}) {
  const [active, setActive] = useState(cards[0]?.domain)

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const isActive = active === card.domain

        return (
          <button
            key={card.domain}
            type="button"
            aria-pressed={isActive}
            data-gn-event="claim-to-proof-select"
            data-gn-domain={card.domain}
            onClick={() => setActive(card.domain)}
            onFocus={() => setActive(card.domain)}
            onMouseEnter={() => setActive(card.domain)}
            className={cn(
              "gn-panel gn-panel-interactive min-h-[18rem] px-5 py-6 text-left",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
              isActive && "border-primary/70 bg-surface-2"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="gn-eyebrow">Claim to proof</p>
                <h3 className="mt-4 text-[1.55rem] font-medium text-foreground">
                  {card.domain}
                </h3>
              </div>
              <RtaDecisionChip
                state={card.decision}
                focusable={false}
                tooltip={false}
              />
            </div>
            <div className="mt-6 grid gap-3">
              <div className="gn-proof-row">
                <p className="font-mono text-xs text-muted-foreground">
                  Nominal
                </p>
                <p className="font-mono text-2xl text-foreground">
                  {card.nominal}
                </p>
              </div>
              <div
                className={cn(
                  "grid gap-3 transition-opacity",
                  isActive ? "opacity-100" : "opacity-78"
                )}
              >
                <div className="gn-proof-row">
                  <p className="font-mono text-xs text-muted-foreground">
                    Binding constraint
                  </p>
                  <p className="text-base leading-7 text-foreground">
                    {card.bindingConstraint}
                  </p>
                </div>
                <div className="gn-proof-row">
                  <p className="font-mono text-xs text-muted-foreground">
                    Proof-adjusted
                  </p>
                  <p className="font-mono text-xl text-signal">
                    {card.proofAdjusted}
                  </p>
                </div>
                <p className="font-mono text-xs leading-5 text-muted-foreground">
                  {card.evidence}
                </p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
