"use client"

import { type PointerEvent, useId, useLayoutEffect, useRef } from "react"

import styles from "./animated-gridninja-mark.module.css"

export type GridNinjaLogoMotion = "micro-response" | "guardian-wake"

type AnimatedGridNinjaMarkProps = {
  variant: GridNinjaLogoMotion
  reveal?: "none" | "once"
  className?: string
}

type MarkIds = {
  copper: string
  armor: string
  saya: string
  clip: string
  guardian: string
  katana: string
}

const FINE_POINTER_QUERY = "(pointer: fine)"
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
const MAX_TILT_DEGREES = 2
const MIN_TILT_SIZE = 72
const REVEAL_THRESHOLD = 0.3
const REVEAL_SETTLE_MS = 750

type RevealStage = "settled" | "armed" | "revealed"

export function AnimatedGridNinjaMark({
  variant,
  reveal = "none",
  className,
}: AnimatedGridNinjaMarkProps) {
  if (variant === "micro-response") {
    return <MicroResponseMark className={className} />
  }

  return <GuardianWakeMark reveal={reveal} className={className} />
}

function MicroResponseMark({ className }: { className?: string }) {
  const ids = useMarkIds()

  return (
    <span
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-logo-motion="micro-response"
      data-logo-reveal="none"
      data-logo-revealed="true"
      data-logo-reveal-stage="settled"
    >
      <MicroMark ids={ids} />
    </span>
  )
}

function GuardianWakeMark({
  reveal,
  className,
}: {
  reveal: "none" | "once"
  className?: string
}) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const reducedMotionRef = useRef(false)
  const ids = useMarkIds()
  const shouldReveal = reveal === "once"

  useLayoutEffect(() => {
    const root = rootRef.current

    if (!root) {
      return
    }

    let observer: IntersectionObserver | undefined
    let revealTimer: number | undefined
    const reducedMotionQuery = getMediaQueryList(REDUCED_MOTION_QUERY)

    const resetTilt = () => {
      root.style.setProperty("--gridninja-tilt-x", "0deg")
      root.style.setProperty("--gridninja-tilt-y", "0deg")
    }
    const stopObserver = () => {
      observer?.disconnect()
      observer = undefined
    }
    const stopRevealTimer = () => {
      if (revealTimer !== undefined) {
        window.clearTimeout(revealTimer)
        revealTimer = undefined
      }
    }
    const settleWithoutMotion = () => {
      stopObserver()
      stopRevealTimer()
      resetTilt()
      setElementRevealStage(root, "settled")
    }
    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches

      if (event.matches) {
        settleWithoutMotion()
      }
    }
    const resetWhenHidden = () => {
      if (document.hidden) {
        resetTilt()
      }
    }

    reducedMotionRef.current = reducedMotionQuery?.matches ?? false
    addMediaQueryChangeListener(reducedMotionQuery, handleReducedMotionChange)
    document.addEventListener("visibilitychange", resetWhenHidden)

    if (
      shouldReveal &&
      !reducedMotionRef.current &&
      !isElementInViewport(root) &&
      typeof IntersectionObserver === "function"
    ) {
      setElementRevealStage(root, "armed")
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            stopObserver()
            setElementRevealStage(root, "revealed")
            revealTimer = window.setTimeout(() => {
              revealTimer = undefined
              setElementRevealStage(root, "settled")
            }, REVEAL_SETTLE_MS)
          }
        },
        { threshold: REVEAL_THRESHOLD }
      )
      observer.observe(root)
    } else {
      setElementRevealStage(root, "settled")
    }

    return () => {
      stopObserver()
      stopRevealTimer()
      removeMediaQueryChangeListener(
        reducedMotionQuery,
        handleReducedMotionChange
      )
      document.removeEventListener("visibilitychange", resetWhenHidden)
      resetTilt()
    }
  }, [shouldReveal])

  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const root = event.currentTarget
    const finePointerQuery = getMediaQueryList(FINE_POINTER_QUERY)

    if (!finePointerQuery?.matches || reducedMotionRef.current) {
      resetElementTilt(root)
      return
    }

    const bounds = root.getBoundingClientRect()

    if (bounds.width < MIN_TILT_SIZE || bounds.height < MIN_TILT_SIZE) {
      resetElementTilt(root)
      return
    }

    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5

    root.style.setProperty(
      "--gridninja-tilt-x",
      `${clamp(-vertical * MAX_TILT_DEGREES * 2)}deg`
    )
    root.style.setProperty(
      "--gridninja-tilt-y",
      `${clamp(horizontal * MAX_TILT_DEGREES * 2)}deg`
    )
  }

  const resetTilt = (event: PointerEvent<HTMLSpanElement>) => {
    resetElementTilt(event.currentTarget)
  }

  return (
    <span
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-logo-motion="guardian-wake"
      data-logo-reveal={shouldReveal ? "once" : "none"}
      data-logo-revealed="true"
      data-logo-reveal-stage="settled"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onPointerCancel={resetTilt}
    >
      <CeremonialMark ids={ids} />
    </span>
  )
}

