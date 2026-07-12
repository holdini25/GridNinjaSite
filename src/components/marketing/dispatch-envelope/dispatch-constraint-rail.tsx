"use client"

import type { KeyboardEvent } from "react"
import { useLayoutEffect, useRef } from "react"

import {
  formatMw,
  statusLabel,
  type DispatchDomainId,
  type getOrderedConstraints,
} from "@/content/copy/dispatch-envelope"
import { cn } from "@/lib/utils"

type OrderedConstraint = ReturnType<typeof getOrderedConstraints>[number]

export function DispatchConstraintRail({
  bindingCount,
  constraints,
  selectedDomainId,
  onSelect,
}: {
  bindingCount: number
  constraints: OrderedConstraint[]
  selectedDomainId: DispatchDomainId
  onSelect: (domainId: DispatchDomainId) => void
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingFocusDomainId = useRef<DispatchDomainId | null>(null)
  const selectedIndex = Math.max(
    0,
    constraints.findIndex(({ id }) => id === selectedDomainId)
  )

  useLayoutEffect(() => {
    const domainId = pendingFocusDomainId.current

    if (!domainId || domainId !== selectedDomainId) {
      return
    }

    const index = constraints.findIndex(({ id }) => id === domainId)
    const target = refs.current[index]

    if (!target) {
      return
    }

    target.focus()
    target.scrollIntoView({ block: "nearest", inline: "nearest" })
    pendingFocusDomainId.current = null
  }, [constraints, selectedDomainId])

  function move(nextIndex: number) {
    const normalized = (nextIndex + constraints.length) % constraints.length
    const next = constraints[normalized]

    pendingFocusDomainId.current = next.id
    onSelect(next.id)
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (!["ArrowUp", "ArrowDown", "Home", "End", "Enter", " "].includes(event.key)) {
      return
    }

    event.preventDefault()

    if (event.key === "Enter" || event.key === " ") {
      onSelect(constraints[index].id)
      return
    }

    if (event.key === "Home") {
      move(0)
      return
    }

    if (event.key === "End") {
      move(constraints.length - 1)
      return
    }

    move(event.key === "ArrowUp" ? index - 1 : index + 1)
  }

  return (
    <aside className="border-b border-border/70 p-4 sm:p-6 xl:border-r xl:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="gn-eyebrow text-[0.68rem]">Binding hierarchy</p>
          <h3 className="mt-2 text-xl font-medium text-foreground">
            Domain constraints
          </h3>
        </div>
        <span className="rounded-full border border-border/70 bg-background/45 px-3 py-1 font-mono text-xs text-muted-foreground">
          {bindingCount} active
        </span>
      </div>
      <div
        className="mt-5 flex gap-3 overflow-x-auto pb-2 xl:grid xl:overflow-visible xl:pb-0"
        role="listbox"
        aria-label="Binding hierarchy constraints"
        data-testid="dispatch-constraint-rail"
      >
        {constraints.map(({ id, constraint, meta, scoreLabel }, index) => (
          <button
            key={id}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="option"
            aria-selected={id === selectedDomainId}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "min-h-11 min-w-[15rem] rounded-[0.9rem] border bg-background/45 p-4 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 xl:min-w-0",
              id === selectedDomainId
                ? "border-primary/70"
                : "border-border/70 hover:border-primary/45"
            )}
            data-testid={`dispatch-constraint-${id}`}
            data-constraint-status={constraint.state}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="font-medium text-foreground">{meta.label}</span>
              <span className="rounded-full border border-current px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.12em] text-primary uppercase">
                {statusLabel(constraint.state)}
              </span>
            </span>
            <span className="mt-3 block text-xs leading-5 text-muted-foreground">
              {constraint.reason}
            </span>
            <span className="mt-3 flex justify-between gap-3 font-mono text-[0.68rem] text-muted-foreground">
              <span>{formatMw(constraint.maxMw)}</span>
              <span>{constraint.confidencePct}% conf.</span>
              <span>{scoreLabel}</span>
            </span>
            <span className="mt-2 block truncate font-mono text-[0.64rem] text-proof-cyan">
              {constraint.evidenceArtifact}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
