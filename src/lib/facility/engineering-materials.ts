import { Color, Float32BufferAttribute, Int8BufferAttribute, Mesh, MeshStandardMaterial, NoColorSpace, SRGBColorSpace, Vector2, type Object3D, type Texture, type WebGLRenderer } from "three"
import type { FacilityEcosystemProfile, FacilityQuality, FacilityRenderProfile, FacilitySceneMetadata, FacilitySurfaceProfile } from "@/types/facility"

export type EngineeringBindings = {
  equipmentWeights: Float32Array; routeWeights: Float32Array; routePhases: Float32Array
  ecosystem?: { equipment: Float32Array; routes: Float32Array; heat: Float32Array; routeFrom: Float32Array; routeTo: Float32Array; signals: Float32Array; traces: Float32Array; uniformVectors: number }
  surfaces?: { textures: Texture[]; maskedMaterials: MeshStandardMaterial[]; sampling: string }
}

/** Preserve material batches. Authored per-corner semantic IDs isolate actual equipment and routes. */
export function bindEngineeringMaterials(scene: Object3D, metadata: FacilitySceneMetadata, profile: NonNullable<FacilityRenderProfile["engineering"]>, surfaces?: FacilitySurfaceProfile, ecosystem?: FacilityEcosystemProfile): EngineeringBindings {
  const equipmentCount = Math.max(1, metadata.topology?.equipment.length ?? metadata.specimen?.parts.length ?? 0)
  const routeCount = Math.max(1, metadata.topology?.routes.length ?? 0)
  const compactRouteFallbacks = metadata.specimen?.kind === "rack" && metadata.specimen.rackMotion?.version === 1
  const bindings: EngineeringBindings = { equipmentWeights: new Float32Array(equipmentCount), routeWeights: new Float32Array(routeCount), routePhases: new Float32Array(routeCount).fill(-1) }
  const materials = new Set<MeshStandardMaterial>()
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return
    if (surfaces && !(Array.isArray(object.material) ? object.material : [object.material]).some(material => material instanceof MeshStandardMaterial)) return
    const count = object.geometry.getAttribute("position").count
    for (const [attribute, fallback, ceiling] of [["_gn_equipment_id", -1, equipmentCount], ["_gn_route_id", -1, routeCount], ["_gn_route_s", -1, Infinity]] as const) {
      const found = object.geometry.getAttribute(attribute)
      if (!found) {
        // Mechanical racks have no routes. An unnormalized signed byte retains
        // the exact -1 float sentinel without two redundant float arrays.
        const values = compactRouteFallbacks && attribute !== "_gn_equipment_id"
          ? new Int8BufferAttribute(new Int8Array(count).fill(fallback), 1, false)
          : new Float32BufferAttribute(new Float32Array(count).fill(fallback), 1)
        object.geometry.setAttribute(attribute, values)
      }
      else {
        if (found.count !== count || found.itemSize !== 1) throw new Error("engineering_attribute_shape")
        for (let i = 0; i < count; i++) { const value = found.getX(i); if (!Number.isFinite(value) || value < fallback || value >= ceiling || (attribute !== "_gn_route_s" && value !== Math.round(value))) throw new Error("engineering_attribute_value") }
      }
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material instanceof MeshStandardMaterial) materials.add(material)
  })
  if (ecosystem) {
    if (!surfaces || metadata.topology?.schemaVersion !== "facility-topology.v2" || equipmentCount > ecosystem.maxEquipment || routeCount > ecosystem.maxRoutes) throw new Error("ecosystem_material_contract")
    const equipmentSize = Math.ceil(equipmentCount / 4) * 4, routeSize = Math.ceil(routeCount / 4) * 4
    const signals = new Float32Array(routeSize)
    for (const route of metadata.topology.routes) signals[route.index] = route.medium === "water" ? 1 : route.medium === "air" ? 2 : route.medium === "reserve-illustrative" ? 3 : 0
    const traces = new Float32Array(16); traces[0] = traces[8] = -1
    bindings.ecosystem = { equipment: new Float32Array(equipmentSize), routes: new Float32Array(routeSize), heat: new Float32Array(equipmentSize), routeFrom: new Float32Array(routeSize).fill(1), routeTo: new Float32Array(routeSize), signals, traces, uniformVectors: equipmentSize / 2 + routeSize + 78 + (surfaces.equipmentEdge ? 2 : 0) }
  }
  if (surfaces) return bindSurfacePipeline(materials, bindings, profile, surfaces, ecosystem)
  for (const material of materials) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, {
        gnEquipment: { value: bindings.equipmentWeights }, gnRoutes: { value: bindings.routeWeights }, gnRoutePhases: { value: bindings.routePhases },
        gnRest: { value: new Color(profile.accent.resting) }, gnHover: { value: new Color(profile.accent.hover) }, gnActive: { value: new Color(profile.accent.selected) },
      })
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float _gn_equipment_id;\nattribute float _gn_route_id;\nattribute float _gn_route_s;\nvarying vec3 vGnIdentity;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGnIdentity = vec3(_gn_equipment_id, _gn_route_id, _gn_route_s);")
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\nuniform float gnEquipment[${equipmentCount}];\nuniform float gnRoutes[${routeCount}];\nuniform float gnRoutePhases[${routeCount}];\nuniform vec3 gnRest;\nuniform vec3 gnHover;\nuniform vec3 gnActive;\nvarying vec3 vGnIdentity;`)
        .replace("#include <color_fragment>", `#include <color_fragment>
