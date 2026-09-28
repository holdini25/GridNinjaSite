import type { FacilityBounds, FacilityEquipmentIndex, FacilityRenderProfile, FacilityTopology } from "@/types/facility"

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
function sameBounds(actual: unknown, expected: FacilityBounds): boolean {
  if (!object(actual)) return false
  return (["min", "max"] as const).every(key => Array.isArray(actual[key]) && actual[key].length === 3 && actual[key].every((value: unknown, axis: number) => typeof value === "number" && Number.isFinite(value) && Math.abs(value - expected[key][axis]) <= .000001))
}

/** Check profile/public metadata against the downloaded asset before any view can use it. */
export function validateInspectionContract(profile: FacilityRenderProfile, topology: FacilityTopology | undefined, publicIndex: FacilityEquipmentIndex | undefined, presentation: unknown) {
  if (!profile.inspection) return
  if (!topology || !publicIndex || publicIndex.equipment.length !== topology.equipment.length) throw new Error("camera_equipment_index")
  const authored = new Map(topology.equipment.map(item => [item.id, item]))
  const seen = new Set<string>()
  for (const entry of publicIndex.equipment) {
    const source = authored.get(entry.id)
    if (!source || seen.has(entry.id) || entry.system !== source.system || entry.label !== source.label || entry.role !== source.role || !sameBounds(entry.bounds, source.bounds)) throw new Error("camera_equipment_index")
    seen.add(entry.id)
  }
  const parsed: unknown = typeof presentation === "string" ? JSON.parse(presentation) : presentation
  if (!object(parsed) || parsed.version !== 1 || !object(parsed.fitSubjects)) throw new Error("camera_fit_subjects")
  for (const key of ["overview", "air-path"] as const) {
    if (!sameBounds(parsed.fitSubjects[key], profile.inspection.fitSubjects[key])) throw new Error("camera_fit_subjects")
  }
}
