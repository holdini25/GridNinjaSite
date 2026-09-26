import { FACILITY_SYSTEMS, type FacilityInspectionTarget, type FacilitySceneMetadata, type FacilitySpecimenMetadata, type FacilityTopology } from "@/types/facility"

const finiteVector = (value: unknown, count = 3): boolean => Array.isArray(value) && value.length === count && value.every(Number.isFinite)
const boundedArray = (value: unknown): value is unknown[] => Array.isArray(value) && value.length <= 512
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 160
const bounds = (value: unknown): boolean => record(value) && finiteVector(value.min) && finiteVector(value.max) && (value.min as number[]).every((n, i) => n <= (value.max as number[])[i])
function read(value: unknown): unknown { return typeof value === "string" ? JSON.parse(value) : value }
function unique(items: { id: string; index?: number }[], indexed = false) { return new Set(items.map(item => item.id)).size === items.length && items.every((item, index) => text(item.id) && (!indexed || item.index === index)) }

export function parseTopology(value: unknown): FacilityTopology {
  const data = read(value)
  if (!record(data) || !["facility-topology.v1", "facility-topology.v2"].includes(String(data.schemaVersion)) || !boundedArray(data.equipment) || !boundedArray(data.ports) || !boundedArray(data.routes) || !boundedArray(data.internalLinks)) throw new Error("topology_schema")
  const topology = data as FacilityTopology
  if (!topology.equipment.length || !topology.ports.length || !topology.routes.length) throw new Error("topology_empty_connections")
  if (!unique(topology.equipment, true) || !unique(topology.ports) || !unique(topology.routes, true)) throw new Error("topology_id")
  const equipment = new Set(topology.equipment.map(item => item.id)), ports = new Map(topology.ports.map(item => [item.id, item]))
  for (const item of topology.equipment) if (!FACILITY_SYSTEMS.includes(item.system) || !bounds(item.bounds) || !finiteVector(item.diagram, 2) || !text(item.label) || !text(item.role)) throw new Error("topology_equipment")
  for (const port of topology.ports) if (!equipment.has(port.equipmentId) || !finiteVector(port.position) || !text(port.service)) throw new Error("topology_port")
  for (const route of topology.routes) {
    if (!FACILITY_SYSTEMS.includes(route.system) || !ports.has(route.from) || !ports.has(route.to) || !boundedArray(route.path) || route.path.length < 2 || !route.path.every(point => finiteVector(point)) || !(route.lengthMetres > 0 && Number.isFinite(route.lengthMetres))) throw new Error("topology_route")
    for (const [point, port] of [[route.path[0], ports.get(route.from)!], [route.path.at(-1)!, ports.get(route.to)!]] as const) if (Math.hypot(...point.map((axis, index) => axis - port.position[index])) > .001) throw new Error("topology_termination")
    let length = 0
    for (let i = 1; i < route.path.length; i++) length += Math.hypot(...route.path[i].map((axis, index) => axis - route.path[i - 1][index]))
    if (Math.abs(length - route.lengthMetres) > .001 || !text(route.service) || ports.get(route.from)!.service !== route.service || ports.get(route.to)!.service !== route.service) throw new Error("topology_route_service_length")
  }
  for (const link of topology.internalLinks) if (!ports.has(link.from) || !ports.has(link.to) || ports.get(link.from)!.equipmentId !== ports.get(link.to)!.equipmentId || ports.get(link.from)!.service !== ports.get(link.to)!.service) throw new Error("topology_internal_link")
  if (topology.schemaVersion === "facility-topology.v2") validateEcosystemTopology(topology)
  else if (topology.ecosystem !== undefined) throw new Error("topology_legacy_ecosystem")
  return topology
}

/** V2 describes authored transport and explicit same-medium transformations.
 * Thermal exchange and open room air never become traversable fluid edges. */
