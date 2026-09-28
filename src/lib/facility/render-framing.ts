import { InstancedMesh, Matrix4, Mesh, Vector3, type Object3D } from "three"
import type { FacilityModel } from "./asset-runtime"
import type { FacilityRenderProfile } from "@/types/facility"

export type ProjectedBounds = { left: number; right: number; bottom: number; top: number }

/** Project the actual contour once, including all LED instances and complete
 * rotor sweeps. Cached by the caller across viewport resizes and animation. */
export function projectedFacilityBounds(model: Pick<FacilityModel, "scene" | "fans">, profile: Pick<FacilityRenderProfile, "camera" | "target">): ProjectedBounds {
  const position = new Vector3(...profile.camera)
  const view = new Matrix4().lookAt(position, new Vector3(...profile.target), new Vector3(0, 1, 0)).setPosition(position).invert()
  const bounds = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity }
  const include = (x: number, y: number, radiusX = 0, radiusY = 0) => {
    bounds.left = Math.min(bounds.left, x - radiusX); bounds.right = Math.max(bounds.right, x + radiusX)
    bounds.bottom = Math.min(bounds.bottom, y - radiusY); bounds.top = Math.max(bounds.top, y + radiusY)
  }
  model.scene.updateMatrixWorld(true)
  const sweepFrames = new Map(model.fans.map(fan => {
    const base = new Matrix4().compose(fan.object.position, fan.base, fan.object.scale)
    if (fan.object.parent) base.premultiply(fan.object.parent.matrixWorld)
    return [fan.object, { axis: fan.axis, inverse: fan.object.matrixWorld.clone().invert(), projected: base.premultiply(view) }] as const
  }))
  const point = new Vector3(), axial = new Vector3(), radial = new Vector3(), tangent = new Vector3()
  const matrix = new Matrix4(), instance = new Matrix4(), meshMatrix = new Matrix4()
  model.scene.traverseVisible(object => {
    if (!(object instanceof Mesh)) return
    const vertices = object.geometry.getAttribute("position")
    if (!vertices) return
    let ancestor: Object3D | null = object
    while (ancestor && !sweepFrames.has(ancestor)) ancestor = ancestor.parent
    const sweep = ancestor ? sweepFrames.get(ancestor) : undefined
    meshMatrix.multiplyMatrices(sweep?.inverse ?? view, object.matrixWorld)
    const count = object instanceof InstancedMesh ? object.count : 1
    for (let copy = 0; copy < count; copy++) {
      matrix.copy(meshMatrix)
      if (object instanceof InstancedMesh) { object.getMatrixAt(copy, instance); matrix.multiply(instance) }
      for (let index = 0; index < vertices.count; index++) {
        point.fromBufferAttribute(vertices, index).applyMatrix4(matrix)
        if (!sweep) { include(point.x, point.y); continue }
        // A rotating point projects to an ellipse. Its X/Y support radii give
        // exact full-turn bounds without sampling poses or overfitting one frame.
        axial.copy(sweep.axis).multiplyScalar(point.dot(sweep.axis))
        radial.copy(point).sub(axial)
        tangent.crossVectors(sweep.axis, radial)
        const e = sweep.projected.elements
        const radiusX = Math.hypot(e[0] * radial.x + e[4] * radial.y + e[8] * radial.z, e[0] * tangent.x + e[4] * tangent.y + e[8] * tangent.z)
        const radiusY = Math.hypot(e[1] * radial.x + e[5] * radial.y + e[9] * radial.z, e[1] * tangent.x + e[5] * tangent.y + e[9] * tangent.z)
        axial.applyMatrix4(sweep.projected)
        include(axial.x, axial.y, radiusX, radiusY)
      }
    }
  })
  if (!Object.values(bounds).every(Number.isFinite) || bounds.left >= bounds.right || bounds.bottom >= bounds.top) throw new Error("model_projection")
  return bounds
}
