"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { GridNinjaLogo } from "@/components/brand/gridninja-logo"
import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"
import type { WaterfallStep } from "@/content/proof-artifacts"
import { cn } from "@/lib/utils"

type ProofOperatingHeroVisualProps = {
  sectionId: string
  steps: WaterfallStep[]
}

export function ProofOperatingHeroVisual({
  sectionId,
  steps,
}: ProofOperatingHeroVisualProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion) return

    let frame = 0

    const update = () => {
      const section = document.getElementById(sectionId)

      if (!section) return

      const scrollPosition = window.scrollY
      const sectionTop = scrollPosition + section.getBoundingClientRect().top
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1)
      const progress = Math.min(
        1,
        Math.max(0, (scrollPosition - sectionTop) / scrollRange)
      )
      const nextIndex = Math.min(
        steps.length - 1,
        Math.max(0, Math.floor(progress * steps.length))
      )

      setActiveIndex((currentIndex) =>
        currentIndex === nextIndex ? currentIndex : nextIndex
      )
    }
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("resize", scheduleUpdate)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
    }
  }, [prefersReducedMotion, sectionId, steps.length])

  const visibleIndex = prefersReducedMotion ? steps.length - 1 : activeIndex
  const activeStep = steps[visibleIndex] ?? steps.at(-1)
  const finalStep = steps.find((step) => step.tone === "proof") ?? steps.at(-1)
  const maxCapacity = useMemo(
    () => Math.max(...steps.map((step) => step.capacityAfter ?? step.value)),
    [steps]
  )
  const acceptedCapacity =
    activeStep?.capacityAfter ?? activeStep?.value ?? finalStep?.value ?? 0

  return (
    <div className="gn-hd-panel relative overflow-hidden p-5">
      <div className="gn-scanline" />
      <GridNinjaLogo
        variant="watermark"
        showWordmark={false}
        className="pointer-events-none absolute -right-16 -bottom-12 hidden sm:inline-flex"
        markClassName="size-80 opacity-[0.04]"
      />
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.22em] text-primary uppercase">
            Capacity Waterfall
          </p>
          <h2 className="mt-2 text-[1.7rem] font-medium text-foreground">
            Nominal MW through proof
          </h2>
        </div>
        {activeStep?.decision ? <RtaDecisionChip state={activeStep.decision} /> : null}
      </div>

      <div className="relative z-10 mt-5 rounded-[1.1rem] border border-signal/35 bg-signal/10 p-4">
        <p className="font-mono text-xs tracking-[0.18em] text-signal uppercase">
          active capacity state
        </p>
        <div data-nosnippet data-claim-id="illustrative-capacity-waterfall">
          <AnimatedCapacityValue
            value={acceptedCapacity}
            className="mt-2 block font-mono text-[3rem] leading-none text-signal"
          />
        </div>
        <p className="gn-proof-root mt-3 inline-flex rounded-full px-3 py-1 text-xs">
          proof_root: 8f4c...91a
        </p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Synthetic illustrative scenario—not a customer or production result.
        </p>
      </div>

      <div className="gn-waterfall-rail relative z-10 mt-5 grid gap-3">
        {steps.map((step, index) => {
          const isActive = index <= visibleIndex
          const capacity = step.capacityAfter ?? step.value
          const width = `${Math.max((capacity / maxCapacity) * 100, 9)}%`

          return (
            <div
              key={step.label}
              className={cn(
                "ml-7 rounded-[1rem] border bg-background/45 p-3 transition-colors",
                isActive ? "border-primary/55" : "border-border/45 opacity-55",
                step.tone === "proof" && isActive && "border-signal/60 bg-signal/10"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                <span
                  className="font-mono text-sm text-muted-foreground"
                  data-nosnippet
                  data-claim-id="illustrative-capacity-waterfall"
                >
                  {capacity.toFixed(1)} MW
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    step.tone === "proof" ? "bg-signal" : "bg-primary"
                  )}
                  style={{ width: isActive ? width : "6%" }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnimatedCapacityValue({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const previousValue = useRef(value)
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    const from = previousValue.current
    previousValue.current = value

    if (from === value) {
      return
    }

    if (prefersReducedMotion) {
      const frame = requestAnimationFrame(() => setDisplayValue(value))
      return () => cancelAnimationFrame(frame)
    }

    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 420, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(from + (value - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [prefersReducedMotion, value])

  return (
    <span className={className}>
      {displayValue.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}{" "}
      MW
    </span>
  )
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setPrefersReducedMotion(query.matches)

    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return prefersReducedMotion
}
