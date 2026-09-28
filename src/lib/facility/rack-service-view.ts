import type { FacilityView } from "@/types/facility"

export const isRackServiceDetail = (view: FacilityView | null | undefined) => view?.kind === "specimen" && view.specimen === "rack" && view.detail === "service-connection"

/** Checked at command boundaries, before any scene, camera or joint mutation.
 * The close-up requires actual settled joints, not merely a requested endpoint. */
export function rackServiceCommandError(
  requested: FacilityView, current: FacilityView, pending: FacilityView | null,
  joints: { door: number; tray: number; moving: boolean } | null, supported: boolean,
): string | null {
  if (requested.kind !== "specimen") return null
  if (requested.detail && (requested.specimen !== "rack" || !supported)) return "This assembly does not provide a service connection close-up."
  if (requested.specimen !== "rack") return null
  const focused = isRackServiceDetail(current) || isRackServiceDetail(pending)
  const target = requested.rack ?? { door: requested.pose === "service" ? "open" : "closed", tray: requested.pose === "service" ? "extended" : "retracted", cutaway: requested.pose === "cutaway" }
  if (requested.detail || focused) {
    if (target.door !== "open" || target.tray !== "extended" || !target.cutaway) return "Return to the whole assembly before moving its parts."
    if (!joints || joints.moving || joints.door !== 1 || joints.tray !== 1 || pending) return "Wait for the assembly and camera to finish before inspecting the service connection."
  }
  return null
}
