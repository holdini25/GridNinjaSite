import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { hash, manifestSchema } from "./validate-release.mjs"
import { sourceRevision, verifiedBuildIdentity } from "./performance-contract.mjs"
import { qaHarnessRevision } from "../qa/candidate-contract.mjs"

/** This gate requires the new capability. Legacy releases cannot silently pass. */
export function assertServiceCapability(manifest, specimen) {
  assert.equal(specimen?.kind, "rack", "Required rack specimen metadata is unavailable")
  const detail = specimen.rackMotion?.serviceDetail
  assert(detail?.version === 1 && detail.requiresCutaway === true, "Required service-connection capability is unavailable")
  assert.equal(detail.camera.padding, 1.12)
  assert(manifest.specimens?.rack?.profile.lighting.finite, "Required finite service illumination is unavailable")
  return detail
}

export function assertMotionEvidence(samples, action) {
  assert(samples.length > 1, `${action}: no intermediate observations`)
  const observed = samples.filter(sample => action === "extend" ? sample.rackMotion?.moving : sample.transitionRemaining > 0)
  assert(observed.length, `${action}: no actual animated intermediate frame observed`)
  assert(observed.every(sample => ["economy", "balanced", "high"].includes(sample.quality)), `${action}: adaptive Still cannot establish animation evidence`)
  if (action === "extend") {
    assert(observed.some(sample => sample.rackMotion.tray > 0 && sample.rackMotion.tray < 1), "No intermediate tray position observed")
    assert(observed.every(sample => sample.serviceDisabled), "Service close-up became enabled before the extension settled")
  } else {
    assert(observed.every(sample => sample.rackMotion.door === 1 && sample.rackMotion.tray === 1 && !sample.rackMotion.moving), `${action}: joints moved during camera inspection`)
    assert(observed.every(sample => sample.mechanicsDisabled && sample.handlesDisabled), `${action}: mechanical actions became enabled during camera inspection`)
  }
}

export function assertServiceEndpoint(snapshot, detail, profile, closeup) {
  assert.equal(snapshot.sceneKind, "rack")
  assert.equal(snapshot.cameraProjection, "orthographic")
  assert.equal(snapshot.transitionRemaining, 0)
  assert.equal(snapshot.rackMotion?.moving, false)
  assert.equal(snapshot.rackMotion?.door, 1)
  assert.equal(snapshot.rackMotion?.tray, 1)
  assert.equal(snapshot.rackMotion?.cutaway, true)
  assert.equal(snapshot.view.detail, closeup ? "service-connection" : undefined)
  const expected = closeup ? detail.camera : profile.camera
  assert(snapshot.cameraPosition.every((value, index) => Math.abs(value - expected.camera[index]) < 1e-9), "Displayed camera is not the authored endpoint")
  assert(snapshot.cameraTarget.every((value, index) => Math.abs(value - expected.target[index]) < 1e-9), "Displayed target is not the authored endpoint")
  assert.deepEqual(snapshot.finiteLight, { position: profile.finite.position, intensity: profile.finite.intensity, count: 1, shadows: false })
  assert(snapshot.peakEstimatedBytes <= 32 * 1024 * 1024, "Staging allocation exceeded 32 MiB")
  assert(snapshot.estimatedBytes <= 6 * 1024 * 1024 + snapshot.environmentBytes + 4096, "Specimen allocation exceeded its bounded session allowance")
  assert(snapshot.drawCalls <= 35 && snapshot.materials <= 10, "Rack renderer budget exceeded")
}

function options(args) {
  assert(args.length % 2 === 0, "Every option requires a value")
  const result = Object.fromEntries(Array.from({ length: args.length / 2 }, (_, i) => [args[i * 2], args[i * 2 + 1]]))
  assert.equal(Object.keys(result).length, args.length / 2, "Duplicate options")
  for (const key of Object.keys(result)) assert(["--manifest", "--output", "--preview", "--base-url"].includes(key), `Unknown option: ${key}`)
  assert(result["--manifest"] && result["--output"] && ["development", "production"].includes(result["--preview"]), "Usage: verify-service-detail.mjs --manifest PATH --output FRESH_DIRECTORY --preview development|production [--base-url http://127.0.0.1:3000]")
  const baseURL = result["--base-url"] ?? process.env.FACILITY_BASE_URL ?? "http://127.0.0.1:3000"
  const url = new URL(baseURL)
  assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol), "Only a local preview is supported")
  return { manifestPath: resolve(result["--manifest"]), output: resolve(result["--output"]), preview: result["--preview"], baseURL: url.origin }
}

