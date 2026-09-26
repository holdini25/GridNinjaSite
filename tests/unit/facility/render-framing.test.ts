import { describe, expect, it } from "vitest"
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, OrthographicCamera, Quaternion, Vector3 } from "three"
import { projectedFacilityBounds } from "@/lib/facility/render-framing"

describe("cached projected facility contour", () => {
  it("avoids empty world-AABB corners while enclosing every visible vertex", () => {
    const scene = new Group(), geometry = new BoxGeometry(1, 1, 1), material = new MeshBasicMaterial()
    for (const [x, y] of [[-2, 0], [2, 3]]) {
      const mesh = new Mesh(geometry, material); mesh.position.set(x, y, 0); scene.add(mesh)
    }
    const hidden = new Mesh(geometry, material); hidden.position.set(100, 100, 100); hidden.visible = false; scene.add(hidden)
    const profile = { camera: [10, 10, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
    const bounds = projectedFacilityBounds({ scene, fans: [] }, profile)
    const camera = new OrthographicCamera(); camera.position.fromArray(profile.camera); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
    const box = new Box3().setFromObject(scene.children[0]).union(new Box3().setFromObject(scene.children[1]))
    const ys = Array.from({ length: 8 }, (_, index) => new Vector3(index & 1 ? box.max.x : box.min.x, index & 2 ? box.max.y : box.min.y, index & 4 ? box.max.z : box.min.z).applyMatrix4(camera.matrixWorldInverse).y)
    expect(bounds.top - bounds.bottom).toBeLessThan(Math.max(...ys) - Math.min(...ys))
    for (const mesh of scene.children.slice(0, 2) as Mesh[]) {
      const position = mesh.geometry.getAttribute("position")
      for (let index = 0; index < position.count; index++) {
        const p = new Vector3().fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
        expect(p.x).toBeGreaterThanOrEqual(bounds.left - 1e-9); expect(p.x).toBeLessThanOrEqual(bounds.right + 1e-9)
        expect(p.y).toBeGreaterThanOrEqual(bounds.bottom - 1e-9); expect(p.y).toBeLessThanOrEqual(bounds.top + 1e-9)
      }
    }
    geometry.dispose(); material.dispose()
  })

  it("includes the actual transform of every LED instance", () => {
    const scene = new Group(), geometry = new BoxGeometry(1, 1, 1), material = new MeshBasicMaterial()
    const leds = new InstancedMesh(geometry, material, 2)
    leds.setMatrixAt(0, new Matrix4().makeTranslation(-2, 0, 0))
    leds.setMatrixAt(1, new Matrix4().makeTranslation(5, 1, 0)); scene.add(leds)
    expect(projectedFacilityBounds({ scene, fans: [] }, { camera: [0, 0, 20], target: [0, 0, 0] })).toEqual({ left: -2.5, right: 5.5, bottom: -0.5, top: 1.5 })
    leds.dispose(); geometry.dispose(); material.dispose()
  })

  it("encloses a complete rotor turn independently of the staged starting phase", () => {
    const scene = new Group(), parent = new Group(), geometry = new BoxGeometry(4, 0.2, 0.3), material = new MeshBasicMaterial()
    parent.position.set(1, 2, -1); parent.rotation.z = 0.2; scene.add(parent)
    const rotor = new Mesh(geometry, material); rotor.position.set(1, 0.5, 0); parent.add(rotor)
    const base = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.15)
    const axis = new Vector3(0, 1, 0), profile = { camera: [10, 8, 12] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
    rotor.quaternion.copy(base)
    const model = { scene, fans: [{ object: rotor, axis, base, phase: 0 }] }
    const bounds = projectedFacilityBounds(model, profile)
    const camera = new OrthographicCamera(); camera.position.fromArray(profile.camera); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true)
    const position = geometry.getAttribute("position")
    for (let step = 0; step < 40; step++) {
      rotor.quaternion.copy(base).multiply(new Quaternion().setFromAxisAngle(axis, step * Math.PI / 20)); scene.updateMatrixWorld(true)
      for (let index = 0; index < position.count; index++) {
        const p = new Vector3().fromBufferAttribute(position, index).applyMatrix4(rotor.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
        expect(p.x).toBeGreaterThanOrEqual(bounds.left - 1e-9); expect(p.x).toBeLessThanOrEqual(bounds.right + 1e-9)
        expect(p.y).toBeGreaterThanOrEqual(bounds.bottom - 1e-9); expect(p.y).toBeLessThanOrEqual(bounds.top + 1e-9)
      }
    }
    const after = projectedFacilityBounds(model, profile)
    for (const key of ["left", "right", "bottom", "top"] as const) expect(after[key]).toBeCloseTo(bounds[key], 9)
    geometry.dispose(); material.dispose()
  })
})
