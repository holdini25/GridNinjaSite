import { describe, expect, it, vi } from "vitest"
import { Group, OrthographicCamera, Quaternion } from "three"
import type { FacilityRackTarget, FacilitySpecimenMetadata } from "@/types/facility"
import { createRackMotion, rackTarget } from "@/lib/facility/rack-motion"
import { parseSpecimen } from "@/lib/facility/topology-runtime"
import { preflightFacilityGlb } from "@/lib/facility/asset-preflight"

const closed: FacilityRackTarget = { door: "closed", tray: "retracted", cutaway: false }
const extended: FacilityRackTarget = { door: "open", tray: "extended", cutaway: false }
function fixture() {
  const root = new Group(), door = new Group(), tray = new Group(), panel = new Group()
  door.position.set(-.377, 1.405, .657); root.add(door, tray, panel); root.updateMatrixWorld(true)
  const ids = new Map([["door", door], ["tray", tray], ["panel", panel]])
  const config: NonNullable<FacilitySpecimenMetadata["rackMotion"]> = {
    version: 1, door: { objectId: "door", closed: [0, 0, 0, 1], open: [0, -Math.sin(55 * Math.PI / 180), 0, Math.cos(55 * Math.PI / 180)] },
    tray: { objectId: "tray", retracted: [0, 0, 0], extended: [0, 0, .18] }, cutawayObjectIds: ["panel"],
    camera: { camera: [4, 3, 6], target: [0, 1.3, 0], padding: 1.12 }, fitBounds: { min: [-1.2, 0, -.65], max: [1.2, 2.6, 1.6] },
    anchors: [{ id: "door", objectId: "door", position: [.7, 0, 0] }, { id: "tray", objectId: "tray", position: [0, 1.2, .65] }],
  }
  return { root, door, tray, panel, ids, config, motion: createRackMotion(config, ids) }
}
const degrees = (q: Quaternion) => q.angleTo(new Quaternion()) * 180 / Math.PI

