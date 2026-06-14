"use client"

import type { CSSProperties } from "react"
import { useState } from "react"

import type { XrayLayer } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"
import { runViewTransition } from "@/lib/view-transition"

import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"

export function DataCenterXrayReveal({ layers }: { layers: XrayLayer[] }) {
  const [activeId, setActiveId] = useState(layers[0]?.id)
  const active = layers.find((layer) => layer.id === activeId) ?? layers[0]

  function selectLayer(id: string) {
    runViewTransition(() => setActiveId(id))
  }

  return (
    <div className="gn-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow">Infrastructure X-ray</p>
          <h3 className="mt-3 text-[2rem] font-medium text-foreground">
            Infrastructure layers become proof objects
          </h3>
        </div>
        {active ? <RtaDecisionChip state={active.state} /> : null}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div
          className="gn-xray-canvas rounded-[1.2rem] border border-border/70 bg-background/45 p-5"
          aria-label="Code-native data center X-ray layers"
        >
          {layers.map((layer, index) => (
            <button
              key={layer.id}
              type="button"
              aria-pressed={active?.id === layer.id}
              onClick={() => selectLayer(layer.id)}
              onFocus={() => selectLayer(layer.id)}
              className={cn(
                "gn-xray-layer text-left",
                active?.id === layer.id && "is-active"
              )}
              data-state={layer.state}
              style={{ "--xray-index": index } as CSSProperties}
            >
              <span className="font-mono text-xs text-muted-foreground">
                {layer.title}
              </span>
              <span className="mt-1 block text-sm text-foreground">
                {layer.layer}
              </span>
            </button>
          ))}
        </div>

        {active ? (
          <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
            <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
              Selected layer
            </p>
            <h4 className="mt-3 text-[1.6rem] font-medium text-foreground">
              {active.title}
            </h4>
            <p className="mt-3 text-base leading-8 text-muted-foreground">
              {active.body}
            </p>
            <div className="mt-5 grid gap-3">
              <div className="gn-proof-row">
                <p className="font-mono text-xs text-muted-foreground">
                  proof_object
                </p>
                <p className="font-mono text-sm text-foreground">
                  {active.proofObject}
                </p>
              </div>
              <div className="gn-proof-row">
                <p className="font-mono text-xs text-muted-foreground">
                  telemetry
                </p>
                <p className="font-mono text-sm text-foreground">
                  {active.telemetry}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
