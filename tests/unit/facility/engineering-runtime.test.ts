import { describe, expect, it, vi } from "vitest"
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Float32BufferAttribute } from "three"
import type { FacilityRenderProfile, FacilityTopology } from "@/types/facility"
import { createLedActivity, createRouteActivity } from "@/lib/facility/activity"
import { createFrameScheduler, createQualityHistory, createQualityPolicy, equipmentMotionAllowed, cappedDpr, missedFrameSlotRatio, resetFrameMeasurementWindow, type FrameClock, type ScheduledFrame } from "@/lib/facility/frame-policy"
import { createTopologyIndex, parseTopology, parseSpecimen } from "@/lib/facility/topology-runtime"
import { bindEngineeringMaterials } from "@/lib/facility/engineering-materials"

const profile: NonNullable<FacilityRenderProfile["engineering"]> = {
  version: 1, seed: 41727, accent: { resting: "#9d632f", hover: "#ffad42", selected: "#ffbe63", previewWeight: .85, baseEmission: .035, activeEmission: 1, transitionMs: 150 },
  activity: { resting: .12, peak: 1, steady: .5, pulseMs: [120, 180], eventMs: [80, 180], maxPulses: 3, ambientTraceSeconds: [8, 12], selectedTraceQuietSeconds: 2.8 },
  cameraTransitionMs: 300, poseTransitionMs: 280, rendering: { ambientFps: 30, interactionFps: 60, mobilePixels: 650000, desktopPixels: 1500000, probeSeconds: 2 },
}
function fakeClock() {
  let time = 0, id = 0
  const rafs = new Map<number, (time: number) => void>(), timers = new Map<number, { due: number; callback: () => void }>()
  const clock: FrameClock = { now: () => time, raf: callback => { rafs.set(++id, callback); return id }, cancelRaf: id => { rafs.delete(id) }, timer: (callback, delay) => { timers.set(++id, { due: time + delay, callback }); return id }, cancelTimer: id => { timers.delete(id) } }
  return { clock, tick(milliseconds: number) { const end = time + milliseconds; while (time < end) { time += 1000 / 120; for (const [key, timer] of [...timers]) if (timer.due <= time) { timers.delete(key); timer.callback() }; const pending = [...rafs]; rafs.clear(); for (const [, callback] of pending) callback(time) } }, pending: () => rafs.size + timers.size }
}
function displayClock(refreshHz: number, timerDelay = 6) {
  let time = 0, id = 0, tick = 0, offset = 0, timerCalls = 0, rafCallbacks = 0
  const rafs = new Map<number, (time: number) => void>(), timers = new Map<number, { due: number; callback: () => void }>()
  const jitter = [0, .12, -.12, .08, -.08, .04]
  const clock: FrameClock = {
    now: () => time, raf: callback => { rafs.set(++id, callback); return id }, cancelRaf: key => { rafs.delete(key) },
    timer: (callback, delay) => { timerCalls++; timers.set(++id, { due: time + delay + timerDelay, callback }); return id }, cancelTimer: key => { timers.delete(key) },
  }
  return {
    clock,
    run(seconds: number, beforeFrame?: () => void) {
      for (let index = 0; index < Math.round(seconds * refreshHz); index++) {
        tick++; time = offset + tick * 1000 / refreshHz + jitter[tick % jitter.length]
        beforeFrame?.()
        for (const [key, timer] of [...timers]) if (timer.due <= time) { timers.delete(key); timer.callback() }
        const pending = [...rafs]; rafs.clear()
        for (const [, callback] of pending) { rafCallbacks++; callback(time) }
      }
    },
    stall(milliseconds: number) { offset += milliseconds },
    pending: () => rafs.size + timers.size, timersUsed: () => timerCalls, callbacks: () => rafCallbacks,
  }
}
const topology = (): FacilityTopology => ({
  schemaVersion: "facility-topology.v1",
  equipment: ["source", "junction", "sink"].map((id, index) => ({ id, index, label: id, system: "cooling", role: "pipe", bounds: { min: [0, 0, 0], max: [1, 1, 1] }, diagram: [index, 0] })),
  ports: [
    { id: "a", equipmentId: "source", service: "supply", position: [0, 0, 0] },
    { id: "b", equipmentId: "junction", service: "supply", position: [1, 0, 0] },
    { id: "c", equipmentId: "junction", service: "supply", position: [1, 1, 0] },
    { id: "d", equipmentId: "sink", service: "supply", position: [2, 1, 0] },
    { id: "e", equipmentId: "junction", service: "return", position: [1, 2, 0] },
    { id: "f", equipmentId: "sink", service: "return", position: [2, 2, 0] },
  ],
  routes: [
    { id: "one", index: 0, system: "cooling", service: "supply", from: "a", to: "b", path: [[0, 0, 0], [1, 0, 0]], lengthMetres: 1 },
    { id: "two", index: 1, system: "cooling", service: "supply", from: "c", to: "d", path: [[1, 1, 0], [2, 1, 0]], lengthMetres: 1 },
    { id: "return", index: 2, system: "cooling", service: "return", from: "e", to: "f", path: [[1, 2, 0], [2, 2, 0]], lengthMetres: 1 },
  ], internalLinks: [{ from: "b", to: "c" }],
})