describe("rack joint sequencing", () => {
  it("opens a110degree hinge over420ms before extending the tray180mm over480ms", () => {
    const f = fixture(), pivot = f.door.position.clone()
    f.motion.setTarget(extended, false)
    f.motion.sample(.21, false); expect(degrees(f.door.quaternion)).toBeCloseTo(55); expect(f.tray.position.z).toBe(0)
    f.motion.sample(.21, false); expect(degrees(f.door.quaternion)).toBeCloseTo(110); expect(f.tray.position.z).toBe(0)
    f.motion.sample(.24, false); expect(f.tray.position.z).toBeCloseTo(.09)
    f.motion.sample(.24, false); expect(f.tray.position.z).toBeCloseTo(.18); expect(f.motion.moving).toBe(false)
    expect(f.door.position).toEqual(pivot)
  })
  it("retracts before closing and reverses the latest intent from current transforms", () => {
    const f = fixture(); f.motion.setTarget(extended, false); f.motion.sample(.66, false)
    expect(f.tray.position.z).toBeCloseTo(.09)
    const position = f.tray.position.clone(); f.motion.setTarget(closed, false); expect(f.tray.position).toEqual(position)
    f.motion.sample(.12, false); expect(f.tray.position.z).toBeCloseTo(.045); expect(degrees(f.door.quaternion)).toBeCloseTo(110)
    f.motion.sample(.12, false); expect(f.tray.position.z).toBe(0)
    f.motion.sample(.21, false); expect(degrees(f.door.quaternion)).toBeCloseTo(55)
    const rotation = f.door.quaternion.toArray(); f.motion.setTarget(extended, false); expect(f.door.quaternion.toArray()).toEqual(rotation)
    f.motion.sample(.105, false); expect(degrees(f.door.quaternion)).toBeCloseTo(82.5); expect(f.tray.position.z).toBe(0)
    f.motion.sample(.105, false); expect(degrees(f.door.quaternion)).toBeCloseTo(110)
    f.motion.sample(.48, false); expect(f.tray.position.z).toBeCloseTo(.18)
  })
  it("keeps cutaway independent and snaps immediately for motion preferences", () => {
    const f = fixture(); f.motion.setTarget({ ...extended, cutaway: true }, false); f.motion.sample(.1, false)
    expect(f.panel.visible).toBe(false); expect(f.motion.moving).toBe(true)
    f.motion.sample(0, true); expect(f.motion.moving).toBe(false); expect(f.tray.position.z).toBe(.18); expect(f.panel.visible).toBe(false)
    f.motion.setTarget({ ...extended, cutaway: false }, true); expect(f.panel.visible).toBe(true); expect(f.tray.position.z).toBe(.18)
    f.motion.setTarget(closed, true); expect(f.motion.closed).toBe(true); expect(f.door.quaternion.toArray()).toEqual([0, 0, 0, 1])
  })
  it("remains monotonic and cadence-independent at30/60/120Hz without hidden-time advance", () => {
    for (const fps of [30, 60, 120]) {
      const f = fixture(); f.motion.setTarget(extended, false)
      let lastDoor = 0, lastTray = 0
      for (let frame = 0; frame < fps; frame++) {
        f.motion.sample(1 / fps, false); const state = f.motion.snapshot()
        expect(state.door).toBeGreaterThanOrEqual(lastDoor); expect(state.tray).toBeGreaterThanOrEqual(lastTray)
        if (state.tray > 0) expect(state.door).toBe(1)
        lastDoor = state.door; lastTray = state.tray
      }
      expect(f.motion.snapshot()).toMatchObject({ door: 1, tray: 1, moving: false })
      f.motion.setTarget(closed, false); f.motion.sample(.1, false); const frozen = f.motion.snapshot()
      f.motion.sample(0, false); expect(f.motion.snapshot()).toEqual(frozen)
    }
  })
  it("projects stable handle buffers from the live joint without scene search", () => {
    const f = fixture(), camera = new OrthographicCamera(-3, 3, 3, -3, .1, 30)
    camera.position.set(0, 1, 10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true)
    const traverse = vi.spyOn(f.root, "traverse"), anchors = f.motion.project(camera), doorX = anchors[0].x
    f.motion.setTarget(extended, false); f.motion.sample(.21, false)
    expect(f.motion.project(camera)).toBe(anchors); expect(anchors[0].x).not.toBe(doorX); expect(anchors.every(anchor => anchor.visible)).toBe(true)
    expect(traverse).not.toHaveBeenCalled()
  })
  it("keeps legacy pose defaults and makes conflicting close commands safe", () => {
    expect(rackTarget({ kind: "specimen", specimen: "rack", pose: "service" })).toEqual(extended)
    expect(rackTarget({ kind: "specimen", specimen: "rack", pose: "cutaway" })).toEqual({ ...closed, cutaway: true })
    expect(rackTarget({ kind: "specimen", specimen: "rack", pose: "service", rack: { door: "closed", tray: "extended", cutaway: true } })).toEqual({ ...closed, cutaway: true })
  })
})

