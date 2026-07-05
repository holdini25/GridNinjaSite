"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import {
  dispatchScenarios,
  getInitialConstraintId,
  getScenarioById,
  type DispatchDomainId,
  type DispatchScenario,
} from "@/content/copy/dispatch-envelope"
import { emitDispatchEnvelopeEvent } from "@/lib/dispatch-envelope/analytics"

export type DispatchViewMode = "decision" | "constraints" | "evidence"

export type DispatchAnimationPhase =
  | "request-enter"
  | "constraints-evaluate"
  | "rta-decision"
  | "outcome-reveal"
  | "proof-write"
  | "settled"

export type DispatchProofLens = {
  time: number
  visible: boolean
  pinned: boolean
}

export const dispatchViewModes: Array<{ id: DispatchViewMode; label: string }> = [
  { id: "decision", label: "Decision" },
  { id: "constraints", label: "Constraints" },
  { id: "evidence", label: "Evidence" },
]

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

export function useDispatchEnvelopeState({
  initialScenarioId,
}: {
  initialScenarioId?: string
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const initialScenario = getScenarioById(initialScenarioId) ?? dispatchScenarios[0]
  const initialDomainId = getInitialDomainId(initialScenario)
  const [scenarioId, setScenarioId] = useState(initialScenario.id)
  const [selectedDomainId, setSelectedDomainId] =
    useState<DispatchDomainId>(initialDomainId)
  const [mode, setModeState] = useState<DispatchViewMode>("decision")
  const [showAllConstraints, setShowAllConstraints] = useState(false)
  const [tableExpanded, setTableExpandedState] = useState(false)
  const [proofOpen, setProofOpen] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [animationPhase, setAnimationPhase] = useState<DispatchAnimationPhase>(
    () => (prefersReducedMotion ? "settled" : "request-enter")
  )
  const [lens, setLensState] = useState<DispatchProofLens>({
    time: 0,
    visible: false,
    pinned: false,
  })
  const evidenceTriggerRef = useRef<HTMLElement | null>(null)
  const viewedRef = useRef(false)

  const activeScenario = getScenarioById(scenarioId) ?? dispatchScenarios[0]

  const eventContext = useCallback(
    (
      scenario: DispatchScenario = activeScenario,
      domainId: DispatchDomainId = selectedDomainId,
      viewMode: DispatchViewMode = mode
    ) => ({
      scenarioId: scenario.id,
      decision: scenario.dto.decision,
      selectedDomainId: domainId,
      viewMode,
      evidenceClass: scenario.dto.evidenceClass,
      requestedMw: scenario.dto.request.maxMw,
      acceptedMw: scenario.dto.accepted?.maxMw ?? null,
    }),
    [activeScenario, mode, selectedDomainId]
  )

  useEffect(() => {
    if (viewedRef.current) {
      return
    }

    viewedRef.current = true
    emitDispatchEnvelopeEvent({
      name: "dispatch_visual_view",
      ...eventContext(),
    })
  }, [eventContext])

  useEffect(() => {
    if (prefersReducedMotion) {
      return
    }

    const timers = [
      window.setTimeout(() => setAnimationPhase("constraints-evaluate"), 210),
      window.setTimeout(() => setAnimationPhase("rta-decision"), 430),
      window.setTimeout(() => setAnimationPhase("outcome-reveal"), 650),
      window.setTimeout(() => setAnimationPhase("proof-write"), 1120),
      window.setTimeout(() => setAnimationPhase("settled"), 1780),
    ]

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [prefersReducedMotion, replayKey, scenarioId])

  function selectScenario(id: string, updateUrl = true) {
    const nextScenario = getScenarioById(id)

    if (!nextScenario) {
      return
    }

    const nextDomainId = getInitialConstraintId(nextScenario)

    setScenarioId(id)
    setSelectedDomainId(nextDomainId)
    setLensState({ time: 0, visible: false, pinned: false })
    setAnimationPhase(prefersReducedMotion ? "settled" : "request-enter")
    setReplayKey((key) => key + 1)

    if (updateUrl) {
      updateDispatchUrl(id, nextDomainId)
    }

    emitDispatchEnvelopeEvent({
      name: "dispatch_scenario_select",
      ...eventContext(nextScenario, nextDomainId),
    })
  }

  function selectConstraint(domainId: DispatchDomainId, updateUrl = true) {
    setSelectedDomainId(domainId)

    if (updateUrl) {
      updateDispatchUrl(activeScenario.id, domainId)
    }

    emitDispatchEnvelopeEvent({
      name: "dispatch_constraint_select",
      ...eventContext(activeScenario, domainId),
    })
  }

  function setMode(mode: DispatchViewMode) {
    setModeState(mode)
    emitDispatchEnvelopeEvent({
      name: "dispatch_mode_change",
      ...eventContext(activeScenario, selectedDomainId, mode),
    })
  }

  function setLens(nextLens: DispatchProofLens) {
    if (nextLens.pinned && !lens.pinned) {
      emitDispatchEnvelopeEvent({
        name: "dispatch_proof_lens_pin",
        minute: nextLens.time,
        ...eventContext(),
      })
    }

    setLensState(nextLens)
  }

  function hideLens() {
    setLensState((current) => ({ ...current, visible: false, pinned: false }))
  }

  function replayTrace() {
    setAnimationPhase(prefersReducedMotion ? "settled" : "request-enter")
    setReplayKey((key) => key + 1)
  }

  function setTableExpanded(expanded: boolean) {
    setTableExpandedState(expanded)

    if (expanded) {
      emitDispatchEnvelopeEvent({
        name: "dispatch_table_open",
        ...eventContext(),
      })
    }
  }

  function openEvidence(trigger?: HTMLElement | null) {
    evidenceTriggerRef.current = trigger ?? null
    setProofOpen(true)
    emitDispatchEnvelopeEvent({
      name: "dispatch_evidence_drawer_open",
      ...eventContext(),
    })
  }

  function setEvidenceOpen(open: boolean) {
    setProofOpen(open)

    if (!open) {
      window.setTimeout(() => evidenceTriggerRef.current?.focus(), 0)
    }
  }

  function copyProofRoot() {
    emitDispatchEnvelopeEvent({
      name: "dispatch_copy_proof_root",
      ...eventContext(),
    })
  }

  return {
    activeScenario,
    animationPhase: prefersReducedMotion ? "settled" : animationPhase,
    lens,
    mode,
    proofOpen,
    replayKey,
    selectedDomainId,
    showAllConstraints,
    tableExpanded,
    copyProofRoot,
    hideLens,
    openEvidence,
    replayTrace,
    selectConstraint,
    selectScenario,
    setEvidenceOpen,
    setLens,
    setMode,
    setShowAllConstraints,
    setTableExpanded,
  }
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  )
}

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined" || !("matchMedia" in window)) {
    return () => {}
  }

  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)

  mediaQuery.addEventListener("change", onStoreChange)

  return () => mediaQuery.removeEventListener("change", onStoreChange)
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined" || !("matchMedia" in window)) {
    return false
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getReducedMotionServerSnapshot() {
  return false
}

function getInitialDomainId(scenario: DispatchScenario): DispatchDomainId {
  if (typeof window === "undefined") {
    return getInitialConstraintId(scenario)
  }

  const param = new URL(window.location.href).searchParams.get("constraint")

  if (isDispatchDomainId(param, scenario)) {
    return param
  }

  return getInitialConstraintId(scenario)
}

function updateDispatchUrl(scenarioId: string, domainId: DispatchDomainId) {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.set("dispatch", scenarioId)
  url.searchParams.set("constraint", domainId)
  window.history.replaceState({}, "", url)
}

function isDispatchDomainId(
  value: string | null,
  scenario: DispatchScenario
): value is DispatchDomainId {
  return Boolean(
    value && scenario.dto.constraints.some((constraint) => constraint.id === value)
  )
}
