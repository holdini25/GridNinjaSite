import { chooseStillImage } from "./inspection-actions.mjs"
import assert from "node:assert/strict"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { chromium } from "playwright"
import { assertFrameBudget, assertRendererBudget, provenance, verifiedBuildIdentity } from "./performance-contract.mjs"

if ((await verifiedBuildIdentity()).buildSettings.mode === "auto-adaptive") {
  await import("./verify-engineering-browser.mjs")
  process.exit(process.exitCode ?? 0)
}

const baseURL = process.env.FACILITY_BASE_URL ?? "http://localhost:3001"
const headed = process.env.FACILITY_HEADED === "1"
const angle = process.env.FACILITY_ANGLE
assert(!angle || angle === "metal", "FACILITY_ANGLE supports only metal")
const nativeRequested = headed && angle === "metal"
const output = nativeRequested ? "build/facility/browser-validation-native.json" : "build/facility/browser-validation.json"
await rm(output, { force: true })
const browser = await chromium.launch({
  headless: !headed,
  ...(angle ? { args: [`--use-angle=${angle}`, "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] } : {}),
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: headed ? 2 : 1 })
await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
const report = { baseURL, measuredAt: new Date().toISOString(), provenance: await provenance(browser.version(), { headed, angle: angle ?? "default", viewport: { width: 1440, height: 1000 }, deviceScaleFactor: headed ? 2 : 1, closeCycles: 10, routePairs: 3 }), environment: `Local ${headed ? "headed" : "headless"} Chromium, desktop viewport; not a mobile-device benchmark`, requestedAngle: angle ?? "default", browser: browser.version(), errors: [] }
page.on("pageerror", error => report.errors.push(error.message))
page.on("console", message => { if (message.type() === "error") report.errors.push(message.text()) })
const pause = milliseconds => page.waitForTimeout(milliseconds)
const inspector = page.getByTestId("facility-inspection")
const canvas = inspector.locator("canvas")
const ready = async () => {
  await page.waitForFunction(() => document.querySelector('[data-testid="facility-inspection"]')?.getAttribute("data-phase") === "ready", null, { timeout: 15_000 })
}
const frames = () => canvas.evaluate(element => element.__gnFacilitySnapshot().frames)
const stats = () => canvas.evaluate(element => element.__gnFacilitySnapshot())
const equipment = () => canvas.evaluate(element => element.__gnFacilitySnapshot(true).equipment)
const selectPoint = async (point, excursion = 0) => {
  const box = await canvas.boundingBox()
  const x = box.x + box.width * point[0], y = box.y + box.height * point[1]
  await page.mouse.move(x, y)
  await page.mouse.down()
  if (excursion) { await page.mouse.move(x + excursion, y); await page.mouse.move(x, y) }
  await page.mouse.up()
}
const selectedSystem = () => inspector.locator(".facility-explanation").getAttribute("data-system")
const clear = async () => {
  const button = inspector.getByRole("button", { name: "Clear selection", exact: true })
  if (await button.isEnabled()) await button.click()
}

try {
  await page.goto(baseURL, { waitUntil: "networkidle" })
  await inspector.scrollIntoViewIfNeeded()
  await ready()
  assert.equal(await inspector.getAttribute("data-release"), report.provenance.buildSettings.selectedRelease, "Served release differs from the measured build")
  report.graphics = await canvas.evaluate(element => {
    const context = element.getContext("webgl2")
    const info = context?.getExtension("WEBGL_debug_renderer_info")
    return {
      context: context ? "WebGL2" : "unavailable",
      renderer: info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unavailable",
      vendor: info ? context.getParameter(info.UNMASKED_VENDOR_WEBGL) : "unavailable",
      devicePixelRatio: window.devicePixelRatio,
      userAgent: navigator.userAgent,
    }
  })
  report.nativeAppleM5Metal = /Apple M5.*Metal|Metal.*Apple M5/i.test(report.graphics.renderer)
  report.renderingClass = /SwiftShader|llvmpipe|software/i.test(report.graphics.renderer) ? "software-emulation" : report.graphics.renderer === "unavailable" ? "unknown" : "hardware"
  if (nativeRequested) assert(report.nativeAppleM5Metal, `Native Metal requested but actual renderer is ${report.graphics.renderer}`)
  if (nativeRequested) await inspector.screenshot({ path: "build/facility/browser-native.png" })
  const activeBefore = await frames()
  const equipmentBefore = await equipment()
  if (nativeRequested) await canvas.screenshot({ path: "build/facility/equipment-before.png" })
  await pause(3_000)
  await page.waitForFunction(() => {
    const sample = document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.()
    return sample?.sampleCount >= 120 && Number.isFinite(sample.frameP95)
  }, null, { timeout: 15_000, polling: 250 })
  const activeAfter = await frames()
  assert(activeAfter > activeBefore + 30, "Equipment motion must keep rendering on an eligible visible desktop")
  report.active = { before: activeBefore, after: activeAfter, ...await stats() }
  const equipmentAfter = await equipment()
  if (nativeRequested) await canvas.screenshot({ path: "build/facility/equipment-after.png" })
  assert(equipmentAfter.fans.every((fan, index) => fan.phase !== equipmentBefore.fans[index].phase), "Every cooling fan must rotate")
  for (const fan of equipmentAfter.fans) assert.deepEqual(fan.axis, [0, 1, 0], "Fan must rotate around its authored local shaft")
  assert.notDeepEqual(equipmentBefore.ledColors, equipmentAfter.ledColors, "Rack activity LEDs did not change")
  if (report.provenance.buildSettings.selectedRelease === "facility-v3") {
    assert.equal(new Set(equipmentAfter.fans.map(fan => fan.phase.toFixed(6))).size, 4, "V3 fan phases must stay independent")
    for (let index = 0; index < equipmentAfter.ledColors.length; index += 3) {
      assert.equal(equipmentAfter.ledColors[index], equipmentAfter.ledColors[index + 1], "V3 activity may modulate brightness, not hue")
      assert.equal(equipmentAfter.ledColors[index], equipmentAfter.ledColors[index + 2], "V3 activity may modulate brightness, not hue")
    }
  }
  report.equipmentMotion = { before: equipmentBefore, after: equipmentAfter }
  assertRendererBudget(report.active)
  report.allocationTargetMet = report.active.peakEstimatedBytes <= 16 * 1024 * 1024
  report.desktopFrameTargetMet = Number.isFinite(report.active.frameP95) && report.active.frameP95 > 0 && report.active.frameP95 <= 20
  assert(Number.isFinite(report.active.frameP95) && report.active.sampleCount >= 120, "Missing complete active frame measurement")
  if (report.renderingClass === "hardware") assertFrameBudget(report.active, 20)

  await inspector.getByRole("button", { name: "Pause", exact: true }).click()
  await pause(250)
  const pauseBefore = await frames()
  const equipmentPaused = await equipment()
  await pause(350)
  const pauseAfter = await frames()
  assert.equal(pauseAfter, pauseBefore, "Paused scene continued rendering")
  report.paused = { before: pauseBefore, after: pauseAfter, renderer: await stats() }
  assertRendererBudget(report.paused.renderer, false)
  assert.deepEqual(await equipment(), equipmentPaused, "Paused fans or steady LEDs changed")

  await inspector.getByRole("button", { name: "Resume", exact: true }).click()
  await inspector.getByRole("checkbox", { name: "Equipment motion" }).uncheck()
  await pause(150)
  const equipmentDisabled = await equipment()
  await pause(250)
  assert.deepEqual(await equipment(), equipmentDisabled, "Disabled equipment continued animating")
  await inspector.getByRole("checkbox", { name: "Equipment motion" }).check()
  await page.emulateMedia({ reducedMotion: "reduce" })
  await pause(150)
  const equipmentReduced = await equipment()
  await pause(250)
  assert.deepEqual(await equipment(), equipmentReduced, "Reduced motion did not freeze fans and steady LEDs")
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await inspector.getByRole("button", { name: "Pause", exact: true }).click()
  report.equipmentPreferences = { paused: "frozen fans and steady LEDs", disabled: "frozen fans and steady LEDs", reducedMotion: "frozen fans and steady LEDs" }

  report.picking = {}
  const points = report.provenance.buildSettings.selectedRelease === "facility-v3"
    ? { power: [0.27, 0.27], cooling: [0.58, 0.20], storage: [0.62, 0.73], workloads: [0.45, 0.55] }
    : { power: [0.28, 0.47], cooling: [0.58, 0.32], storage: [0.67, 0.68], workloads: [0.45, 0.57] }
  report.pickingPoints = points
  for (const [system, point] of Object.entries(points)) {
    await selectPoint(point)
    await page.waitForFunction(expected => document.querySelector(".facility-explanation")?.getAttribute("data-system") === expected, system)
    report.picking[system] = await selectedSystem()
    await clear()
  }
  await selectPoint(points.workloads, 7)
  assert.equal(await selectedSystem(), "overview", "A gesture returning after >6px excursion must not select")
  await selectPoint(points.workloads, 6)
  assert.equal(await selectedSystem(), "workloads", "A six-pixel gesture should select")
  await clear()
  report.gestures = { sixPixels: "select", sevenPixelReturn: "cancel" }

  await inspector.getByRole("button", { name: "Resume", exact: true }).click()
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }))
  await pause(500)
  const hiddenBefore = await frames()
  const hiddenEquipment = await equipment()
  await pause(350)
  const hiddenAfter = await frames()
  assert.equal(hiddenAfter, hiddenBefore, "Offscreen scene continued rendering")
  report.offscreen = { before: hiddenBefore, after: hiddenAfter }
  assert.deepEqual(await equipment(), hiddenEquipment, "Hidden equipment moved")
  await inspector.scrollIntoViewIfNeeded()
  const resumedEquipment = await equipment()
  for (let index = 0; index < resumedEquipment.fans.length; index++) {
    const advance = (resumedEquipment.fans[index].phase - hiddenEquipment.fans[index].phase + Math.PI * 2) % (Math.PI * 2)
    assert(advance < 0.4, "Resume replayed hidden elapsed time")
  }

  const cdp = await page.context().newCDPSession(page)
  report.cycles = []
  for (let index = 0; index < 10; index++) {
    await chooseStillImage(inspector)
    assert.equal(await canvas.count(), 0)
    await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
    await ready()
    await cdp.send("HeapProfiler.collectGarbage")
    const heap = await cdp.send("Runtime.getHeapUsage")
    report.cycles.push({ cycle: index + 1, ...await stats(), usedJSHeapBytes: heap.usedSize })
  }
  for (const cycle of report.cycles) {
    assert.equal(cycle.geometries, report.cycles[0].geometries)
    assert.equal(cycle.textures, report.cycles[0].textures)
    assert.equal(cycle.estimatedBytes, report.cycles[0].estimatedBytes)
  }
  assert(report.cycles.at(-1).usedJSHeapBytes <= report.cycles[0].usedJSHeapBytes + 8 * 1024 * 1024, "Repeated sessions retained >8MiB of additional JS heap")

  // Follow real Next links within one document. Reduced motion makes lifecycle
  // allocation comparisons independent of refresh rate and animation work.
  await page.emulateMedia({ reducedMotion: "reduce" })
  const documentOrigin = await page.evaluate(() => performance.timeOrigin)
  let documentRequests = 0
  const countDocumentRequests = request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests++
  }
  page.on("request", countDocumentRequests)
  const openRoute = async (destination, activate = true) => {
    const link = destination === "/demo"
      ? page.getByRole("link", { name: "See a sample decision brief", exact: true }).first()
      : page.locator('header a[href="/"]').first()
    await link.click()
    await page.waitForURL(url => url.pathname === destination)
    await page.locator(destination === "/demo" ? ".facility-inspection--demo" : ".facility-inspection--hero").waitFor()
    assert.equal(await page.evaluate(() => performance.timeOrigin), documentOrigin, "Route navigation replaced the document")
    await inspector.scrollIntoViewIfNeeded()
    if (activate) {
      if (await inspector.getAttribute("data-phase") !== "ready") await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
      await ready()
    }
  }
  report.routeCycles = []
  for (let cycle = 1; cycle <= 3; cycle++) {
    for (const destination of ["/demo", "/"]) {
      await openRoute(destination)
      // R3F releases its renderer after its short deferred unmount window.
      await pause(650)
      await cdp.send("HeapProfiler.collectGarbage")
      const heap = await cdp.send("Runtime.getHeapUsage")
      const snapshot = { cycle, route: destination, ...await stats(), usedJSHeapBytes: heap.usedSize, canvasCount: await page.locator("canvas[data-facility-canvas]").count() }
      assert.equal(snapshot.canvasCount, 1, "A previous route retained its graphics canvas")
      assert.equal(snapshot.geometries, report.cycles[0].geometries)
      assert.equal(snapshot.textures, report.cycles[0].textures)
      assert.equal(snapshot.estimatedBytes, report.cycles[0].estimatedBytes)
      report.routeCycles.push(snapshot)
    }
  }
  // The first complete pair warms both Next route modules and their data caches.
  const warmHome = report.routeCycles[1]
  assert(report.routeCycles.at(-1).usedJSHeapBytes <= warmHome.usedJSHeapBytes + 8 * 1024 * 1024, "Repeated SPA navigation retained >8MiB beyond the warmed route pair")

  // Navigate away while a model response is held. Late completion must not
  // mount an abandoned session or alter the next page's static state.
  await chooseStillImage(inspector)
  const modelPattern = "**/assets/facility/**/facility.glb"
  let releaseRequest
  let requestSeen
  const held = new Promise(resolve => { releaseRequest = resolve })
  const seen = new Promise(resolve => { requestSeen = resolve })
  const delayModel = async route => {
    requestSeen()
    await held
    try { await route.continue() } catch { /* An aborted old session is expected. */ }
  }
  await page.route(modelPattern, delayModel)
  await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
  try {
    await Promise.race([seen, pause(5_000).then(() => { throw new Error("Model request was not intercepted for the navigation race") })])
    assert.equal(await inspector.getAttribute("data-phase"), "loading")
    await openRoute("/demo", false)
  } finally {
    releaseRequest()
    await page.unroute(modelPattern, delayModel)
  }
  await pause(650)
  assert.equal(await inspector.getAttribute("data-phase"), "poster", "An abandoned model load affected the new route")
  assert.equal(await page.locator("canvas[data-facility-canvas]").count(), 0)
  await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
  await ready()
  await openRoute("/")
  assert.equal(documentRequests, 0, "Navigation used a full document reload instead of the Next router")
  page.off("request", countDocumentRequests)
  report.navigation = { completedRoutePairs: 3, documentRequests, documentTimeOrigin: documentOrigin, abandonedLoad: "Old request cancelled; new route stayed static until explicit activation" }

  const lost = await canvas.evaluate(element => {
    const extension = element.getContext("webgl2")?.getExtension("WEBGL_lose_context")
    if (!extension) return false
    extension.loseContext()
    return true
  })
  if (lost) {
    await inspector.getByRole("button", { name: "Retry 3D", exact: true }).waitFor()
    assert.equal(await canvas.count(), 0)
    await inspector.getByRole("button", { name: "Retry 3D", exact: true }).click()
    await ready()
    report.contextLoss = "Restored static fallback, explicit retry produced a new ready session"
  } else report.contextLoss = "Unavailable in this graphics context"
  assert.deepEqual(report.errors, [])
  assert.deepEqual(await verifiedBuildIdentity(), { sourceRevision: report.provenance.sourceRevision, buildId: report.provenance.buildId, releases: report.provenance.releases, buildSettings: report.provenance.buildSettings }, "Build changed during browser verification")
  report.result = "pass"
} catch (error) {
  report.result = "fail"
  report.failure = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
} finally {
  await mkdir("build/facility", { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  await browser.close()
}
console.log(JSON.stringify({ result: report.result, frameP95: report.active?.frameP95, desktopFrameTargetMet: report.desktopFrameTargetMet, nativeAppleM5Metal: report.nativeAppleM5Metal, failure: report.failure, output }))
