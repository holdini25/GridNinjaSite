import { Mesh, MeshStandardMaterial, OrthographicCamera, PerspectiveCamera, Vector2, Vector3, type Camera, type Intersection, type Material, type Object3D, type Texture } from "three"

type CoverageLevel = { width: number; height: number; alpha: Uint8Array }
export type SurfaceCoverage = { levels: CoverageLevel[]; bytes: number; minimumFeature: number; texture: Texture }

/** A bounded alpha pyramid is read once during staging, never during pointer input. */
export function createSurfaceCoverage(material: MeshStandardMaterial): SurfaceCoverage {
  const texture = material.map!, source = texture.source.data as { width: number; height: number; data?: ArrayLike<number> }
  const { width, height } = source
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 256 || height > 256) throw new Error("surface_coverage_dimensions")
  let rgba: ArrayLike<number>
  if (source.data && source.data.length === width * height * 4) rgba = source.data
  else {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("surface_coverage_context")
    context.drawImage(source as unknown as CanvasImageSource, 0, 0)
    rgba = context.getImageData(0, 0, width, height).data
    canvas.width = canvas.height = 0
  }
  let level: CoverageLevel = { width, height, alpha: new Uint8Array(width * height) }
  for (let i = 0; i < level.alpha.length; i++) level.alpha[i] = rgba[i * 4 + 3]
  const levels = [level]
  let bytes = level.alpha.byteLength
  while (level.width > 1 || level.height > 1) {
    const next: CoverageLevel = { width: Math.max(1, level.width >> 1), height: Math.max(1, level.height >> 1), alpha: new Uint8Array(Math.max(1, level.width >> 1) * Math.max(1, level.height >> 1)) }
    for (let y = 0; y < next.height; y++) for (let x = 0; x < next.width; x++) {
      let total = 0, count = 0
      for (let dy = 0; dy < 2 && y * 2 + dy < level.height; dy++) for (let dx = 0; dx < 2 && x * 2 + dx < level.width; dx++) { total += level.alpha[(y * 2 + dy) * level.width + x * 2 + dx]; count++ }
      next.alpha[y * next.width + x] = Math.round(total / count)
    }
    levels.push(next); bytes += next.alpha.byteLength; level = next
  }
  return { levels, bytes, minimumFeature: material.userData.gnCutoutMinFeatureTexels as number, texture }
}

function bilinear(level: CoverageLevel, u: number, v: number) {
  const x = Math.max(0, Math.min(level.width - 1, u * level.width - .5)), y = Math.max(0, Math.min(level.height - 1, v * level.height - .5))
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(level.width - 1, x0 + 1), y1 = Math.min(level.height - 1, y0 + 1), fx = x - x0, fy = y - y0
  return ((level.alpha[y0 * level.width + x0] * (1 - fx) + level.alpha[y0 * level.width + x1] * fx) * (1 - fy) + (level.alpha[y1 * level.width + x0] * (1 - fx) + level.alpha[y1 * level.width + x1] * fx) * fy) / 255
}
export function sampleSurfaceCoverage(coverage: SurfaceCoverage, u: number, v: number, footprint: number): number {
  const lod = Math.min(coverage.levels.length - 1, Math.max(0, Math.log2(Math.max(1, footprint)))), lower = Math.floor(lod), upper = Math.min(coverage.levels.length - 1, lower + 1)
  const alpha = bilinear(coverage.levels[lower], u, v) * (1 - (lod - lower)) + bilinear(coverage.levels[upper], u, v) * (lod - lower)
  const amount = Math.max(0, Math.min(1, (footprint - coverage.minimumFeature * .5) / (coverage.minimumFeature * .5))), fade = amount * amount * (3 - 2 * amount)
  return alpha + (1 - alpha) * fade
}

const hitPoint = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3(), ua = new Vector2(), ub = new Vector2(), uc = new Vector2(), pointUv = new Vector2()
/** Perspective-correct UV-to-buffer derivatives match the shader's minification rule.
 * MSAA sample-edge coverage is approximate; fully open holes and opaque coarse
 * grilles have the same target as the visible material. No canvas reads occur here. */
