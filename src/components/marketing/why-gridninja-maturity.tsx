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
    return ["Implemented and tested in a stated environment", "Evaluated with authorized site data"].includes(
      maturity
    )
  }

  if (filter === "operator") {
    return ["Accepted for a stated customer decision"].includes(maturity)
  }

  if (filter === "design") {
    return maturity === "Specified"
  }

  return maturity === "Specified"
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
  const methods: Record<WhyGridNinjaMaturity, string> = {
    "Specified": "Documented design only; no site validation or customer acceptance is implied.",
    "Implemented and tested in a stated environment": "Software tests in the stated environment; limits and evidence must be attached.",
    "Evaluated with authorized site data": "Evaluation using authorized inputs for the stated site, window, and method.",
    "Accepted for a stated customer decision": "Customer acceptance for the named decision and criteria, not operating permission.",
  }
  return methods[maturity]
}
function maturityClassName(maturity: WhyGridNinjaMaturity) {
  return cn(maturity === "Specified" ? "border-warning/40 bg-warning/10 text-warning" : "border-proof-cyan/40 bg-proof-cyan/10 text-proof-cyan")
}
