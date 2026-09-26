import { act, cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { BoxGeometry, Group, InstancedBufferAttribute, InstancedMesh, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Frustum, Matrix4, Scene } from "three"
import type { FacilityCanvasProps, FacilityVisualRelease } from "@/types/facility"
import type { FacilityModel } from "@/lib/facility/asset-runtime"
import type { ScheduledFrame } from "@/lib/facility/frame-policy"
import type { StagedFacility } from "@/lib/facility/render-session"
import { testMatchMedia } from "../../support/match-media"

const driver = vi.hoisted(() => ({ three: {} as Record<string, unknown>, listeners: new Set<() => void>(), frame: () => {}, draw: (() => {}) as (frame: ScheduledFrame) => void, stage: vi.fn(), replace: vi.fn() }))
const renderStore = vi.hoisted(() => ({
  getState: () => driver.three,
  subscribe: (listener: () => void) => { driver.listeners.add(listener); return () => { driver.listeners.delete(listener) } },
}))
vi.mock("@react-three/fiber", () => ({ useThree: () => driver.three, useStore: () => renderStore, useFrame: (callback: () => void) => { driver.frame = callback } }))
vi.mock("@/lib/facility/render-session", () => ({ stageFacility: driver.stage, stageReplacement: driver.replace }))
vi.mock("@/lib/facility/frame-policy", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/facility/frame-policy")>(),
  createFrameScheduler: (_clock: unknown, draw: (frame: ScheduledFrame) => void) => {
    driver.draw = draw
    return { configure() {}, request() {}, dispose() {} }
  },
}))
import { EngineeringSession } from "@/components/facility/engineering-session"

