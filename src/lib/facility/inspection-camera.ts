import { Box3, Matrix4, Mesh, OrthographicCamera, PerspectiveCamera, Vector3, type Object3D } from "three"
import type { FacilityBounds, FacilityCamera, FacilityView } from "@/types/facility"
import type { FacilityModel } from "./asset-runtime"
import { projectedFacilityBounds } from "./render-framing"
import { createRackMotion, rackTarget } from "./rack-motion"

export type FacilityRuntimeCamera = OrthographicCamera | PerspectiveCamera
export type CameraFrame = {
  position: Vector3; target: Vector3; left: number; right: number; top: number; bottom: number; fitWidth: number; fitHeight: number
  projection?: "orthographic" | "perspective"; fov?: number; aspect?: number; near?: number; far?: number
  /** Camera-oriented subject corners, relative to target. Allocated only when views change. */
  fitPoints?: Float64Array; fitPadding?: number; direction?: Vector3
}
export const isPerspectiveFrame = (frame: CameraFrame) => frame.projection === "perspective"
export const compatibleCameraFrames = (from: CameraFrame, to: CameraFrame) => isPerspectiveFrame(from) === isPerspectiveFrame(to)
export function isObjectVisible(object: Object3D): boolean { for (let node: Object3D | null = object; node; node = node.parent) if (!node.visible) return false; return true }

export function applySpecimenPose(model: FacilityModel, view: FacilityView) {
  if (view.kind !== "specimen" || !model.metadata.specimen) return
  if (model.metadata.specimen.rackMotion) {
    createRackMotion(model.metadata.specimen.rackMotion, model.ids).setTarget(rackTarget(view), true)
    model.scene.updateMatrixWorld(true); updateLedAnchors(model)
    return
  }
  for (const transform of model.metadata.specimen.poses[view.pose].transforms) {
    const object = model.ids.get(transform.id)!
    object.position.fromArray(transform.position); object.visible = transform.visible
  }
  model.scene.updateMatrixWorld(true)
  updateLedAnchors(model)
}

const ledInstance = new Matrix4(), ledInverse = new Matrix4(), ledHidden = new Matrix4().makeScale(0, 0, 0)
export function updateLedAnchors(model: FacilityModel) {
  ledInverse.copy(model.scene.matrixWorld).invert()
  for (const [index, anchor] of model.ledAnchors.entries()) {
    ledInstance.multiplyMatrices(ledInverse, anchor.matrixWorld)
    model.leds.setMatrixAt(index, isObjectVisible(anchor) ? ledInstance : ledHidden)
  }
  model.leds.instanceMatrix.needsUpdate = true
  model.leds.computeBoundingSphere()
}

function subjectBox(bounds: FacilityBounds) { return new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max)) }