float gnEquipmentWeight = vGnIdentity.x >= 0.0 ? gnEquipment[int(vGnIdentity.x + 0.5)] : 0.0;
float gnRouteWeight = vGnIdentity.y >= 0.0 ? gnRoutes[int(vGnIdentity.y + 0.5)] : 0.0;
float gnPhase = vGnIdentity.y >= 0.0 ? gnRoutePhases[int(vGnIdentity.y + 0.5)] : -1.0;
float gnTrace = gnPhase >= 0.0 ? (1.0 - smoothstep(0.025, 0.12, abs(vGnIdentity.z - gnPhase))) : 0.0;
vec3 gnColor = mix(gnHover, gnActive, smoothstep(${profile.accent.previewWeight.toFixed(5)}, 1.0, gnRouteWeight));
if (vGnIdentity.y >= 0.0) diffuseColor.rgb = mix(gnRest, gnColor, max(gnRouteWeight, gnTrace));`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
float gnEdge = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
totalEmissiveRadiance += gnHover * gnEquipmentWeight * gnEdge * 0.065;
if (vGnIdentity.y >= 0.0) totalEmissiveRadiance += gnColor * (${profile.accent.baseEmission.toFixed(5)} + ${(profile.accent.activeEmission * .48).toFixed(5)} * max(gnRouteWeight, gnTrace * 0.75));`)
    }
    material.customProgramCacheKey = () => `gridninja-engineering-v1-${equipmentCount}-${routeCount}`
    material.needsUpdate = true
  }
  return bindings
}

type MaterialShader = Parameters<MeshStandardMaterial["onBeforeCompile"]>[0]
/** A pinned chunk contract fails loudly instead of silently dropping an effect after an upgrade. */
function replaceAnchor(source: string, anchor: string, replacement: string): string {
  const start = source.indexOf(anchor)
  if (start < 0 || source.indexOf(anchor, start + anchor.length) >= 0) throw new Error(`surface_shader_anchor:${anchor}`)
  return source.slice(0, start) + replacement + source.slice(start + anchor.length)
}

