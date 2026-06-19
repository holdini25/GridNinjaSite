"use client"

import type { KeyboardEvent } from "react"
import { useEffect, useRef, useState } from "react"

import type { WhyGridNinjaScenario } from "@/content/copy/why-gridninja"
import {
  getUrlParam,
  notifyWhyGridNinjaContextChange,
  setUrlParam,
} from "@/lib/url-state"
import { runViewTransition } from "@/lib/view-transition"
import { cn } from "@/lib/utils"

export function WhyGridNinjaScenarioSimulator({
  scenarios,
}: {
  scenarios: WhyGridNinjaScenario[]
}) {
  const [activeId, setActiveId] = useState(() => {
    const scenario = getUrlParam("scenario")
    return scenario && scenarios.some((item) => item.id === scenario)
      ? scenario
      : scenarios[0]?.id
  })
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(
    0,
    scenarios.findIndex((item) => item.id === activeId)
  )
  const active = scenarios[activeIndex] ?? scenarios[0]

  useEffect(() => {
    function handlePopState() {
      const scenario = getUrlParam("scenario")
      setActiveId(
        scenario && scenarios.some((item) => item.id === scenario)
          ? scenario
          : scenarios[0]?.id
      )
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [scenarios])

  function setScenario(nextId: string) {
    runViewTransition(() => setActiveId(nextId))
    setUrlParam("scenario", nextId, { mode: "push" })
    notifyWhyGridNinjaContextChange()
  }

  function moveFocus(nextIndex: number) {
    const normalizedIndex = (nextIndex + scenarios.length) % scenarios.length
    refs.current[normalizedIndex]?.focus()
    setScenario(scenarios[normalizedIndex].id)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      moveFocus(activeIndex + 1)
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      moveFocus(activeIndex - 1)
    }
    if (event.key === "Home") {
      event.preventDefault()
      moveFocus(0)
    }
    if (event.key === "End") {
      event.preventDefault()
      moveFocus(scenarios.length - 1)
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="flex gap-2 overflow-x-auto rounded-[1rem] border border-border/70 bg-background/35 p-2"
        role="tablist"
        aria-label="Acceptance record scenarios"
      >
        {scenarios.map((scenario, index) => (
          <button
            key={scenario.id}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="tab"
            aria-selected={scenario.id === active.id}
            tabIndex={scenario.id === active.id ? 0 : -1}
            className={cn(
              "min-h-11 shrink-0 rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
              scenario.id === active.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            )}
            onClick={() => setScenario(scenario.id)}
            onKeyDown={handleKeyDown}
          >
            {scenario.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"
        tabIndex={0}
      >
        <div className="rounded-[1.2rem] border border-muted-foreground/25 bg-surface p-5">
          <p className="gn-eyebrow text-muted-foreground">
            Without common acceptance record
          </p>
          <h3 className="mt-3 text-[1.55rem] font-medium text-foreground">
            Useful systems, fragmented MW values
          </h3>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            {active.request}
          </p>
          <div className="mt-5 grid gap-3">
            {active.withoutRows.map((row) => (
              <div
                key={row}
                className="rounded-[0.85rem] border border-muted-foreground/25 border-dashed bg-background/35 px-4 py-3 font-mono text-sm text-muted-foreground"
              >
                {row}
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[0.9rem] border border-danger/30 bg-danger/10 px-4 py-3 text-base text-foreground">
            No common accepted value
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-proof-cyan/30 bg-proof-cyan/5 p-5">
          <p className="gn-eyebrow text-proof-cyan">With GridNinja</p>
          <h3 className="mt-3 text-[1.55rem] font-medium text-foreground">
            One proof-linked accepted envelope
          </h3>
          <div className="mt-5 grid gap-3">
            {active.withRows.map((row) => (
              <div
                key={`${row.label}-${row.value}`}
                className="grid gap-3 rounded-[0.85rem] border border-border/70 bg-background/45 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
                    {row.label}
                  </p>
                  <p className="mt-1 text-base text-foreground">{row.value}</p>
                </div>
                <span
                  className={cn(
                    "gn-rta-chip px-3 py-1.5",
                    row.state === "allow" && "gn-status-allow",
                    row.state === "repair" && "gn-status-repair",
                    row.state === "reject" && "gn-status-reject",
                    row.state === "no-proof" && "gn-status-no-proof"
                  )}
                >
                  {row.state}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[0.9rem] border border-signal/40 bg-signal/10 px-4 py-4">
            <p className="font-mono text-xs tracking-[0.16em] text-signal uppercase">
              Accepted envelope
            </p>
            <p className="mt-2 font-mono text-2xl text-foreground">
              {active.acceptedEnvelope}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {active.artifacts.map((artifact) => (
              <span
                key={artifact}
                className="rounded-full border border-proof-cyan/30 bg-background/45 px-3 py-1.5 font-mono text-xs text-proof-cyan"
              >
                {artifact}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
