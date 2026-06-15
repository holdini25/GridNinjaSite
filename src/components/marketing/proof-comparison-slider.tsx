"use client"

import type { CSSProperties } from "react"
import { useState } from "react"

import type { ProofComparisonFixture } from "@/content/proof-artifacts"
import { runViewTransition } from "@/lib/view-transition"

export function ProofComparisonSlider({
  comparison,
}: {
  comparison: ProofComparisonFixture
}) {
  const [position, setPosition] = useState(58)

  function setPreset(nextPosition: number) {
    runViewTransition(() => setPosition(nextPosition))
  }

  const proofWeight = Math.round(position)
  const claimWeight = 100 - proofWeight
  const comparisonStyle = {
    "--claim-fr": `${Math.max(claimWeight, 24)}fr`,
    "--proof-fr": `${Math.max(proofWeight, 24)}fr`,
  } as CSSProperties

  return (
    <div className="gn-panel p-6">
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr] xl:items-start">
        <div>
          <p className="gn-eyebrow">Before / after proof</p>
          <h3 className="mt-3 text-[2rem] font-medium text-foreground">
            {comparison.title}
          </h3>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            {comparison.body}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              data-gn-event="proof-comparison-preset"
              data-gn-mode="claimed"
              className="rounded-full border border-border/70 bg-background/45 px-4 py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
              onClick={() => setPreset(20)}
            >
              claimed view
            </button>
            <button
              type="button"
              data-gn-event="proof-comparison-preset"
              data-gn-mode="proof-adjusted"
              className="rounded-full border border-border/70 bg-background/45 px-4 py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
              onClick={() => setPreset(80)}
            >
              proof-adjusted view
            </button>
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
          <label
            htmlFor="proof-comparison-range"
            className="font-mono text-xs tracking-[0.16em] text-primary uppercase"
          >
            Proof comparison balance
          </label>
          <input
            id="proof-comparison-range"
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            data-gn-event="proof-comparison-range"
            className="mt-4 w-full accent-primary"
            aria-valuetext={`${proofWeight}% proof-adjusted evidence view`}
          />

          <div
            className="gn-v2-proof-compare mt-5"
            style={comparisonStyle}
          >
            <div className="rounded-[1rem] border border-border/70 bg-surface p-4">
              <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                {comparison.beforeLabel}
              </p>
              <p className="mt-3 font-mono text-2xl text-foreground">
                {comparison.beforeMw}
              </p>
              <div className="mt-4 grid gap-2">
                {comparison.beforeRows.map((row) => (
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

            <div className="rounded-[1rem] border border-primary/40 bg-surface p-4">
              <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
                {comparison.afterLabel}
              </p>
              <p className="mt-3 font-mono text-2xl text-signal">
                {comparison.afterMw}
              </p>
              <div className="mt-4 grid gap-2">
                {comparison.afterRows.map((row) => (
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
          <p className="mt-4 font-mono text-sm text-muted-foreground" aria-live="polite">
            {proofWeight}% proof-adjusted evidence view, {claimWeight}% claimed
            headroom context.
          </p>
        </div>
      </div>
    </div>
  )
}