function bindSurfacePipeline(materials: Set<MeshStandardMaterial>, bindings: EngineeringBindings, profile: NonNullable<FacilityRenderProfile["engineering"]>, surfaces: FacilitySurfaceProfile, ecosystem?: FacilityEcosystemProfile) {
  const equipmentCount = bindings.equipmentWeights.length, routeCount = bindings.routeWeights.length
  const edge = surfaces.equipmentEdge
  const activity = bindings.ecosystem
  const textures = new Set<Texture>(), maskedMaterials: MeshStandardMaterial[] = []
  for (const material of materials) {
    for (const [texture, colorSpace] of [[material.map, SRGBColorSpace], [material.normalMap, NoColorSpace], [material.aoMap, NoColorSpace], [material.roughnessMap, NoColorSpace], [material.metalnessMap, NoColorSpace]] as const) {
      if (!texture) continue
      if (texture.channel !== 0 || texture.colorSpace !== colorSpace) throw new Error("surface_texture_semantics")
      textures.add(texture)
    }
    const masked = material.alphaTest > 0
    const dimensions = material.map?.source.data as { width?: number; height?: number } | undefined
    const feature = material.userData.gnCutoutMinFeatureTexels
    if (masked && (material.transparent || material.alphaTest !== .5 || material.userData.gnSurfaceRole !== "grille" || typeof feature !== "number" || !Number.isFinite(feature) || feature < 1 || feature > 16 || !dimensions?.width || !dimensions.height)) throw new Error("surface_cutout_binding")
    if (masked) maskedMaterials.push(material)
    // All variable strengths are uniforms: equal topology shapes can safely share a program.
    const uniforms = {
      ...(activity ? {
        gnEquipment: { value: activity.equipment }, gnRoutes: { value: activity.routes }, gnHeat: { value: activity.heat }, gnSignals: { value: activity.signals }, gnRouteFrom: { value: activity.routeFrom }, gnRouteTo: { value: activity.routeTo }, gnTraceSlots: { value: activity.traces },
        gnElectrical: { value: new Color(ecosystem!.colors.electrical) }, gnCooling: { value: new Color(ecosystem!.colors.cooling) }, gnHeatColor: { value: new Color(ecosystem!.colors.heat) },
      } : { gnEquipment: { value: bindings.equipmentWeights }, gnRoutes: { value: bindings.routeWeights }, gnRoutePhases: { value: bindings.routePhases } }),
      gnRest: { value: new Color(profile.accent.resting) }, gnHover: { value: new Color(profile.accent.hover) }, gnActive: { value: new Color(profile.accent.selected) },
      gnPreviewWeight: { value: profile.accent.previewWeight }, gnBaseEmission: { value: profile.accent.baseEmission }, gnActiveEmission: { value: profile.accent.activeEmission },
      ...(edge ? { gnEdgeExponent: { value: edge.exponent }, gnEdgeIntensity: { value: edge.intensity } } : {}),
      ...(masked ? { gnMaskDimensions: { value: new Vector2(dimensions!.width, dimensions!.height) }, gnMaskFeature: { value: feature as number } } : {}),
    }
    material.onBeforeCompile = (shader: MaterialShader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = replaceAnchor(shader.vertexShader, "#include <common>", "#include <common>\nattribute float _gn_equipment_id;\nattribute float _gn_route_id;\nattribute float _gn_route_s;\nvarying vec3 vGnIdentity;")
      shader.vertexShader = replaceAnchor(shader.vertexShader, "#include <begin_vertex>", "#include <begin_vertex>\nvGnIdentity = vec3(_gn_equipment_id, _gn_route_id, _gn_route_s);")
      // The unperturbed normal must remain available for a stable equipment-edge accent.
      shader.fragmentShader = replaceAnchor(shader.fragmentShader, "#include <normal_fragment_begin>", "#include <normal_fragment_begin>")
      shader.fragmentShader = replaceAnchor(shader.fragmentShader, "#include <common>", `#include <common>
${activity ? `uniform vec4 gnEquipment[${activity.equipment.length / 4}];
uniform vec4 gnRoutes[${activity.routes.length / 4}];
uniform vec4 gnHeat[${activity.heat.length / 4}];
uniform vec4 gnSignals[${activity.signals.length / 4}];
uniform vec4 gnRouteFrom[${activity.routeFrom.length / 4}];
uniform vec4 gnRouteTo[${activity.routeTo.length / 4}];
uniform vec4 gnTraceSlots[4];
uniform vec3 gnElectrical, gnCooling, gnHeatColor;
float gnEquipmentAt(int id) { return gnEquipment[id / 4][id - (id / 4) * 4]; }
float gnRouteAt(int id) { return gnRoutes[id / 4][id - (id / 4) * 4]; }
float gnHeatAt(int id) { return gnHeat[id / 4][id - (id / 4) * 4]; }
float gnSignalAt(int id) { return gnSignals[id / 4][id - (id / 4) * 4]; }
float gnRouteFromAt(int id) { return gnRouteFrom[id / 4][id - (id / 4) * 4]; }
float gnRouteToAt(int id) { return gnRouteTo[id / 4][id - (id / 4) * 4]; }` : `uniform float gnEquipment[${equipmentCount}];
uniform float gnRoutes[${routeCount}];
uniform float gnRoutePhases[${routeCount}];`}
uniform vec3 gnRest, gnHover, gnActive;
uniform float gnPreviewWeight, gnBaseEmission, gnActiveEmission;
${edge ? "uniform float gnEdgeExponent, gnEdgeIntensity;" : ""}
varying vec3 vGnIdentity;
${masked ? "uniform vec2 gnMaskDimensions;\nuniform float gnMaskFeature;" : ""}`)
      shader.fragmentShader = replaceAnchor(shader.fragmentShader, "#include <color_fragment>", `#include <color_fragment>
${activity ? `float gnEquipmentWeight = vGnIdentity.x >= 0.0 ? gnEquipmentAt(int(vGnIdentity.x + 0.5)) : 0.0;
float gnRouteWeight = vGnIdentity.y >= 0.0 ? gnRouteAt(int(vGnIdentity.y + 0.5)) : 0.0;
if (vGnIdentity.y >= 0.0 && gnRouteWeight < 0.60 && (vGnIdentity.z < gnRouteFromAt(int(vGnIdentity.y + 0.5)) || vGnIdentity.z > gnRouteToAt(int(vGnIdentity.y + 0.5)))) gnRouteWeight = 0.0;
float gnThermalWeight = vGnIdentity.x >= 0.0 ? gnHeatAt(int(vGnIdentity.x + 0.5)) : 0.0;
float gnSignal = vGnIdentity.y >= 0.0 ? gnSignalAt(int(vGnIdentity.y + 0.5)) : 0.0;
float gnTrace = 0.0;
for (int gnSlot = 0; gnSlot < 2; gnSlot++) {
  vec4 gnHead = gnTraceSlots[gnSlot * 2]; vec4 gnState = gnTraceSlots[gnSlot * 2 + 1];
  if (vGnIdentity.y >= 0.0 && abs(vGnIdentity.y - gnHead.x) < 0.25 && vGnIdentity.z >= gnHead.z && vGnIdentity.z <= gnHead.w) {
    gnTrace = max(gnTrace, gnState.x * (1.0 - smoothstep(0.02, 0.10, abs(vGnIdentity.z - gnHead.y))));
  }
}
vec3 gnServiceColor = gnSignal < 0.5 ? gnElectrical : gnSignal < 1.5 ? gnCooling : gnSignal < 2.5 ? gnHeatColor : gnRest;
vec3 gnInteractionColor = mix(gnHover, gnActive, smoothstep(min(gnPreviewWeight, 0.999), 1.0, gnRouteWeight));
vec3 gnColor = mix(gnRest, mix(gnServiceColor, gnInteractionColor, smoothstep(0.60, min(gnPreviewWeight, 0.999), gnRouteWeight)), min(1.0, 5.0 * max(gnRouteWeight, gnTrace)));` : `float gnEquipmentWeight = vGnIdentity.x >= 0.0 ? gnEquipment[int(vGnIdentity.x + 0.5)] : 0.0;
float gnRouteWeight = vGnIdentity.y >= 0.0 ? gnRoutes[int(vGnIdentity.y + 0.5)] : 0.0;
float gnPhase = vGnIdentity.y >= 0.0 ? gnRoutePhases[int(vGnIdentity.y + 0.5)] : -1.0;
float gnTrace = gnPhase >= 0.0 ? (1.0 - smoothstep(0.025, 0.12, abs(vGnIdentity.z - gnPhase))) : 0.0;
vec3 gnColor = mix(gnHover, gnActive, smoothstep(min(gnPreviewWeight, 0.999), 1.0, gnRouteWeight));`}
vec3 gnSurfaceDetail = vec3(1.0);
#ifdef USE_MAP
  gnSurfaceDetail = sampledDiffuseColor.rgb;
#endif
if (vGnIdentity.y >= 0.0) {
  vec3 gnBase = mix(diffuseColor.rgb, gnRest * gnSurfaceDetail, 0.2);
  diffuseColor.rgb = mix(gnBase, gnColor * gnSurfaceDetail, 0.35 * max(gnRouteWeight, gnTrace));
}`)
      shader.fragmentShader = replaceAnchor(shader.fragmentShader, "#include <emissivemap_fragment>", `#include <emissivemap_fragment>
${edge ? `vec3 gnViewDirection = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
float gnEdge = pow(clamp(1.0 - abs(dot(nonPerturbedNormal, gnViewDirection)), 0.0, 1.0), gnEdgeExponent);
totalEmissiveRadiance += gnHover * gnEquipmentWeight * gnEdge * gnEdgeIntensity;` : `float gnEdge = pow(1.0 - abs(dot(nonPerturbedNormal, normalize(vViewPosition))), 3.0);
totalEmissiveRadiance += gnHover * gnEquipmentWeight * gnEdge * 0.065;`}
${activity ? "totalEmissiveRadiance += gnHeatColor * gnSurfaceDetail * gnThermalWeight * 0.045;" : ""}
if (vGnIdentity.y >= 0.0) totalEmissiveRadiance += gnColor * gnSurfaceDetail * (gnBaseEmission + gnActiveEmission * 0.48 * max(gnRouteWeight, gnTrace * 0.75));`)
      if (masked) shader.fragmentShader = replaceAnchor(shader.fragmentShader, "#include <alphatest_fragment>", `
vec2 gnMaskTexel = vMapUv * gnMaskDimensions;
float gnMaskFootprint = max(length(dFdx(gnMaskTexel)), length(dFdy(gnMaskTexel)));
// Resolve holes only while the authored minimum feature spans at least 1-2 pixels.
float gnMaskUnresolved = smoothstep(gnMaskFeature * 0.5, gnMaskFeature, gnMaskFootprint);
diffuseColor.a = mix(diffuseColor.a, 1.0, gnMaskUnresolved);
#include <alphatest_fragment>`)
    }
    material.customProgramCacheKey = () => `gridninja-${activity ? "ecosystem-v1" : "pbr-semantic-v2"}-${equipmentCount}-${routeCount}-${masked ? "mask" : "opaque"}${edge ? "-edge-v1" : ""}`
    material.needsUpdate = true
  }
  bindings.surfaces = { textures: [...textures], maskedMaterials, sampling: "" }
  return bindings
}

