import { assessmentLinks, assessmentSelectionHref } from "@/lib/assessment/selectors"
import { isPublicTopic, type PublicTopic } from "@/lib/public-topic"
import type { AssessmentRecord, AssessmentSelection } from "@/types/assessment"
import { FACILITY_SYSTEMS, type FacilityInspectionTarget, type FacilityVisualRelease, type FacilityView } from "@/types/facility"

type SearchInput = URLSearchParams | Record<string, string | string[] | undefined>
function single(search: SearchInput, key: string) {
  const values = search instanceof URLSearchParams ? search.getAll(key) : search[key]
  return Array.isArray(values) ? values.length === 1 ? values[0] : undefined : values
}
export function resolveFacilityFocus(search: SearchInput, release: FacilityVisualRelease | null): FacilityInspectionTarget | null {
  const value = single(search, "focus")
  const system = FACILITY_SYSTEMS.find(system => system === value)
  if (system) return { system }
  const equipment = release?.equipmentIndex?.equipment.find(item => item.id === value)
  return equipment ? { system: equipment.system, equipmentId: equipment.id } : null
}
export function resolveFacilityTopic(search: SearchInput): PublicTopic | undefined {
  const topic = single(search, "topic")
  return isPublicTopic(topic) ? topic : undefined
}
export function facilityFocusKey(target: FacilityInspectionTarget | null) { return target?.equipmentId ?? target?.system ?? "" }
export function facilitySelectionHref(selection: Extract<AssessmentSelection, { status: "ready" }>, target: FacilityInspectionTarget | null, topic?: PublicTopic) {
  const url = new URL(assessmentSelectionHref(selection), "https://gridninja.invalid")
  if (target) url.searchParams.set("focus", facilityFocusKey(target))
  if (topic) url.searchParams.set("topic", topic)
  return `${url.pathname}${url.search}${url.hash}`
}

export type FacilityDestination = { label: string; href: string; status: "published" | "publication-pending"; purpose: string }
/** Named destinations only. Selection itself never navigates or calculates a result. */
export function facilityDestinations(record: AssessmentRecord, topic: PublicTopic, source: "home-decision-brief" | "demo-inspection-room" = "demo-inspection-room"): { principal: FacilityDestination; related: FacilityDestination[] } {
  const links = assessmentLinks(record)
  const next = `/assessment?${new URLSearchParams({ topic, source })}#scope`
  const context = topic === "ai-cloud" || topic === "workloads" ? { label: "AI workload assessment", href: "/solutions/ai-cloud" }
    : topic === "colocation" ? { label: "Tenant capacity assessment", href: "/solutions/colocation" }
      : { label: "Evidence and authority boundaries", href: "/proof" }
  return {
    principal: { label: "Scope an assessment", href: next, status: "published", purpose: "Carry this editable public topic into a scoping conversation." },
    related: [
      { ...context, status: "published", purpose: "Read the context for this capacity decision." },
      { label: "Read this versioned decision brief", href: links.brief, status: "published", purpose: "Inspect the exact assessment publication." },
    ],
  }
}

/** Classifies authored rows from bounds; this is an explanation cue, not a raycast. */
export function facilityObscuredRackDetail(release: FacilityVisualRelease, view: FacilityView) {
  if (view.kind !== "overview" || view.detail !== "rack" || !release.profile.inspection) return null
  const rack = release.equipmentIndex?.equipment.find(item => item.id === view.equipmentId && item.system === "workloads" && item.role === "server_rack")
  if (!rack) return null
  const camera = release.profile.inspection.details.rack
  const dx = camera.camera[0] - camera.target[0], dz = camera.camera[2] - camera.target[2]
  const axis = Math.abs(dx) > Math.abs(dz) ? 0 : 2
  const side = axis === 0 ? 2 : 0
  const towardCamera = axis === 0 ? dx : dz
  if (!towardCamera) return null
  const obscuredByForwardRow = release.equipmentIndex!.equipment.some(other => {
    if (other.id === rack.id || other.system !== "workloads" || other.role !== "server_rack") return false
    const overlapsColumn = Math.min(other.bounds.max[side], rack.bounds.max[side]) > Math.max(other.bounds.min[side], rack.bounds.min[side])
    const overlapsHeight = Math.min(other.bounds.max[1], rack.bounds.max[1]) > Math.max(other.bounds.min[1], rack.bounds.min[1])
    const separateForwardRow = towardCamera > 0 ? other.bounds.min[axis] > rack.bounds.max[axis] : other.bounds.max[axis] < rack.bounds.min[axis]
    return overlapsColumn && overlapsHeight && separateForwardRow
  })
  return obscuredByForwardRow ? rack : null
}
