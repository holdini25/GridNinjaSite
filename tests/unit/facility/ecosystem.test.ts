import { describe, expect, it, vi } from "vitest"
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, ShaderLib, type WebGLRenderer } from "three"
import source from "./fixtures/ecosystem-topology.json"
import type { FacilityEcosystemProfile, FacilityPresentationCommand, FacilityRenderProfile, FacilityTopology } from "@/types/facility"
import { parseTopology, createTopologyIndex } from "@/lib/facility/topology-runtime"
import { compileEcosystemTrace, createEcosystemActivity, sampleEcosystemLeds, sampleEcosystemTrace } from "@/lib/facility/ecosystem-activity"
import { bindEngineeringMaterials, validateEcosystemUniformBudget } from "@/lib/facility/engineering-materials"

const profile: FacilityEcosystemProfile = { version: 1, seed: 61427, ambientIntervalSeconds: [12, 18], sequenceSeconds: 8, chapterSeconds: [4, 4, 5, 4, 4, 3], colors: { electrical: "#e3e7e4", cooling: "#76abb4", heat: "#c98554" }, fanModulation: .1, maxEquipment: 96, maxRoutes: 128, maxTraces: 2 }
const engineering: NonNullable<FacilityRenderProfile["engineering"]> = { version: 1, seed: 1, accent: { resting: "#9d632f", hover: "#ffbe63", selected: "#ffd18a", previewWeight: .85, baseEmission: .035, activeEmission: 1, transitionMs: 150 }, activity: { resting: .12, peak: 1, steady: .5, pulseMs: [120, 180], eventMs: [80, 180], maxPulses: 3, ambientTraceSeconds: [8, 12], selectedTraceQuietSeconds: 2.8 }, cameraTransitionMs: 420, poseTransitionMs: 280, rendering: { ambientFps: 30, interactionFps: 60, mobilePixels: 1e6, desktopPixels: 1.5e6, probeSeconds: 2 } }
const command = (fields: Partial<FacilityPresentationCommand> = {}): FacilityPresentationCommand => ({ revision: 1, seekRevision: 1, chapter: 0, playing: true, rackId: "rack-00", coolingEvidence: "available", ...fields })
const topology = () => parseTopology(structuredClone(source))

describe("authored ecosystem transport", () => {
  it("validates the actual authoring topology and preserves separate media", () => {
    const data = topology(), index = createTopologyIndex({ topology: data })
    expect(data.equipment).toHaveLength(31); expect(data.routes).toHaveLength(46)
    const electrical = index.resolve({ system: "workloads", equipmentId: "rack-00" })
    expect(electrical.routes.every(id => data.routes[id].medium !== "water")).toBe(true)
    const cooler = data.ecosystem!.thermalCouplings[0]
    const passage = data.ecosystem!.passages.find(item => item.id === cooler.airPassage)!
    expect(passage.medium).toBe("air")
    expect(data.ecosystem!.openAirDomains).toHaveLength(1)
  })
  it("rejects invented branch positions, reverse direction, broken handoffs and cross-fluid passages", () => {
    const mutate = (edit: (data: FacilityTopology) => void) => { const data = structuredClone(source) as FacilityTopology; edit(data); return () => parseTopology(data) }
    expect(mutate(data => { data.ecosystem!.branches[0].s = .9 })).toThrow("ecosystem_branch")
    expect(mutate(data => { const segment = data.ecosystem!.racks[0].electrical[0]; [segment.fromS, segment.toS] = [segment.toS, segment.fromS] })).toThrow("ecosystem_itinerary_direction")
    expect(mutate(data => { data.ecosystem!.passages[0].medium = "water" })).toThrow("ecosystem_passage")
    expect(mutate(data => { data.ecosystem!.thermalCouplings[0].waterPassage = data.ecosystem!.thermalCouplings[0].airPassage })).toThrow("ecosystem_thermal_coupling")
    expect(mutate(data => { data.ecosystem!.racks[0].electrical = data.ecosystem!.racks[1].electrical })).toThrow("ecosystem_itinerary_rack_endpoint")
    expect(mutate(data => { data.ecosystem!.racks[1].ledIndices = data.ecosystem!.racks[0].ledIndices })).toThrow("ecosystem_led")
  })
  it("samples signed subranges by authored physical length, deterministically after a seek", () => {
    const path = compileEcosystemTrace([{ route: 3, from: .2, to: .6, length: 10, signal: 0 }, { route: 8, from: 1, to: 0, length: 2, signal: 1 }]), slots = new Float32Array(16)
    sampleEcosystemTrace(path, .5, slots, 0); expect(slots[0]).toBe(3); expect(slots[1]).toBeCloseTo(.5)
    sampleEcosystemTrace(path, 5 / 6, slots, 0); expect(slots[0]).toBe(8); expect(slots[1]).toBeCloseTo(.5); expect(slots[6]).toBe(-1)
    sampleEcosystemTrace(path, .5, slots, 0); expect(slots[0]).toBe(3); expect(slots[1]).toBeCloseTo(.5)
    sampleEcosystemTrace(path, -1, slots, 0); expect(slots[0]).toBe(-1)
  })
})