/** Called on binding/tier changes only. No texture clones or frame-time traversal. */
export function configureSurfaceSampling(bindings: EngineeringBindings | undefined, renderer: WebGLRenderer, quality: FacilityQuality) {
  const surfaces = bindings?.surfaces
  if (!surfaces) return
  const context = renderer.getContext(), attributes = context.getContextAttributes()
  const coverage = !!attributes?.antialias && context.getParameter(context.SAMPLES) > 1
  const anisotropy = Math.max(1, Math.min(renderer.capabilities.getMaxAnisotropy(), quality === "high" || quality === "balanced" ? 2 : 1))
  const key = `${coverage}/${anisotropy}`
  if (surfaces.sampling === key) return
  surfaces.sampling = key
  for (const texture of surfaces.textures) if (texture.anisotropy !== anisotropy) { texture.anisotropy = anisotropy; texture.needsUpdate = true }
  for (const material of surfaces.maskedMaterials) if (material.alphaToCoverage !== coverage) { material.alphaToCoverage = coverage; material.needsUpdate = true }
}

/** Padded vec4 arrays keep the bounded v6 scene below fragment uniform limits. */
export function validateEcosystemUniformBudget(bindings: EngineeringBindings | undefined, renderer: WebGLRenderer) {
  if (bindings?.ecosystem && bindings.ecosystem.uniformVectors > renderer.capabilities.maxFragmentUniforms) throw new Error("ecosystem_uniform_budget")
}
