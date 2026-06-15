"use client"

import { useMemo, useState } from "react"

import type { FleetSwarmSite, FleetSwarmState } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"
import { runViewTransition } from "@/lib/view-transition"

const stateOrder: Array<FleetSwarmState | "all"> = [
  "all",
  "shadow",
  "advisory",
  "bounded",
  "production",
  "no-proof",
]

const stateLabels: Record<FleetSwarmState | "all", string> = {
  all: "All",
  shadow: "Shadow",
  advisory: "Advisory",
  bounded: "Bounded",
  production: "Production",
  "no-proof": "No-Proof",
}

export function FleetSwarmMap({ sites }: { sites: FleetSwarmSite[] }) {
  const [filter, setFilter] = useState<FleetSwarmState | "all">("all")
  const [activeId, setActiveId] = useState<string | undefined>(sites[0]?.id)
  const filteredSites = useMemo(
    () =>
      filter === "all"
        ? sites
        : sites.filter((site) => site.state === filter),
    [filter, sites]
  )
  const active =
    filteredSites.find((site) => site.id === activeId) ??
    filteredSites[0] ??
    sites[0]

  function selectFilter(nextFilter: FleetSwarmState | "all") {
    runViewTransition(() => {
      setFilter(nextFilter)
      const nextSite =
        nextFilter === "all"
          ? sites[0]
          : sites.find((site) => site.state === nextFilter)
      setActiveId(nextSite?.id)
    })
  }

  function selectSite(id: string) {
    runViewTransition(() => setActiveId(id))
  }

  return (
    <div className="gn-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow">Fleet evidence map</p>
          <h3 className="mt-3 text-[2rem] font-medium text-foreground">
            FleetOS aggregates evidence; it does not approve site actions
          </h3>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Local site policy, operator authority, and runtime assurance remain the
          approval boundary.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" aria-label="Fleet state filter">
        {stateOrder.map((state) => (
          <button
            key={state}
            type="button"
            aria-pressed={filter === state}
            data-gn-event="fleet-filter-select"
            data-gn-state={state}
            onClick={() => selectFilter(state)}
            className={cn(
              "rounded-full border border-border/70 bg-background/45 px-4 py-2 font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase transition-colors",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
              filter === state && "border-primary/70 bg-surface-2 text-foreground"
            )}
          >
            {stateLabels[state]}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="gn-v2-fleet-grid">
          {filteredSites.map((site) => (
            <button
              key={site.id}
              type="button"
              aria-pressed={site.id === active?.id}
              data-gn-event="fleet-site-select"
              data-gn-site={site.id}
              onClick={() => selectSite(site.id)}
              onFocus={() => selectSite(site.id)}
              className={cn(
                "gn-v2-fleet-site rounded-[1rem] border border-border/70 bg-background/45 px-4 py-4 text-left transition-colors",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
                site.id === active?.id && "border-primary/70 bg-surface-2"
              )}
              data-state={site.state}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-foreground">
                  {site.name}
                </span>
                <span className="rounded-full border border-border/70 bg-surface px-2 py-1 font-mono text-[0.68rem] text-muted-foreground">
                  {site.stateLabel}
                </span>
              </span>
              <span className="mt-3 block text-sm leading-6 text-muted-foreground">
                {site.region} / {site.role}
              </span>
            </button>
          ))}
        </div>

        {active ? (
          <div className="rounded-[1.2rem] border border-border/70 bg-background/45 p-5">
            <p className="font-mono text-xs tracking-[0.16em] text-primary uppercase">
              Selected site evidence
            </p>
            <h4 className="mt-3 text-[1.6rem] font-medium text-foreground">
              {active.name} / {active.stateLabel}
            </h4>
            <p className="mt-3 text-base leading-8 text-muted-foreground">
              {active.detail}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="gn-proof-row">
                <p className="font-mono text-xs text-muted-foreground">
                  accepted_mw
                </p>
                <p className="font-mono text-sm text-foreground">
                  {active.acceptedMw}
                </p>
              </div>
              <div className="gn-proof-row">
                <p className="font-mono text-xs text-muted-foreground">
                  no_proof_gaps
                </p>
                <p className="font-mono text-sm text-foreground">
                  {active.noProofGaps}
                </p>
              </div>
              <div className="gn-proof-row sm:col-span-2">
                <p className="font-mono text-xs text-muted-foreground">
                  proof_root
                </p>
                <p className="font-mono text-sm text-foreground">
                  {active.proofRoot}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