function setElementRevealStage(root: HTMLElement, stage: RevealStage) {
  root.dataset.logoRevealStage = stage
  root.dataset.logoRevealed = stage === "armed" ? "false" : "true"
}

function useMarkIds(): MarkIds {
  const generatedId = useId().replace(/:/g, "")

  return {
    copper: `${generatedId}-copper`,
    armor: `${generatedId}-armor`,
    saya: `${generatedId}-saya`,
    clip: `${generatedId}-globe-clip`,
    guardian: `${generatedId}-guardian`,
    katana: `${generatedId}-sheathed-katana`,
  }
}

function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }

  try {
    return window.matchMedia(query)
  } catch {
    return null
  }
}

function addMediaQueryChangeListener(
  media: MediaQueryList | null,
  listener: (event: MediaQueryListEvent) => void
) {
  if (!media) {
    return
  }

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener)
  } else if (typeof media.addListener === "function") {
    media.addListener(listener)
  }
}

function removeMediaQueryChangeListener(
  media: MediaQueryList | null,
  listener: (event: MediaQueryListEvent) => void
) {
  if (!media) {
    return
  }

  if (typeof media.removeEventListener === "function") {
    media.removeEventListener("change", listener)
  } else if (typeof media.removeListener === "function") {
    media.removeListener(listener)
  }
}

function isElementInViewport(element: HTMLElement) {
  const bounds = element.getBoundingClientRect()

  return (
    bounds.bottom > 0 &&
    bounds.right > 0 &&
    bounds.top < window.innerHeight &&
    bounds.left < window.innerWidth
  )
}

function resetElementTilt(element: HTMLElement) {
  element.style.setProperty("--gridninja-tilt-x", "0deg")
  element.style.setProperty("--gridninja-tilt-y", "0deg")
}

function clamp(value: number) {
  return Math.max(-MAX_TILT_DEGREES, Math.min(MAX_TILT_DEGREES, value))
}