/** View changes may inspect authored metadata; the frame loop never searches the scene. */
export function inspectionCamera(model: FacilityModel, view: FacilityView, width: number, height: number, mobile = width < 640): CameraFrame {
  const inspection = model.profile.inspection
  let profile: FacilityCamera = mobile && view.kind === "overview" && inspection?.mobile ? inspection.mobile : model.profile
  let subset: Box3 | null = view.kind === "overview" && inspection ? subjectBox(inspection.fitSubjects.overview) : null
  if (view.kind === "specimen" && model.metadata.specimen) {
    const motion = model.metadata.specimen.rackMotion
    const detail = view.detail === "service-connection" ? motion?.serviceDetail : undefined
    if (view.detail && (!detail || view.specimen !== "rack" || !view.rack?.cutaway || view.rack.door !== "open" || view.rack.tray !== "extended")) throw new Error("camera_service_state")
    profile = detail?.camera ?? motion?.camera ?? model.metadata.specimen.poses[view.pose].camera
    if (motion) subset = subjectBox(detail?.fitBounds ?? motion.fitBounds)
  }
  else if (view.kind === "overview" && view.detail && inspection) {
    profile = inspection.details[view.detail]
    if (view.detail === "air-path") subset = subjectBox(inspection.fitSubjects["air-path"])
    else {
      const topology = model.metadata.topology
      const rack = topology?.equipment.find(item => item.id === view.equipmentId && topology.ecosystem?.racks.some(rack => rack.equipmentId === item.id))
        ?? topology?.equipment.find(item => item.id === "rack-02")
        ?? topology?.equipment.find(item => topology.ecosystem?.racks.some(rack => rack.equipmentId === item.id))
      if (!rack) throw new Error("camera_rack_subject")
      subset = subjectBox(rack.bounds)
      const target = subset.getCenter(new Vector3()), offset = new Vector3(...profile.camera).sub(new Vector3(...profile.target))
      profile = { ...profile, camera: target.clone().add(offset).toArray(), target: target.toArray() }
    }
  } else if (view.kind === "overview" && view.system && model.metadata.topology) {
    subset = new Box3()
    for (const equipment of model.metadata.topology.equipment) if (equipment.system === view.system) subset.union(subjectBox(equipment.bounds))
    if (!subset.isEmpty()) {
      const target = subset.getCenter(new Vector3()), offset = new Vector3(...profile.camera).sub(new Vector3(...profile.target))
      profile = { camera: target.clone().add(offset).toArray(), target: target.toArray(), padding: 1.12 }
    } else subset = null
  }
  const position = new Vector3(...profile.camera), target = new Vector3(...profile.target)
  let projected
  let fitPoints: Float64Array | undefined
  if (subset) {
    const rotation = new Matrix4().lookAt(position, target, new Vector3(0, 1, 0)).invert()
    projected = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity }
    fitPoints = new Float64Array(24)
    const point = new Vector3()
    for (let i = 0; i < 8; i++) {
      point.set(i & 1 ? subset.max.x : subset.min.x, i & 2 ? subset.max.y : subset.min.y, i & 4 ? subset.max.z : subset.min.z).sub(target).applyMatrix4(rotation)
      point.toArray(fitPoints, i * 3)
      projected.left = Math.min(projected.left, point.x); projected.right = Math.max(projected.right, point.x)
      projected.bottom = Math.min(projected.bottom, point.y); projected.top = Math.max(projected.top, point.y)
    }
  } else projected = projectedFacilityBounds(model, profile)
  if (profile.projection === "perspective" && !fitPoints) throw new Error("camera_perspective_subject")
  const frame: CameraFrame = {
    position, target, ...projected, fitWidth: (projected.right - projected.left) * profile.padding, fitHeight: (projected.top - projected.bottom) * profile.padding,
    projection: profile.projection ?? "orthographic", fov: profile.fov, near: .1, far: 150,
    ...(profile.projection === "perspective" ? { fitPoints, fitPadding: profile.padding, direction: position.clone().sub(target).normalize() } : {}),
  }
  return refitCameraFrame(frame, width, height)
}

/** Retain content extents separately from viewport padding so repeated resizes never accumulate zoom. */
export function refitCameraFrame(frame: CameraFrame, width: number, height: number): CameraFrame {
  const aspect = Math.max(1, width) / Math.max(1, height)
  frame.aspect = aspect
  if (isPerspectiveFrame(frame)) {
    if (!frame.fitPoints || !frame.direction || !frame.fov) throw new Error("camera_perspective_frame")
    const tangent = Math.tan(frame.fov * Math.PI / 360), padding = frame.fitPadding ?? 1.12
    let distance = .1, maximumZ = -Infinity, minimumZ = Infinity
    for (let index = 0; index < frame.fitPoints.length; index += 3) {
      const x = frame.fitPoints[index], y = frame.fitPoints[index + 1], z = frame.fitPoints[index + 2]
      // Every corner must fit at its own depth; a flat FOV/width approximation clips near corners.
      distance = Math.max(distance, z + padding * Math.abs(x) / (tangent * aspect), z + padding * Math.abs(y) / tangent)
      maximumZ = Math.max(maximumZ, z); minimumZ = Math.min(minimumZ, z)
    }
    distance = Math.max(distance, maximumZ + .1)
    frame.position.copy(frame.direction).multiplyScalar(distance).add(frame.target)
    frame.near = Math.max(.01, Math.min(.1, (distance - maximumZ) * .5))
    frame.far = Math.max(150, (distance - minimumZ) * 2)
    return frame
  }
  const x = (frame.left + frame.right) / 2, y = (frame.bottom + frame.top) / 2
  const halfHeight = Math.max(frame.fitHeight / 2, frame.fitWidth / (2 * aspect))
  frame.left = x - halfHeight * aspect; frame.right = x + halfHeight * aspect
  frame.top = y + halfHeight; frame.bottom = y - halfHeight
  return frame
}