describe("one deterministic ecosystem presentation", () => {
  it("keeps early ambient LEDs irregular, bounded and steady when motion is disabled", () => {
    const a = new Float32Array(144), b = new Float32Array(144), seen = new Set<number>()
    for (let frame = 0; frame < 120; frame++) {
      sampleEcosystemLeds(frame / 60, true, profile.seed, 3, a); sampleEcosystemLeds(frame / 60, true, profile.seed, 3, b); expect(a).toEqual(b)
      let bright = 0
      for (let index = 0; index < 48; index++) { if (index % 4 === 3) expect(a[index * 3]).toBe(.5); else if (a[index * 3] > .12001) { bright++; seen.add(index) } }
      expect(bright).toBeLessThanOrEqual(3)
    }
    expect(seen.size).toBe(3); sampleEcosystemLeds(99, false, profile.seed, 3, a); expect(new Set(a)).toEqual(new Set([.5]))
    sampleEcosystemLeds(.5, true, profile.seed, 3, a); sampleEcosystemLeds(.5, true, profile.seed, 3, b); expect(a).toEqual(b)
  })
  it("plays six chapters in24seconds, preserves pause position, and seeks only with seekRevision", () => {
    const checkpoint = vi.fn(), activity = createEcosystemActivity(topology(), profile, checkpoint), leds = new Float32Array(144)
    activity.command(command()); activity.sample(2, 2, true, leds)
    activity.command(command({ revision: 2, playing: false })); activity.sample(1, 3, true, leds); expect(activity.output.seconds).toBe(2)
    activity.command(command({ revision: 3, playing: true })); activity.sample(3, 6, true, leds); expect(activity.output.chapter).toBe(1); expect(activity.output.seconds).toBe(5)
    activity.command(command({ revision: 3, chapter: 1 })); activity.sample(0, 6, true, leds); expect(activity.output.seconds).toBe(5)
    activity.sample(19, 25, true, leds); expect(activity.output.seconds).toBe(24); expect(activity.playing).toBe(false)
    expect(checkpoint).toHaveBeenLastCalledWith({ revision: 3, chapter: 5, playing: false, reason: "complete" })
    activity.command(command({ revision: 4, seekRevision: 2 })); activity.sample(0, 25, true, leds); expect(activity.output.seconds).toBe(0)
  })
  it("stops missing cooling at chapter2, with no thermal/fan/water activity even after a delayed callback", () => {
    const checkpoint = vi.fn(), activity = createEcosystemActivity(topology(), profile, checkpoint), leds = new Float32Array(144)
    activity.command(command({ coolingEvidence: "missing" })); activity.sample(14, 14, true, leds)
    expect(activity.output.chapter).toBe(2); expect(activity.output.seconds).toBe(8); expect(activity.playing).toBe(false); expect(activity.output.section).toBe(false)
    expect(new Set(activity.output.heat)).toEqual(new Set([0])); expect(new Set(activity.output.fans)).toEqual(new Set([1])); expect(activity.output.traces[0]).toBe(-1); expect(activity.output.traces[8]).toBe(-1)
    expect(checkpoint).toHaveBeenLastCalledWith({ revision: 1, chapter: 2, playing: false, reason: "cooling-missing" })
  })
  it("settles immediately under motion preferences and samples coordinated chapter2 section", () => {
    const checkpoint = vi.fn(), activity = createEcosystemActivity(topology(), profile, checkpoint), leds = new Float32Array(144)
    activity.command(command({ chapter: 2 })); activity.sample(2, 2, true, leds); expect(activity.output.section).toBe(true); expect(Math.max(...activity.output.fans)).toBeGreaterThan(1)
    activity.sample(0, 2, false, leds); expect(activity.playing).toBe(false); expect(new Set(leds)).toEqual(new Set([.5])); expect(activity.output.traces[0]).toBe(-1)
    expect(checkpoint).toHaveBeenLastCalledWith({ revision: 1, chapter: 2, playing: false, reason: "motion-disabled" })
  })
  it("integrates identical fan phases at30/60/120Hz and after a direct seek or replay", () => {
    const results: number[][] = [], leds = new Float32Array(144)
    for (const fps of [30, 60, 120]) {
      const activity = createEcosystemActivity(topology(), profile, vi.fn()); activity.command(command())
      for (let frame = 1; frame <= 11 * fps; frame++) activity.sample(1 / fps, frame / fps, true, leds)
      results.push(Array.from(activity.output.fanSeconds))
      activity.command(command({ revision: 2, seekRevision: 2, chapter: 2 })); activity.sample(3, 99, true, leds)
      for (let fan = 0; fan < 4; fan++) expect(activity.output.fanSeconds[fan]).toBeCloseTo(results[0][fan], 8)
      activity.command(command({ revision: 3, seekRevision: 3 })); activity.sample(11, 110, true, leds)
      for (let fan = 0; fan < 4; fan++) expect(activity.output.fanSeconds[fan]).toBeCloseTo(results[0][fan], 8)
    }
    for (const result of results) for (let fan = 0; fan < 4; fan++) expect(result[fan]).toBeCloseTo(results[0][fan], 8)
  })
  it("limits static electrical emphasis to the selected tap and includes an ambient exhaust handoff", () => {
    const data = topology(), activity = createEcosystemActivity(data, profile, vi.fn()), leds = new Float32Array(144)
    activity.command(command({ chapter: 1, playing: false })); activity.sample(0, 0, false, leds)
    const segment = data.ecosystem!.racks[0].electrical[0], route = data.routes.find(item => item.id === segment.routeId)!
    expect(activity.output.routeTo[route.index]).toBeCloseTo(segment.toS); expect(activity.output.routeTo[route.index]).toBeLessThan(1)
    activity.command(command({ revision: 2, seekRevision: 2, chapter: null, playing: false }))
    let exhaust = false
    for (let frame = 0; frame < 2400; frame++) { const out = activity.sample(1 / 60, frame / 60, true, leds); if (out.traces[0] >= 0 && out.traces[5] === 2) exhaust = true }
    expect(exhaust).toBe(true)
  })
  it("reuses all output buffers and never activates storage routes during ambient operation", () => {
    const activity = createEcosystemActivity(topology(), profile, vi.fn()), output = activity.output, leds = new Float32Array(144), data = topology()
    activity.command(command({ chapter: null, playing: false }))
    for (let frame = 0; frame < 3600; frame++) {
      expect(activity.sample(1 / 60, frame / 60, true, leds)).toBe(output)
      expect(Number(output.traces[0] >= 0) + Number(output.traces[8] >= 0)).toBeLessThanOrEqual(2)
      for (const route of data.routes) if (route.medium === "reserve-illustrative") expect(output.routes[route.index]).toBe(0)
    }
  })
  it("traces the cooler identified by an explicit equipment target instead of the default rack's cooler", () => {
    const data = topology(), activity = createEcosystemActivity(data, profile, vi.fn()), leds = new Float32Array(144)
    activity.command(command({ chapter: null, playing: false }))
    for (let cooler = 0; cooler < 4; cooler++) {
      const start = cooler * 8
      activity.focus({ system: "cooling", equipmentId: `cooler-${cooler}` }, start)
      const output = activity.sample(5.999, start + 5.999, true, leds)
      const rackId = ["rack-00", "rack-02", "rack-03", "rack-05"][cooler]
      expect(activity.snapshot().rackId).toBe(rackId)
      expect(data.routes[output.traces[8]].id).toBe(`cooling-${cooler}-supply`)
      const membership = data.ecosystem!.racks.find(item => item.equipmentId === rackId)!
      // The authored common plenum explicitly binds all four fans. The target
      // must preserve that membership, not invent a private air/fan connection.
      expect(membership.fanIndices).toEqual([0, 1, 2, 3])
      for (let fan = 0; fan < 4; fan++) expect(output.fans[fan]).toBeCloseTo(membership.fanIndices.includes(fan) ? 1 + profile.fanModulation : 1)
      activity.sample(.002, start + 6.001, true, leds)
      expect(data.routes[output.traces[8]].id).toBe(`cooling-${cooler}-return`)
    }
  })
  it("suppresses coordinated responses for unsupported equipment without inferring enclosure connectivity", () => {
    const data = topology()
    // Co-located equipment with no authored connection must remain unbound.
    data.equipment.push({ ...data.equipment.find(item => item.id === "cooler-3")!, id: "unconnected-cooler", index: data.equipment.length })
    const activity = createEcosystemActivity(parseTopology(data), profile, vi.fn()), leds = new Float32Array(144)
    activity.command(command({ chapter: null, playing: false }))
    activity.focus({ system: "cooling", equipmentId: "unconnected-cooler" }, 0)
    const output = activity.sample(5, 5, true, leds)
    expect(output.traces[0]).toBe(-1); expect(output.traces[8]).toBe(-1)
    expect(new Set(output.equipment)).toEqual(new Set([0])); expect(new Set(output.heat)).toEqual(new Set([0]))
    expect(new Set(output.routes)).toEqual(new Set([0])); expect(new Set(output.fans)).toEqual(new Set([1]))
    // Base lights remain the same sparse background sample, without assigning
    // an unrelated rack as the selected cooler's coordinated response.
    const ambient = createEcosystemActivity(data, profile, vi.fn()), baseline = new Float32Array(144)
    ambient.command(command({ chapter: null, playing: false })); ambient.sample(5, 5, true, baseline)
    expect(leds).toEqual(baseline)
  })
  it("retains explicit route membership and suppresses unbound route targets", () => {
    const data = topology(), activity = createEcosystemActivity(data, profile, vi.fn()), leds = new Float32Array(144)
    activity.command(command({ chapter: null, playing: false }))
    activity.focus({ system: "cooling", routeId: "cooling-3-supply" }, 0)
    activity.sample(5.999, 5.999, true, leds); expect(activity.snapshot().rackId).toBe("rack-05")
    activity.focus({ system: "cooling", routeId: "unbound-route" }, 6)
    const output = activity.sample(5, 11, true, leds)
    expect(output.traces[0]).toBe(-1); expect(output.traces[8]).toBe(-1)
    expect(new Set(output.fans)).toEqual(new Set([1])); expect(new Set(output.heat)).toEqual(new Set([0]))
  })
})

