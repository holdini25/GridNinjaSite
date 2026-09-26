import { describe, expect, it, vi } from "vitest"
import { BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, ShaderLib, SRGBColorSpace, Texture, type WebGLRenderer } from "three"
import type { FacilityRenderProfile, FacilitySceneMetadata, FacilitySurfaceProfile } from "@/types/facility"
import { bindEngineeringMaterials, configureSurfaceSampling } from "@/lib/facility/engineering-materials"
import { preflightSurfaceContract, surfaceTextureBytes } from "@/lib/facility/surface-contract"

const surfaces: FacilitySurfaceProfile = { version: 1, pipeline: "pbr-semantic-v2", uvSet: 0, maxTextureBytes: 3145728 }
const engineering: NonNullable<FacilityRenderProfile["engineering"]> = {
  version: 1, seed: 41, accent: { resting: "#9d632f", hover: "#ffbe63", selected: "#ffd18a", previewWeight: .85, baseEmission: .035, activeEmission: 1, transitionMs: 150 },
  activity: { resting: .12, peak: 1, steady: .5, pulseMs: [120, 180], eventMs: [80, 180], maxPulses: 3, ambientTraceSeconds: [8, 12], selectedTraceQuietSeconds: 2.8 }, cameraTransitionMs: 420, poseTransitionMs: 280,
  rendering: { ambientFps: 30, interactionFps: 60, mobilePixels: 650000, desktopPixels: 1500000, probeSeconds: 2 },
}
function fixture(masked = false) {
  const material = new MeshStandardMaterial(), map = new Texture({ width: 256, height: 256 })
  material.map = map; map.colorSpace = SRGBColorSpace
  material.normalMap = new Texture({ width: 512, height: 512 })
  const geometry = new BoxGeometry(), scene = new Group(); scene.add(new Mesh(geometry, material))
  if (masked) { material.alphaTest = .5; material.userData = { gnSurfaceRole: "grille", gnCutoutMinFeatureTexels: 2 } }
  const compile = () => {
    const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} }
    material.onBeforeCompile(shader as never, {} as WebGLRenderer)
    return shader
  }
  return { material, scene, geometry, compile, dispose: () => { geometry.dispose(); material.normalMap!.dispose(); map.dispose(); material.dispose() } }
}

