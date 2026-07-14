"use client"

import { useEffect, useRef, useState } from "react"

export function AnimatedMw({
  value,
  className,
  suffix = " MW",
}: {
  value: number
  className?: string
  suffix?: string
}) {
  const previousValue = useRef(value)
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    const from = previousValue.current
    previousValue.current = value
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

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
      const progress = Math.min((now - startedAt) / 720, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(from + (value - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return (
    <span className={className} aria-label={`${value.toFixed(1)} megawatts`}>
      {displayValue.toFixed(1)}
      {suffix}
    </span>
  )
}