export function applyCameraFrame(camera: FacilityRuntimeCamera, frame: CameraFrame) {
  if ((camera instanceof PerspectiveCamera) !== isPerspectiveFrame(frame)) throw new Error("camera_projection_mismatch")
  // R3F updates cameras on DPR changes as well as resizes; authored framing owns both.
  ;(camera as FacilityRuntimeCamera & { manual?: boolean }).manual = true
  camera.position.copy(frame.position); camera.lookAt(frame.target)
  camera.near = frame.near ?? .1; camera.far = frame.far ?? 150; camera.zoom = 1
  if (camera instanceof PerspectiveCamera) { camera.fov = frame.fov!; camera.aspect = frame.aspect! }
  else { camera.left = frame.left; camera.right = frame.right; camera.top = frame.top; camera.bottom = frame.bottom }
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true)
}

/** A staging camera is never installed or shared with the usable scene. */
export function createCameraForFrame(frame: CameraFrame): FacilityRuntimeCamera {
  const camera = isPerspectiveFrame(frame) ? new PerspectiveCamera() : new OrthographicCamera()
  applyCameraFrame(camera, frame)
  return camera
}
export function copyCameraFrame(frame: CameraFrame): CameraFrame { return { ...frame, position: frame.position.clone(), target: frame.target.clone(), direction: frame.direction?.clone() } }
export function interpolateCamera(from: CameraFrame, to: CameraFrame, weight: number, output: CameraFrame = copyCameraFrame(from)): CameraFrame {
  // Projection changes are intentional cuts; interpolating unlike frusta produces invalid coverage.
  if (!compatibleCameraFrames(from, to)) weight = 1
  output.position.lerpVectors(from.position, to.position, weight); output.target.lerpVectors(from.target, to.target, weight)
  output.left = from.left + (to.left - from.left) * weight; output.right = from.right + (to.right - from.right) * weight
  output.top = from.top + (to.top - from.top) * weight; output.bottom = from.bottom + (to.bottom - from.bottom) * weight
  output.fitWidth = from.fitWidth + (to.fitWidth - from.fitWidth) * weight; output.fitHeight = from.fitHeight + (to.fitHeight - from.fitHeight) * weight
  output.projection = to.projection; output.fov = to.fov; output.aspect = to.aspect; output.near = Math.min(from.near ?? .1, to.near ?? .1); output.far = Math.max(from.far ?? 150, to.far ?? 150)
  output.fitPoints = to.fitPoints; output.fitPadding = to.fitPadding; output.direction = to.direction
  return output
}

/** Face identities are authored per corner, so a hit cannot drift to another batch member. */
export function inspectionHit(model: FacilityModel, object: Object3D, vertex: number) {
  if (!(object instanceof Mesh) || !isObjectVisible(object)) return null
  const route = object.geometry.getAttribute("_gn_route_id")?.getX(vertex) ?? -1
  if (route >= 0 && model.metadata.topology) {
    const item = model.metadata.topology.routes[Math.round(route)]
    if (item) return { system: item.system, routeId: item.id }
  }
  const equipment = object.geometry.getAttribute("_gn_equipment_id")?.getX(vertex) ?? -1
  if (equipment >= 0) {
    if (model.metadata.specimen) {
      const part = model.metadata.specimen.parts[Math.round(equipment)]
      if (part) return { system: model.metadata.specimen.system, partId: part.id }
    }
    const item = model.metadata.topology?.equipment[Math.round(equipment)]
    if (item) return { system: item.system, equipmentId: item.id }
  }
  const system = model.pickSystems.get(object)
  return system ? { system } : null
}
