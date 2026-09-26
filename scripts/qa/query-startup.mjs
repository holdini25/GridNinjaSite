import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium, devices } from "@playwright/test"
import { assertCompleteTransfer, collectTransfers, provenance, settleTransfers, verifiedBuildIdentity } from "../facility/performance-contract.mjs"
import { qaHarnessRevision } from "./candidate-contract.mjs"

export const QUERY_STARTUP_CASES = [
  { id: "demo-default", route: "/demo", scenario: "b" },
  { id: "demo-missing-evidence", route: "/demo?scenario=d&version=1.0.0&perspective=engineering", scenario: "d", perspective: "engineering" },
  { id: "demo-rack-topic", route: "/demo?scenario=b&version=1.0.0&perspective=business&focus=rack-02&topic=ai-cloud", scenario: "b", perspective: "business", focus: "rack-02", topic: "ai-cloud" },
  { id: "home-campaign", route: "/?utm_source=qa&utm_medium=validation&utm_campaign=release-candidate", scenario: "b" },
  { id: "assessment-topic", route: "/assessment?topic=ai-cloud&source=demo-final#scope", topic: "ai-cloud" },
]

export function localQueryBase(input) {
  const url = new URL(input)
  assert(["http:", "https:"].includes(url.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Query diagnostics are local-only")
  assert(!url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, "Use a bare local origin")
  return url.origin
}

/** Selector-derived facts are checked before and after enhancement. */
export function assertQueryPresentation(testCase, state, expected, { enhanced = false, settled = true } = {}) {
  const actual = new URL(state.url), requested = new URL(testCase.route, actual.origin)
  assert.equal(actual.pathname, requested.pathname, "Unexpected route substitution")
  for (const [key, value] of requested.searchParams) assert.equal(actual.searchParams.get(key), value, `Lost public query: ${key}`)
  if (!testCase.scenario) {
    if (settled) assert.equal(state.topic, testCase.topic, "Editable inquiry topic was not restored")
    assert.equal(state.canvases, 0, "Assessment scoping must not start graphics")
    return
  }
  assert(state.summary, "Authoritative summary is missing")
  assert.equal(state.summary.requested, expected.requested)
  assert.equal(state.summary.modeled, expected.modeled)
  assert(state.summary.text.includes(`Model screen: ${expected.screeningOutcome}`), "Screening result changed")
  if (actual.pathname === "/demo") {
    assert.equal(state.summary.scenario, testCase.scenario)
    for (const name of ["brief", "pdf", "json"]) assert(state.links.includes(expected.links[name]), `Exact publication destination missing: ${expected.links[name]}`)
    if (testCase.perspective) assert.equal(state.perspective, testCase.perspective)
  }
  if (testCase.focus) {
    assert(state.targetText.includes(expected.targetLabel), "Authored focused equipment identity missing")
    if (enhanced) assert(state.selectedEquipment.includes(testCase.focus), "Focused equipment is not committed after enhancement")
  }
}

function snapshot() {
  const viewer = document.querySelector('[data-testid="facility-inspection"]')
  const summary = document.querySelector('[data-testid="assessment-summary"]') ?? document.querySelector('[data-testid="facility-assessment-caption"]')
  const metric = label => [...(summary?.querySelectorAll("dt") ?? [])].find(node => node.textContent.trim() === label)?.parentElement?.querySelector("dd")?.textContent.trim() ?? null
  const canvas = viewer?.querySelector("canvas[data-ready=true]")
  const stage = viewer?.querySelector(".facility-stage"), box = stage?.getBoundingClientRect()
  const width = box ? Math.max(0, Math.min(innerWidth, box.right) - Math.max(0, box.left)) : 0
  const height = box ? Math.max(0, Math.min(innerHeight, box.bottom) - Math.max(0, box.top)) : 0
  let renderer = null
  if (canvas) {
    const gl = canvas.getContext("webgl2"), debug = gl?.getExtension("WEBGL_debug_renderer_info")
    renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable"
  }
  return {
    url: location.href, timeOrigin: performance.timeOrigin,
    summary: summary ? { scenario: summary.getAttribute("data-scenario"), requested: metric("Requested increment"), modeled: metric("Modeled eligible increment"), text: summary.textContent } : null,
    links: [...document.querySelectorAll("a[href]")].map(link => { const url = new URL(link.href); return url.pathname + url.search + url.hash }),
    perspective: document.querySelector('#assessment-perspective, #perspective, select[name="perspective"]')?.value ?? null,
    topic: document.querySelector('#contact-topic, input[name="topic"]')?.value ?? null,
    targetText: [...document.querySelectorAll(".facility-target-label")].map(node => node.textContent).join(" "),
    selectedEquipment: [...document.querySelectorAll('[data-public-equipment-id][aria-pressed="true"]')].map(node => node.getAttribute("data-public-equipment-id")),
    canvases: document.querySelectorAll("canvas[data-facility-canvas]").length,
    viewer: viewer ? { phase: viewer.getAttribute("data-phase"), release: viewer.getAttribute("data-release"), view: viewer.getAttribute("data-view"), quality: viewer.getAttribute("data-quality") } : null,
    policy: { visible: document.visibilityState, finePointer: matchMedia("(pointer:fine)").matches, hover: matchMedia("(hover:hover)").matches, reducedMotion: matchMedia("(prefers-reduced-motion:reduce)").matches, connection: navigator.connection ? { saveData: navigator.connection.saveData, effectiveType: navigator.connection.effectiveType } : null, stageFraction: box?.width > 0 && box?.height > 0 ? width * height / (box.width * box.height) : 0 },
    renderer, lifecycle: window.__gnQueryPhases ?? [], vitals: window.__gnQueryVitals ?? null,
    navigation: performance.getEntriesByType("navigation")[0]?.toJSON() ?? null,
  }
}

async function revealStage(page) {
  await page.bringToFront()
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await page.getByTestId("facility-inspection").locator(".facility-stage").scrollIntoViewIfNeeded(); break }
    catch (error) { if (!String(error).includes("Element is not attached to the DOM") || attempt === 2) throw error }
  }
  await page.waitForFunction(() => {
    const box = document.querySelector('[data-testid="facility-inspection"] .facility-stage')?.getBoundingClientRect()
    if (!box || document.visibilityState !== "visible") return false
    const width = Math.max(0, Math.min(innerWidth, box.right) - Math.max(0, box.left)), height = Math.max(0, Math.min(innerHeight, box.bottom) - Math.max(0, box.top))
    return box.width * box.height > 0 && width * height / (box.width * box.height) >= .25
  }, null, { timeout: 12_000, polling: 100 })
}

