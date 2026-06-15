"use client"

import { useEffect, useState } from "react"

import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react"

import { gnEase } from "@/lib/motion/gridninja-motion"

export function AnimatedMw({
  value,
  className,
  suffix = " MW",
}: {
  value: number
  className?: string
  suffix?: string
}) {
  const prefersReducedMotion = useReducedMotion()
  const motionValue = useMotionValue(value)
  const [displayValue, setDisplayValue] = useState(value)

  useMotionValueEvent(motionValue, "change", (latest) => {
    setDisplayValue(latest)
  })

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.set(value)
      return
    }

    const controls = animate(motionValue, value, {
      duration: 0.72,
      ease: gnEase.out,
    })

    return () => controls.stop()
  }, [motionValue, prefersReducedMotion, value])

  return (
    <span className={className} aria-label={`${value.toFixed(1)} megawatts`}>
      {displayValue.toFixed(1)}
      {suffix}
    </span>
  )
}
