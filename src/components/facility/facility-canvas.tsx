"use client"

import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  ACESFilmicToneMapping, Color, OrthographicCamera, Quaternion, Raycaster,
  SRGBColorSpace, Vector2, Vector3, type Intersection, type Object3D,
} from "three"

import type { FacilityModel } from "@/lib/facility/asset-runtime"
import { stageFacility, type StagedFacility } from "@/lib/facility/render-session"
import { projectedFacilityBounds } from "@/lib/facility/render-framing"
import { cancelGesture, canvasNdc, pointerDown, pointerMove, pointerUp, type Gesture } from "@/lib/facility/gesture"
import { FACILITY_SYSTEMS, type FacilityCanvasProps, type FacilitySystem } from "@/types/facility"
import { EngineeringSession } from "./engineering-session"

type FacilityDiagnostics = {
  frames: number; drawCalls: number; triangles: number; geometries: number; textures: number
  materials: number; estimatedBytes: number; peakEstimatedBytes: number; environmentBytes: number
  frameP95: number | null; sampleCount: number; dpr: number
  readingHold?: boolean
  reviewDpr?: 1 | 1.5 | null
  equipment?: { fans: { phase: number; axis: number[]; quaternion: number[] }[]; ledColors: number[] }
}
declare global {
  interface Window { __GN_FACILITY_DIAGNOSTICS__?: boolean }
  interface HTMLCanvasElement { __gnFacilitySnapshot?: (includeEquipment?: boolean) => FacilityDiagnostics; __gnFacilityCapability?: (fps: 30 | 60 | null) => void; __gnFacilityReviewDpr?: (dpr: 1 | 1.5 | null) => void }
}

class GraphicsBoundary extends Component<{ onFailure: (reason: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure("The interactive view could not start.") }
  render() { return this.state.failed ? null : this.props.children }
}

