import { expect, it, vi } from "vitest"
import { DataTexture, Mesh, MeshStandardMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Raycaster, RGBAFormat, SRGBColorSpace, Vector2 } from "three"
import { createSurfaceCoverage, sampleSurfaceCoverage, surfaceHitVisible } from "@/lib/facility/surface-coverage"

it("passes ray hits through resolved holes, stops on metal, and matches coarse opaque convergence without image rereads", () => {
  const rgba = new Uint8Array(16 * 16 * 4).fill(255)
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) rgba[(y * 16 + x) * 4 + 3] = 0
  const map = new DataTexture(rgba, 16, 16, RGBAFormat); map.colorSpace = SRGBColorSpace
  const material = new MeshStandardMaterial({ map, alphaTest: .5 }); material.userData = { gnSurfaceRole: "grille", gnCutoutMinFeatureTexels: 2 }
  const coverage = createSurfaceCoverage(material), masks = new Map([[material, coverage]])
  expect(coverage.bytes).toBe(16 * 16 + 8 * 8 + 4 * 4 + 2 * 2 + 1)
  const geometry = new PlaneGeometry(2, 2), door = new Mesh(geometry, material)
  const backingMaterial = new MeshStandardMaterial(), backing = new Mesh(geometry, backingMaterial); backing.position.z = -.2
  door.updateMatrixWorld(); backing.updateMatrixWorld()
  const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 10); camera.position.z = 2; camera.updateMatrixWorld()
  const ray = new Raycaster(), read = vi.spyOn(HTMLCanvasElement.prototype, "getContext")
  ray.setFromCamera(new Vector2(0, 0), camera)
  const intersections = ray.intersectObjects([door, backing])
  const near = intersections.find(hit => surfaceHitVisible(masks, hit, camera, 256, 256))
  expect(near!.object).toBe(backing)
  const coarse = intersections.find(hit => surfaceHitVisible(masks, hit, camera, 8, 8))
  expect(coarse!.object).toBe(door)
  ray.setFromCamera(new Vector2(-.8, -.8), camera)
  expect(ray.intersectObjects([door, backing]).find(hit => surfaceHitVisible(masks, hit, camera, 256, 256))!.object).toBe(door)
  expect(sampleSurfaceCoverage(coverage, .5, .5, 2)).toBe(1)
  expect(read).not.toHaveBeenCalled()
  read.mockRestore(); geometry.dispose(); material.dispose(); backingMaterial.dispose(); map.dispose()
})


it("preserves cutout picking under oblique perspective and converges distant holes to the baked surface", () => {
  const rgba = new Uint8Array(32 * 32 * 4).fill(255)
  for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) rgba[(y * 32 + x) * 4 + 3] = 0
  const map = new DataTexture(rgba, 32, 32, RGBAFormat)
  const material = new MeshStandardMaterial({ map, alphaTest: .5 }); material.userData = { gnCutoutMinFeatureTexels: 2 }
  const coverage = createSurfaceCoverage(material), masks = new Map([[material, coverage]])
  const geometry = new PlaneGeometry(2, 2), door = new Mesh(geometry, material)
  const backingMaterial = new MeshStandardMaterial(), backing = new Mesh(geometry, backingMaterial); backing.position.z = -.2
  door.updateMatrixWorld(); backing.updateMatrixWorld()
  const camera = new PerspectiveCamera(32, 4 / 3, .1, 100); camera.position.set(1.5, .3, 4); camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
  const ray = new Raycaster(); ray.setFromCamera(new Vector2(0, 0), camera)
  const intersections = ray.intersectObjects([door, backing])
  expect(intersections.find(hit => surfaceHitVisible(masks, hit, camera, 680, 510))!.object).toBe(backing)
  expect(intersections.find(hit => surfaceHitVisible(masks, hit, camera, 8, 6))!.object).toBe(door)
  geometry.dispose(); material.dispose(); backingMaterial.dispose(); map.dispose()
})
