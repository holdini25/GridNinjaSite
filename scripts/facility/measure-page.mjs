import assert from "node:assert/strict"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { chromium, devices } from "@playwright/test"
import { assertCompleteTransfer, assertCadenceBudget, assertFrameBudget, assertRendererBudget, assertSettlementEvidence, collectTransfers, provenance, settleTransfers, verifiedBuildIdentity } from "./performance-contract.mjs"

const baseURL = process.env.FACILITY_BASE_URL ?? "http://localhost:3000"
await rm("build/facility/page-measurements.json", { force: true })
const runCount = Number(process.env.FACILITY_RUNS ?? 5)
assert(Number.isInteger(runCount) && runCount >= 1 && runCount <= 5)
const headed = process.env.FACILITY_HEADED === "1"
const angle = process.env.FACILITY_ANGLE
const launchSettings = { headless: !headed, channel: process.env.FACILITY_CHROME_CHANNEL ?? "chrome", ...(angle === "metal" ? { args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] } : {}) }
const browser = await chromium.launch(launchSettings)
const settings = { baseURL, runCount, freshContextEveryRun: true, cacheDisabled: true, settleQuietMs: 750, settleTimeoutMs: 15_000, readinessTimeoutMs: 12_000, pauseSettleTimeoutMs: 1_000, pauseIdleQuietMs: 250, pauseObservationMs: 500, desktopViewport: { width: 1440, height: 1100 }, mobileDevice: "Pixel 5", capabilityFps: 60, ambientFps: 30, capabilityFrameLimitsMs: { desktop: 20, mobile: 34 }, launch: launchSettings }
const report = { measuredAt: new Date().toISOString(), provenance: await provenance(browser.version(), settings), results: [], result: "incomplete" }
await mkdir("build/facility", { recursive: true })

async function revealStage(page, inspector) {
  await page.bringToFront()
  // The deferred preview can swap for the interactive viewer as scrolling
  // brings it into view. Resolve the stage again only for that expected race.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await inspector.locator(".facility-stage").scrollIntoViewIfNeeded()
      break
    } catch (error) {
      if (!String(error).includes("Element is not attached to the DOM") || attempt === 2) throw error
    }
  }
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-testid="facility-inspection"] .facility-stage')
    if (document.visibilityState !== "visible" || !stage) return false
    const rect = stage.getBoundingClientRect()
    const width = Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left))
    const height = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top))
    return rect.width > 0 && rect.height > 0 && width * height / (rect.width * rect.height) >= .25
  }, null, { timeout: settings.readinessTimeoutMs, polling: 250 })
}

function presentationSnapshot() {
  const inspector = document.querySelector('[data-testid="facility-inspection"]')
  const stage = inspector?.querySelector(".facility-stage"), canvas = inspector?.querySelector("canvas[data-facility-canvas]")
  const rect = stage?.getBoundingClientRect()
  const width = rect ? Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) : 0
  const height = rect ? Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) : 0
  const pause = inspector?.querySelector('.facility-view-controls button[aria-pressed]')
  const equipment = inspector?.querySelector('.facility-equipment input[type="checkbox"]')
  let renderer = null, rendererError = null
  try { renderer = canvas?.__gnFacilitySnapshot?.() ?? null } catch (error) { rendererError = String(error) }
  return {
    renderer, rendererError, documentVisibility: document.visibilityState, documentHasFocus: document.hasFocus(),
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    stage: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height, intersectionRatio: rect.width > 0 && rect.height > 0 ? width * height / (rect.width * rect.height) : 0 } : null,
    inspector: inspector ? { phase: inspector.dataset.phase, view: inspector.dataset.view, pose: inspector.dataset.pose, quality: inspector.dataset.quality, failure: inspector.dataset.failure } : null,
    controls: { paused: pause ? pause.getAttribute("aria-pressed") === "true" : null, pauseLabel: pause?.getAttribute("aria-label") ?? null, equipmentEnabled: equipment?.checked ?? null, equipmentDisabled: equipment?.disabled ?? null },
  }
}

