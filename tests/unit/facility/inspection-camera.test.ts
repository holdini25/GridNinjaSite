import { describe, expect, it } from "vitest"
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Vector3 } from "three"
import type { FacilityModel } from "@/lib/facility/asset-runtime"
import type { FacilityBounds, FacilityCamera, FacilityRenderProfile, FacilityTopology, FacilitySpecimenMetadata } from "@/types/facility"
import { applyCameraFrame, compatibleCameraFrames, copyCameraFrame, createCameraForFrame, inspectionCamera, interpolateCamera, refitCameraFrame } from "@/lib/facility/inspection-camera"

const rackBounds: FacilityBounds = { min: [-.39, .2, -.62], max: [.39, 2.75, .62] }
const shiftedBounds: FacilityBounds = { min: [2.61, .2, -.62], max: [3.39, 2.75, .62] }
const detail: FacilityCamera = { camera: [2.8, 2.4, 5], target: [0, 1.55, 0], padding: 1.12, projection: "perspective", fov: 32 }
const profile = {
  camera: [12, 10, 15], target: [0, 1, 0], padding: 1.12,
  inspection: {
    version: 1, fitSubjects: { overview: { min: [-5, 0, -4], max: [5, 4, 4] }, "air-path": { min: [-3, 1, -3], max: [4, 4, 1.5] } },
    mobile: { camera: [12, 10, 15], target: [.25, 1, 0], padding: 1.14, projection: "orthographic" },
    details: { rack: detail, "air-path": { ...detail, camera: [9, 8, 9], target: [.35, 2.25, -.85] } },
  },
} as FacilityRenderProfile
function fixture() {
  const scene = new Group(), geometry = new BoxGeometry(1, 2, 1), material = new MeshBasicMaterial()
  scene.add(new Mesh(geometry, material))
  const context = new Mesh(geometry, material); context.position.x = 80; scene.add(context)
  const equipment = [rackBounds, shiftedBounds].map((bounds, index) => ({ id: index ? "rack-05" : "rack-02", index, label: `Rack ${index}`, system: "workloads", role: "rack", diagram: [index, 0], bounds }))
  const topology = { schemaVersion: "facility-topology.v2", equipment, ecosystem: { racks: equipment.map(item => ({ equipmentId: item.id })) } } as FacilityTopology
  const model = { scene, profile, metadata: { topology }, fans: [] } as unknown as FacilityModel
  return { model, context, dispose: () => { geometry.dispose(); material.dispose() } }
}
function assertFit(bounds: FacilityBounds, camera: PerspectiveCamera | OrthographicCamera, padding = 1.12) {
  for (let index = 0; index < 8; index++) {
    const p = new Vector3(index & 1 ? bounds.max[0] : bounds.min[0], index & 2 ? bounds.max[1] : bounds.min[1], index & 4 ? bounds.max[2] : bounds.min[2]).project(camera)
    expect(Math.abs(p.x)).toBeLessThanOrEqual(1 / padding + 1e-8)
    expect(Math.abs(p.y)).toBeLessThanOrEqual(1 / padding + 1e-8)
    expect(p.z).toBeGreaterThan(-1); expect(p.z).toBeLessThan(1)
  }
}