describe("packed ecosystem material pipeline", () => {
  it("retains PBR chunks, two signed trace slots, and a bounded uniform budget", () => {
    const geometry = new BoxGeometry(), material = new MeshStandardMaterial(), scene = new Group(); scene.add(new Mesh(geometry, material))
    const bindings = bindEngineeringMaterials(scene, { topology: topology() }, engineering, { version: 1, pipeline: "pbr-semantic-v2", uvSet: 0, maxTextureBytes: 3145728 }, profile)
    const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} }
    material.onBeforeCompile(shader as never, {} as WebGLRenderer)
    expect(shader.fragmentShader).toContain("uniform vec4 gnEquipment[8]"); expect(shader.fragmentShader).toContain("uniform vec4 gnRoutes[12]"); expect(shader.fragmentShader).toContain("uniform vec4 gnTraceSlots[4]")
    expect(shader.fragmentShader).toContain("#include <normal_fragment_maps>"); expect(shader.fragmentShader).toContain("vGnIdentity.z >= gnHead.z")
    expect(material.customProgramCacheKey()).toBe("gridninja-ecosystem-v1-31-46-opaque")
    expect(() => validateEcosystemUniformBudget(bindings, { capabilities: { maxFragmentUniforms: 224 } } as WebGLRenderer)).not.toThrow()
    expect(() => validateEcosystemUniformBudget(bindings, { capabilities: { maxFragmentUniforms: 64 } } as WebGLRenderer)).toThrow("ecosystem_uniform_budget")
    const reviewed = bindEngineeringMaterials(scene, { topology: topology() }, engineering, { version: 1, pipeline: "pbr-semantic-v2", uvSet: 0, maxTextureBytes: 3145728, equipmentEdge: { version: 1, viewDirection: "projection-correct", exponent: 5, intensity: .02 } }, profile)
    expect(reviewed.ecosystem!.uniformVectors).toBe(bindings.ecosystem!.uniformVectors + 2)
    expect(() => validateEcosystemUniformBudget(reviewed, { capabilities: { maxFragmentUniforms: reviewed.ecosystem!.uniformVectors } } as WebGLRenderer)).not.toThrow()
    expect(() => validateEcosystemUniformBudget(reviewed, { capabilities: { maxFragmentUniforms: reviewed.ecosystem!.uniformVectors - 1 } } as WebGLRenderer)).toThrow("ecosystem_uniform_budget")
    geometry.dispose(); material.dispose()
  })
})
