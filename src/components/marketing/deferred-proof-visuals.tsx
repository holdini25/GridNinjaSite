"use client"

import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

const DataCenterXrayHD = lazy(
  () =>
    import("@/components/marketing/data-center-xray-hd").then(
      (module) => ({ default: module.DataCenterXrayHD })
    )
)
const LoadPassportHD = lazy(
  () =>
    import("@/components/marketing/load-passport-hd").then(
      (module) => ({ default: module.LoadPassportHD })
    )
)
const RtaDecisionTheater = lazy(
  () =>
    import("@/components/marketing/rta-decision-theater").then(
      (module) => ({ default: module.RtaDecisionTheater })
    )
)
const FleetOSTimeTravelMap = lazy(
  () =>
    import("@/components/marketing/fleetos-time-travel-map").then(
      (module) => ({ default: module.FleetOSTimeTravelMap })
    )
)

export function DeferredDataCenterXrayHD() {
  return (
    <NearViewportIsland fallback={<XrayTextEquivalent />}>
      <DataCenterXrayHD />
    </NearViewportIsland>
  )
}

export function DeferredLoadPassportHD() {
  return (
    <NearViewportIsland fallback={<LoadPassportTextEquivalent />}>
      <LoadPassportHD />
    </NearViewportIsland>
  )
}

export function DeferredRtaDecisionTheater({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <NearViewportIsland fallback={<RtaTextEquivalent compact={compact} />}>
      <RtaDecisionTheater compact={compact} />
    </NearViewportIsland>
  )
}

export function DeferredFleetOSTimeTravelMap() {
  return (
    <NearViewportIsland fallback={<FleetTextEquivalent />}>
      <FleetOSTimeTravelMap />
    </NearViewportIsland>
  )
}

function NearViewportIsland({
  children,
  fallback,
}: {
  children: ReactNode
  fallback: ReactNode
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
      { rootMargin: "100px 0px" }
    )

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef}>
      {isNearViewport ? (
        <Suspense fallback={fallback}>{children}</Suspense>
      ) : (
        fallback
      )}
    </div>
  )
}

function XrayTextEquivalent() {
  return (
    <DeferredPanel
      eyebrow="Infrastructure X-Ray"
      title="Physical constraints become digital proof objects."
      body="GridNinja evaluates power, cooling, storage, workload, policy, and telemetry trust as inspectable layers before authority can expand."
      items={["Power and reserve limits", "Thermal and water limits", "Workload and SLA limits", "Telemetry trust and policy"]}
    />
  )
}

function LoadPassportTextEquivalent() {
  return (
    <DeferredPanel
      eyebrow="AI Data Center Load Passport"
      title="One inspectable identity for proof-adjusted capacity."
      body="The Load Passport binds accepted capacity to ramp limits, reserve floors, freshness, no-proof gaps, and accepted-headroom evidence."
      items={["Declared operating policy", "Binding constraints and margins", "Evidence-chain status", "Versioned proof root"]}
    />
  )
}

function RtaTextEquivalent({ compact }: { compact: boolean }) {
  return (
    <DeferredPanel
      eyebrow="Runtime Assurance"
      title="Every candidate resolves to allow, repair, reject, or no-proof."
      body="Deterministic verification checks the active dispatch envelope before a receipt and replayable proof record are produced."
      items={compact ? ["Proposal", "RTA decision", "Proof receipt"] : ["Proposal", "Solver", "Runtime assurance", "Receipt", "Replay", "Proof"]}
    />
  )
}

function FleetTextEquivalent() {
  return (
    <DeferredPanel
      eyebrow="Fleet evidence"
      title="Fleet comparison without fleet-side actuation authority."
      body="FleetOS aggregates signed site envelopes, proof roots, accepted headroom, and no-proof gaps while local policy remains the authority boundary."
      items={["Signed site envelopes", "Accepted-headroom ledgers", "No-proof registers", "Local authority preserved"]}
    />
  )
}

function DeferredPanel({
  eyebrow,
  title,
  body,
  items,
}: {
  eyebrow: string
  title: string
  body: string
  items: string[]
}) {
  return (
    <section className="gn-hd-panel p-6" aria-label={`${eyebrow} text equivalent`}>
      <p className="gn-eyebrow">{eyebrow}</p>
      <h3 className="mt-3 max-w-3xl text-[2rem] font-medium text-foreground">
        {title}
      </h3>
      <p className="mt-3 max-w-2xl text-base leading-8 text-muted-foreground">
        {body}
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="border-l border-border/80 pl-4 text-sm leading-6 text-muted-foreground">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}
