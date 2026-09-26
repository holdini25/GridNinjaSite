"use client"

import { Component, Suspense, lazy, useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { facilityObscuredRackDetail, facilitySelectionHref } from "@/lib/facility/navigation"
import { facilityMotionStatus } from "@/lib/facility/motion-status"
import { selectAssessment } from "@/lib/assessment/selectors"
import { FacilityContextualInspector } from "@/components/facility/facility-contextual-inspector"
import { FacilityEcosystemStory } from "@/components/facility/facility-ecosystem-story"
import { ECOSYSTEM_DEFAULT_RACK, ecosystemDiagramPresentation, ecosystemNarrative, ecosystemRackLabel, ecosystemRepresentativeRack } from "@/lib/facility/ecosystem-narrative"
import { FACILITY_LABELS, facilityEquipmentIdentification, facilitySystemDescription, facilityWindowLabel, facilityWalkthrough, facilityTargetConnections } from "@/lib/facility/content"
import { facilityPreview, facilityPreviewTarget, facilityReducer, initialFacilityPresentation } from "@/lib/facility/interaction"
import { isRackServiceDetail } from "@/lib/facility/rack-service-view"
import { eligibleForAutomaticFacility, facilityConnection } from "@/lib/facility/loading-policy"
import { createPosterDecoder } from "@/lib/facility/poster-decode"
import { readFacilityPreferences, subscribeFacilityPreferences, writeFacilityPreferences } from "@/lib/facility/preferences"
import { FACILITY_SYSTEMS } from "@/types/facility"
import type { FacilityCanvasProps, FacilityRackAnchor, FacilityRackTarget, FacilityInspectionProps, FacilityInspectionTarget, FacilityPresentationCheckpoint, FacilityPresentationCommand, FacilityQuality, FacilitySceneMetadata, FacilitySystem, FacilityView } from "@/types/facility"
import { DEFER_V7_MOBILE_POSTER, FACILITY_POSTER_PLACEHOLDER, usePosterAcquisition } from "./use-poster-acquisition"
import "./facility-inspection.css"

const FacilityEngineeringControls = lazy(() => import("./facility-engineering-controls").then(module => ({ default: module.FacilityEngineeringControls })))

class FacilityBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

/** The module and Three dependency graph are requested only after activation. */
function FacilityScene(props: FacilityCanvasProps) {
  const Scene = useMemo(() => lazy(() => import("./facility-canvas")), [])
  return <FacilityBoundary onFailure={() => props.onFailure("render")}><Suspense fallback={null}><Scene {...props} /></Suspense></FacilityBoundary>
}

export function FacilityInspection(props: FacilityInspectionProps) {
  return <FacilityInspectionSession key={props.release.release} {...props} />
}

function FacilityInspectionSession({ record, release, variant, loadingPolicy, mode = loadingPolicy, resetRevision = 0, onExpandedChange, initialTarget = null, onCommittedTarget, topic, showAssessmentCaption = true, activateOnMount = false, readingHold = false }: FacilityInspectionProps) {
  const [state, dispatch] = useReducer(facilityReducer, release.release, key => { const initial = initialFacilityPresentation(key); return initialTarget ? facilityReducer(initial, { type: "select", system: initialTarget.system, target: initialTarget }) : initial })
  const [contextualReadingHold, setContextualReadingHold] = useState(false)
  const ambientHold = readingHold || contextualReadingHold
  const nightInspection = Boolean(release.profile.inspection)
  const engineering = Boolean(release.profile.engineering)
  const ecosystem = Boolean(release.profile.ecosystem)
  const narrative = useMemo(() => ecosystemNarrative(record), [record])
  const storyContext = `${narrative.identity}:${resetRevision}`
  const [storyContextSeen, setStoryContextSeen] = useState(storyContext)
  const [presentation, setPresentation] = useState<FacilityPresentationCommand>({ revision: 0, seekRevision: 0, chapter: null, playing: false, rackId: ECOSYSTEM_DEFAULT_RACK, coolingEvidence: narrative.missingCooling ? "missing" : "available" })
  const [storyRevealRequest, setStoryRevealRequest] = useState(0)
  const rackHandles = useRef<Partial<Record<"door" | "tray", HTMLButtonElement | null>>>({})
  const rackAnchorVisible = useRef(new Uint8Array(2))
  const onRackAnchors = useCallback((anchors: readonly FacilityRackAnchor[]) => {
    for (let index = 0; index < 2; index++) {
      const action = index === 0 ? "door" : "tray"
      let anchor: FacilityRackAnchor | undefined
      for (let item = 0; item < anchors.length; item++) if (anchors[item].action === action) { anchor = anchors[item]; break }
      const button = rackHandles.current[action], visible = Boolean(anchor?.visible)
      const visibilityChanged = rackAnchorVisible.current[index] !== (visible ? 1 : 0)
      rackAnchorVisible.current[index] = visible ? 1 : 0
      // The action rail stays outside the construction. The existing frame owner
      // supplies handle visibility without layout reads or per-frame React updates.
      if (button && visibilityChanged) button.hidden = !visible
    }
  }, [])
  const returnContext = useRef<{ view: FacilityView; target: FacilityInspectionTarget | null } | null>(null)
  const pendingViewFocus = useRef<{ view: FacilityView; generation: number; context: string; from: Element | null } | null>(null)
  const [requestedView, setRequestedView] = useState<FacilityView>({ kind: "overview" })
  const [activeView, setActiveView] = useState<FacilityView>({ kind: "overview" })
  const [metadata, setMetadata] = useState<FacilitySceneMetadata>({})
  const pendingMetadata = useRef<FacilitySceneMetadata>({})
  const [assetPhase, setAssetPhase] = useState<"loading" | "ready" | "failed">("ready")
  const [quality, setQuality] = useState<FacilityQuality | null>(null)
  const [assetRetry, setAssetRetry] = useState(0), [motionRetry, setMotionRetry] = useState(0)
  const [expanded, setExpanded] = useState(false), [walkthroughStep, setWalkthroughStep] = useState<number | null>(null)
  const headingId = useId(), panelId = useId(), scopeId = useId()
  const container = useRef<HTMLElement>(null), heading = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), poster = useRef<HTMLImageElement>(null)
  const deferMobilePoster = nightInspection && DEFER_V7_MOBILE_POSTER
  const posterAcquisition = usePosterAcquisition(stage, deferMobilePoster)
  const requestPoster = posterAcquisition.request
  const activateButton = useRef<HTMLButtonElement>(null), optionsButton = useRef<HTMLElement>(null), mediaControls = useRef<HTMLDivElement>(null)
  const displayOptions = useRef<HTMLDetailsElement>(null)
  const optionsPointerActive = useRef(false)
  const initialActivationSeen = useRef(false)
  const systemButtons = useRef<Partial<Record<FacilitySystem, HTMLButtonElement | null>>>({})
  const pendingConnectionFocus = useRef<FacilityInspectionTarget | null>(null)
  const suppressFocusPreview = useRef<FacilitySystem | null>(null), restoreActivationFocus = useRef(false)
  const focusManualActivation = useRef(false)
  useEffect(() => {
    if (!activateOnMount || initialActivationSeen.current || mode === "poster") return
    initialActivationSeen.current = true
    requestPoster()
    focusManualActivation.current = true
    dispatch({ type: "activate" })
  }, [activateOnMount, mode, requestPoster])
  const posterDecoder = useRef<ReturnType<typeof createPosterDecoder> | null>(null)
  const [resetSeen, setResetSeen] = useState(resetRevision)
  const [resetRevealRevision, setResetRevealRevision] = useState<number | null>(null)
  const view = selectAssessment(record)
  const active = state.media.phase === "loading" || state.media.phase === "staging" || state.media.phase === "ready"
  const loading = state.media.phase === "loading" || state.media.phase === "staging"
  const ready = state.media.phase === "ready"
  const visible = state.inViewport && state.documentVisible
  useEffect(() => {
    if (!active) return
    let pointerEnd: number | undefined
    const clearPointer = () => { window.clearTimeout(pointerEnd); pointerEnd = undefined; optionsPointerActive.current = false }
    const dismiss = (event: PointerEvent) => {
      clearPointer()
      const options = displayOptions.current
      optionsPointerActive.current = !!(options && event.target instanceof Node && options.contains(event.target))
      if (options?.open && !optionsPointerActive.current) options.open = false
    }
    const finishPointer = () => {
      // Keep the gesture alive through the native click following pointerup,
      // including a label's forwarded checkbox click. Never defer outside input.
      if (optionsPointerActive.current) pointerEnd = window.setTimeout(clearPointer, 0)
    }
    const key = (event: KeyboardEvent) => {
      clearPointer()
      if (event.key !== "Escape" || !displayOptions.current?.open) return
      event.preventDefault(); event.stopPropagation()
      displayOptions.current.open = false
      optionsButton.current?.focus({ preventScroll: true })
    }
    document.addEventListener("pointerdown", dismiss, { capture: true, passive: true })
    document.addEventListener("pointerup", finishPointer, { capture: true, passive: true })
    document.addEventListener("pointercancel", clearPointer, { capture: true, passive: true })
    document.addEventListener("keydown", key, true)
    return () => {
      clearPointer()
      document.removeEventListener("pointerdown", dismiss, true)
      document.removeEventListener("pointerup", finishPointer, true)
      document.removeEventListener("pointercancel", clearPointer, true)
      document.removeEventListener("keydown", key, true)
    }
  }, [active])
  const token = useMemo(() => ({ generation: state.media.generation, release: state.media.release }), [state.media.generation, state.media.release])
  const latestToken = useRef(token)
  // Retire picks synchronously: React may batch Close and a late callback before
  // the token effect commits, while history writes must stop immediately.
  const retiredSelectionGeneration = useRef(-1)
  useEffect(() => { latestToken.current = token }, [token])
  const inventoryMetadata = state.target?.equipmentId || state.target?.routeId || state.target?.partId ? undefined : metadata
  const explanations = useMemo(() => [
    { system: "overview", label: "Inspect the physical context", body: "Select Power, Cooling, Storage or Workloads to inspect their role in this assessment.", equipment: null },
    ...FACILITY_SYSTEMS.map(system => ({ system, ...facilitySystemDescription(record, system), equipment: facilityEquipmentIdentification(release.release, system, inventoryMetadata) })),
  ], [record, release.release, inventoryMetadata])
  const explanationState = state.selected ?? "overview"
  const description = explanations.find(item => item.system === explanationState)!
  const diagramPresentation = useMemo(() => ecosystemDiagramPresentation({ chapter: presentation.chapter, rackId: presentation.rackId, coolingEvidence: presentation.coolingEvidence }, metadata.topology), [presentation.chapter, presentation.rackId, presentation.coolingEvidence, metadata.topology])
  const baseMotionUnavailable = mode === "poster" ? "This example uses a still illustration." : !ready ? "Play requires the ready 3D overview." : assetPhase !== "ready" || activeView.kind !== "overview" || activeView.detail ? "Return to the facility overview to play." : state.reducedMotion ? "Motion is off for your reduced-motion preference." : state.paused ? "The facility is paused." : !state.equipmentEnabled ? "Equipment motion is off." : ambientHold ? "Close the reading panel to play." : quality === "still" ? "Motion is resting to keep interaction responsive." : null
  const motionUnavailable = baseMotionUnavailable ?? (narrative.missingCooling && (presentation.chapter ?? 0) >= 2 ? "Playback stops at the missing cooling evidence." : null)
  // Reset presentation independently of the graphics session and its preferences.
  // A record identity change also protects direct consumers without resetRevision.
  if (ecosystem && storyContextSeen !== storyContext) {
    setStoryContextSeen(storyContext)
    setPresentation(previous => ({ ...previous, revision: previous.revision + 1, seekRevision: previous.seekRevision + 1, chapter: null, playing: false, rackId: ECOSYSTEM_DEFAULT_RACK, coolingEvidence: narrative.missingCooling ? "missing" : "available" }))
    setRequestedView({ kind: "overview" })
    dispatch(initialTarget ? { type: "select", system: initialTarget.system, target: initialTarget } : { type: "clear" })
  } else if (ecosystem && presentation.playing && motionUnavailable) {
    setPresentation(previous => ({ ...previous, revision: previous.revision + 1, playing: false }))
  }

  const exitStory = useCallback(() => setPresentation(previous => previous.chapter === null && !previous.playing ? previous : { ...previous, revision: previous.revision + 1, seekRevision: previous.seekRevision + 1, chapter: null, playing: false }), [])

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const desktop = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)")
    const preferences = () => dispatch({ type: "preferences", reducedMotion: motion.matches, desktop: desktop.matches, adaptive: mode === "auto-adaptive" })
    preferences()
    motion.addEventListener("change", preferences)
    desktop.addEventListener("change", preferences)
    let inViewport = false
    const visibility = () => dispatch({ type: "visibility", inViewport, documentVisible: document.visibilityState === "visible" })
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      const entry = entries[entries.length - 1]
      if (entry) { inViewport = entry.isIntersecting && entry.intersectionRatio >= 0.25; visibility() }
    }, { threshold: [0, 0.25] }) : null
    if (stage.current) observer?.observe(stage.current)
    // Explicit activation still works in a browser without IntersectionObserver.
    if (!observer) inViewport = true
    visibility()
    document.addEventListener("visibilitychange", visibility)
    const loaded = () => dispatch({ type: "page-loaded" })
    if (document.readyState === "complete") loaded()
    else window.addEventListener("load", loaded, { once: true })
    return () => {
      observer?.disconnect()
      motion.removeEventListener("change", preferences)
      desktop.removeEventListener("change", preferences)
      document.removeEventListener("visibilitychange", visibility)
      window.removeEventListener("load", loaded)
    }
  }, [mode])

  useEffect(() => {
    if (!engineering) return
    const restore = () => {
      const preferences = readFacilityPreferences()
      dispatch({ type: "restore-preferences", paused: preferences.paused, equipmentEnabled: preferences.equipmentEnabled, closed: preferences.closedReleases.includes(release.release) })
    }
    restore()
    return subscribeFacilityPreferences(restore)
  }, [engineering, release.release])

  const decodePoster = useCallback(() => posterDecoder.current?.decode(), [])
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 639px)")
    const decoder = createPosterDecoder(() => poster.current,
      () => new URL(mobile.matches ? release.posters.mobile.url : release.posters.desktop.url, document.baseURI).href,
      state => dispatch({ type: state === "decoded" ? "poster-decoded" : state === "failed" ? "poster-failed" : "poster-pending" }))
    posterDecoder.current = decoder
    const changed = () => { decoder.invalidate(); queueMicrotask(() => decoder.decode()) }
    mobile.addEventListener("change", changed)
    if (poster.current?.complete) decoder.decode()
    return () => { mobile.removeEventListener("change", changed); decoder.dispose(); posterDecoder.current = null }
  }, [release.posters.desktop.url, release.posters.mobile.url])

  // A decoded image is not necessarily painted. Two presentation opportunities
  // precede the idle import, and visibility changes cancel this observation.
  useEffect(() => {
    if (mode !== "auto-adaptive" || !state.posterDecoded || !visible) return
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      if (posterDecoder.current?.isDecoded() && document.visibilityState === "visible") dispatch({ type: "poster-painted" })
    }) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [mode, state.posterDecoded, visible])

  useEffect(() => {
    const eligible = () => eligibleForAutomaticFacility({ ...state, mode, connection: facilityConnection() })
    if (!eligible() || !posterDecoder.current?.isDecoded()) return
    const activate = () => {
      // Conditions are re-read at the idle boundary; a changed preference must not race the import.
      const current = { ...state, mode, connection: facilityConnection(), documentVisible: document.visibilityState === "visible", reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches, desktop: window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches }
      if (eligibleForAutomaticFacility(current) && posterDecoder.current?.isDecoded()) dispatch({ type: "activate" })
    }
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(activate, { timeout: 1_500 })
      return () => window.cancelIdleCallback(id)
    }
    const timer = setTimeout(activate, 1_500)
    return () => clearTimeout(timer)
  }, [mode, state])

  const fail = useCallback((reason: string) => {
    if (latestToken.current !== token) return
    pendingViewFocus.current = null
    retiredSelectionGeneration.current = token.generation
    if (mediaControls.current?.contains(document.activeElement)) restoreActivationFocus.current = true
    dispatch({ type: "failed", token, reason })
    setRequestedView({ kind: "overview" }); setActiveView({ kind: "overview" }); setMetadata({}); pendingMetadata.current = {}
    setAssetPhase("ready"); setQuality(null)
    setPresentation(previous => ({ ...previous, revision: previous.revision + 1, playing: false }))
  }, [token])
  // The dependency stays true during staging: there is exactly one deadline per generation.
  useEffect(() => {
    if (!loading) return
    const deadline = setTimeout(() => fail("timeout"), 8_000)
    return () => clearTimeout(deadline)
  }, [loading, token, fail])

  useEffect(() => {
    if (focusManualActivation.current && active) {
      focusManualActivation.current = false
      optionsButton.current?.focus({ preventScroll: true })
    }
    if (restoreActivationFocus.current && !active) {
      restoreActivationFocus.current = false
      activateButton.current?.focus({ preventScroll: true })
    }
  }, [active])
  if (resetSeen !== resetRevision) {
    if (active && (activeView.kind === "specimen" || requestedView.kind === "specimen")) setResetRevealRevision(resetRevision)
    setResetSeen(resetRevision)
    dispatch(initialTarget ? { type: "select", system: initialTarget.system, target: initialTarget } : { type: "clear" })
    setWalkthroughStep(null)
    setRequestedView({ kind: "overview" })
  }

  const onStaged = useCallback(() => dispatch({ type: "staged", token }), [token])
  const onPresented = useCallback(() => dispatch({ type: "presented", token }), [token])
  const onSelect = useCallback((system: FacilitySystem) => { if (latestToken.current !== token || token.generation <= retiredSelectionGeneration.current) return; setWalkthroughStep(null); exitStory(); dispatch({ type: "select", token, system }); onCommittedTarget?.({ system }) }, [token, exitStory, onCommittedTarget])
  const onTarget = useCallback((target: FacilityInspectionTarget) => { if (latestToken.current !== token || token.generation <= retiredSelectionGeneration.current) return; setWalkthroughStep(null); exitStory(); dispatch({ type: "select", token, system: target.system, target }); onCommittedTarget?.(target) }, [token, exitStory, onCommittedTarget])
  const onTargetPreview = useCallback((target: FacilityInspectionTarget | null) => {
    const owner = `model-${token.generation}`
    dispatch(target ? { type: "preview", channel: "pointer", owner, token, system: target.system, target } : { type: "preview-end", channel: "pointer", owner })
  }, [token])
  const onMetadata = useCallback((next: FacilitySceneMetadata) => {
    if (latestToken.current !== token) return
    pendingMetadata.current = next
  }, [token])
  const onAssetState = useCallback((next: { phase: "loading" | "ready" | "failed"; view: FacilityView; reason?: string }) => {
    if (latestToken.current !== token) return
    setAssetPhase(next.phase)
    if (next.phase === "failed") pendingViewFocus.current = null
    if (next.phase === "ready") {
      setActiveView(next.view)
      setMetadata(previous => ({ topology: pendingMetadata.current.topology ?? previous.topology, specimen: pendingMetadata.current.specimen }))
    }
  }, [token])
  const onQuality = useCallback((next: FacilityQuality) => { if (latestToken.current === token) setQuality(next) }, [token])
  const onPresentationCheckpoint = useCallback((checkpoint: FacilityPresentationCheckpoint) => {
    if (latestToken.current !== token) return
    setPresentation(previous => checkpoint.revision !== previous.revision || previous.chapter === null || !Number.isInteger(checkpoint.chapter) || checkpoint.chapter < 0 || checkpoint.chapter > 5 ? previous : { ...previous, chapter: checkpoint.chapter, playing: checkpoint.playing })
  }, [token])
  const onPreview = useCallback((system: FacilitySystem | null) => {
    const owner = `model-${token.generation}`
    dispatch(system ? { type: "preview", channel: "pointer", owner, token, system } : { type: "preview-end", channel: "pointer", owner })
  }, [token])

  useEffect(() => {
    const desired = pendingConnectionFocus.current
    if (!desired) return
    pendingConnectionFocus.current = null
    const field = desired.partId ? "part" : desired.routeId ? "route" : "equipment"
    const identity = desired.partId ?? desired.routeId ?? desired.equipmentId
    const button = identity ? Array.from(container.current?.querySelectorAll<HTMLButtonElement>(`button[data-${field}-id]`) ?? []).find(item => item.getAttribute(`data-${field}-id`) === identity) : undefined
    if (button) {
      // A model pick may target a part in a collapsed native disclosure.
      // Reveal its ancestor disclosures before attempting keyboard focus.
      for (let parent = button.parentElement; parent && parent !== container.current; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true
      button.focus({ preventScroll: true })
    }
    if (!button || document.activeElement !== button) { suppressFocusPreview.current = desired.system; systemButtons.current[desired.system]?.focus({ preventScroll: true }) }
  }, [state.target, metadata])

  // Explicit inspection must reveal the result, including when mobile controls
  // have scrolled the demand-rendered stage offscreen. Never run for previews.
  const revealStage = useCallback(() => {
    const element = stage.current
    if (!element) return
    const bounds = element.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const viewport = window.visualViewport
    const top = viewport?.offsetTop ?? 0
    const bottom = top + (viewport?.height ?? window.innerHeight)
    const inset = parseFloat(getComputedStyle(element).scrollMarginTop) || 0
    const subjectTop = Math.min(heading.current?.getBoundingClientRect().top ?? bounds.top, bounds.top)
    if (subjectTop < top + inset || bounds.bottom > bottom) {
      // Reveal the heading controls together with the scene. Preserve horizontal
      // position so explicit inspection does not fight native pinch zoom.
      window.scrollTo({ top: Math.max(0, window.scrollY + subjectTop - top - inset), left: window.scrollX, behavior: "instant" })
    }
  }, [])
  // Intent listeners belong to the active session, so an explicit Reset ticket
  // armed after commit is cancellable even while an older asset is still loading.
  useEffect(() => {
    if (!active) return
    const cancel = () => { pendingViewFocus.current = null }
    const hidden = () => { if (document.visibilityState !== "visible") cancel() }
    const key = (event: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Tab"].includes(event.key)) cancel() }
    window.addEventListener("wheel", cancel, { passive: true })
    window.addEventListener("touchmove", cancel, { passive: true })
    window.addEventListener("pointerdown", cancel, { passive: true })
    window.addEventListener("keydown", key)
    document.addEventListener("visibilitychange", hidden)
    return () => {
      window.removeEventListener("wheel", cancel); window.removeEventListener("touchmove", cancel); window.removeEventListener("pointerdown", cancel); window.removeEventListener("keydown", key); document.removeEventListener("visibilitychange", hidden)
    }
  }, [active])
  // A view switch can add/remove the rack action rail above the stage. Reveal
  // once more after that exact view commits, without following subsequent joint
  // movement or taking the viewport back after the visitor starts reading.
  useEffect(() => {
    const pending = pendingViewFocus.current
    if (!pending) return
    if (!active || assetPhase === "failed" || pending.view !== requestedView || pending.generation !== token.generation || pending.context !== storyContext) { pendingViewFocus.current = null; return }
    let first = 0, second = 0
    if (assetPhase === "ready" && activeView === pending.view) {
      first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
        if (pendingViewFocus.current !== pending || document.visibilityState !== "visible") return
        pendingViewFocus.current = null
        revealStage()
        if (document.activeElement === pending.from || document.activeElement === document.body) stage.current?.focus({ preventScroll: true })
      }) })
    }
    return () => {
      cancelAnimationFrame(first); cancelAnimationFrame(second)
    }
  }, [active, activeView, assetPhase, requestedView, token.generation, storyContext, revealStage])
  useEffect(() => {
    if (resetRevealRevision === null) return
    revealStage()
    if (activeView.kind === "specimen" && requestedView.kind === "overview") pendingViewFocus.current = { view: requestedView, generation: token.generation, context: storyContext, from: document.activeElement }
    // This is an explicit Reset intent, not a later joint or readiness event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetRevealRevision, revealStage])
  useEffect(() => {
    if (!storyRevealRequest || !presentation.playing || !ready) return
    // Focus can start a smooth viewport scroll before Play commits. The stage
    // can still be visible during the first paints, so the ordinary conditional
    // reveal cannot reliably cancel it. Explicit playback settles that scroll
    // once; chapter reading and runtime checkpoints never move the viewport.
    const alignPlayback = () => {
      const element = stage.current
      if (!element) return
      const bounds = element.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const inset = parseFloat(getComputedStyle(element).scrollMarginTop) || 0
      const subjectTop = Math.min(heading.current?.getBoundingClientRect().top ?? bounds.top, bounds.top)
      const top = Math.max(0, window.scrollY + subjectTop - (window.visualViewport?.offsetTop ?? 0) - inset)
      window.scrollTo({ top, left: window.scrollX, behavior: "instant" })
    }
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(alignPlayback) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [storyRevealRequest, presentation.playing, ready])

  const clearSelection = () => {
    const system = state.selected ?? state.focusPreview?.system ?? state.pointerPreview?.system
    setWalkthroughStep(null)
    exitStory()
    dispatch({ type: "clear" })
    onCommittedTarget?.(null)
    if (system) { suppressFocusPreview.current = system; systemButtons.current[system]?.focus({ preventScroll: true }) }
  }
  const close = () => {
    pendingViewFocus.current = null
    retiredSelectionGeneration.current = token.generation
    restoreActivationFocus.current = true
    if (engineering) writeFacilityPreferences({ closeRelease: release.release })
    dispatch({ type: "close" })
    setRequestedView({ kind: "overview" }); setActiveView({ kind: "overview" }); setMetadata({}); pendingMetadata.current = {}
    setAssetPhase("ready"); setWalkthroughStep(null); setQuality(null)
    setPresentation(previous => ({ ...previous, revision: previous.revision + 1, playing: false }))
  }
  const activateManually = () => {
    if (mode === "poster") return
    posterAcquisition.request()
    revealStage()
    focusManualActivation.current = true
    if (engineering) writeFacilityPreferences({ openRelease: release.release })
    dispatch({ type: "activate" })
  }
  const changeView = (next: FacilityView) => {
    const nextKind = next.kind === "specimen" ? next.specimen : "overview"
    pendingViewFocus.current = nextKind !== (activeView.kind === "specimen" ? activeView.specimen : "overview") ? { view: next, generation: token.generation, context: storyContext, from: document.activeElement } : null
    if (next.kind === "specimen" && requestedView.kind === "overview") returnContext.current = { view: requestedView, target: state.target }
    // Once an assembly is in view, its controls stay beside the stage. Joint
    // actions do not repeatedly scroll the page or displace keyboard focus.
    if (nextKind !== (requestedView.kind === "specimen" ? requestedView.specimen : "overview") || next.kind === "overview") revealStage()
    setWalkthroughStep(null)
    exitStory()
    setRequestedView(next)
    if (!nightInspection) dispatch({ type: "clear" })
    else if (next.kind === "specimen") dispatch({ type: "select", system: next.specimen === "rack" ? "workloads" : "cooling" })
    else if (state.target?.partId && state.selected) dispatch({ type: "select", system: state.selected })
    if (next.kind === "overview" && next.system) { dispatch({ type: "select", system: next.system }); onCommittedTarget?.({ system: next.system }) }
  }
  const returnToFacility = () => {
    const previous = returnContext.current
    changeView(previous?.view ?? { kind: "overview" })
    dispatch(previous?.target ? { type: "select", system: previous.target.system, target: previous.target } : { type: "clear" })
    onCommittedTarget?.(previous?.target ?? null)
    returnContext.current = null
  }
  const selectTarget = (target: FacilityInspectionTarget) => {
    if (active && !target.partId) revealStage()
    setWalkthroughStep(null)
    exitStory()
    if ((target.routeId || target.equipmentId) && activeView.kind !== "overview") {
      const next: FacilityView = { kind: "overview", system: target.system }
      pendingViewFocus.current = { view: next, generation: token.generation, context: storyContext, from: document.activeElement }
      setRequestedView(next)
    }
    dispatch({ type: "select", system: target.system, target })
    onCommittedTarget?.(target)
  }
  const previewTarget = (target: FacilityInspectionTarget | null, owner: string, channel: "pointer" | "focus") => dispatch(target ? { type: "preview", channel, owner, system: target.system, target } : { type: "preview-end", channel, owner })
  const openStory = () => {
    if (active) revealStage()
    const rackId = ecosystemRepresentativeRack(state.target, metadata.topology)
    setWalkthroughStep(null)
    dispatch({ type: "clear" })
    const next: FacilityView = { kind: "overview" }
    pendingViewFocus.current = activeView.kind === "specimen" ? { view: next, generation: token.generation, context: storyContext, from: document.activeElement } : null
    setRequestedView(next)
    setPresentation(previous => ({ ...previous, revision: previous.revision + 1, seekRevision: previous.seekRevision + 1, chapter: 0, playing: false, rackId, coolingEvidence: narrative.missingCooling ? "missing" : "available" }))
  }
  const seekStory = (chapter: number, replay = false) => {
    if (!Number.isInteger(chapter) || chapter < 0 || chapter > 5) return
    if (active && replay && !baseMotionUnavailable) setStoryRevealRequest(value => value + 1)
    // Manual chapter changes are still, including past D's cooling evidence stop.
    setPresentation(previous => ({ ...previous, revision: previous.revision + 1, seekRevision: previous.seekRevision + 1, chapter, playing: replay && !baseMotionUnavailable }))
  }
  const playStory = (playing: boolean) => {
    if (playing && motionUnavailable) return
    if (playing) setStoryRevealRequest(value => value + 1)
    setPresentation(previous => ({ ...previous, revision: previous.revision + 1, playing }))
  }
  const sectionOpen = requestedView.kind === "overview" && requestedView.section === "air-path" || presentation.chapter === 2 && !narrative.missingCooling
  const toggleSection = () => changeView(sectionOpen ? { kind: "overview" } : { kind: "overview", section: "air-path" })
  const selectWalkthrough = (index: number | null) => {
    if (active && (activeView.kind === "specimen" || requestedView.kind === "specimen")) revealStage()
    setWalkthroughStep(index)
    dispatch({ type: "clear" })
    const system = index === null ? null : facilityWalkthrough(record)[index]?.system
    const next: FacilityView = { kind: "overview" }
    pendingViewFocus.current = activeView.kind === "specimen" ? { view: next, generation: token.generation, context: storyContext, from: document.activeElement } : null
    setRequestedView(next)
    if (system) dispatch({ type: "select", system })
  }
  const highlightWalkthroughSystem = (system: FacilitySystem) => {
    if (active) revealStage()
    dispatch({ type: "select", system })
  }
  const setPaused = (paused: boolean) => { dispatch({ type: "pause", paused }); if (engineering) writeFacilityPreferences({ paused }) }
  const setEquipment = (enabled: boolean) => { dispatch({ type: "equipment", enabled }); if (engineering) writeFacilityPreferences({ equipmentEnabled: enabled }) }
  const expand = () => { setExpanded(!expanded); onExpandedChange?.(!expanded) }
  const targetLabel = state.target?.partId ? metadata.specimen?.parts.find(part => part.id === state.target?.partId)?.label : state.target?.equipmentId ? (metadata.topology?.equipment ?? release.equipmentIndex?.equipment)?.find(item => item.id === state.target?.equipmentId)?.label : state.target?.routeId ? metadata.topology?.routes.find(route => route.id === state.target?.routeId)?.service : null
  const targetRole = state.target?.equipmentId ? (metadata.topology?.equipment ?? release.equipmentIndex?.equipment)?.find(item => item.id === state.target?.equipmentId)?.role : null
  const obscuredRack = facilityObscuredRackDetail(release, activeView)
  const constructionHref = obscuredRack ? facilitySelectionHref({ status: "ready", scenario: record.scenario, version: record.publication.version, perspective: "business" }, { system: obscuredRack.system, equipmentId: obscuredRack.id }, topic) : null
  const targetConnections = facilityTargetConnections(metadata, state.target)
  const currentRackView = requestedView.kind === "specimen" && requestedView.specimen === "rack" ? requestedView : null
  const currentRack: FacilityRackTarget = currentRackView?.rack ?? { door: currentRackView?.pose === "service" ? "open" : "closed", tray: currentRackView?.pose === "service" ? "extended" : "retracted", cutaway: currentRackView?.pose === "cutaway" }
  const rackDetailActive = isRackServiceDetail(activeView) || isRackServiceDetail(requestedView)
  const rackAction = (action: "door" | "tray") => {
    if (rackDetailActive) return
    const next: FacilityRackTarget = action === "door" ? { ...currentRack, door: currentRack.door === "open" ? "closed" : "open", tray: "retracted" } : { ...currentRack, door: "open", tray: currentRack.tray === "extended" ? "retracted" : "extended" }
    changeView({ kind: "specimen", specimen: "rack", pose: next.tray === "extended" ? "service" : next.cutaway ? "cutaway" : "closed", rack: next })
  }
  const demoHref = facilitySelectionHref({ status: "ready", scenario: record.scenario, version: record.publication.version, perspective: "business" }, state.target?.equipmentId ? state.target : { system: state.selected ?? "workloads", ...(state.selected && state.selected !== "workloads" ? {} : { equipmentId: "rack-02" }) }, topic).split("#")[0]
  const motionStatus = facilityMotionStatus({ ready, loading, reducedMotion: state.reducedMotion, paused: state.paused, equipmentEnabled: state.equipmentEnabled, quality, view: activeView, readingHold: ambientHold })
  // Reserve the requested stage before its first frame. Committed identities and
  // controls still describe the usable old asset until the atomic scene swap.
  const layoutView = assetPhase === "failed" ? activeView : requestedView
  const rackActionsReady = ready && activeView.kind === "specimen" && activeView.specimen === "rack" && !!metadata.specimen?.rackMotion
  const reserveRackActions = ready && layoutView.kind === "specimen" && layoutView.specimen === "rack" && (rackActionsReady || release.profile.inspection?.mobileRackAspect !== undefined)
  const status = state.media.phase === "failed" ? "3D is unavailable. The assessment is still available." : loading ? "Preparing the facility view…" : ready ? "3D view ready. Select equipment or a system below." : "Static facility illustration. Select a system below."

  return (
    <section ref={container} className={`facility-inspection facility-inspection--${variant}${expanded ? " facility-inspection--expanded" : ""}`} data-testid="facility-inspection" data-phase={state.media.phase} data-failure={state.media.reason ?? undefined} data-release={release.release} data-night-inspection={nightInspection || undefined} data-detail={activeView.kind === "overview" ? activeView.detail : undefined} data-engineering={engineering || undefined} data-ecosystem={ecosystem || undefined} data-scenario={record.scenario} data-view={activeView.kind === "specimen" ? activeView.specimen : "overview"} data-pose={activeView.kind === "specimen" ? activeView.pose : undefined} data-quality={quality ?? undefined} data-preview-system={facilityPreviewTarget(state)?.system ?? facilityPreview(state) ?? undefined} aria-labelledby={headingId} aria-describedby={scopeId}
      onKeyDown={event => { if (event.key === "Escape" && (state.selected || state.pointerPreview || state.focusPreview || presentation.chapter !== null)) { event.preventDefault(); event.stopPropagation(); clearSelection() } }}>
      <div className="facility-heading" ref={heading}>
        <h2 id={headingId}>Illustrative system view</h2>
        <span className="facility-synthetic">Synthetic</span>
        <div className="facility-view-controls" ref={mediaControls}>
          {mode !== "poster" && !active && <button ref={activateButton} type="button" className="facility-action facility-action--activate" onClick={activateManually}>{state.media.phase === "failed" ? "Retry 3D" : "Explore in 3D"}<span aria-hidden="true">↗</span></button>}
          {active && <>
            {loading && <span className="facility-loading-label">Loading…</span>}
            {motionStatus.canPause && <button type="button" className="facility-action facility-icon-action" aria-label={state.paused ? "Resume" : "Pause"} title={state.paused ? "Resume animation" : "Pause animation"} aria-pressed={state.paused} disabled={!ready} onClick={() => setPaused(!state.paused)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{state.paused ? <path d="m9 5 10 7-10 7Z" /> : <><path d="M8 5v14" /><path d="M16 5v14" /></>}</svg>
            </button>}
            <details ref={displayOptions} className="facility-settings" onBlur={event => {
              // WebKit can focus the enclosing article before an internal click.
              // Pointer provenance distinguishes that fallback from navigation.
              if (!optionsPointerActive.current && event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
            }}>
              <summary ref={optionsButton} aria-label="Display options" title="Display options"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg><span className="sr-only">Display options</span></summary>
              <div className="facility-settings-panel">
                <p className="facility-state-label">{motionStatus.label}</p>
                <label className="facility-equipment"><input type="checkbox" checked={state.equipmentEnabled && !state.reducedMotion} disabled={state.reducedMotion || !ready} onChange={event => setEquipment(event.target.checked)} />Equipment motion</label>
                <button type="button" className="facility-action" onClick={close}>Use still image</button>
              </div>
            </details>
          </>}
        </div>
      </div>
        {reserveRackActions && <div className="facility-rack-handles facility-rack-handle-controls" role="group" aria-label="Rack handle actions" aria-hidden={!rackActionsReady || undefined} data-pending={!rackActionsReady || undefined}>

          {rackActionsReady && (["door", "tray"] as const).map((action, index) => <button key={action} type="button" className="facility-rack-handle" data-action={action} disabled={rackDetailActive} ref={element => { rackHandles.current[action] = element; if (element) element.hidden = !rackAnchorVisible.current[index] }} onClick={() => rackAction(action)}
            onPointerEnter={event => { if (event.pointerType !== "touch") previewTarget({ system: "workloads", partId: action === "door" ? "GN_RACK_DOOR" : "GN_RACK_TRAY" }, `handle-${action}`, "pointer") }} onPointerLeave={() => previewTarget(null, `handle-${action}`, "pointer")}
            onFocus={() => previewTarget({ system: "workloads", partId: action === "door" ? "GN_RACK_DOOR" : "GN_RACK_TRAY" }, `handle-${action}`, "focus")} onBlur={() => previewTarget(null, `handle-${action}`, "focus")}><span aria-hidden="true">＋</span>{action === "door" ? currentRack.door === "open" ? "Close rack" : "Open door" : currentRack.tray === "extended" ? "Retract tray" : "Extend tray"}</button>)}
        </div>}
      <div ref={stage} className="facility-stage" data-assembly={layoutView.kind === "specimen" ? layoutView.specimen : undefined} data-specimen-detail={activeView.kind === "specimen" ? activeView.detail : undefined} style={{ "--mobile-rack-aspect": release.profile.inspection?.mobileRackAspect ?? 4 / 3 } as CSSProperties} tabIndex={-1} role="group" aria-label={activeView.kind === "specimen" ? `Representative ${activeView.specimen} assembly${isRackServiceDetail(activeView) ? ": service connection cutaway" : ""}` : "Facility model"} aria-busy={loading || assetPhase === "loading"}>
        <picture className={`facility-poster${deferMobilePoster ? " facility-poster--deferred" : ""}`} hidden={ready || state.posterFailed}>
          <source media="(max-width: 639px)" srcSet={posterAcquisition.requested ? release.posters.mobile.url : FACILITY_POSTER_PLACEHOLDER} />
          {/* Approved, content-addressed posters must match the live renderer exactly. */}
          <img ref={poster} src={release.posters.desktop.url} width={1360} height={800} alt="Architectural cutaway of a synthetic data center: server racks, electrical distribution, cooling units, and reserve-storage cabinets." fetchPriority={variant === "hero" ? "high" : "auto"} decoding="async" onLoad={decodePoster} onError={decodePoster} />
        </picture>
        {deferMobilePoster && <noscript>
          <style>{".facility-poster--deferred{display:none!important}"}</style>
          <picture className="facility-poster">
            <source media="(max-width: 639px)" srcSet={release.posters.mobile.url} />
            <img src={release.posters.desktop.url} width={1360} height={800} alt="Architectural cutaway of a synthetic data center: server racks, electrical distribution, cooling units, and reserve-storage cabinets." decoding="async" />
          </picture>
        </noscript>}
        {state.posterFailed && !ready && <p className="facility-poster-unavailable">Facility illustration unavailable.<br />The assessment is available below.</p>}
        {active && mode !== "poster" && <div className={`facility-live${ready ? " facility-live--ready" : ""}`} aria-hidden="true">
          <FacilityScene readingHold={ambientHold} key={token.generation} release={release} generation={token.generation} selected={state.selected} preview={facilityPreview(state)} visible={visible} paused={state.paused} reducedMotion={state.reducedMotion} equipmentEnabled={state.equipmentEnabled} onStaged={onStaged} onPresented={onPresented} onFailure={fail} onSelect={onSelect} onPreview={onPreview} target={state.target} previewTarget={facilityPreviewTarget(state)} view={requestedView} onTarget={onTarget} onTargetPreview={onTargetPreview} onMetadata={onMetadata} onAssetState={onAssetState} onQuality={onQuality} onRackAnchors={onRackAnchors} motionRetry={motionRetry} assetRetry={assetRetry} presentation={ecosystem ? presentation : undefined} onPresentationCheckpoint={ecosystem ? onPresentationCheckpoint : undefined} />
        </div>}
      </div>
      {activeView.kind === "specimen" && engineering && variant === "demo" && ready && <Suspense fallback={<p className="facility-motion-note" role="status">Preparing inspection controls…</p>}><FacilityEngineeringControls release={release} record={record} ready={ready} activeView={activeView} requestedView={requestedView} assetPhase={assetPhase} metadata={metadata} target={state.target} previewTarget={facilityPreviewTarget(state)} presentation={diagramPresentation} expanded={expanded} walkthroughStep={walkthroughStep} onView={changeView} onReturn={returnToFacility} onTarget={selectTarget} onPreview={previewTarget} onExpand={expand} onWalkthrough={selectWalkthrough} onWalkthroughSystem={highlightWalkthroughSystem} onRetry={() => { revealStage(); pendingViewFocus.current = { view: requestedView, generation: token.generation, context: storyContext, from: document.activeElement }; setAssetRetry(value => value + 1) }} /></Suspense>}
      {state.media.phase === "failed" && <p className="facility-failure" role="status">3D could not be displayed. You can retry or keep inspecting the assessment below.</p>}
      
      {engineering && ready && quality === "still" && !state.reducedMotion && state.equipmentEnabled && !state.paused && <p className="facility-motion-note">Equipment motion is resting to keep interaction responsive. <button type="button" className="facility-action" onClick={() => setMotionRetry(value => value + 1)}>Try motion again</button></p>}
      <fieldset className="facility-systems">
        <legend className="sr-only">Inspect a facility system</legend>
        {FACILITY_SYSTEMS.map((system, index) => <button key={system} ref={element => { systemButtons.current[system] = element }} type="button" aria-pressed={state.selected === system} data-preview={facilityPreviewTarget(state)?.system === system || facilityPreview(state) === system || undefined} aria-controls={panelId} onClick={() => selectTarget({ system })}
          onPointerEnter={event => { if (event.pointerType !== "touch" && event.buttons === 0) dispatch({ type: "preview", channel: "pointer", owner: `control-${system}`, system }) }}
          onPointerLeave={() => dispatch({ type: "preview-end", channel: "pointer", owner: `control-${system}` })}
          onFocus={event => { if (suppressFocusPreview.current !== system && event.currentTarget.matches(":focus-visible")) dispatch({ type: "preview", channel: "focus", owner: `control-${system}`, system }) }}
          onBlur={() => { suppressFocusPreview.current = null; dispatch({ type: "preview-end", channel: "focus", owner: `control-${system}` }) }}>
          <span className="facility-system-number" aria-hidden="true">0{index + 1}</span>{FACILITY_LABELS[system]}
        </button>)}
      </fieldset>
      <div id={panelId} className="facility-explanation" data-system={state.selected ?? "overview"}>
        <div className="facility-explanation-heading">
          <div className="facility-explanation-titles">{(nightInspection ? [description] : explanations).map(item => <strong key={item.system} aria-hidden={item.system !== explanationState || undefined} inert={item.system !== explanationState} style={{ visibility: item.system !== explanationState ? "hidden" : undefined }}>{item.label}</strong>)}</div>
          <button type="button" className="facility-clear" disabled={!state.selected && !state.pointerPreview && !state.focusPreview} onClick={clearSelection}>Clear selection</button>
        </div>
        {/* Inactive copies size this grid at the current width without entering the accessibility tree. */}
        <div className="facility-explanation-copy">{(nightInspection ? [description] : explanations).map(item => <p key={item.system} data-explanation={item.system} aria-hidden={item.system !== explanationState || undefined} inert={item.system !== explanationState} style={{ visibility: item.system !== explanationState ? "hidden" : undefined }}>{item.equipment && <span className="facility-equipment-identification">{item.equipment} </span>}{item.body}</p>)}</div>
        {variant === "demo" && targetLabel && <div className="facility-target-connections"><p className="facility-target-label">{state.target?.partId ? "Selected part" : state.target?.routeId ? "Selected connection" : "Selected equipment"}: {targetLabel}</p>{targetRole && <p>Physical role: {targetRole.replaceAll("_", " ")}</p>}{targetConnections.length > 0 ? <><p>Authored connections</p><ul>{targetConnections.map(connection => <li key={connection.target.partId ?? connection.target.equipmentId ?? connection.target.routeId}><button type="button" className="facility-action" onClick={() => { pendingConnectionFocus.current = connection.target; selectTarget(connection.target) }}>{connection.label}</button></li>)}</ul></> : <p>{!metadata.topology && !metadata.specimen ? mode === "poster" ? "Connection details are not available in this still illustration." : "Authored connection details are available after the 3D model loads." : "No adjacent connection is authored for this selection."}</p>}</div>}
        {obscuredRack && <div className="facility-target-connections" data-testid="facility-rack-occlusion" role="note">
          <p className="facility-target-label">In-place detail: {obscuredRack.label}</p>
          <p>Front-row equipment obscures this in-place view. Inspect the separate representative rack assembly for an unobstructed construction view.</p>
          {variant === "demo" ? <button type="button" className="facility-action" disabled={!ready || assetPhase === "loading"} onClick={() => changeView({ kind: "specimen", specimen: "rack", pose: "closed" })}>Open representative rack assembly</button> : <a className="facility-evidence-link" href={constructionHref!}>Inspect representative rack construction in the demo <span aria-hidden="true">↗</span></a>}
        </div>}
        {nightInspection && variant === "demo" && state.target && <FacilityContextualInspector onReadingHoldChange={setContextualReadingHold} variant={variant} record={record} target={state.target} topic={topic} />}
        {!nightInspection && variant === "demo" && <a className="facility-evidence-link" href={view.links.brief}>Inspect this published decision brief <span aria-hidden="true">↗</span></a>}
      </div>
      {nightInspection && variant === "demo" && activeView.kind === "overview" && <div id="facility-construction" tabIndex={-1} className="facility-detail-tools" aria-label="Construction details">
        {mode === "poster" ? <p className="facility-motion-note">This example uses a still illustration. Select a system or equipment identity to inspect its role and assessment evidence.</p> : <>
        {!ready && <div><p className="facility-motion-note">Load the facility to inspect construction. Opening a representative assembly is a separate, explicit download.</p><button className="facility-action" type="button" disabled={active} onClick={activateManually}>{active ? "Loading facility…" : "Load 3D to inspect construction"}</button></div>}
        <button className="facility-action" type="button" disabled={!ready} aria-pressed={activeView.kind === "overview" && activeView.detail === "rack"} onClick={() => changeView({ kind: "overview", detail: "rack", equipmentId: state.target?.equipmentId?.startsWith("rack-") ? state.target.equipmentId : "rack-02" })}>View rack close-up</button>
        <button className="facility-action" type="button" disabled={!ready} aria-pressed={activeView.kind === "overview" && activeView.detail === "air-path"} onClick={() => changeView({ kind: "overview", detail: "air-path", section: "air-path" })}>View air-path cutaway</button>
        {(activeView.detail || activeView.section) && <button className="facility-action" type="button" disabled={!ready} onClick={() => changeView({ kind: "overview" })}>Return to overview</button>}
        </>}
      </div>}
      {activeView.kind !== "specimen" && engineering && variant === "demo" && ready && <Suspense fallback={<p className="facility-motion-note" role="status">Preparing inspection controls…</p>}><FacilityEngineeringControls release={release} record={record} ready={ready} activeView={activeView} requestedView={requestedView} assetPhase={assetPhase} metadata={metadata} target={state.target} previewTarget={facilityPreviewTarget(state)} presentation={diagramPresentation} expanded={expanded} walkthroughStep={walkthroughStep} onView={changeView} onReturn={returnToFacility} onTarget={selectTarget} onPreview={previewTarget} onExpand={expand} onWalkthrough={selectWalkthrough} onWalkthroughSystem={highlightWalkthroughSystem} onRetry={() => { revealStage(); pendingViewFocus.current = { view: requestedView, generation: token.generation, context: storyContext, from: document.activeElement }; setAssetRetry(value => value + 1) }} /></Suspense>}
      {nightInspection && variant === "demo" && release.equipmentIndex && <details className="facility-public-equipment"><summary>Equipment identities</summary><p>Authored illustrative equipment. Choose an item to inspect its role; selection does not change the assessment.</p><div>{release.equipmentIndex.equipment.filter(item => !state.selected || item.system === state.selected).map(item => <button key={item.id} type="button" className="facility-action" data-public-equipment-id={item.id} aria-pressed={state.target?.equipmentId === item.id} onClick={() => selectTarget({ system: item.system, equipmentId: item.id })}>{item.label}<span className="sr-only"> · {item.role.replaceAll("_", " ")}</span></button>)}</div></details>}
      {ecosystem && variant === "demo" && <div id="workload-story" tabIndex={-1}><FacilityEcosystemStory record={record} presentation={presentation} rackLabel={ecosystemRackLabel(presentation.rackId, metadata.topology)} motionUnavailable={motionUnavailable} ready={ready && assetPhase === "ready"} sectionOpen={sectionOpen} onOpen={openStory} onExit={exitStory} onChapter={seekStory} onPlaying={playStory} onReplay={() => seekStory(0, true)} onSection={toggleSection} /></div>}

      {showAssessmentCaption && <div className="facility-assessment-caption" data-testid="facility-assessment-caption">
        <div className="facility-result-heading"><span>{facilityWindowLabel(record)}</span><span className="facility-outcome">Model screen: {view.screeningOutcome}</span></div>
        <dl className="facility-quantities"><div><dt>Requested increment</dt><dd>{view.requested}</dd></div><div><dt>Modeled eligible increment</dt><dd>{view.modeled}</dd></div></dl>
        <p>Additional to the {view.reference} reference.</p>
      </div>}
      {variant === "hero" && <nav className="facility-journeys" aria-label="Continue facility inspection"><a href={`${demoHref}#facility-construction`}>Inspect rack construction <span aria-hidden="true">→</span></a><a href={`${demoHref}#workload-story`}>Follow one workload <span aria-hidden="true">→</span></a></nav>}
      <p id={scopeId} className="facility-scope">Synthetic illustration · Economics unestimated.<br />No site action is authorized. Accepted and delivered capacity: not applicable.</p>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status} {state.selected ? `${FACILITY_LABELS[state.selected]} selected. ${description.label}.` : ""}</p>
      <noscript><p className="facility-motion-note">This is a static illustration. Read the assessment below for the modeled result and its evidence.</p></noscript>
    </section>
  )
}