function validateEcosystemTopology(topology: FacilityTopology) {
  const data = topology.ecosystem
  if (!data || topology.equipment.length > 96 || topology.routes.length > 128 || !boundedArray(data.branches) || !boundedArray(data.passages) || !boundedArray(data.openAirDomains) || !boundedArray(data.thermalCouplings) || !boundedArray(data.racks) || !boundedArray(data.sections)) throw new Error("ecosystem_schema")
  const equipment = new Map(topology.equipment.map(item => [item.id, item])), ports = new Map(topology.ports.map(item => [item.id, item])), routes = new Map(topology.routes.map(item => [item.id, item]))
  const media = ["electrical", "air", "water", "reserve-illustrative"]
  for (const port of topology.ports) if (!media.includes(port.medium!) || !text(port.role)) throw new Error("ecosystem_port")
  for (const route of topology.routes) if (!media.includes(route.medium!) || !["forward", "reverse", "none"].includes(route.direction!) || ports.get(route.from)!.medium !== route.medium || ports.get(route.to)!.medium !== route.medium) throw new Error("ecosystem_route_medium")
  for (const link of topology.internalLinks) if (ports.get(link.from)!.medium !== ports.get(link.to)!.medium) throw new Error("ecosystem_internal_medium")
  const pointAt = (route: FacilityTopology["routes"][number], distance: number) => {
    let remaining = distance * route.lengthMetres
    for (let index = 1; index < route.path.length; index++) {
      const a = route.path[index - 1], b = route.path[index], length = Math.hypot(...b.map((value, axis) => value - a[axis]))
      if (remaining <= length || index === route.path.length - 1) return a.map((value, axis) => value + (b[axis] - value) * Math.min(1, remaining / length))
      remaining -= length
    }
    return route.path[0]
  }
  const near = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((value, axis) => value - b[axis])) <= .01
  const branchKeys = new Set<string>()
  for (const branch of data.branches) {
    const port = ports.get(branch.portId), route = routes.get(branch.routeId), key = `${branch.portId}/${branch.routeId}`
    if (!port || !route || branchKeys.has(key) || !Number.isFinite(branch.s) || branch.s < 0 || branch.s > 1 || port.medium !== route.medium || !near(port.position, pointAt(route, branch.s))) throw new Error("ecosystem_branch")
    branchKeys.add(key)
  }
  if (!unique(data.passages) || !unique(data.openAirDomains) || !unique(data.thermalCouplings)) throw new Error("ecosystem_identity")
  for (const passage of data.passages) {
    const from = ports.get(passage.from), to = ports.get(passage.to)
    if (!equipment.has(passage.equipmentId) || !from || !to || from.equipmentId !== passage.equipmentId || to.equipmentId !== passage.equipmentId || from.medium !== passage.medium || to.medium !== passage.medium || !boundedArray(passage.path) || passage.path.length < 2 || !passage.path.every(point => finiteVector(point)) || !near(passage.path[0], from.position) || !near(passage.path.at(-1)!, to.position)) throw new Error("ecosystem_passage")
    let length = 0
    for (let i = 1; i < passage.path.length; i++) length += Math.hypot(...passage.path[i].map((axis, index) => axis - passage.path[i - 1][index]))
    if (!(length > 0) || !Number.isFinite(passage.lengthMetres) || Math.abs(length - passage.lengthMetres) > .001) throw new Error("ecosystem_passage_length")
  }
  const passages = new Map(data.passages.map(passage => [passage.id, passage]))
  for (const coupling of data.thermalCouplings) {
    const air = passages.get(coupling.airPassage), water = passages.get(coupling.waterPassage)
    if (!air || !water || air.medium !== "air" || water.medium !== "water" || air.equipmentId !== coupling.equipmentId || water.equipmentId !== coupling.equipmentId) throw new Error("ecosystem_thermal_coupling")
  }
  for (const domain of data.openAirDomains) {
    if (!text(domain.label) || !boundedArray(domain.inlets) || !boundedArray(domain.outlets) || !domain.inlets.length || !domain.outlets.length || new Set([...domain.inlets, ...domain.outlets]).size !== domain.inlets.length + domain.outlets.length || [...domain.inlets, ...domain.outlets].some(id => ports.get(id)?.medium !== "air")) throw new Error("ecosystem_open_air")
  }
  const rackIds = new Set<string>(), leds = new Set<number>()
  for (const rack of data.racks) {
    if (equipment.get(rack.equipmentId)?.system !== "workloads" || rackIds.has(rack.equipmentId) || !Array.isArray(rack.ledIndices) || rack.ledIndices.length !== 4 || !Array.isArray(rack.fanIndices) || !rack.fanIndices.length || new Set(rack.fanIndices).size !== rack.fanIndices.length || rack.fanIndices.some(index => !Number.isInteger(index) || index < 0 || index >= 4)) throw new Error("ecosystem_rack")
    rackIds.add(rack.equipmentId)
    for (const index of rack.ledIndices) { if (!Number.isInteger(index) || index < 0 || index >= 48 || leds.has(index)) throw new Error("ecosystem_led"); leds.add(index) }
    let coolingEquipment: string | undefined
    for (const [name, medium] of [["electrical", "electrical"], ["exhaust", "air"], ["coolingSupply", "water"], ["coolingReturn", "water"]] as const) {
      const itinerary = rack[name]
      if (!Array.isArray(itinerary) || !itinerary.length || itinerary.length > 128) throw new Error("ecosystem_itinerary")
      let prior: number[] | null = null, first: number[] | null = null
      for (const segment of itinerary) {
        const route = routes.get(segment.routeId)
        if (!route || route.medium !== medium || !Number.isFinite(segment.fromS) || !Number.isFinite(segment.toS) || Math.min(segment.fromS, segment.toS) < 0 || Math.max(segment.fromS, segment.toS) > 1 || segment.fromS === segment.toS || route.direction === "none" || (route.direction === "forward" ? segment.fromS > segment.toS : segment.fromS < segment.toS)) throw new Error("ecosystem_itinerary_direction")
        const start = pointAt(route, segment.fromS), end = pointAt(route, segment.toS)
        first ??= start
        if (prior && !near(prior, start)) throw new Error("ecosystem_itinerary_continuity")
        for (const s of [segment.fromS, segment.toS]) if (s > .00001 && s < .99999 && !data.branches.some(branch => branch.routeId === route.id && Math.abs(branch.s - s) < .0001)) throw new Error("ecosystem_itinerary_branch")
        prior = end
      }
      const rackPorts = topology.ports.filter(port => port.equipmentId === rack.equipmentId)
      if (name === "electrical" && !rackPorts.some(port => port.medium === "electrical" && near(port.position, prior!))) throw new Error("ecosystem_itinerary_rack_endpoint")
      if (name === "exhaust" && !rackPorts.some(port => port.medium === "air" && port.service === "air-return" && near(port.position, first!))) throw new Error("ecosystem_itinerary_rack_endpoint")
      if (name === "exhaust") {
        coolingEquipment = topology.ports.find(port => port.medium === "air" && port.service === "air-return" && equipment.get(port.equipmentId)?.role === "heat_exchanger" && near(port.position, prior!))?.equipmentId
        if (!coolingEquipment) throw new Error("ecosystem_itinerary_cooler_endpoint")
      }
      if (name === "coolingSupply" || name === "coolingReturn") {
        const coolerEnd = name === "coolingSupply" ? prior! : first!
        if (!topology.ports.some(port => port.medium === "water" && port.equipmentId === coolingEquipment && near(port.position, coolerEnd))) throw new Error("ecosystem_itinerary_cooler_endpoint")
      }
    }
  }
  if (data.racks.length !== 12 || leds.size !== 48 || data.sections.length !== 1 || data.sections[0].id !== "air-path" || !data.sections[0].coverIds.length || data.sections[0].coverIds.length > 8 || data.sections[0].coverIds.some(id => !text(id)) || new Set(data.sections[0].coverIds).size !== data.sections[0].coverIds.length) throw new Error("ecosystem_bindings")
}

