"use client"

import type { MouseEvent } from "react"

import { motion, useReducedMotion } from "motion/react"

import { GridNinjaProofSeal } from "@/components/brand/gridninja-proof-seal"
import { SheetTrigger } from "@/components/ui/sheet"
import {
  getScenarioProofEligible,
  type DispatchScenario,
} from "@/content/copy/dispatch-envelope"
import type { EvidenceChainStatus } from "@/content/proof-artifacts"

type ProofTraceStep = {
  id: string
  label: string
  value: string
}

export function DispatchProofTrace({
  onEvidenceTrigger,
  scenario,
}: {
  onEvidenceTrigger: (trigger: HTMLElement) => void
  scenario: DispatchScenario
}) {
  const reduced = useReducedMotion()
  const steps = buildTraceSteps(scenario)
  const evidenceChainStatus: EvidenceChainStatus = getScenarioProofEligible(
    scenario
  )
    ? "complete"
    : "no-proof"

  function handleOpen(event: MouseEvent<HTMLElement>) {
    onEvidenceTrigger(event.currentTarget)
  }

  return (
    <section className="border-t border-border/70 px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="gn-eyebrow text-proof-cyan">Decision-to-proof trace</p>
          <h3 className="mt-2 text-xl font-medium text-foreground">
            Decision evidence writes once, then settles
          </h3>
        </div>
        <div className="flex max-w-xl flex-col items-start gap-3">
          <GridNinjaProofSeal status={evidenceChainStatus} />
          <p className="text-sm leading-6 text-muted-foreground">
            The trace links the RTA result to ledger, dispatch envelope, and proof
            root artifacts for read-only inspection.
          </p>
        </div>
      </div>
      <ol
        className="grid gap-3 md:grid-cols-4"
        aria-label="Decision to proof trace"
        data-testid="dispatch-proof-trace"
      >
        {steps.map((step, index) => (
          <li key={step.id} className="relative">
            {index > 0 ? (
              <motion.span
                className="gn-dispatch-proof-trace-line hidden md:block"
                aria-hidden="true"
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.16 + index * 0.08, duration: 0.58 }}
              />
            ) : null}
            <SheetTrigger asChild onClick={handleOpen}>
              <motion.button
                type="button"
                className="min-h-11 w-full rounded-[0.85rem] border border-proof-cyan/25 bg-proof-cyan/5 p-4 text-left transition-colors hover:border-proof-cyan/50 focus-visible:ring-3 focus-visible:ring-ring/45"
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.24 }}
                data-testid={`dispatch-proof-trace-${step.id}`}
              >
                <span className="font-mono text-[0.65rem] tracking-[0.16em] text-proof-cyan uppercase">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong className="mt-2 block text-sm text-foreground">
                  {step.label}
                </strong>
                <span className="mt-2 block break-all font-mono text-xs text-muted-foreground">
                  {step.value}
                </span>
              </motion.button>
            </SheetTrigger>
          </li>
        ))}
      </ol>
    </section>
  )
}

function buildTraceSteps(scenario: DispatchScenario): ProofTraceStep[] {
  return [
    {
      id: "rta",
      label: "RTA row",
      value:
        scenario.dto.decision === "no-proof"
          ? "no_proof_000317"
          : `rta_${scenario.dto.tapeId.replace(/[^a-z0-9]/gi, "_")}`,
    },
    {
      id: "ledger",
      label: "Accepted-headroom ledger",
      value: scenario.dto.accepted ? "ledger_0184" : "withheld",
    },
    {
      id: "envelope",
      label: "Dispatch envelope",
      value: scenario.dto.schemaVersion,
    },
    {
      id: "proof-root",
      label: "Proof root",
      value: scenario.dto.proofRoot,
    },
  ]
}