describe("versioned surface shader", () => {
  it("uses exact signed-byte missing-route sentinels only for validated mechanical racks", () => {
    const rack = fixture(), legacy = fixture(), count = rack.geometry.getAttribute("position").count
    const equipment = new Float32BufferAttribute(new Float32Array(count), 1), normal = rack.geometry.getAttribute("normal"), uv = rack.geometry.getAttribute("uv")
    rack.geometry.setAttribute("_gn_equipment_id", equipment)
    // Material binding consumes metadata already validated by parseSpecimen.
    const metadata = { specimen: { kind: "rack", parts: [], rackMotion: { version: 1 } } } as unknown as FacilitySceneMetadata
    bindEngineeringMaterials(rack.scene, metadata, engineering, surfaces)
    bindEngineeringMaterials(legacy.scene, {}, engineering, surfaces)
    for (const name of ["_gn_route_id", "_gn_route_s"]) {
      const compact = rack.geometry.getAttribute(name), original = legacy.geometry.getAttribute(name)
      expect(compact.array).toBeInstanceOf(Int8Array); expect(compact.normalized).toBe(false)
      expect(original.array).toBeInstanceOf(Float32Array)
      expect(Array.from(compact.array)).toEqual(Array(count).fill(-1))
      expect(original.array.byteLength - compact.array.byteLength).toBe(count * 3)
    }
    expect(rack.geometry.getAttribute("_gn_equipment_id")).toBe(equipment)
    expect(rack.geometry.getAttribute("normal")).toBe(normal); expect(rack.geometry.getAttribute("uv")).toBe(uv)
    expect(rack.compile().vertexShader).toBe(legacy.compile().vertexShader)
    expect(rack.material.customProgramCacheKey()).toBe(legacy.material.customProgramCacheKey())
    rack.dispose(); legacy.dispose()
  })

  it("composes actual pinned Three chunks without cloning or removing PBR maps", () => {
    const model = fixture(), before = model.material.map
    const bindings = bindEngineeringMaterials(model.scene, {}, engineering, surfaces), shader = model.compile()
    expect(model.material.map).toBe(before)
    expect(shader.fragmentShader).toContain("#include <roughnessmap_fragment>")
    expect(shader.fragmentShader).toContain("#include <normal_fragment_maps>")
    expect(shader.fragmentShader).toContain("gnSurfaceDetail = sampledDiffuseColor.rgb")
    expect(shader.fragmentShader).toContain("dot(nonPerturbedNormal,")
    expect(shader.uniforms).toHaveProperty("gnEquipment.value", bindings.equipmentWeights)
    expect(bindings.surfaces!.textures).toHaveLength(2)
    expect(model.material.customProgramCacheKey()).toBe("gridninja-pbr-semantic-v2-1-1-opaque")
    model.dispose()
  })

  it("shares structurally identical programs while retaining independent profile uniforms", () => {
    const a = fixture(), b = fixture()
    bindEngineeringMaterials(a.scene, {}, engineering, surfaces)
    bindEngineeringMaterials(b.scene, {}, { ...engineering, accent: { ...engineering.accent, previewWeight: .5, activeEmission: .12 } }, surfaces)
    const as = a.compile(), bs = b.compile()
    expect(a.material.customProgramCacheKey()).toBe(b.material.customProgramCacheKey())
    expect(as.fragmentShader).toBe(bs.fragmentShader)
    expect(as.uniforms).toHaveProperty("gnActiveEmission.value", 1)
    expect(bs.uniforms).toHaveProperty("gnActiveEmission.value", .12)
    expect(as.uniforms).not.toBe(bs.uniforms)
    a.dispose(); b.dispose()
  })

  it("opts into projection-correct equipment emphasis without changing legacy programs", () => {
    const legacy = fixture(), current = fixture(), alternate = fixture()
    const reviewed: FacilitySurfaceProfile = { ...surfaces, equipmentEdge: { version: 1, viewDirection: "projection-correct", exponent: 5, intensity: .02 } }
    bindEngineeringMaterials(legacy.scene, {}, engineering, surfaces)
    bindEngineeringMaterials(current.scene, {}, engineering, reviewed)
    bindEngineeringMaterials(alternate.scene, {}, engineering, { ...reviewed, equipmentEdge: { ...reviewed.equipmentEdge!, exponent: 4, intensity: .01 } })
    const old = legacy.compile(), shader = current.compile(), other = alternate.compile()
    expect(old.fragmentShader).toContain("dot(nonPerturbedNormal, normalize(vViewPosition))")
    expect(old.fragmentShader).not.toContain("gnViewDirection")
    expect(shader.fragmentShader).toContain("isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition)")
    expect(shader.fragmentShader).toContain("dot(nonPerturbedNormal, gnViewDirection)")
    expect(shader.uniforms).toHaveProperty("gnEdgeExponent.value", 5)
    expect(shader.uniforms).toHaveProperty("gnEdgeIntensity.value", .02)
    expect(other.uniforms).toHaveProperty("gnEdgeIntensity.value", .01)
    expect(shader.fragmentShader).toBe(other.fragmentShader)
    expect(current.material.customProgramCacheKey()).toBe(alternate.material.customProgramCacheKey())
    expect(current.material.customProgramCacheKey()).not.toBe(legacy.material.customProgramCacheKey())
    for (const anchor of ["#include <normal_fragment_maps>", "#include <roughnessmap_fragment>", "#include <metalnessmap_fragment>"]) expect(shader.fragmentShader).toContain(anchor)
    legacy.dispose(); current.dispose(); alternate.dispose()
  })

  it("rejects missing/duplicated shader anchors rather than silently dropping visual behavior", () => {
    const model = fixture(); bindEngineeringMaterials(model.scene, {}, engineering, surfaces)
    for (const common of ["", "#include <common>\n#include <common>"]) {
      const shader = { vertexShader: `${common}\n#include <begin_vertex>`, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} }
      expect(() => model.material.onBeforeCompile(shader as never, {} as WebGLRenderer)).toThrow("surface_shader_anchor")
    }
    model.dispose()
  })

  it("adds bounded derivative minification only to explicit cutout materials", () => {
    const solid = fixture(), cutout = fixture(true)
    bindEngineeringMaterials(solid.scene, {}, engineering, surfaces); bindEngineeringMaterials(cutout.scene, {}, engineering, surfaces)
    expect(solid.compile().fragmentShader).not.toContain("gnMaskFootprint")
    const shader = cutout.compile()
    expect(shader.fragmentShader.indexOf("diffuseColor.a = mix")).toBeLessThan(shader.fragmentShader.indexOf("#include <alphatest_fragment>"))
    expect(shader.uniforms).toHaveProperty("gnMaskFeature.value", 2)
    expect(cutout.material.customProgramCacheKey()).not.toBe(solid.material.customProgramCacheKey())
    cutout.material.userData.gnCutoutMinFeatureTexels = 0
    expect(() => bindEngineeringMaterials(cutout.scene, {}, engineering, surfaces)).toThrow("surface_cutout_binding")
    solid.dispose(); cutout.dispose()
  })

  it("uses real multisampling only and changes bounded anisotropy at tier boundaries", () => {
    const model = fixture(true), bindings = bindEngineeringMaterials(model.scene, {}, engineering, surfaces)
    const context = { SAMPLES: 0x80a9, getContextAttributes: () => ({ antialias: true }), getParameter: vi.fn(() => 4) }
    const renderer = { getContext: () => context, capabilities: { getMaxAnisotropy: () => 2 } } as unknown as WebGLRenderer
    configureSurfaceSampling(bindings, renderer, "high")
    expect(model.material.alphaToCoverage).toBe(true); expect(model.material.map!.anisotropy).toBe(2)
    const version = model.material.version, textureVersion = model.material.map!.version
    configureSurfaceSampling(bindings, renderer, "high")
    expect(model.material.version).toBe(version); expect(model.material.map!.version).toBe(textureVersion)
    context.getParameter.mockReturnValue(0); configureSurfaceSampling(bindings, renderer, "economy")
    expect(model.material.alphaToCoverage).toBe(false); expect(model.material.map!.anisotropy).toBe(1)
    expect(model.material.transparent).toBe(false); expect(model.material.depthWrite).toBe(true)
    renderer.capabilities.getMaxAnisotropy = () => 0
    configureSurfaceSampling(bindings, renderer, "high")
    expect(model.material.map!.anisotropy).toBe(1)
    model.dispose()
  })

  it("does not change legacy shader programs when the surface profile is absent", () => {
    const model = fixture(); const bindings = bindEngineeringMaterials(model.scene, {}, engineering)
    expect(bindings.surfaces).toBeUndefined()
    expect(model.material.customProgramCacheKey()).toBe("gridninja-engineering-v1-1-1")
    expect(model.compile().fragmentShader).toContain("dot(normal,")
    model.dispose()
  })
})