function FacilitySession(props: FacilityCanvasProps & { onQualityFallback: () => void }) {
  const gl = useThree(state => state.gl)
  const camera = useThree(state => state.camera)
  const rootScene = useThree(state => state.scene)
  const size = useThree(state => state.size)
  const invalidate = useThree(state => state.invalidate)
  const rendererDpr = useThree(state => state.viewport.dpr)
  const [model, setModel] = useState<FacilityModel | null>(null)
  const projectedBounds = useMemo(() => model && props.release.profile.framing === "projected-geometry"
    ? projectedFacilityBounds(model, props.release.profile) : null, [model, props.release.profile])
  const latest = useRef(props)
  useLayoutEffect(() => { latest.current = props }, [props])
  const running = props.visible && props.equipmentEnabled && !props.paused && !props.reducedMotion && !props.readingHold

  useEffect(() => {
    let active = true
    let owned: StagedFacility | null = null
    const controller = new AbortController()
    void stageFacility(props.release, gl, controller.signal).then(result => {
      if (!active) { result.dispose(); return }
      owned = result
      if (result.environment) {
        rootScene.environment = result.environment.texture
        rootScene.environmentIntensity = props.release.profile.lighting.environment!.intensity
        rootScene.environmentRotation.y = props.release.profile.lighting.environment!.rotationY
      }
      setModel(result.model)
      latest.current.onStaged()
      invalidate()
    }).catch(() => {
      if (active && !controller.signal.aborted) latest.current.onFailure("The interactive model could not load. You can retry.")
    })
    return () => {
      active = false
      controller.abort()
      if (owned?.environment && rootScene.environment === owned.environment.texture) rootScene.environment = null
      owned?.dispose()
    }
  }, [props.release, props.generation, invalidate, gl, rootScene])

  useLayoutEffect(() => {
    if (props.visible) invalidate()
  }, [props.visible, running, model, invalidate])

  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault()
      latest.current.onFailure("The graphics connection was interrupted. You can retry.")
    }
    gl.domElement.addEventListener("webglcontextlost", lost)
    return () => gl.domElement.removeEventListener("webglcontextlost", lost)
  }, [gl])

  useLayoutEffect(() => {
    if (!model || !(camera instanceof OrthographicCamera) || !size.width || !size.height) return
    camera.position.fromArray(props.release.profile.camera)
    camera.lookAt(new Vector3(...props.release.profile.target))
    camera.updateMatrixWorld(true)
    const bounds = model.bounds
    const corner = new Vector3()
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity
    if (projectedBounds) ({ left, right, bottom, top } = projectedBounds)
    else for (let index = 0; index < 8; index++) {
        corner.set(index & 1 ? bounds.max.x : bounds.min.x, index & 2 ? bounds.max.y : bounds.min.y, index & 4 ? bounds.max.z : bounds.min.z)
        corner.applyMatrix4(camera.matrixWorldInverse)
        left = Math.min(left, corner.x); right = Math.max(right, corner.x)
        bottom = Math.min(bottom, corner.y); top = Math.max(top, corner.y)
      }
    const centerX = (left + right) / 2, centerY = (bottom + top) / 2
    const aspect = size.width / size.height
    const halfHeight = Math.max((top - bottom) / 2, (right - left) / (2 * aspect)) * props.release.profile.padding
    camera.left = centerX - halfHeight * aspect
    camera.right = centerX + halfHeight * aspect
    camera.bottom = centerY - halfHeight
    camera.top = centerY + halfHeight
    camera.zoom = 1
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, model, projectedBounds, size.width, size.height, props.release.profile, invalidate])

  useEffect(() => {
    if (!model) return
    let active = true
    let presented = false
    const original = model.probe.onAfterRender
    model.probe.onAfterRender = function (...args) {
      original.apply(this, args)
      if (!presented) {
        presented = true
        gl.domElement.dataset.ready = "true"
        queueMicrotask(() => { if (active) latest.current.onPresented() })
      }
    }
    invalidate()
    return () => { active = false; model.probe.onAfterRender = original }
  }, [model, invalidate, gl])

  useEffect(() => {
    if (!model) return
    const element = gl.domElement
    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const hits: Intersection<Object3D>[] = []
    let gesture: Gesture | null = null
    const activePointers = new Set<number>()
    let preview: FacilitySystem | null = null
    const hitAt = (x: number, y: number): FacilitySystem | null => {
      const ndc = canvasNdc(x, y, element.getBoundingClientRect())
      if (!ndc) return null
      pointer.set(ndc[0], ndc[1])
      raycaster.setFromCamera(pointer, camera)
      hits.length = 0
      raycaster.intersectObjects(model.picks, false, hits)
      return hits.length ? model.pickSystems.get(hits[0].object) ?? null : null
    }
    const setPreview = (next: FacilitySystem | null) => {
      if (preview !== next) { preview = next; latest.current.onPreview(next) }
      element.style.cursor = next ? "pointer" : "default"
    }
    const cancel = () => { if (gesture) gesture = cancelGesture(gesture) }
    const down = (event: PointerEvent) => {
      activePointers.add(event.pointerId)
      if (activePointers.size !== 1) { cancel(); return }
      if (event.target !== element || event.button !== 0) return
      const hit = hitAt(event.clientX, event.clientY)
      gesture = hit ? pointerDown(event.pointerId, hit, event.clientX, event.clientY) : null
    }
    const move = (event: PointerEvent) => {
      if (gesture) gesture = pointerMove(gesture, event.pointerId, event.clientX, event.clientY)
      if (event.target === element && event.pointerType !== "touch") setPreview(hitAt(event.clientX, event.clientY))
    }
    const up = (event: PointerEvent) => {
      activePointers.delete(event.pointerId)
      if (!gesture) return
      const selected = pointerUp(gesture, event.pointerId, hitAt(event.clientX, event.clientY), event.clientX, event.clientY)
      gesture = null
      if (selected) latest.current.onSelect(selected)
    }
    const pointerCancel = (event: PointerEvent) => { activePointers.delete(event.pointerId); cancel() }
    const leave = () => { setPreview(null) }
    const hidden = () => { if (document.hidden) { cancel(); setPreview(null); activePointers.clear() } }
    // Passive global tracking keeps native touch scrolling and catches excursions outside the canvas.
    window.addEventListener("pointerdown", down, { passive: true })
    window.addEventListener("pointermove", move, { passive: true })
    window.addEventListener("pointerup", up, { passive: true })
    window.addEventListener("pointercancel", pointerCancel, { passive: true })
    window.addEventListener("scroll", cancel, { passive: true, capture: true })
    window.addEventListener("blur", cancel)
    document.addEventListener("visibilitychange", hidden)
    element.addEventListener("pointerleave", leave)
    return () => {
      cancel(); activePointers.clear()
      window.removeEventListener("pointerdown", down)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", pointerCancel)
      window.removeEventListener("scroll", cancel, true)
      window.removeEventListener("blur", cancel)
      document.removeEventListener("visibilitychange", hidden)
      element.removeEventListener("pointerleave", leave)
    }
  }, [model, gl, camera])

  const motion = useRef({
    weights: new Float32Array(4), rotation: new Quaternion(),
    frames: 0, time: 0, previousRunning: false, intervals: new Float32Array(120), sorted: new Float32Array(120),
    samples: 0, sampleCursor: 0, downgraded: false, p95: null as number | null,
  })
  useLayoutEffect(() => {
    const state = motion.current
    state.previousRunning = false
    state.samples = 0
    state.sampleCursor = 0
    state.p95 = null
  }, [running, rendererDpr])
  useEffect(() => {
    if (!model || window.__GN_FACILITY_DIAGNOSTICS__ !== true) return
    const element = gl.domElement
    element.__gnFacilitySnapshot = (includeEquipment = false) => ({
      frames: motion.current.frames, drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
      materials: model.statistics.materials, estimatedBytes: model.statistics.estimatedBytes,
      peakEstimatedBytes: model.statistics.peakEstimatedBytes, environmentBytes: model.statistics.environmentBytes,
      frameP95: motion.current.p95, sampleCount: motion.current.samples, dpr: gl.getPixelRatio(),
      ...(includeEquipment ? { equipment: { fans: model.fans.map(fan => ({ phase: fan.phase, axis: fan.axis.toArray(), quaternion: fan.object.quaternion.toArray() })), ledColors: Array.from(model.leds.instanceColor!.array) } } : {}),
    })
    return () => { delete element.__gnFacilitySnapshot }
  }, [gl, model])
  useLayoutEffect(() => {
    if (props.visible) invalidate()
  }, [props.selected, props.preview, props.paused, props.reducedMotion, props.visible, props.equipmentEnabled, props.readingHold, invalidate])

  useFrame((_, frameDelta) => {
    if (!model || !latest.current.visible) return
    const state = motion.current
    const current = latest.current
    const animate = current.equipmentEnabled && !current.paused && !current.reducedMotion && !current.readingHold
    const wasRunning = state.previousRunning
    const delta = Math.min(0.05, Math.max(0, frameDelta))
    const snap = current.paused || current.reducedMotion
    let settling = false
    for (let index = 0; index < FACILITY_SYSTEMS.length; index++) {
      const system = FACILITY_SYSTEMS[index]
      const target = current.selected === system ? 1 : current.preview === system ? 0.45 : 0
      const difference = target - state.weights[index]
      state.weights[index] = snap || Math.abs(difference) < 0.002 ? target : state.weights[index] + difference * (1 - Math.exp(-16 * delta))
      if (Math.abs(target - state.weights[index]) >= 0.002) settling = true
      model.accentWeights[index] = state.weights[index]
    }
    if (animate) {
      // Resume starts from the saved pose; time spent hidden is never replayed.
      const step = state.previousRunning ? delta : 0
      state.time += step
      for (const fan of model.fans) {
        fan.phase = (fan.phase + step * (current.release.profile.motion?.fanRadiansPerSecond ?? 1.6)) % (Math.PI * 2)
        state.rotation.setFromAxisAngle(fan.axis, fan.phase)
        fan.object.quaternion.copy(fan.base).multiply(state.rotation)
      }
    }
    state.previousRunning = animate
    const colors = model.leds.instanceColor!
    const array = colors.array
    const led = current.release.profile.led
    const equipmentMotion = current.release.profile.motion
    for (let index = 0; index < model.leds.count; index++) {
      const wave = Math.sin(state.time * (equipmentMotion?.ledPulseRadiansPerSecond ?? 1.8) + index * 1.63)
      const strength = led
        ? animate ? Math.max(0, Math.min(1, led.steadyIntensity + (equipmentMotion?.ledPulseAmplitude ?? 0.06) * wave)) : led.steadyIntensity
        : animate ? 0.87 + 0.08 * wave : 0.9
      array[index * 3] = strength
      array[index * 3 + 1] = led ? strength : strength * 0.68
      array[index * 3 + 2] = led ? strength : strength * 0.31
    }
    colors.needsUpdate = true
    gl.render(rootScene, camera)
    state.frames++
    if (animate && wasRunning && frameDelta > 0) {
      state.intervals[state.sampleCursor] = frameDelta * 1000
      state.sampleCursor = (state.sampleCursor + 1) % state.intervals.length
      state.samples++
      if (state.samples % state.intervals.length === 0) {
        state.sorted.set(state.intervals)
        state.sorted.sort()
        const p95 = state.sorted[113]
        state.p95 = p95
        const desktop = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches
        if (!state.downgraded && p95 > (desktop ? 20 : 34)) {
          state.downgraded = true
          current.onQualityFallback()
        }
      }
    }
    if (settling && !animate) invalidate()
  }, 1)

  return model ? <primitive object={model.scene} dispose={null} /> : null
}

