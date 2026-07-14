"use client"

import { useEffect, useRef, useState } from "react"

import { CapacityWaterfall } from "@/components/marketing/capacity-waterfall"
import { DemoModeOverlay } from "@/components/marketing/demo-mode-overlay"
import { ProofGridBackground } from "@/components/marketing/proof-grid-background"
import { ProofLoadingSteps } from "@/components/marketing/proof-loading-steps"
import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"
import {
  demoModeOverlays,
  proofLoadingSteps,
  type DemoMode,
  type RtaDecisionState,
  type WaterfallStep,
} from "@/content/proof-artifacts"
import { trackGridNinjaEvent } from "@/lib/analytics"
import { PublicClaimValue } from "@/components/seo/public-claim"
import { runViewTransition } from "@/lib/view-transition"

type DemoTrace = {
  outcome: string
  check: string
  reason: string
  margin: string
  claimId?: string
}

type DemoInspectionRoomProps = {
  scenario: {
    siteName: string
    disclaimer: string
    contractedService: string
    contractedServiceClaimId: string
    candidateAction: string
    candidateActionClaimId: string
    freshnessRequirement: string
    freshnessRequirementClaimId: string
    waterfall: WaterfallStep[]
    modes: readonly string[]
    traces: DemoTrace[]
  }
}

export function DemoInspectionRoom({ scenario }: DemoInspectionRoomProps) {
  const [mode, setMode] = useState(scenario.modes[0])
  const [toolMode, setToolMode] = useState<DemoMode>("Inspect")
  const [trace, setTrace] = useState(scenario.traces[0])
  const hasTrackedStart = useRef(false)
  const hasTrackedCompletion = useRef(false)
  const inspectedOutcomes = useRef(
    new Set(scenario.traces[0] ? [scenario.traces[0].outcome] : [])
  )
  const traceState = toDecisionState(trace.outcome)

  useEffect(() => {
    if (hasTrackedStart.current) return

    hasTrackedStart.current = true
    trackGridNinjaEvent("demo_start", {
      source: "demo-inspection-room",
      success: true,
    })
  }, [])

  function selectScenarioMode(nextMode: string) {
    runViewTransition(() => setMode(nextMode))
  }

  function selectToolMode(nextMode: DemoMode) {
    runViewTransition(() => setToolMode(nextMode))
  }

  function selectTrace(nextTrace: DemoTrace) {
    runViewTransition(() => setTrace(nextTrace))

    inspectedOutcomes.current.add(nextTrace.outcome)

    if (
      !hasTrackedCompletion.current &&
      inspectedOutcomes.current.size >= scenario.traces.length
    ) {
      hasTrackedCompletion.current = true
      trackGridNinjaEvent("proof_demo_complete", {
        source: "demo-inspection-room",
        success: true,
      })
    }
  }

  return (
    <div className="relative">
      <ProofGridBackground
        density="panel"
        labels={["TAPE_LOCK", "RTA_TRACE", "PROOF_ROOT", "NO_PROOF"]}
        className="rounded-[1.5rem]"
      />
      <div className="relative grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="gn-panel p-6">
            <p className="gn-eyebrow">Scenario selector</p>
            <h2 className="mt-3 text-[2rem] font-medium text-foreground">
              {scenario.siteName}
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {scenario.disclaimer}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {scenario.modes.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mode === item}
                  data-gn-event="demo-scenario-mode"
                  data-gn-mode={item}
                  onClick={() => selectScenarioMode(item)}
                  className={`min-h-11 rounded-[0.9rem] border px-4 py-3 text-left text-base transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 ${
                    mode === item
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-surface-2 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item} Mode
                </button>
              ))}
            </div>
          </div>

          <div className="gn-panel p-6">
            <p className="gn-eyebrow">Cursor-mode groundwork</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(["Inspect", "Explain", "Export"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={toolMode === item}
                  data-gn-event="demo-tool-mode"
                  data-gn-mode={item}
                  onClick={() => selectToolMode(item)}
                  className={`min-h-11 rounded-[0.9rem] border px-4 py-3 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 ${
                    toolMode === item
                      ? "border-primary bg-surface-2 text-foreground"
                      : "border-border/70 bg-background/35 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {toolMode === "Inspect"
                ? "Inspect reveals telemetry, margins, and binding constraints."
                : toolMode === "Explain"
                  ? "Explain follows the proposal -> solver -> RTA authority path."
                  : "Export selects the proof artifacts that would enter the proof pack."}
            </p>
            <DemoModeOverlay
              activeMode={toolMode}
              overlays={demoModeOverlays}
            />
          </div>

          <div className="gn-panel p-6">
            <p className="gn-eyebrow">Candidate action</p>
            <p className="mt-4 text-lg leading-8 text-foreground">
              <PublicClaimValue claimId={scenario.candidateActionClaimId} value={scenario.candidateAction} />
            </p>
            <p className="mt-4 border-l border-border/80 pl-4 text-base leading-8 text-muted-foreground">
              <PublicClaimValue claimId={scenario.freshnessRequirementClaimId} value={scenario.freshnessRequirement} />
            </p>
            <p className="mt-4 font-mono text-sm text-muted-foreground">
              Contracted utility service: <PublicClaimValue claimId={scenario.contractedServiceClaimId} value={scenario.contractedService} />
            </p>
          </div>

          <div className="gn-panel p-6">
            <p className="gn-eyebrow">RTA outcomes</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {scenario.traces.map((item) => (
                <button
                  key={item.outcome}
                  type="button"
                  aria-pressed={trace.outcome === item.outcome}
                  data-gn-event="demo-rta-outcome"
                  data-gn-outcome={item.outcome}
                  onClick={() => selectTrace(item)}
                  className={`min-h-11 rounded-[0.9rem] border px-4 py-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 ${
                    trace.outcome === item.outcome
                      ? "border-primary bg-surface-2 text-foreground"
                      : "border-border/70 bg-background/35 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <RtaDecisionChip
                    state={toDecisionState(item.outcome)}
                    focusable={false}
                    tooltip={false}
                  />
                  <span className="mt-1 block text-base">{item.check}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <CapacityWaterfall steps={scenario.waterfall} />
          <ProofLoadingSteps steps={proofLoadingSteps} />
          <div className="gn-panel gn-vt-rta-trace p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="gn-eyebrow">Selected trace</p>
              <RtaDecisionChip state={traceState} />
            </div>
            <h3 className="mt-4 text-[1.6rem] font-medium text-foreground">
              {trace.check}
            </h3>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {trace.reason}
            </p>
            <p className="mt-5 border-l border-primary/70 pl-4 font-mono text-base leading-8 text-foreground">
              {trace.claimId ? (
                <PublicClaimValue claimId={trace.claimId} value={trace.margin} />
              ) : (
                trace.margin
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function toDecisionState(outcome: string): RtaDecisionState {
  const normalized = outcome.toLowerCase()

  if (normalized === "allow") {
    return "allow"
  }

  if (normalized === "repair") {
    return "repair"
  }

  if (normalized === "reject") {
    return "reject"
  }

  return "no-proof"
}