function MicroMark({ ids }: { ids: MarkIds }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
      className={styles.mark}
    >
      <defs>
        <linearGradient id={ids.copper} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF9A2E" />
          <stop offset=".55" stopColor="#F58220" />
          <stop offset="1" stopColor="#C9570A" />
        </linearGradient>
        <g id={ids.guardian}>
          <path d="M204.5 165 271 195.5 275 205.5 188.5 249 141 269 142 266.5 142 259.5 143 258.5 150 203.5 151 198.5 153.5 196Z" />
          <path d="M282.5 216Q285.1 215.2 284 218.5L283 219.5 279 250.5 275.5 254 245 273.5 247.5 274 273.5 263 274 269.5 272 275.5 269 298.5 266.5 301 178.5 360 153 330.5 217 281.5 223 252.5 225.5 247Z" />
          <path d="M179.5 266 180 274.5 179 275.5 179 285.5 176.5 290 145.5 312 145 280Z" />
        </g>
      </defs>

      <g
        fill="none"
        stroke={`url(#${ids.copper})`}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-part="globe-grid"
      >
        <circle cx="128" cy="128" r="100" />
        <path d="M128 28v67M128 161v67" strokeWidth="5" />
      </g>
      <g
        transform="translate(128 128) scale(.45) translate(-345 -290)"
        fill="#F7FAFC"
        stroke="#07182B"
        strokeWidth="4"
        strokeLinejoin="round"
      >
        <g data-part="guardian-left">
          <use href={`#${ids.guardian}`} />
        </g>
        <g data-part="guardian-right">
          <use
            href={`#${ids.guardian}`}
            transform="translate(690 0) scale(-1 1)"
          />
        </g>
      </g>
      <path
        d="M128 94c4 18 10 28 29 34-19 6-25 16-29 34-4-18-10-28-29-34 19-6 25-16 29-34Z"
        fill={`url(#${ids.copper})`}
        data-part="proof-glow"
      />
      <path
        d="M128 94c4 18 10 28 29 34-19 6-25 16-29 34-4-18-10-28-29-34 19-6 25-16 29-34Z"
        fill={`url(#${ids.copper})`}
        data-part="proof-core"
      />
      <circle
        cx="128"
        cy="128"
        r="100"
        pathLength="1"
        fill="none"
        stroke="#FF9A2E"
        strokeWidth="5"
        strokeLinecap="round"
        data-part="proof-sweep"
      />
    </svg>
  )
}