export default function FacilityCanvas(props: FacilityCanvasProps) {
  const [maximumDpr, setMaximumDpr] = useState(props.release.profile.engineering ? 1 : 1.5)
  return (
    <GraphicsBoundary key={`${props.release.release}:${props.generation}`} onFailure={props.onFailure}>
      <Canvas
        orthographic frameloop={props.release.profile.engineering ? "never" : !props.visible ? "never" : props.equipmentEnabled && !props.paused && !props.reducedMotion && !props.readingHold ? "always" : "demand"} dpr={props.release.profile.engineering ? maximumDpr : [1, maximumDpr]}
        camera={{ position: props.release.profile.camera, near: 0.1, far: 150, zoom: 1, manual: Boolean(props.release.profile.engineering) }}
        gl={{ antialias: true, alpha: false, powerPreference: "default" }}
        fallback={<span>The facility illustration is available above.</span>}
        style={{ width: "100%", height: "100%", touchAction: "pan-y pinch-zoom" }}
        onCreated={({ gl, scene }) => {
          gl.outputColorSpace = SRGBColorSpace
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = props.release.profile.exposure
          gl.domElement.style.touchAction = "pan-y pinch-zoom"
          gl.domElement.setAttribute("aria-hidden", "true")
          gl.domElement.dataset.facilityCanvas = "true"
          scene.background = new Color(props.release.profile.background)
        }}
      >
        <hemisphereLight args={[props.release.profile.lighting.hemisphere.sky, props.release.profile.lighting.hemisphere.ground, props.release.profile.lighting.hemisphere.intensity]} />
        {props.release.profile.lighting.directional.map((light, index) => <directionalLight key={index} {...light} />)}
        {props.release.profile.engineering ? <EngineeringSession {...props} onDpr={setMaximumDpr} /> : <FacilitySession {...props} onQualityFallback={() => setMaximumDpr(1)} />}
      </Canvas>
    </GraphicsBoundary>
  )
}
