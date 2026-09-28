import assert from "node:assert/strict"
import { assertRendererBudget } from "../facility/performance-contract.mjs"

export const SAMPLE_MS = 5_000
export const QUALIFICATION_SECONDS = 900
export const NORMAL_POLICY_ARGS = ["--use-angle=swiftshader", "--disable-gpu", "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"]

/** Presentation classes are shared by unrelated actions. Identify activation by
 * its native role and exact accessible name; never open the workload story. */
export async function activateSustainedFacility(viewer) {
  const ready = viewer.locator("canvas[data-ready=true]")
  const phase = () => viewer.getAttribute("data-phase")
  const active = value => ["loading", "staging", "ready"].includes(value)
  const initialPhase = await phase()
  if (active(initialPhase)) {
    await ready.waitFor({ timeout: 20_000 })
    return { action: "Automatic graphics activation", initialPhase }
  }
  for (const role of ["button", "link"]) {
    const control = viewer.getByRole(role, { name: "Explore in 3D", exact: true })
    if (!await control.isVisible()) continue
    try {
      await control.click({ timeout: 1_500 })
    } catch (error) {
      // Automatic activation can remove the exact button between observation
      // and the click. It does not authorize clicking another styled action.
      if (!active(await phase())) throw error
      await ready.waitFor({ timeout: 20_000 })
      return { action: "Automatic graphics activation won the race", initialPhase }
    }
    await ready.waitFor({ timeout: 20_000 })
    return { action: "Explore in 3D", role, initialPhase }
  }
  await ready.waitFor({ timeout: 20_000 })
  return { action: "Automatic graphics activation", initialPhase }
}

