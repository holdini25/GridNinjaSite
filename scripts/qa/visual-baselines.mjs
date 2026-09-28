import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { arch, platform, release as osRelease } from "node:os"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { verifiedBuildIdentity } from "../facility/performance-contract.mjs"
import { hashEvidence } from "./candidate-contract.mjs"
import { chooseAssembly, choosePose } from "../facility/inspection-actions.mjs"
import { captureVisitedReviewPage } from "../facility/review-page-capture.mjs"

const args = process.argv.slice(2), option = (key, fallback) => { const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1] }
const baseURL = process.env.QA_BASE_URL ?? "http://127.0.0.1:3000"
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(baseURL).hostname), "Visual candidate capture is local-only")
const output = option("--out", "build/qa/visual-candidate"), baselinePath = option("--baseline")
const report = { schemaVersion: "gridninja-visual.v1", status: "unreviewed", capturedAt: new Date().toISOString(), identity: await verifiedBuildIdentity(), environment: { platform: platform(), arch: arch(), os: osRelease(), browser: "" }, captures: [], pagePainting: [], errors: [], blockedOutbound: [], blockedSubmissions: [] }
await mkdir(dirname(output), { recursive: true })
await mkdir(output) // Never overwrite a prior attempt or approved golden.
const browser = await chromium.launch({ channel: "chrome" })
report.environment.browser = browser.version()
async function setup(viewport, dpr) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, reducedMotion: "reduce", colorScheme: "dark", locale: "en-US", timezoneId: "America/New_York", hasTouch: viewport.width < 768 })
  const page = await context.newPage()
  page.on("pageerror", error => report.errors.push(error.message))
  // Same local Turnstile API contract and 300×65 geometry used by the
  // contact-layout fixture; never consult the live provider or submit a form.
  await page.route("**/*", async route => {
    const url = new URL(route.request().url())
    if (url.origin === new URL(baseURL).origin) {
      if (url.pathname === "/api/contact" && route.request().method() !== "GET") {
        report.blockedSubmissions.push({ page: page.url(), method: route.request().method() })
        return route.abort("blockedbyclient")
      }
      return route.continue()
    }
    if (url.origin === "https://challenges.cloudflare.com" && url.pathname === "/turnstile/v0/api.js") return route.fulfill({ status: 200, contentType: "application/javascript", body: `
      window.turnstile = {
        render(container, options) {
          const widget = document.createElement("div");
          widget.style.width = "300px"; widget.style.height = "65px";
          widget.dataset.testTurnstile = "ready"; container.appendChild(widget);
          queueMicrotask(() => options.callback("local-visual-fixture-token"));
          return "local-visual-fixture";
        }, reset() {}, remove() {}
      };
    ` })
    report.blockedOutbound.push({ origin: url.origin, path: url.pathname })
    return route.abort("blockedbyclient")
  })
  await page.addInitScript(() => {
    window.__GN_FACILITY_DIAGNOSTICS__ = true
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } })
  })
  return { context, page }
}
async function capture(page, locator, name, settings, state = null) {
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  const path = join(output, `${name}.png`)
  await locator.screenshot({ path, animations: "disabled", caret: "hide" })
  report.captures.push({ name, settings, state, ...await hashEvidence(path) })
}
async function scrollFacilityStage(inspector) {
  // Resolve a fresh stage only for the known server-shell replacement. Other
  // errors and a third detached-node failure remain visible capture failures.
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await inspector.locator(".facility-stage").scrollIntoViewIfNeeded(); return }
    catch (error) { if (!String(error).includes("Element is not attached to the DOM") || attempt === 2) throw error }
  }
}
try {
  // Page surfaces use Save-Data to keep graphics out of deterministic layout review.
  for (const width of [320, 390, 768, 1366, 1920]) {
    const viewport = { width, height: width < 768 ? 844 : 900 }, { context, page } = await setup(viewport, 1)
    try {
      for (const route of ["/", "/demo", "/assessment", "/contact"]) {
        await page.goto(baseURL + route)
        let htmlState
        if (route === "/" || route === "/demo") {
          const inspector = page.getByTestId("facility-inspection")
          await scrollFacilityStage(inspector)
          await inspector.locator(".facility-systems").getByRole("button", { name: "Power", exact: true }).waitFor({ state: "visible" })
          await page.waitForFunction(() => document.querySelector('[data-testid="facility-inspection"]')?.dataset.phase === "poster")
          await inspector.locator(".facility-poster img").evaluate(image => image.decode())
          assert.equal(await inspector.locator("canvas").count(), 0)
          htmlState = "enhanced-html-decoded-poster-save-data"
        } else {
          // Engage only the optional topic field; required empty inputs stay
          // untouched and no blur-validation error is deliberately introduced.
          await page.locator("#contact-topic").focus()
          await page.locator('[data-test-turnstile="ready"]').waitFor({ state: "visible" })
          await page.getByText("Security verification complete.", { exact: true }).waitFor({ state: "visible" })
          await page.locator("#contact-topic").evaluate(element => element.blur())
          assert.equal(await page.locator('.gn-lead-form [aria-invalid="true"]').count(), 0)
          assert.equal(await page.locator("#contact-name").inputValue(), "")
          assert.equal(await page.locator("#contact-email").inputValue(), "")
          assert.equal(await page.locator("#contact-company").inputValue(), "")
          htmlState = "empty-form-local-verification-fixture-ready"
        }
        const name = `${route === "/" ? "home" : route.slice(1)}-${width}`
        await page.mouse.move(0, 0)
        await page.evaluate(() => document.fonts.ready)
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }))
        const path = join(output, `${name}.png`)
        const painting = await captureVisitedReviewPage(page, path)
        report.pagePainting.push({ name, ...painting })
        assert.equal(await page.evaluate(() => window.scrollY), 0)
        report.captures.push({ name, settings: { route, viewport, dpr: 1, mode: "static", htmlState, painting: painting.conditioning, verification: route === "/assessment" || route === "/contact" ? "local-fixture-not-provider-validation" : "not-present" }, state: null, ...await hashEvidence(path) })
      }
    } finally { await context.close() }
  }
  for (const [name, viewport, dpr] of [["desktop-1", { width: 1366, height: 1100 }, 1], ["desktop-1_5", { width: 1366, height: 1100 }, 1.5], ["mobile-1", { width: 390, height: 844 }, 1]]) {
    const { context, page } = await setup(viewport, dpr)
    try {
      await page.goto(`${baseURL}/demo?scenario=b&perspective=engineering`)
      const inspector = page.getByTestId("facility-inspection"), stage = inspector.locator(".facility-stage")
      await scrollFacilityStage(inspector)
      await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
      await inspector.locator("canvas[data-ready=true]").waitFor()
      const shot = async state => {
        await scrollFacilityStage(inspector); await page.mouse.move(0, 0)
        const canvas = inspector.locator("canvas[data-ready=true]")
        await canvas.evaluate((element, ratio) => element.__gnFacilityReviewDpr(ratio), dpr)
        await page.waitForFunction(() => {
          const state = document.querySelector("canvas[data-ready=true]")?.__gnFacilitySnapshot?.()
          return state && state.schedulerPending === 0 && state.transitionRemaining === 0 && !state.rackMotion?.moving && state.clockSeconds >= state.interactionUntil
        }, undefined, { timeout: 5000 })
        const snapshot = await canvas.evaluate(element => element.__gnFacilitySnapshot(true))
        assert.equal(snapshot.dpr, dpr)
        await capture(page, stage, `${name}-${state}`, { viewport, dpr, mode: "reduced-motion", route: "/demo?scenario=b&perspective=engineering", seed: "frozen release profile", camera: snapshot.cameraProjection }, snapshot)
      }
      await shot("overview")
      for (const system of ["Power", "Cooling", "Storage", "Workloads"]) { await inspector.locator(".facility-systems").getByRole("button", { name: system, exact: true }).click(); await shot(system.toLowerCase()) }
      for (const kind of ["rack", "cooling"]) {
        await chooseAssembly(inspector, kind)
        await page.waitForFunction(kind => document.querySelector('[data-testid="facility-inspection"]')?.dataset.view === kind, kind)
        for (const pose of ["closed", "cutaway", "service"]) { await choosePose(inspector, kind, pose); await page.waitForFunction(pose => document.querySelector('[data-testid="facility-inspection"]')?.dataset.pose === pose, pose); await shot(`${kind}-${pose}`) }
      }
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.blockedSubmissions, [], "A visual capture attempted form submission")
  assert.deepEqual(report.blockedOutbound, [], "A visual capture attempted an unapproved outbound request")
  assert.equal(report.captures.length, 53, "The frozen capture matrix must contain exactly 53 named states")
  assert.deepEqual(await verifiedBuildIdentity(), report.identity, "Production source/build changed during capture")
  if (baselinePath) {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8"))
    assert(baseline.approvedBy && baseline.approvedAt && baseline.status === "approved", "Golden baseline must have explicit human approval")
    assert.deepEqual(report.environment, baseline.environment, "Golden comparisons require the same pinned browser/OS environment")
    assert.equal(report.captures.length, baseline.captures.length, "Golden capture matrix changed")
    for (const current of report.captures) {
      const previous = baseline.captures.find(item => item.name === current.name)
      assert(previous, `Missing golden: ${current.name}`)
      assert.deepEqual(current.settings, previous.settings, "Golden viewport/camera/DPR/settings changed")
      assert.equal((await hashEvidence(previous.path)).sha256, previous.sha256, "Golden bytes changed after approval")
      const a = await sharp(current.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), b = await sharp(previous.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      assert.deepEqual(a.info, b.info, `${current.name}: capture dimensions changed`)
      let changed = 0
      for (let index = 0; index < a.data.length; index += 4) if ([0, 1, 2].some(channel => Math.abs(a.data[index + channel] - b.data[index + channel]) > 12)) changed++
      current.changedPixelRatio = changed / (a.info.width * a.info.height)
      assert(current.changedPixelRatio <= (current.settings.mode === "static" ? .001 : .005), `${current.name}: visual regression ${current.changedPixelRatio}`)
    }
    report.status = "comparison-pass"
  }
} catch (error) { report.status = "fail"; report.errors.push(error instanceof Error ? error.message : String(error)); process.exitCode = 1 }
finally { await browser.close(); await writeFile(join(output, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`); console.log(`${report.status}: ${report.captures.length} captures. Capture success is not visual approval.`) }