describe("bounded engineering activity", () => {
  it("is repeatable, keeps twelve lamps steady, limits concurrent pulses, and freezes safely", () => {
    const first = createLedActivity(48, profile), second = createLedActivity(48, profile)
    const a = new Float32Array(144), b = new Float32Array(144)
    const seen = new Set<number>()
    for (let frame = 0; frame < 1200; frame++) {
      first.sample(frame / 60, true, a); second.sample(frame / 60, true, b); expect(a).toEqual(b)
      let active = 0
      for (let i = 0; i < 48; i++) {
        expect(a[i * 3]).toBe(a[i * 3 + 1]); expect(a[i * 3]).toBe(a[i * 3 + 2])
        if (i % 4 === 3) expect(a[i * 3]).toBe(.5)
        else if (a[i * 3] > .12001) { active++; seen.add(i) }
      }
      expect(active).toBeLessThanOrEqual(3)
    }
    expect(seen.size).toBe(36)
    first.sample(20, false, a); expect(new Set(a)).toEqual(new Set([.5]))
  })
  it("waits for the ambient interval, excludes storage unless targeted, and uses at most two trace slots", () => {
    const activity = createRouteActivity(3, profile, [0, 1]), output = new Float32Array(3)
    for (let frame = 0; frame < 8 * 60; frame++) { activity.sample(frame / 60, true, [], output); expect([...output]).toEqual([-1, -1, -1]) }
    for (let frame = 480; frame < 1800; frame++) { activity.sample(frame / 60, true, [], output); expect(output[2]).toBe(-1); expect([...output].filter(value => value >= 0).length).toBeLessThanOrEqual(2) }
    activity.focus([], [2]); activity.sample(30, true, [], output); expect(output[2]).toBe(0)
    activity.sample(30.1, false, [], output); expect([...output]).toEqual([-1, -1, -1])
  })
})

