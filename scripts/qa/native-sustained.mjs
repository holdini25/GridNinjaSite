import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { parseArgs } from "node:util"
import { chromium } from "@playwright/test"
import { Launcher } from "chrome-launcher"
import { verifiedBuildIdentity } from "../facility/performance-contract.mjs"
import { qaHarnessRevision } from "./candidate-contract.mjs"
import { activateSustainedFacility, assertNativeMetal, assertSustainedSnapshot, NORMAL_POLICY_ARGS, sustainedSettings, summarizeSustained } from "./native-sustained-contract.mjs"

const { values } = parseArgs({ options: { url: { type: "string" }, seconds: { type: "string" }, development: { type: "boolean", default: false }, out: { type: "string" } }, strict: true })
const settings = sustainedSettings({ url: values.url, seconds: values.seconds === undefined ? 900 : Number(values.seconds), development: values.development })
const output = resolve(values.out ?? `build/qa/native-sustained-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${process.pid}`)
await mkdir(resolve(output, ".."), { recursive: true })
await mkdir(output) // An existing attempt, including a failed one, is never reused.
const report = { schemaVersion: "gridninja-native-sustained.v1", measuredAt: new Date().toISOString(), status: "incomplete", qualificationEligible: false, publicReleaseApproved: false, settings, samples: [], errors: [], errorOverflow: 0, lifecycle: [], screenshots: [], cleanup: [], limitations: ["Native macOS Chrome only; does not qualify Safari, phones, other GPUs or public release.", "Asset allocation is an application estimate, not driver/GPU memory. JS heap is separate; no RSS-to-GPU inference.", "GPU timestamp, temperature, thermal throttling and energy measurements are unavailable in this runner.", "Sampled rolling cadence windows are reported against requested cadence; they do not replace fixed-cadence capability tests.", "No screenshots or video are taken during the timed observation. No candidate ledger is updated."] }
const persist = async () => { await writeFile(`${output}/report.json.pending`, `${JSON.stringify(report, null, 2)}\n`); await rename(`${output}/report.json.pending`, `${output}/report.json`) }
const bounded = async (promise, ms, label) => {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms) })]) } finally { clearTimeout(timer) }
}
const error = (kind, message) => { if (report.errors.length < 100) report.errors.push({ kind, message: String(message).slice(0, 2000), at: new Date().toISOString() }); else report.errorOverflow++ }
let chrome, userDataDir, browser, context, page, intentionalShutdown = false, stopping = false
const stop = signal => { stopping = true; error("interruption", signal) }
process.once("SIGINT", stop); process.once("SIGTERM", stop)
const lifecycle = event => { if (report.lifecycle.length < 100) report.lifecycle.push({ event, at: new Date().toISOString(), intentionalShutdown }) }

// Runs only at the bounded sampling cadence, never inside the render loop.
function snapshot() {
  const inspector = document.querySelector('[data-testid="facility-inspection"]'), stage = inspector?.querySelector(".facility-stage"), canvas = inspector?.querySelector("canvas[data-ready=true]")
  const rect = stage?.getBoundingClientRect()
  const width = rect ? Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) : 0
  const height = rect ? Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) : 0
  let renderer = null, rendererError = null
  try { renderer = canvas?.__gnFacilitySnapshot?.() ?? null } catch (cause) { rendererError = String(cause) }
  const pause = inspector?.querySelector('.facility-view-controls button[aria-pressed]'), equipment = inspector?.querySelector('.facility-equipment input[type="checkbox"]')
  const memory = performance.memory
  return { renderer, rendererError, documentVisibility: document.visibilityState, documentHasFocus: document.hasFocus(), events: { ...window.__GN_SUSTAIN_OBSERVATION__ }, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    stage: rect ? { width: rect.width, height: rect.height, intersectionRatio: rect.width * rect.height > 0 ? width * height / (rect.width * rect.height) : 0 } : null,
    inspector: inspector ? { phase: inspector.dataset.phase, release: inspector.dataset.release, view: inspector.dataset.view, pose: inspector.dataset.pose ?? null, quality: inspector.dataset.quality, failure: inspector.dataset.failure ?? null } : null,
    controls: { paused: pause ? pause.getAttribute("aria-pressed") === "true" : null, equipmentEnabled: equipment?.checked ?? null },
    heap: memory ? { source: "Chromium performance.memory (may be coarsened)", usedJSHeapSize: memory.usedJSHeapSize, totalJSHeapSize: memory.totalJSHeapSize, jsHeapSizeLimit: memory.jsHeapSizeLimit } : null }
}

