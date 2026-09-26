import { selectAssessment } from "@/lib/assessment/selectors"
import type { AssessmentRecord } from "@/types/assessment"
import type { FacilityInspectionTarget, FacilitySceneMetadata, FacilitySystem } from "@/types/facility"

export const FACILITY_LABELS: Record<FacilitySystem, string> = { power: "Power", cooling: "Cooling", storage: "Storage", workloads: "Workloads" }

const V3_EQUIPMENT: Record<FacilitySystem, string> = {
  power: "Shown: three switchgear cabinets at left.",
  cooling: "Shown: four cooling units behind the racks.",
  storage: "Shown: two reserve cabinets at right.",
  workloads: "Shown: twelve server racks in two rows of six.",
}

/** Geometry labels belong to this authored release, never to assessment quantities. */
export function facilityEquipmentIdentification(release: string, system: FacilitySystem, metadata?: FacilitySceneMetadata) {
  if (metadata?.specimen) {
    return metadata.specimen.system === system
      ? `Shown: a representative illustrative ${metadata.specimen.kind === "rack" ? "rack" : "cooling"} assembly.`
      : null
  }
  if (metadata?.topology) {
    const names = metadata.topology.equipment.filter(item => item.system === system).map(item => item.label)
    return names.length ? `Shown: ${names.join("; ")}.` : null
  }
  return release === "facility-v3" ? V3_EQUIPMENT[system] : null
}

export function facilitySystemDescription(record: AssessmentRecord, system: FacilitySystem) {
  const view = selectAssessment(record)
  switch (system) {
    case "power":
      return { label: "Electrical boundary", body: `${record.basis.meterBoundary}. ${record.evidence.find(item => item.id === "electrical")?.detail ?? "Electrical evidence is not supplied in this record."}` }
    case "cooling": {
      const evidence = record.evidence.find(item => item.id === "cooling")
      return { label: evidence?.status === "missing" ? "Cooling evidence missing" : "Cooling evidence", body: evidence?.detail ?? "Cooling evidence is not supplied in this record." }
    }
    case "storage":
      return { label: "Illustrative reserve equipment", body: "Independent storage capacity and dispatchability are unassessed. Contribution and duration unassessed. These cabinets illustrate equipment relationships; they do not establish a capacity result." }
    case "workloads":
      return { label: "Workload under review", body: `${view.requested} requested. ${record.revisedProfile ? `${view.revised} proposed revision. ` : ""}${record.minimumViableIncrementKW !== null ? `${view.minimumViable} stated minimum. ` : ""}${record.commercial.question}` }
  }
}

export function facilityWindowLabel(record: AssessmentRecord) {
  const minutes = (Date.parse(record.basis.endUTC) - Date.parse(record.basis.startUTC)) / 60_000
  return minutes === 60 ? "1-hour window" : `${minutes}-minute window`
}

/** The walkthrough reads existing selectors; it creates no additional numerical model. */
export function facilityWalkthrough(record: AssessmentRecord) {
  const view = selectAssessment(record)
  const electrical = facilitySystemDescription(record, "power")
  const cooling = facilitySystemDescription(record, "cooling")
  return [
    { id: "request", title: "Request", system: "workloads", body: `${view.requested} requested, additional to the ${view.reference} reference. ${view.interval}. ${record.revisedProfile ? `${view.revised} proposed revision.` : "No proposed revision is recorded."}` },
    { id: "conditions", title: "Conditions", system: "power", body: "Read the authored electrical and cooling evidence alongside the sequential attribution. The illustrated equipment does not calculate these quantities.", evidence: [{ system: "power", ...electrical }, { system: "cooling", ...cooling }] },
    { id: "screening", title: "Screening result", system: null, body: `Model screen: ${view.screeningOutcome}. ${view.modeled} modeled eligible increment. ${view.conclusion} ${record.commercial.question}` },
    { id: "evidence", title: "Evidence", system: null, body: `Inspect the immutable publication for fixture ${record.scenario.toUpperCase()}, version ${record.publication.version}. These files use the same authoritative assessment record.`, links: view.links },
  ] as const
}


/** Adjacent authored connections only; no operational dependency or bound is inferred. */
export function facilityTargetConnections(metadata: FacilitySceneMetadata, target: FacilityInspectionTarget | null): { label: string; target: FacilityInspectionTarget }[] {
  if (!target) return []
  if (target.partId && metadata.specimen) {
    const parts = new Map(metadata.specimen.parts.map(part => [part.id, part]))
    const part = parts.get(target.partId)
    return (part?.connections ?? []).flatMap(id => { const connected = parts.get(id); return connected ? [{ label: connected.label, target: { system: metadata.specimen!.system, partId: id } }] : [] })
  }
  const topology = metadata.topology
  if (!topology) return []
  const equipment = new Map(topology.equipment.map(item => [item.id, item]))
  const ports = new Map(topology.ports.map(port => [port.id, port]))
  const connections = new Map<string, { label: string; target: FacilityInspectionTarget }>()
  for (const route of topology.routes) {
    const from = ports.get(route.from), to = ports.get(route.to)
    if (!from || !to) continue
    if (route.id === target.routeId) {
      for (const id of [from.equipmentId, to.equipmentId]) { const item = equipment.get(id); if (item) connections.set(id, { label: item.label, target: { system: item.system, equipmentId: id } }) }
    } else if (target.equipmentId && (from.equipmentId === target.equipmentId || to.equipmentId === target.equipmentId)) {
      const otherId = from.equipmentId === target.equipmentId ? to.equipmentId : from.equipmentId
      const item = equipment.get(otherId)
      if (item) connections.set(route.id, { label: `${route.service.replaceAll("_", " ")} ${topology.schemaVersion === "facility-topology.v2" ? "·" : "→"} ${item.label}`, target: { system: route.system, routeId: route.id } })
    }
  }
  return [...connections.values()]
}
