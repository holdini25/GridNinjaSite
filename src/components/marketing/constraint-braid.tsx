"use client"

import type { CSSProperties } from "react"
import { useState } from "react"

import type { ConstraintBraidDomain } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"
import { runViewTransition } from "@/lib/view-transition"

import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"

export function ConstraintBraid({
  domains,
}: {
  domains: ConstraintBraidDomain[]
}) {
  const [activeId, setActiveId] = useState(domains[0]?.id)
  const active =
    domains.find((domain) => domain.id === activeId) ?? domains[0]

  function selectDomain(id: string) {
    runViewTransition(() => setActiveId(id))
  }

  return (
    <div className="gn-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow">Constraint braid</p>
          <h3 className="mt-3 text-[2rem] font-medium text-foreground">
            Constraints converge before capacity is accepted
          </h3>
        </div>
        {active ? <RtaDecisionChip state={active.state} /> : null}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <div className="grid gap-3">
          {domains.map((domain, index) => {
            const isActive = domain.id === active?.id

            return (
              <button
                key={domain.id}
                type="button"
                aria-pressed={isActive}
                data-gn-event="constraint-braid-select"
                data-gn-domain={domain.id}
                onClick={() => selectDomain(domain.id)}
                onFocus={() => selectDomain(domain.id)}
                className={cn(
                  "gn-v2-braid-node rounded-[1rem] border border-border/70 bg-background/45 px-4 py-4 text-left transition-colors",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
                  isActive && "border-primary/70 bg-surface-2 text-foreground"
                )}
                data-active={isActive}
                style={{ "--node-index": index } as CSSProperties}
              >
                <span className="font-mono text-xs tracking-[0.18em] text-primary uppercase">
                  {domain.title}
                </span>
                <span className="mt-2 block text-base leading-7 text-foreground">
                  {domain.input}
                </span>
                <span className="mt-3 block font-mono text-xs text-muted-foreground">
                  trust {domain.trustScore} / 100
                </span>
              </button>
            )
          })}
        </div>

        {active ? (
          <div className="gn-v2-braid-canvas rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                <div className="rounded-[1rem] border border-border/70 bg-surface px-4 py-4">
                  <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                    Binding constraint
                  </p>
                  <p className="mt-2 text-lg font-medium text-foreground">
                    {active.bindingConstraint}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-border/70 bg-surface px-4 py-4">
                  <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                    Proof object
                  </p>
                  <p className="mt-2 text-lg font-medium text-foreground">
                    {active.proofObject}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="gn-v2-braid-line" data-state={active.state}>
                  <div className="gn-meter-track">
                    <div
                      className="gn-meter-fill"
                      style={
                        {
                          "--meter-width": `${active.trustScore}%`,
                        } as CSSProperties
                      }
                    />
                  </div>
                </div>
                <div className="rounded-[1rem] border border-border/70 bg-surface px-4 py-4">
                  <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                    Accepted posture
                  </p>
                  <p className="mt-2 text-base leading-8 text-foreground">
                    {active.acceptedPosture}
                  </p>
                </div>
                <div className="grid gap-2">
                  {active.evidenceRows.map((row) => (
                    <div key={row.label} className="gn-proof-row">
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.label}
                      </p>
                      <p className="font-mono text-sm text-foreground">
                        {row.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