const profile: FacilityVisualRelease["profile"] = {
  camera: [12, 10, 15], target: [0, 1, 0], padding: 1.12, background: "#000000", exposure: 1, colorSpace: "srgb", toneMapping: "aces-filmic",
  lighting: { hemisphere: { sky: "#ffffff", ground: "#000000", intensity: 1 }, directional: [] },
  engineering: {
    version: 1, seed: 42,
    accent: { resting: "#a97132", hover: "#ffd18a", selected: "#ffbd59", previewWeight: .8, baseEmission: .2, activeEmission: 1.5, transitionMs: 160 },
    activity: { resting: .3, peak: 1, steady: .7, pulseMs: [100, 180], eventMs: [200, 600], maxPulses: 3, ambientTraceSeconds: [8, 12], selectedTraceQuietSeconds: 3 },
    cameraTransitionMs: 420, poseTransitionMs: 420,
    rendering: { ambientFps: 30, interactionFps: 60, mobilePixels: 400000, desktopPixels: 1200000, probeSeconds: 2 },
  },
}
// jsdom has no layout or ResizeObserver. Model the renderer container and
// R3F store explicitly; the dedicated camera-ownership suite exercises delayed
// delivery with a real R3F root. These session tests use a settled measured box.
function rendererCanvas() {
  const canvas = document.createElement("canvas"), container = document.createElement("div")
  container.append(canvas)
  container.getBoundingClientRect = () => {
    const { width, height, top = 0, left = 0 } = driver.three.size as { width: number; height: number; top?: number; left?: number }
    return { width, height, top, left, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({ width, height, top, left }) }
  }
  return canvas
}
function resizeViewport(width: number, height: number) {
  driver.three.size = { width, height, top: 0, left: 0 }
  for (const listener of driver.listeners) listener()
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function model(specimen = false): FacilityModel {
  const scene = new Group(), geometry = new BoxGeometry(2, 4, 2), material = new MeshBasicMaterial(), part = new Mesh(geometry, material)
  scene.add(part)
  const leds = new InstancedMesh(geometry, material, 0)
  leds.instanceColor = new InstancedBufferAttribute(new Float32Array(0), 3)
  const metadata: FacilityModel["metadata"] = specimen ? { specimen: {
    schemaVersion: "facility-specimen.v1", kind: "rack", system: "workloads",
    parts: [{ id: "panel", index: 0, label: "Panel", role: "panel", objectId: "panel", bounds: { min: [-1, -2, -1], max: [1, 2, 1] }, connections: [] }],
    poses: {
      closed: { camera: profile, transforms: [{ id: "panel", position: [0, 0, 0], visible: true }] },
      cutaway: { camera: profile, transforms: [{ id: "panel", position: [1, 0, 0], visible: true }] },
      service: { camera: profile, transforms: [{ id: "panel", position: [3, 0, 0], visible: true }] },
    },
  } } : {}
  return { scene, probe: part, profile, metadata, ids: new Map([["panel", part]]), fans: [], leds, sectionCovers: [], ledAnchors: [], surfacePicks: [], picks: [], pickSystems: new Map(), engineering: { equipmentWeights: new Float32Array(1), routeWeights: new Float32Array(1), routePhases: new Float32Array(1) }, dispose: vi.fn(() => { scene.removeFromParent(); geometry.dispose(); material.dispose(); leds.dispose() }) } as unknown as FacilityModel
}
afterEach(() => { cleanup(); expect(driver.listeners.size).toBe(0); vi.clearAllMocks(); vi.useRealTimers() })

it("fits the latest viewport after delayed staging and throughout an interrupted pose resize", async () => {
  const initial = deferred<StagedFacility>(), replacement = deferred<FacilityModel>(), camera = new OrthographicCamera(), scene = new Scene()
  driver.stage.mockReturnValue(initial.promise); driver.replace.mockReturnValue(replacement.promise)
  const canvas = rendererCanvas()
  driver.three = {
    camera, scene, size: { width: 1200, height: 600 }, setDpr: vi.fn(), advance: () => driver.frame(),
    gl: { domElement: canvas, render: () => scene.traverseVisible(object => { if (object instanceof Mesh) object.onAfterRender(undefined as never, scene, camera, object.geometry, object.material as never, undefined as never) }) },
  }
  const callbacks = { onDpr: vi.fn(), onStaged: vi.fn(), onPresented: vi.fn(), onFailure: vi.fn(), onSelect: vi.fn(), onPreview: vi.fn(), onAssetState: vi.fn() }
  const props: FacilityCanvasProps = { release: { profile } as FacilityVisualRelease, generation: 1, visible: true, paused: true, reducedMotion: false, equipmentEnabled: false, selected: null, preview: null, ...callbacks }
  const rendered = render(<EngineeringSession {...props} onDpr={callbacks.onDpr} />)
  const resize = (width: number, height: number, next: FacilityCanvasProps) => {
    resizeViewport(width, height)
    rendered.rerender(<EngineeringSession {...next} onDpr={callbacks.onDpr} />)
  }
  const frame = (activeSeconds: number, delta = 0) => act(() => driver.draw({ activeSeconds, delta, interval: delta * 1000, targetFps: 30 }))
  const aspect = () => (camera.right - camera.left) / (camera.top - camera.bottom)

  resize(400, 800, props)
  const overview = model()
  await act(async () => initial.resolve({ model: overview, environment: null, dispose: overview.dispose }))
  frame(0)
  expect(aspect()).toBeCloseTo(.5)

  const rackProps: FacilityCanvasProps = { ...props, view: { kind: "specimen", specimen: "rack", pose: "closed" } }
  rendered.rerender(<EngineeringSession {...rackProps} onDpr={callbacks.onDpr} />)
  resize(1000, 500, rackProps)
  await act(async () => replacement.resolve(model(true)))
  frame(0)
  expect(aspect()).toBeCloseTo(2)
  expect(callbacks.onAssetState).toHaveBeenLastCalledWith({ phase: "ready", view: rackProps.view })

  const serviceProps: FacilityCanvasProps = { ...props, paused: false, view: { kind: "specimen", specimen: "rack", pose: "service" } }
  rendered.rerender(<EngineeringSession {...serviceProps} onDpr={callbacks.onDpr} />)
  frame(.1, .1)
  resize(400, 800, serviceProps)
  expect(aspect()).toBeCloseTo(.5)
  frame(.6, .5)
  expect(aspect()).toBeCloseTo(.5)
  const portraitHeight = camera.top - camera.bottom
  resize(1000, 500, serviceProps); resize(400, 800, serviceProps)
  expect(camera.top - camera.bottom).toBeCloseTo(portraitHeight)
  expect(driver.stage).toHaveBeenCalledOnce(); expect(driver.replace).toHaveBeenCalledOnce()
  expect(callbacks.onFailure).not.toHaveBeenCalled()
})

it("keeps the poster through v6 compilation and retains the prior scene when replacement compilation times out", async () => {
  vi.useFakeTimers()
  const overview = model(), rack = model(true), camera = new OrthographicCamera(), scene = new Scene()
  const firstCompile = deferred<Group>(), nextCompile = deferred<Group>()
  const compileAsync = vi.fn().mockReturnValueOnce(firstCompile.promise).mockReturnValueOnce(nextCompile.promise)
  driver.stage.mockResolvedValue({ model: overview, environment: null, dispose: overview.dispose })
  driver.replace.mockResolvedValue(rack)
  driver.three = {
    camera, scene, size: { width: 1200, height: 600 }, setDpr: vi.fn(), advance: () => driver.frame(),
    gl: { domElement: rendererCanvas(), compileAsync, getContext: () => ({ isContextLost: () => false }), render: () => scene.traverseVisible(object => { if (object instanceof Mesh) object.onAfterRender(undefined as never, scene, camera, object.geometry, object.material as never, undefined as never) }) },
  }
  const v6Profile: FacilityVisualRelease["profile"] = { ...profile, ecosystem: { version: 1, seed: 61427, ambientIntervalSeconds: [12, 18], sequenceSeconds: 8, chapterSeconds: [4, 4, 5, 4, 4, 3], colors: { electrical: "#e3e7e4", cooling: "#76abb4", heat: "#c98554" }, fanModulation: .1, maxEquipment: 96, maxRoutes: 128, maxTraces: 2 } }
  const callbacks = { onDpr: vi.fn(), onStaged: vi.fn(), onPresented: vi.fn(), onFailure: vi.fn(), onSelect: vi.fn(), onPreview: vi.fn(), onAssetState: vi.fn() }
  const props: FacilityCanvasProps = { release: { profile: v6Profile } as FacilityVisualRelease, generation: 1, visible: true, paused: true, reducedMotion: false, equipmentEnabled: false, selected: null, preview: null, ...callbacks }
  const rendered = render(<EngineeringSession {...props} onDpr={callbacks.onDpr} />)
  await act(async () => { await Promise.resolve() })
  expect(compileAsync).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  expect(compileAsync).toHaveBeenCalledOnce(); expect(overview.scene.parent).toBeNull()
  expect(callbacks.onStaged).not.toHaveBeenCalled(); expect(callbacks.onPresented).not.toHaveBeenCalled()
  await act(async () => firstCompile.resolve(overview.scene))
  expect(callbacks.onStaged).toHaveBeenCalledOnce(); expect(callbacks.onPresented).not.toHaveBeenCalled()
  await act(async () => driver.draw({ activeSeconds: 0, delta: 0, interval: 0, targetFps: 30 }))
  expect(callbacks.onPresented).toHaveBeenCalledOnce()

  rendered.rerender(<EngineeringSession {...props} view={{ kind: "specimen", specimen: "rack", pose: "closed" }} onDpr={callbacks.onDpr} />)
  await act(async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(0) })
  expect(compileAsync).toHaveBeenCalledTimes(2)
  expect(overview.scene.parent).toBe(scene); expect(overview.scene.visible).toBe(true); expect(rack.scene.parent).toBeNull()
  await act(async () => { await vi.advanceTimersByTimeAsync(8000) })
  expect(rack.dispose).toHaveBeenCalledOnce(); expect(overview.dispose).not.toHaveBeenCalled()
  expect(callbacks.onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed" }))
  await act(async () => nextCompile.resolve(rack.scene))
  expect(rack.dispose).toHaveBeenCalledOnce(); expect(overview.scene.parent).toBe(scene); expect(overview.scene.visible).toBe(true)
  expect(callbacks.onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed" }))
  expect(callbacks.onFailure).not.toHaveBeenCalled()
})

it("never resurrects a legacy part that is hidden in both interrupted poses", async () => {
  const overview = model(), rack = model(true), camera = new OrthographicCamera(), scene = new Scene()
  const panel = rack.ids.get("panel")!
  for (const pose of Object.values(rack.metadata.specimen!.poses)) pose.transforms[0].visible = false
  driver.stage.mockResolvedValue({ model: overview, environment: null, dispose: overview.dispose }); driver.replace.mockResolvedValue(rack)
  driver.three = { camera, scene, size: { width: 1000, height: 600 }, setDpr: vi.fn(), advance: () => driver.frame(), gl: { domElement: rendererCanvas(), render: () => {} } }
  const props: FacilityCanvasProps = { release: { profile } as FacilityVisualRelease, generation: 1, visible: true, paused: false, reducedMotion: false, equipmentEnabled: true, selected: null, preview: null, onStaged: vi.fn(), onPresented: vi.fn(), onFailure: vi.fn(), onSelect: vi.fn(), onPreview: vi.fn() }
  const view = render(<EngineeringSession {...props} onDpr={vi.fn()} />)
  await act(async () => { await Promise.resolve() })
  view.rerender(<EngineeringSession {...props} view={{ kind: "specimen", specimen: "rack", pose: "closed" }} onDpr={vi.fn()} />)
  await act(async () => { await Promise.resolve() })
  // This unit's render probe is intentionally explicit; settle the initial swap.
  const gl = driver.three.gl as { render: () => void }
  gl.render = () => panel.onAfterRender(undefined as never, scene, camera, (panel as Mesh).geometry, (panel as Mesh).material as never, undefined as never)
  act(() => driver.draw({ activeSeconds: 0, delta: 0, interval: 0, targetFps: 30 }))
  view.rerender(<EngineeringSession {...props} view={{ kind: "specimen", specimen: "rack", pose: "cutaway" }} onDpr={vi.fn()} />)
  expect(panel.visible).toBe(false)
  act(() => driver.draw({ activeSeconds: .1, delta: .1, interval: 100, targetFps: 30 }))
  expect(panel.visible).toBe(false)
  view.rerender(<EngineeringSession {...props} view={{ kind: "specimen", specimen: "rack", pose: "service" }} onDpr={vi.fn()} />)
  act(() => driver.draw({ activeSeconds: .2, delta: .1, interval: 100, targetFps: 30 }))
  expect(panel.visible).toBe(false)
})

it("uses one rack session for reversible joints, stationary tray camera, hidden suspension and immediate preferences", async () => {
  vi.useFakeTimers()
  const overview = model(), rack = model(true), camera = new OrthographicCamera(), scene = new Scene(), door = new Group(), tray = new Group()
  rack.scene.add(door, tray); rack.ids.set("door", door); rack.ids.set("tray", tray)
  rack.statistics = { estimatedBytes: 1000, peakEstimatedBytes: 1000, environmentBytes: 0, materials: 1 }
  rack.metadata.specimen!.rackMotion = {
    version: 1, door: { objectId: "door", closed: [0, 0, 0, 1], open: [0, -Math.sin(55 * Math.PI / 180), 0, Math.cos(55 * Math.PI / 180)] },
    tray: { objectId: "tray", retracted: [0, 0, 0], extended: [0, 0, .18] }, cutawayObjectIds: ["panel"], camera: profile,
    fitBounds: { min: [-2, -2, -2], max: [2, 4, 2] }, anchors: [{ id: "door", objectId: "door", position: [.7, 1, 0] }, { id: "tray", objectId: "tray", position: [0, 1, .5] }],
  }
  driver.stage.mockResolvedValue({ model: overview, environment: null, dispose: overview.dispose }); driver.replace.mockResolvedValue(rack)
  driver.three = { camera, scene, size: { width: 1000, height: 600 }, setDpr: vi.fn(), advance: () => driver.frame(), gl: { domElement: rendererCanvas(), render: () => scene.traverseVisible(object => { if (object instanceof Mesh) object.onAfterRender(undefined as never, scene, camera, object.geometry, object.material as never, undefined as never) }) } }
  const onAnchors = vi.fn(), onAssetState = vi.fn(), props: FacilityCanvasProps = { release: { profile } as FacilityVisualRelease, generation: 1, visible: true, paused: false, reducedMotion: false, equipmentEnabled: true, selected: null, preview: null, onStaged: vi.fn(), onPresented: vi.fn(), onFailure: vi.fn(), onSelect: vi.fn(), onPreview: vi.fn(), onRackAnchors: onAnchors, onAssetState }
  const rendered = render(<EngineeringSession {...props} onDpr={vi.fn()} />)
  await act(async () => { await Promise.resolve() })
  const rackView = { kind: "specimen", specimen: "rack", pose: "closed" } as const
  rendered.rerender(<EngineeringSession {...props} view={rackView} onDpr={vi.fn()} />)
  await act(async () => { await Promise.resolve() })
  const frame = (delta: number) => act(() => driver.draw({ activeSeconds: delta, delta, interval: delta * 1000, targetFps: 30 }))
  frame(0); const fixedCamera = camera.position.toArray(), fixedFrustum = [camera.left, camera.right, camera.top, camera.bottom]
  const openView = { ...rackView, rack: { door: "open", tray: "extended", cutaway: false } } as const
  rendered.rerender(<EngineeringSession {...props} view={openView} onDpr={vi.fn()} />)
  frame(.21); expect(door.quaternion.angleTo(new Group().quaternion) * 180 / Math.PI).toBeCloseTo(55); expect(tray.position.z).toBe(0)
  frame(.21); frame(.24); expect(tray.position.z).toBeCloseTo(.09)
  expect(camera.position.toArray()).toEqual(fixedCamera); expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual(fixedFrustum)
  expect(onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "loading" }))
  rendered.rerender(<EngineeringSession {...props} visible={false} view={openView} onDpr={vi.fn()} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  frame(10); expect(tray.position.z).toBeCloseTo(.09)
  expect(onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "loading" }))
  rendered.rerender(<EngineeringSession {...props} paused view={openView} onDpr={vi.fn()} />)
  frame(0); expect(tray.position.z).toBeCloseTo(.18)
  expect(onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "ready" }))
  expect(onAnchors).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ action: "door" }), expect.objectContaining({ action: "tray" })]))
  const closeView = { ...rackView, rack: { door: "closed", tray: "retracted", cutaway: true } } as const
  rendered.rerender(<EngineeringSession {...props} equipmentEnabled={false} view={closeView} onDpr={vi.fn()} />)
  frame(0); expect(tray.position.z).toBe(0); expect(door.quaternion.w).toBe(1); expect(rack.ids.get("panel")!.visible).toBe(false)
  expect(driver.stage).toHaveBeenCalledOnce(); expect(driver.replace).toHaveBeenCalledOnce()
})

