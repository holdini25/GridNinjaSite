"use client"

import Link from "next/link"
import type { KeyboardEvent } from "react"
import { useEffect, useRef, useState } from "react"

import type { WhyGridNinjaPersona } from "@/content/copy/why-gridninja"
import { buildLeadHref } from "@/lib/lead"
import {
  getUrlParam,
  notifyWhyGridNinjaContextChange,
  setUrlParam,
} from "@/lib/url-state"
import { runViewTransition } from "@/lib/view-transition"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"

export function WhyGridNinjaPersonaTabs({
  personas,
}: {
  personas: WhyGridNinjaPersona[]
}) {
  const [activeId, setActiveId] = useState(() => {
    const persona = getUrlParam("persona")
    return persona && personas.some((item) => item.id === persona)
      ? persona
      : personas[0]?.id
  })
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(
    0,
    personas.findIndex((persona) => persona.id === activeId)
  )
  const active = personas[activeIndex] ?? personas[0]

  useEffect(() => {
    function handlePopState() {
      const persona = getUrlParam("persona")
      setActiveId(
        persona && personas.some((item) => item.id === persona)
          ? persona
          : personas[0]?.id
      )
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [personas])

  function setPersona(nextId: string) {
    runViewTransition(() => setActiveId(nextId))
    setUrlParam("persona", nextId, { mode: "push" })
    notifyWhyGridNinjaContextChange()
  }

  function moveFocus(nextIndex: number) {
    const normalizedIndex = (nextIndex + personas.length) % personas.length
    refs.current[normalizedIndex]?.focus()
    setPersona(personas[normalizedIndex].id)
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
      moveFocus(personas.length - 1)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
      <div
        className="flex gap-2 overflow-x-auto rounded-[1rem] border border-border/70 bg-background/35 p-2 lg:grid lg:grid-cols-2"
        role="tablist"
        aria-label="Stakeholder value"
      >
        {personas.map((persona, index) => {
          const selected = persona.id === active.id

          return (
            <button
              key={persona.id}
              ref={(element) => {
                refs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`${persona.id}-persona-tab`}
              aria-selected={selected}
              aria-controls={`${persona.id}-persona-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setPersona(persona.id)}
              onKeyDown={handleKeyDown}
              className={cn(
                "min-h-11 shrink-0 rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              )}
            >
              {persona.label}
            </button>
          )
        })}
      </div>

      <div
        id={`${active.id}-persona-panel`}
        role="tabpanel"
        aria-labelledby={`${active.id}-persona-tab`}
        className="gn-panel border-proof-cyan/25 p-6"
        tabIndex={0}
      >
        <p className="gn-eyebrow text-proof-cyan">Selected audience</p>
        <h3 className="mt-3 text-[2rem] font-medium text-foreground">
          {active.label}
        </h3>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
          {active.lead}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {active.points.map((point) => (
            <div key={point} className="gn-proof-row text-base text-foreground">
              {point}
            </div>
          ))}
        </div>
        <Button asChild className="mt-6">
          <Link
            href={buildLeadHref("capacity-audit", active.ctaSource, {
              persona: active.id,
            })}
          >
            Compare this proof path
          </Link>
        </Button>
      </div>
    </div>
  )
}
