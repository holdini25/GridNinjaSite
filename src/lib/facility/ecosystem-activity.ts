import type { FacilityEcosystemProfile, FacilityInspectionTarget, FacilityPresentationCheckpoint, FacilityPresentationCommand, FacilityTopology, FacilityTraceSegment } from "@/types/facility"

/** Pure, bounded v6 presentation primitives. These quantities never model capacity. */
export type EcosystemTraceSegment = { route: number; from: number; to: number; length: number; signal: number }
export type CompiledEcosystemTrace = { routes: Int16Array; from: Float32Array; to: Float32Array; ends: Float64Array; signals: Uint8Array; length: number }

/** Compile once during scene binding. Distances follow the actual rendered route. */
export function compileEcosystemTrace(segments: readonly EcosystemTraceSegment[]): CompiledEcosystemTrace {
  if (!segments.length || segments.length > 128) throw new Error("ecosystem_trace_segments")
  const count = segments.length, routes = new Int16Array(count), from = new Float32Array(count), to = new Float32Array(count), ends = new Float64Array(count), signals = new Uint8Array(count)
  let length = 0
  for (let index = 0; index < count; index++) {
    const segment = segments[index]
    if (!Number.isInteger(segment.route) || segment.route < 0 || segment.route >= 128 || ![segment.from, segment.to, segment.length].every(Number.isFinite) || segment.from < 0 || segment.from > 1 || segment.to < 0 || segment.to > 1 || segment.from === segment.to || segment.length <= 0 || !Number.isInteger(segment.signal) || segment.signal < 0 || segment.signal > 3) throw new Error("ecosystem_trace_segment")
    routes[index] = segment.route; from[index] = segment.from; to[index] = segment.to; signals[index] = segment.signal
    length += segment.length * Math.abs(segment.to - segment.from); ends[index] = length
  }
  return { routes, from, to, ends, signals, length }
}

/** Two fixed eight-float slots: route, position, lower bound, upper bound,
 * intensity, signal, direction, reserved. No temporary vectors or allocations. */
export function sampleEcosystemTrace(path: CompiledEcosystemTrace, progress: number, output: Float32Array, slot: 0 | 1, intensity = 1) {
  if (output.length !== 16 || !Number.isFinite(progress) || !Number.isFinite(intensity)) throw new Error("ecosystem_trace_output")
  const offset = slot * 8
  if (progress < 0 || progress > 1 || intensity <= 0) { output[offset] = -1; output[offset + 4] = 0; return }
  const distance = Math.min(path.length, progress * path.length)
  let low = 0, high = path.ends.length - 1
  while (low < high) { const middle = (low + high) >>> 1; if (distance > path.ends[middle]) low = middle + 1; else high = middle }
  const previous = low ? path.ends[low - 1] : 0, weight = (distance - previous) / (path.ends[low] - previous)
  output[offset] = path.routes[low]; output[offset + 1] = path.from[low] + (path.to[low] - path.from[low]) * weight
  output[offset + 2] = Math.min(path.from[low], path.to[low]); output[offset + 3] = Math.max(path.from[low], path.to[low])
  output[offset + 4] = Math.min(1, intensity); output[offset + 5] = path.signals[low]; output[offset + 6] = Math.sign(path.to[low] - path.from[low]); output[offset + 7] = 0
}

/** Integer hash makes sampling order-independent: seeking and delayed callbacks
 * give the same state, without replaying queued activity or allocating PRNGs. */
export function ecosystemHash(seed: number, index: number) {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad)
  value = Math.imul(value ^ value >>> 15, 0x735a2d97)
  return ((value ^ value >>> 15) >>> 0) / 4294967296
}

/** Rack-local activity uses existing four-lamp bindings: three activity lamps
 * and one steady lamp. At most three candidates can overlap, even after a seek. */
export function sampleEcosystemLeds(seconds: number, moving: boolean, seed: number, rack: number, output: Float32Array, resting = .12, steady = .5, peak = 1) {
  const count = output.length / 3
  for (let index = 0; index < count; index++) {
    const value = !moving || index % 4 === 3 ? steady : resting
    output[index * 3] = output[index * 3 + 1] = output[index * 3 + 2] = value
  }
  if (!moving || !Number.isFinite(seconds) || seconds < 0 || !Number.isInteger(rack) || rack < 0 || rack * 4 + 3 >= count) return
  const event = Math.floor(seconds / .13)
  for (let candidate = Math.max(0, event - 2); candidate <= event; candidate++) {
    const start = candidate * .13 + ecosystemHash(seed, candidate) * .04
    const duration = .12 + ecosystemHash(seed ^ 0x4172, candidate) * .06
    const phase = (seconds - start) / duration
    if (phase < 0 || phase >= 1) continue
    // A 3-slot cycle prevents consecutive events from retriggering the same lamp.
    const led = rack * 4 + candidate % 3, strength = resting + Math.sin(Math.PI * phase) ** 2 * (peak - resting)
    output[led * 3] = output[led * 3 + 1] = output[led * 3 + 2] = strength
  }
}


