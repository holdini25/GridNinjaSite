"use client"

import { useMemo, useRef, useState } from "react"

import Link from "next/link"
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react"

import { Button } from "@/components/ui/button"
import { GridNinjaLogo } from "@/components/brand/gridninja-logo"
import { AnimatedMw } from "@/components/marketing/animated-mw"
import { RtaDecisionChip } from "@/components/marketing/rta-decision-chip"
import { illustrativeWaterfall, type WaterfallStep } from "@/content/proof-artifacts"
import { buildLeadHref } from "@/lib/lead"
import { cn } from "@/lib/utils"

export function ProofOperatingHero({
  steps = illustrativeWaterfall,
}: {
  steps?: WaterfallStep[]
}) {
  const ref = useRef<HTMLElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(steps.length - 1)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (prefersReducedMotion) return

    const nextIndex = Math.min(
      steps.length - 1,
      Math.max(0, Math.floor(progress * steps.length))
    )

    setActiveIndex(nextIndex)
  })

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
    <section
      ref={ref}
      className="relative min-h-[145svh] border-b border-border/70"
      aria-label="GridNinja proof operating system hero"
    >
      <div className="sticky top-16 z-10 mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(380px,560px)] lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <p className="gn-eyebrow">AI Data Center Virtual Capacity Control Plane</p>
          <h1 className="mt-5 max-w-[11ch] text-balance text-[2.65rem] leading-[0.95] font-medium tracking-tight text-foreground sm:text-[4.1rem] lg:text-[5.2rem]">
            Claimed headroom is not proven capacity.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            GridNinja is the virtual capacity control plane for AI data centers,
            proving safe, usable capacity to accelerate time-to-power while
            protecting infrastructure.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link
                href={buildLeadHref("capacity-audit", "proof-operating-hero")}
                data-gn-event="proof-operating-hero-capacity-audit"
              >
                Request Capacity Audit
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-border/80 bg-surface/60 text-foreground"
            >
              <Link href="/demo" data-gn-event="proof-operating-hero-demo">
                Inspect proof demo
              </Link>
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-surface px-3 py-1">
              Shadow Mode first
            </span>
            <span className="rounded-full border border-border/70 bg-surface px-3 py-1">
              no command VLAN
            </span>
            <span className="rounded-full border border-border/70 bg-surface px-3 py-1">
              no write credentials
            </span>
          </div>
        </motion.div>

        <motion.div
          className="gn-hd-panel relative overflow-hidden p-5"
          initial={{ opacity: 0, scale: 0.985, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.08 }}
        >
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
            <AnimatedMw
              value={acceptedCapacity}
              className="mt-2 block font-mono text-[3rem] leading-none text-signal"
            />
            <p className="gn-proof-root mt-3 inline-flex rounded-full px-3 py-1 text-xs">
              proof_root: 8f4c...91a
            </p>
          </div>

          <div className="gn-waterfall-rail relative z-10 mt-5 grid gap-3">
            {steps.map((step, index) => {
              const isActive = index <= visibleIndex
              const capacity = step.capacityAfter ?? step.value
              const width = `${Math.max((capacity / maxCapacity) * 100, 9)}%`

              return (
                <motion.div
                  key={step.label}
                  layout
                  className={cn(
                    "ml-7 rounded-[1rem] border bg-background/45 p-3 transition-colors",
                    isActive ? "border-primary/55" : "border-border/45 opacity-55",
                    step.tone === "proof" && isActive && "border-signal/60 bg-signal/10"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <p className="font-mono text-sm text-muted-foreground">
                      {capacity.toFixed(1)} MW
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        step.tone === "proof" ? "bg-signal" : "bg-primary"
                      )}
                      initial={false}
                      animate={{ width: isActive ? width : "6%" }}
                      transition={{ duration: 0.42 }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
