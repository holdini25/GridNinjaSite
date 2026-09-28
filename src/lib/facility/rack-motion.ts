import { Quaternion, Vector3, type Camera, type Object3D } from "three"
import type { FacilityRackAnchor, FacilityRackTarget, FacilitySpecimenMetadata, FacilityView } from "@/types/facility"

type Motion = NonNullable<FacilitySpecimenMetadata["rackMotion"]>
const smooth = (value: number) => value * value * (3 - 2 * value)

export function rackTarget(view: FacilityView): FacilityRackTarget {
  const target: FacilityRackTarget = view.kind === "specimen" && view.rack ? view.rack : { door: view.kind === "specimen" && view.pose === "service" ? "open" : "closed", tray: view.kind === "specimen" && view.pose === "service" ? "extended" : "retracted", cutaway: view.kind === "specimen" && view.pose === "cutaway" }
  // A close command includes safe retraction. Extend commands explicitly open
  // the door in the presentation target; impossible joint pairs never execute.
  return { door: target.door, tray: target.door === "closed" ? "retracted" : target.tray, cutaway: target.cutaway }
}

/** Two bounded joint tracks, sharing the renderer's clock. All objects and
 * scratch vectors bind once; no frame-time scene search or allocations. */
export function createRackMotion(config: Motion, ids: ReadonlyMap<string, Object3D>) {
  const door = ids.get(config.door.objectId)!, tray = ids.get(config.tray.objectId)!
  const closed = new Quaternion(...config.door.closed), open = new Quaternion(...config.door.open)
  const retracted = new Vector3(...config.tray.retracted), extended = new Vector3(...config.tray.extended)
  const panels = config.cutawayObjectIds.map(id => ids.get(id)!)
  const anchors = config.anchors.map(anchor => ({ object: ids.get(anchor.objectId)!, position: new Vector3(...anchor.position) }))
  const projection: FacilityRackAnchor[] = config.anchors.map(anchor => ({ action: anchor.id, x: 0, y: 0, visible: false }))
  const scratch = new Vector3()
  let doorProgress = Math.min(1, closed.angleTo(door.quaternion) / closed.angleTo(open))
  const travel = scratch.copy(extended).sub(retracted), distanceSquared = travel.lengthSq()
  let trayProgress = Math.max(0, Math.min(1, (tray.position.x - retracted.x) * travel.x / distanceSquared + (tray.position.y - retracted.y) * travel.y / distanceSquared + (tray.position.z - retracted.z) * travel.z / distanceSquared))
  let targetDoor = doorProgress, targetTray = trayProgress, cutaway = panels.every(panel => !panel.visible)
  let track: "door" | "tray" | null = null, from = 0, to = 0, elapsed = 0, duration = 0, dirty = false
  const apply = () => {
    door.quaternion.slerpQuaternions(closed, open, doorProgress)
    tray.position.lerpVectors(retracted, extended, trayProgress)
    for (const panel of panels) panel.visible = !cutaway
    door.visible = tray.visible = true
    door.updateWorldMatrix(true, true); tray.updateWorldMatrix(true, true)
  }
  const plan = () => {
    const next = targetDoor === 0 && trayProgress > 0 ? "tray" : doorProgress !== targetDoor ? "door" : trayProgress !== targetTray ? "tray" : null
    if (!next) { track = null; return }
    const destination = next === "door" ? targetDoor : targetDoor === 0 ? 0 : targetTray
    if (track === next && to === destination) return
    track = next; from = next === "door" ? doorProgress : trayProgress; to = destination; elapsed = 0
    duration = (next === "door" ? .42 : .48) * Math.abs(to - from)
  }
  const snap = () => { doorProgress = targetDoor; trayProgress = targetTray; track = null; apply(); dirty = false }
  return {
    retainedBytes: 1536 + anchors.length * 160 + panels.length * 16,
    setTarget(target: FacilityRackTarget, immediate: boolean) {
      targetDoor = target.door === "open" ? 1 : 0; targetTray = targetDoor && target.tray === "extended" ? 1 : 0
      cutaway = target.cutaway; dirty = true
      if (immediate) { snap(); dirty = true }
      else { plan(); apply() }
    },
    sample(delta: number, immediate: boolean) {
      if (immediate) { const changed = track !== null || dirty; if (changed) snap(); return changed }
      let remaining = Math.max(0, delta), changed = dirty
      dirty = false
      // At most two sequential joints can finish, even after a delayed frame.
      for (let pass = 0; pass < 2 && track; pass++) {
        const step = Math.min(remaining, duration - elapsed)
        elapsed += step; remaining -= step
        const progress = duration ? Math.min(1, elapsed / duration) : 1, value = from + (to - from) * smooth(progress)
        if (track === "door") doorProgress = progress === 1 ? to : value
        else trayProgress = progress === 1 ? to : value
        changed = true
        if (progress < 1) break
        track = null; plan()
      }
      if (changed) apply()
      return changed
    },
    project(camera: Camera) {
      for (let index = 0; index < anchors.length; index++) {
        const anchor = anchors[index], result = projection[index]
        scratch.copy(anchor.position).applyMatrix4(anchor.object.matrixWorld).project(camera)
        result.x = (scratch.x + 1) / 2; result.y = (1 - scratch.y) / 2
        result.visible = scratch.z >= -1 && scratch.z <= 1 && result.x >= 0 && result.x <= 1 && result.y >= 0 && result.y <= 1
        for (let object: Object3D | null = anchor.object; object; object = object.parent) if (!object.visible) result.visible = false
      }
      return projection
    },
    get moving() { return track !== null },
    get closed() { return doorProgress === 0 && trayProgress === 0 && !cutaway && track === null },
    snapshot() { return { door: doorProgress, tray: trayProgress, cutaway, targetDoor, targetTray, moving: track !== null } },
  }
}
