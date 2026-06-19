"use client"

import type { KeyboardEvent } from "react"
import { useEffect, useRef, useState } from "react"

import type {
  WhyGridNinjaMaturityFilter,
  WhyGridNinjaProofRequirement,
} from "@/content/copy/why-gridninja"
import {
  getUrlParam,
  notifyWhyGridNinjaContextChange,
  setUrlParam,
} from "@/lib/url-state"
import { runViewTransition } from "@/lib/view-transition"
import { cn } from "@/lib/utils"

import { noteWhyGridNinjaProofReviewed } from "@/components/marketing/contextual-shadow-cta"
import {
  buildMaturityEvidence,
  EvidenceMaturityFilter,
  MaturityBadge,
  maturityMatchesFilter,
} from "@/components/marketing/why-gridninja-maturity"

const maturityFilters: WhyGridNinjaMaturityFilter[] = [
  "all",
  "validated",
  "operator",
  "design",
  "planned",
]

export function WhyGridNinjaProofTabs({
  requirements,
}: {
  requirements: WhyGridNinjaProofRequirement[]
}) {
  const [activeId, setActiveId] = useState(() =>
    readProofParam(requirements) ?? requirements[0]?.id
  )
  const [filter, setFilter] = useState<WhyGridNinjaMaturityFilter>(() =>
    readMaturityParam()
  )
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(
    0,
    requirements.findIndex((item) => item.id === activeId)
  )
  const active = requirements[activeIndex] ?? requirements[0]

  useEffect(() => {
    function handlePopState() {
      const nextProof = readProofParam(requirements) ?? requirements[0]?.id
      setActiveId(nextProof)
      setFilter(readMaturityParam())
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [requirements])

  function setActive(nextId: string) {
    runViewTransition(() => setActiveId(nextId))
    setUrlParam("proof", nextId, { hash: "proof-standard", mode: "push" })
    noteWhyGridNinjaProofReviewed(nextId)
  }

  function setMaturityFilter(nextFilter: WhyGridNinjaMaturityFilter) {
    setFilter(nextFilter)
  }

  function moveFocus(nextIndex: number) {
    const normalizedIndex =
      (nextIndex + requirements.length) % requirements.length
    const next = requirements[normalizedIndex]
    buttonRefs.current[normalizedIndex]?.focus()
    setActive(next.id)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault()
      moveFocus(activeIndex + 1)
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault()
      moveFocus(activeIndex - 1)
    }
    if (event.key === "Home") {
      event.preventDefault()
      moveFocus(0)
    }
    if (event.key === "End") {
      event.preventDefault()
      moveFocus(requirements.length - 1)
    }
    if (event.key === "Enter" || event.key === " ") {
      notifyWhyGridNinjaContextChange()
    }
  }

  return (
    <div className="space-y-5">
      <EvidenceMaturityFilter value={filter} onChange={setMaturityFilter} />

      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div
          className="grid gap-2 lg:sticky lg:top-32 lg:self-start"
          role="tablist"
          aria-label="10-point virtual capacity proof test"
          aria-orientation="vertical"
        >
          {requirements.map((item, index) => {
            const selected = item.id === active.id
            const matchesFilter = maturityMatchesFilter(item.maturity, filter)

            return (
              <button
                key={item.id}
                ref={(element) => {
                  buttonRefs.current[index] = element
                }}
                type="button"
                id={`${item.id}-tab`}
                role="tab"
                aria-selected={selected}
                aria-controls={`${item.id}-panel`}
                tabIndex={selected ? 0 : -1}
                data-maturity-hidden={!matchesFilter}
                onClick={() => setActive(item.id)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded-[1rem] border px-4 py-3 text-left transition-all focus-visible:ring-3 focus-visible:ring-ring/45",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/70 bg-surface text-muted-foreground hover:text-foreground",
                  !matchesFilter && "opacity-45 saturate-50"
                )}
              >
                <span className="font-mono text-xs text-proof-cyan">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-base font-medium">{item.shortLabel}</span>
              </button>
            )
          })}
        </div>

        <div
          id={`${active.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${active.id}-tab`}
          tabIndex={0}
          className="gn-panel border-proof-cyan/25 p-6 focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="gn-eyebrow text-proof-cyan">
                Proof requirement {String(activeIndex + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-[2rem] font-medium text-foreground">
                {active.label}
              </h3>
            </div>
            <MaturityBadge
              evidence={buildMaturityEvidence({
                maturity: active.maturity,
                scope: active.label,
                artifact: active.artifact,
                scenario: "10-point Virtual Capacity Proof Test",
                knownLimitation: active.caveat,
              })}
            />
          </div>

          <div className="mt-6 rounded-[1rem] border border-border/70 bg-background/45 p-5">
            <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
              Buyer question
            </p>
            <p className="mt-2 text-xl leading-8 text-foreground">
              {active.buyerQuestion}
            </p>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {active.whyItMatters}
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <AnswerBlock
              label="Weak answer"
              value={active.weakAnswer}
              tone="weak"
            />
            <AnswerBlock
              label="Strong answer"
              value={active.strongAnswer}
              tone="strong"
            />
          </div>

          <div className="mt-5 rounded-[1rem] border border-proof-cyan/30 bg-proof-cyan/5 p-5">
            <p className="font-mono text-xs tracking-[0.16em] text-proof-cyan uppercase">
              GridNinja artifact
            </p>
            <p className="mt-2 font-mono text-lg text-foreground">
              {active.artifact}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="gn-proof-row">
                <p className="font-mono text-xs text-muted-foreground">SHA256</p>
                <p className="font-mono text-sm text-foreground">6bc9...f12a</p>
              </div>
              <div className="gn-proof-row">
                <p className="font-mono text-xs text-muted-foreground">scope</p>
                <p className="font-mono text-sm text-foreground">
                  shadow_read_only
                </p>
              </div>
              <div className="gn-proof-row">
                <p className="font-mono text-xs text-muted-foreground">
                  authority
                </p>
                <p className="font-mono text-sm text-foreground">no write path</p>
              </div>
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            {active.caveat}
          </p>
        </div>
      </div>
    </div>
  )
}

function readProofParam(requirements: WhyGridNinjaProofRequirement[]) {
  const proofParam = getUrlParam("proof")
  if (proofParam && requirements.some((item) => item.id === proofParam)) {
    return proofParam
  }

  return null
}

function readMaturityParam() {
  const maturity = getUrlParam("maturity")
  return maturityFilters.includes(maturity as WhyGridNinjaMaturityFilter)
    ? (maturity as WhyGridNinjaMaturityFilter)
    : "all"
}

function AnswerBlock({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "weak" | "strong"
}) {
  return (
    <div
      className={cn(
        "rounded-[1rem] border p-5",
        tone === "weak"
          ? "border-muted-foreground/25 bg-background/35"
          : "border-proof-cyan/30 bg-proof-cyan/5"
      )}
    >
      <p
        className={cn(
          "font-mono text-xs tracking-[0.16em] uppercase",
          tone === "weak" ? "text-muted-foreground" : "text-proof-cyan"
        )}
      >
        {label}
      </p>
      <p className="mt-2 text-base leading-7 text-muted-foreground">{value}</p>
    </div>
  )
}
