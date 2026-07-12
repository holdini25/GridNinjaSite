"use client"

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react"
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react"

import { buildDispatchEnvelopeGeometry } from "@/lib/dispatch-envelope/geometry"
import { buildEnvelopeSamples } from "@/lib/dispatch-envelope/normalize"
import {
  getProofLensSnapshot,
  getProofLensSnapshotAtMinute,
} from "@/lib/dispatch-envelope/proof-lens"
import {
  decisionLabel,
  dispatchDomainMeta,
  getEventMarkers,
  statusLabel,
  type DispatchDomainId,
  type DispatchScenario,
} from "@/content/copy/dispatch-envelope"
import { cn } from "@/lib/utils"

type ViewMode = "decision" | "constraints" | "evidence"
export type DispatchEnvelopeAnimationPhase =
  | "request-enter"
  | "constraints-evaluate"
  | "rta-decision"
  | "outcome-reveal"
  | "proof-write"
  | "settled"
  | "request"
  | "constraints"
  | "decision"
  | "proof"
  | "complete"

export type DispatchProofLens = {
  time: number
  visible: boolean
  pinned: boolean
}

const COLORS = {
  request: "#ff9f1a",
  accepted: "#48e89a",
  repair: "#e0b24a",
  reject: "#ff6b6b",
  proof: "#61e4ff",
  noProof: "#81909d",
  muted: "#9fb0bf",
  grid: "rgba(159,176,191,.12)",
}

const WIDTH = 860
const HEIGHT = 520
const MARGIN = { top: 54, right: 26, bottom: 58, left: 62 }
const EVENT_MARKER_PHASES = ["start", "ramp", "hold", "recovery"] as const

