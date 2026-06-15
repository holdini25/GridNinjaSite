"use client"

import { useState } from "react"

import { motion } from "motion/react"

import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"
import { xrayLayers, type XrayLayer } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

export function DataCenterXrayHD({
  layers = xrayLayers,
  className,
}: {
  layers?: XrayLayer[]
  className?: string
}) {
  const [activeId, setActiveId] = useState(layers[0]?.id)
  const active = layers.find((layer) => layer.id === activeId) ?? layers[0]

  if (!active) {
    return null
  }

  return (
    <section className={cn("gn-hd-panel p-6", className)}>
      <div className="gn-scanline" />
      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr] xl:items-center">
        <div>
          <p className="gn-eyebrow">Infrastructure X-Ray</p>
          <h3 className="mt-3 text-[2.15rem] font-medium tracking-tight text-foreground">
            Physical constraints become digital proof objects.
          </h3>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            GridNinja represents power, cooling, storage, workload, policy, and
            telemetry trust as inspectable proof layers before any deeper
            authority stage.
          </p>

          <div className="mt-6 grid gap-3">
            {layers.map((layer) => (
              <button
                key={layer.id}
                type="button"
                aria-pressed={layer.id === active.id}
                onClick={() => setActiveId(layer.id)}
                onFocus={() => setActiveId(layer.id)}
                className={cn(
                  "rounded-[1rem] border bg-background/45 p-4 text-left transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/45",
                  layer.id === active.id
                    ? "border-primary/65 bg-surface-2"
                    : "border-border/60 hover:border-primary/45"
                )}
              >
                <span className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium text-foreground">
                    {layer.title}
                  </span>
                  <RtaDecisionChip
                    state={layer.state}
                    tooltip={false}
                    focusable={false}
                    className="px-2.5 py-0.5"
                  />
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                  {layer.layer}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-h-[31rem] overflow-hidden rounded-[1.3rem] border border-border/70 bg-background/55 p-5">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(159,176,191,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(159,176,191,0.06)_1px,transparent_1px)] bg-[size:34px_34px]" />
          <div className="relative grid h-full place-items-center">
            <div className="relative h-72 w-full max-w-lg">
              <motion.div
                className="absolute inset-x-10 bottom-8 h-36 rounded-[1.2rem] border border-muted-foreground/30 bg-surface/70"
                animate={{ opacity: active.id === "trust" ? 0.32 : 0.72 }}
              />

              {layers.map((layer, index) => {
                const isActive = layer.id === active.id

                return (
                  <motion.div
                    key={layer.id}
                    className={cn(
                      "absolute left-1/2 h-12 w-[82%] -translate-x-1/2 rounded-[0.85rem] border px-4 py-3",
                      layer.state === "no-proof"
                        ? "gn-dashed-no-proof border-muted-foreground/45"
                        : "border-primary/45 bg-primary/10",
                      isActive && "border-signal/60 bg-signal/10"
                    )}
                    style={{ top: `${index * 3.1}rem` }}
                    initial={false}
                    animate={{
                      x: isActive ? 18 : 0,
                      opacity: isActive ? 1 : 0.52,
                      scale: isActive ? 1.03 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 180, damping: 22 }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-foreground">
                        {layer.title}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {layer.contribution ?? layer.proofObject}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <motion.div
              key={active.id}
              className="mt-8 w-full rounded-[1rem] border border-border/70 bg-background/70 p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
                selected proof layer
              </p>
              <h4 className="mt-2 text-xl font-medium text-foreground">
                {active.title}
              </h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <XrayMetric label="proof_object" value={active.proofObject} />
                <XrayMetric label="telemetry" value={active.telemetry} />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

function XrayMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[0.8rem] border border-border/60 bg-surface px-3 py-3">
      <p className="font-mono text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 break-words font-mono text-sm text-foreground">
        {value}
      </p>
    </div>
  )
}
