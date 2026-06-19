"use client"

import { useEffect, useState } from "react"

import { ChevronDownIcon } from "lucide-react"

import type {
  WhyGridNinjaMaturity,
  WhyGridNinjaMaturityFilter,
} from "@/content/copy/why-gridninja"
import { getUrlParam } from "@/lib/url-state"
import { cn } from "@/lib/utils"

import { EvidenceDrawer } from "@/components/marketing/evidence-drawer"
import {
  buildMaturityEvidence,
  EvidenceMaturityFilter,
  MaturityBadge,
  maturityMatchesFilter,
} from "@/components/marketing/why-gridninja-maturity"

type ProofRoomArtifact = {
  code: string
  title: string
  body: string
  maturity: WhyGridNinjaMaturity
  hash: string
  scenario: string
}

const maturityFilters: WhyGridNinjaMaturityFilter[] = [
  "all",
  "validated",
  "operator",
  "design",
  "planned",
]

export function WhyGridNinjaProofRoom({
  artifacts,
}: {
  artifacts: ProofRoomArtifact[]
}) {
  const [filter, setFilter] = useState<WhyGridNinjaMaturityFilter>(() => {
    if (typeof window === "undefined") {
      return "all"
    }

    const maturity = getUrlParam("maturity")
    return maturityFilters.includes(maturity as WhyGridNinjaMaturityFilter)
      ? (maturity as WhyGridNinjaMaturityFilter)
      : "all"
  })
  const [expanded, setExpanded] = useState(false)
  const filteredArtifacts = artifacts.filter((artifact) =>
    maturityMatchesFilter(artifact.maturity, filter)
  )

  useEffect(() => {
    function handlePopState() {
      const maturity = getUrlParam("maturity")
      setFilter(
        maturityFilters.includes(maturity as WhyGridNinjaMaturityFilter)
          ? (maturity as WhyGridNinjaMaturityFilter)
          : "all"
      )
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  return (
    <div className="space-y-5">
      <EvidenceMaturityFilter value={filter} onChange={setFilter} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {filteredArtifacts.map((artifact, index) => (
          <div
            key={`${artifact.title}-${artifact.hash}`}
            className={cn(
              "group min-h-full rounded-[1.2rem] border border-border/70 bg-surface px-5 py-6 transition-all hover:border-proof-cyan/40 hover:bg-surface-2",
              index >= 4 && !expanded && "hidden md:block"
            )}
          >
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-proof-cyan/30 bg-proof-cyan/5 font-mono text-xs text-proof-cyan">
              {artifact.code}
            </span>
            <h3 className="mt-5 text-[1.15rem] font-medium text-foreground">
              {artifact.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {artifact.body}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <MaturityBadge
                evidence={buildMaturityEvidence({
                  maturity: artifact.maturity,
                  scope: artifact.title,
                  artifact: artifact.hash,
                  scenario: artifact.scenario,
                  knownLimitation:
                    "Scope varies by site and integration coverage.",
                })}
              />
              <span className="rounded-full border border-border/70 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                {artifact.hash}
              </span>
            </div>
            <EvidenceDrawer
              title={artifact.title}
              description={artifact.body}
              rows={[
                { label: "evidence_maturity", value: artifact.maturity },
                { label: "scenario", value: artifact.scenario },
                { label: "last_validated", value: "June 18, 2026" },
                {
                  label: "known_limit",
                  value: "Scope varies by site and integration coverage.",
                },
              ]}
              proofRoot={artifact.hash}
              trigger={
                <button
                  type="button"
                  className="mt-5 block min-h-10 rounded-lg border border-primary/35 px-3 py-2 font-mono text-xs tracking-[0.12em] text-primary uppercase transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/45"
                >
                  Inspect artifact
                </button>
              }
            />
          </div>
        ))}
      </div>

      {filteredArtifacts.length === 0 ? (
        <div className="rounded-[1rem] border border-muted-foreground/35 border-dashed bg-background/35 px-4 py-5 text-sm leading-7 text-muted-foreground">
          No artifacts currently match this maturity filter.
        </div>
      ) : null}

      {filteredArtifacts.length > 4 ? (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/45 md:hidden"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show fewer artifacts" : "View complete proof room"}
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      ) : null}
    </div>
  )
}