function CeremonialMark({ ids }: { ids: MarkIds }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 560"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
      className={styles.mark}
    >
      <defs>
        <linearGradient id={ids.copper} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF9A2E" />
          <stop offset="0.52" stopColor="#F58220" />
          <stop offset="1" stopColor="#C9570A" />
        </linearGradient>
        <linearGradient id={ids.armor} x1="0" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".7" stopColor="#F1F5F9" />
          <stop offset="1" stopColor="#D7E0E8" />
        </linearGradient>
        <linearGradient id={ids.saya} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#20364A" />
          <stop offset=".48" stopColor="#102438" />
          <stop offset="1" stopColor="#071522" />
        </linearGradient>
        <clipPath id={ids.clip}>
          <circle cx="320" cy="274" r="216" />
        </clipPath>
        <g id={ids.guardian}>
          <path d="M204.5 165 271 195.5 275 205.5 188.5 249 141 269 142 266.5 142 259.5 143 258.5 150 203.5 151 198.5 153.5 196Z" />
          <path d="M282.5 216Q285.1 215.2 284 218.5L283 219.5 279 250.5 275.5 254 245 273.5 247.5 274 273.5 263 274 269.5 272 275.5 269 298.5 266.5 301 178.5 360 153 330.5 217 281.5 223 252.5 225.5 247Z" />
          <path d="M179.5 266 180 274.5 179 275.5 179 285.5 176.5 290 145.5 312 145 280Z" />
          <path d="M259.5 333 262 333.5 262 342.5 263 343.5 263 351 206.5 378 202 382.5 185 411 123.5 443 118 436.5 118 434.5 152.5 387Z" />
          <path d="M264.5 358Q267.8 356.9 267 359.5L295 417.5 236.5 460 218.5 429 201 417.5 220.5 382Z" />
          <path d="M189.5 428 208 439.5 223 468.5 170.5 507 138 461.5Z" />
        </g>
        <g id={ids.katana} strokeLinejoin="round">
          <path
            d="M104 400 119 386 294 533Q301 539 295 547L287 555Q281 561 274 555L98 414Z"
            fill={`url(#${ids.saya})`}
            stroke={`url(#${ids.copper})`}
            strokeWidth="4"
          />
          <path
            d="M116 398 287 544"
            fill="none"
            stroke="#39536A"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".68"
          />
          <path
            d="m276 553 17-20 13 11-18 20Z"
            fill={`url(#${ids.armor})`}
            stroke="#07182B"
            strokeWidth="3"
          />
          <path
            d="m97 383 15-10 23 21-18 25-25-22Z"
            fill={`url(#${ids.armor})`}
            stroke="#07182B"
            strokeWidth="4"
          />
          <path
            d="m102 386 22 20"
            fill="none"
            stroke={`url(#${ids.copper})`}
            strokeWidth="5"
          />
          <path
            d="m72 389 8 9 38-38-9-8Z"
            fill={`url(#${ids.armor})`}
            stroke="#07182B"
            strokeWidth="3"
          />
          <path
            d="m82 382 10 10"
            fill="none"
            stroke="#B9C4CE"
            strokeWidth="3"
          />
          <path
            d="m49 339 11-11 43 43-11 12Z"
            fill={`url(#${ids.copper})`}
            stroke="#07182B"
            strokeWidth="3"
          />
          <path
            d="m58 338-8 8m17 1-8 8m17 1-8 8m17 1-8 8m17 1-8 8"
            fill="none"
            stroke="#07182B"
            strokeWidth="4"
          />
          <path
            d="m46 316 15 13-17 18-14-14Z"
            fill={`url(#${ids.armor})`}
            stroke="#07182B"
            strokeWidth="3"
          />
          <path
            d="m38 325 15 14"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3"
            opacity=".7"
          />
        </g>
      </defs>

      <g transform="translate(320 274) scale(.88) translate(-345 -312)">
        <g data-part="hilt-left">
          <use
            href={`#${ids.katana}`}
            transform="rotate(180 168 440)"
          />
        </g>
        <g data-part="hilt-right">
          <use
            href={`#${ids.katana}`}
            transform="translate(690 0) scale(-1 1) rotate(180 168 440)"
          />
        </g>
      </g>

      <g
        clipPath={`url(#${ids.clip})`}
        fill="none"
        stroke={`url(#${ids.copper})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-part="globe-grid"
      >
        <circle cx="320" cy="274" r="216" strokeWidth="12" pathLength="1" />
        <path d="M320 58v432" strokeWidth="8" pathLength="1" />
        <path
          d="M227 80c-43 49-66 116-66 194s23 145 66 194M413 80c43 49 66 116 66 194s-23 145-66 194"
          strokeWidth="8"
          pathLength="1"
        />
        <path
          d="M133 167c54-18 117-27 187-27s133 9 187 27M133 381c54 18 117 27 187 27s133-9 187-27"
          strokeWidth="8"
          pathLength="1"
        />
      </g>

      <g
        transform="translate(320 274) scale(.88) translate(-345 -312)"
        fill={`url(#${ids.armor})`}
        stroke="#07182B"
        strokeWidth="3"
        strokeLinejoin="round"
      >
        <g data-part="guardian-left">
          <use href={`#${ids.guardian}`} />
        </g>
        <g data-part="guardian-right">
          <use
            href={`#${ids.guardian}`}
            transform="translate(690 0) scale(-1 1)"
          />
        </g>
      </g>
      <path
        d="M320 207c8 37 20 57 58 67-38 10-50 30-58 67-8-37-20-57-58-67 38-10 50-30 58-67Z"
        fill={`url(#${ids.copper})`}
        data-part="proof-glow"
      />
      <path
        d="M320 207c8 37 20 57 58 67-38 10-50 30-58 67-8-37-20-57-58-67 38-10 50-30 58-67Z"
        fill={`url(#${ids.copper})`}
        data-part="proof-core"
      />
      <circle
        cx="320"
        cy="274"
        r="216"
        pathLength="1"
        fill="none"
        stroke="#FF9A2E"
        strokeWidth="5"
        strokeLinecap="round"
        data-part="proof-sweep"
      />
    </svg>
  )
}