export function sustainedSettings({ url = "http://127.0.0.1:3000/demo", seconds = 900, development = false } = {}) {
  const target = new URL(url)
  assert(["http:", "https:"].includes(target.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && !target.username && !target.password, "Sustained runner requires a local HTTP(S) production URL")
  assert(["/", "/demo"].includes(target.pathname), "Sustained runner supports home or demo only")
  assert(Number.isInteger(seconds) && seconds >= 15 && seconds <= 1800, "Duration must be an integer from 15 to 1800 seconds")
  assert(development || seconds >= QUALIFICATION_SECONDS, "Short runs require --development and cannot qualify")
  return { url: target.href, seconds, development, sampleMs: SAMPLE_MS, qualificationSeconds: QUALIFICATION_SECONDS, maximumSampleGapMs: 7_500, minimumVisibleFraction: .99, minimumActiveFraction: .95, maximumMissedRatio: .1 }
}

export function assertNativeMetal(graphics) {
  assert(typeof graphics?.renderer === "string" && /Apple M5 Pro/i.test(graphics.renderer) && /Metal/i.test(graphics.renderer) && !/SwiftShader|software|llvmpipe/i.test(graphics.renderer), "Actual Apple M5 Pro Metal renderer is required; launch flags alone are insufficient")
}

export function assertSustainedSnapshot(sample) {
  const state = sample?.renderer
  assertRendererBudget(state)
  assert(["frames", "activeSeconds", "clockSeconds", "hiddenFrameCount", "sampleCount", "geometries", "textures", "targetFps", "transitionRemaining"].every(key => Number.isFinite(state[key]) && state[key] >= 0), "Incomplete sustained diagnostic snapshot")
  assert.equal(state.hiddenFrameCount, 0, "Renderer reported hidden/offscreen frames")
  assert(!state.assetError && !sample.rendererError, "Graphics session reported an error")
  assert.equal(state.sceneKind, "overview", "Sustained overview was replaced")
  assert.equal(sample.inspector?.phase, "ready", "Graphics session stopped being ready")
  assert.equal(sample.events.contextLost, 0, "WebGL context was lost")
  assert.equal(sample.events.contextRestored, 0, "WebGL context restoration occurred")
  assert(Number.isInteger(sample.events.presentationChanges) && sample.events.presentationChanges >= 0, "Missing visibility transition evidence")
  if (state.sampleCount >= 120 && state.quality !== "still") {
    assert(["frameP95", "cpuP95", "missedRatio"].every(key => Number.isFinite(state[key]) && state[key] >= 0), "Incomplete cadence evidence")
    assert(state.missedRatio <= 1, "Invalid missed-slot ratio")
  }
}

const visible = sample => sample.documentVisibility === "visible" && sample.stage?.intersectionRatio >= .25
const active = sample => visible(sample) && sample.controls.paused === false && sample.controls.equipmentEnabled === true && sample.renderer.quality !== "still" && !sample.renderer.readingHold && !sample.renderer.qualityProbe && sample.renderer.targetFps > 0
const p95 = values => values.length ? values.slice().sort((a, b) => a - b)[Math.floor((values.length - 1) * .95)] : null

/** Integrate observed intervals; hidden transitions and delayed collectors earn
 * no duration credit. This is sampled evidence, not a GPU/energy measurement. */
export function summarizeSustained(samples, settings) {
  let visibleSeconds = 0, activeSeconds = 0, cadenceSeconds = 0, lateIntervals = 0, frameDelta = 0, requestedFrameSlots = 0
  const issues = [], cadence = [], cpu = [], heap = []
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]
    try { assertSustainedSnapshot(sample) } catch (error) { issues.push(`sample-${i}: ${error.message}`); continue }
    if (Number.isFinite(sample.heap?.usedJSHeapSize)) heap.push(sample.heap.usedJSHeapSize)
    if (sample.renderer?.sampleCount >= 120 && active(sample)) { cadence.push(sample.renderer.frameP95); cpu.push(sample.renderer.cpuP95) }
    if (!i) continue
    const previous = samples[i - 1], gap = sample.elapsedMs - previous.elapsedMs
    try { assertSustainedSnapshot(previous) } catch { continue }
    if (!(gap > 0 && gap <= settings.maximumSampleGapMs)) { lateIntervals++; continue }
    const samePresentation = sample.events.presentationChanges === previous.events.presentationChanges
    const seconds = gap / 1000
    if (samePresentation && visible(previous) && visible(sample)) visibleSeconds += seconds
    const frames = sample.renderer.frames - previous.renderer.frames
    const clock = sample.renderer.activeSeconds - previous.renderer.activeSeconds
    if (frames < 0 || clock < 0) issues.push(`sample-${i}: diagnostic clock/frame counter reset`)
    if (samePresentation && active(previous) && active(sample) && frames > 0 && clock >= seconds * .8 && clock <= seconds * 1.2) {
      activeSeconds += seconds
      frameDelta += frames
      const requested = seconds * Math.min(previous.renderer.targetFps, sample.renderer.targetFps)
      requestedFrameSlots += requested
      if (frames >= requested * (1 - settings.maximumMissedRatio) && previous.renderer.sampleCount >= 120 && sample.renderer.sampleCount >= 120 && previous.renderer.missedRatio <= settings.maximumMissedRatio && sample.renderer.missedRatio <= settings.maximumMissedRatio) cadenceSeconds += seconds
    }
  }
  const observedSeconds = samples.length > 1 ? (samples.at(-1).elapsedMs - samples[0].elapsedMs) / 1000 : 0
  if (observedSeconds < settings.seconds) issues.push("insufficient-wall-duration")
  if (visibleSeconds < settings.seconds * settings.minimumVisibleFraction) issues.push("insufficient-visible-duration")
  if (activeSeconds < settings.seconds * settings.minimumActiveFraction) issues.push("insufficient-active-duration")
  if (cadenceSeconds < settings.seconds * settings.minimumActiveFraction) issues.push("insufficient-cadence-compliant-duration")
  const ready = samples.filter(sample => sample.renderer)
  if (ready.length > 1 && ready.some(sample => sample.renderer.geometries !== ready[0].renderer.geometries || sample.renderer.textures !== ready[0].renderer.textures)) issues.push("retained-resource-counts-changed")
  return { status: issues.length ? "fail" : settings.development ? "development-pass" : "pass", qualificationEligible: !settings.development && settings.seconds >= QUALIFICATION_SECONDS && issues.length === 0, issues: [...new Set(issues)], observedSeconds, visibleSeconds, activeSeconds, cadenceSeconds, lateIntervals, frameDelta,
    requestedFrameSlots, deliveredFpsAcrossActiveIntervals: activeSeconds > 0 ? frameDelta / activeSeconds : null, sampledWindowFrameP95: p95(cadence), sampledWindowCpuP95: p95(cpu), tiers: [...new Set(ready.map(sample => sample.renderer.quality))], maxPeakEstimatedBytes: ready.length ? Math.max(...ready.map(sample => sample.renderer.peakEstimatedBytes)) : null, maximumSampledJsHeapBytes: heap.length ? Math.max(...heap) : null }
}