export function surfaceHitVisible(masks: ReadonlyMap<Material, SurfaceCoverage> | undefined, hit: Intersection<Object3D>, camera: Camera, width: number, height: number): boolean {
  if (!masks?.size || !(hit.object instanceof Mesh) || !hit.face || !hit.uv || (!(camera instanceof OrthographicCamera) && !(camera instanceof PerspectiveCamera))) return true
  const object = hit.object, face = hit.face, material = Array.isArray(object.material) ? object.material[face.materialIndex] : object.material
  const coverage = masks.get(material)
  if (!coverage) return true
  const position = object.geometry.getAttribute("position"), uv = object.geometry.getAttribute("uv")
  if (!uv || !position) return true
  a.fromBufferAttribute(position, face.a).applyMatrix4(object.matrixWorld); b.fromBufferAttribute(position, face.b).applyMatrix4(object.matrixWorld); c.fromBufferAttribute(position, face.c).applyMatrix4(object.matrixWorld)
  const view = camera.matrixWorldInverse.elements
  const reciprocalW = (point: Vector3) => camera instanceof PerspectiveCamera ? -1 / (view[2] * point.x + view[6] * point.y + view[10] * point.z + view[14]) : 1
  const aw = reciprocalW(a), bw = reciprocalW(b), cw = reciprocalW(c)
  if (![aw, bw, cw].every(value => Number.isFinite(value) && value > 0)) return true
  a.project(camera); b.project(camera); c.project(camera)
  ua.fromBufferAttribute(uv, face.a); ub.fromBufferAttribute(uv, face.b); uc.fromBufferAttribute(uv, face.c)
  coverage.texture.updateMatrix(); coverage.texture.transformUv(ua); coverage.texture.transformUv(ub); coverage.texture.transformUv(uc)
  const bx = (b.x - a.x) * width * .5, by = (b.y - a.y) * height * .5, cx = (c.x - a.x) * width * .5, cy = (c.y - a.y) * height * .5, determinant = bx * cy - by * cx
  if (Math.abs(determinant) < 1e-8) return true
  const tw = coverage.levels[0].width, th = coverage.levels[0].height
  hitPoint.copy(hit.point).project(camera)
  const px = (hitPoint.x - a.x) * width * .5, py = (hitPoint.y - a.y) * height * .5
  const wb = (px * cy - py * cx) / determinant, wc = (bx * py - by * px) / determinant
  const inverseW = aw * (1 - wb - wc) + bw * wb + cw * wc
  if (!Number.isFinite(inverseW) || inverseW <= 0) return true
  coverage.texture.transformUv(pointUv.copy(hit.uv))
  const qx = ((bw - aw) * cy - (cw - aw) * by) / determinant, qy = (bx * (cw - aw) - cx * (bw - aw)) / determinant
  const dux = (((ub.x * bw - ua.x * aw) * cy - (uc.x * cw - ua.x * aw) * by) / determinant - pointUv.x * qx) * tw / inverseW
  const dvx = (((ub.y * bw - ua.y * aw) * cy - (uc.y * cw - ua.y * aw) * by) / determinant - pointUv.y * qx) * th / inverseW
  const duy = ((bx * (uc.x * cw - ua.x * aw) - cx * (ub.x * bw - ua.x * aw)) / determinant - pointUv.x * qy) * tw / inverseW
  const dvy = ((bx * (uc.y * cw - ua.y * aw) - cx * (ub.y * bw - ua.y * aw)) / determinant - pointUv.y * qy) * th / inverseW
  const footprint = Math.max(Math.hypot(dux, dvx), Math.hypot(duy, dvy))
  return sampleSurfaceCoverage(coverage, pointUv.x, pointUv.y, footprint) >= (material as MeshStandardMaterial).alphaTest
}