export function DispatchEnvelopeChart({
  scenario,
  selectedDomainId,
  mode,
  showAllConstraints,
  lens,
  replayKey,
  animationPhase = "settled",
  onLensChange,
  onLensHide,
}: {
  scenario: DispatchScenario
  selectedDomainId: DispatchDomainId
  mode: ViewMode
  showAllConstraints: boolean
  lens: DispatchProofLens
  replayKey: number
  animationPhase?: DispatchEnvelopeAnimationPhase
  onLensChange: (lens: DispatchProofLens) => void
  onLensHide: () => void
}) {
  const [activeEventMarkerIndex, setActiveEventMarkerIndex] = useState<
    number | null
  >(null)
  const eventControlRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingEventFocusIndex = useRef<number | null>(null)
  const id = useId().replace(/:/g, "")
  const hatchId = `${id}-repair-hatch`
  const gradientId = `${id}-accepted-gradient`
  const clipId = `${id}-accepted-reveal`
  const dto = scenario.dto
  const samples = useMemo(() => buildEnvelopeSamples(dto), [dto])
  const geometry = useMemo(
    () =>
      buildDispatchEnvelopeGeometry({
        samples,
        domainIds: dto.constraints.map((constraint) => constraint.id),
        dimensions: {
          width: WIDTH,
          height: HEIGHT,
          margin: MARGIN,
        },
      }),
    [dto.constraints, samples]
  )
  const selectedConstraint =
    dto.constraints.find((constraint) => constraint.id === selectedDomainId) ??
    dto.constraints[0]
  const lensTime = Math.max(
    0,
    Math.min(samples[samples.length - 1]?.minute ?? 0, lens.time)
  )
  const lensSnapshot = getProofLensSnapshotAtMinute(samples, lensTime)
  const lensX = geometry.x(lensSnapshot.minute)
  const lensY = geometry.y(
    Math.max(lensSnapshot.requestedMw, lensSnapshot.acceptedMw)
  )
  const eventMarkers = getEventMarkers(dto.accepted ?? dto.request)
  const activeEventMarker =
    activeEventMarkerIndex == null
      ? null
      : eventMarkers[activeEventMarkerIndex] ?? null
  const activeEventMarkerSnapshot = activeEventMarker
    ? getProofLensSnapshotAtMinute(samples, activeEventMarker.time)
    : null
  const activeEventX = activeEventMarker
    ? geometry.x(activeEventMarker.time)
    : MARGIN.left
  const chartTitle = `${scenario.label}: ${dto.decision.toUpperCase()} dispatch envelope`
  const chartDescription = dto.accepted
    ? `Requested ${dto.request.maxMw.toFixed(1)} MW and accepted ${dto.accepted.maxMw.toFixed(1)} MW. ${scenario.primaryReason}`
    : `Requested ${dto.request.maxMw.toFixed(1)} MW and no accepted envelope. ${scenario.primaryReason}`
  const selectedMargin = lensSnapshot.margins[selectedDomainId]
  const bindingLabel = lensSnapshot.bindingDomainId
    ? dispatchDomainMeta[lensSnapshot.bindingDomainId].short
    : "None"
  const selectedMarginLabel =
    selectedConstraint.state === "no-proof"
      ? "NO-PROOF"
      : selectedMargin == null
        ? "-"
        : formatSignedMw(selectedMargin)
  const proofState = dto.decision === "no-proof" ? "withheld" : "eligible"

  useLayoutEffect(() => {
    const index = pendingEventFocusIndex.current

    if (index == null || index !== activeEventMarkerIndex) {
      return
    }

    const target = eventControlRefs.current[index]

    if (!target) {
      return
    }

    target.focus()
    target.scrollIntoView({ block: "nearest", inline: "nearest" })
    pendingEventFocusIndex.current = null
  }, [activeEventMarkerIndex])

  function updateLensFromPointer(
    event: PointerEvent<SVGRectElement> | MouseEvent<SVGRectElement>,
    pinned = lens.pinned
  ) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0
    const pointerX = MARGIN.left + Math.min(Math.max(ratio, 0), 1) * geometry.plotWidth
    const snapshot = getProofLensSnapshot({
      samples,
      xScale: geometry.x,
      pointerX,
    })

    onLensChange({
      time: snapshot.minute,
      visible: true,
      pinned,
    })
  }

  function handleLensKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!["Escape", "Enter", " "].includes(event.key)) {
      return
    }

    event.preventDefault()

    if (event.key === "Escape") {
      onLensHide()
      return
    }

    if (event.key === "Enter" || event.key === " ") {
      onLensChange({
        time: lens.visible ? lens.time : samples[Math.floor(samples.length / 2)]?.minute ?? 0,
        visible: true,
        pinned: !lens.pinned,
      })
    }
  }

  function showEventMarker(index: number, pinned = lens.pinned) {
    const marker = eventMarkers[index]

    if (!marker) {
      return
    }

    const markerSnapshot = getProofLensSnapshotAtMinute(samples, marker.time)

    setActiveEventMarkerIndex(index)
    onLensChange({
      time: markerSnapshot.minute,
      visible: true,
      pinned,
    })
  }

  function handleEventMarkerKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape", "Enter", " "].includes(event.key)) {
      return
    }

    event.preventDefault()

    if (event.key === "Escape") {
      setActiveEventMarkerIndex(null)
      if (!lens.pinned) {
        onLensHide()
      }
      return
    }

    if (event.key === "Enter" || event.key === " ") {
      showEventMarker(index, true)
      return
    }

    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? eventMarkers.length - 1
          : event.key === "ArrowLeft"
            ? Math.max(0, index - 1)
            : Math.min(eventMarkers.length - 1, index + 1)

    pendingEventFocusIndex.current = nextIndex
    showEventMarker(nextIndex)
  }

  return (
    <div
      className={cn(
        "gn-dispatch-chart relative overflow-x-auto overflow-y-hidden rounded-[1.15rem] border border-border/70 bg-background/50",
        `gn-dispatch-decision-${dto.decision}`,
        `gn-dispatch-phase-${animationPhase}`
      )}
      data-animation-phase={animationPhase}
      data-dispatch-decision={dto.decision}
      data-proof-state={proofState}
      data-selected-domain={selectedDomainId}
      data-selected-state={selectedConstraint.state}
      data-lens-visible={lens.visible ? "true" : "false"}
      data-lens-pinned={lens.pinned ? "true" : "false"}
      data-testid="dispatch-envelope-chart"
    >
      <svg
        className="block aspect-[1.65] w-full min-w-[44rem] max-w-none text-muted-foreground sm:min-w-0"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        tabIndex={-1}
        aria-labelledby={`${id}-title ${id}-desc`}
        data-testid="dispatch-envelope-svg"
        data-animation-phase={animationPhase}
        data-dispatch-decision={dto.decision}
        data-proof-state={proofState}
      >
        <title id={`${id}-title`}>{chartTitle}</title>
        <desc id={`${id}-desc`}>{chartDescription}</desc>
        <defs>
          <pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
            patternTransform="rotate(35)"
          >
            <rect width="8" height="8" fill="rgba(224,178,74,.04)" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke={COLORS.repair}
              strokeWidth="2"
              opacity=".58"
            />
          </pattern>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={COLORS.accepted} stopOpacity=".28" />
            <stop offset="100%" stopColor={COLORS.accepted} stopOpacity=".02" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect
              key={replayKey}
              className="gn-dispatch-accepted-reveal"
              x={MARGIN.left}
              y={MARGIN.top}
              width={geometry.plotWidth}
              height={geometry.plotHeight}
            />
          </clipPath>
        </defs>

        <g aria-hidden="true">
          {geometry.yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={MARGIN.left}
                y1={geometry.y(tick)}
                x2={WIDTH - MARGIN.right}
                y2={geometry.y(tick)}
                stroke={COLORS.grid}
              />
              <text
                x={MARGIN.left - 12}
                y={geometry.y(tick) + 4}
                fill={COLORS.muted}
                fontSize="10"
                fontFamily="monospace"
                textAnchor="end"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          ))}
          {geometry.xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={geometry.x(tick)}
                y1={MARGIN.top}
                x2={geometry.x(tick)}
                y2={HEIGHT - MARGIN.bottom}
                stroke={COLORS.grid}
              />
              <text
                x={geometry.x(tick)}
                y={HEIGHT - 28}
                fill={COLORS.muted}
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                T+{Math.round(tick)}
              </text>
            </g>
          ))}
          <text
            x="18"
            y={MARGIN.top + geometry.plotHeight / 2}
            fill={COLORS.muted}
            fontSize="10"
            fontFamily="monospace"
            transform={`rotate(-90 18 ${MARGIN.top + geometry.plotHeight / 2})`}
            textAnchor="middle"
          >
            FLEXIBLE MW
          </text>
          <text
            x={MARGIN.left + geometry.plotWidth / 2}
            y={HEIGHT - 10}
            fill={COLORS.muted}
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            EVENT TIME (MINUTES)
          </text>
        </g>

        <path
          d={geometry.apertureClipPath}
          className="gn-dispatch-layer gn-dispatch-layer-constraints gn-dispatch-aperture"
          fill="rgba(97,228,255,.025)"
          stroke="rgba(97,228,255,.28)"
          strokeWidth="1.2"
          opacity={mode === "decision" ? 1 : 0.55}
          data-animation-phase={animationPhase}
          data-dispatch-state="aperture"
          data-testid="dispatch-constraint-aperture"
        />
        <text
          x={MARGIN.left + geometry.plotWidth / 2}
          y={MARGIN.top - 16}
          fill={COLORS.proof}
          fontSize="9"
          fontFamily="monospace"
          textAnchor="middle"
          letterSpacing="1.5"
        >
          CONSTRAINT APERTURE
        </text>

        <g
          className="gn-dispatch-layer gn-dispatch-layer-constraints domain-contours"
          data-testid="dispatch-domain-contours"
        >
          {dto.constraints.map((constraint) => {
            const selected = constraint.id === selectedDomainId
            const important =
              constraint.state === "binding" ||
              constraint.state === "hard-block" ||
              constraint.state === "no-proof"
            const show =
              showAllConstraints || mode === "constraints" || important || selected
            const color =
              constraint.state === "hard-block"
                ? COLORS.reject
                : constraint.state === "binding" || constraint.state === "repair"
                  ? COLORS.repair
                  : constraint.state === "no-proof"
                    ? COLORS.noProof
                    : COLORS.proof
            const opacity = selected ? 0.95 : important ? 0.68 : mode === "constraints" ? 0.28 : 0.12

            if (!show) {
              return null
            }

            if (constraint.state === "hard-block") {
              const blockX = geometry.x(scenario.blockMinute ?? 4)

              return (
                <g
                  key={constraint.id}
                  className={cn(
                    "gn-dispatch-domain gn-dispatch-hard-block-domain",
                    `gn-dispatch-state-${constraint.state}`,
                    selected && "is-selected",
                    important && "is-critical"
                  )}
                  data-dispatch-domain={constraint.id}
                  data-dispatch-state={constraint.state}
                  data-selected={selected ? "true" : "false"}
                  data-critical={important ? "true" : "false"}
                  data-testid={`dispatch-domain-${constraint.id}`}
                >
                  <line
                    x1={blockX}
                    y1={MARGIN.top}
                    x2={blockX}
                    y2={HEIGHT - MARGIN.bottom}
                    className="gn-dispatch-domain-line gn-dispatch-hard-block-line"
                    stroke={COLORS.reject}
                    strokeWidth={selected ? 4 : 3}
                    opacity={selected ? 1 : 0.85}
                    data-dispatch-domain={constraint.id}
                    data-dispatch-state={constraint.state}
                    data-testid={`dispatch-hard-block-${constraint.id}`}
                  />
                  <text
                    x={blockX + 8}
                    y={MARGIN.top + 16}
                    fill={COLORS.reject}
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    HARD BLOCK
                  </text>
                </g>
              )
            }

            if (constraint.state === "no-proof" && constraint.maxMw <= 0) {
              return (
                <rect
                  key={constraint.id}
                  className={cn(
                    "gn-dispatch-domain gn-dispatch-domain-line",
                    `gn-dispatch-state-${constraint.state}`,
                    selected && "is-selected",
                    important && "is-critical"
                  )}
                  x={MARGIN.left}
                  y={MARGIN.top}
                  width={geometry.plotWidth}
                  height={geometry.plotHeight}
                  fill="none"
                  stroke={COLORS.noProof}
                  strokeWidth="1.4"
                  strokeDasharray="6 7"
                  opacity={selected ? 0.8 : 0.42}
                  data-dispatch-domain={constraint.id}
                  data-dispatch-state={constraint.state}
                  data-selected={selected ? "true" : "false"}
                  data-critical={important ? "true" : "false"}
                  data-testid={`dispatch-domain-${constraint.id}`}
                />
              )
            }

            return (
              <g
                key={constraint.id}
                className={cn(
                  "gn-dispatch-domain",
                  `gn-dispatch-state-${constraint.state}`,
                  selected && "is-selected",
                  important && "is-critical"
                )}
                data-dispatch-domain={constraint.id}
                data-dispatch-state={constraint.state}
                data-selected={selected ? "true" : "false"}
                data-critical={important ? "true" : "false"}
              >
                {geometry.domainConfidenceAreaPaths[constraint.id] ? (
                  <path
                    d={geometry.domainConfidenceAreaPaths[constraint.id]}
                    className="gn-dispatch-domain-confidence"
                    fill={color}
                    opacity={selected || mode === "evidence" ? 0.06 : 0.018}
                    data-dispatch-domain={constraint.id}
                    data-dispatch-state={constraint.state}
                    data-testid={`dispatch-confidence-${constraint.id}`}
                  />
                ) : null}
                <path
                  d={geometry.domainLinePaths[constraint.id]}
                  className="gn-dispatch-domain-line"
                  fill="none"
                  stroke={color}
                  strokeWidth={selected ? 2.8 : important ? 1.7 : 1}
                  strokeDasharray={constraint.state === "no-proof" ? "7 7" : undefined}
                  opacity={opacity}
                  data-dispatch-domain={constraint.id}
                  data-dispatch-state={constraint.state}
                  data-selected={selected ? "true" : "false"}
                  data-critical={important ? "true" : "false"}
                  data-testid={`dispatch-domain-${constraint.id}`}
                />
              </g>
            )
          })}
        </g>

        <path
          d={geometry.requestedAreaPath}
          className="gn-dispatch-layer gn-dispatch-layer-request gn-dispatch-request-area"
          fill={COLORS.request}
          opacity={mode === "evidence" ? 0.03 : 0.035}
          data-dispatch-state="requested"
        />
        <path
          d={geometry.requestedLinePath}
          className="gn-dispatch-layer gn-dispatch-layer-request gn-dispatch-request-path"
          fill="none"
          stroke={COLORS.request}
          strokeWidth="2.2"
          strokeDasharray="8 7"
          opacity={mode === "evidence" ? 0.35 : 0.92}
          data-dispatch-state="requested"
          data-testid="dispatch-request-path"
        />
        {dto.decision === "repair" && dto.accepted ? (
          <path
            d={geometry.repairDeltaAreaPath}
            className="gn-dispatch-layer gn-dispatch-layer-decision gn-dispatch-repair-delta"
            fill={`url(#${hatchId})`}
            opacity=".9"
            data-dispatch-state="repair"
            data-dispatch-decision={dto.decision}
            data-testid="dispatch-repair-delta"
          />
        ) : null}
        {dto.accepted ? (
          <g
            className="gn-dispatch-layer gn-dispatch-layer-decision gn-dispatch-accepted-group"
            clipPath={`url(#${clipId})`}
            data-animation-phase={animationPhase}
            data-dispatch-state={dto.decision === "repair" ? "repair" : "allow"}
            data-dispatch-decision={dto.decision}
            data-testid="dispatch-accepted-group"
          >
            <path
              d={geometry.acceptedAreaPath}
              className="gn-dispatch-accepted-area"
              fill={`url(#${gradientId})`}
              data-dispatch-state={dto.decision === "repair" ? "repair" : "allow"}
            />
            <path
              d={geometry.acceptedLinePath}
              className="gn-dispatch-accepted-path"
              fill="none"
              stroke={COLORS.accepted}
              strokeWidth="3"
              data-dispatch-state={dto.decision === "repair" ? "repair" : "allow"}
              data-dispatch-decision={dto.decision}
              data-testid="dispatch-accepted-path"
            />
          </g>
        ) : null}

        {dto.decision === "reject" ? (
          <g
            className="gn-dispatch-layer gn-dispatch-layer-decision gn-dispatch-reject-marker"
            aria-hidden="true"
            data-dispatch-state="reject"
            data-dispatch-decision={dto.decision}
          >
            <circle
              cx={geometry.x(scenario.blockMinute ?? 4)}
              cy={geometry.y(dto.request.maxMw * 0.68)}
              r="9"
              fill="rgba(255,107,107,.15)"
              stroke={COLORS.reject}
              strokeWidth="2"
              data-testid="dispatch-reject-marker"
            />
            <line
              x1={geometry.x(scenario.blockMinute ?? 4) - 5}
              y1={geometry.y(dto.request.maxMw * 0.68)}
              x2={geometry.x(scenario.blockMinute ?? 4) + 5}
              y2={geometry.y(dto.request.maxMw * 0.68)}
              stroke={COLORS.reject}
              strokeWidth="2"
            />
          </g>
        ) : null}

        {dto.decision === "no-proof" ? (
          <g
            className="gn-dispatch-layer gn-dispatch-layer-decision gn-dispatch-no-proof-band"
            aria-hidden="true"
            data-dispatch-state="no-proof"
            data-dispatch-decision={dto.decision}
            data-testid="dispatch-no-proof-band"
          >
            {geometry.noProofMaskPath ? (
              <path
                d={geometry.noProofMaskPath}
                fill="rgba(129,144,157,.06)"
                stroke={COLORS.noProof}
                strokeWidth="1.4"
                strokeDasharray="5 8"
              />
            ) : null}
            <line
              x1={MARGIN.left}
              y1={geometry.y(dto.request.maxMw * 0.58)}
              x2={WIDTH - MARGIN.right}
              y2={geometry.y(dto.request.maxMw * 0.58)}
              stroke={COLORS.noProof}
              strokeWidth="2"
              strokeDasharray="4 9"
              opacity=".75"
            />
            <text
              x={MARGIN.left + geometry.plotWidth / 2}
              y={geometry.y(dto.request.maxMw * 0.58) - 11}
              fill={COLORS.noProof}
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
              letterSpacing="1.4"
            >
              EVIDENCE GAP - ACCEPTED ENVELOPE WITHHELD
            </text>
          </g>
        ) : null}

        {mode === "evidence" ? (
          <g
            className="gn-dispatch-layer gn-dispatch-layer-proof gn-dispatch-evidence-band"
            aria-hidden="true"
            data-dispatch-state={dto.decision !== "no-proof" ? "proof-eligible" : "no-proof"}
          >
            <text
              x={MARGIN.left}
              y={HEIGHT - MARGIN.bottom - 30}
              fill={COLORS.muted}
              fontSize="9"
              fontFamily="monospace"
            >
              EVIDENCE ELIGIBILITY
            </text>
            <rect
              x={MARGIN.left}
              y={HEIGHT - MARGIN.bottom - 22}
              width={geometry.plotWidth}
              height="9"
              rx="4.5"
              fill={dto.decision !== "no-proof" ? COLORS.proof : "rgba(129,144,157,.12)"}
              opacity={dto.decision !== "no-proof" ? 0.55 : 1}
              stroke={dto.decision !== "no-proof" ? undefined : COLORS.noProof}
              strokeDasharray={dto.decision !== "no-proof" ? undefined : "6 6"}
            />
            <text
              x={WIDTH - MARGIN.right}
              y={HEIGHT - MARGIN.bottom - 30}
              fill={dto.decision !== "no-proof" ? COLORS.proof : COLORS.noProof}
              fontSize="9"
              fontFamily="monospace"
              textAnchor="end"
            >
              {dto.decision !== "no-proof" ? "CURRENT / PROOF ELIGIBLE" : "STALE / NO-PROOF"}
            </text>
          </g>
        ) : null}

        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={geometry.plotWidth}
          height={geometry.plotHeight}
          fill="transparent"
          aria-hidden="true"
          className="cursor-crosshair"
          data-testid="dispatch-proof-lens-hitbox"
          onPointerMove={(event) => {
            if (!lens.pinned) {
              updateLensFromPointer(event)
            }
          }}
          onPointerLeave={() => {
            if (!lens.pinned) {
              onLensHide()
            }
          }}
          onClick={(event) => updateLensFromPointer(event, !lens.pinned)}
        />

        <g
          className="gn-dispatch-layer gn-dispatch-layer-proof"
          aria-hidden="true"
          data-testid="dispatch-event-markers"
        >
          {eventMarkers.map((marker, index) => {
            const markerX = geometry.x(marker.time)
            const markerPhase = getEventMarkerPhase(index)
            const active = index === activeEventMarkerIndex

            return (
              <g
                key={`${marker.short}-${marker.label}`}
                className={cn(
                  "gn-dispatch-event-marker",
                  `gn-dispatch-event-${markerPhase}`,
                  active && "is-active"
                )}
                data-event-index={index}
                data-event-phase={markerPhase}
                data-event-time={marker.time.toFixed(3)}
                data-active={active ? "true" : "false"}
                data-testid={`dispatch-event-marker-${index}`}
                onPointerEnter={() => showEventMarker(index)}
                onPointerLeave={(event) => {
                  if (event.currentTarget !== document.activeElement) {
                    setActiveEventMarkerIndex(null)
                    if (!lens.pinned) {
                      onLensHide()
                    }
                  }
                }}
              >
                <line
                  x1={markerX}
                  y1={MARGIN.top + 24}
                  x2={markerX}
                  y2={HEIGHT - MARGIN.bottom}
                  stroke="rgba(97,228,255,.16)"
                  strokeDasharray={index === 1 ? undefined : "3 6"}
                  className="gn-dispatch-event-marker-line"
                />
                <circle
                  cx={markerX}
                  cy={MARGIN.top + 18}
                  r="3.5"
                  fill={index === 1 ? COLORS.accepted : COLORS.proof}
                  className="gn-dispatch-event-marker-dot"
                />
                <text
                  x={markerX}
                  y={MARGIN.top + 8}
                  fill={COLORS.muted}
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="gn-dispatch-event-marker-label"
                >
                  {marker.short}
                </text>
              </g>
            )
          })}
        </g>

        <g
          className="gn-dispatch-layer gn-dispatch-layer-proof gn-dispatch-proof-lens"
          opacity={lens.visible ? 1 : 0}
          aria-hidden={!lens.visible}
          data-lens-visible={lens.visible ? "true" : "false"}
          data-lens-pinned={lens.pinned ? "true" : "false"}
        >
          <line
            x1={lensX}
            y1={MARGIN.top}
            x2={lensX}
            y2={HEIGHT - MARGIN.bottom}
            stroke={COLORS.proof}
            strokeWidth="1.2"
            opacity=".8"
            className="gn-dispatch-proof-lens-line"
            data-testid="dispatch-proof-lens-line"
          />
          <circle
            cx={lensX}
            cy={geometry.y(lensSnapshot.requestedMw)}
            r="5"
            fill={COLORS.request}
            stroke="#071016"
            strokeWidth="2"
          />
          {dto.accepted ? (
            <circle
              cx={lensX}
              cy={geometry.y(lensSnapshot.acceptedMw)}
              r="5"
              fill={COLORS.accepted}
              stroke="#071016"
              strokeWidth="2"
            />
          ) : null}
        </g>
      </svg>
      <div className="border-t border-border/70 bg-background/70 p-4">
        <label htmlFor={`${id}-proof-lens`} className="font-mono text-xs text-foreground">Inspect event minute</label>
        <input
          id={`${id}-proof-lens`}
          type="range"
          min={samples[0]?.minute ?? 0}
          max={samples.at(-1)?.minute ?? 0}
          step={(samples[1]?.minute ?? 1) - (samples[0]?.minute ?? 0)}
          value={lensTime}
          aria-describedby={`${id}-lens-status`}
          aria-valuetext={`T plus ${lensSnapshot.minute.toFixed(1)} minutes`}
          className="mt-3 min-h-11 w-full accent-primary"
          data-testid="dispatch-proof-lens-range"
          onChange={(event) => onLensChange({ time: Number(event.currentTarget.value), visible: true, pinned: lens.pinned })}
          onKeyDown={handleLensKeyDown}
        />
        <p id={`${id}-lens-status`} className="mt-2 text-xs leading-6 text-muted-foreground" aria-live="polite">
          T+{lensSnapshot.minute.toFixed(1)}; requested {lensSnapshot.requestedMw.toFixed(1)} MW; accepted {lensSnapshot.acceptedMw.toFixed(1)} MW; binding domain {bindingLabel}; proof {lensSnapshot.proofEligible ? "eligible" : "withheld"}; {lens.pinned ? "pinned" : "not pinned"}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Dispatch event markers">
          {eventMarkers.map((marker, index) => (
            <button
              key={`${marker.short}-${marker.label}-control`}
              ref={(element) => {
                eventControlRefs.current[index] = element
              }}
              type="button"
              className="min-h-11 rounded-lg border border-border/70 px-3 py-2 text-xs text-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
              data-testid={`dispatch-event-control-${index}`}
              onFocus={() => showEventMarker(index)}
              onClick={() => showEventMarker(index, true)}
              onKeyDown={(event) => handleEventMarkerKeyDown(event, index)}
            >
              {marker.label} ({marker.short})
            </button>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 rounded-full border border-border/70 bg-background/70 px-3 py-1 font-mono text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase">
        illustrative scenario
      </div>

      <div
        id={`${id}-event-inspector`}
        className={cn(
          "pointer-events-none absolute z-10 w-[min(15rem,calc(100%-1rem))] rounded-[0.85rem] border border-border/70 bg-background/95 p-3 shadow-2xl",
          !activeEventMarker && "hidden"
        )}
        style={{
          left: `${Math.min(Math.max((activeEventX / WIDTH) * 100, 3), 72)}%`,
          top: `${Math.min(Math.max(((MARGIN.top + 42) / HEIGHT) * 100, 10), 54)}%`,
        }}
        data-event-index={activeEventMarkerIndex ?? undefined}
        data-event-phase={
          activeEventMarkerIndex == null
            ? undefined
            : getEventMarkerPhase(activeEventMarkerIndex)
        }
        data-testid="dispatch-event-marker-inspector"
      >
        {activeEventMarker && activeEventMarkerSnapshot ? (
          <>
            <h4 className="font-mono text-[0.68rem] tracking-[0.16em] text-proof-cyan uppercase">
              {activeEventMarker.short} - {activeEventMarker.label}
            </h4>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[0.7rem]">
              <dt className="text-muted-foreground">Requested</dt>
              <dd className="text-right text-primary">
                {activeEventMarkerSnapshot.requestedMw.toFixed(2)} MW
              </dd>
              <dt className="text-muted-foreground">Accepted</dt>
              <dd className="text-right text-signal">
                {dto.accepted
                  ? `${activeEventMarkerSnapshot.acceptedMw.toFixed(2)} MW`
                  : "-"}
              </dd>
              <dt className="text-muted-foreground">Binding</dt>
              <dd className="text-right text-foreground">
                {activeEventMarkerSnapshot.bindingDomainId
                  ? dispatchDomainMeta[activeEventMarkerSnapshot.bindingDomainId].short
                  : "None"}
              </dd>
              <dt className="text-muted-foreground">Proof</dt>
              <dd className="text-right text-foreground">
                {activeEventMarkerSnapshot.proofEligible ? "Eligible" : "No-proof"}
              </dd>
            </dl>
          </>
        ) : null}
      </div>

      <div
        className={cn(
          "pointer-events-none absolute z-10 w-[min(18rem,calc(100%-1rem))] rounded-[0.9rem] border border-proof-cyan/35 bg-background/95 p-3 shadow-2xl",
          !lens.visible && "hidden"
        )}
        style={{
          left: `${Math.min(Math.max((lensX / WIDTH) * 100, 3), 70)}%`,
          top: `${Math.min(Math.max((lensY / HEIGHT) * 100, 8), 62)}%`,
        }}
        data-proof-state={lensSnapshot.proofEligible ? "eligible" : "no-proof"}
        data-selected-domain={selectedDomainId}
        data-testid="dispatch-proof-lens-card"
      >
        <h4 className="font-mono text-[0.68rem] tracking-[0.16em] text-proof-cyan uppercase">
          T+{lensSnapshot.minute.toFixed(1)} min - proof lens
        </h4>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[0.72rem]">
          <dt className="text-muted-foreground">Requested</dt>
          <dd className="text-right text-primary">
            {lensSnapshot.requestedMw.toFixed(2)} MW
          </dd>
          <dt className="text-muted-foreground">Accepted</dt>
          <dd className="text-right text-signal">
            {dto.accepted ? `${lensSnapshot.acceptedMw.toFixed(2)} MW` : "-"}
          </dd>
          <dt className="text-muted-foreground">Repair delta</dt>
          <dd className="text-right text-warning">
            {lensSnapshot.repairDeltaMw.toFixed(2)} MW
          </dd>
          <dt className="text-muted-foreground">
            {dispatchDomainMeta[selectedDomainId].short} margin
          </dt>
          <dd className="text-right text-foreground">
            {selectedMarginLabel}
          </dd>
          <dt className="text-muted-foreground">Binding</dt>
          <dd className="text-right text-foreground">{bindingLabel}</dd>
          <dt className="text-muted-foreground">Telemetry age</dt>
          <dd className="text-right text-foreground">
            {selectedConstraint.telemetryAgeMs ?? "-"} ms
          </dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="text-right text-foreground">
            {statusLabel(selectedConstraint.state)}
          </dd>
          <dt className="text-muted-foreground">Proof</dt>
          <dd className="text-right text-foreground">
            {lensSnapshot.proofEligible ? "Eligible" : "No-proof"}
          </dd>
          <dt className="text-muted-foreground">Decision</dt>
          <dd className="text-right text-foreground">
            {decisionLabel(dto.decision)}
          </dd>
          <dt className="text-muted-foreground">Evidence</dt>
          <dd className="text-right text-foreground">
            {selectedConstraint.evidenceArtifact}
          </dd>
          <dt className="text-muted-foreground">Reason code</dt>
          <dd className="text-right text-foreground">
            {selectedConstraint.reasonCode}
          </dd>
          <dt className="text-muted-foreground">Proof root</dt>
          <dd className="text-right text-foreground">{compactHash(dto.proofRoot)}</dd>
        </dl>
      </div>
    </div>
  )
}

function getEventMarkerPhase(index: number) {
  return EVENT_MARKER_PHASES[index] ?? "event"
}

function formatSignedMw(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)} MW`
}

function compactHash(value: string) {
  return value.length <= 16 ? value : `${value.slice(0, 7)}...${value.slice(-6)}`
}
