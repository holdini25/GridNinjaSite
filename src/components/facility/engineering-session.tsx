"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useFrame, useStore, useThree } from "@react-three/fiber"
import { Mesh, OrthographicCamera, PerspectiveCamera, Quaternion, Raycaster, Vector2, Vector3, type Intersection, type Object3D } from "three"
import type { FacilityCanvasProps, FacilityInspectionTarget, FacilityQuality, FacilityView } from "@/types/facility"
import type { FacilityModel } from "@/lib/facility/asset-runtime"
import { stageFacility, stageReplacement } from "@/lib/facility/render-session"
import { prewarmFacilityModel } from "@/lib/facility/shader-prewarm"
import type { StudioEnvironment } from "@/lib/facility/render-environment"
import { createEcosystemActivity } from "@/lib/facility/ecosystem-activity"
import { createLedActivity, createRouteActivity } from "@/lib/facility/activity"
import { configureSurfaceSampling, validateEcosystemUniformBudget } from "@/lib/facility/engineering-materials"
import { surfaceHitVisible } from "@/lib/facility/surface-coverage"
import { cappedDpr, createFrameScheduler, createQualityHistory, createQualityPolicy, equipmentMotionAllowed, missedFrameSlotRatio, resetFrameMeasurementWindow, type FramePolicySample, type ScheduledFrame } from "@/lib/facility/frame-policy"
import { createTopologyIndex } from "@/lib/facility/topology-runtime"
import { applyCameraFrame, applySpecimenPose, compatibleCameraFrames, copyCameraFrame, createCameraForFrame, isPerspectiveFrame, inspectionCamera, inspectionHit, interpolateCamera, isObjectVisible, refitCameraFrame, updateLedAnchors, type CameraFrame, type FacilityRuntimeCamera } from "@/lib/facility/inspection-camera"
import { rackServiceCommandError } from "@/lib/facility/rack-service-view"
import { cancelGesture, canvasNdc, pointerDown, pointerMove, pointerUp, type Gesture } from "@/lib/facility/gesture"
import { createRackMotion, rackTarget } from "@/lib/facility/rack-motion"
import { createStationaryProbe } from "@/lib/facility/stationary-probe"
import { createFiniteLight } from "@/lib/facility/finite-light"
import { waitForRenderViewport } from "@/lib/facility/render-viewport"

type Transition = { from: CameraFrame; to: CameraFrame; elapsed: number; duration: number; parts: { object: Object3D; from: Vector3; to: Vector3; fromVisible: boolean; visible: boolean }[]; view: FacilityView; epoch: number }
type Swap = { old: FacilityModel; frame: CameraFrame; view: FacilityView; epoch: number; deadline: number }
const overview: FacilityView = { kind: "overview" }
const noRackAnchors = Object.freeze([])
const viewAsset = (view: FacilityView) => view.kind === "overview" ? "overview" : view.specimen
const targetKey = (target: FacilityInspectionTarget | null | undefined) => target ? `${target.system}/${target.equipmentId ?? ""}/${target.routeId ?? ""}/${target.partId ?? ""}` : ""
const ease = (value: number) => value * value * (3 - 2 * value)
function blendWeights(weights: Float32Array, selected: readonly number[], preview: readonly number[], previewWeight: number, blend: number, snap: boolean) {
  let settling = false
  for (let i = 0; i < weights.length; i++) {
    const target = selected.includes(i) ? 1 : preview.includes(i) ? previewWeight : 0, difference = target - weights[i]
    weights[i] = snap || Math.abs(difference) < .002 ? target : weights[i] + difference * blend
    if (Math.abs(weights[i] - target) >= .002) settling = true
  }
  return settling
}

function blendPresentationWeights(weights: Float32Array, targets: Float32Array, activity: Float32Array, blend: number, snap: boolean) {
  let settling = false
  for (let index = 0; index < weights.length; index++) {
    const target = Math.max(targets[index], activity[index]), difference = target - weights[index]
    weights[index] = snap || Math.abs(difference) < .002 ? target : weights[index] + difference * blend
    if (Math.abs(weights[index] - target) >= .002) settling = true
  }
  return settling
}

