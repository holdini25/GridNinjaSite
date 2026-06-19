"use client"

import type { KeyboardEvent } from "react"
import { useEffect, useRef, useState } from "react"

import { EyeIcon, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react"

import type { RtaDecisionState } from "@/content/proof-artifacts"
import { rtaDecisionMeta } from "@/content/proof-artifacts"
import { runViewTransition } from "@/lib/view-transition"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"

type TracePhase = "idle" | "running" | "paused" | "complete"

type TraceState = {
  id: RtaDecisionState
  requested: string
  accepted: string
  proofRow: string
  reason: string
  gates: Array<{
    index: string
    label: string
    status: string
    state: RtaDecisionState
  }>
}

const traceStates: TraceState[] = [
  {
    id: "repair",
    requested: "2.4 MW",
    accepted: "1.1 MW",
    proofRow: "proof_row_004921",
    reason: "Preserve operator-declared UPS reserve floor.",
    gates: [
      { index: "01", label: "Telemetry trust", status: "Fresh / 184 ms", state: "allow" },
      { index: "02", label: "Electrical margin", status: "T2 binding", state: "repair" },
      { index: "03", label: "UPS / BESS reserve", status: "Repair required", state: "repair" },
      { index: "04", label: "Cooling and water", status: "Within envelope", state: "allow" },
      { index: "05", label: "Workload / SLA", status: "Flexible batch", state: "allow" },
    ],
  },
  {
    id: "allow",
    requested: "0.8 MW",
    accepted: "0.8 MW",
    proofRow: "proof_row_004922",
    reason: "All active constraints remain inside the declared dispatch envelope.",
    gates: [
      { index: "01", label: "Telemetry trust", status: "Fresh / 112 ms", state: "allow" },
      { index: "02", label: "Electrical margin", status: "+4.1%", state: "allow" },
      { index: "03", label: "UPS / BESS reserve", status: "Protected", state: "allow" },
      { index: "04", label: "Cooling and water", status: "Stable", state: "allow" },
      { index: "05", label: "Workload / SLA", status: "No impact", state: "allow" },
    ],
  },
  {
    id: "reject",
    requested: "3.7 MW",
    accepted: "0 MW",
    proofRow: "reject_row_004923",
    reason: "No safe repair exists under current thermal and reserve policy.",
    gates: [
      { index: "01", label: "Telemetry trust", status: "Fresh / 201 ms", state: "allow" },
      { index: "02", label: "Electrical margin", status: "Below limit", state: "reject" },
      { index: "03", label: "UPS / BESS reserve", status: "Floor breach", state: "reject" },
      { index: "04", label: "Cooling and water", status: "Thermal risk", state: "reject" },
      { index: "05", label: "Workload / SLA", status: "No repair", state: "reject" },
    ],
  },
  {
    id: "no-proof",
    requested: "1.6 MW",
    accepted: "0 MW",
    proofRow: "no_proof_row_004924",
    reason: "Cooling source age exceeds policy, so the capacity claim is not eligible.",
    gates: [
      { index: "01", label: "Telemetry trust", status: "Stale source", state: "no-proof" },
      { index: "02", label: "Electrical margin", status: "Unverified", state: "no-proof" },
      { index: "03", label: "UPS / BESS reserve", status: "Unknown", state: "no-proof" },
      { index: "04", label: "Cooling and water", status: "No proof", state: "no-proof" },
      { index: "05", label: "Workload / SLA", status: "Held", state: "no-proof" },
    ],
  },
]

export function WhyGridNinjaHeroTrace() {
  const [activeState, setActiveState] = useState<RtaDecisionState>("repair")
  const [phase, setPhase] = useState<TracePhase>("idle")
  const [showConstraints, setShowConstraints] = useState(false)
  const stateRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeStateIndex = Math.max(
    0,
    traceStates.findIndex((item) => item.id === activeState)
  )
  const trace = traceStates[activeStateIndex] ?? traceStates[0]
  const meta = rtaDecisionMeta[trace.id]

  useEffect(() => {
    if (phase !== "running") {
      return
    }

    const timeout = window.setTimeout(() => setPhase("complete"), 1700)
    return () => window.clearTimeout(timeout)
  }, [phase, activeState])

  function replay() {
    setPhase("running")
  }

  function setMode(nextState: RtaDecisionState) {
    runViewTransition(() => {
      setActiveState(nextState)
      setPhase("running")
    })
  }

  function moveStateFocus(nextIndex: number) {
    const normalizedIndex =
      (nextIndex + traceStates.length) % traceStates.length
    const nextState = traceStates[normalizedIndex]
    stateRefs.current[normalizedIndex]?.focus()
    setMode(nextState.id)
  }

  function handleStateKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      moveStateFocus(activeStateIndex + 1)
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      moveStateFocus(activeStateIndex - 1)
    }
    if (event.key === "Home") {
      event.preventDefault()
      moveStateFocus(0)
    }
    if (event.key === "End") {
      event.preventDefault()
      moveStateFocus(traceStates.length - 1)
    }
  }

  return (
    <div
      className={cn(
        "gn-panel min-h-full p-5 md:p-6",
        "border-proof-cyan/30 bg-[linear-gradient(180deg,rgba(97,228,255,0.055),transparent_42%),var(--surface)]"
      )}
      aria-label="Illustrative capacity acceptance flow"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow text-proof-cyan">Capacity acceptance trace</p>
          <h2 className="mt-2 text-[1.6rem] font-medium text-foreground">
            Possibility becomes proof
          </h2>
        </div>
        <span className="rounded-full border border-border/70 px-3 py-1.5 font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
          {phase}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        <MetricBlock label="Claimed headroom" value="18.4 MW" />
        <TraceConnector active={phase === "running"} />
        <MetricBlock
          label="Checked against"
          value="site constraints"
          state={trace.id}
        />
        <TraceConnector active={phase === "running"} />
        <MetricBlock
          label="Proof-adjusted MW"
          value={trace.accepted}
          state={trace.id}
        />
      </div>

      <div className={cn("mt-5 rounded-[1rem] border p-4", statePanelClass(trace.id))}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              RTA output
            </p>
            <p className="mt-1 text-[1.8rem] font-medium text-foreground">
              {meta.label}
            </p>
          </div>
          <span className={cn("gn-rta-chip px-3 py-1.5", stateClass(trace.id))}>
            {meta.shape}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="gn-proof-row">
            <p className="font-mono text-xs text-muted-foreground">requested</p>
            <p className="font-mono text-lg text-foreground">{trace.requested}</p>
          </div>
          <div className="gn-proof-row">
            <p className="font-mono text-xs text-muted-foreground">accepted</p>
            <p className="font-mono text-lg text-foreground">{trace.accepted}</p>
          </div>
        </div>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Reason: {trace.reason}
        </p>
      </div>

      {showConstraints ? (
        <div className="mt-6 grid gap-3">
          {trace.gates.map((gate) => (
            <div
              key={gate.index}
              className={cn(
                "grid gap-3 rounded-[1rem] border border-border/70 bg-background/40 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center",
                phase === "running" && "gn-why-gate"
              )}
            >
              <span className="font-mono text-xs text-proof-cyan">
                {gate.index}
              </span>
              <span className="text-base font-medium text-foreground">
                {gate.label}
              </span>
              <span
                className={cn(
                  "gn-rta-chip px-3 py-1.5 text-xs",
                  stateClass(gate.state)
                )}
                data-state={gate.state}
              >
                {gate.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-[1rem] border border-muted-foreground/35 border-dashed bg-background/35 p-4">
          <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
            Constraint gates
          </p>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            The summary shows the acceptance result first. Inspect the gates to
            see which site-local constraints changed the MW claim.
          </p>
        </div>
      )}

      <div className="mt-5 rounded-[1rem] border border-proof-cyan/30 bg-proof-cyan/5 p-4">
        <p className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
          Proof written
        </p>
        <p className="mt-2 font-mono text-base text-foreground">{trace.proofRow}</p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          topology v0.3 / policy shadow_read_only
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-border/80 bg-background/45 text-foreground"
          onClick={() =>
            phase === "running" ? setPhase("paused") : replay()
          }
        >
          {phase === "running" ? <PauseIcon /> : <PlayIcon />}
          {phase === "running" ? "Pause trace" : "Replay trace"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-border/80 bg-background/45 text-foreground"
          onClick={() => {
            setShowConstraints(true)
            replay()
          }}
        >
          <EyeIcon />
          Inspect all constraints
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-border/80 bg-background/45 text-foreground"
          onClick={() => {
            setShowConstraints(false)
            setPhase("idle")
          }}
        >
          <RotateCcwIcon />
          Reset
        </Button>
      </div>

      <div
        className="mt-5 grid gap-2 sm:grid-cols-4"
        role="tablist"
        aria-label="RTA state variants"
      >
        {traceStates.map((state, index) => (
          <button
            key={state.id}
            ref={(element) => {
              stateRefs.current[index] = element
            }}
            type="button"
            role="tab"
            aria-selected={activeState === state.id}
            tabIndex={activeState === state.id ? 0 : -1}
            className={cn(
              "min-h-11 rounded-lg border border-border/70 px-3 py-2 font-mono text-xs tracking-[0.1em] uppercase transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
              activeState === state.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background/45 text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setMode(state.id)}
            onKeyDown={handleStateKeyDown}
          >
            {rtaDecisionMeta[state.id].label}
          </button>
        ))}
      </div>
    </div>
  )
}

function TraceConnector({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "hidden self-center md:block md:h-px md:w-10 md:bg-primary",
        active && "gn-why-signal"
      )}
    />
  )
}

function MetricBlock({
  label,
  value,
  state,
}: {
  label: string
  value: string
  state?: RtaDecisionState
}) {
  return (
    <div
      className={cn(
        "rounded-[1rem] border border-border/70 bg-background/45 p-4",
        state === "allow" && "border-signal/40",
        state === "repair" && "border-warning/40",
        state === "reject" && "border-danger/40",
        state === "no-proof" && "border-muted-foreground/40 border-dashed"
      )}
    >
      <p className="font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 font-mono text-[1.45rem] text-foreground">{value}</p>
    </div>
  )
}

function stateClass(state: RtaDecisionState) {
  return {
    "gn-status-allow": state === "allow",
    "gn-status-repair": state === "repair",
    "gn-status-reject": state === "reject",
    "gn-status-no-proof": state === "no-proof",
  }
}

function statePanelClass(state: RtaDecisionState) {
  return cn(
    state === "allow" && "border-signal/40 bg-signal/10",
    state === "repair" && "border-warning/40 bg-warning/10",
    state === "reject" && "border-danger/40 bg-danger/10",
    state === "no-proof" && "border-muted-foreground/40 bg-muted-foreground/10"
  )
}
