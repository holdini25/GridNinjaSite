import { selectAssessment } from "@/lib/assessment/selectors"
import type { AssessmentRecord } from "@/types/assessment"
import type { FacilityInspectionTarget, FacilityPresentationCommand, FacilitySystem, FacilityTopology, FacilityTraceSegment } from "@/types/facility"

export const ECOSYSTEM_CHAPTER_SECONDS = [4, 4, 5, 4, 4, 3] as const
export const ECOSYSTEM_DEFAULT_RACK = "rack-02"
export const ECOSYSTEM_STORY_SCOPE = "Illustrative sequence · 24 seconds of presentation, not simulated facility time. Motion does not calculate capacity, temperature or flow."

/** A rack is an inspection anchor. No portion of the facility request is allocated to it. */
export function ecosystemRepresentativeRack(target: FacilityInspectionTarget | null, topology?: FacilityTopology) {
  const selected = topology?.equipment.find(item => item.id === target?.equipmentId && item.role === "server_rack")
  return selected?.id ?? ECOSYSTEM_DEFAULT_RACK
}

export function ecosystemRackLabel(rackId: string, topology?: FacilityTopology) {
  return topology?.equipment.find(item => item.id === rackId)?.label ?? (rackId === ECOSYSTEM_DEFAULT_RACK ? "Rack 03" : "Representative rack")
}

export type EcosystemDiagramPresentation = { equipmentId: string; routes: FacilityTraceSegment[]; systems: FacilitySystem[] }

/** Match the runtime's authored itinerary, including partial shared busways.
 * This is a presentation overlay; committed equipment selection remains separate. */
export function ecosystemDiagramPresentation(command: Pick<FacilityPresentationCommand, "chapter" | "rackId" | "coolingEvidence">, topology?: FacilityTopology): EcosystemDiagramPresentation | null {
  if (command.chapter === null || !topology?.ecosystem) return null
  const rack = topology.ecosystem.racks.find(item => item.equipmentId === command.rackId)
  if (!rack) return null
  const cooling = command.coolingEvidence === "available"
  const segments = command.chapter === 1 ? rack.electrical : command.chapter === 2 && cooling ? [...rack.exhaust, ...rack.coolingSupply, ...rack.coolingReturn] : command.chapter === 3 ? [...rack.electrical, ...(cooling ? [...rack.coolingSupply, ...rack.coolingReturn] : [])] : []
  const routes = new Map<string, FacilityTraceSegment>(), systems = new Set<FacilitySystem>(["workloads"])
  const authored = new Map(topology.routes.map(route => [route.id, route]))
  for (const segment of segments) {
    const route = authored.get(segment.routeId)
    if (!route || route.medium === "reserve-illustrative") continue
    const previous = routes.get(route.id)
    routes.set(route.id, { routeId: route.id, fromS: Math.min(segment.fromS, segment.toS, previous?.fromS ?? 1), toS: Math.max(segment.fromS, segment.toS, previous?.toS ?? 0) })
    systems.add(route.system)
  }
  return { equipmentId: rack.equipmentId, routes: [...routes.values()], systems: [...systems] }
}

/** Narrative quantities come only from the validated assessment, never presentation time. */
export function ecosystemNarrative(record: AssessmentRecord) {
  const view = selectAssessment(record)
  const cooling = record.evidence.find(item => item.id === "cooling")
  const missingCooling = !cooling || cooling.status === "missing"
  const electrical = record.evidence.find(item => item.id === "electrical")
  const storage = "Independent storage capacity, contribution and dispatchability are unassessed. No reserve duration or discharge is modeled."
  return {
    identity: `${record.publication.id}@${record.publication.version}`,
    missingCooling,
    links: view.links,
    storage,
    comparison: record.revisedProfile ? { requested: view.requested, revised: view.revised, question: record.commercial.question } : null,
    chapters: [
      { id: "request", title: "Request", body: `${view.requested} requested for the whole facility, additional to the ${view.reference} reference. ${view.interval}. The highlighted rack represents where a workload depends on equipment; no share of this increment is assigned to that rack.`, evidence: "Workload placement, ramp and transitions are not modeled in this assessment." },
      { id: "electrical", title: "Electrical path", body: "Follow the representative rack’s authored feed to its row busway and electrical source. Neighboring rack feeds remain separate. These connections describe construction, not equipment ratings or available capacity.", evidence: electrical?.detail ?? "Electrical evidence is not supplied in this record." },
      { id: "cooling", title: "Air and cooling", body: missingCooling ? "Cooling evidence is missing for this assessment window. Playback stops here: illustrated hardware cannot fill that evidence gap. Continue manually to read the unknown result and its publication." : "The illustrative air path passes through the rack, rear exhaust chimney and warm return plenum to the cooling assembly. Heat transfers across the coil to a separate water circuit; cooled air returns through the room. Presentation timing does not represent a cooling response delay.", evidence: cooling?.detail ?? "No cooling evidence is supplied for this fixture’s assessment window." },
      { id: "conditions", title: "Governing conditions", body: missingCooling ? "The modeled increment is unknown. No attribution chart or favorable capacity conclusion is available until the missing cooling evidence is resolved." : "The sequential attribution accounts for authored electrical reserve, cooling margin, service reserve and evidence margin. These ordered reductions are not independent equipment bounds, and they do not identify a single limiting asset.", evidence: storage },
      { id: "screening", title: "Screening result", body: `Model screen: ${view.screeningOutcome}. ${view.modeled} modeled eligible increment. ${view.conclusion}`, evidence: record.commercial.question },
      { id: "evidence", title: "Evidence", body: `Read fixture ${record.scenario.toUpperCase()}, publication v${record.publication.version}, for this exact result and its assumptions. All inputs are synthetic; economics are unestimated. No site action is authorized.`, evidence: "Accepted and delivered capacity are not applicable. The visual adds no operating authority." },
    ] as const,
  }
}
