"use client"

import { lazy, Suspense, useEffect, useRef, useState } from "react"

import type { StatItem } from "@/types/site"

const KpiPreview = lazy(
  () =>
    import("@/components/marketing/kpi-preview").then(
      (module) => ({ default: module.KpiPreview })
    )
)

export function DeferredKpiPreview({
  cards,
  eventLog,
}: {
  cards: StatItem[]
  eventLog: string[]
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setIsNearViewport(true))
      return () => cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setIsNearViewport(true)
        observer.disconnect()
      },
      { rootMargin: "500px 0px" }
    )

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef}>
      {isNearViewport ? (
        <Suspense fallback={<KpiTextEquivalent cards={cards} />}>
          <KpiPreview cards={cards} eventLog={eventLog} />
        </Suspense>
      ) : (
        <KpiTextEquivalent cards={cards} />
      )}
    </div>
  )
}

function KpiTextEquivalent({ cards }: { cards: StatItem[] }) {
  return (
    <div className="gn-panel px-6 py-7" aria-label="KPI visualization text equivalent">
      <p className="gn-eyebrow">Runtime-assured operating view</p>
      <h3 className="mt-3 text-2xl font-medium text-foreground">
        The KPI surface connects capacity state to operator decisions
      </h3>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <li key={card.label} className="border-l border-border/80 pl-4">
            <span className="font-medium text-foreground">{card.label}</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              {card.body}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