/** V4's single graphics/session owner. Legacy releases keep their existing renderer. */
export function EngineeringSession(props: FacilityCanvasProps & { onDpr: (value: number) => void }) {
  const { gl, camera, scene, size, advance, setDpr } = useThree()
  const store = useStore()
  // The manual frame owner also owns the active projection. Switching cameras
  // neither remounts the canvas nor changes renderer/environment ownership.
  const activeCamera = useRef(camera as FacilityRuntimeCamera)
  const perspectiveCamera = useRef<PerspectiveCamera | null>(null)
  const mobileComposition = () => window.matchMedia("(max-width: 639px)").matches
  const commitCamera = (frame: CameraFrame) => {
    if (isPerspectiveFrame(frame)) {
      perspectiveCamera.current ??= new PerspectiveCamera()
      activeCamera.current = perspectiveCamera.current
    } else activeCamera.current = camera as OrthographicCamera
    applyCameraFrame(activeCamera.current, frame)
  }
  const latest = useRef(props)
  latest.current = props
  const dimensions = useRef(size)
  dimensions.current = size
  const [initialized, setInitialized] = useState(0)
  const runtime = useRef({
    model: null as FacilityModel | null, environment: null as StudioEnvironment | null,
    finiteLight: null as ReturnType<typeof createFiniteLight> | null,
    view: overview, desired: overview, frame: null as CameraFrame | null, transition: null as Transition | null, swap: null as Swap | null,
    epoch: 0, pending: null as AbortController | null, deadlineTimer: null as ReturnType<typeof setTimeout> | null,
    initialPresented: false, disposed: false, frames: 0, activeSeconds: 0, animationSeconds: 0,
    scheduled: { activeSeconds: 0, delta: 0, interval: 0, targetFps: 30 } as ScheduledFrame,
    intervals: new Float32Array(120), costs: new Float32Array(120), cursor: 0, samples: 0, frameP95: null as number | null, cpuP95: null as number | null,
    recent: Array.from({ length: 120 }, () => ({ interval: 0, targetFps: 30, cpu: 0, at: 0 } as FramePolicySample & { at: number })), recentCount: 0, recentCursor: 0, evaluatedAt: 0, windowStartedAt: 0, quality: "economy" as FacilityQuality, desktop: false, interactionUntil: 0,
    cameraWorking: { position: new Vector3(), target: new Vector3(), left: 0, right: 0, top: 0, bottom: 0, fitWidth: 0, fitHeight: 0 } as CameraFrame,
    scheduleConfig: { visible: false, moving: false, fps: 30 },
    ecosystemActivity: null as ReturnType<typeof createEcosystemActivity> | null, section: false, inspectionKey: "",
    rackMotion: null as ReturnType<typeof createRackMotion> | null, rackReady: null as { view: FacilityView; epoch: number } | null,
    selectionEquipment: new Float32Array(0), selectionRoutes: new Float32Array(0),
    ledActivity: null as ReturnType<typeof createLedActivity> | null, routeActivity: null as ReturnType<typeof createRouteActivity> | null,
    index: null as ReturnType<typeof createTopologyIndex> | null,
    selectedEquipment: [] as number[], selectedRoutes: [] as number[], previewEquipment: [] as number[], previewRoutes: [] as number[],
    sortedIntervals: new Float32Array(120), sortedCosts: new Float32Array(120), renderedModel: null as FacilityModel | null,
    probes: new WeakSet<FacilityModel>(),
    assetError: null as string | null, reviewDpr: null as 1 | 1.5 | null,
    qualityHistory: createQualityHistory(), hiddenFrameCount: 0,
    rotation: new Quaternion(), previousMotion: false, stationaryProbe: createStationaryProbe(), capability: null as 30 | 60 | null, assetFailure: null as ((reason: string) => void) | null,
  })
  const scheduler = useRef<ReturnType<typeof createFrameScheduler> | null>(null)
  const quality = useRef<ReturnType<typeof createQualityPolicy> | null>(null)
  const probe = props.release.profile.engineering!

  const notifyReady = (view: FacilityView, epoch: number) => {
    const state = runtime.current
    if (state.disposed || epoch !== state.epoch || !state.model) return
    if (state.deadlineTimer) clearTimeout(state.deadlineTimer)
    state.deadlineTimer = null
    state.view = view; state.assetError = null
    latest.current.onMetadata?.(state.model.metadata)
    latest.current.onAssetState?.({ phase: "ready", view })
  }
  const selectTargets = () => {
    const state = runtime.current, current = latest.current
    if (!state.index) return
    const selected = state.index.resolve(current.target ?? (current.selected ? { system: current.selected } : null))
    const preview = state.index.resolve(current.previewTarget ?? (current.preview ? { system: current.preview } : null))
    state.selectedEquipment = selected.equipment; state.selectedRoutes = selected.routes
    state.previewEquipment = preview.equipment; state.previewRoutes = preview.routes
    state.routeActivity?.focus(selected.routes, preview.routes)
    if (state.ecosystemActivity) {
      state.selectionEquipment.fill(0); state.selectionRoutes.fill(0)
      for (const index of preview.equipment) state.selectionEquipment[index] = probe.accent.previewWeight
      for (const index of preview.routes) state.selectionRoutes[index] = probe.accent.previewWeight
      for (const index of selected.equipment) state.selectionEquipment[index] = 1
      for (const index of selected.routes) state.selectionRoutes[index] = 1
      const target = current.previewTarget ?? (current.preview ? { system: current.preview } : null) ?? current.target ?? (current.selected ? { system: current.selected } : null)
      const key = targetKey(target)
      if (key !== state.inspectionKey) { state.inspectionKey = key; state.ecosystemActivity.focus(target, state.animationSeconds) }
    }
  }
  const bindModel = (model: FacilityModel) => {
    const state = runtime.current
    state.model = model; state.index = createTopologyIndex(model.metadata)
    state.finiteLight?.bind(model.profile.lighting.finite)
    configureSurfaceSampling(model.engineering, gl, state.quality)
    validateEcosystemUniformBudget(model.engineering, gl)
    state.ecosystemActivity = model.profile.ecosystem ? createEcosystemActivity(model.metadata.topology!, model.profile.ecosystem, checkpoint => {
      if (!state.disposed && state.model === model && latest.current.presentation?.revision === checkpoint.revision) latest.current.onPresentationCheckpoint?.(checkpoint)
    }) : null
    state.ecosystemActivity?.command(latest.current.presentation)
    state.rackMotion = model.metadata.specimen?.rackMotion ? createRackMotion(model.metadata.specimen.rackMotion, model.ids) : null
    if (!state.rackMotion) latest.current.onRackAnchors?.(noRackAnchors)
    state.selectionEquipment = new Float32Array(state.ecosystemActivity ? model.engineering!.equipmentWeights.length : 0)
    state.selectionRoutes = new Float32Array(state.ecosystemActivity ? model.engineering!.routeWeights.length : 0)
    if (state.ecosystemActivity && !state.probes.has(model)) {
      const bytes = state.ecosystemActivity.retainedBytes + state.selectionEquipment.byteLength + state.selectionRoutes.byteLength
      model.statistics.estimatedBytes += bytes; model.statistics.peakEstimatedBytes += bytes
      if (model.statistics.peakEstimatedBytes > 32 * 1024 * 1024) throw new Error("ecosystem_resource_budget")
    }
    if (state.rackMotion && !state.probes.has(model)) {
      model.statistics.estimatedBytes += state.rackMotion.retainedBytes; model.statistics.peakEstimatedBytes += state.rackMotion.retainedBytes
      if (model.statistics.peakEstimatedBytes > 32 * 1024 * 1024) throw new Error("rack_motion_resource_budget")
    }
    state.section = false; state.inspectionKey = ""
    for (const cover of model.sectionCovers) cover.visible = true
    state.ledActivity = createLedActivity(model.leds.count, probe)
    const topology = model.metadata.topology
    const ambientRoutes = topology?.routes.filter(route => route.system !== "storage" && [route.from, route.to].every(portId => topology.equipment.find(item => item.id === topology.ports.find(port => port.id === portId)?.equipmentId)?.system !== "storage")).map(route => route.index) ?? []
    state.routeActivity = createRouteActivity(topology?.routes.length ?? 0, probe, ambientRoutes)
    if (!state.probes.has(model)) {
      if (state.finiteLight) {
        model.statistics.estimatedBytes += state.finiteLight.retainedBytes
        model.statistics.peakEstimatedBytes += state.finiteLight.retainedBytes
        if (model.statistics.peakEstimatedBytes > 32 * 1024 * 1024) throw new Error("finite_light_resource_budget")
      }
      state.probes.add(model)
      model.scene.traverse(object => {
        if (!(object instanceof Mesh)) return
        const original = object.onAfterRender
        object.onAfterRender = function (renderer, scene, camera, geometry, material, group) { original.call(this, renderer, scene, camera, geometry, material, group); state.renderedModel = model }
      })
    }
    state.animationSeconds = 0; state.previousMotion = false
    selectTargets()
  }
  const configure = () => {
    const state = runtime.current, current = latest.current
    const presentation = state.transition?.view ?? (state.swap ? state.desired : state.view)
    const closed = state.rackMotion ? state.rackMotion.closed : presentation.kind === "overview" || presentation.pose === "closed"
    const transitioning = !!state.transition || !!state.rackMotion?.moving || state.activeSeconds < state.interactionUntil
    const probing = state.stationaryProbe.configure(current.visible && !!state.model && closed && !transitioning && !state.swap && current.equipmentEnabled && !current.paused && !current.reducedMotion && !current.readingHold)
    const motion = closed && equipmentMotionAllowed(current.equipmentEnabled, current.paused, current.reducedMotion, state.quality, state.capability, current.readingHold) && !state.stationaryProbe.pending && (!state.ecosystemActivity?.guided || state.ecosystemActivity.playing)
    const highCadence = transitioning && (state.quality === "balanced" || state.quality === "high")
    state.scheduleConfig.visible = current.visible && !!state.model
    state.scheduleConfig.moving = motion || transitioning || probing
    state.scheduleConfig.fps = state.capability ?? (highCadence ? 60 : 30)
    scheduler.current?.configure(state.scheduleConfig)
  }
  const updateDpr = () => {
    const state = runtime.current
    const dpr = cappedDpr(state.reviewDpr === null ? state.quality : state.reviewDpr === 1.5 ? "high" : "economy", state.reviewDpr ?? (window.devicePixelRatio || 1), dimensions.current.width, dimensions.current.height, state.desktop ? probe.rendering.desktopPixels : probe.rendering.mobilePixels)
    configureSurfaceSampling(state.model?.engineering, gl, state.quality)
    setDpr(dpr); latest.current.onDpr(dpr)
  }
  const settleViewport = async (signal: AbortSignal) => {
    const container = gl.domElement.parentElement
    if (!container) throw new Error("facility_viewport_unavailable")
    dimensions.current = await waitForRenderViewport(container, () => store.getState().size, store.subscribe, signal)
    signal.throwIfAborted()
    updateDpr()
  }

  useEffect(() => {
    const state = runtime.current
    state.disposed = false
    if (props.release.profile.lighting.finite) state.finiteLight = createFiniteLight(scene, props.release.profile.lighting.finite)
    state.desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches
    quality.current = createQualityPolicy(state.desktop, (tier, reason) => {
      state.qualityHistory.record({ activeSeconds: state.activeSeconds, reason, from: state.quality, to: tier })
      state.quality = tier; resetFrameMeasurementWindow(state)
      latest.current.onQuality?.(tier, reason)
      updateDpr(); configure()
    })
    state.quality = quality.current.tier
    state.qualityHistory.record({ activeSeconds: state.activeSeconds, reason: "conservative-startup", from: null, to: state.quality })
    state.stationaryProbe.reset(state.desktop ? 0 : probe.rendering.probeSeconds)
    latest.current.onQuality?.(state.quality, "conservative-startup")
    scheduler.current = createFrameScheduler({ now: () => performance.now(), raf: callback => window.requestAnimationFrame(callback), cancelRaf: id => window.cancelAnimationFrame(id), timer: (callback, delay) => window.setTimeout(callback, delay), cancelTimer: id => window.clearTimeout(id) }, frame => {
      state.scheduled = frame; state.activeSeconds = frame.activeSeconds
      advance(frame.activeSeconds, false)
    })
    const controller = new AbortController()
    const lost = (event: Event) => {
      event.preventDefault()
      if (props.release.profile.ecosystem) { controller.abort(); state.pending?.abort() }
      latest.current.onFailure("The graphics connection was interrupted. You can retry.")
    }
    gl.domElement.addEventListener("webglcontextlost", lost)
    void stageFacility(props.release, gl, controller.signal).then(async result => {
      if (state.disposed || controller.signal.aborted) { result.dispose(); return }
      let stagingOwned = true
      const disposeStaging = () => {
        if (!stagingOwned) return
        stagingOwned = false
        if (scene.environment === result.environment?.texture) scene.environment = null
        result.dispose()
      }
      try {
        if (result.environment) {
          scene.environment = result.environment.texture
          scene.environmentIntensity = props.release.profile.lighting.environment!.intensity
          scene.environmentRotation.y = props.release.profile.lighting.environment!.rotationY
        }
        if (props.release.profile.ecosystem) {
          configureSurfaceSampling(result.model.engineering, gl, state.quality)
          validateEcosystemUniformBudget(result.model.engineering, gl)
          const stagingCamera = createCameraForFrame(inspectionCamera(result.model, overview, dimensions.current.width, dimensions.current.height, mobileComposition()))
          await prewarmFacilityModel(gl, { scene: result.model.scene, dispose: disposeStaging }, stagingCamera, scene, controller.signal, () => !state.disposed)
          if (state.disposed || controller.signal.aborted) { disposeStaging(); return }
        }
        // Ownership moves only after preparation. The poster stays until the
        // current model passes the existing actual first-frame probe.
        await settleViewport(controller.signal)
        if (state.disposed || controller.signal.aborted) { disposeStaging(); return }
        state.environment = result.environment
        bindModel(result.model); scene.add(result.model.scene)
        stagingOwned = false
        state.frame = inspectionCamera(result.model, overview, dimensions.current.width, dimensions.current.height, mobileComposition())
        commitCamera(state.frame)
        updateDpr(); latest.current.onStaged(); setInitialized(value => value + 1); configure(); scheduler.current?.request()
      } catch (error) { disposeStaging(); throw error }
    }).catch(() => { if (!state.disposed && !controller.signal.aborted) latest.current.onFailure("The interactive model could not load. You can retry.") })
    return () => {
      state.disposed = true; controller.abort(); state.pending?.abort()
      if (state.deadlineTimer) clearTimeout(state.deadlineTimer)
      scheduler.current?.dispose(); scheduler.current = null
      state.swap?.old.dispose(); state.swap = null
      state.model?.dispose(); state.model = null
      if (scene.environment === state.environment?.texture) scene.environment = null
      state.environment?.dispose(); state.environment = null
      state.finiteLight?.dispose(); state.finiteLight = null
      gl.domElement.removeEventListener("webglcontextlost", lost)
      delete gl.domElement.__gnFacilitySnapshot
      delete gl.domElement.__gnFacilityCapability
      delete gl.domElement.__gnFacilityReviewDpr
      state.reviewDpr = null
    }
    // Session ownership is keyed by the outer graphics generation, not transient presentation props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.release, props.generation, gl, scene, advance])

  useLayoutEffect(() => {
    const state = runtime.current
    if (!state.model) return
    updateDpr()
    if (state.transition) {
      const transition = state.transition
      refitCameraFrame(transition.from, size.width, size.height); refitCameraFrame(transition.to, size.width, size.height)
      const weight = props.paused || props.reducedMotion || state.quality === "still" || !transition.duration ? 1 : Math.min(1, transition.elapsed / transition.duration)
      state.frame = interpolateCamera(transition.from, transition.to, ease(weight), state.cameraWorking)
    } else if (state.frame) {
      if (state.view.kind === "overview" && state.model.profile.inspection) state.frame = inspectionCamera(state.model, state.view, size.width, size.height, mobileComposition())
      else refitCameraFrame(state.frame, size.width, size.height)
    }
    if (state.swap) refitCameraFrame(state.swap.frame, size.width, size.height)
    if (state.frame) commitCamera(state.frame)
    scheduler.current?.request()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, initialized])

  useEffect(() => {
    if (!props.release.profile.inspection) return
    const media = window.matchMedia("(max-width: 639px)")
    const changed = () => {
      const state = runtime.current
      if (!state.model || state.view.kind !== "overview" || state.swap) return
      if (state.transition) {
        if (state.transition.view.kind === "overview") state.transition.to = inspectionCamera(state.model, state.transition.view, dimensions.current.width, dimensions.current.height, media.matches)
        scheduler.current?.request()
        return
      }
      state.frame = inspectionCamera(state.model, state.view, dimensions.current.width, dimensions.current.height, media.matches)
      commitCamera(state.frame); scheduler.current?.request()
    }
    media.addEventListener("change", changed)
    return () => media.removeEventListener("change", changed)
    // Camera and model are session-owned; only the responsive media event changes framing here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.release])

  useEffect(() => {
    if (!initialized || !runtime.current.model) return
    const state = runtime.current, requested = props.view ?? overview
    const serviceError = rackServiceCommandError(requested, state.view, state.transition?.view ?? null, state.rackMotion?.snapshot() ?? null, Boolean(state.model!.metadata.specimen?.rackMotion?.serviceDetail))
    if (serviceError) { latest.current.onAssetState?.({ phase: "failed", view: requested, reason: serviceError }); return }
    const epoch = ++state.epoch
    state.desired = requested; state.pending?.abort(); state.pending = null
    state.rackReady = null
    if (state.deadlineTimer) clearTimeout(state.deadlineTimer)
    if (state.swap) { state.model?.dispose(); bindModel(state.swap.old); state.model!.scene.visible = true; state.frame = state.swap.frame; state.view = state.swap.view; state.swap = null; commitCamera(state.frame); gl.toneMappingExposure = state.model!.profile.exposure }
    state.transition = null
    latest.current.onAssetState?.({ phase: "loading", view: requested })
    const fail = (reason: string) => {
      if (state.epoch !== epoch || state.disposed) return
      state.pending?.abort(); state.pending = null
      if (state.swap) {
        state.model?.dispose(); const prior = state.swap; bindModel(prior.old); prior.old.scene.visible = true
        state.frame = prior.frame; state.view = prior.view; state.swap = null; commitCamera(prior.frame); gl.toneMappingExposure = prior.old.profile.exposure
      }
      if (state.transition && state.model) { applySpecimenPose(state.model, state.view); state.frame = state.transition.from; commitCamera(state.frame) }
      if (state.rackMotion) state.rackMotion.setTarget(rackTarget(state.view), true)
      state.rackReady = null
      state.transition = null; state.assetError = reason; latest.current.onAssetState?.({ phase: "failed", view: requested, reason })
      configure(); scheduler.current?.request()
    }
    state.assetFailure = fail
    // Loaded rack joints use visible active time. A hidden tab must not roll
    // their transforms back merely because an asset-transfer deadline elapsed.
    if (!state.rackMotion || viewAsset(requested) !== viewAsset(state.view)) state.deadlineTimer = setTimeout(() => fail("The requested view did not become ready within eight seconds."), 8_000)
    if (viewAsset(requested) === viewAsset(state.view)) {
      const model = state.model!
      const parts = requested.kind === "specimen" && !state.rackMotion ? model.metadata.specimen!.poses[requested.pose].transforms.map(transform => ({ object: model.ids.get(transform.id)!, from: model.ids.get(transform.id)!.position.clone(), to: new Vector3(...transform.position), fromVisible: model.ids.get(transform.id)!.visible, visible: transform.visible })) : []
      if (state.rackMotion) {
        state.rackMotion.setTarget(rackTarget(requested), props.paused || props.reducedMotion || !props.equipmentEnabled || state.quality === "still")
        state.rackReady = { view: requested, epoch }
      } else applySpecimenPose(model, requested)
      const to = inspectionCamera(model, requested, dimensions.current.width, dimensions.current.height, mobileComposition())
      const sameRackCamera = !!state.rackMotion && state.frame!.position.distanceToSquared(to.position) < 1e-12 && state.frame!.target.distanceToSquared(to.target) < 1e-12 && Math.abs(state.frame!.fitWidth - to.fitWidth) + Math.abs(state.frame!.fitHeight - to.fitHeight) < 1e-9
      const duration = props.reducedMotion || props.paused || state.quality === "still" || (!!state.rackMotion && !props.equipmentEnabled) || sameRackCamera || !compatibleCameraFrames(state.frame!, to) ? 0 : (state.rackMotion ? 420 : parts.length ? probe.poseTransitionMs : probe.cameraTransitionMs) / 1000
      for (const part of parts) { part.object.position.copy(part.from); part.object.visible = part.fromVisible || part.visible }
      state.transition = { from: copyCameraFrame(state.frame!), to, elapsed: 0, duration, parts, view: requested, epoch }
      configure(); scheduler.current?.request()
    } else {
      const controller = new AbortController(); state.pending = controller
      const deadline = performance.now() + 8_000
      void stageReplacement(props.release, requested.kind === "specimen" ? requested.specimen : undefined, state.model!, state.environment, controller.signal).then(async model => {
        if (controller.signal.aborted || state.disposed || epoch !== state.epoch) { model.dispose(); return }
        let stagingOwned = true
        const disposeStaging = () => { if (stagingOwned) { stagingOwned = false; model.dispose() } }
        if (props.release.profile.ecosystem) {
          try {
            applySpecimenPose(model, requested)
            configureSurfaceSampling(model.engineering, gl, state.quality)
            validateEcosystemUniformBudget(model.engineering, gl)
            const stagingCamera = createCameraForFrame(inspectionCamera(model, requested, dimensions.current.width, dimensions.current.height, mobileComposition()))
            await prewarmFacilityModel(gl, { scene: model.scene, dispose: disposeStaging }, stagingCamera, scene, controller.signal, () => !state.disposed && epoch === state.epoch)
          } catch (error) { disposeStaging(); throw error }
          if (controller.signal.aborted || state.disposed || epoch !== state.epoch) { disposeStaging(); return }
        }
        // The HTML shell reserves the destination aspect before loading. Read
        // that final box once and await the existing ResizeObserver/Canvas owner.
        // The old scene stays owned/usable while its final size is pending.
        try { await settleViewport(controller.signal) } catch (error) { disposeStaging(); throw error }
        if (controller.signal.aborted || state.disposed || epoch !== state.epoch) { disposeStaging(); return }
        const previous = state.model!
        state.swap = { old: previous, frame: state.frame!, view: state.view, epoch, deadline }
        previous.scene.visible = false
        applySpecimenPose(model, requested); bindModel(model); scene.add(model.scene)
        stagingOwned = false
        state.frame = inspectionCamera(model, requested, dimensions.current.width, dimensions.current.height, mobileComposition()); commitCamera(state.frame)
        gl.toneMappingExposure = model.profile.exposure
        configure(); scheduler.current?.request()
      }).catch(error => { if (!controller.signal.aborted) { fail("That equipment view could not load. The previous view is still available."); state.assetError = error instanceof Error ? error.message : String(error) } })
    }
    return () => { state.pending?.abort(); if (state.deadlineTimer) clearTimeout(state.deadlineTimer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, props.view?.kind, props.view?.kind === "overview" ? props.view.system : props.view?.specimen, props.view?.kind === "overview" ? props.view.section : undefined, props.view?.detail, props.view?.kind === "overview" ? props.view.equipmentId : undefined, props.view?.kind === "specimen" ? props.view.pose : undefined, props.view?.kind === "specimen" ? props.view.rack?.door : undefined, props.view?.kind === "specimen" ? props.view.rack?.tray : undefined, props.view?.kind === "specimen" ? props.view.rack?.cutaway : undefined, props.assetRetry])

  useLayoutEffect(() => {
    const state = runtime.current
    selectTargets()
    if (!props.paused && !props.reducedMotion) state.interactionUntil = state.activeSeconds + .75
    else state.interactionUntil = 0
    configure(); scheduler.current?.request()
     
    // Selection updates consume current mutable refs; session ownership stays stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected, props.preview, props.target, props.previewTarget, props.visible, props.paused, props.reducedMotion, props.equipmentEnabled])
  useLayoutEffect(() => {
    configure(); scheduler.current?.request()
    // Reading holds stop activity without restarting selection traces or storing a preference.
  }, [props.readingHold])
  useLayoutEffect(() => {
    const state = runtime.current
    state.ecosystemActivity?.command(props.presentation)
    configure(); scheduler.current?.request()
    // Commands are discrete; renderer checkpoints do not create a second clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.presentation?.revision, initialized])
  useEffect(() => {
    if (!props.motionRetry) return
    runtime.current.stationaryProbe.reset(probe.rendering.probeSeconds); quality.current?.retry()
    configure(); scheduler.current?.request()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.motionRetry])

  useEffect(() => {
    const element = gl.domElement, ray = new Raycaster(), pointer = new Vector2(), intersections: Intersection<Object3D>[] = []
    const pointers = new Set<number>()
    let gesture: Gesture | null = null, began: FacilityInspectionTarget | null = null, preview = ""
    const hit = (x: number, y: number) => {
      const state = runtime.current, model = state.model
      if (!model || state.swap || state.transition || !latest.current.visible) return null
      const ndc = canvasNdc(x, y, element.getBoundingClientRect()); if (!ndc) return null
      pointer.set(...ndc); ray.setFromCamera(pointer, activeCamera.current); intersections.length = 0
      ray.intersectObjects(model.surfacePicks.filter(isObjectVisible), false, intersections)
      for (const item of intersections) { if (!surfaceHitVisible(model.coverageMasks, item, activeCamera.current, element.width, element.height)) continue; const result = inspectionHit(model, item.object, item.face?.a ?? 0); if (result) return result }
      intersections.length = 0; ray.intersectObjects(model.picks, false, intersections)
      return intersections.length ? inspectionHit(model, intersections[0].object, 0) : null
    }
    const show = (target: FacilityInspectionTarget | null) => {
      const key = targetKey(target)
      if (key !== preview) { preview = key; latest.current.onTargetPreview?.(target); if (!latest.current.onTargetPreview) latest.current.onPreview(target?.system ?? null) }
      element.style.cursor = target ? "pointer" : "default"
    }
    const cancel = () => { if (gesture) gesture = cancelGesture(gesture); show(null) }
    const down = (event: PointerEvent) => {
      pointers.add(event.pointerId); if (pointers.size !== 1) { cancel(); return }
      if (event.target !== element || event.button !== 0) return
      began = hit(event.clientX, event.clientY); gesture = began ? pointerDown(event.pointerId, began.system, event.clientX, event.clientY) : null
    }
    const move = (event: PointerEvent) => {
      if (gesture) gesture = pointerMove(gesture, event.pointerId, event.clientX, event.clientY)
      if (event.target === element && event.pointerType !== "touch" && !event.buttons) show(hit(event.clientX, event.clientY))
    }
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      const target = hit(event.clientX, event.clientY)
      if (gesture && target && targetKey(target) === targetKey(began) && pointerUp(gesture, event.pointerId, target.system, event.clientX, event.clientY)) {
        if (latest.current.onTarget) latest.current.onTarget(target); else latest.current.onSelect(target.system)
      }
      gesture = null; began = null
    }
    const pointerCancel = (event: PointerEvent) => { pointers.delete(event.pointerId); cancel() }
    const hidden = () => { if (document.hidden) { pointers.clear(); cancel() } }
    const leave = () => show(null)
    window.addEventListener("pointerdown", down, { passive: true }); window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerup", up, { passive: true }); window.addEventListener("pointercancel", pointerCancel, { passive: true }); window.addEventListener("scroll", cancel, { passive: true, capture: true }); window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", hidden); element.addEventListener("pointerleave", leave)
    return () => { cancel(); window.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", pointerCancel); window.removeEventListener("scroll", cancel, true); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", hidden); element.removeEventListener("pointerleave", leave) }
  }, [gl, camera])

  useFrame(() => {
    const state = runtime.current, model = state.model, current = latest.current
    if (!model || !current.visible) return
    const started = performance.now(), { delta, interval, targetFps } = state.scheduled
    const presentation = state.transition?.view ?? (state.swap ? state.desired : state.view)
    const closed = state.rackMotion ? state.rackMotion.closed : presentation.kind === "overview" || presentation.pose === "closed"
    const transitioning = !!state.transition || !!state.rackMotion?.moving || state.activeSeconds < state.interactionUntil
    const probing = state.stationaryProbe.configure(current.visible && closed && !transitioning && !state.swap && current.equipmentEnabled && !current.paused && !current.reducedMotion && !current.readingHold)
    const moving = closed && equipmentMotionAllowed(current.equipmentEnabled, current.paused, current.reducedMotion, state.quality, state.capability, current.readingHold) && !state.stationaryProbe.pending && (!state.ecosystemActivity?.guided || state.ecosystemActivity.playing)
    const step = moving && state.previousMotion ? delta : 0
    state.previousMotion = moving; state.animationSeconds += step
    const ecosystem = state.ecosystemActivity?.sample(step, state.animationSeconds, moving, model.leds.instanceColor!.array as Float32Array, closed && equipmentMotionAllowed(current.equipmentEnabled, current.paused, current.reducedMotion, state.quality, state.capability, current.readingHold))
    for (let index = 0; index < model.fans.length; index++) {
      const fan = model.fans[index], multiplier = ecosystem?.fans[index] ?? 1
      fan.phase = ecosystem ? ((model.profile.motion?.fanPhaseOffsets[index % 4] ?? 0) + ecosystem.fanSeconds[index] * (model.profile.motion?.fanRadiansPerSecond ?? 1.6)) % (2 * Math.PI) : (fan.phase + step * (model.profile.motion?.fanRadiansPerSecond ?? 1.6) * multiplier) % (2 * Math.PI); state.rotation.setFromAxisAngle(fan.axis, fan.phase); fan.object.quaternion.copy(fan.base).multiply(state.rotation)
    }
    if (!ecosystem) state.ledActivity?.sample(state.animationSeconds, moving, model.leds.instanceColor!.array as Float32Array)
    const section = !!ecosystem?.section || (presentation.kind === "overview" && (presentation.section === "air-path" || presentation.detail === "air-path"))
    if (section !== state.section) { state.section = section; for (const cover of model.sectionCovers) cover.visible = !section }
    model.leds.instanceColor!.needsUpdate = true
    const transition = state.transition
    if (transition) {
      transition.elapsed += delta
      const weight = current.paused || current.reducedMotion || state.quality === "still" || (!!state.rackMotion && !current.equipmentEnabled) || transition.duration === 0 ? 1 : Math.min(1, transition.elapsed / transition.duration)
      const eased = ease(weight)
      state.frame = interpolateCamera(transition.from, transition.to, eased, state.cameraWorking); commitCamera(state.frame)
      for (const part of transition.parts) { part.object.position.lerpVectors(part.from, part.to, eased); part.object.visible = weight === 1 ? part.visible : part.fromVisible || part.visible }
      if (transition.parts.length) { model.scene.updateMatrixWorld(true); updateLedAnchors(model) }
      if (weight === 1) state.transition = null
    }
    if (state.rackMotion?.sample(delta, current.paused || current.reducedMotion || !current.equipmentEnabled || state.quality === "still")) updateLedAnchors(model)
    const bindings = model.engineering!
    const snap = current.paused || current.reducedMotion || state.quality === "still", blend = 1 - Math.exp(-Math.max(delta, 1 / 60) * 5000 / probe.accent.transitionMs)
    const equipmentSettling = ecosystem ? blendPresentationWeights(bindings.equipmentWeights, state.selectionEquipment, ecosystem.equipment, blend, snap) : blendWeights(bindings.equipmentWeights, state.selectedEquipment, state.previewEquipment, probe.accent.previewWeight, blend, snap)
    const settling = (ecosystem ? blendPresentationWeights(bindings.routeWeights, state.selectionRoutes, ecosystem.routes, blend, snap) : blendWeights(bindings.routeWeights, state.selectedRoutes, state.previewRoutes, probe.accent.previewWeight, blend, snap)) || equipmentSettling
    if (ecosystem && bindings.ecosystem) {
      bindings.ecosystem.equipment.set(bindings.equipmentWeights); bindings.ecosystem.routes.set(bindings.routeWeights); bindings.ecosystem.heat.set(ecosystem.heat); bindings.ecosystem.routeFrom.set(ecosystem.routeFrom); bindings.ecosystem.routeTo.set(ecosystem.routeTo); bindings.ecosystem.traces.set(ecosystem.traces)
    } else state.routeActivity?.sample(state.animationSeconds, moving, state.selectedRoutes, bindings.routePhases)
    state.renderedModel = null
    try { gl.render(scene, activeCamera.current) } catch {
      if (state.swap) state.assetFailure?.("That equipment view could not render. The previous view is still available.")
      else current.onFailure("The graphics view was interrupted. You can retry.")
      return
    }
    if (state.rackMotion) current.onRackAnchors?.(state.rackMotion.project(activeCamera.current))
    const rendered = state.renderedModel === model
    state.frames++
    if (!current.visible || document.visibilityState === "hidden") state.hiddenFrameCount++
    if (!state.initialPresented && rendered) { state.initialPresented = true; gl.domElement.dataset.ready = "true"; queueMicrotask(() => { if (!state.disposed) latest.current.onPresented() }) }
    if (state.swap && rendered) {
      const swap = state.swap
      if (performance.now() <= swap.deadline && swap.epoch === state.epoch) { state.swap = null; swap.old.dispose(); notifyReady(state.desired, swap.epoch) }
    } else if (state.rackReady && !state.transition && !state.rackMotion?.moving && rendered) {
      const ready = state.rackReady; state.rackReady = null; notifyReady(ready.view, ready.epoch)
    } else if (transition && !state.transition && !state.rackMotion?.moving && rendered) notifyReady(transition.view, transition.epoch)
    const probeSeconds = probing && rendered ? state.stationaryProbe.sample(delta) : 0
    if (interval > 0 && (moving || probeSeconds > 0)) {
      const cpu = performance.now() - started
      state.intervals[state.cursor] = interval; state.costs[state.cursor] = cpu; state.cursor = (state.cursor + 1) % 120; state.samples++
      const sample = state.recent[state.recentCursor]; sample.interval = interval; sample.targetFps = targetFps; sample.cpu = cpu; sample.at = state.activeSeconds
      state.recentCursor = (state.recentCursor + 1) % 120; state.recentCount = Math.min(120, state.recentCount + 1)
      if (state.samples >= 120 && state.samples % 30 === 0) { state.sortedIntervals.set(state.intervals); state.sortedCosts.set(state.costs); state.sortedIntervals.sort(); state.sortedCosts.sort(); state.frameP95 = state.sortedIntervals[113]; state.cpuP95 = state.sortedCosts[113] }
      if (state.activeSeconds - state.evaluatedAt >= 1 && state.recentCount >= 3 && state.activeSeconds - state.windowStartedAt >= 2 && !state.stationaryProbe.pending && state.capability === null) {
        quality.current?.evaluate(state.recent.slice(0, state.recentCount).filter(sample => sample.at >= state.activeSeconds - 2), Math.min(1, state.activeSeconds - state.evaluatedAt)); state.evaluatedAt = state.activeSeconds
      }
    }
    if (settling) state.interactionUntil = Math.max(state.interactionUntil, state.activeSeconds + .05)
    configure()
  }, 1)

  useEffect(() => {
    if (window.__GN_FACILITY_DIAGNOSTICS__ !== true) return
    const diagnosticState = runtime.current
    gl.domElement.__gnFacilityReviewDpr = dpr => {
      if (dpr !== null && dpr !== 1 && dpr !== 1.5) throw new Error("invalid_review_dpr")
      runtime.current.reviewDpr = dpr; updateDpr(); scheduler.current?.request()
    }
    gl.domElement.__gnFacilityCapability = fps => {
      if (fps !== null && fps !== 30 && fps !== 60) throw new Error("invalid_capability_cadence")
      const state = runtime.current
      state.capability = fps; resetFrameMeasurementWindow(state)
      configure(); scheduler.current?.request()
    }
    gl.domElement.__gnFacilitySnapshot = (includeEquipment = false) => {
      const state = runtime.current, model = state.model!, displayedCamera = activeCamera.current
      return {
        readingHold: !!latest.current.readingHold, frames: state.frames, drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
        materials: model?.statistics.materials ?? 0, estimatedBytes: model?.statistics.estimatedBytes ?? 0, peakEstimatedBytes: model?.statistics.peakEstimatedBytes ?? 0, environmentBytes: model?.statistics.environmentBytes ?? 0,
        frameP95: state.frameP95, cpuP95: state.cpuP95, sampleCount: state.samples, dpr: gl.getPixelRatio(), quality: state.quality, targetFps: state.scheduled.targetFps, activeSeconds: state.animationSeconds, view: state.view, qualityProbe: state.stationaryProbe.pending, qualityProbeRemainingSeconds: state.stationaryProbe.remainingSeconds,
        assetError: state.assetError, requestedView: state.desired, sceneKind: model?.metadata.specimen?.kind ?? "overview", probeName: model?.probe.name, probeVisible: model ? isObjectVisible(model.probe) : false, probeRendered: state.renderedModel === model,
        schedulerRequestCount: scheduler.current?.requestCount ?? 0, schedulerPending: scheduler.current?.pendingCount ?? 0,
        tierHistory: state.qualityHistory.snapshot(), hiddenFrameCount: state.hiddenFrameCount,
        cameraFrustum: displayedCamera instanceof OrthographicCamera ? [displayedCamera.left, displayedCamera.right, displayedCamera.top, displayedCamera.bottom] : null,
        cameraProjection: displayedCamera instanceof PerspectiveCamera ? "perspective" : "orthographic", cameraFov: displayedCamera instanceof PerspectiveCamera ? displayedCamera.fov : null,
        cameraPosition: displayedCamera.position.toArray(), cameraTarget: state.frame?.target.toArray(), cameraClip: [displayedCamera.near, displayedCamera.far], cameraAspect: state.frame?.aspect, mobileComposition: mobileComposition(),
        rendererCssSize: [dimensions.current.width, dimensions.current.height], reviewDpr: state.reviewDpr,
        finiteLight: state.finiteLight ? { position: state.finiteLight.light.position.toArray(), intensity: state.finiteLight.light.intensity, count: 1, shadows: false } : null,
        interactionUntil: state.interactionUntil, clockSeconds: state.activeSeconds, transitionRemaining: state.transition ? state.transition.duration - state.transition.elapsed : 0,
        ...(state.rackMotion ? { rackMotion: state.rackMotion.snapshot() } : {}),
        missedRatio: missedFrameSlotRatio(state.recent.slice(0, state.recentCount)),
        ...(state.ecosystemActivity ? { ecosystem: { ...state.ecosystemActivity.snapshot(), presentationSeconds: state.ecosystemActivity.output.seconds, traceCount: Number(state.ecosystemActivity.output.traces[0] >= 0) + Number(state.ecosystemActivity.output.traces[8] >= 0), brightLedCount: model && state.previousMotion ? Array.from(model.leds.instanceColor!.array).filter((value, index) => index % 3 === 0 && Math.floor(index / 3) % 4 !== 3 && value > .12001).length : 0, fanSpeedMultipliers: Array.from(state.ecosystemActivity.output.fans), traceSlots: Array.from(state.ecosystemActivity.output.traces), section: state.section } } : {}),
        ...(includeEquipment && model ? { equipment: { fans: model.fans.map(fan => ({ phase: fan.phase, axis: fan.axis.toArray(), quaternion: fan.object.quaternion.toArray() })), ledColors: Array.from(model.leds.instanceColor!.array) } } : {}),
      }
    }
    return () => { delete gl.domElement.__gnFacilitySnapshot; delete gl.domElement.__gnFacilityCapability; delete gl.domElement.__gnFacilityReviewDpr; diagnosticState.reviewDpr = null }
    // Diagnostic callbacks read the session's stable mutable refs, like the frame owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera])
  return null
}
