"use client"

import type {
  WhyGridNinjaMaturity,
  WhyGridNinjaMaturityEvidence,
  WhyGridNinjaMaturityFilter,
} from "@/content/copy/why-gridninja"
import {
  notifyWhyGridNinjaContextChange,
  setUrlParam,
} from "@/lib/url-state"
import { cn } from "@/lib/utils"

import { EvidenceDrawer } from "@/components/marketing/evidence-drawer"

const filterOptions: Array<{
  id: WhyGridNinjaMaturityFilter
  label: string
}> = [
  { id: "all", label: "All" },
  { id: "validated", label: "Validated now" },
  { id: "operator", label: "Operator accepted" },
  { id: "design", label: "Design targets" },
  { id: "planned", label: "Planned" },
]

export function EvidenceMaturityFilter({
  value,
  onChange,
}: {
  value: WhyGridNinjaMaturityFilter
  onChange: (value: WhyGridNinjaMaturityFilter) => void
}) {
  function selectFilter(nextValue: WhyGridNinjaMaturityFilter) {
    onChange(nextValue)
    setUrlParam("maturity", nextValue === "all" ? undefined : nextValue, {
      mode: "push",
    })
    notifyWhyGridNinjaContextChange()
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto rounded-[1rem] border border-border/70 bg-background/35 p-2"
      role="group"
      aria-label="Evidence maturity filter"
    >
      {filterOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={cn(
            "min-h-11 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
            value === option.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          )}
          onClick={() => selectFilter(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function MaturityBadge({
  evidence,
  className,
}: {
  evidence: WhyGridNinjaMaturityEvidence
  className?: string
}) {
  return (
    <EvidenceDrawer
      title={`${evidence.maturity} evidence`}
      description={`${evidence.scope} maturity evidence, validation scope, and known limitation.`}
      rows={[
        { label: "scope", value: evidence.scope },
        { label: "validation_method", value: evidence.validationMethod },
        { label: "scenario", value: evidence.scenario },
        { label: "last_validated", value: evidence.lastValidated },
        { label: "artifact", value: evidence.artifact },
        { label: "known_limitation", value: evidence.knownLimitation },
      ]}
      proofRoot={evidence.artifact}
      trigger={
        <button
          type="button"
          className={cn(
            "min-h-9 rounded-full border px-3 py-1.5 font-mono text-xs tracking-[0.1em] uppercase transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
            maturityClassName(evidence.maturity),
            className
          )}
        >
          {evidence.maturity}
        </button>
      }
    />
  )
}

export function maturityMatchesFilter(
  maturity: WhyGridNinjaMaturity,
  filter: WhyGridNinjaMaturityFilter
) {
  if (filter === "all") {
    return true
  }

  if (filter === "validated") {
    return ["IMPLEMENTED", "REPLAY-VALIDATED", "SHADOW-VALIDATED"].includes(
      maturity
    )
  }

  if (filter === "operator") {
    return ["OPERATOR-ACCEPTED", "THIRD-PARTY-VALIDATED"].includes(maturity)
  }

  if (filter === "design") {
    return maturity === "DESIGN TARGET"
  }

  return maturity === "PLANNED"
}

export function buildMaturityEvidence({
  maturity,
  scope,
  artifact,
  scenario,
  knownLimitation,
}: {
  maturity: WhyGridNinjaMaturity
  scope: string
  artifact: string
  scenario: string
  knownLimitation: string
}): WhyGridNinjaMaturityEvidence {
  return {
    maturity,
    scope,
    validationMethod: validationMethodForMaturity(maturity),
    scenario,
    lastValidated: "June 18, 2026",
    artifact,
    knownLimitation,
  }
}

function validationMethodForMaturity(maturity: WhyGridNinjaMaturity) {
  if (maturity === "REPLAY-VALIDATED") {
    return "Deterministic replay over eligible Shadow Mode inputs."
  }

  if (maturity === "SHADOW-VALIDATED") {
    return "Read-only Shadow Mode validation against current telemetry."
  }

  if (maturity === "IMPLEMENTED") {
    return "Implemented product surface or artifact contract."
  }

  if (maturity === "OPERATOR-ACCEPTED") {
    return "Operator-reviewed acceptance in the defined scenario."
  }

  if (maturity === "THIRD-PARTY-VALIDATED") {
    return "External validation for the defined evidence class."
  }

  if (maturity === "DESIGN TARGET") {
    return "Designed target state; requires deployment validation before accepted-capacity claims."
  }

  return "Planned capability; not presented as current validated capacity."
}

function maturityClassName(maturity: WhyGridNinjaMaturity) {
  return cn(
    maturity === "IMPLEMENTED" &&
      "border-proof-cyan/35 bg-proof-cyan/5 text-proof-cyan hover:bg-proof-cyan/10",
    maturity === "REPLAY-VALIDATED" &&
      "border-proof-cyan/40 bg-proof-cyan/10 text-proof-cyan hover:bg-proof-cyan/15",
    maturity === "SHADOW-VALIDATED" &&
      "border-proof-cyan/40 bg-proof-cyan/10 text-proof-cyan hover:bg-proof-cyan/15",
    maturity === "OPERATOR-ACCEPTED" &&
      "border-signal/40 bg-signal/10 text-signal hover:bg-signal/15",
    maturity === "THIRD-PARTY-VALIDATED" &&
      "border-proof-cyan/40 bg-proof-cyan/10 text-proof-cyan hover:bg-proof-cyan/15",
    maturity === "DESIGN TARGET" &&
      "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
    maturity === "PLANNED" &&
      "border-muted-foreground/40 bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/15"
  )
}