describe("one cadence-aware graphics scheduler", () => {
  it("does not manufacture25ms/8ms pairs from captured120Hz ProMotion timestamp jitter", () => {
    // First second of the native Metal probe, relative milliseconds. Early RAFs
    // continue arriving; these are timestamp phase variations, not lost frames.
    const times = [0, 8, 16.4, 24.7, 33.1, 41.4, 48.5, 56.9, 66.7, 74.6, 83.1, 91.4, 99.8, 108.1, 116.4, 124.2, 133, 141.4, 149.7, 158.1, 166.4, 174.7, 183.1, 189.9, 200.1, 208, 216.3, 224.8, 233.1, 241.4, 249.7, 258.1, 265.6, 273.6, 281.5, 291.7, 299.7, 308.1, 316.4, 324.7, 333, 341.4, 348.7, 358.3, 366.4, 374.7, 382.3, 391.6, 399.7, 408, 414.9, 425.1, 433, 441.4, 449.7, 458, 466.4, 474.7, 483.1, 490.1, 500.1, 508, 516.4, 524.7, 533.1, 541.4, 549.7, 558.1, 566.4, 574.8, 583, 591.3, 599.8, 608.1, 616.4, 624.7, 631.8, 641.7, 649.7, 658.1, 666.3, 674.7, 682, 691.6, 699.7, 708.1, 716.4, 724.8, 733.1, 741.4, 748.7, 758.4, 764.8, 775.1, 782.9, 791.4, 799.7, 808.1, 816.4, 824.7, 833, 841.4, 849.7, 858, 866.4, 874.7, 881.8, 891.7, 899.6, 908.1, 914.8, 924.3, 933.2, 941.1, 948.7, 958.4, 966.3, 974.7, 983.1, 991.4]
    let pending: ((time: number) => void) | null = null
    const clock: FrameClock = { now: () => 0, raf: callback => { pending = callback; return 1 }, cancelRaf: () => { pending = null }, timer: () => { throw new Error("unexpected timer") }, cancelTimer() {} }
    const frames: ScheduledFrame[] = [], scheduler = createFrameScheduler(clock, frame => frames.push({ ...frame }))
    scheduler.configure({ visible: true, moving: true, fps: 60 })
    for (const time of times) { const callback = pending!; pending = null; callback(time) }
    const intervals = frames.slice(1).map(frame => frame.interval)
    expect(frames).toHaveLength(60)
    expect(Math.max(...intervals)).toBeLessThan(20)
    expect(Math.min(...intervals)).toBeGreaterThan(12)
    expect(frames.at(-1)?.activeSeconds).toBeCloseTo((times[118] - times[0]) / 1000)
    scheduler.dispose(); expect(pending).toBeNull()
  })
  it("coalesces120Hz input requests without bypassing the30/60fps draw deadline", () => {
    for (const fps of [30, 60]) {
      const display = displayClock(120), frames: ScheduledFrame[] = []
      const scheduler = createFrameScheduler(display.clock, frame => frames.push({ ...frame }))
      scheduler.configure({ visible: true, moving: true, fps })
      display.run(2, () => { scheduler.request(); scheduler.request() })
      expect(frames.length).toBeGreaterThanOrEqual(fps * 2 - 1)
      expect(frames.length).toBeLessThanOrEqual(fps * 2 + 1)
      expect(frames.slice(1).every(frame => frame.interval > 1000 / fps - .5)).toBe(true)
      expect(display.pending()).toBe(1)
      scheduler.dispose(); expect(display.pending()).toBe(0)
    }
  })
  it.each([30, 60, 120])("keeps30/60fps draws aligned on a jittered%iHz display despite late timers", refreshHz => {
    for (const fps of [30, 60]) {
      const display = displayClock(refreshHz), frames: ScheduledFrame[] = [], objects = new Set<ScheduledFrame>()
      const scheduler = createFrameScheduler(display.clock, frame => { frames.push({ ...frame }); objects.add(frame) })
      scheduler.configure({ visible: true, moving: true, fps }); display.run(5)
      const availableFps = Math.min(refreshHz, fps)
      expect(frames.length).toBeGreaterThanOrEqual(availableFps * 5 - 1)
      expect(frames.length).toBeLessThanOrEqual(availableFps * 5 + 1)
      const intervals = frames.slice(1).map(frame => frame.interval).sort((a, b) => a - b)
      expect(intervals[Math.floor(intervals.length * .95)]).toBeLessThan(1000 / availableFps + .5)
      expect(Math.min(...intervals)).toBeGreaterThan(1000 / availableFps - .5)
      expect(frames.at(-1)?.activeSeconds).toBeCloseTo(frames.slice(1).reduce((total, frame) => total + frame.interval / 1000, 0))
      expect(objects.size).toBe(1); expect(display.timersUsed()).toBe(0)
      scheduler.dispose(); expect(display.pending()).toBe(0)
    }
  })
  it("reports a real delayed display callback without catch-up draws and sleeps fully when inactive", () => {
    const display = displayClock(120), frames: ScheduledFrame[] = []
    const scheduler = createFrameScheduler(display.clock, frame => frames.push({ ...frame }))
    scheduler.configure({ visible: true, moving: true, fps: 60 }); display.run(1)
    display.stall(200); display.run(1)
    expect(frames.filter(frame => frame.interval > 100)).toHaveLength(1)
    expect(frames.find(frame => frame.interval > 100)?.interval).toBeGreaterThan(200)
    expect(frames.slice(1).every(frame => frame.interval > 16)).toBe(true)
    scheduler.configure({ visible: true, moving: false, fps: 30 }); display.run(.1)
    const pausedFrames = frames.length, pausedCallbacks = display.callbacks()
    expect(display.pending()).toBe(0); display.run(1)
    expect(frames).toHaveLength(pausedFrames); expect(display.callbacks()).toBe(pausedCallbacks)
    scheduler.configure({ visible: false, moving: true, fps: 60 }); display.run(10)
    expect(display.callbacks()).toBe(pausedCallbacks); expect(display.pending()).toBe(0)
    scheduler.configure({ visible: true, moving: true, fps: 60 }); display.run(1 / 120)
    expect(frames.at(-1)?.delta).toBe(0)
    scheduler.dispose(); expect(display.pending()).toBe(0)
  })
  it("lets an explicit capability probe measure a still-tier device while honoring every user motion preference", () => {
    expect(equipmentMotionAllowed(true, false, false, "still", null)).toBe(false)
    for (const fps of [30, 60] as const) {
      expect(equipmentMotionAllowed(true, false, false, "still", fps)).toBe(true)
      expect(equipmentMotionAllowed(false, false, false, "still", fps)).toBe(false)
      expect(equipmentMotionAllowed(true, true, false, "still", fps)).toBe(false)
      expect(equipmentMotionAllowed(true, false, true, "still", fps)).toBe(false)
    }
  })
  it("retains only the newest32tier transitions and returns detached diagnostic evidence", () => {
    const history = createQualityHistory()
    for (let index = 0; index < 40; index++) history.record({ activeSeconds: index, reason: "overload", from: "balanced", to: "economy" })
    const snapshot = history.snapshot()
    expect(snapshot).toHaveLength(32); expect(snapshot[0].activeSeconds).toBe(8); expect(snapshot.at(-1)?.activeSeconds).toBe(39)
    snapshot[0].reason = "tampered"
    expect(history.snapshot()[0].reason).toBe("overload")
  })
  it("caps a120Hz display at30fps, coalesces requests, and owns zero timers when paused/hidden/disposed", () => {
    const clock = fakeClock(), frames: ScheduledFrame[] = [], objects = new Set<ScheduledFrame>()
    const scheduler = createFrameScheduler(clock.clock, frame => { objects.add(frame); frames.push({ ...frame }); scheduler.configure({ visible: true, moving: true, fps: 30 }) })
    scheduler.configure({ visible: true, moving: true, fps: 30 }); clock.tick(2000)
    expect(frames.length).toBeGreaterThanOrEqual(58); expect(frames.length).toBeLessThanOrEqual(62); expect(objects.size).toBe(1)
    scheduler.configure({ visible: false, moving: true, fps: 30 }); const before = scheduler.activeSeconds; const count = frames.length
    expect(clock.pending()).toBe(0); clock.tick(10_000); expect(frames).toHaveLength(count); expect(scheduler.activeSeconds).toBe(before)
    scheduler.configure({ visible: true, moving: true, fps: 30 }); clock.tick(10); expect(frames.at(-1)?.delta).toBe(0)
    scheduler.dispose(); expect(clock.pending()).toBe(0)
  })
  it("renders one dirty still frame, then sleeps until the next actual change", () => {
    const clock = fakeClock(), draw = vi.fn(), scheduler = createFrameScheduler(clock.clock, draw)
    scheduler.configure({ visible: true, moving: false, fps: 30 }); scheduler.request(); scheduler.request(); clock.tick(500)
    expect(draw).toHaveBeenCalledOnce(); expect(clock.pending()).toBe(0)
    scheduler.request(); clock.tick(500); expect(draw).toHaveBeenCalledTimes(2)
    scheduler.dispose()
  })
  it("does not penalize intended30fps, promotes slowly, and demotes sustained overload through to still", () => {
    const change = vi.fn(), policy = createQualityPolicy(true, change)
    const good = Array.from({ length: 60 }, () => ({ interval: 1000 / 30, targetFps: 30, cpu: 1 }))
    for (let i = 0; i < 29; i++) policy.evaluate(good, 1)
    expect(policy.tier).toBe("balanced"); policy.evaluate(good, 1); expect(policy.tier).toBe("high")
    const bad = good.map(sample => ({ ...sample, interval: 100 }))
    policy.evaluate(bad, 1); expect(policy.tier).toBe("balanced")
    policy.evaluate(bad, 1); expect(policy.tier).toBe("economy")
    policy.evaluate(bad, 1); expect(policy.tier).toBe("still")
    policy.retry(); expect(policy.tier).toBe("balanced")
    expect(cappedDpr("high", 3, 2000, 1000, 1_000_000)).toBeCloseTo(Math.sqrt(.5))
  })
  it("counts lost requested slots across mixed cadences and excludes the initial zero interval", () => {
    expect(missedFrameSlotRatio([
      { interval: 0, targetFps: 60, cpu: 0 },
      { interval: 200, targetFps: 60, cpu: 1 },
      { interval: 1000 / 30, targetFps: 30, cpu: 1 },
      { interval: 1000 / 60, targetFps: 60, cpu: 1 },
    ])).toBeCloseTo(11 / 14)
    expect(missedFrameSlotRatio([{ interval: 0, targetFps: 60, cpu: 0 }])).toBe(0)
  })
  it("requires two moderately missed windows, preserves the cooldown, and separately catches three long stalls", () => {
    const policy = createQualityPolicy(true, vi.fn())
    const moderate = Array.from({ length: 20 }, (_, index) => ({ interval: index < 3 ? 2000 / 30 : 1000 / 30, targetFps: 30, cpu: 1 }))
    expect(missedFrameSlotRatio(moderate)).toBeCloseTo(3 / 23)
    policy.evaluate(moderate, 1); expect(policy.tier).toBe("balanced")
    policy.evaluate(moderate, 1); expect(policy.tier).toBe("economy")
    const healthy = Array.from({ length: 60 }, () => ({ interval: 1000 / 30, targetFps: 30, cpu: 1 }))
    for (let index = 0; index < 29; index++) policy.evaluate(healthy, 1)
    expect(policy.tier).toBe("economy")
    policy.evaluate(healthy, 1); expect(policy.tier).toBe("balanced")
    const stalls = Array.from({ length: 120 }, (_, index) => ({ interval: index < 3 ? 101 : 1000 / 30, targetFps: 30, cpu: 1 }))
    expect(missedFrameSlotRatio(stalls)).toBeLessThan(.1)
    policy.evaluate(stalls, 1); expect(policy.tier).toBe("economy")
  })
  it("does not demote healthy economy frames using the preceding overloaded tier's window", () => {
    const state = { activeSeconds: 2, samples: 33, cursor: 33, recentCount: 33, recentCursor: 33, evaluatedAt: 1, windowStartedAt: 0, frameP95: 60, cpuP95: 1 }
    const previous = Array.from({ length: 33 }, () => ({ interval: 60, targetFps: 30, cpu: 1 }))
    const history = createQualityHistory()
    const policy = createQualityPolicy(true, (tier, reason) => { history.record({ activeSeconds: state.activeSeconds, reason, from: "balanced", to: tier }); resetFrameMeasurementWindow(state) })
    policy.evaluate(previous, 1)
    expect(policy.tier).toBe("economy")
    expect(state.recentCount).toBe(0); expect(state.recentCursor).toBe(0); expect(state.windowStartedAt).toBe(2)
    expect(state.frameP95).toBeNull(); expect(state.cpuP95).toBeNull()
    const nextWindow = previous.slice(0, state.recentCount)
    nextWindow.push(...Array.from({ length: 60 }, () => ({ interval: 1000 / 30, targetFps: 30, cpu: 1 })))
    state.activeSeconds = 4
    policy.evaluate(nextWindow, 1)
    expect(policy.tier).toBe("economy")
    expect(history.snapshot()).toHaveLength(1)
  })
  it("advances the visible clock by real accepted time and detects severe5fps overload without120samples", () => {
    let callback: ((time: number) => void) | undefined
    let now = 0
    const clock: FrameClock = { now: () => now, raf: fn => { callback = fn; return 1 }, cancelRaf: () => {}, timer: fn => { fn(); return 1 }, cancelTimer: () => {} }
    const frames: ScheduledFrame[] = [], scheduler = createFrameScheduler(clock, frame => frames.push({ ...frame }))
    scheduler.configure({ visible: true, moving: true, fps: 30 })
    for (let i = 0; i < 11; i++) { now = i * 200; callback!(now) }
    expect(scheduler.activeSeconds).toBeCloseTo(2)
    const policy = createQualityPolicy(false, vi.fn())
    policy.evaluate(frames.slice(1).map(frame => ({ interval: frame.interval, targetFps: frame.targetFps, cpu: 1 })), 1)
    expect(policy.tier).toBe("still")
    scheduler.dispose()
  })
})