export function parseSpecimen(value: unknown): FacilitySpecimenMetadata {
  const data = read(value)
  if (!record(data) || data.schemaVersion !== "facility-specimen.v1" || !["rack", "cooling"].includes(String(data.kind)) || !FACILITY_SYSTEMS.includes(data.system as never) || !boundedArray(data.parts) || !record(data.poses)) throw new Error("specimen_schema")
  const specimen = data as FacilitySpecimenMetadata
  if (specimen.parts.length < 4 || specimen.parts.length > 6) throw new Error("specimen_part_count")
  if (!unique(specimen.parts, true)) throw new Error("specimen_part_id")
  const objects = new Set(specimen.parts.map(part => part.objectId))
  if (objects.size !== specimen.parts.length) throw new Error("specimen_object_id")
  const partIds = new Set(specimen.parts.map(part => part.id))
  for (const part of specimen.parts) if (!bounds(part.bounds) || !text(part.label) || !text(part.role) || !text(part.objectId) || !boundedArray(part.connections) || !part.connections.every(item => partIds.has(item))) throw new Error("specimen_part")
  for (const name of ["closed", "cutaway", "service"] as const) {
    const pose = specimen.poses[name]
    if (!pose || !finiteVector(pose.camera?.camera) || !finiteVector(pose.camera?.target) || !Number.isFinite(pose.camera.padding) || pose.camera.padding < 1 || !boundedArray(pose.transforms) || pose.transforms.length !== objects.size || new Set(pose.transforms.map(item => item.id)).size !== objects.size) throw new Error("specimen_pose")
    for (const transform of pose.transforms) if (!objects.has(transform.id) || !finiteVector(transform.position) || typeof transform.visible !== "boolean") throw new Error("specimen_pose_transform")
  }
  const motion = specimen.rackMotion
  if (motion !== undefined) {
    if (!record(motion) || motion.version !== 1 || specimen.kind !== "rack" || !record(motion.door) || !record(motion.tray) || !objects.has(motion.door.objectId) || !objects.has(motion.tray.objectId) || motion.door.objectId === motion.tray.objectId) throw new Error("specimen_rack_motion")
    for (const quaternion of [motion.door.closed, motion.door.open]) if (!finiteVector(quaternion, 4) || Math.abs(Math.hypot(...quaternion) - 1) > .0001) throw new Error("specimen_door_quaternion")
    const angle = 2 * Math.acos(Math.min(1, Math.abs(motion.door.closed.reduce((sum, value, index) => sum + value * motion.door.open[index], 0))))
    if (Math.abs(angle - 110 * Math.PI / 180) > .001) throw new Error("specimen_door_sweep")
    // V1's clearance proof covers the outward local -Y hinge, not every
    // quaternion with the same unsigned angle. q and -q remain equivalent.
    const [cx, cy, cz, cw] = motion.door.closed, [ox, oy, oz, ow] = motion.door.open
    const sign = cx * ox + cy * oy + cz * oz + cw * ow < 0 ? -1 : 1
    const rx = (-cx * ow + cw * ox - cy * oz + cz * oy) * sign
    const ry = (-cy * ow + cw * oy - cz * ox + cx * oz) * sign
    const rz = (-cz * ow + cw * oz - cx * oy + cy * ox) * sign
    if (Math.abs(rx) > .0001 || Math.abs(rz) > .0001 || Math.abs(ry + Math.sin(55 * Math.PI / 180)) > .0001) throw new Error("specimen_door_axis")
    if (!finiteVector(motion.tray.retracted) || !finiteVector(motion.tray.extended) || motion.tray.extended.some((value, index) => Math.abs(value - motion.tray.retracted[index] - (index === 2 ? .18 : 0)) > .0001)) throw new Error("specimen_tray_travel")
    if (!Array.isArray(motion.cutawayObjectIds) || !motion.cutawayObjectIds.length || motion.cutawayObjectIds.length > 4 || new Set(motion.cutawayObjectIds).size !== motion.cutawayObjectIds.length || motion.cutawayObjectIds.some(id => !objects.has(id) || id === motion.door.objectId || id === motion.tray.objectId)) throw new Error("specimen_cutaway_parts")
    if (!bounds(motion.fitBounds) || motion.fitBounds.min.some((value, index) => value >= motion.fitBounds.max[index]) || !finiteVector(motion.camera?.camera) || !finiteVector(motion.camera?.target) || !Number.isFinite(motion.camera.padding) || motion.camera.padding < 1 || (motion.camera.projection !== undefined && motion.camera.projection !== "orthographic")) throw new Error("specimen_motion_camera")
    if (!Array.isArray(motion.anchors) || motion.anchors.length !== 2 || new Set(motion.anchors.map(anchor => anchor.id)).size !== 2 || motion.anchors.some(anchor => !["door", "tray"].includes(anchor.id) || anchor.objectId !== motion[anchor.id].objectId || !finiteVector(anchor.position))) throw new Error("specimen_motion_anchors")
    const detail = motion.serviceDetail
    if (detail !== undefined) {
      if (!record(detail) || detail.version !== 1 || detail.requiresCutaway !== true || !bounds(detail.fitBounds) || detail.fitBounds.min.some((value, index) => value >= detail.fitBounds.max[index]) || !finiteVector(detail.camera?.camera) || !finiteVector(detail.camera?.target) || !Number.isFinite(detail.camera.padding) || detail.camera.padding !== 1.12 || (detail.camera.projection !== undefined && detail.camera.projection !== "orthographic") || detail.camera.camera.every((value, index) => value === detail.camera.target[index])) throw new Error("specimen_service_camera")
      if (!Array.isArray(detail.partIds) || detail.partIds.length < 2 || detail.partIds.length > 3 || new Set(detail.partIds).size !== detail.partIds.length || detail.partIds.some(id => !partIds.has(id)) || !specimen.parts.some(part => part.objectId === motion.tray.objectId && detail.partIds.includes(part.id))) throw new Error("specimen_service_parts")
      if (detail.fitBounds.min.some((value, index) => value < motion.fitBounds.min[index]) || detail.fitBounds.max.some((value, index) => value > motion.fitBounds.max[index])) throw new Error("specimen_service_bounds")
    }
  }
  return specimen
}

