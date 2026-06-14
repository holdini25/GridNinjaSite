"use client"

import { useRef, useState } from "react"

import type { ProofStoryStep } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"
import { runViewTransition } from "@/lib/view-transition"

import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"

export function ProofStorySnap({ steps }: { steps: ProofStoryStep[] }) {
  const [activeId, setActiveId] = useState(steps[0]?.id)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  function selectStep(id: string) {
    runViewTransition(() => setActiveId(id))
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    itemRefs.current[id]?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    })
  }

  return (
    <div className="gn-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow">Proof story</p>
          <h3 className="mt-3 text-[2rem] font-medium text-foreground">
            Claimed headroom becomes an exportable proof chain
          </h3>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Proof story steps">
          {steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              aria-pressed={activeId === step.id}
              onClick={() => selectStep(step.id)}
              className={cn(
                "rounded-full border border-border/70 bg-background/45 px-3 py-2 font-mono text-xs text-muted-foreground transition-colors",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
                activeId === step.id && "border-primary/70 bg-surface-2 text-foreground"
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
      </div>

      <div className="gn-proof-story mt-6 grid gap-4 lg:flex">
        {steps.map((step) => (
          <div
            key={step.id}
            ref={(node) => {
              itemRefs.current[step.id] = node
            }}
            className="gn-proof-story-step rounded-[1rem] border border-border/70 bg-background/45 p-5"
            data-active={activeId === step.id}
            tabIndex={-1}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
                  {step.eyebrow}
                </p>
                <h4 className="mt-3 text-[1.35rem] font-medium text-foreground">
                  {step.title}
                </h4>
              </div>
              <RtaDecisionChip state={step.state} />
            </div>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {step.body}
            </p>
            <p className="mt-4 rounded-full border border-border/70 bg-surface px-3 py-2 font-mono text-xs text-muted-foreground">
              artifact: <span className="text-foreground">{step.artifact}</span>
            </p>
            <div className="mt-4 grid gap-2">
              {step.rows.map((row) => (
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
        ))}
      </div>
    </div>
  )
}
