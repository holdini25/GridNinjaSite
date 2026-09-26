import {
  Box3, BoxGeometry, Color, Float32BufferAttribute, Group, InstancedBufferAttribute, InstancedMesh, Material, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Texture, Vector3,
  type BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute,
} from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

import { fetchFacilityBytes, preflightFacilityGlb } from "./asset-preflight"
import { FACILITY_SYSTEMS, type FacilitySystem, type FacilityVisualRelease, type FacilitySpecimenKind, type FacilitySceneMetadata, type FacilityRenderProfile } from "@/types/facility"

import { parseSpecimen, parseTopology } from "./topology-runtime"
import { bindEngineeringMaterials, type EngineeringBindings } from "./engineering-materials"
import { surfaceTextureBytes } from "./surface-contract"
import { validateInspectionContract } from "./inspection-contract"
import { createSurfaceCoverage, type SurfaceCoverage } from "./surface-coverage"

export type FacilityModel = {
  ids: Map<string, Object3D>
  metadata: FacilitySceneMetadata
  profile: FacilityRenderProfile
  engineering?: EngineeringBindings
  coverageMasks?: Map<Material, SurfaceCoverage>
  surfacePicks: Mesh[]
  sectionCovers: Object3D[]
  ledAnchors: Object3D[]
  scene: Group
  bounds: Box3
  probe: Mesh
  accents: Record<FacilitySystem, MeshStandardMaterial[]>
  accentWeights: Float32Array
  picks: Mesh[]
  pickSystems: Map<Object3D, FacilitySystem>
  fans: { object: Object3D; axis: Vector3; base: Quaternion; phase: number }[]
  leds: InstancedMesh
  statistics: { materials: number; estimatedBytes: number; peakEstimatedBytes: number; environmentBytes: number }
  dispose: () => void
}

function under(object: Object3D, ancestor: Object3D): boolean {
  for (let parent: Object3D | null = object; parent; parent = parent.parent) if (parent === ancestor) return true
  return false
}

/** Resources are exclusive to this session, including detached picking geometry. */
function resourceOwner() {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  const instances = new Set<InstancedMesh>()
  const imageUrls = new Set<string>()
  const released = new WeakSet<object>()
  const closedBitmaps = new WeakSet<object>()
  let disposed = false
  const disposeOnce = (entry: { dispose: () => void }) => {
    if (released.has(entry)) return
    released.add(entry)
    entry.dispose()
  }
  const disposeTexture = (entry: Texture) => {
    disposeOnce(entry)
    const source = entry.source.data
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap && !closedBitmaps.has(source)) { closedBitmaps.add(source); source.close() }
  }
  const texture = <T extends Texture>(entry: T): T => {
    if (textures.has(entry)) return entry
    textures.add(entry)
    if (disposed) disposeTexture(entry)
    return entry
  }
  const geometry = <T extends BufferGeometry>(entry: T): T => {
    if (geometries.has(entry)) return entry
    geometries.add(entry)
    if (disposed) disposeOnce(entry)
    return entry
  }
  const material = <T extends Material>(entry: T): T => {
    if (!materials.has(entry)) {
      materials.add(entry)
      if (disposed) disposeOnce(entry)
    }
    for (const value of Object.values(entry)) if (value instanceof Texture) texture(value)
    return entry
  }
  const instanced = (entry: InstancedMesh) => {
    if (!instances.has(entry)) {
      instances.add(entry)
      if (disposed) disposeOnce(entry)
    }
    geometry(entry.geometry)
    for (const value of Array.isArray(entry.material) ? entry.material : [entry.material]) material(value)
    return entry
  }
  return {
    collect(scene: Object3D) {
      scene.traverse(object => {
        if (object instanceof Mesh) {
          if (object instanceof InstancedMesh) instanced(object)
          geometry(object.geometry)
          for (const entry of Array.isArray(object.material) ? object.material : [object.material]) material(entry)
        }
      })
    },
    material, texture, geometry, instanced,
    imageUrl(url: string) {
      if (!url.startsWith("blob:")) throw new Error("surface_image_url")
      if (disposed) URL.revokeObjectURL(url)
      else imageUrls.add(url)
      return (failed = false) => {
        // GLTFLoader revokes on success; its rejection path omits that cleanup.
        if (imageUrls.delete(url) && failed) URL.revokeObjectURL(url)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const url of imageUrls) URL.revokeObjectURL(url)
      imageUrls.clear()
      for (const instance of instances) disposeOnce(instance)
      for (const texture of textures) disposeTexture(texture)
      for (const entry of materials) disposeOnce(entry)
      for (const geometry of geometries) disposeOnce(geometry)
      // Retain the small identity sets until outstanding parser promises settle,
      // so late resources are disposed once rather than escaping a failed parse.
    },
  }
}

