"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import type { AssessmentExplorer } from "./assessment-explorer"
import { loadAssessmentExplorer, reloadAssessmentLocation } from "./assessment-explorer-loader"
import type { PublicTopic } from "@/lib/public-topic"
import type { AssessmentRecord, AssessmentScenario, AssessmentSelection } from "@/types/assessment"
import type { FacilityInspectionTarget, FacilityMode, FacilityVisualRelease } from "@/types/facility"

import type { HypotheticalMinimumSource } from "@/lib/assessment/hypothetical-minimum"

type ReadySelection = Extract<AssessmentSelection, { status: "ready" }>
const IMPORT_DEADLINE_MS = 8_000
type JourneyTarget = "facility-construction" | "workload-story" | "hypothetical-minimum"

function handoffPosterRecoveryFocus(action: HTMLElement) {
  if (document.activeElement instanceof Element && document.activeElement.closest("[data-assessment-preview-focus]")) action.focus({ preventScroll: true })
}

/** Until enhancement commits, selection uses the preview's native GET form. */
export function DeferredAssessmentExplorer({ initialSelection, initialTarget, initialTopic, records, facilityRelease, facilityMode, preview, eager = false, activateInitially = false, hypotheticalSource = null }: {
  hypotheticalSource?: HypotheticalMinimumSource | null
  initialSelection: ReadySelection
  initialTarget: FacilityInspectionTarget | null
  initialTopic?: PublicTopic
  records: Readonly<Record<AssessmentScenario, AssessmentRecord>>
  facilityRelease: FacilityVisualRelease | null
  facilityMode: FacilityMode
  preview: ReactNode
  eager?: boolean
  activateInitially?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const attempt = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nativeActionPending = useRef(false)
  const completedNativeAction = useRef(false)
  const pressedPointers = useRef(new Set<number>())
  const pending = useRef(false)
  const dirtyForm = useRef(false)
  const requestedActivation = useRef(activateInitially)
  const [activateOnMount, setActivateOnMount] = useState(activateInitially)
  const pendingFocus = useRef<"brief" | "facility" | JourneyTarget | null>(null)
  const requestedJourney = useRef<JourneyTarget | null>(null)
  const loaded = useRef<typeof AssessmentExplorer | null>(null)
  const loadedLocation = useRef("")
  const [Explorer, setExplorer] = useState<typeof AssessmentExplorer | null>(null)
  const [conditionsOpen, setConditionsOpen] = useState(initialSelection.perspective === "engineering")
  const [hypotheticalOpen, setHypotheticalOpen] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(initialSelection.perspective === "engineering")
  const [phase, setPhase] = useState<"static" | "loading" | "failed" | "navigating">("static")

  const commit = useCallback(() => {
    if (!loaded.current || dirtyForm.current || nativeActionPending.current) return
    // Adopt a native press that began before hydration. After an observed
    // terminal event, Chromium touch may retain :active briefly; that completed
    // gesture cannot become a new hold, including if the import finishes later.
    if (!completedNativeAction.current && container.current?.querySelector(":active")) {
      nativeActionPending.current = true
      return
    }
    if (window.location.pathname + window.location.search !== loadedLocation.current) {
      loaded.current = null
      dirtyForm.current = true
      setPhase("navigating")
      reloadAssessmentLocation()
      return
    }
    const active = document.activeElement
    // Never replace an open native select or discard an unapplied choice.
    if (active instanceof Element && active.closest("[data-assessment-preview-form]")) return
    // Preserve focused native controls and stable recovery targets until focus
    // leaves them. Explicit explorer activation remains an intentional handoff.
    if (active instanceof Element && container.current?.contains(active) && (active.matches("a, button, input, select, textarea, summary") || active.closest("[data-assessment-preview-focus]")) && !active.closest("[data-assessment-preview-activate], [data-assessment-retry]")) return
    pendingFocus.current = null
    const journey = requestedJourney.current
    if (journey && window.location.hash === `#${journey}` && (active === document.body || active instanceof HTMLElement && active.id === journey)) {
      pendingFocus.current = journey
    } else if (active instanceof HTMLElement && container.current?.contains(active)) {
      pendingFocus.current = active.closest("[data-assessment-preview-activate], [data-assessment-retry]") ? "facility" : "brief"
    }
    const open = container.current?.querySelector<HTMLDetailsElement>("[data-assessment-controls]")?.open ?? false
    // Check and replacement are one transaction. A queued concurrent render
    // must not replace a native target after a new press has begun.
    flushSync(() => {
      setControlsOpen(open)
      setConditionsOpen(container.current?.querySelector<HTMLDetailsElement>("[data-assessment-conditions]")?.open ?? (initialSelection.perspective === "engineering"))
      setHypotheticalOpen(window.location.hash === "#hypothetical-minimum" || Boolean(container.current?.querySelector<HTMLDetailsElement>("#hypothetical-minimum")?.open))
      setExplorer(() => loaded.current)
    })
  }, [initialSelection.perspective])

  const load = useCallback((activate = false) => {
    if (activate) { requestedActivation.current = true; setActivateOnMount(true) }
    if (loaded.current) { commit(); return }
    if (pending.current) return
    pending.current = true
    const id = ++attempt.current
    const location = window.location.pathname + window.location.search
    setPhase("loading")
    const fail = () => {
      if (attempt.current !== id) return
      ++attempt.current
      pending.current = false
      if (timer.current) clearTimeout(timer.current)
      setPhase("failed")
    }
    timer.current = setTimeout(fail, IMPORT_DEADLINE_MS)
    void loadAssessmentExplorer().then(module => {
      if (attempt.current !== id || window.location.pathname + window.location.search !== location) return
      if (timer.current) clearTimeout(timer.current)
      pending.current = false
      loaded.current = module.AssessmentExplorer
      loadedLocation.current = location
      setPhase("static")
      commit()
    }, fail)
  }, [commit])

  useEffect(() => {
    if (!Explorer || !pendingFocus.current) return
    const journey = pendingFocus.current === "facility-construction" || pendingFocus.current === "workload-story" || pendingFocus.current === "hypothetical-minimum"
    const selector = journey ? `#${pendingFocus.current}` : pendingFocus.current === "facility" ? ".facility-stage" : "#decision-brief"
    const destination = container.current?.querySelector<HTMLElement>(selector)
      ?? container.current?.querySelector<HTMLElement>("#decision-brief")
    destination?.focus({ preventScroll: true })
    // The explicit native destination moved when its server preview was replaced.
    // Correct it once; ordinary observer-driven enhancement never scrolls.
    if (journey) destination?.scrollIntoView({ block: "start", behavior: "instant" })
    pendingFocus.current = null
  }, [Explorer])

  useEffect(() => {
    if (Explorer) return
    const onHistory = () => {
      loaded.current = null
      dirtyForm.current = true
      ++attempt.current
      if (timer.current) clearTimeout(timer.current)
      setPhase("navigating")
      reloadAssessmentLocation()
    }
    window.addEventListener("popstate", onHistory)
    const onExplicitJourney = () => {
      if (!["#facility-construction", "#workload-story", "#hypothetical-minimum"].includes(window.location.hash)) return
      requestedJourney.current = window.location.hash.slice(1) as JourneyTarget
      load()
    }
    let current = true
    queueMicrotask(() => { if (current) { if (eager) load(); else onExplicitJourney() } })
    window.addEventListener("hashchange", onExplicitJourney)
    const stage = container.current?.querySelector(".facility-stage")
    const observer = stage && typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .25)) {
        observer?.disconnect()
        load()
      }
    }, { threshold: [.25] }) : null
    if (stage) observer?.observe(stage)
    return () => { current = false; observer?.disconnect(); window.removeEventListener("popstate", onHistory); window.removeEventListener("hashchange", onExplicitJourney) }
  }, [Explorer, eager, load])

  useEffect(() => {
    if (Explorer) return
    const release = (delay = 0) => {
      if (actionTimer.current) clearTimeout(actionTimer.current)
      actionTimer.current = setTimeout(() => {
        actionTimer.current = null
        if (pressedPointers.current.size) return
        nativeActionPending.current = false
        completedNativeAction.current = true
        commit()
      }, delay)
    }
    const onPointerUp = (event: PointerEvent) => {
      pressedPointers.current.delete(event.pointerId)
      if (!nativeActionPending.current || pressedPointers.current.size) return
      // A click within the preview must finish its native default action first.
      // The bounded fallback also releases a drag that produces no click.
      release(event.target instanceof Node && container.current?.contains(event.target) ? 350 : 0)
    }
    const onPointerCancel = (event: PointerEvent) => {
      pressedPointers.current.delete(event.pointerId)
      if (nativeActionPending.current) release()
    }
    const onClick = () => { if (nativeActionPending.current && !pressedPointers.current.size) release() }
    const onKeyUp = (event: KeyboardEvent) => { if (nativeActionPending.current && (event.key === "Enter" || event.key === " ")) release(350) }
    const onWindowBlur = () => { pressedPointers.current.clear(); if (nativeActionPending.current) release() }
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerCancel)
    window.addEventListener("click", onClick)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onWindowBlur)
    return () => {
      if (actionTimer.current) clearTimeout(actionTimer.current)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerCancel)
      window.removeEventListener("click", onClick)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onWindowBlur)
    }
  }, [Explorer, commit])

  useEffect(() => () => {
    pending.current = false
    loaded.current = null
    ++attempt.current
    if (timer.current) clearTimeout(timer.current)
  }, [])

  if (Explorer) return <div ref={container}><Explorer initialSelection={initialSelection} initialTarget={initialTarget} initialTopic={initialTopic} records={records} facilityRelease={facilityRelease} facilityMode={facilityMode} activateOnMount={activateOnMount} initialControlsOpen={controlsOpen} initialConditionsOpen={conditionsOpen} hypotheticalSource={hypotheticalSource} initialHypotheticalOpen={hypotheticalOpen} /></div>

  return <div ref={container} onPointerDownCapture={event => {
    if (actionTimer.current) clearTimeout(actionTimer.current)
    completedNativeAction.current = false
    pressedPointers.current.add(event.pointerId)
    nativeActionPending.current = true
  }} onKeyDownCapture={event => {
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof Element && event.target.closest("a, button, summary, input, select, textarea")) {
      if (actionTimer.current) clearTimeout(actionTimer.current)
      completedNativeAction.current = false
      nativeActionPending.current = true
    }
  }} onChangeCapture={event => {
    if (event.target instanceof HTMLSelectElement && event.target.form?.hasAttribute("data-assessment-preview-form")) dirtyForm.current = true
  }} onBlurCapture={() => queueMicrotask(commit)} onClickCapture={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return
    const link = event.target.closest("a[data-assessment-preview-activate]")
    if (!link || dirtyForm.current) return
    event.preventDefault()
    // Safari touch activation may retain the poster recovery target's focus.
    // The named explicit action intentionally hands that local hold to the link.
    if (link instanceof HTMLElement) handoffPosterRecoveryFocus(link)
    pendingFocus.current = "facility"
    load(true)
  }}>
    {phase === "navigating" ? <p role="status">Restoring the selected assessment… <a href="/demo" className="text-primary underline">Open the default example</a></p> : preview}
    {phase === "loading" && <p role="status" className="mt-3 text-sm text-muted-foreground">Preparing interactive inspection. The decision brief and selection form remain available.</p>}
    {phase === "failed" && <div role="status" className="mt-3 rounded-xl border border-border bg-surface p-4 text-sm leading-6"><p>Interactive inspection could not load. The selected decision brief, downloads, and selection form remain available.</p><button type="button" data-assessment-retry className="mr-5 inline-flex min-h-11 items-center text-primary underline" onClick={event => {
      handoffPosterRecoveryFocus(event.currentTarget)
      load(requestedActivation.current)
    }}>Retry interactive inspection</button><a href={`/demo?scenario=${initialSelection.scenario}&version=${initialSelection.version}&perspective=${initialSelection.perspective}${initialTopic ? `&topic=${initialTopic}` : ""}#decision-brief`} className="inline-flex min-h-11 items-center text-primary underline">Reload this decision brief</a></div>}
  </div>
}
