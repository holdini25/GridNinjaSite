import * as THREE from "three"
import { loadFacilityModel } from "/runtime/asset-runtime"
import { createFiniteLight } from "/runtime/finite-light"
import { createStudioEnvironment } from "/runtime/render-environment"
import { bindEngineeringMaterials, configureSurfaceSampling } from "/runtime/engineering-materials"
import { applyCameraFrame, applySpecimenPose, inspectionCamera } from "/runtime/inspection-camera"

let release, renderer, scene, camera, environment, model, currentKind, finiteLight
const originals = new Map(), diagnostics = new Set()
let width = 1020, height = 600

function restoreMaterials() {
  for (const [mesh, material] of originals) mesh.material = material
  for (const material of diagnostics) material.dispose()
  diagnostics.clear()
}
function diagnosticMaterials(mode) {
  const shared = new Map()
  const replace = original => {
    if (!original.isMeshStandardMaterial) return original
    if (shared.has(original)) return shared.get(original)
    const material = original.clone()
    if (mode === "gray") {
      material.color.set("#ffffff"); material.roughness = .65; material.metalness = 0
      material.normalMap = null; material.roughnessMap = null; material.metalnessMap = null
      material.emissive.set(0); material.emissiveIntensity = 0
    }
    shared.set(original, material); diagnostics.add(material); return material
  }
  for (const [mesh, original] of originals) mesh.material = Array.isArray(original) ? original.map(replace) : replace(original)
  const bindings = bindEngineeringMaterials(model.scene, model.metadata, model.profile.engineering, model.profile.surfaces)
  configureSurfaceSampling(bindings, renderer, "balanced")
  for (const material of diagnostics) {
    const compose = material.onBeforeCompile, key = material.customProgramCacheKey()
    material.onBeforeCompile = shader => {
      compose(shader, renderer)
      if (mode === "gray") shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = vec3(0.25);")
      else {
        const value = mode === "normal" ? "normalize(normal) * 0.5 + 0.5" : "vec3(roughnessFactor)"
        shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `gl_FragColor = vec4(${value}, diffuseColor.a); return;`)
      }
    }
    material.customProgramCacheKey = () => `${key}-diagnostic-${mode}`
    material.needsUpdate = true
  }
}

window.prepareAssetMaterialBenchmark = async value => {
  release = value
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false })
  renderer.setSize(width, height); renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = release.profile.exposure
  document.body.appendChild(renderer.domElement)
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100)
  scene = new THREE.Scene(); scene.background = new THREE.Color(release.profile.background)
  const lighting = release.profile.lighting
  scene.add(new THREE.HemisphereLight(lighting.hemisphere.sky, lighting.hemisphere.ground, lighting.hemisphere.intensity))
  for (const entry of lighting.directional) { const light = new THREE.DirectionalLight(entry.color, entry.intensity); light.position.fromArray(entry.position); scene.add(light) }
  if (lighting.finite) finiteLight = createFiniteLight(scene, lighting.finite)
  environment = createStudioEnvironment(renderer, lighting.environment)
  scene.environment = environment.texture; scene.environmentIntensity = lighting.environment.intensity; scene.environmentRotation.y = lighting.environment.rotationY
  const gl = renderer.getContext(), extension = gl.getExtension("WEBGL_debug_renderer_info")
  return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), threeRevision: THREE.REVISION, samples: gl.getParameter(gl.SAMPLES), note: "Actual candidate GLBs loaded by production asset loader/composer, studio environment and inspection framing. Diagnostic modes are local test-only material clones; continuous activity is frozen." }
}

window.captureAssetMaterial = async ({ kind, pose, mode, dpr, cssSize = [1020, 600] }) => {
  [width, height] = cssSize
  restoreMaterials()
  if (currentKind !== kind) {
    originals.clear(); model?.dispose()
    const controller = new AbortController(), deadline = setTimeout(() => controller.abort(new Error("asset_benchmark_timeout")), 8000)
    try { model = await loadFacilityModel(release, controller.signal, kind === "overview" ? undefined : kind) } finally { clearTimeout(deadline) }
    scene.add(model.scene); currentKind = kind
    model.scene.traverse(object => { if (object.isMesh) originals.set(object, object.material) })
  }
  renderer.setPixelRatio(dpr); renderer.setSize(width, height)
  renderer.toneMappingExposure = model.profile.exposure
  finiteLight?.bind(model.profile.lighting.finite)
  configureSurfaceSampling(model.engineering, renderer, "balanced")
  const view = kind === "overview" ? { kind: "overview" } : pose === "service-connection" ? { kind: "specimen", specimen: kind, pose: "service", rack: { door: "open", tray: "extended", cutaway: true }, detail: "service-connection" } : { kind: "specimen", specimen: kind, pose }
  applySpecimenPose(model, view)
  applyCameraFrame(camera, inspectionCamera(model, view, width, height, width < 640))
  if (mode !== "final") diagnosticMaterials(mode)
  renderer.render(scene, camera)
  const gl = renderer.getContext()
  if (gl.getError() !== gl.NO_ERROR) throw new Error(`asset_material_gl_error:${kind}/${pose}/${mode}`)
  return {
    kind, pose, mode, dpr, finiteLight: finiteLight ? { position: finiteLight.light.position.toArray(), intensity: finiteLight.light.intensity } : null, cssSize: [width, height], drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    allocation: { loader: { ...model.statistics }, environmentRetained: environment.retainedBytes, environmentPeak: environment.peakBytes, finiteLightRetained: finiteLight?.retainedBytes ?? 0, note: "Material fixture statistics; production scheduler and motion state are measured separately." },
    camera: { position: camera.position.toArray(), frustum: [camera.left, camera.right, camera.top, camera.bottom] },
    materialNames: [...new Set([...originals.values()].flat().map(material => material.name))],
    interpretation: mode === "normal" ? "View-space perturbed normals encoded as RGB, before tone mapping." : mode === "roughness" ? "Final scalar roughness, including authored map and factor, encoded directly as grayscale." : mode === "gray" ? "Neutral diffuse geometry with fixed roughness, AO and masked coverage retained." : "Production PBR materials and authored lighting.",
    png: renderer.domElement.toDataURL("image/png"),
  }
}

window.disposeAssetMaterialBenchmark = () => {
  restoreMaterials(); originals.clear(); model?.dispose(); environment?.dispose(); finiteLight?.dispose(); renderer?.dispose()
}
window.addEventListener("pagehide", () => window.disposeAssetMaterialBenchmark(), { once: true })