try {
  for (const route of ["/", "/demo"]) for (const profile of ["desktop", "mobile-emulation"]) for (let run = 1; run <= runCount; run++) {
    const context = await browser.newContext(profile === "desktop" ? { viewport: settings.desktopViewport } : devices["Pixel 5"])
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    const ledger = await collectTransfers(cdp)
    const result = { route, profile, run, freshContext: true, complete: false, phase: "navigation", budgetFailures: [], pageErrors: [] }
    page.on("pageerror", error => result.pageErrors.push({ phase: result.phase, message: error.message }))
    const checkBudget = check => { try { check() } catch(error) { result.budgetFailures.push(error instanceof Error ? error.message : String(error)) } }
    report.results.push(result)
    try {
      await page.addInitScript(() => {
        window.__GN_FACILITY_DIAGNOSTICS__ = true
        window.__facilityVitals = { lcp: 0, cls: 0 }
        // Existing 250ms observers also preserve bounded pre-fallback evidence.
        // This does not schedule frames or change the application's cadence.
        window.__facilityAmbientDiagnostics = []
        window.__facilityObserveAmbient = snapshot => {
          if (!snapshot) return
          const samples = window.__facilityAmbientDiagnostics
          if (samples.length < 128) samples.push({ atMs: performance.now(), quality: snapshot.quality, targetFps: snapshot.targetFps, sampleCount: snapshot.sampleCount, frameP95: snapshot.frameP95, cpuP95: snapshot.cpuP95, missedRatio: snapshot.missedRatio, tierHistory: snapshot.tierHistory })
        }
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__facilityVitals.lcp = entry.startTime }).observe({ type: "largest-contentful-paint", buffered: true })
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__facilityVitals.cls += entry.value }).observe({ type: "layout-shift", buffered: true })
      })
      await page.goto(baseURL + route, { waitUntil: "load", timeout: 30_000 })
      const inspector = page.getByTestId("facility-inspection")
      const adaptive = report.provenance.buildSettings.mode === "auto-adaptive"
      if (profile === "desktop" || adaptive) {
        result.phase = "initial-stage-visibility"
        await revealStage(page, inspector)
        result.phase = "initial-viewer-readiness"
        await inspector.locator("canvas[data-ready=true]").waitFor({ timeout: settings.readinessTimeoutMs })
      } else { result.phase = "poster-decode"; await inspector.locator("img").evaluate(image => image.decode()) }
      result.phase = "transfer-settle"
      result.transfer = await settleTransfers(ledger)
      checkBudget(()=>assertCompleteTransfer(result.transfer))
      const model = result.transfer.requests.find(request => new URL(request.url).pathname.endsWith("/facility.glb"))
      assert(profile === "desktop" || adaptive ? !!model : !model, "Incorrect automatic model activation")
      result.throughReady = profile === "desktop" || adaptive
      assert(!result.transfer.requests.some(request=>/\/(rack|cooling)\.glb$/.test(new URL(request.url).pathname)), "Specimen downloaded automatically")
      result.release = await inspector.getAttribute("data-release")
      assert.equal(result.release, report.provenance.buildSettings.selectedRelease, "Served facility release differs from the measured build")
      result.vitals = await page.evaluate(() => window.__facilityVitals)
      if (profile !== "desktop" && !adaptive) {
        result.phase = "manual-activation"
        await inspector.getByRole("button", { name: "Explore in 3D" }).click()
        await inspector.locator("canvas[data-ready=true]").waitFor({ timeout: settings.readinessTimeoutMs })
        await inspector.getByRole("checkbox", { name: "Equipment motion" }).check()
      }
      result.phase = "measurement-stage-visibility"
      await revealStage(page, inspector)
      result.phase = "graphics-identity"
      result.graphics = await inspector.locator("canvas").evaluate(canvas => {
        const gl = canvas.getContext("webgl2"), debug = gl?.getExtension("WEBGL_debug_renderer_info")
        return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable", vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : "unavailable" }
      })
      result.renderingClass = /SwiftShader|llvmpipe|software/i.test(result.graphics.renderer) ? "software-emulation" : result.graphics.renderer === "unavailable" ? "unknown" : "hardware"
      if(adaptive){
        result.phase = "ambient-policy-settle"
        await page.mouse.move(0,0)
        await page.waitForFunction(()=>{const s=document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.();window.__facilityObserveAmbient(s);return s?.quality==="still"||(s?.targetFps===30&&!s.qualityProbe&&s.transitionRemaining===0&&s.clockSeconds>s.interactionUntil)},null,{timeout:15000,polling:250})
        await inspector.locator("canvas").evaluate(canvas=>canvas.__gnFacilityCapability(null))
      }
      result.phase = "ambient-samples"
      result.ambientStart = await page.evaluate(presentationSnapshot)
      await page.waitForFunction(() => {
        const snapshot = document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.()
        window.__facilityObserveAmbient(snapshot)
        return (snapshot?.sampleCount >= 120 && Number.isFinite(snapshot.frameP95)) || snapshot?.quality === "still"
      }, null, { timeout: 12_000, polling: 250 })
      result.renderer = await inspector.locator("canvas").evaluate(canvas => ({ ...canvas.__gnFacilitySnapshot(), buffer: [canvas.width, canvas.height] }))
      checkBudget(()=>assertRendererBudget(result.renderer))
      result.allocationTargetMet = result.renderer.peakEstimatedBytes <= 16 * 1024 * 1024
      result.ambientDiagnostics = await page.evaluate(() => window.__facilityAmbientDiagnostics)
      result.ambientCadence = result.renderer.quality === "still"
        ? { status: "not-applicable", reason: "Interactive Still requests no continuing ambient cadence; this is not a successful 30fps measurement. Static settlement and independent fixed-cadence capability remain required." }
        : { status: "measured", reason: "Active-tier cadence is checked against requested slots." }
      // Keep any complete active-tier violation observed before a later fallback.
      if (result.renderingClass === "hardware") for (const sample of result.ambientDiagnostics) if (sample.quality !== "still" && sample.sampleCount >= 120) checkBudget(() => assertCadenceBudget(sample))
      if (adaptive) {
        if(result.renderer.quality!=="still")assert.equal(result.renderer.targetFps,30,"Ambient measurement included an interaction boost")
        if(result.renderingClass === "hardware" && result.renderer.quality !== "still") checkBudget(()=>assertCadenceBudget(result.renderer))
        result.ambientFallback = result.renderer.quality === "still" ? "interactive-still" : null
        result.phase = "capability-stage-visibility"
        await revealStage(page, inspector)
        result.phase = "capability-samples"
        await inspector.locator("canvas").evaluate((canvas,fps)=>canvas.__gnFacilityCapability(fps),settings.capabilityFps)
        await page.waitForFunction(()=>document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.().sampleCount >= 120,null,{timeout:result.renderingClass === "hardware" ? 15000 : 30000,polling:250})
        result.capability = await inspector.locator("canvas").evaluate(canvas=>canvas.__gnFacilitySnapshot())
        await inspector.locator("canvas").evaluate(canvas=>canvas.__gnFacilityCapability(null))
      } else result.capability = result.renderer
      result.frameBudgetMet = result.capability.frameP95 > 0 && result.capability.frameP95 <= (profile === "desktop" ? 20 : 34)
      if (result.renderingClass === "hardware") checkBudget(()=>assertFrameBudget(result.capability, profile === "desktop" ? 20 : 34))
      // Still is a supported policy result, not an explicit user pause. Keep
      // capability/transfer/cadence checks above unchanged and label this proof.
      const tierAtSettlement = await inspector.locator("canvas").evaluate(canvas => canvas.__gnFacilitySnapshot().quality)
      const settlementMode = adaptive && tierAtSettlement === "still" ? "adaptive-still" : "explicit-pause"
      result.phase = settlementMode === "adaptive-still" ? "still-stability" : "pause-stability"
      if (settlementMode === "explicit-pause") await inspector.getByRole("button", { name: "Pause", exact: true }).click()
      else {
        await page.waitForFunction(() => {
          const inspector = document.querySelector('[data-testid="facility-inspection"]')
          return inspector?.dataset.quality === "still" && inspector.querySelector(".facility-state-label")?.textContent?.trim() === "Still for performance"
        }, null, { timeout: settings.pauseSettleTimeoutMs })
        assert.equal(await inspector.getByRole("button", { name: /^(Pause|Resume)$/, exact: true }).count(), 0, "Still must not claim ongoing activity or an explicit Pause state")
      }
      // The click can scroll the toolbar and clear pointer previews. Both modes
      // must reach observed quiescence with the same existing bounded interval.
      const settle = await page.evaluate(async ({ timeout, quiet, mode }) => {
        const started = performance.now()
        let idleSince = null, previousFrames = null
        while (performance.now() - started < timeout) {
          const inspector = document.querySelector('[data-testid="facility-inspection"]')
          const snapshot = inspector?.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.()
          const pause = inspector?.querySelector('.facility-view-controls button[aria-pressed]')
          const motionState = mode === "adaptive-still"
            ? snapshot?.quality === "still" && inspector?.dataset.quality === "still" && !pause && inspector?.querySelector(".facility-state-label")?.textContent?.trim() === "Still for performance"
            : pause?.getAttribute("aria-pressed") === "true"
          const idle = motionState && snapshot?.schedulerPending === 0 && snapshot.transitionRemaining === 0 && snapshot.interactionUntil <= snapshot.clockSeconds
          const now = performance.now()
          if (!idle || previousFrames !== snapshot?.frames) idleSince = idle ? now : null
          previousFrames = snapshot?.frames ?? null
          if (idleSince !== null && now - idleSince >= quiet) return { elapsedMs: now - started, frames: snapshot.frames }
          await new Promise(resolve => setTimeout(resolve, 25))
        }
        throw new Error(`${mode} did not reach a stable idle scheduler within one second`)
      }, { timeout: settings.pauseSettleTimeoutMs, quiet: settings.pauseIdleQuietMs, mode: settlementMode })
      const before = await inspector.locator("canvas").evaluate(canvas => canvas.__gnFacilitySnapshot(true))
      await page.waitForTimeout(settings.pauseObservationMs)
      const after = await inspector.locator("canvas").evaluate(canvas => canvas.__gnFacilitySnapshot(true))
      const controls = await inspector.evaluate(element => ({ quality: element.getAttribute("data-quality"), label: element.querySelector(".facility-state-label")?.textContent?.trim(), pauseCount: [...element.querySelectorAll(".facility-view-controls button[aria-label]")].filter(button => /^(Pause|Resume)$/.test(button.getAttribute("aria-label") ?? "")).length, paused: element.querySelector('.facility-view-controls button[aria-pressed]')?.getAttribute("aria-pressed") === "true" }))
      assert.equal(after.frames, before.frames, `${settlementMode} left continuing scene frames after settlement`)
      assert.deepEqual(after.equipment, before.equipment, `${settlementMode} changed fan poses or LED colors after settlement`)
      assert.equal(after.schedulerPending, 0, `${settlementMode} left a scheduled callback`)
      if (settlementMode === "adaptive-still") {
        assert.equal(before.quality, "still"); assert.equal(after.quality, "still")
        assert.deepEqual(controls, { quality: "still", label: "Still for performance", pauseCount: 0, paused: false })
      } else {
        assert.equal(controls.paused, true)
        // Preserve old field names only for the actual explicit-pause path.
        result.pauseSettle = settle; result.pauseSettledRenderer = before; result.pausedRenderer = after
      }
      result.settlement = { mode: settlementMode, settle, observationMs: settings.pauseObservationMs, controls, before, after }
      assertSettlementEvidence(result.settlement, settings)
      checkBudget(()=>assertRendererBudget(after, false))
      assert.deepEqual(result.pageErrors, [], "Page errors occurred during measurement")
      result.phase = "complete"
      result.complete = true
      console.log(JSON.stringify({ route, profile, run, transferBytes: result.transfer.bytes, renderer: result.renderingClass, frameP95: result.renderer.frameP95, capabilityP95:result.capability.frameP95, budgetFailures:result.budgetFailures }))
    } catch (error) {
      result.ambientDiagnostics ??= await page.evaluate(() => window.__facilityAmbientDiagnostics ?? []).catch(() => [])
      result.failurePhase = result.phase
      result.failure = error instanceof Error ? error.message : String(error)
      result.failureSnapshot = await page.evaluate(presentationSnapshot).catch(snapshotError => ({ unavailable: snapshotError instanceof Error ? snapshotError.message : String(snapshotError) }))
      result.transfer ??= ledger.snapshot()
      console.log(JSON.stringify({route,profile,run,failure:result.failure}))
    } finally { await context.close() }
  }
  assert.deepEqual(await verifiedBuildIdentity(), { sourceRevision: report.provenance.sourceRevision, buildId: report.provenance.buildId, releases: report.provenance.releases, buildSettings: report.provenance.buildSettings })
  report.failures=report.results.flatMap(result=>[...(result.failure?[result.failure]:[]),...result.budgetFailures].map(reason=>`${result.route} ${result.profile} run ${result.run}: ${reason}`))
  report.result = report.failures.length ? "fail" : "pass"
  if(report.result==="fail"){report.failure=report.failures.join("; ");process.exitCode=1}
} catch (error) {
  report.result = "fail"
  report.failure = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
} finally {
  await writeFile("build/facility/page-measurements.json", `${JSON.stringify(report, null, 2)}\n`)
  await browser.close()
}