describe("optional rack motion metadata", () => {
  const metadata = () => {
    const { config } = fixture(), parts = ["door", "tray", "panel", "frame"].map((id, index) => ({ id, index, label: id, role: id, objectId: id, bounds: config.fitBounds, connections: [] }))
    const pose = { camera: config.camera, transforms: parts.map(part => ({ id: part.id, position: [0, 0, 0], visible: true })) }
    return { schemaVersion: "facility-specimen.v1", kind: "rack", system: "workloads", parts, poses: { closed: pose, service: pose, cutaway: pose }, rackMotion: config }
  }
  it("accepts legacy metadata and validated versioned rack tracks", () => {
    const data = metadata(); expect(parseSpecimen(data).rackMotion?.version).toBe(1)
    const { rackMotion: omitted, ...legacy } = data; expect(omitted.version).toBe(1); expect(parseSpecimen(legacy).rackMotion).toBeUndefined()
  })
  it("accepts bounded service-camera metadata and rejects malformed cameras, subjects and identities", () => {
    const withDetail = () => {
      const data = metadata()
      data.rackMotion.serviceDetail = { version: 1, camera: { ...data.rackMotion.camera, padding: 1.12 }, fitBounds: { min: [-.2, .3, -.2], max: [.2, 1.6, .2] }, partIds: ["tray", "frame"], requiresCutaway: true }
      return data
    }
    expect(parseSpecimen(withDetail()).rackMotion?.serviceDetail?.partIds).toEqual(["tray", "frame"])
    const badCamera = withDetail(); badCamera.rackMotion.serviceDetail!.camera.camera = [NaN, 3, 6]
    expect(() => parseSpecimen(badCamera)).toThrow("specimen_service_camera")
    const badPadding = withDetail(); badPadding.rackMotion.serviceDetail!.camera.padding = 1
    expect(() => parseSpecimen(badPadding)).toThrow("specimen_service_camera")
    const outside = withDetail(); outside.rackMotion.serviceDetail!.fitBounds.max[0] = 100
    expect(() => parseSpecimen(outside)).toThrow("specimen_service_bounds")
    for (const ids of [["tray", "tray"], ["frame", "door"], ["tray", "invented"], ["tray", "frame", "door", "panel"]]) {
      const invalid = withDetail(); invalid.rackMotion.serviceDetail!.partIds = ids
      expect(() => parseSpecimen(invalid)).toThrow("specimen_service_parts")
    }
  })
  it("preflights JSON-string Blender metadata before decoding the model", () => {
    const data = metadata()
    data.rackMotion.tray.extended = [0, 0, .3]
    const json = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" }, materials: [{}], nodes: [{ extras: { gnId: "GN_SPECIMEN_ROOT", gnSpecimen: JSON.stringify(data) } }] }))
    const length = Math.ceil(json.byteLength / 4) * 4, bytes = new Uint8Array(20 + length), header = new DataView(bytes.buffer)
    header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, bytes.byteLength, true)
    header.setUint32(12, length, true); header.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20); bytes.set(json, 20)
    expect(() => preflightFacilityGlb(bytes.buffer, ["GN_SPECIMEN_ROOT"], undefined, "rack")).toThrow("specimen_tray_travel")
  })
  it("rejects an invalid service camera in embedded metadata before any decoder runs", () => {
    const data = metadata()
    data.rackMotion.serviceDetail = { version: 1, camera: { ...data.rackMotion.camera, padding: 1 }, fitBounds: data.rackMotion.fitBounds, partIds: ["tray", "frame"], requiresCutaway: true }
    const json = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" }, materials: [{}], nodes: [{ extras: { gnId: "GN_SPECIMEN_ROOT", gnSpecimen: JSON.stringify(data) } }] }))
    const length = Math.ceil(json.byteLength / 4) * 4, bytes = new Uint8Array(20 + length), header = new DataView(bytes.buffer)
    header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, bytes.byteLength, true)
    header.setUint32(12, length, true); header.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20); bytes.set(json, 20)
    expect(() => preflightFacilityGlb(bytes.buffer, ["GN_SPECIMEN_ROOT"], undefined, "rack")).toThrow("specimen_service_camera")
  })
  it("rejects invalid sweeps, travel, overlapping roles and mismatched anchors", () => {
    const data = metadata(); data.rackMotion.door.open = [0, 0, 0, 1]; expect(() => parseSpecimen(data)).toThrow("specimen_door_sweep")
    const travel = metadata(); travel.rackMotion.tray.extended = [0, 0, .19]; expect(() => parseSpecimen(travel)).toThrow("specimen_tray_travel")
    const panel = metadata(); panel.rackMotion.cutawayObjectIds = ["door"]; expect(() => parseSpecimen(panel)).toThrow("specimen_cutaway_parts")
    const anchor = metadata(); anchor.rackMotion.anchors[0].objectId = "tray"; expect(() => parseSpecimen(anchor)).toThrow("specimen_motion_anchors")
    const rotation = metadata(); rotation.rackMotion.door.open = [0, 1, 0, 1]; expect(() => parseSpecimen(rotation)).toThrow("specimen_door_quaternion")
  })
  it("restricts version one to its validated outward hinge and forward tray while accepting equivalent quaternion signs", () => {
    const inward = metadata(); inward.rackMotion.door.open[1] *= -1
    expect(() => parseSpecimen(inward)).toThrow("specimen_door_axis")
    const tipping = metadata(); tipping.rackMotion.door.open[0] = tipping.rackMotion.door.open[1]; tipping.rackMotion.door.open[1] = 0
    expect(() => parseSpecimen(tipping)).toThrow("specimen_door_axis")
    const sideways = metadata(); sideways.rackMotion.tray.extended = [.18, 0, 0]
    expect(() => parseSpecimen(sideways)).toThrow("specimen_tray_travel")
    const rearward = metadata(); rearward.rackMotion.tray.extended = [0, 0, -.18]
    expect(() => parseSpecimen(rearward)).toThrow("specimen_tray_travel")
    const equivalent = metadata(); equivalent.rackMotion.door.open = equivalent.rackMotion.door.open.map(value => -value) as [number, number, number, number]
    expect(parseSpecimen(equivalent).rackMotion?.version).toBe(1)
  })
})
