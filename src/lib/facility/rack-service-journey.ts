import type { FacilityView } from "@/types/facility"
import { isRackServiceDetail } from "./rack-service-view"

/** Presentation history only. Actual joints and camera readiness stay in the session. */
export type RackServiceJourney = { detailSeen: boolean; hasExtended: boolean }
export const INITIAL_RACK_JOURNEY: RackServiceJourney = { detailSeen: false, hasExtended: false }
export function rackState(view: FacilityView) {
  if (view.kind !== "specimen" || view.specimen !== "rack") return null
  return view.rack ?? { door: view.pose === "service" ? "open" as const : "closed" as const, tray: view.pose === "service" ? "extended" as const : "retracted" as const, cutaway: view.pose === "cutaway" }
}
export function commitRackJourney(previous: RackServiceJourney, view: FacilityView): RackServiceJourney {
  const rack = rackState(view)
  if (!rack || rack.door === "closed") return INITIAL_RACK_JOURNEY
  if (rack.tray === "retracted") return { detailSeen: false, hasExtended: previous.hasExtended }
  return { detailSeen: previous.detailSeen || isRackServiceDetail(view), hasExtended: true }
}
export type RackServiceAction = "open" | "extend" | "inspect" | "return" | "retract" | "close"
export function nextRackServiceAction(view: FacilityView, journey: RackServiceJourney): RackServiceAction {
  const rack = rackState(view)
  if (isRackServiceDetail(view)) return "return"
  if (!rack || rack.door === "closed") return "open"
  if (rack.tray === "extended") return journey.detailSeen ? "retract" : "inspect"
  return journey.hasExtended ? "close" : "extend"
}
export function rackPendingLabel(active: FacilityView, requested: FacilityView) {
  const previous = rackState(active), next = rackState(requested)
  if (!previous || !next) return "Preparing rack assembly…"
  if (isRackServiceDetail(requested)) return "Inspecting service connection…"
  if (isRackServiceDetail(active)) return "Returning to whole assembly…"
  if (next.tray !== previous.tray) return next.tray === "extended" ? "Extending server tray…" : "Retracting server tray…"
  if (next.door !== previous.door) return next.door === "open" ? "Opening door…" : "Closing door…"
  if (next.cutaway !== previous.cutaway) return next.cutaway ? "Revealing interior…" : "Restoring side panel…"
  return "Preparing rack assembly…"
}