try {
  report.identity = await verifiedBuildIdentity()
  report.qaHarnessRevision = await qaHarnessRevision()
  const digest = bytes => createHash("sha256").update(bytes).digest("hex")
  report.executedHarness = {
    revision: "native-sustained.activation-v2",
    scriptSha256: digest(await readFile(fileURLToPath(import.meta.url))),
    contractSha256: digest(await readFile(new URL("./native-sustained-contract.mjs", import.meta.url))),
  }
  if (process.env.GN_NATIVE_HARNESS_AMENDMENT) {
    report.harnessAmendment = JSON.parse(await readFile(process.env.GN_NATIVE_HARNESS_AMENDMENT, "utf8"))
    assert.deepEqual(report.harnessAmendment.frozenBuildIdentity, report.identity, "Amendment targets another frozen application build")
    assert.equal(report.harnessAmendment.frozenQaHarnessRevision, report.qaHarnessRevision, "Amendment targets another frozen harness")
    assert.equal(report.harnessAmendment.executedScriptSha256, report.executedHarness.scriptSha256, "Amended runner hash differs")
    assert.equal(report.harnessAmendment.executedContractSha256, report.executedHarness.contractSha256, "Amended contract hash differs")
  }
  await persist()
  userDataDir = await mkdtemp(join(tmpdir(), "gridninja-native-sustained-"))
  // Normal Playwright contexts enable focus emulation and can report hidden
  // pages as visible. Use the established native default-context CDP path.
  const chromeFlags = [...Launcher.defaultFlags().filter(flag => !NORMAL_POLICY_ARGS.includes(flag)), "--window-size=1440,1100", "--use-angle=metal", "--use-gl=angle"]
  chrome = new Launcher({ userDataDir, ignoreDefaultFlags: true, chromeFlags, handleSIGINT: false, maxConnectionRetries: 40, connectionPollInterval: 250 })
  await bounded(chrome.launch(), 20_000, "Native Chrome launch")
  report.launch = { channel: "installed-native-chrome", headless: false, connection: "connectOverCDP/noDefaults", removedDefaultArguments: NORMAL_POLICY_ARGS, processId: chrome.pid, arguments: chrome.chrome.spawnargs.filter(arg => !arg.startsWith("--user-data-dir=")) }
  assert(!report.launch.arguments.some(arg => NORMAL_POLICY_ARGS.includes(arg)), "Native visibility/throttling was overridden")
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`, { noDefaults: true, timeout: 10_000 })
  report.browser = browser.version()
  context = browser.contexts()[0]
  assert(context, "Native Chrome default context is unavailable")
  // This harness has no submission step. Enforce that across the one context.
  await context.route("**/*", route => ["GET", "HEAD", "OPTIONS"].includes(route.request().method()) ? route.continue() : route.abort("blockedbyclient"))
  page = context.pages()[0] ?? await context.newPage()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  page.setDefaultTimeout(15_000)
  page.on("pageerror", cause => error("pageerror", cause.message))
  page.on("console", message => { if (message.type() === "error") error("console", message.text()) })
  page.on("close", () => lifecycle("page-close")); page.on("crash", () => lifecycle("page-crash"))
  context.on("close", () => lifecycle("context-close")); browser.on("disconnected", () => lifecycle("browser-disconnected"))
  await page.addInitScript(() => {
    window.__GN_FACILITY_DIAGNOSTICS__ = true
    window.__GN_SUSTAIN_OBSERVATION__ = { contextLost: 0, contextRestored: 0, presentationChanges: 0, visibilityChanges: 0, offscreenChanges: 0 }
    document.addEventListener("visibilitychange", () => { window.__GN_SUSTAIN_OBSERVATION__.visibilityChanges++; window.__GN_SUSTAIN_OBSERVATION__.presentationChanges++ })
    document.addEventListener("webglcontextlost", () => { window.__GN_SUSTAIN_OBSERVATION__.contextLost++ }, true)
    document.addEventListener("webglcontextrestored", () => { window.__GN_SUSTAIN_OBSERVATION__.contextRestored++ }, true)
  })
  const response = await page.goto(settings.url, { waitUntil: "load", timeout: 30_000 })
  assert(response?.ok(), "Local production route failed")
  const html = await response.text()
  // Next's initial RSC payload exposes its build ID; fail closed if that
  // contract changes instead of measuring a different server silently.
  const servedBuildIds = [...html.matchAll(/\\"b\\":\\"([^\\"]+)\\"/g)].map(match => match[1])
  assert(servedBuildIds.includes(report.identity.buildId), "Served HTML does not match the verified local production build")
  report.servedBuildId = report.identity.buildId
  await page.bringToFront()
  const viewer = page.locator('[data-testid="facility-inspection"]')
  await viewer.locator(".facility-stage").scrollIntoViewIfNeeded()
  report.activation = { ...await activateSustainedFacility(viewer), at: new Date().toISOString() }
  await viewer.locator("canvas[data-ready=true]").waitFor({ timeout: 20_000 })
  assert.equal(new URL(page.url()).origin, new URL(settings.url).origin, "Activation left the local origin")
  assert.equal(context.pages().length, 1, "Activation created another page")
  report.finalUrl = page.url()
  await viewer.locator(".facility-stage").scrollIntoViewIfNeeded()
  await page.mouse.move(0, 0)
  report.graphics = await viewer.locator("canvas[data-ready=true]").evaluate(canvas => { const gl = canvas.getContext("webgl2"), debug = gl?.getExtension("WEBGL_debug_renderer_info"); return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable", vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : "unavailable" } })
  assertNativeMetal(report.graphics)
  report.beforeWarmup = await page.evaluate(snapshot)
  await persist()
  assert(report.beforeWarmup.renderer?.ecosystem?.chapter == null, "A workload story is open; ambient qualification must start in the overview")
  await page.waitForFunction(() => { const state = document.querySelector("canvas[data-ready=true]")?.__gnFacilitySnapshot?.(); return state && state.sampleCount >= 120 && state.transitionRemaining === 0 && !state.qualityProbe && state.clockSeconds > state.interactionUntil }, null, { timeout: 20_000 })
  await page.evaluate(() => {
    let visible
    const observer = new IntersectionObserver(entries => { const next = entries[0].intersectionRatio >= .25; if (visible !== undefined && next !== visible) { window.__GN_SUSTAIN_OBSERVATION__.offscreenChanges++; window.__GN_SUSTAIN_OBSERVATION__.presentationChanges++ } visible = next }, { threshold: [.25] })
    observer.observe(document.querySelector(".facility-stage"))
  })
  await page.screenshot({ path: `${output}/start.png`, timeout: 10_000 }); report.screenshots.push({ path: "start.png", phase: "before-timing" })
  const started = performance.now()
  let due = started
  do {
    const delay = due - performance.now()
    if (delay > 0) await new Promise(resolveDelay => setTimeout(resolveDelay, delay))
    if (stopping) throw new Error("Sustained observation interrupted")
    const sample = await bounded(page.evaluate(snapshot), 10_000, "Diagnostic sampling")
    sample.elapsedMs = performance.now() - started
    report.samples.push(sample)
    assertSustainedSnapshot(sample)
    assert.equal(sample.inspector.release, report.identity.buildSettings.selectedRelease, "Displayed release differs from the attested build")
    await persist()
    due += settings.sampleMs
  } while (report.samples.at(-1).elapsedMs - report.samples[0].elapsedMs < settings.seconds * 1000)
  report.summary = summarizeSustained(report.samples, settings)
  await page.screenshot({ path: `${output}/end.png`, timeout: 10_000 }); report.screenshots.push({ path: "end.png", phase: "after-timing" })
  assert.deepEqual(await verifiedBuildIdentity(), report.identity, "Build identity changed during sustained observation")
  assert.equal(await qaHarnessRevision(), report.qaHarnessRevision, "QA harness changed during sustained observation")
  assert.equal(digest(await readFile(fileURLToPath(import.meta.url))), report.executedHarness.scriptSha256, "Executed runner changed during observation")
  assert.equal(digest(await readFile(new URL("./native-sustained-contract.mjs", import.meta.url))), report.executedHarness.contractSha256, "Executed contract changed during observation")
  assert.equal(report.errors.length + report.errorOverflow, 0, "Browser errors occurred")
  assert(!report.lifecycle.some(event => !event.intentionalShutdown), "Browser/page lifecycle interrupted the observation")
  assert.equal(report.summary.issues.length, 0, report.summary.issues.join("; "))
  report.status = report.summary.status
  report.qualificationEligible = report.summary.qualificationEligible
} catch (cause) {
  report.status = "fail"; report.failure = cause instanceof Error ? cause.message : String(cause); process.exitCode = 1
} finally {
  intentionalShutdown = true
  await persist()
  if (chrome) {
    try { await bounded(browser?.close() ?? Promise.resolve(), 5_000, "CDP disconnect"); await bounded(chrome.kill(), 10_000, "Owned browser cleanup"); report.cleanup.push("owned-browser-closed") }
    catch (cause) {
      report.cleanup.push(String(cause))
      chrome.chrome?.kill("SIGKILL")
      report.status = "fail"; report.qualificationEligible = false; process.exitCode = 1
    }
  }
  if (userDataDir) await bounded(rm(userDataDir, { recursive: true, force: true }), 5_000, "Owned temporary profile cleanup").catch(cause => { report.cleanup.push(String(cause)); report.status = "fail"; report.qualificationEligible = false; process.exitCode = 1 })
  process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop)
  report.completedAt = new Date().toISOString()
  await persist()
  console.log(JSON.stringify({ status: report.status, qualificationEligible: report.qualificationEligible, samples: report.samples.length, report: `${output}/report.json`, failure: report.failure }))
}
