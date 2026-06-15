"use client"

import { useMemo, useState } from "react"

import { motion } from "motion/react"

import { AnimatedMw } from "@/components/marketing/animated-mw"
import {
  fleetEventPhases,
  fleetSwarmSites,
  type FleetEventPhase,
  type FleetSwarmSite,
  type FleetSwarmState,
} from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

export function FleetOSTimeTravelMap({
  sites = fleetSwarmSites,
  phases = fleetEventPhases,
  className,
}: {
  sites?: FleetSwarmSite[]
  phases?: FleetEventPhase[]
  className?: string
}) {
  const [phaseIndex, setPhaseIndex] = useState(
    Math.min(2, Math.max(phases.length - 1, 0))
  )
  const [activeId, setActiveId] = useState(sites[0]?.id)
  const phase = phases[phaseIndex] ?? phases[0]
  const acceptedSites = useMemo(
    () => sites.filter((site) => site.state !== "no-proof"),
    [sites]
  )
  const aggregateMw = useMemo(() => {
    return acceptedSites.reduce((sum, site) => {
      return sum + site.acceptedMwValue * (phase?.multiplier ?? 1)
    }, 0)
  }, [acceptedSites, phase])
  const active = sites.find((site) => site.id === activeId) ?? sites[0]

  if (!active || !phase) {
    return null
  }

  return (
    <section className={cn("gn-hd-panel p-6", className)}>
      <div className="gn-scanline" />
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="gn-eyebrow">FleetOS Time Travel</p>
          <h3 className="mt-3 max-w-3xl text-[2.15rem] font-medium text-foreground">
            Fleet evidence without fleet-side actuation authority.
          </h3>
          <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground">
            FleetOS aggregates signed site envelopes, proof roots, no-proof
            gaps, and accepted headroom. Local site authority remains bounded,
            operator-accepted, and proof-gated.
          </p>
        </div>
        <div className="rounded-[1rem] border border-signal/35 bg-signal/10 px-4 py-3">
          <p className="font-mono text-xs tracking-[0.16em] text-signal uppercase">
            proof-adjusted fleet MW
          </p>
          <AnimatedMw
            value={aggregateMw}
            className="mt-1 block font-mono text-[2rem] leading-none text-signal"
          />
        </div>
      </div>

      <div className="mt-7 rounded-[1rem] border border-border/70 bg-background/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
              event phase
            </p>
            <p className="mt-1 text-base text-foreground">
              {phase.label}:{" "}
              <span className="text-muted-foreground">{phase.gridEvent}</span>
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            no-proof sites excluded from aggregate
          </p>
        </div>

        <input
          aria-label="FleetOS event phase"
          className="mt-5 w-full accent-primary"
          type="range"
          min={0}
          max={phases.length - 1}
          step={1}
          value={phaseIndex}
          onChange={(event) => setPhaseIndex(Number(event.target.value))}
        />

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {phases.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={index === phaseIndex}
              onClick={() => setPhaseIndex(index)}
              className={cn(
                "rounded-full border px-3 py-2 font-mono text-[0.68rem] tracking-[0.12em] uppercase",
                "focus-visible:ring-3 focus-visible:ring-ring/45",
                index === phaseIndex
                  ? "border-primary/70 bg-primary/10 text-primary"
                  : "border-border/60 bg-surface text-muted-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {sites.map((site) => (
            <motion.button
              key={site.id}
              type="button"
              layout
              aria-pressed={site.id === active.id}
              onClick={() => setActiveId(site.id)}
              onFocus={() => setActiveId(site.id)}
              className={cn(
                "rounded-[1rem] border bg-background/45 p-4 text-left transition-colors",
                "focus-visible:ring-3 focus-visible:ring-ring/45",
                site.id === active.id
                  ? "border-primary/65 bg-surface-2"
                  : "border-border/60 hover:border-primary/45",
                site.state === "no-proof" && "gn-dashed-no-proof opacity-80"
              )}
              data-state={site.state}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-foreground">
                  {site.name}
                </span>
                <FleetStatePill state={site.state} label={site.stateLabel} />
              </span>
              <span className="mt-3 block text-sm leading-6 text-muted-foreground">
                {site.region} / {site.role}
              </span>
              <span className="mt-4 block font-mono text-sm text-signal">
                {site.state === "no-proof" ? "excluded" : site.acceptedMw}
              </span>
            </motion.button>
          ))}
        </div>

        <motion.div
          key={`${active.id}-${phase.id}`}
          className="rounded-[1.2rem] border border-border/70 bg-background/50 p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
            selected site evidence
          </p>
          <h4 className="mt-3 text-[1.65rem] font-medium text-foreground">
            {active.name} / {active.stateLabel}
          </h4>
          <p className="mt-3 text-base leading-8 text-muted-foreground">
            {active.detail}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FleetMetric label="accepted_mw" value={active.acceptedMw} />
            <FleetMetric label="no_proof_gaps" value={`${active.noProofGaps}`} />
            <FleetMetric label="phase" value={phase.label} />
            <FleetMetric label="proof_root" value={active.proofRoot} />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function FleetStatePill({
  state,
  label,
}: {
  state: FleetSwarmState
  label: string
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-1 font-mono text-[0.66rem] tracking-[0.12em] uppercase",
        state === "no-proof"
          ? "border-muted-foreground/45 text-muted-foreground"
          : state === "bounded" || state === "production"
            ? "border-signal/45 text-signal"
            : "border-primary/45 text-primary"
      )}
    >
      {label}
    </span>
  )
}

function FleetMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[0.85rem] border border-border/60 bg-surface px-3 py-3">
      <p className="font-mono text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 break-words font-mono text-sm text-foreground">
        {value}
      </p>
    </div>
  )
}