it("guards a service close-up with actual joints, keeps parts still through both camera moves and reuses one scene", async () => {
  const overview = model(), rack = model(true), camera = new OrthographicCamera(), scene = new Scene(), door = new Group(), tray = new Group()
  const permanent = new Mesh((rack.probe as Mesh).geometry, (rack.probe as Mesh).material)
  rack.scene.add(door, tray, permanent); rack.ids.set("door", door); rack.ids.set("tray", tray)
  rack.statistics = { estimatedBytes: 1000, peakEstimatedBytes: 1000, environmentBytes: 0, materials: 1 }
  rack.metadata.specimen!.rackMotion = {
    version: 1, door: { objectId: "door", closed: [0, 0, 0, 1], open: [0, -Math.sin(55 * Math.PI / 180), 0, Math.cos(55 * Math.PI / 180)] },
    tray: { objectId: "tray", retracted: [0, 0, 0], extended: [0, 0, .18] }, cutawayObjectIds: ["panel"], camera: profile,
    fitBounds: { min: [-2, -2, -2], max: [2, 4, 2] }, anchors: [],
    serviceDetail: { version: 1, camera: { camera: [2.2, 2.35, 1.55], target: [.015, 1.48, .17], padding: 1.12 }, fitBounds: { min: [-.345, 1.34, -.46], max: [.375, 1.62, .8] }, partIds: ["tray", "frame"], requiresCutaway: true },
  }
  driver.stage.mockResolvedValue({ model: overview, environment: null, dispose: overview.dispose }); driver.replace.mockResolvedValue(rack)
  driver.three = { camera, scene, size: { width: 390, height: 427 }, setDpr: vi.fn(), advance: () => driver.frame(), gl: { domElement: rendererCanvas(), render: () => scene.traverseVisible(object => { if (object instanceof Mesh) object.onAfterRender(undefined as never, scene, camera, object.geometry, object.material as never, undefined as never) }) } }
  const onAssetState = vi.fn(), props: FacilityCanvasProps = { release: { profile } as FacilityVisualRelease, generation: 1, visible: true, paused: false, reducedMotion: false, equipmentEnabled: true, selected: null, preview: null, onStaged: vi.fn(), onPresented: vi.fn(), onFailure: vi.fn(), onSelect: vi.fn(), onPreview: vi.fn(), onAssetState }
  const rendered = render(<EngineeringSession {...props} onDpr={vi.fn()} />)
  await act(async () => { await Promise.resolve() })
  const closed = { kind: "specimen", specimen: "rack", pose: "closed" } as const
  const service = { ...closed, pose: "service", rack: { door: "open", tray: "extended", cutaway: false } } as const
  const detail = { ...service, rack: { ...service.rack, cutaway: true }, detail: "service-connection" } as const
  const returning = { ...service, rack: { ...service.rack, cutaway: true } } as const
  const request = (view: FacilityCanvasProps["view"], extra: Partial<FacilityCanvasProps> = {}) => rendered.rerender(<EngineeringSession {...props} {...extra} view={view} onDpr={vi.fn()} />)
  let elapsed = 0
  const frame = (delta: number) => act(() => { elapsed += delta; driver.draw({ activeSeconds: elapsed, delta, interval: delta * 1000, targetFps: 30 }) })
  request(closed); await act(async () => { await Promise.resolve() }); frame(0)
  const wholeCamera = camera.position.toArray()
  request(detail)
  expect(onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed" }))
  expect(tray.position.z).toBe(0); expect(camera.position.toArray()).toEqual(wholeCamera)
  request(service); frame(.42); frame(.24)
  request(detail)
  expect(onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed" }))
  expect(tray.position.z).toBeCloseTo(.09); expect(camera.position.toArray()).toEqual(wholeCamera)
  frame(.24)
  request(service); frame(0); request(detail)
  expect(rack.ids.get("panel")!.visible).toBe(false)
  frame(.21); expect(tray.position.z).toBeCloseTo(.18); expect(camera.position.toArray()).not.toEqual(wholeCamera)
  request(closed)
  expect(onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed" }))
  expect(tray.position.z).toBeCloseTo(.18)
  frame(.21)
  expect(onAssetState).toHaveBeenLastCalledWith({ phase: "ready", view: detail })
  request(returning); frame(.21); request(closed)
  expect(onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed" }))
  expect(tray.position.z).toBeCloseTo(.18); frame(.21)
  expect(camera.position.toArray()).toEqual(wholeCamera)
  expect(onAssetState).toHaveBeenLastCalledWith({ phase: "ready", view: returning })
  request(detail, { reducedMotion: true }); frame(0)
  expect(onAssetState).toHaveBeenLastCalledWith({ phase: "ready", view: detail })
  request(returning, { paused: true }); frame(0)
  expect(camera.position.toArray()).toEqual(wholeCamera)
  request(closed); frame(.48); frame(.42)
  expect(tray.position.z).toBe(0); expect(door.quaternion.w).toBe(1)
  expect(driver.stage).toHaveBeenCalledOnce(); expect(driver.replace).toHaveBeenCalledOnce()
  expect(rack.dispose).not.toHaveBeenCalled(); expect(props.onFailure).not.toHaveBeenCalled()
})


it("cuts to a perspective detail in one owned frame and becomes ready when the platform is offscreen", async () => {
  const overview = model(), camera = new OrthographicCamera(), scene = new Scene()
  const nextProfile: FacilityVisualRelease["profile"] = { ...profile, inspection: {
    version: 1,
    mobile: { camera: [15, 11, 17], target: [1, 0, 0], padding: 1.12 },
    fitSubjects: { overview: { min: [-1, -2, -1], max: [1, 2, 1] }, "air-path": { min: [-1, -2, -1], max: [1, 2, 1] } },
    details: {
      rack: { camera: [3, 2, 5], target: [0, 0, 0], projection: "perspective", fov: 32, padding: 1.12 },
      "air-path": { camera: [2, 4, 3], target: [0, 0, 0], projection: "perspective", fov: 32, padding: 1.12 },
    },
  } }
  overview.profile = nextProfile
  overview.metadata = { topology: { schemaVersion: "facility-topology.v2", equipment: [{ id: "rack-02", index: 0, system: "workloads", label: "Rack 03", role: "rack", bounds: { min: [-1, -2, -1], max: [1, 2, 1] }, diagram: [0, 0] }], routes: [], ports: [], internalLinks: [] } }
  const platform = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()); platform.position.x = 100
  overview.probe = platform; overview.scene.add(platform)
  const cover = new Group(); overview.scene.add(cover); overview.sectionCovers = [cover]
  driver.stage.mockResolvedValue({ model: overview, environment: null, dispose: overview.dispose })
  const cameras: (OrthographicCamera | PerspectiveCamera)[] = [], frustum = new Frustum(), matrix = new Matrix4()
  driver.three = {
    camera, scene, size: { width: 720, height: 424 }, setDpr: vi.fn(), advance: () => driver.frame(),
    gl: { domElement: rendererCanvas(), render: (_scene: Scene, active: OrthographicCamera | PerspectiveCamera) => {
      cameras.push(active); scene.updateMatrixWorld(true)
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(active.projectionMatrix, active.matrixWorldInverse))
      scene.traverseVisible(object => { if (object instanceof Mesh && frustum.intersectsObject(object)) object.onAfterRender(undefined as never, scene, active, object.geometry, object.material as never, undefined as never) })
    } },
  }
  const callbacks = { onDpr: vi.fn(), onStaged: vi.fn(), onPresented: vi.fn(), onFailure: vi.fn(), onSelect: vi.fn(), onPreview: vi.fn(), onAssetState: vi.fn() }
  const props: FacilityCanvasProps = { release: { profile: nextProfile } as FacilityVisualRelease, generation: 1, visible: true, paused: true, reducedMotion: true, equipmentEnabled: false, selected: "workloads", preview: null, ...callbacks }
  const rendered = render(<EngineeringSession {...props} onDpr={callbacks.onDpr} />)
  await act(async () => { await Promise.resolve() })
  const frame = () => act(() => driver.draw({ activeSeconds: 0, delta: 0, interval: 0, targetFps: 30 }))
  frame()
  await act(async () => { await Promise.resolve() })
  expect(callbacks.onPresented).toHaveBeenCalledOnce()
  expect(frustum.intersectsObject(platform)).toBe(false)
  const detail: FacilityCanvasProps = { ...props, view: { kind: "overview", detail: "rack", equipmentId: "rack-02" } }
  rendered.rerender(<EngineeringSession {...detail} onDpr={callbacks.onDpr} />); frame()
  expect(cameras.at(-1)).toBeInstanceOf(PerspectiveCamera)
  expect(callbacks.onAssetState).toHaveBeenLastCalledWith({ phase: "ready", view: detail.view })
  const active = cameras.at(-1) as PerspectiveCamera
  expect(active.fov).toBe(32)
  resizeViewport(340, 255)
  rendered.rerender(<EngineeringSession {...detail} onDpr={callbacks.onDpr} />); frame()
  expect(cameras.at(-1)).toBe(active); expect(active.aspect).toBeCloseTo(4 / 3)
  rendered.rerender(<EngineeringSession {...props} view={{ kind: "overview", detail: "air-path" }} onDpr={callbacks.onDpr} />); frame()
  expect(cover.visible).toBe(false)
  rendered.rerender(<EngineeringSession {...props} view={{ kind: "overview" }} onDpr={callbacks.onDpr} />); frame()
  expect(cameras.at(-1)).toBe(camera); expect(cover.visible).toBe(true)
  // The CSS breakpoint can change while an orthographic section transition is pending.
  rendered.rerender(<EngineeringSession {...props} paused={false} reducedMotion={false} view={{ kind: "overview", section: "air-path" }} onDpr={callbacks.onDpr} />)
  act(() => driver.draw({ activeSeconds: .1, delta: .1, interval: 100, targetFps: 30 }))
  act(() => testMatchMedia.setMatches("(max-width: 639px)", true))
  act(() => driver.draw({ activeSeconds: .6, delta: .5, interval: 500, targetFps: 30 }))
  expect(camera.position.toArray()).toEqual([15, 11, 17])
  act(() => testMatchMedia.setMatches("(max-width: 639px)", false))
  expect(driver.stage).toHaveBeenCalledOnce(); expect(driver.replace).not.toHaveBeenCalled()
  expect(callbacks.onSelect).not.toHaveBeenCalled(); expect(callbacks.onFailure).not.toHaveBeenCalled()
  platform.geometry.dispose(); (platform.material as MeshBasicMaterial).dispose()
})


it("restores the previous scene, camera and exposure if a staged assembly fails its first frame", async () => {
  const overview = model(), rack = model(true), camera = new OrthographicCamera(), scene = new Scene()
  rack.profile = { ...profile, exposure: 2 }
  driver.stage.mockResolvedValue({ model: overview, environment: null, dispose: overview.dispose })
  driver.replace.mockResolvedValue(rack)
  const renderer = {
    domElement: rendererCanvas(), toneMappingExposure: 1,
    render: () => {
      if (rack.scene.parent && rack.scene.visible) throw new Error("First frame submission failed")
      scene.traverseVisible(object => { if (object instanceof Mesh) object.onAfterRender(undefined as never, scene, camera, object.geometry, object.material as never, undefined as never) })
    },
  }
  driver.three = { camera, scene, size: { width: 720, height: 424 }, setDpr: vi.fn(), advance: () => driver.frame(), gl: renderer }
  const callbacks = { onDpr: vi.fn(), onStaged: vi.fn(), onPresented: vi.fn(), onFailure: vi.fn(), onSelect: vi.fn(), onPreview: vi.fn(), onAssetState: vi.fn() }
  const props: FacilityCanvasProps = { release: { profile } as FacilityVisualRelease, generation: 1, visible: true, paused: true, reducedMotion: true, equipmentEnabled: false, selected: null, preview: null, ...callbacks }
  const rendered = render(<EngineeringSession {...props} onDpr={callbacks.onDpr} />)
  await act(async () => { await Promise.resolve(); driver.draw({ activeSeconds: 0, delta: 0, interval: 0, targetFps: 30 }) })
  const previousPosition = camera.position.clone(), previousFrustum = [camera.left, camera.right, camera.top, camera.bottom]
  rendered.rerender(<EngineeringSession {...props} view={{ kind: "specimen", specimen: "rack", pose: "closed" }} onDpr={callbacks.onDpr} />)
  await act(async () => { await Promise.resolve() })
  expect(renderer.toneMappingExposure).toBe(2)
  act(() => driver.draw({ activeSeconds: 0, delta: 0, interval: 0, targetFps: 30 }))
  expect(renderer.toneMappingExposure).toBe(1)
  expect(camera.position).toEqual(previousPosition)
  expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual(previousFrustum)
  expect(overview.scene.parent).toBe(scene); expect(overview.scene.visible).toBe(true)
  expect(overview.dispose).not.toHaveBeenCalled(); expect(rack.dispose).toHaveBeenCalledOnce()
  expect(callbacks.onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed" }))
  expect(callbacks.onFailure).not.toHaveBeenCalled()
})

it("binds finite lighting with the actual presented asset and restores it after prewarm and first-frame failure", async () => {
  vi.useFakeTimers()
  const finite = { version: 1, type: "point", position: [2.8, 5.1, 3.4], color: "#f5f5f3", intensity: 42, decay: 2, distance: 0 } as const
  const overview = model(), rack = model(true), camera = new OrthographicCamera(), scene = new Scene()
  const rootProfile: FacilityVisualRelease["profile"] = { ...profile, lighting: { ...profile.lighting, finite: { ...finite, position: [...finite.position] } }, ecosystem: { version: 1, seed: 61427, ambientIntervalSeconds: [12, 18], sequenceSeconds: 8, chapterSeconds: [4, 4, 5, 4, 4, 3], colors: { electrical: "#e3e7e4", cooling: "#76abb4", heat: "#c98554" }, fanModulation: .1, maxEquipment: 96, maxRoutes: 128, maxTraces: 2 } }
  overview.profile = { ...profile, lighting: rootProfile.lighting }
  const rackProfile: FacilityVisualRelease["profile"] = { ...profile, lighting: { ...profile.lighting, finite: { ...finite, position: [1.5, 2.8, 1.9], intensity: 6 } } }
  rack.profile = rackProfile
  for (const asset of [overview, rack]) asset.statistics = { estimatedBytes: 1000, peakEstimatedBytes: 1000, environmentBytes: 0, materials: 1 }
  const firstCompile = deferred<Group>(), stalledCompile = deferred<Group>()
  const compileAsync = vi.fn().mockReturnValueOnce(firstCompile.promise).mockReturnValueOnce(stalledCompile.promise)
  driver.stage.mockResolvedValue({ model: overview, environment: null, dispose: overview.dispose }); driver.replace.mockResolvedValue(rack)
  let failRender = false
  const renderedLights: { position: number[]; intensity: number }[] = []
  const light = () => scene.getObjectByName("GN_FINITE_SERVICE_LIGHT") as import("three").PointLight
  const renderer = { domElement: rendererCanvas(), compileAsync, getContext: () => ({ isContextLost: () => false }), render: () => {
    renderedLights.push({ position: light().position.toArray(), intensity: light().intensity })
    if (failRender) throw new Error("injected_first_frame_failure")
    scene.traverseVisible(object => { if (object instanceof Mesh) object.onAfterRender(undefined as never, scene, camera, object.geometry, object.material as never, undefined as never) })
  } }
  driver.three = { camera, scene, size: { width: 1000, height: 600 }, setDpr: vi.fn(), advance: () => driver.frame(), gl: renderer }
  const callbacks = { onDpr: vi.fn(), onStaged: vi.fn(), onPresented: vi.fn(), onFailure: vi.fn(), onSelect: vi.fn(), onPreview: vi.fn(), onAssetState: vi.fn() }
  const props: FacilityCanvasProps = { release: { profile: rootProfile } as FacilityVisualRelease, generation: 1, visible: true, paused: true, reducedMotion: false, equipmentEnabled: false, selected: null, preview: null, ...callbacks }
  const rendered = render(<EngineeringSession {...props} onDpr={callbacks.onDpr} />)
  const point = light(), dispose = vi.spyOn(point, "dispose")
  await act(async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(0) })
  expect(light()).toBe(point); expect(light().intensity).toBe(42)
  await act(async () => firstCompile.resolve(overview.scene))
  const frame = () => act(() => driver.draw({ activeSeconds: 0, delta: 0, interval: 0, targetFps: 30 }))
  frame()
  expect(renderedLights.at(-1)).toEqual({ position: finite.position, intensity: 42 })
  const rackView = { kind: "specimen", specimen: "rack", pose: "closed" } as const
  rendered.rerender(<EngineeringSession {...props} view={rackView} onDpr={callbacks.onDpr} />)
  await act(async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(0) })
  expect(light().intensity).toBe(42); expect(overview.scene.visible).toBe(true)
  await act(async () => vi.advanceTimersByTimeAsync(8000))
  expect(light().intensity).toBe(42); expect(rack.dispose).toHaveBeenCalledOnce()
  await act(async () => stalledCompile.resolve(rack.scene))
  expect(light()).toBe(point); expect(light().intensity).toBe(42)

  const retry = model(true)
  retry.profile = rackProfile; retry.statistics = { estimatedBytes: 1000, peakEstimatedBytes: 1000, environmentBytes: 0, materials: 1 }
  driver.replace.mockResolvedValue(retry); compileAsync.mockResolvedValue(retry.scene)
  rendered.rerender(<EngineeringSession {...props} view={rackView} assetRetry={1} onDpr={callbacks.onDpr} />)
  await act(async () => { await Promise.resolve(); await vi.advanceTimersByTimeAsync(0) })
  expect(light().intensity).toBe(6)
  failRender = true; frame()
  expect(renderedLights.at(-1)).toEqual({ position: [1.5, 2.8, 1.9], intensity: 6 })
  expect(light().intensity).toBe(42); expect(light().position.toArray()).toEqual(finite.position)
  expect(overview.scene.visible).toBe(true); expect(retry.dispose).toHaveBeenCalledOnce()
  expect(overview.statistics.estimatedBytes).toBe(5096)
  expect(callbacks.onAssetState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed" }))
  rendered.unmount()
  expect(dispose).toHaveBeenCalledOnce(); expect(scene.getObjectByName("GN_FINITE_SERVICE_LIGHT")).toBeUndefined()
})
