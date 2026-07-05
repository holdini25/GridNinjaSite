"use client"

import { useEffect, useState } from "react"

import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react"

import {
  decisionLabel,
  formatMin,
  formatMw,
  type DispatchScenario,
} from "@/content/copy/dispatch-envelope"
import { cn } from "@/lib/utils"

const decisionTone = {
  allow: "gn-status-allow",
  repair: "gn-status-repair",
  reject: "gn-status-reject",
  "no-proof": "gn-status-no-proof",
} as const

export function DispatchDecisionRibbon({
  scenario,
  proofEligible,
  replayKey,
}: {
  scenario: DispatchScenario
  proofEligible: boolean
  replayKey: number
}) {
  const reduced = useReducedMotion()
  const dto = scenario.dto
  const acceptedMw = dto.accepted?.maxMw ?? null
  const repairDelta =
    dto.decision === "repair" && acceptedMw != null
      ? dto.request.maxMw - acceptedMw
      : 0

  return (
    <motion.div
      key={`${scenario.id}-${replayKey}`}
      className="grid gap-4 border-b border-border/70 px-4 py-4 sm:px-6 xl:grid-cols-[auto_auto_1px_repeat(3,minmax(5rem,auto))_minmax(14rem,1fr)_auto] xl:items-center"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      aria-live="polite"
      data-testid="dispatch-decision-ribbon"
    >
      <motion.span
        className={cn("gn-rta-chip w-fit px-4 py-2", decisionTone[dto.decision])}
        data-state={dto.decision}
        data-testid="dispatch-decision-pill"
        initial={reduced ? false : { opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        {decisionLabel(dto.decision)}
      </motion.span>
      <div
        className="flex flex-wrap items-baseline gap-2 font-mono"
        data-testid="dispatch-ribbon-flow"
      >
        <strong className="whitespace-nowrap text-xl text-primary">
          {formatMw(dto.request.maxMw)}
        </strong>
        <span className="text-muted-foreground">-&gt;</span>
        {acceptedMw != null ? (
          <strong
            className="whitespace-nowrap text-xl text-signal"
            data-testid="dispatch-ribbon-accepted-value"
          >
            <AnimatedNumber value={acceptedMw} suffix=" MW" />
          </strong>
        ) : (
          <strong
            className={cn(
              "text-xl",
              dto.decision === "reject" ? "text-danger" : "text-muted-foreground"
            )}
            data-testid="dispatch-ribbon-no-accepted"
          >
            {dto.decision === "no-proof"
              ? "INSUFFICIENT EVIDENCE"
              : "NO ACCEPTED ENVELOPE"}
          </strong>
        )}
        {repairDelta > 0 ? (
          <motion.span
            className="gn-dispatch-delta-flash rounded-full border border-warning/45 bg-warning/10 px-2.5 py-1 text-[0.68rem] text-warning"
            initial={reduced ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.42, duration: 0.16 }}
            data-testid="dispatch-ribbon-delta"
          >
            -{repairDelta.toFixed(1)} MW repaired
          </motion.span>
        ) : null}
      </div>
      <span className="hidden h-9 w-px bg-border/70 xl:block" />
      <RibbonMetric label="Hold" value={formatMin(dto.accepted?.holdMinutes)} />
      <RibbonMetric
        label="Ramp"
        value={dto.accepted ? `${dto.accepted.rampUpMwPerMin.toFixed(2)} MW/min` : "-"}
      />
      <RibbonMetric
        label="Recovery"
        value={formatMin(dto.accepted?.recoveryMinutes ?? dto.request.recoveryMinutes)}
      />
      <p className="text-sm leading-6 text-muted-foreground">
        {scenario.primaryReason}
      </p>
      <motion.span
        className={cn(
          "w-fit rounded-full border px-3 py-1 font-mono text-[0.68rem] tracking-[0.14em] uppercase",
          proofEligible
            ? "border-proof-cyan/45 text-proof-cyan"
            : "border-muted-foreground/40 text-muted-foreground"
        )}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.54, duration: 0.22 }}
        data-testid="dispatch-proof-eligibility"
      >
        {proofEligible ? "Proof eligible" : "No-proof"}
      </motion.span>
      <div className="xl:col-start-7 xl:col-end-9 flex flex-wrap gap-2 font-mono text-[0.66rem] text-proof-cyan">
        <span>policy {dto.policyBundleVersion}</span>
        <span>topology {dto.topologyHash}</span>
        <span>proof {dto.proofRoot}</span>
      </div>
    </motion.div>
  )
}

function RibbonMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20">
      <p className="font-mono text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-foreground">{value}</p>
    </div>
  )
}

function AnimatedNumber({
  value,
  suffix,
}: {
  value: number
  suffix: string
}) {
  const reduced = useReducedMotion()
  const motionValue = useMotionValue(value)
  const [displayValue, setDisplayValue] = useState(value)

  useMotionValueEvent(motionValue, "change", (latest) => {
    setDisplayValue(latest)
  })

  useEffect(() => {
    if (reduced) {
      motionValue.set(value)
      return
    }

    const controls = animate(motionValue, value, {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    })

    return () => controls.stop()
  }, [motionValue, reduced, value])

  return (
    <span aria-label={`${value.toFixed(1)} megawatts`}>
      {displayValue.toFixed(1)}
      {suffix}
    </span>
  )
}
