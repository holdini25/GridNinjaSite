import * as THREE from "three"
import { bindEngineeringMaterials, configureSurfaceSampling, validateEcosystemUniformBudget } from "/engineering-materials.js"

// The browser imports the actual production material composer. This fixture only
// supplies known geometry, data textures and lights; no production shader is copied.
const surfaceProfile = { version: 1, pipeline: "pbr-semantic-v2", uvSet: 0, maxTextureBytes: 3145728 }
const metadata = { topology: { equipment: [{ id: "GN_FIXTURE" }], routes: [{ id: "GN_ROUTE" }] } }
const engineering = {
  version: 1,
  accent: { resting: "#9d632f", hover: "#ffbe63", selected: "#ffd18a", previewWeight: .85, baseEmission: .035, activeEmission: 1, transitionMs: 150 },
}
const width = 512, height = 512
const captures = new Map()
let renderer, scene, camera
const owned = new Set()
const own = resource => { owned.add(resource); return resource }
const check = (checks, name, pass, evidence) => checks.push({ name, pass, evidence })
function texture(make, size = 64) {
  const bytes = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) bytes.set(make(x, y), (y * size + x) * 4)
  const result = own(new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat))
  result.magFilter = THREE.LinearFilter; result.minFilter = THREE.LinearMipmapLinearFilter
  result.generateMipmaps = true; result.needsUpdate = true
  return result
}
function plane(material, { route = -1, equipment = 0, size = 1.5 } = {}) {
  const geometry = own(new THREE.PlaneGeometry(size, size))
  const count = geometry.attributes.position.count
  geometry.setAttribute("_gn_equipment_id", new THREE.Float32BufferAttribute(new Float32Array(count).fill(equipment), 1))
  geometry.setAttribute("_gn_route_id", new THREE.Float32BufferAttribute(new Float32Array(count).fill(route), 1))
  geometry.setAttribute("_gn_route_s", new THREE.Float32BufferAttribute(new Float32Array(count).fill(.5), 1))
  return new THREE.Mesh(geometry, material)
}
function read() {
  renderer.render(scene, camera)
  const gl = renderer.getContext(), pixels = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  return pixels
}
function sample(pixels, x, y) { return [...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 3)] }
function mean(pixels, x0 = 96, x1 = 416, y0 = 96, y1 = 416) {
  const result = [0, 0, 0]
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) result[c] += pixels[(y * width + x) * 4 + c]
  return result.map(value => value / ((x1 - x0) * (y1 - y0)))
}
function delta(a, b) { let total = 0; for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]); return total / a.length }
function surfaceDelta(a, b) {
  let total = 0
  for (let y = 96; y < 416; y++) for (let x = 96; x < 416; x++) for (let channel = 0; channel < 3; channel++) {
    const index = (y * width + x) * 4 + channel
    total += Math.abs(a[index] - b[index])
  }
  return total / (320 * 320 * 3)
}
function capture(name) { const pixels = read(); captures.set(name, renderer.domElement.toDataURL("image/png")); return pixels }
function swap(mesh) { scene.children.filter(child => child.isMesh).forEach(child => scene.remove(child)); scene.add(mesh) }