export function createTopologyIndex(metadata: FacilitySceneMetadata) {
  const topology = metadata.topology
  const equipment = new Map(topology?.equipment.map(item => [item.id, item]) ?? [])
  const routes = new Map(topology?.routes.map(item => [item.id, item]) ?? [])
  const ports = new Map(topology?.ports.map(item => [item.id, item]) ?? [])
  const portIndices = new Map([...ports.keys()].map((id, index) => [id, index]))
  const portList = [...ports.values()]
  const adjacency = portList.map(() => [] as { port: number; route: number }[])
  const connect = (from: string, to: string, route: number) => {
    const a = portIndices.get(from)!, b = portIndices.get(to)!
    adjacency[a].push({ port: b, route }); adjacency[b].push({ port: a, route })
  }
  for (const route of routes.values()) connect(route.from, route.to, route.index)
  for (const link of topology?.internalLinks ?? []) connect(link.from, link.to, -1)
  for (const passage of topology?.ecosystem?.passages ?? []) connect(passage.from, passage.to, -1)
  const traverse = (seeds: string[]) => {
    const seen = new Uint8Array(portList.length), queue = new Uint16Array(portList.length), selectedRoutes = new Set<number>(), selectedEquipment = new Set<number>()
    let head = 0, tail = 0
    for (const id of seeds) { const index = portIndices.get(id); if (index !== undefined && !seen[index]) { seen[index] = 1; queue[tail++] = index } }
    while (head < tail) {
      const index = queue[head++]
      selectedEquipment.add(equipment.get(portList[index].equipmentId)!.index)
      for (const edge of adjacency[index]) {
        if (edge.route >= 0) selectedRoutes.add(edge.route)
        if (!seen[edge.port]) { seen[edge.port] = 1; queue[tail++] = edge.port }
      }
    }
    return { equipment: [...selectedEquipment], routes: [...selectedRoutes] }
  }
  return {
    equipment, routes, ports,
    resolve(target: FacilityInspectionTarget | null | undefined): { equipment: number[]; routes: number[] } {
      if (!target) return { equipment: [], routes: [] }
      if (metadata.specimen) {
        const parts = metadata.specimen.parts
        return { equipment: target.partId ? parts.filter(part => part.id === target.partId).map(part => part.index) : parts.map(part => part.index), routes: [] }
      }
      if (target.routeId) {
        const route = routes.get(target.routeId)
        return route ? traverse([route.from, route.to]) : { equipment: [], routes: [] }
      }
      if (target.equipmentId) {
        const item = equipment.get(target.equipmentId)
        if (!item) return { equipment: [], routes: [] }
        const connected = traverse(portList.filter(port => port.equipmentId === item.id).map(port => port.id))
        if (!connected.equipment.includes(item.index)) connected.equipment.push(item.index)
        return connected
      }
      return { equipment: [...equipment.values()].filter(item => item.system === target.system).map(item => item.index), routes: [...routes.values()].filter(item => item.system === target.system).map(item => item.index) }
    },
  }
}
