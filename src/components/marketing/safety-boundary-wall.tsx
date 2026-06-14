"use client"

import { useState } from "react"

import type { RtaDecisionState } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"

const actions: Array<{
  id: string
  title: string
  state: RtaDecisionState
  result: string
  evidence: string
  timecode: string
}> = [
  {
    id: "allowed",
    title: "+0.8 MW shift inside declared envelope",
    state: "allow",
    result: "Passes through the boundary with proof row 004919.",
    evidence: "solid verified evidence: feeder ramp, SLA map, reserve margin",
    timecode: "T+00:11",
  },
  {
    id: "repair",
    title: "+2.4 MW shift touches reserve floor",
    state: "repair",
    result: "Clipped to +1.1 MW for 30 minutes before it can be accepted.",
    evidence: "solid verified evidence after repair: reserve floor remains intact",
    timecode: "T+00:18",
  },
  {
    id: "no-proof",
    title: "Unknown rack group telemetry age",
    state: "no-proof",
    result: "Bounced back as no-proof until telemetry trust is restored.",
    evidence: "dashed untrusted telemetry: rack group age exceeds policy",
    timecode: "T+00:31",
  },
]

export function SafetyBoundaryWall() {
  const [activeId, setActiveId] = useState(actions[1].id)
  const active = actions.find((action) => action.id === activeId) ?? actions[1]

  return (
    <div className="gn-panel px-6 py-7">
      <p className="gn-eyebrow">Safety boundary</p>
      <h3 className="mt-3 text-[2rem] font-medium text-foreground">
        Advisory intelligence stops before authority
      </h3>
      <div className="mt-5 grid gap-px overflow-hidden rounded-[1rem] border border-border/70 bg-border/70 text-sm md:grid-cols-3">
        <div className="bg-background/55 px-4 py-3">
          <p className="font-mono text-muted-foreground">proposal layer</p>
          <p className="mt-1 text-foreground">Advisory only</p>
        </div>
        <div className="bg-background/55 px-4 py-3">
          <p className="font-mono text-muted-foreground">
            advisory-to-authority boundary
          </p>
          <p className="mt-1 text-foreground">Solver + RTA gate</p>
        </div>
        <div className="bg-background/55 px-4 py-3">
          <p className="font-mono text-muted-foreground">proof output</p>
          <p className="mt-1 text-foreground">Receipt or no-proof row</p>
        </div>
      </div>
      <div className="gn-boundary-wall mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-3 md:pr-6">
          <p className="font-mono text-sm tracking-[0.16em] text-muted-foreground uppercase">
            ML / UI / fleet proposal
          </p>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              aria-pressed={active.id === action.id}
              onClick={() => setActiveId(action.id)}
              onFocus={() => setActiveId(action.id)}
              className={cn(
                "w-full rounded-[1rem] border border-border/70 bg-background/45 px-4 py-4 text-left transition-colors",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45",
                active.id === action.id && "border-primary/70 bg-surface-2"
              )}
            >
              <span className="text-base leading-7 text-foreground">
                {action.title}
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-4 md:pl-6">
          <p className="font-mono text-sm tracking-[0.16em] text-muted-foreground uppercase">
            Solver / RTA / receipts / proof
          </p>
          <div className="rounded-[1rem] border border-border/70 bg-background/45 px-5 py-5">
            <RtaDecisionChip state={active.state} />
            <p className="mt-4 text-base leading-8 text-foreground">
              {active.result}
            </p>
            <div
              className="mt-4 rounded-[0.85rem] border border-border/70 bg-surface px-3 py-3 data-[state=no-proof]:border-dashed"
              data-state={active.state}
            >
              <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                {active.timecode}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {active.evidence}
              </p>
            </div>
            <p className="mt-4 border-l border-primary/70 pl-4 font-mono text-sm leading-7 text-muted-foreground">
              Runtime assurance is the approval boundary, not the proposal layer.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