export async function main(args = process.argv.slice(2)) {
  const config = options(args)
  await mkdir(dirname(config.output), { recursive: true })
  await mkdir(config.output) // EEXIST intentionally fails: evidence is never overwritten.
  const report = { schemaVersion: "gridninja-service-detail-native.v1", startedAt: new Date().toISOString(), result: "incomplete", preview: config.preview, baseURL: config.baseURL, purpose: "Native M5 Metal functional motion and service-view gate; mobile is touch emulation, not physical-device or performance qualification", profiles: [], errors: [] }
  let browser
  try {
    report.sourceRevision = await sourceRevision(); report.qaHarnessRevision = await qaHarnessRevision()
    report.packageLockSha256 = hash(await readFile("package-lock.json")); report.node = process.version
    report.buildIdentity = config.preview === "production" ? await verifiedBuildIdentity() : null
    report.developmentLimitation = config.preview === "development" ? "Development server, not a production build. Workspace and served GLB bytes are attested; production startup/performance is not measured." : null
    const bytes = await readFile(config.manifestPath), manifest = manifestSchema.parse(JSON.parse(bytes))
    report.manifest = { path: config.manifestPath, sha256: hash(bytes), release: manifest.release }
    report.files = []
    let specimen
    for (const file of manifest.files) {
      const bytes = await readFile(join(dirname(config.manifestPath), file.file))
      assert.equal(bytes.length, file.bytes); assert.equal(hash(bytes), file.sha256)
      report.files.push(file)
      if (file.file === "rack.glb") {
        const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
        const value = document.nodes.find(node => node.extras?.gnId === "GN_SPECIMEN_ROOT")?.extras.gnSpecimen
        specimen = typeof value === "string" ? JSON.parse(value) : value
      }
    }
    const detail = assertServiceCapability(manifest, specimen)
    report.capability = { detail, motion: specimen.rackMotion, finiteLight: manifest.specimens.rack.profile.lighting.finite }
    if (report.buildIdentity) assert.equal(report.buildIdentity.buildSettings.selectedRelease, manifest.release)
    const { chromium } = await import("@playwright/test")
    browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] })
    report.browser = browser.version()
    for (const [name, viewport, mobile] of [["desktop", { width: 1440, height: 1100 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
      const run = { name, viewport, mobileEmulation: mobile, result: "incomplete", snapshots: {}, actions: [], glbRequests: [], servedAssets: [], picking: [] }
      report.profiles.push(run)
      await mkdir(join(config.output, name))
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: "no-preference", recordVideo: { dir: join(config.output, name, "video"), size: viewport } })
      const page = await context.newPage(), responseChecks = []
      page.setDefaultTimeout(10_000)
      await page.addInitScript(() => {
        window.__GN_FACILITY_DIAGNOSTICS__ = true
        // Preserve natural motion/quality policy; only keep the initial download explicit.
        Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } })
      })
      page.on("pageerror", error => report.errors.push({ profile: name, message: error.message }))
      page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".glb")) run.glbRequests.push(request.url()) })
      page.on("response", response => {
        const filename = new URL(response.url()).pathname.split("/").at(-1)
        if (!filename?.endsWith(".glb")) return
        responseChecks.push(response.body().then(bytes => {
          const expected = manifest.files.find(file => file.file === filename)
          assert(expected, `Unallowlisted model: ${filename}`); assert.equal(response.status(), 200)
          assert.equal(bytes.length, expected.bytes); assert.equal(hash(bytes), expected.sha256)
          run.servedAssets.push({ file: filename, bytes: bytes.length, sha256: hash(bytes) })
        }).catch(error => { report.errors.push({ profile: name, message: error.message }) }))
      })
      const viewer = page.getByTestId("facility-inspection"), stage = viewer.locator(".facility-stage"), canvas = viewer.locator("canvas[data-facility-canvas]")
      const button = label => viewer.getByRole("button", { name: label, exact: true })
      const rackButton = label => viewer.locator(".facility-rack-actions").getByRole("button", { name: label, exact: true })
      const stats = () => canvas.evaluate(element => element.__gnFacilitySnapshot())
      const centered = () => stage.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }))
      const settled = async (detailState, requireExtended = false) => {
        await centered()
        await page.waitForFunction(({ detailState, requireExtended }) => {
          const state = document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.()
          return state?.sceneKind === "rack" && !state.rackMotion?.moving && state.transitionRemaining === 0 && (!requireExtended || state.rackMotion?.tray === 1 && state.rackMotion?.door === 1) && (detailState === null || Boolean(state.view.detail) === detailState)
        }, { detailState, requireExtended }, { timeout: 10_000 })
      }
      const assessment = () => page.evaluate(() => ({ scenario: document.querySelector('[data-testid="assessment-summary"]')?.getAttribute("data-scenario"), summary: document.querySelector('[data-testid="assessment-summary"]')?.textContent, links: [...document.querySelectorAll('[aria-label="Current example downloads"] a')].map(link => link.getAttribute("href")) }))
      const capture = async label => {
        await centered(); run.snapshots[label] = await stats()
        await page.screenshot({ path: join(config.output, name, `${label}-page.png`) })
        await canvas.screenshot({ path: join(config.output, name, `${label}-stage.png`) })
      }
      const observeAction = async (label, action, detailState) => {
        await page.evaluate(() => {
          window.__gnServiceObservation = { samples: [], stop: false }
          const state = window.__gnServiceObservation
          const observe = () => {
            if (state.stop || state.samples.length >= 1200) return
            const snapshot = document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.()
            if (snapshot) {
              const controls = [...document.querySelectorAll(".facility-rack-actions button")]
              const service = controls.find(button => button.textContent.includes("service connection"))
              const mechanics = controls.filter(button => !/service connection|whole assembly/.test(button.textContent))
              const handles = [...document.querySelectorAll(".facility-rack-handle-controls button")]
              state.samples.push({ at: performance.now(), quality: snapshot.quality, rackMotion: snapshot.rackMotion, transitionRemaining: snapshot.transitionRemaining, cameraPosition: snapshot.cameraPosition, serviceDisabled: service?.disabled ?? true, mechanicsDisabled: mechanics.length === 3 && mechanics.every(button => button.disabled), handlesDisabled: handles.length === 2 && handles.every(button => button.disabled) })
            }
            state.raf = requestAnimationFrame(observe)
          }
          state.raf = requestAnimationFrame(observe)
        })
        try { await action(); await settled(detailState, true) }
        finally {
          const samples = await page.evaluate(() => { const value = window.__gnServiceObservation; value.stop = true; cancelAnimationFrame(value.raf); return value.samples })
          run.actions.push({ label, samples })
        }
        assertMotionEvidence(run.actions.at(-1).samples, label)
      }
      try {
        await page.goto(`${config.baseURL}/demo`, { waitUntil: "load" })
        await centered(); await viewer.locator(".facility-systems button").first().waitFor({ state: "visible" })
        assert.equal(await viewer.getAttribute("data-release"), manifest.release)
        const activation = viewer.getByRole("link", { name: "Explore the facility in 3D", exact: true }).or(button("Explore in 3D"))
        await activation.click(); await centered(); await viewer.locator("canvas[data-ready=true]").waitFor({ timeout: 15_000 })
        run.graphics = await canvas.evaluate(element => { const gl = element.getContext("webgl2"), ext = gl?.getExtension("WEBGL_debug_renderer_info"); return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable" } })
        assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(run.graphics.renderer) && !/SwiftShader|software|llvmpipe/i.test(run.graphics.renderer), `Native M5 Metal unavailable: ${run.graphics.renderer}`)
        await page.waitForFunction(() => document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.().qualityProbe === false, null, { timeout: 10_000 })
        const overview = await stats()
        if (overview.quality === "still") { run.result = "blocked"; throw new Error("Adaptive Still: actual motion cannot be qualified on this run") }
        await canvas.evaluate(element => { element.__gnServiceCanvas = "original"; element.__gnServiceContext = element.getContext("webgl2") })
        run.assessmentBefore = await assessment()
        assert.equal(run.assessmentBefore.scenario, "b"); assert.equal(run.assessmentBefore.links.length, 3)
        assert(run.assessmentBefore.summary.includes("7.0 MW") && run.assessmentBefore.summary.includes("5.8 MW"))
        assert.equal(run.glbRequests.length, 1, "Specimen downloaded before explicit assembly activation")
        await button("Inspect rack construction").click(); await centered()
        await page.waitForFunction(() => document.querySelector('[data-testid="facility-inspection"]')?.dataset.view === "rack", null, { timeout: 12_000 })
        await settled(false); await capture("closed")
        assert(await rackButton("Inspect service connection (cutaway)").isDisabled())
        await observeAction("extend", () => rackButton("Extend server tray").click(), false)
        await capture("extended")
        assert(await rackButton("Inspect service connection (cutaway)").isEnabled())
        const modelRequestCount = run.glbRequests.length
        assert.equal(modelRequestCount, 2, "Expected exactly overview plus one explicit rack request")
        await observeAction("detail", () => rackButton("Inspect service connection (cutaway)").click(), true)
        const profile = { camera: specimen.rackMotion.camera, finite: manifest.specimens.rack.profile.lighting.finite }
        assertServiceEndpoint(await stats(), detail, profile, true)
        assert.equal(await stage.getAttribute("data-specimen-detail"), "service-connection")
        for (const label of ["Close rack", "Retract server tray", "Restore side panel"]) assert(await rackButton(label).isDisabled())
        assert.equal(await viewer.locator(".facility-rack-handle-controls button:disabled").count(), 2)
        await capture("service-detail")
        const resize = mobile ? { width: 430, height: 932 } : { width: 1280, height: 900 }
        await page.setViewportSize(resize); await settled(true); await capture("service-resized")
        assertServiceEndpoint(await stats(), detail, profile, true)
        // Actual native canvas input after resize must resolve an authored part and
        // synchronize its HTML button. A bounded interior grid avoids guessing an ID.
        await button("Clear selection").click(); await centered()
        let picked = null
        for (const [x, y] of [[.5,.5],[.35,.5],[.65,.5],[.5,.35],[.5,.65],[.35,.35],[.65,.65]]) {
          await centered(); const bounds = await canvas.boundingBox(); assert(bounds)
          await canvas.click({ position: { x: bounds.width * x, y: bounds.height * y } })
          const selectedPart = viewer.locator('[data-part-id][aria-pressed="true"]')
          picked = await selectedPart.count() ? await selectedPart.getAttribute("data-part-id") : null
          run.picking.push({ normalized: [x, y], partId: picked })
          if (picked) break
        }
        assert(picked && specimen.parts.some(part => part.id === picked), "Resized canvas picking did not select an authored assembly part")
        await observeAction("return", () => rackButton("Return to whole assembly").click(), false)
        assertServiceEndpoint(await stats(), detail, profile, false)
        for (const label of ["Close rack", "Retract server tray", "Restore side panel"]) assert(await rackButton(label).isEnabled())
        await capture("whole-return")
        // Pause and reduced motion use the same public action, but snap to the
        // reviewed camera; neither may silently turn equipment activity back on.
        await button("Pause").click(); await rackButton("Inspect service connection (cutaway)").click(); await settled(true)
        assertServiceEndpoint(await stats(), detail, profile, true); await capture("paused-detail")
        await rackButton("Return to whole assembly").click(); await settled(false)
        await button("Resume").click(); await page.emulateMedia({ reducedMotion: "reduce" })
        await rackButton("Inspect service connection (cutaway)").click(); await settled(true)
        assertServiceEndpoint(await stats(), detail, profile, true)
        await page.evaluate(() => {
          const observations = [], types = ["pointerover", "pointerout", "focusin", "focusout", "scroll", "resize"]
          const record = event => {
            if (observations.length >= 200) return
            const snapshot = document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.()
            observations.push({ at: performance.now(), type: event.type, target: event.target instanceof Element ? `${event.target.tagName}.${event.target.className}` : "window", frames: snapshot?.frames, requests: snapshot?.schedulerRequestCount, pending: snapshot?.schedulerPending })
          }
          for (const type of types) addEventListener(type, record, { capture: true, passive: true })
          window.__gnServiceIdleObservation = { observations, stop: () => { for (const type of types) removeEventListener(type, record, { capture: true }) } }
        })
        await capture("reduced-detail")
        // Element screenshots can cause pointer leave/re-entry while scrolling
        // their target. That is finite inspection input even under reduced motion.
        // Remove that input, then require a bounded unchanged quiet interval
        // before measuring the independent strict zero-frame observation.
        await page.mouse.move(0, 0)
        run.reducedSettlement = await page.evaluate(() => new Promise((resolve, reject) => {
          const start = performance.now(), samples = []
          let quietSince = start, previous = null
          const poll = () => {
            const now = performance.now(), state = document.querySelector("canvas[data-facility-canvas]")?.__gnFacilitySnapshot?.()
            const sample = { elapsedMs: now - start, frames: state?.frames, requests: state?.schedulerRequestCount, pending: state?.schedulerPending, transition: state?.transitionRemaining, moving: state?.rackMotion?.moving }
            samples.push(sample)
            const idle = state && sample.pending === 0 && sample.transition === 0 && sample.moving === false
            if (!idle || !previous || sample.frames !== previous.frames || sample.requests !== previous.requests) quietSince = now
            previous = sample
            if (idle && now - quietSince >= 250) { resolve({ elapsedMs: now - start, quietMs: now - quietSince, samples }); return }
            if (now - start >= 2000) { reject(new Error("Reduced-motion finite feedback did not settle within two seconds")); return }
            setTimeout(poll, 25)
          }
          poll()
        }))
        const idleBefore = await stats(); await page.waitForTimeout(300)
        const idleAfter = await stats()
        run.reducedIdle = { before: idleBefore, after: idleAfter, events: await page.evaluate(() => { const value = window.__gnServiceIdleObservation; value.stop(); return value.observations }) }
        assert.equal(idleAfter.frames, idleBefore.frames, "Reduced motion left continuous frames")
        assert.equal(idleAfter.schedulerRequestCount, idleBefore.schedulerRequestCount, "Reduced motion kept requesting frames")
        assert.equal(idleAfter.activeSeconds, idleBefore.activeSeconds, "Reduced motion advanced activity time")
        assert.equal(idleAfter.clockSeconds, idleBefore.clockSeconds, "Reduced motion advanced the presentation clock")
        await rackButton("Return to whole assembly").click(); await settled(false)
        assert.equal(await canvas.count(), 1)
        assert(await canvas.evaluate(element => element.__gnServiceCanvas === "original" && element.__gnServiceContext === element.getContext("webgl2")), "Service inspection recreated the renderer/context")
        assert.equal(run.glbRequests.length, modelRequestCount, "Same-asset service view downloaded another model")
        run.assessmentAfter = await assessment(); assert.deepEqual(run.assessmentAfter, run.assessmentBefore)
        run.result = "pass"
      } catch (error) {
        if (run.result !== "blocked") run.result = "fail"
        run.failure = error instanceof Error ? error.message : String(error)
        await page.screenshot({ path: join(config.output, name, "failure.png"), fullPage: true }).catch(() => {})
      } finally {
        await Promise.all(responseChecks); run.video = await page.video()?.path()
        await context.close()
        await writeFile(join(config.output, name, "report.json"), `${JSON.stringify(run, null, 2)}\n`, { flag: "wx" })
      }
    }
    assert.equal(await sourceRevision(), report.sourceRevision, "Source changed during capture")
    assert.equal(await qaHarnessRevision(), report.qaHarnessRevision, "Harness changed during capture")
    assert.equal(hash(await readFile(config.manifestPath)), report.manifest.sha256, "Manifest changed during capture")
    if (report.buildIdentity) assert.deepEqual(await verifiedBuildIdentity(), report.buildIdentity)
    assert.deepEqual(report.errors, [])
    assert(report.profiles.every(run => run.result === "pass"), "At least one mandatory native service-view profile failed or was blocked")
    report.result = "pass"
  } catch (error) { report.result = "fail"; report.failure = error instanceof Error ? error.message : String(error); process.exitCode = 1 }
  finally {
    await browser?.close(); report.finishedAt = new Date().toISOString()
    await writeFile(join(config.output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" })
    console.log(JSON.stringify({ result: report.result, failure: report.failure, profiles: report.profiles.map(run => ({ name: run.name, result: run.result, failure: run.failure })), output: config.output }))
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