window.runMaterialFixtures = async () => {
  const checks = []
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false })
  // Pixel readback has a fixed physical size; CSS/device DPR is independently
  // exercised by the app tests. This prevents indexing a DPR-scaled readback wrong.
  renderer.setPixelRatio(1); renderer.setSize(width, height)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1
  document.body.appendChild(renderer.domElement)
  const gl = renderer.getContext(), extension = gl.getExtension("WEBGL_debug_renderer_info")
  scene = new THREE.Scene(); scene.background = new THREE.Color("#080808")
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10); camera.position.z = 4
  scene.add(new THREE.AmbientLight(0xffffff, .3))
  const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-2, 1.5, 3); scene.add(light)
  const normal = texture((x, y) => x < 32 ? [194, y < 32 ? 146 : 111, 235, 255] : [67, y < 32 ? 176 : 125, 234, 255])
  const orm = texture((x, y) => [255, x < 32 ? 76 : 194, y < 32 ? 0 : 255, 255])
  const albedo = texture((x, y) => ((x >> 3) + (y >> 3)) % 2 ? [75, 75, 75, 255] : [190, 190, 190, 255])
  albedo.colorSpace = THREE.SRGBColorSpace
  const base = own(new THREE.MeshStandardMaterial({ color: "#303030", roughness: 1, metalness: 1, normalMap: normal, roughnessMap: orm, metalnessMap: orm, map: albedo }))
  const stock = plane(base); swap(stock); const stockPixels = capture("stock-asymmetric-normal-orm")
  const material = own(base.clone()), mesh = plane(material); swap(mesh)
  bindEngineeringMaterials(mesh, metadata, engineering, surfaceProfile)
  const composed = capture("composed-neutral-normal-orm")
  check(checks, "Neutral composition preserves the stock normal/ORM/albedo response", delta(stockPixels, composed) < .15, { meanAbsoluteChannelDifference: delta(stockPixels, composed) })
  const flat = own(base.clone()); flat.normalMap = null; swap(plane(flat)); const flatPixels = capture("flat-normal-comparison")
  check(checks, "Asymmetric tangent normal fixture changes lighting", surfaceDelta(stockPixels, flatPixels) > 2, { meanAbsoluteSurfaceRGBDifference: surfaceDelta(stockPixels, flatPixels) })
  const mirroredStock = plane(base)
  const mirroredUV = mirroredStock.geometry.attributes.uv
  for (let vertex = 0; vertex < mirroredUV.count; vertex++) mirroredUV.setX(vertex, 1 - mirroredUV.getX(vertex))
  mirroredUV.needsUpdate = true; swap(mirroredStock); const mirroredReference = capture("mirrored-uv-stock")
  const mirroredMaterial = own(base.clone()), mirrored = new THREE.Mesh(mirroredStock.geometry, mirroredMaterial)
  bindEngineeringMaterials(mirrored, metadata, engineering, surfaceProfile); swap(mirrored)
  const mirroredResult = capture("mirrored-uv-composed")
  check(checks, "Mirrored UVs preserve the derivative tangent response", delta(mirroredReference, mirroredResult) < .15, { meanAbsoluteChannelDifference: delta(mirroredReference, mirroredResult) })
  const normalDebug = own(new THREE.MeshNormalMaterial({ normalMap: normal })); swap(plane(normalDebug)); capture("normal-diagnostic")
  const roughnessDebug = texture(x => x < 32 ? [76, 76, 76, 255] : [194, 194, 194, 255])
  swap(plane(own(new THREE.MeshBasicMaterial({ map: roughnessDebug, toneMapped: false })))); capture("roughness-diagnostic")

  const routeMaterial = own(new THREE.MeshStandardMaterial({ color: "#ffffff", map: albedo, normalMap: normal, roughnessMap: orm, roughness: 1, metalness: 0 }))
  const route = plane(routeMaterial, { route: 0 }); swap(route)
  const bindings = bindEngineeringMaterials(route, metadata, engineering, surfaceProfile)
  const resting = capture("route-resting")
  bindings.routeWeights[0] = .85; const hovering = capture("route-hover")
  bindings.routeWeights[0] = 1; const selected = capture("route-selected")
  check(checks, "Hover and selected accents render distinct responses", delta(resting, hovering) > 3 && delta(hovering, selected) > .2, { restToHover: delta(resting, hovering), hoverToSelected: delta(hovering, selected) })
  // At both weights the alternating color texels must remain distinguishable.
  const bright = sample(selected, 116, 116), dark = sample(selected, 164, 116)
  check(checks, "Selected routes retain albedo modulation", Math.abs(bright[0] - dark[0]) > 5, { bright, dark })

  const alternateProfile = { ...engineering, accent: { ...engineering.accent, selected: "#76b9ff", activeEmission: .12, baseEmission: .01 } }
  const alternateMaterial = own(routeMaterial.clone()), alternate = plane(alternateMaterial, { route: 0 })
  const alternateBindings = bindEngineeringMaterials(alternate, metadata, alternateProfile, surfaceProfile)
  alternateBindings.routeWeights[0] = 1; swap(alternate); const alternatePixels = capture("same-counts-alternate-profile")
  swap(route); const originalAgain = capture("same-counts-original-restored")
  check(checks, "Same semantic counts use independent profile uniforms", delta(selected, alternatePixels) > 5 && delta(selected, originalAgain) < .15, { betweenProfiles: delta(selected, alternatePixels), originalAfterReuse: delta(selected, originalAgain), originalKey: routeMaterial.customProgramCacheKey(), alternateKey: alternateMaterial.customProgramCacheKey() })

  const edgeMaterial = own(new THREE.MeshStandardMaterial({ color: "#000000", normalMap: normal, metalness: 0, roughness: 1 }))
  // A grazing face keeps the reviewed low emission above the ACES black toe.
  // Both programs use identical geometry; compare only their shared interior.
  const edge = plane(edgeMaterial); edge.rotation.y = 1.4
  const edgeBindings = bindEngineeringMaterials(edge, metadata, engineering, surfaceProfile)
  edgeBindings.equipmentWeights[0] = 1; swap(edge)
  scene.children.filter(child => child.isLight).forEach(child => { child.userData.intensity = child.intensity; child.intensity = 0 })
  const detailedEdge = capture("equipment-edge-perturbed-normal")
  edgeMaterial.normalMap = null; edgeMaterial.needsUpdate = true
  const flatEdge = capture("equipment-edge-geometric-normal")
  check(checks, "Equipment edge emphasis uses the unperturbed surface normal", delta(detailedEdge, flatEdge) < .15, { meanAbsoluteChannelDifference: delta(detailedEdge, flatEdge) })

  const reviewedSurface = { ...surfaceProfile, equipmentEdge: { version: 1, viewDirection: "projection-correct", exponent: 5, intensity: .02 } }
  const reviewedEdgeMaterial = own(new THREE.MeshStandardMaterial({ color: "#000000", metalness: 0, roughness: 1 }))
  const reviewedEdge = plane(reviewedEdgeMaterial); reviewedEdge.rotation.y = 1.4
  const reviewedBindings = bindEngineeringMaterials(reviewedEdge, metadata, engineering, reviewedSurface)
  reviewedBindings.equipmentWeights[0] = 1; swap(reviewedEdge)
  const projected = capture("equipment-edge-projection-correct")
  const leftEdge = sample(projected, 235, 256), rightEdge = sample(projected, 275, 256)
  check(checks, "Orthographic equipment emphasis is spatially consistent across a planar surface", leftEdge.some(value => value > 0) && leftEdge.every((value, index) => Math.abs(value - rightEdge[index]) <= 1), { leftEdge, rightEdge })
  const reviewedEmission = mean(projected, 235, 276, 170, 340), legacyEmission = mean(flatEdge, 235, 276, 170, 340)
  check(checks, "Reviewed equipment emphasis avoids broad legacy emission", reviewedEmission[0] < legacyEmission[0] * .5, { reviewed: reviewedEmission, legacy: legacyEmission, sharedInterior: [235, 276, 170, 340] })
  check(checks, "Projection feature uses a distinct program from frozen legacy profiles", reviewedEdgeMaterial.customProgramCacheKey() !== edgeMaterial.customProgramCacheKey(), { reviewed: reviewedEdgeMaterial.customProgramCacheKey(), legacy: edgeMaterial.customProgramCacheKey() })
  scene.children.filter(child => child.isLight).forEach(child => { child.intensity = child.userData.intensity })

  const mask = texture((x, y) => [120, 120, 120, x % 8 >= 2 && x % 8 <= 5 && y % 8 >= 2 && y % 8 <= 5 ? 0 : 255])
  mask.colorSpace = THREE.SRGBColorSpace
  const maskMaterial = own(new THREE.MeshStandardMaterial({ map: mask, alphaTest: .5, color: "#ffffff", roughness: .5 }))
  maskMaterial.userData = { gnSurfaceRole: "grille", gnCutoutMinFeatureTexels: 2 }
  const grille = plane(maskMaterial), maskBindings = bindEngineeringMaterials(grille, metadata, engineering, surfaceProfile)
  configureSurfaceSampling(maskBindings, renderer, "high")
  check(checks, "High sampling remains within the two-sample anisotropy ceiling", mask.anisotropy <= 2, { anisotropy: mask.anisotropy })
  check(checks, "Coverage responds to actual multisample context support", maskMaterial.alphaToCoverage === (gl.getParameter(gl.SAMPLES) > 1), { samples: gl.getParameter(gl.SAMPLES), alphaToCoverage: maskMaterial.alphaToCoverage })
  const unmultisampled = new THREE.WebGLRenderer({ antialias: false })
  configureSurfaceSampling(maskBindings, unmultisampled, "economy")
  check(checks, "Single-sample contexts retain alpha testing without alpha-to-coverage", !maskMaterial.alphaToCoverage && mask.anisotropy === 1, { samples: unmultisampled.getContext().getParameter(gl.SAMPLES), alphaToCoverage: maskMaterial.alphaToCoverage, anisotropy: mask.anisotropy })
  unmultisampled.dispose(); unmultisampled.forceContextLoss()
  configureSurfaceSampling(maskBindings, renderer, "balanced")
  swap(grille); const closeMask = capture("grille-resolved-holes")
  const holes = pixels => { let count = 0; for (let y = 112; y < 400; y++) for (let x = 112; x < 400; x++) if (pixels[(y * width + x) * 4] < 35) count++; return count }
  const resolvedHoles = holes(closeMask)
  check(checks, "Resolved MASK apertures reveal the background", resolvedHoles > 500, { darkPixels: resolvedHoles })
  const maskProgression = []
  // Fixed geometry and decreasing texture feature size exercise derivatives at
  // the same central footprint, so a small object/background cannot fake a pass.
  for (const repeat of [1, 2, 4, 8, 16, 32]) {
    mask.repeat.set(repeat, repeat); mask.wrapS = THREE.RepeatWrapping; mask.wrapT = THREE.RepeatWrapping; mask.updateMatrix(); mask.needsUpdate = true
    const pixels = capture(`grille-minification-${repeat}`)
    maskProgression.push({ repeat, darkPixels: holes(pixels), mean: mean(pixels) })
  }
  check(checks, "Subpixel MASK detail converges to the opaque grille", maskProgression.at(-1).darkPixels < resolvedHoles * .05 && maskProgression.at(-1).mean[0] > 50, maskProgression)
  check(checks, "Cutout and opaque materials have distinct program features", maskMaterial.customProgramCacheKey() !== routeMaterial.customProgramCacheKey(), { mask: maskMaterial.customProgramCacheKey(), opaque: routeMaterial.customProgramCacheKey() })

  // V6 uses the authored topology metadata and the same production composer.
  const v6Topology = await (await fetch("/v6-topology.json")).json()
  const ecosystemProfile = { version: 1, seed: 61427, ambientIntervalSeconds: [12, 18], sequenceSeconds: 8, chapterSeconds: [4, 4, 5, 4, 4, 3], colors: { electrical: "#e3e7e4", cooling: "#76abb4", heat: "#c98554" }, fanModulation: .1, maxEquipment: 96, maxRoutes: 128, maxTraces: 2 }
  const makeV6 = (topology, profile = ecosystemProfile, routeIndex = 0, surfaces = surfaceProfile) => {
    const material = own(new THREE.MeshStandardMaterial({ color: "#242424", roughness: .5, metalness: 0, normalMap: normal }))
    const mesh = plane(material, { route: routeIndex, equipment: topology.equipment.length - 1 })
    const attribute = mesh.geometry.getAttribute("_gn_route_s"), uv = mesh.geometry.getAttribute("uv")
    for (let index = 0; index < attribute.count; index++) attribute.setX(index, uv.getX(index))
    const binding = bindEngineeringMaterials(mesh, { topology }, engineering, surfaces, profile)
    validateEcosystemUniformBudget(binding, renderer)
    return { material, mesh, binding: binding.ecosystem }
  }
  const regionDelta = (a, b, left, right) => {
    let sum = 0, count = 0
    for (let y = 170; y < 340; y++) for (let x = left; x < right; x++) for (let channel = 0; channel < 3; channel++) { const i = (y * width + x) * 4 + channel; sum += Math.abs(a[i] - b[i]); count++ }
    return sum / count
  }
  const v6 = makeV6(v6Topology); swap(v6.mesh); const v6Rest = capture("v6-authored-counts-rest")
  v6.binding.routes[0] = .45; v6.binding.routeFrom[0] = .1; v6.binding.routeTo[0] = .4
  const v6Tap = capture("v6-static-selected-tap")
  const insideTap = regionDelta(v6Rest, v6Tap, 120, 205), beyondTap = regionDelta(v6Rest, v6Tap, 290, 390)
  check(checks, "V6 static route emphasis stops at the selected branch", insideTap > 1 && beyondTap < .15, { insideTap, beyondTap, counts: [v6Topology.equipment.length, v6Topology.routes.length] })
  v6.binding.routes[0] = 0; v6.binding.traces.set([0, .25, .1, .4, 1, 0, 1, 0], 0)
  const forward = capture("v6-forward-signed-subrange")
  v6.binding.traces.set([0, .75, .6, .9, 1, 0, -1, 0], 0)
  const reverse = capture("v6-reverse-signed-subrange")
  check(checks, "V6 forward and reverse trace slots stay on their authored intervals", regionDelta(v6Rest, forward, 120, 205) > 1 && regionDelta(v6Rest, forward, 290, 390) < .15 && regionDelta(v6Rest, reverse, 120, 205) < .15 && regionDelta(v6Rest, reverse, 310, 390) > 1, { forwardInside: regionDelta(v6Rest, forward, 120, 205), forwardOutside: regionDelta(v6Rest, forward, 290, 390), reverseInside: regionDelta(v6Rest, reverse, 310, 390), reverseOutside: regionDelta(v6Rest, reverse, 120, 205) })
  v6.binding.traces[0] = 1
  const sibling = capture("v6-sibling-route-isolation")
  check(checks, "V6 trace identity never leaks to a sibling route", delta(v6Rest, sibling) < .15, { difference: delta(v6Rest, sibling) })
  v6.binding.traces[0] = -1; v6.binding.routes[0] = .45; v6.binding.routeFrom[0] = 0; v6.binding.routeTo[0] = 1
  const serviceColors = []
  for (const [signal, name] of ["electrical", "cooling", "heat"].entries()) { v6.binding.signals[0] = signal; serviceColors.push(mean(capture(`v6-service-${name}`))) }
  check(checks, "V6 electrical, cooling and heat cues retain distinct restrained hues", serviceColors[1][2] > serviceColors[1][0] && serviceColors[2][0] > serviceColors[2][2] && Math.abs(serviceColors[0][0] - serviceColors[0][2]) < 18, serviceColors)
  v6.binding.signals[0] = 1; const originalPalette = capture("v6-original-cooling-palette")
  const alternateV6 = makeV6(v6Topology, { ...ecosystemProfile, colors: { ...ecosystemProfile.colors, cooling: "#d87e9b" } })
  alternateV6.binding.routes[0] = .45; alternateV6.binding.routeFrom[0] = 0; alternateV6.binding.routeTo[0] = 1; alternateV6.binding.signals[0] = 1
  swap(alternateV6.mesh); const differentPalette = capture("v6-same-counts-alternate-palette")
  swap(v6.mesh); const restoredPalette = capture("v6-original-palette-restored")
  check(checks, "V6 equal-count programs retain independent ecosystem palette uniforms", delta(originalPalette, differentPalette) > 1 && delta(originalPalette, restoredPalette) < .15 && v6.material.customProgramCacheKey() === alternateV6.material.customProgramCacheKey(), { changed: delta(originalPalette, differentPalette), restored: delta(originalPalette, restoredPalette), key: v6.material.customProgramCacheKey() })
  const fullTopology = { schemaVersion: "facility-topology.v2", equipment: Array.from({ length: 96 }, (_, index) => ({ id: `fixture-equipment-${index}` })), routes: Array.from({ length: 128 }, (_, index) => ({ id: `fixture-route-${index}`, index, medium: "electrical" })) }
  const maximumV6 = makeV6(fullTopology, ecosystemProfile, 127)
  maximumV6.binding.routes[127] = .45; maximumV6.binding.routeFrom[127] = 0; maximumV6.binding.routeTo[127] = 1; maximumV6.binding.equipment[95] = .7
  swap(maximumV6.mesh); const maximumPixels = capture("v6-maximum-packed-identity-capacity")
  check(checks, "V6 compiles and renders the full96equipment/128route contract", mean(maximumPixels)[0] > 20 && gl.getError() === gl.NO_ERROR, { uniformVectors: maximumV6.binding.uniformVectors, maximumFragmentVectors: renderer.capabilities.maxFragmentUniforms, means: mean(maximumPixels), key: maximumV6.material.customProgramCacheKey() })
  const maximumReviewed = makeV6(fullTopology, ecosystemProfile, 127, reviewedSurface)
  maximumReviewed.binding.routes[127] = .45; maximumReviewed.binding.routeFrom[127] = 0; maximumReviewed.binding.routeTo[127] = 1; maximumReviewed.binding.equipment[95] = .7
  swap(maximumReviewed.mesh); const maximumReviewedPixels = capture("reviewed-edge-maximum-packed-identity-capacity")
  check(checks, "Projection-correct emphasis compiles with the full96equipment/128route contract", mean(maximumReviewedPixels)[0] > 20 && gl.getError() === gl.NO_ERROR && maximumReviewed.binding.uniformVectors === maximumV6.binding.uniformVectors + 2, { uniformVectors: maximumReviewed.binding.uniformVectors, maximumFragmentVectors: renderer.capabilities.maxFragmentUniforms, key: maximumReviewed.material.customProgramCacheKey() })
  check(checks, "WebGL remains error free after material reuse", gl.getError() === gl.NO_ERROR, { programs: renderer.info.programs.length })
  return {
    checks, captures: [...captures.keys()], renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    threeRevision: THREE.REVISION, glVersion: gl.getParameter(gl.VERSION), msaaSamples: gl.getParameter(gl.SAMPLES),
    drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], devicePixelRatio,
    note: "Synthetic shader correctness benchmark; not a performance or asset-quality measurement.",
  }
}

window.showMaterialCapture = async name => {
  const source = captures.get(name)
  if (!source) throw new Error("Unknown material capture")
  const image = new Image(); image.src = source; await image.decode()
  let canvas = document.querySelector("canvas[data-capture]")
  if (!canvas) { canvas = document.createElement("canvas"); canvas.dataset.capture = "true"; canvas.width = width; canvas.height = height; document.body.replaceChildren(canvas) }
  canvas.getContext("2d").drawImage(image, 0, 0)
}

window.addEventListener("pagehide", () => { owned.forEach(resource => resource.dispose()); renderer?.dispose() }, { once: true })
