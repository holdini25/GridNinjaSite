import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BoxGeometry, BufferGeometry, Group, InstancedMesh, Material, Mesh, MeshStandardMaterial, Object3D, SRGBColorSpace, Texture } from "three"
import type { FacilityVisualRelease } from "@/types/facility"

type Parser = { loadGeometries: () => Promise<BufferGeometry[]>; loadMaterial: (index: number) => Promise<Material>; loadTexture: (index: number) => Promise<Texture>; loadMesh: () => Promise<Group>; textureLoader?: { load: (url: string, onLoad: (image: unknown) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) => unknown } }
type Plugin = { loadMaterial: (index: number) => Promise<Material>; loadTexture: (index: number) => Promise<Texture>; loadMesh: (index: number) => Promise<Group> }
type Factory = (parser: Parser) => Plugin
const loader = vi.hoisted(() => ({ parse: vi.fn() }))
vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {
  private factory!: Factory
  register(factory: Factory) { this.factory = factory; return this }
  parseAsync() { return loader.parse(this.factory) }
} }))
vi.mock("@/lib/facility/asset-preflight", () => ({ fetchFacilityBytes: vi.fn(async () => new ArrayBuffer(20)), preflightFacilityGlb: vi.fn() }))
import { loadFacilityModel } from "@/lib/facility/asset-runtime"
import frozenV4 from "@/content/facility-releases/facility-v4/manifest.json"

const file = { url: "/model.glb", bytes: 20, sha256: "0".repeat(64) }
const release: FacilityVisualRelease = {
  schemaVersion: "facility.v1", release: "ownership-test", environment: "synthetic", model: file, posters: { desktop: file, mobile: file },
  profile: { camera: [12, 10, 15], target: [0, 1, 0], padding: 1.12, background: "#0b1016", exposure: 1, colorSpace: "srgb", toneMapping: "aces-filmic", lighting: { hemisphere: { sky: "#ffffff", ground: "#000000", intensity: 1 }, directional: [] } },
  systems: Object.fromEntries(["power", "cooling", "storage", "workloads"].map(system => [system, { root: `GN_${system.toUpperCase()}`, accent: `GN_ACCENT_${system.toUpperCase()}`, pick: `GN_PICK_${system.toUpperCase()}` }])) as FacilityVisualRelease["systems"],
  equipment: { rotors: Array.from({ length: 4 }, (_, index) => ({ id: `GN_FAN_ROTOR_0${index}`, axis: [0, 1, 0] })), leds: Array.from({ length: 48 }, (_, index) => `GN_LED_${String(index).padStart(2, "0")}`) },
}