export async function loadFacilityModel(release: FacilityVisualRelease, signal: AbortSignal, specimenKind?: FacilitySpecimenKind): Promise<FacilityModel> {
  const specimen = specimenKind ? release.specimens?.[specimenKind] : undefined
  if (specimenKind && !specimen) throw new Error("specimen_unavailable")
  const profile = specimen?.profile ?? release.profile
  if (profile.surfaces && !profile.engineering) throw new Error("surface_engineering_profile")
  const bytes = await fetchFacilityBytes(specimen?.model ?? release.model, signal)
  preflightFacilityGlb(bytes, specimen ? ["GN_SPECIMEN_ROOT", ...specimen.requiredIds] : undefined, profile.surfaces, specimenKind)
  signal.throwIfAborted()
  const owner = resourceOwner()
  const coverageMasks = new Map<Material, SurfaceCoverage>()
  let scene: Group | undefined
  let rejectAbort: (reason: unknown) => void = () => {}
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject })
  const abort = () => { coverageMasks.clear(); owner.dispose(); rejectAbort(signal.reason) }
  signal.addEventListener("abort", abort, { once: true })
  try {
    signal.throwIfAborted()
    // No global cache: a late parse belongs only to this request and is disposed below.
    const loader = new GLTFLoader()
    loader.register(parser => {
      if (profile.surfaces && parser.textureLoader) {
        // Scope ownership to this parser's loader, never the global URL API.
        const imageLoader = parser.textureLoader as unknown as { load: (url: string, onLoad: (image: unknown) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) => unknown }
        const load = imageLoader.load.bind(imageLoader)
        imageLoader.load = (url, onLoad, onProgress, onError) => {
          const release = owner.imageUrl(url)
          try { return load(url, image => { release(); onLoad(image) }, onProgress, error => { release(true); onError?.(error) }) }
          catch (error) { release(true); throw error }
        }
      }
      const originalGeometries = parser.loadGeometries.bind(parser)
      parser.loadGeometries = async primitives => {
        const geometries = await originalGeometries(primitives)
        for (const geometry of geometries) owner.geometry(geometry)
        return geometries
      }
      return {
        name: "GN_exclusive_resource_owner",
        loadMaterial: async index => { const material = await parser.loadMaterial(index); owner.material(material); return material },
        loadTexture: async index => {
          const texture = await parser.loadTexture(index)
          // GLTFLoader resolves decode failures to null. V5 cannot present an
          // untextured substitute for an approved surface; legacy fallback remains.
          if (!texture) { if (profile.surfaces) throw new Error("surface_texture_decode"); return texture }
          owner.texture(texture); return texture
        },
        loadMesh: async index => { const mesh = await parser.loadMesh(index); owner.collect(mesh); return mesh },
      }
    })
    // Parsing cannot itself be cancelled. Reject the session promptly while the
    // owner remains attached to parser hooks and disposes every late resource.
    const parsing = loader.parseAsync(bytes, "").then(gltf => {
      owner.collect(gltf.scene)
      if (signal.aborted) { gltf.scene.removeFromParent(); signal.throwIfAborted() }
      return gltf
    })
    const gltf = await Promise.race([parsing, aborted])
    scene = gltf.scene
    owner.collect(scene)
    signal.throwIfAborted()
    const ids = new Map<string, Object3D>()
    scene.traverse(object => {
      const id: unknown = object.userData.gnId
      if (typeof id === "string") {
        if (ids.has(id)) throw new Error("duplicate_scene_identity")
        ids.set(id, object)
      }
    })
    const root = ids.get(specimen ? "GN_SPECIMEN_ROOT" : "GN_EXPORT")
    const platform = specimen ? root : ids.get("GN_PLATFORM")
    let probe: Mesh | undefined
    platform?.traverse(object => { if (!probe && object instanceof Mesh) probe = object })
    if (!root || !platform || !probe || !under(platform, root)) throw new Error("model_probe")
    if (root.position.lengthSq() > 0.00001 || Math.abs(root.scale.x - 1) + Math.abs(root.scale.y - 1) + Math.abs(root.scale.z - 1) > 0.00001 || Math.abs(root.quaternion.w) < 0.99999) throw new Error("model_root_transform")
    scene.updateMatrixWorld(true)
    for (const id of specimen?.requiredIds ?? []) if (!ids.has(id)) throw new Error("specimen_required_identity")
    const metadata: FacilitySceneMetadata = specimen ? { specimen: parseSpecimen(root.userData.gnSpecimen) } : profile.engineering ? { topology: parseTopology(root.userData.gnTopology) } : {}
    if (profile.ecosystem && metadata.topology?.schemaVersion !== "facility-topology.v2") throw new Error("ecosystem_topology_required")
    validateInspectionContract(profile, metadata.topology, release.equipmentIndex, root.userData.gnPresentation)
    const sectionCovers: Object3D[] = []
    for (const id of metadata.topology?.ecosystem?.sections.flatMap(section => section.coverIds) ?? []) {
      const cover = ids.get(id)
      if (!cover || !under(cover, root) || sectionCovers.includes(cover)) throw new Error("ecosystem_section_binding")
      sectionCovers.push(cover)
    }
    if (specimen && (metadata.specimen?.kind !== specimen.kind || metadata.specimen.system !== specimen.system)) throw new Error("specimen_kind")
    for (const part of metadata.specimen?.parts ?? []) if (!ids.has(part.objectId) || !under(ids.get(part.objectId)!, root)) throw new Error("specimen_part_binding")
    const rackMotion = metadata.specimen?.rackMotion
    if (rackMotion) {
      const door = ids.get(rackMotion.door.objectId)!, tray = ids.get(rackMotion.tray.objectId)!
      if (under(door, tray) || under(tray, door) || rackMotion.cutawayObjectIds.some(id => under(door, ids.get(id)!) || under(tray, ids.get(id)!) || under(ids.get(id)!, door) || under(ids.get(id)!, tray))) throw new Error("specimen_joint_ancestry")
      if (Math.abs(Math.abs(door.quaternion.toArray().reduce((sum, value, index) => sum + value * rackMotion.door.closed[index], 0)) - 1) > .0001 || tray.position.distanceTo(new Vector3(...rackMotion.tray.retracted)) > .0001) throw new Error("specimen_joint_rest")
    }
    const accents = {} as FacilityModel["accents"]
    const accentWeights = new Float32Array(4)
    let sharedAccent: MeshStandardMaterial | undefined
    const picks: Mesh[] = []
    const pickSystems = new Map<Object3D, FacilitySystem>()
    for (const system of FACILITY_SYSTEMS) {
      if (specimen) { accents[system] = []; continue }
      const contract = release.systems[system]
      const domain = ids.get(contract.root)
      const accent = ids.get(contract.accent)
      const proxy = ids.get(contract.pick)
      if (!domain || !accent || !proxy || !under(domain, root) || !under(accent, domain) || !under(proxy, domain)) throw new Error("model_system_binding")
      const owned = new Set<MeshStandardMaterial>()
      accent.traverse(object => {
        if (!(object instanceof Mesh)) return
        const bind = (source: Material) => {
          if (!(source instanceof MeshStandardMaterial)) throw new Error("model_accent_material")
          if (profile.surfaces) { owned.add(source); return source }
          if (!sharedAccent) {
            sharedAccent = owner.material(source.clone())
            sharedAccent.color.set("white")
            sharedAccent.emissive.set("black")
            sharedAccent.onBeforeCompile = shader => {
              shader.uniforms.gnWeights = { value: accentWeights }
              shader.uniforms.gnNeutral = { value: new Color("#976036") }
              shader.uniforms.gnSelected = { value: new Color("#f9b45d") }
              shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float gnDomain;\nvarying float vGnDomain;")
                .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGnDomain = gnDomain;")
              shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float gnWeights[4];\nuniform vec3 gnNeutral;\nuniform vec3 gnSelected;\nvarying float vGnDomain;")
                .replace("#include <color_fragment>", "#include <color_fragment>\nfloat gnStrength = gnWeights[int(vGnDomain + 0.5)];\ndiffuseColor.rgb = mix(gnNeutral, gnSelected, gnStrength);")
                .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance = gnSelected * (0.025 + 0.28 * gnStrength);")
            }
            sharedAccent.customProgramCacheKey = () => "gridninja-four-system-accents-v1"
          }
          owned.add(sharedAccent)
          return sharedAccent
        }
        object.material = Array.isArray(object.material) ? object.material.map(bind) : bind(object.material)
        if (!profile.surfaces) {
          object.geometry = owner.geometry(object.geometry.clone())
          object.geometry.setAttribute("gnDomain", new Float32BufferAttribute(new Float32Array(object.geometry.getAttribute("position").count).fill(FACILITY_SYSTEMS.indexOf(system)), 1))
        }
      })
      accents[system] = Array.from(owned)
      if (!accents[system].length) throw new Error("model_accent_empty")
      const systemPicks: Mesh[] = []
      proxy.traverse(object => { if (object instanceof Mesh) systemPicks.push(object) })
      if (systemPicks.length !== 1) throw new Error("model_pick_shape")
      const mesh = systemPicks[0]
      const world = mesh.matrixWorld.clone()
      mesh.removeFromParent()
      mesh.matrix.copy(world)
      mesh.matrixWorld.copy(world)
      mesh.matrixAutoUpdate = false
      picks.push(mesh)
      pickSystems.set(mesh, system)
    }
    const fans: FacilityModel["fans"] = []
    const ledAnchors: Object3D[] = []
    const rotorBindings = specimen ? [...ids].filter(([, object]) => object.userData.gnRole === "fan_rotor").map(([id]) => ({ id, axis: [0, 1, 0] as [number, number, number] })) : release.equipment.rotors
    for (const [index, binding] of rotorBindings.entries()) {
      const object = ids.get(binding.id)
      const axis = new Vector3(...binding.axis)
      if (!object || object.userData.gnRole !== "fan_rotor" || object.userData.gnDomain !== "cooling" || !under(object, specimen ? root : ids.get(release.systems.cooling.root)!) || !binding.axis.every(Number.isFinite) || Math.abs(axis.length() - 1) > 0.001) throw new Error("model_rotor_binding")
      const base = object.quaternion.clone()
      const phase = profile.motion?.fanPhaseOffsets[index % 4] ?? 0
      object.quaternion.copy(base).multiply(new Quaternion().setFromAxisAngle(axis, phase))
      fans.push({ object, axis, base, phase })
    }
    const ledBindings = specimen ? [...ids].filter(([, object]) => object.userData.gnRole === "activity_led").map(([id]) => id) : release.equipment.leds
    for (const id of ledBindings) {
      const object = ids.get(id)
      if (!object || object.userData.gnRole !== "activity_led" || (!specimen && object.userData.gnDomain !== "workloads") || !under(object, specimen ? root : ids.get(release.systems.workloads.root)!)) throw new Error("model_led_binding")
      ledAnchors.push(object)
    }
    if (!specimen && (fans.length !== 4 || ledAnchors.length !== 48 || new Set(fans.map(fan => fan.object)).size !== 4 || new Set(ledAnchors).size !== 48)) throw new Error("model_equipment_binding")
    const ledProfile = profile.led
    const ledMaterial = owner.material(new MeshBasicMaterial({ color: ledProfile?.color ?? "#ffd39c", toneMapped: false }))
    const ledGeometry = owner.geometry(new BoxGeometry(...(ledProfile?.size ?? [0.027, 0.012, 0.025] as const)))
    const leds = owner.instanced(new InstancedMesh(ledGeometry, ledMaterial, ledAnchors.length))
    leds.name = "GN_EQUIPMENT_LEDS"
    const inverse = new Matrix4().copy(scene.matrixWorld).invert()
    const instance = new Matrix4()
    const color = new Color()
    for (let i = 0; i < ledAnchors.length; i++) {
      instance.multiplyMatrices(inverse, ledAnchors[i].matrixWorld)
      leds.setMatrixAt(i, instance)
      leds.setColorAt(i, ledProfile ? color.setRGB(ledProfile.steadyIntensity, ledProfile.steadyIntensity, ledProfile.steadyIntensity) : color.setRGB(0.72, 0.5, 0.24))
    }
    if (!leds.instanceColor) leds.instanceColor = new InstancedBufferAttribute(new Float32Array(0), 3)
    leds.instanceMatrix.needsUpdate = true
    if (ledAnchors.length) scene.add(leds)
    const engineering = profile.engineering ? bindEngineeringMaterials(scene, metadata, profile.engineering, profile.surfaces, profile.ecosystem) : undefined
    for (const material of engineering?.surfaces?.maskedMaterials ?? []) coverageMasks.set(material, createSurfaceCoverage(material))
    const surfacePicks: Mesh[] = []
    if (engineering) scene.traverse(object => {
      if (!(object instanceof Mesh) || object === leds) return
      const attributes = [object.geometry.getAttribute("_gn_equipment_id"), object.geometry.getAttribute("_gn_route_id")]
      if (attributes.some(attribute => attribute && Array.from({ length: attribute.count }, (_, index) => attribute.getX(index)).some(value => value >= 0))) surfacePicks.push(object)
    })
    owner.collect(scene)
    const bounds = new Box3().setFromObject(scene)
    const size = bounds.getSize(new Vector3())
    if (bounds.isEmpty() || ![...bounds.min, ...bounds.max].every(Number.isFinite) || size.length() > 100 || size.length() < 0.1) throw new Error("model_bounds")
    let triangles = 0
    let estimatedBytes = 0
    let coverageScratchBytes = 0
    for (const coverage of coverageMasks.values()) { estimatedBytes += coverage.bytes; coverageScratchBytes = Math.max(coverageScratchBytes, coverage.levels[0].width * coverage.levels[0].height * 4) }
    const attributeBuffers = new Set<ArrayBufferLike>()
    const visibleMaterials = new Set<Material>()
    const visibleTextures = new Set<Texture>()
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute("position")?.count ?? 0) / 3 * (object instanceof InstancedMesh ? object.count : 1)
      for (const attribute of Object.values(object.geometry.attributes) as (BufferAttribute | InterleavedBufferAttribute)[]) {
        attributeBuffers.add(attribute.array.buffer)
      }
      if (object.geometry.index) attributeBuffers.add(object.geometry.index.array.buffer)
      if (object instanceof InstancedMesh) {
        attributeBuffers.add(object.instanceMatrix.array.buffer)
        if (object.instanceColor) attributeBuffers.add(object.instanceColor.array.buffer)
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        visibleMaterials.add(material)
        for (const value of Object.values(material)) if (value instanceof Texture) visibleTextures.add(value)
      }
    })
    if (triangles > 80_000) throw new Error("model_triangle_budget")
    for (const buffer of attributeBuffers) estimatedBytes += buffer.byteLength
    if (engineering?.ecosystem) for (const value of Object.values(engineering.ecosystem)) if (ArrayBuffer.isView(value)) estimatedBytes += value.byteLength
    for (const texture of visibleTextures) {
      const source = texture.source.data as { width?: number; height?: number } | undefined
      if (source?.width && source?.height) estimatedBytes += profile.surfaces && texture.generateMipmaps ? surfaceTextureBytes(source.width, source.height) : source.width * source.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1)
    }
    if (visibleMaterials.size > 10 || estimatedBytes > 32 * 1024 * 1024) throw new Error("model_resource_budget")
    signal.throwIfAborted()
    return { scene, bounds, probe, accents, accentWeights, picks, pickSystems, fans, leds, ids, metadata, profile, engineering, coverageMasks, surfacePicks, ledAnchors, sectionCovers, statistics: { materials: visibleMaterials.size, estimatedBytes: Math.ceil(estimatedBytes), peakEstimatedBytes: Math.ceil(estimatedBytes + coverageScratchBytes), environmentBytes: 0 }, dispose: () => { scene?.removeFromParent(); coverageMasks.clear(); owner.dispose() } }
  } catch (error) {
    scene?.removeFromParent()
    coverageMasks.clear()
    owner.dispose()
    throw error
  } finally {
    signal.removeEventListener("abort", abort)
  }
}