async function main() {
  const baseURL = localQueryBase(process.env.QA_BASE_URL ?? process.env.FACILITY_BASE_URL ?? "http://127.0.0.1:3000")
  const at = process.argv.indexOf("--out"), output = at < 0 ? `build/qa/query-startup-${new Date().toISOString().replace(/[:.]/g, "-")}` : process.argv[at + 1]
  assert(output, "--out needs a fresh directory")
  await mkdir(dirname(output), { recursive: true }); await mkdir(output) // Preserve every previous attempt.
  await import("../assessment/register.mjs")
  const [{ assessmentFixtures }, { selectAssessment }] = await Promise.all([import("../../src/content/assessments/fixtures.ts"), import("../../src/lib/assessment/selectors.ts")])
  const identity = await verifiedBuildIdentity(), harness = await qaHarnessRevision()
  const manifest = JSON.parse(await readFile(`src/content/facility-releases/${identity.buildSettings.selectedRelease}/manifest.json`, "utf8"))
  const profiles = (process.env.QA_QUERY_PROFILES ?? "desktop,mobile-emulation").split(",")
  assert(profiles.length > 0 && new Set(profiles).size === profiles.length && profiles.every(profile => ["desktop", "mobile-emulation"].includes(profile)), "Unknown or duplicate query profile")
  const headed = process.env.FACILITY_HEADED === "1", metal = process.env.FACILITY_ANGLE === "metal"
  assert(!process.env.FACILITY_ANGLE || metal, "Only the metal angle override is supported")
  const browser = await chromium.launch({ channel: "chrome", headless: !headed, ...(metal ? { args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] } : {}) })
  const settings = { baseURL, profiles, cases: QUERY_STARTUP_CASES, cache: "Fresh context + cleared cache for cold; same context with cache enabled for warm full navigation", headed, metal, readinessObservationTimeoutMs: 12_000, runtimeGraphicsDeadlineMs: 8_000, timing: "Unthrottled local diagnostics only; no new LCP/TBT gate and no substitute for five-run Lighthouse" }
  const report = { schemaVersion: "gridninja-query-startup.v1", provenance: await provenance(browser.version(), settings), qaHarnessRevision: harness, startedAt: new Date().toISOString(), result: "incomplete", results: [] }
  try {
    for (const profile of profiles) for (const testCase of QUERY_STARTUP_CASES) {
      const context = await browser.newContext({ ...(profile === "desktop" ? { viewport: { width: 1440, height: 1100 } } : devices["Pixel 5"]), reducedMotion: "no-preference" })
      const page = await context.newPage()
      await page.addInitScript(() => {
        window.__GN_FACILITY_DIAGNOSTICS__ = true
        window.__gnQueryPhases = []; window.__gnQueryVitals = { lcp: 0, cls: 0 }
        let previous = null
        new MutationObserver(() => { const phase = document.querySelector('[data-testid="facility-inspection"]')?.getAttribute("data-phase"); if (phase && phase !== previous) { previous = phase; if (window.__gnQueryPhases.length < 32) window.__gnQueryPhases.push({ phase, atMs: performance.now() }) } }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-phase"] })
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__gnQueryVitals.lcp = entry.startTime }).observe({ type: "largest-contentful-paint", buffered: true })
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__gnQueryVitals.cls += entry.value }).observe({ type: "layout-shift", buffered: true })
      })
      let priorTimeOrigin = null
      try {
        for (const cache of ["cold", "warm"]) {
          const cdp = await context.newCDPSession(page), ledger = await collectTransfers(cdp)
          // The shared collector disables cache for five-run measurements. Here
          // actual cache-enabled cold/warm behavior is the explicit diagnostic.
          await cdp.send("Network.setCacheDisabled", { cacheDisabled: false })
          if (cache === "cold") await cdp.send("Network.clearBrowserCache")
          const result = { case: testCase.id, route: testCase.route, profile, cache, status: "incomplete", errors: [], cachedResponses: [], servedFromCacheRequestIds: [], phase: "navigation" }
          const onError = error => result.errors.push(error.message)
          const onConsole = message => { if (message.type() === "error") result.errors.push(`console: ${message.text()}`) }
          page.on("pageerror", onError); page.on("console", onConsole)
          cdp.on("Network.requestServedFromCache", event => result.servedFromCacheRequestIds.push(event.requestId))
          cdp.on("Network.responseReceived", event => { if (event.response.fromDiskCache || event.response.fromPrefetchCache || event.response.fromServiceWorker) result.cachedResponses.push({ url: event.response.url, disk: Boolean(event.response.fromDiskCache), prefetch: Boolean(event.response.fromPrefetchCache), serviceWorker: Boolean(event.response.fromServiceWorker) }) })
          report.results.push(result)
          try {
            const expected = testCase.scenario ? { ...selectAssessment(assessmentFixtures[testCase.scenario]), targetLabel: manifest.equipmentIndex?.equipment.find(item => item.id === testCase.focus)?.label } : null
            const response = await page.goto(baseURL + testCase.route, { waitUntil: "load", timeout: 30_000 })
            assert(response?.ok(), "Query document did not load successfully")
            result.initial = await page.evaluate(snapshot); result.initialTransfer = ledger.snapshot()
            assertQueryPresentation(testCase, result.initial, expected, { settled: false })
            if (priorTimeOrigin !== null) assert.notEqual(result.initial.timeOrigin, priorTimeOrigin, "Warm full navigation did not replace the document")
            if (testCase.scenario) {
              result.phase = "viewer-eligibility"; await revealStage(page)
              const eligibility = await page.evaluate(snapshot), policy = eligibility.policy
              const deviceEligible = identity.buildSettings.mode === "auto-adaptive" || (identity.buildSettings.mode === "auto-desktop" && policy.finePointer && policy.hover && profile === "desktop" && !policy.reducedMotion)
              result.automaticExpected = deviceEligible && !policy.connection?.saveData && !["slow-2g", "2g", "3g"].includes(policy.connection?.effectiveType)
              result.phase = "viewer-readiness"
              if (result.automaticExpected) await page.locator("canvas[data-ready=true]").waitFor({ timeout: settings.readinessObservationTimeoutMs })
              else await page.waitForTimeout(1_700)
            } else {
              result.automaticExpected = false
              // Public query attribution is restored during form hydration.
              // Record the initial value, then verify the settled editable value.
              await page.waitForFunction(topic => document.querySelector("#contact-topic")?.value === topic, testCase.topic, { timeout: 10_000 })
            }
            result.phase = "transfer-settle"; result.transfer = await settleTransfers(ledger)
            assertCompleteTransfer(result.transfer)
            result.final = await page.evaluate(snapshot)
            assertQueryPresentation(testCase, result.final, expected, { enhanced: Boolean(result.automaticExpected) })
            const models = result.transfer.requests.filter(item => new URL(item.url).pathname.endsWith("/facility.glb"))
            assert.equal(models.length > 0, result.automaticExpected, "Incorrect automatic model loading policy")
            assert(!result.transfer.requests.some(item => /\/(rack|cooling)\.glb$/.test(new URL(item.url).pathname)), "A specimen downloaded without explicit activation")
            assert.equal(result.final.canvases, result.automaticExpected ? 1 : 0, "Unexpected canvas count")
            if (testCase.scenario) {
              assert.equal(result.final.viewer.release, identity.buildSettings.selectedRelease)
              assert.equal(result.final.viewer.phase, result.automaticExpected ? "ready" : "poster")
            }
            assert.deepEqual(result.errors, [])
            await page.screenshot({ path: `${output}/${testCase.id}-${profile}-${cache}.png` })
            priorTimeOrigin = result.final.timeOrigin; result.phase = "complete"; result.status = "pass"
          } catch (error) {
            result.status = "fail"; result.failure = error instanceof Error ? error.message : String(error)
            result.transfer ??= ledger.snapshot(); result.failureSnapshot = await page.evaluate(snapshot).catch(() => null)
          } finally {
            page.off("pageerror", onError); page.off("console", onConsole); await cdp.detach()
            // Abort/dispose the old document before starting the next ledger;
            // its late requests cannot masquerade as warm-navigation transfer.
            await page.goto("about:blank")
          }
          console.log(JSON.stringify({ case: result.case, profile, cache, status: result.status, bytes: result.transfer?.bytes, failure: result.failure }))
        }
      } finally { await context.close() }
    }
    assert.equal(report.results.length, profiles.length * QUERY_STARTUP_CASES.length * 2)
    assert.deepEqual(await verifiedBuildIdentity(), identity); assert.equal(await qaHarnessRevision(), harness)
    report.result = report.results.every(result => result.status === "pass") ? "pass" : "fail"
  } catch (error) { report.result = "fail"; report.failure = error instanceof Error ? error.message : String(error) }
  finally { await browser.close(); report.finishedAt = new Date().toISOString(); await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + "\n") }
  if (report.result !== "pass") process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