describe("authored v7 projections", () => {
  it("fits the authored tray, rails and service-connector region at mobile size without changing the whole assembly frame", () => {
    const { model, dispose } = fixture()
    const serviceBounds: FacilityBounds = { min: [-.345, 1.34, -.46], max: [.375, 1.62, .80] }
    model.metadata.specimen = { kind: "rack", rackMotion: {
      camera: { camera: [3, 3, 5], target: [0, 1.4, 0], padding: 1.12 }, fitBounds: { min: [-1.2, 0, -.65], max: [1.2, 2.75, 1.6] },
      serviceDetail: { version: 1, camera: { camera: [2.2, 2.35, 1.55], target: [.015, 1.48, .17], padding: 1.12 }, fitBounds: serviceBounds, partIds: ["tray", "frame", "power"], requiresCutaway: true },
    } } as FacilitySpecimenMetadata
    const whole = { kind: "specimen", specimen: "rack", pose: "service", rack: { door: "open", tray: "extended", cutaway: true } } as const
    try {
      const original = inspectionCamera(model, whole, 390, 427)
      const close = inspectionCamera(model, { ...whole, detail: "service-connection" }, 390, 427)
      expect(close.fitHeight).toBeLessThan(original.fitHeight)
      expect(close.target.toArray()).toEqual([.015, 1.48, .17])
      for (const [width, height] of [[320, 427], [390, 427], [1020, 600], [844, 390]]) {
        const camera = createCameraForFrame(refitCameraFrame(close, width, height)) as OrthographicCamera
        assertFit(serviceBounds, camera)
        // These are actual parked-plug and moving-inlet centers; both remain in the frame.
        for (const p of [[.335, 1.478, -.365], [.304, 1.478, -.134]]) {
          const projected = new Vector3(...p).project(camera)
          expect(Math.abs(projected.x)).toBeLessThan(1); expect(Math.abs(projected.y)).toBeLessThan(1)
        }
      }
      expect(inspectionCamera(model, whole, 390, 427)).toEqual(original)
      expect(() => inspectionCamera(model, { ...whole, rack: { ...whole.rack, cutaway: false }, detail: "service-connection" }, 390, 427)).toThrow("camera_service_state")
      delete model.metadata.specimen.rackMotion!.serviceDetail
      expect(() => inspectionCamera(model, { ...whole, detail: "service-connection" }, 390, 427)).toThrow("camera_service_state")
    } finally { dispose() }
  })
  it("excludes batched architectural context from overview fitting", () => {
    const { model, context, dispose } = fixture()
    try {
      const before = inspectionCamera(model, { kind: "overview" }, 720, 424, false)
      context.position.set(1000, 1000, 1000)
      const after = inspectionCamera(model, { kind: "overview" }, 720, 424, false)
      expect(after).toEqual(before)
      expect(createCameraForFrame(after)).toBeInstanceOf(OrthographicCamera)
    } finally { dispose() }
  })
  it("fits actual near and far corners at 32 degrees across aspect changes without accumulated zoom", () => {
    const { model, dispose } = fixture()
    try {
      const frame = inspectionCamera(model, { kind: "overview", detail: "rack" }, 720, 424)
      expect(frame.target.toArray()).toEqual([0, 1.475, 0])
      const initial = frame.position.clone(), camera = createCameraForFrame(frame) as PerspectiveCamera
      expect(camera).toBeInstanceOf(PerspectiveCamera); expect(camera.fov).toBe(32)
      for (const [width, height] of [[340, 255], [320, 800], [800, 320], [720, 424]]) {
        applyCameraFrame(camera, refitCameraFrame(frame, width, height))
        expect(camera.aspect).toBeCloseTo(width / height)
        assertFit(rackBounds, camera)
      }
      expect(frame.position.distanceTo(initial)).toBeLessThan(1e-9)
      const selected = inspectionCamera(model, { kind: "overview", detail: "rack", equipmentId: "rack-05" }, 340, 255)
      expect(selected.target.x).toBe(3)
      assertFit(shiftedBounds, createCameraForFrame(selected) as PerspectiveCamera)
      expect(inspectionCamera(model, { kind: "overview", detail: "rack", equipmentId: "unknown" }, 340, 255).target.x).toBe(0)
    } finally { dispose() }
  })
  it("fits the complete section construction and applies responsive composition by viewport, not drawing buffer", () => {
    const { model, dispose } = fixture()
    try {
      const air = inspectionCamera(model, { kind: "overview", detail: "air-path" }, 340, 255, true)
      assertFit(profile.inspection!.fitSubjects["air-path"], createCameraForFrame(air) as PerspectiveCamera)
      expect(inspectionCamera(model, { kind: "overview" }, 680, 510, true).target.x).toBe(.25)
      expect(inspectionCamera(model, { kind: "overview" }, 340, 255, false).target.x).toBe(0)
    } finally { dispose() }
  })
  it("cuts projection changes, interpolates compatible details, and rejects applying the wrong camera type", () => {
    const { model, dispose } = fixture()
    try {
      const overview = inspectionCamera(model, { kind: "overview" }, 720, 424)
      const rack = inspectionCamera(model, { kind: "overview", detail: "rack" }, 720, 424)
      const air = inspectionCamera(model, { kind: "overview", detail: "air-path" }, 720, 424)
      expect(compatibleCameraFrames(overview, rack)).toBe(false)
      expect(interpolateCamera(overview, rack, .01).position.distanceTo(rack.position)).toBeLessThan(1e-9)
      expect(compatibleCameraFrames(rack, air)).toBe(true)
      const output = copyCameraFrame(rack)
      expect(interpolateCamera(rack, air, .5, output)).toBe(output)
      expect(output.position.distanceTo(rack.position.clone().lerp(air.position, .5))).toBeLessThan(1e-9)
      expect(() => applyCameraFrame(new OrthographicCamera(), rack)).toThrow("camera_projection_mismatch")
    } finally { dispose() }
  })
})