function fixture() {
  const scene = new Group(), root = new Group(), material = new MeshStandardMaterial(), geometries: BufferGeometry[] = []
  root.userData.gnId = "GN_EXPORT"; scene.add(root)
  const group = (id: string, parent: Object3D) => { const node = new Group(); node.userData.gnId = id; parent.add(node); return node }
  const mesh = (parent: Object3D) => { const geometry = new BoxGeometry(1, 1, 1); geometries.push(geometry); const node = new Mesh(geometry, material); parent.add(node); return node }
  mesh(group("GN_PLATFORM", root))
  const domains = new Map<string, Group>()
  for (const [system, binding] of Object.entries(release.systems)) {
    const domain = group(binding.root, root); domains.set(system, domain)
    mesh(group(binding.accent, domain)); mesh(group(binding.pick, domain))
  }
  for (const binding of release.equipment.rotors) {
    const node = group(binding.id, domains.get("cooling")!)
    Object.assign(node.userData, { gnRole: "fan_rotor", gnDomain: "cooling" })
  }
  for (const id of release.equipment.leds) {
    const node = group(id, domains.get("workloads")!)
    Object.assign(node.userData, { gnRole: "activity_led", gnDomain: "workloads" })
  }
  const textures = [new Texture(), new Texture()]
  material.map = textures[0]; material.normalMap = textures[1]
  const parser: Parser = {
    loadGeometries: async () => geometries,
    loadMaterial: async () => material,
    loadTexture: async index => textures[index],
    loadMesh: async () => scene,
  }
  return { scene, root, geometries, material, textures, parser }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

let source: ReturnType<typeof fixture>
beforeEach(() => {
  source = fixture()
  loader.parse.mockReset().mockImplementation(async (factory: Factory) => {
    const plugin = factory(source.parser)
    await plugin.loadMesh(0)
    return { scene: source.scene }
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("exclusive facility resource ownership", () => {
  it.each(["decode-error", "abort"])("revokes this parser's image URLs on %s, including late completion", async mode => {
    const next = structuredClone(release)
    next.profile.engineering = structuredClone(frozenV4.profile.engineering) as NonNullable<FacilityVisualRelease["profile"]["engineering"]>
    next.profile.surfaces = { version: 1, pipeline: "pbr-semantic-v2", uvSet: 0, maxTextureBytes: 3145728 }
    const revoke = vi.fn(); vi.stubGlobal("URL", class extends URL { static revokeObjectURL = revoke })
    const began = deferred<void>(), finished = deferred<void>()
    let fail: (error: unknown) => void = () => {}
    source.parser.textureLoader = { load: (_url, _onLoad, _onProgress, onError) => { fail = onError!; began.resolve() } }
    source.parser.loadTexture = async () => new Promise<Texture>(resolve => source.parser.textureLoader!.load("blob:owned-facility-image", () => resolve(source.textures[0]), undefined, () => resolve(null as unknown as Texture)))
    loader.parse.mockImplementation(async (factory: Factory) => {
      const plugin = factory(source.parser)
      try { await plugin.loadTexture(0); return { scene: source.scene } } finally { finished.resolve() }
    })
    const controller = new AbortController(), pending = loadFacilityModel(next, controller.signal)
    await began.promise
    if (mode === "abort") controller.abort()
    else fail(new Error("decode failure"))
    if (mode === "abort") await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    else await expect(pending).rejects.toThrow("surface_texture_decode")
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:owned-facility-image")
    if (mode === "abort") fail(new Error("late decode failure"))
    await finished.promise
    expect(revoke).toHaveBeenCalledOnce()
  })

  it("fails v5 image decode atomically and disposes resources loaded before GLTFLoader's null fallback", async () => {
    const next = structuredClone(release)
    next.profile.engineering = structuredClone(frozenV4.profile.engineering) as NonNullable<FacilityVisualRelease["profile"]["engineering"]>
    next.profile.surfaces = { version: 1, pipeline: "pbr-semantic-v2", uvSet: 0, maxTextureBytes: 3145728 }
    source.parser.loadTexture = async () => null as unknown as Texture
    loader.parse.mockImplementation(async (factory: Factory) => {
      const plugin = factory(source.parser)
      await plugin.loadMesh(0)
      await plugin.loadTexture(0)
      return { scene: source.scene }
    })
    const dispose = vi.spyOn(Texture.prototype, "dispose")
    await expect(loadFacilityModel(next, new AbortController().signal)).rejects.toThrow("surface_texture_decode")
    for (const texture of source.textures) expect(dispose.mock.contexts.filter(item => item === texture)).toHaveLength(1)
  })

  it("retains legacy null-texture fallback without registering null as an owned resource", async () => {
    source.parser.loadTexture = async () => null as unknown as Texture
    loader.parse.mockImplementation(async (factory: Factory) => {
      const plugin = factory(source.parser)
      await plugin.loadMesh(0); await plugin.loadTexture(0)
      return { scene: source.scene }
    })
    const model = await loadFacilityModel(release, new AbortController().signal)
    expect(() => model.dispose()).not.toThrow()
  })

  it("uses the v5 authored accent materials and geometry directly while disposing shared resources once", async () => {
    const next = structuredClone(release)
    next.profile.engineering = structuredClone(frozenV4.profile.engineering) as NonNullable<FacilityVisualRelease["profile"]["engineering"]>
    next.profile.surfaces = { version: 1, pipeline: "pbr-semantic-v2", uvSet: 0, maxTextureBytes: 3145728 }
    source.root.userData.gnTopology = {
      schemaVersion: "facility-topology.v1", equipment: [{ id: "power", index: 0, label: "Power", system: "power", role: "distribution", bounds: { min: [-1, -1, -1], max: [1, 1, 1] }, diagram: [0, 0] }],
      ports: [{ id: "a", equipmentId: "power", service: "electrical", position: [0, 0, 0] }, { id: "b", equipmentId: "power", service: "electrical", position: [1, 0, 0] }],
      routes: [{ id: "route", index: 0, system: "power", service: "electrical", from: "a", to: "b", path: [[0, 0, 0], [1, 0, 0]], lengthMetres: 1 }], internalLinks: [],
    }
    source.material.map!.colorSpace = SRGBColorSpace
    const materialClones = vi.spyOn(Material.prototype, "clone"), geometryClones = vi.spyOn(BufferGeometry.prototype, "clone"), disposal = vi.spyOn(Texture.prototype, "dispose")
    const model = await loadFacilityModel(next, new AbortController().signal)
    expect(materialClones).not.toHaveBeenCalled(); expect(geometryClones).not.toHaveBeenCalled()
    for (const materials of Object.values(model.accents)) expect(materials).toEqual([source.material])
    expect(model.engineering?.surfaces).toBeDefined()
    expect(source.geometries.every(geometry => !geometry.hasAttribute("gnDomain"))).toBe(true)
    model.dispose(); model.dispose()
    expect(model.coverageMasks!.size).toBe(0)
    for (const texture of source.textures) expect(disposal.mock.contexts.filter(item => item === texture)).toHaveLength(1)
  })

  it("retains legacy initial equipment appearance without optional v3 settings", async () => {
    const model = await loadFacilityModel(release, new AbortController().signal)
    expect(model.fans.map(fan => fan.phase)).toEqual([0, 0, 0, 0])
    expect(model.leds.geometry).toMatchObject({ parameters: { width: 0.027, height: 0.012, depth: 0.025 } })
    expect(Array.from(model.leds.instanceColor!.array).slice(0, 3)).toEqual([expect.closeTo(0.72), 0.5, expect.closeTo(0.24)])
    model.dispose()
  })

  it("applies release fan phases about their exported axes and one explicit amber LED color", async () => {
    const next = structuredClone(release)
    next.profile.motion = { fanRadiansPerSecond: 1.6, fanPhaseOffsets: [0, 1.57, 3.14, 4.71], ledPulseRadiansPerSecond: 1.8, ledPulseAmplitude: 0.06 }
    next.profile.led = { color: "#ffc079", steadyIntensity: 0.9, size: [0.032, 0.022, 0.018] }
    const model = await loadFacilityModel(next, new AbortController().signal)
    expect(model.fans.map(fan => fan.phase)).toEqual(next.profile.motion.fanPhaseOffsets)
    for (const fan of model.fans) {
      expect(fan.object.quaternion.x).toBe(0)
      expect(fan.object.quaternion.z).toBe(0)
      expect(fan.object.quaternion.y).toBeCloseTo(Math.sin(fan.phase / 2))
    }
    expect(model.leds.geometry).toMatchObject({ parameters: { width: 0.032, height: 0.022, depth: 0.018 } })
    expect(Array.from(model.leds.instanceColor!.array).slice(0, 3)).toEqual([expect.closeTo(0.9), expect.closeTo(0.9), expect.closeTo(0.9)])
    model.dispose()
  })

  it("disposes source resources, cloned accents, and instance buffers exactly once", async () => {
    const geometries = vi.spyOn(BufferGeometry.prototype, "dispose"), materials = vi.spyOn(Material.prototype, "dispose")
    const textures = vi.spyOn(Texture.prototype, "dispose"), instances = vi.spyOn(InstancedMesh.prototype, "dispose")
    const model = await loadFacilityModel(release, new AbortController().signal)
    const ownedAccents: BufferGeometry[] = []
    model.scene.traverse(node => { if (node instanceof Mesh && node.geometry.hasAttribute("gnDomain")) ownedAccents.push(node.geometry) })
    model.dispose(); model.dispose()
    for (const geometry of [...source.geometries, ...ownedAccents, model.leds.geometry]) expect(geometries.mock.contexts.filter(value => value === geometry)).toHaveLength(1)
    expect(new Set(materials.mock.contexts).size).toBe(materials.mock.calls.length)
    for (const texture of source.textures) expect(textures.mock.contexts.filter(value => value === texture)).toHaveLength(1)
    expect(instances.mock.contexts.filter(value => value === model.leds)).toHaveLength(1)
  })

  it("owns accent clones immediately when a later system binding fails", async () => {
    const clones = vi.spyOn(BufferGeometry.prototype, "clone"), geometryDisposal = vi.spyOn(BufferGeometry.prototype, "dispose")
    const materials = vi.spyOn(Material.prototype, "dispose")
    const invalid = structuredClone(release); invalid.systems.cooling.pick = "GN_MISSING_PICK"
    await expect(loadFacilityModel(invalid, new AbortController().signal)).rejects.toThrow("model_system_binding")
    const created = clones.mock.results.filter(result => result.type === "return").map(result => result.value as BufferGeometry)
    expect(created).toHaveLength(1)
    for (const geometry of created) expect(geometryDisposal.mock.contexts.filter(value => value === geometry)).toHaveLength(1)
    expect(materials.mock.contexts).toHaveLength(2) // Source and first shared accent clone.
  })

  it("releases a new LED material, geometry and InstancedMesh when construction fails before scene attachment", async () => {
    const geometryDisposal = vi.spyOn(BufferGeometry.prototype, "dispose"), materialDisposal = vi.spyOn(Material.prototype, "dispose")
    const instanceDisposal = vi.spyOn(InstancedMesh.prototype, "dispose")
    const setMatrixAt = InstancedMesh.prototype.setMatrixAt
    vi.spyOn(InstancedMesh.prototype, "setMatrixAt").mockImplementation(function (this: InstancedMesh, ...args) {
      // The constructor initializes instance matrices before the owner can see it.
      if (this.name === "GN_EQUIPMENT_LEDS") throw new Error("injected LED setup failure")
      return setMatrixAt.apply(this, args)
    })
    await expect(loadFacilityModel(release, new AbortController().signal)).rejects.toThrow("injected LED setup failure")
    expect(instanceDisposal).toHaveBeenCalledTimes(1)
    const instance = instanceDisposal.mock.contexts[0] as InstancedMesh
    expect(instance.parent).toBeNull()
    expect(geometryDisposal.mock.contexts.filter(value => value === instance.geometry)).toHaveLength(1)
    expect(materialDisposal.mock.contexts.filter(value => value === instance.material)).toHaveLength(1)
  })

  it("closes a shared ImageBitmap only once even when two textures reference it", async () => {
    class Bitmap { width = 1; height = 1; close = vi.fn() }
    vi.stubGlobal("ImageBitmap", Bitmap)
    const bitmap = new Bitmap()
    for (const texture of source.textures) texture.source.data = bitmap
    const model = await loadFacilityModel(release, new AbortController().signal)
    model.dispose(); model.dispose()
    expect(bitmap.close).toHaveBeenCalledTimes(1)
  })

  it("aborts ownership promptly during parsing and disposes resources that finish afterward", async () => {
    const began = deferred<void>(), continueParse = deferred<void>(), finished = deferred<void>()
    const geometryDisposal = vi.spyOn(BufferGeometry.prototype, "dispose"), materialDisposal = vi.spyOn(Material.prototype, "dispose"), textureDisposal = vi.spyOn(Texture.prototype, "dispose")
    const earlyMaterial = new MeshStandardMaterial(), lateGeometry = new BoxGeometry(), lateTexture = new Texture()
    const parser: Parser = { ...source.parser, loadMaterial: async () => earlyMaterial, loadGeometries: async () => [lateGeometry], loadTexture: async () => lateTexture }
    loader.parse.mockImplementation(async (factory: Factory) => {
      const plugin = factory(parser)
      await plugin.loadMaterial(0)
      began.resolve()
      await continueParse.promise
      await parser.loadGeometries()
      await plugin.loadTexture(0)
      finished.resolve()
      return { scene: source.scene }
    })
    const controller = new AbortController()
    const pending = loadFacilityModel(release, controller.signal)
    await began.promise
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    expect(materialDisposal.mock.contexts.filter(value => value === earlyMaterial)).toHaveLength(1)
    expect(geometryDisposal.mock.contexts).not.toContain(lateGeometry)
    continueParse.resolve()
    await finished.promise; await Promise.resolve()
    expect(geometryDisposal.mock.contexts.filter(value => value === lateGeometry)).toHaveLength(1)
    expect(textureDisposal.mock.contexts.filter(value => value === lateTexture)).toHaveLength(1)
    for (const geometry of source.geometries) expect(geometryDisposal.mock.contexts.filter(value => value === geometry)).toHaveLength(1)
  })
})