describe("authored port-level connectivity", () => {
  it("traverses explicit internal links without bridging adjacent supply/return ports", () => {
    const data = parseTopology(JSON.stringify(topology()))
    expect(createTopologyIndex({ topology: data }).resolve({ system: "cooling", routeId: "one" }).routes.sort()).toEqual([0, 1])
    data.internalLinks = []
    expect(createTopologyIndex({ topology: data }).resolve({ system: "cooling", routeId: "one" }).routes).toEqual([0])
    expect(createTopologyIndex({ topology: data }).resolve({ system: "cooling", equipmentId: "junction" }).routes.sort()).toEqual([0, 1, 2])
  })
  it("rejects disconnected route endpoints, bad lengths, service bridges and invalid part references", () => {
    let data = topology(); data.routes[0].path[1][0] = 4; expect(() => parseTopology(data)).toThrow("termination")
    data = topology(); data.routes[0].lengthMetres = 99; expect(() => parseTopology(data)).toThrow("length")
    data = topology(); data.internalLinks.push({ from: "b", to: "e" }); expect(() => parseTopology(data)).toThrow("internal")
    expect(() => parseSpecimen({ schemaVersion: "facility-specimen.v1", kind: "rack", system: "workloads", poses: {}, parts: Array.from({ length: 4 }, (_, index) => ({ id: `part-${index}`, index, label: "Panel", role: "panel", objectId: `part-${index}`, bounds: { min: [0, 0, 0], max: [1, 1, 1] }, connections: ["missing"] })) })).toThrow("specimen_part")
  })
  it("rejects empty engineering topology and specimen callout counts outside4–6", () => {
    for (const key of ["equipment", "ports", "routes"] as const) { const data = topology(); data[key] = []; expect(() => parseTopology(data)).toThrow("empty_connections") }
    for (const length of [0, 3, 7, 512]) expect(() => parseSpecimen({ schemaVersion: "facility-specimen.v1", kind: "rack", system: "workloads", poses: {}, parts: Array.from({ length }, () => ({})) })).toThrow("part_count")
  })
})