export type EcosystemOutputs = {
  equipment: Float32Array; routes: Float32Array; routeFrom: Float32Array; routeTo: Float32Array; heat: Float32Array; traces: Float32Array; fans: Float32Array; fanSeconds: Float64Array
  section: boolean; chapter: number | null; seconds: number; playing: boolean; rack: number
}

/** One controller owns all v6 presentation channels. It receives no assessment
 * quantities, and never evaluates temperatures, power, capacity or dispatch. */
export function createEcosystemActivity(topology: FacilityTopology, profile: FacilityEcosystemProfile, checkpoint: (value: FacilityPresentationCheckpoint) => void) {
  const ecosystem = topology.ecosystem
  if (topology.schemaVersion !== "facility-topology.v2" || !ecosystem || topology.equipment.length > profile.maxEquipment || topology.routes.length > profile.maxRoutes) throw new Error("ecosystem_binding")
  const equipment = new Map(topology.equipment.map(item => [item.id, item])), routes = new Map(topology.routes.map(item => [item.id, item]))
  const compile = (segments: FacilityTraceSegment[], signal: number) => compileEcosystemTrace(segments.map(segment => {
    const route = routes.get(segment.routeId)
    if (!route) throw new Error("ecosystem_missing_route")
    return { route: route.index, from: segment.fromS, to: segment.toS, length: route.lengthMetres, signal }
  }))
  const racks = ecosystem.racks.map(rack => ({ ...rack, index: equipment.get(rack.equipmentId)!.index, electricalPath: compile(rack.electrical, 0), exhaustPath: compile(rack.exhaust, 2), supplyPath: compile(rack.coolingSupply, 1), returnPath: compile(rack.coolingReturn, 1) }))
  const rackIndices = new Map(racks.map((rack, index) => [rack.equipmentId, index]))
  // Resolve cooling equipment through ports on an authored rack itinerary.
  // Sharing an enclosure, room or thermal medium never creates an edge.
  const coolingEquipmentRacks = new Int16Array(topology.equipment.length).fill(-1)
  const ports = new Map(topology.ports.map(port => [port.id, port]))
  const registerCoolingPort = (portId: string, rackIndex: number) => {
    const item = equipment.get(ports.get(portId)!.equipmentId)!
    if (item.system === "cooling" && coolingEquipmentRacks[item.index] < 0) coolingEquipmentRacks[item.index] = rackIndex
  }
  for (let rackIndex = 0; rackIndex < racks.length; rackIndex++) {
    const rack = racks[rackIndex]
    for (const itinerary of [rack.exhaust, rack.coolingSupply, rack.coolingReturn]) for (const segment of itinerary) {
      const route = routes.get(segment.routeId)!, from = Math.min(segment.fromS, segment.toS), to = Math.max(segment.fromS, segment.toS)
      if (from === 0) registerCoolingPort(route.from, rackIndex)
      if (to === 1) registerCoolingPort(route.to, rackIndex)
      for (const branch of ecosystem.branches) if (branch.routeId === route.id && branch.s >= from && branch.s <= to) registerCoolingPort(branch.portId, rackIndex)
    }
  }
  ports.clear()
  const bag = new Uint8Array(racks.length)
  for (let index = 0; index < bag.length; index++) bag[index] = index
  for (let index = bag.length - 1; index > 0; index--) { const other = Math.floor(ecosystemHash(profile.seed, index) * (index + 1)), value = bag[index]; bag[index] = bag[other]; bag[other] = value }
  const starts = new Float64Array(7)
  for (let index = 0; index < 6; index++) starts[index + 1] = starts[index] + profile.chapterSeconds[index]
  const output: EcosystemOutputs = { equipment: new Float32Array(topology.equipment.length), routes: new Float32Array(topology.routes.length), routeFrom: new Float32Array(topology.routes.length), routeTo: new Float32Array(topology.routes.length), heat: new Float32Array(topology.equipment.length), traces: new Float32Array(16), fans: new Float32Array(4).fill(1), fanSeconds: new Float64Array(4), section: false, chapter: null, seconds: 0, playing: false, rack: 0 }
  let revision = -1, seekRevision = -1, cooling = true, chapter: number | null = null, playing = false, cursor = 0, commandRack = 0
  const fanOffsets = new Float64Array(4), priorFanSeconds = new Float64Array(4)
  let fanRebase = false
  let inspectedRack = -1, inspectionSystem: FacilityInspectionTarget["system"] | null = null, inspectionAt = 0, inspectionSupported = true
  const emit = (reason?: FacilityPresentationCheckpoint["reason"]) => { if (chapter !== null) checkpoint({ revision, chapter, playing, ...(reason ? { reason } : {}) }) }
  const pathWeight = (path: CompiledEcosystemTrace, weight: number) => { for (let index = 0; index < path.routes.length; index++) {
    const route = path.routes[index]
    output.routes[route] = Math.max(output.routes[route], weight)
    output.routeFrom[route] = Math.min(output.routeFrom[route], path.from[index], path.to[index]); output.routeTo[route] = Math.max(output.routeTo[route], path.from[index], path.to[index])
  } }
  const trace = (path: CompiledEcosystemTrace, progress: number, slot: 0 | 1, weight = 1) => sampleEcosystemTrace(path, progress, output.traces, slot, weight)
  const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }
  const rampIntegral = (seconds: number, start: number, duration: number) => {
    const t = Math.max(0, Math.min(1, (seconds - start) / duration))
    return duration * (t * t * t - .5 * t * t * t * t) + Math.max(0, seconds - start - duration)
  }
  const fanIntegral = (seconds: number, rise: number, fall: number) => rampIntegral(seconds, rise, 2) - rampIntegral(seconds, fall, 2)
  const fanPrefix = new Uint16Array((bag.length + 1) * 4)
  for (let index = 0; index < bag.length; index++) for (let fan = 0; fan < 4; fan++) fanPrefix[(index + 1) * 4 + fan] = fanPrefix[index * 4 + fan] + Number(racks[bag[index]].fanIndices.includes(fan))
  const retainedBytes = bag.byteLength + starts.byteLength + fanPrefix.byteLength + fanOffsets.byteLength + priorFanSeconds.byteLength + coolingEquipmentRacks.byteLength + Object.values(output).reduce<number>((bytes, value) => bytes + (ArrayBuffer.isView(value) ? value.byteLength : 0), 0) + racks.reduce((bytes, rack) => bytes + [rack.electricalPath, rack.exhaustPath, rack.supplyPath, rack.returnPath].reduce((total, path) => total + path.routes.byteLength + path.from.byteLength + path.to.byteLength + path.ends.byteLength + path.signals.byteLength, 0), 0) + racks.length * 256 + (equipment.size + routes.size) * 64
  return {
    output, retainedBytes,
    command(command: FacilityPresentationCommand | undefined) {
      if (!command) { chapter = null; playing = false; return }
      if (!Number.isInteger(command.revision) || command.revision < 0 || !Number.isInteger(command.seekRevision) || command.seekRevision < 0 || !rackIndices.has(command.rackId) || (command.chapter !== null && (!Number.isInteger(command.chapter) || command.chapter < 0 || command.chapter > 5))) throw new Error("ecosystem_command")
      if (command.revision < revision) return
      const seek = command.seekRevision !== seekRevision
      revision = command.revision; cooling = command.coolingEvidence === "available"
      commandRack = rackIndices.get(command.rackId) ?? 0
      if (seek) { seekRevision = command.seekRevision; chapter = command.chapter; cursor = chapter === null ? 0 : starts[chapter]; fanRebase = chapter === null; if (chapter !== null) fanOffsets.fill(0) }
      playing = command.playing && chapter !== null
      if (!cooling && chapter !== null && chapter >= 2 && playing) { playing = false; emit("cooling-missing") }
    },
    focus(target: FacilityInspectionTarget | null | undefined, seconds: number) {
      inspectionSystem = target?.system ?? null; inspectedRack = target?.equipmentId ? rackIndices.get(target.equipmentId) ?? -1 : -1
      if (target?.equipmentId && inspectedRack < 0) {
        const item = equipment.get(target.equipmentId)
        if (item?.system === "cooling") inspectedRack = coolingEquipmentRacks[item.index]
      }
      inspectionSupported = !target?.equipmentId || inspectedRack >= 0
      if (target?.routeId) {
        inspectedRack = -1
        const route = routes.get(target.routeId)
        if (route) for (let index = 0; index < racks.length; index++) {
          const rack = racks[index]
          if (rack.electricalPath.routes.includes(route.index) || rack.exhaustPath.routes.includes(route.index) || rack.supplyPath.routes.includes(route.index) || rack.returnPath.routes.includes(route.index)) { inspectedRack = index; break }
        }
        inspectionSupported = inspectedRack >= 0
      }
      inspectionAt = seconds; fanRebase = chapter === null
    },
    sample(delta: number, activeSeconds: number, moving: boolean, leds: Float32Array, motionPermitted = moving) {
      priorFanSeconds.set(output.fanSeconds)
      output.equipment.fill(0); output.routes.fill(0); output.routeFrom.fill(1); output.routeTo.fill(0); output.heat.fill(0); output.traces.fill(0); output.traces[0] = output.traces[8] = -1; output.fans.fill(1); output.section = false
      if (playing && !motionPermitted) { playing = false; emit("motion-disabled") }
      if (playing && moving && delta > 0) {
        const previousChapter = chapter
        cursor = Math.min(starts[6], cursor + delta)
        if (cursor > starts[6] - 1e-9) cursor = starts[6]
        if (!cooling && cursor >= starts[2] && previousChapter !== null && previousChapter < 2) { cursor = starts[2]; chapter = 2; playing = false; emit("cooling-missing") }
        else {
          while (chapter !== null && chapter < 5 && cursor >= starts[chapter + 1]) chapter++
          if (cursor >= starts[6]) { playing = false; emit("complete") }
          else if (chapter !== previousChapter) emit()
        }
      }
      let rackIndex = commandRack, phase = -1, inspection = false
      if (chapter === null) {
        if (inspectionSystem) { rackIndex = inspectedRack < 0 ? commandRack : inspectedRack; phase = inspectionSupported ? (activeSeconds - inspectionAt) % 8 : -1; inspection = true }
        else {
          const mean = (profile.ambientIntervalSeconds[0] + profile.ambientIntervalSeconds[1]) / 2, jitter = (profile.ambientIntervalSeconds[1] - profile.ambientIntervalSeconds[0]) / 2
          const cycle = Math.floor(activeSeconds / mean)
          for (let candidate = Math.max(0, cycle - 2); candidate <= cycle; candidate++) {
            const start = (candidate + 1) * mean + ecosystemHash(profile.seed ^ 0x9031, candidate) * jitter
            const elapsed = activeSeconds - start
            if (elapsed >= 0 && elapsed < profile.sequenceSeconds) { phase = elapsed; rackIndex = bag[candidate % bag.length]; break }
          }
        }
      }
      const rack = racks[rackIndex], local = chapter === null ? phase : cursor - starts[chapter]
      // Activity anchors are authored; remap logical rack lamps to actual batch IDs.
      sampleEcosystemLeds(chapter === null ? activeSeconds : cursor, moving, profile.seed, 0, leds)
      const a = leds[0], b = leds[3], c = leds[6]
      for (let index = 0; index < leds.length / 3; index++) {
        const value = !moving || index % 4 === 3 ? .5 : .12
        leds[index * 3] = leds[index * 3 + 1] = leds[index * 3 + 2] = value
      }
      if (moving) {
        if (chapter === null && phase < 0 && (!inspectionSystem || !inspectionSupported)) rackIndex = bag[Math.floor(activeSeconds / 2.4) % bag.length]
        const activeRack = racks[rackIndex]
        for (let index = 0; index < 3; index++) { const led = activeRack.ledIndices[index], value = index === 0 ? a : index === 1 ? b : c; leds[led * 3] = leds[led * 3 + 1] = leds[led * 3 + 2] = value }
      }
      if (chapter !== null) {
        output.equipment[rack.index] = chapter < 3 ? .48 : .2
        if (chapter === 1) { pathWeight(rack.electricalPath, .45); if (moving) trace(rack.electricalPath, local / profile.chapterSeconds[1], 0) }
        if (chapter === 2 && cooling) {
          output.section = true; output.heat[rack.index] = .28 * smooth(local / 1.2)
          pathWeight(rack.exhaustPath, .35); pathWeight(rack.supplyPath, .2); pathWeight(rack.returnPath, .2)
          if (moving) { trace(rack.exhaustPath, local / 3, 0); trace(local < 3.8 ? rack.supplyPath : rack.returnPath, local < 3.8 ? (local - 2.5) / 1.3 : (local - 3.8) / 1.2, 1) }
        }
        if (chapter === 3) { pathWeight(rack.electricalPath, .2); if (cooling) { pathWeight(rack.supplyPath, .18); pathWeight(rack.returnPath, .18) } }
      } else if (phase >= 0 && inspectionSystem !== "storage") {
        output.equipment[rack.index] = inspection ? .3 : .12
        const powerOnly = inspection && inspectionSystem === "power", coolingOnly = inspection && inspectionSystem === "cooling"
        if (!coolingOnly && phase < 2.6) { pathWeight(rack.electricalPath, .13); if (moving) trace(rack.electricalPath, phase / 2.6, 0, inspection ? .9 : .55) }
        if (!powerOnly && cooling && phase >= 2 && phase < 8) {
          output.heat[rack.index] = .14 * Math.sin(Math.PI * Math.min(1, (phase - 2) / 6))
          if (moving) {
            trace(rack.exhaustPath, (phase - 2) / 3, 0, inspection ? .8 : .4)
            trace(phase < 6 ? rack.supplyPath : rack.returnPath, phase < 6 ? (phase - 4.2) / 1.8 : (phase - 6) / 2, 1, inspection ? .8 : .4)
          }
        }
      }
      // Analytic phase integral: frame cadence and seek history cannot alter fans.
      const fanTime = chapter === null ? activeSeconds : cursor
      output.fanSeconds.fill(fanTime); output.fans.fill(1)
      if (cooling) {
        if (chapter !== null) {
          const response = smooth((cursor - 9) / 2) - smooth((cursor - 13) / 2), integrated = fanIntegral(cursor, 9, 13)
          for (const fan of rack.fanIndices) { output.fans[fan] += profile.fanModulation * response; output.fanSeconds[fan] += profile.fanModulation * integrated }
        } else if (inspectionSystem && inspectionSupported && inspectionSystem !== "power" && inspectionSystem !== "storage") {
          const elapsed = Math.max(0, activeSeconds - inspectionAt), cycles = Math.floor(elapsed / 8), phase = elapsed % 8
          const response = smooth((phase - 2) / 2) - smooth((phase - 6) / 2), integrated = cycles * 4 + fanIntegral(phase, 2, 6)
          for (const fan of rack.fanIndices) { output.fans[fan] += profile.fanModulation * response; output.fanSeconds[fan] += profile.fanModulation * integrated }
        } else if (!inspectionSystem) {
          const mean = (profile.ambientIntervalSeconds[0] + profile.ambientIntervalSeconds[1]) / 2, jitter = (profile.ambientIntervalSeconds[1] - profile.ambientIntervalSeconds[0]) / 2, cycle = Math.floor(activeSeconds / mean)
          const complete = Math.max(0, cycle - 2), blocks = Math.floor(complete / bag.length), remainder = complete % bag.length
          for (let fan = 0; fan < 4; fan++) output.fanSeconds[fan] += 4 * profile.fanModulation * (blocks * fanPrefix[bag.length * 4 + fan] + fanPrefix[remainder * 4 + fan])
          for (let candidate = complete; candidate <= cycle; candidate++) {
            const start = (candidate + 1) * mean + ecosystemHash(profile.seed ^ 0x9031, candidate) * jitter, elapsed = activeSeconds - start
            const response = smooth((elapsed - 2) / 2) - smooth((elapsed - 6) / 2), integrated = fanIntegral(elapsed, 2, 6)
            for (const fan of racks[bag[candidate % bag.length]].fanIndices) { output.fans[fan] += profile.fanModulation * response; output.fanSeconds[fan] += profile.fanModulation * integrated }
          }
        }
      }
      if (fanRebase) { for (let fan = 0; fan < 4; fan++) fanOffsets[fan] = priorFanSeconds[fan] - output.fanSeconds[fan]; fanRebase = false }
      for (let fan = 0; fan < 4; fan++) output.fanSeconds[fan] += fanOffsets[fan]
      output.chapter = chapter; output.seconds = cursor; output.playing = playing; output.rack = rackIndex
      return output
    },
    get playing() { return playing },
    get guided() { return chapter !== null },
    snapshot() { return { revision, seekRevision, chapter, playing, seconds: cursor, coolingEvidence: cooling ? "available" : "missing", rackId: racks[output.rack].equipmentId, section: output.section } },
  }
}