function documentFixture() {
  const binary = new Uint8Array(3 * 36), view = new DataView(binary.buffer)
  for (let i = 0; i < 3; i++) {
    const start = i * 36
    view.setUint32(start, 0x89504e47); view.setUint32(start + 4, 0x0d0a1a0a); view.setUint32(start + 8, 13); view.setUint32(start + 12, 0x49484452)
    view.setUint32(start + 16, i === 2 ? 256 : 512); view.setUint32(start + 20, i === 2 ? 256 : 512)
    view.setUint8(start + 24, 8); view.setUint8(start + 25, 6)
  }
  const document = {
    images: [0, 1, 2].map(bufferView => ({ mimeType: "image/png", bufferView })), textures: [0, 1, 2].map(source => ({ source })),
    bufferViews: [0, 1, 2].map(i => ({ buffer: 0, byteOffset: i * 36, byteLength: 33 })),
    materials: [{ extras: { gnSurfaceRole: "grille", gnCutoutMinFeatureTexels: 2 }, alphaMode: "MASK", alphaCutoff: .5, normalTexture: { index: 0 }, occlusionTexture: { index: 1 }, pbrMetallicRoughness: { baseColorTexture: { index: 2 }, metallicRoughnessTexture: { index: 1 } } }],
  }
  return { document, binary, view }
}

describe("surface preflight before image decoding", () => {
  it("counts complete finite mip chains and admits the three-atlas contract within 3 MiB", () => {
    const { document, binary } = documentFixture()
    expect(surfaceTextureBytes(512, 512)).toBe(1398100)
    expect(preflightSurfaceContract(document, binary, surfaces, "rack").textureBytes).toBe(3145724)
  })
  it("rejects huge/invalid PNG headers before an image can be decoded", () => {
    for (const dimension of [0, 513, 16384, 0xffffffff]) {
      const { document, binary, view } = documentFixture(); view.setUint32(16, dimension)
      expect(() => preflightSurfaceContract(document, binary, surfaces, "rack")).toThrow("surface_image_dimensions")
    }
    const { document, binary } = documentFixture(); document.bufferViews[0].byteOffset = binary.length
    expect(() => preflightSurfaceContract(document, binary, surfaces, "rack")).toThrow("surface_image_view")
  })
  it("rejects overview/cooling cutouts, non-UV0 maps and color/data aliasing", () => {
    const { document, binary } = documentFixture()
    for (const kind of [undefined, "cooling"] as const) expect(() => preflightSurfaceContract(document, binary, surfaces, kind)).toThrow("surface_cutout_contract")
    const uv = structuredClone(document); Object.assign(uv.materials[0].normalTexture, { texCoord: 1 })
    expect(() => preflightSurfaceContract(uv, binary, surfaces, "rack")).toThrow("surface_uv_contract")
    const alias = structuredClone(document); alias.materials[0].pbrMetallicRoughness.baseColorTexture.index = 0
    expect(() => preflightSurfaceContract(alias, binary, surfaces, "rack")).toThrow("surface_color_dimensions")
    const role = structuredClone(document); role.materials[0].extras.gnSurfaceRole = "water"
    expect(() => preflightSurfaceContract(role, binary, surfaces, "rack")).toThrow("surface_material_role")
  })
})