describe("semantic material batching", () => {
  it("uses authored IDs and one shader per existing material without cloning or new draws", () => {
    const scene = new Group(), material = new MeshStandardMaterial(), mesh = new Mesh(new BoxGeometry(), material)
    scene.add(mesh)
    mesh.geometry.setAttribute("_gn_equipment_id", new Float32BufferAttribute(new Float32Array(24).fill(1), 1))
    mesh.geometry.setAttribute("_gn_route_id", new Float32BufferAttribute(new Float32Array(24).fill(0), 1))
    mesh.geometry.setAttribute("_gn_route_s", new Float32BufferAttribute(new Float32Array(24).fill(.5), 1))
    const bindings = bindEngineeringMaterials(scene, { topology: topology() }, profile)
    expect(mesh.material).toBe(material); expect(scene.children).toHaveLength(1)
    const shader = { uniforms: {}, vertexShader: "#include <common>\n#include <begin_vertex>", fragmentShader: "#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>" }
    material.onBeforeCompile(shader as never, {} as never)
    expect(shader.uniforms).toHaveProperty("gnRoutes.value", bindings.routeWeights)
    expect(shader.fragmentShader).toContain("vGnIdentity.z - gnPhase")
    expect(shader.vertexShader).toContain("_gn_equipment_id")
    mesh.geometry.getAttribute("_gn_route_id").setX(0, 99)
    expect(() => bindEngineeringMaterials(scene, { topology: topology() }, profile)).toThrow("attribute_value")
    mesh.geometry.dispose(); material.dispose()
  })
})
