import { chooseAssembly, choosePose } from "./inspection-actions.mjs"
import { captureVisitedReviewPage } from "./review-page-capture.mjs"
import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { hash, manifestSchema, releasePattern } from "./validate-release.mjs"

const args = process.argv.slice(2)
assert(args.length === 2 && args[0] === "--release" && releasePattern.test(args[1]), "Usage: capture-review.mjs --release facility-vN")
const release = args[1], baseURL = process.env.FACILITY_BASE_URL ?? "http://127.0.0.1:3001"
const headed = process.env.FACILITY_HEADED === "1", angle = process.env.FACILITY_ANGLE
assert(!angle || angle === "metal", "FACILITY_ANGLE supports only metal")
const output = join("build/facility", release, "review")
const manifestBytes = await readFile(join("build/facility", release, "release/manifest.json"))
const manifest = manifestSchema.parse(JSON.parse(manifestBytes))
await mkdir(output, { recursive: true })
const requireServiceDetail = process.env.FACILITY_REQUIRE_SERVICE_DETAIL === "1"
const report = { release, capturedAt: new Date().toISOString(), purpose: "Still visual review with bounded diagnostic DPR override; touch profiles are emulated, not physical-device or adaptive performance evidence", requireServiceDetail, manifestSha256: hash(manifestBytes), modelSha256: manifest.files.find(file => file.file === "facility.glb").sha256, profileSha256: hash(Buffer.from(JSON.stringify(manifest.profile))), launch: { channel: "chrome", headed, angle: angle ?? "default" }, pageConditioning: [], graphics: [], results: [], errors: [] }
const browser = await chromium.launch({ channel: "chrome", headless: !headed, ...(angle ? { args: [`--use-angle=${angle}`, "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] } : {}) })
try {
  report.browser = browser.version()
  for (const route of ["/", "/demo"]) for (const [device, viewport, dpr] of [
    ["desktop-dpr1", { width: 1440, height: 1100 }, 1],
    ["desktop-dpr1.5", { width: 1440, height: 1100 }, 1.5],
    ["mobile-dpr1", { width: 390, height: 844 }, 1],
  ]) {
    const mobile = device.startsWith("mobile")
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, reducedMotion: "reduce", isMobile: mobile, hasTouch: mobile })
    try {
      const page = await context.newPage()
      page.on("pageerror", error => report.errors.push({ route, device, message: error.message }))
      await page.addInitScript(() => {
        window.__GN_FACILITY_DIAGNOSTICS__ = true
        Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } })
      })
      await page.goto(baseURL + route, { waitUntil: "load" })
      await page.evaluate(() => document.fonts.ready)
      const inspector = page.getByTestId("facility-inspection")
      const scrollStage = () => inspector.locator(".facility-stage").scrollIntoViewIfNeeded()
      assert.equal(await inspector.getAttribute("data-release"), release)
      const name = `${route === "/" ? "home" : "demo"}-${device}`
      if (device !== "desktop-dpr1.5") report.pageConditioning.push({ route, device, ...await captureVisitedReviewPage(page, join(output, `${name}-page.png`)) })
      await page.addStyleTag({ content: "body > header, header.sticky, nextjs-portal { visibility: hidden !important; }" })
      // Entering visibility starts deferred HTML enhancement. Its committed
      // four-system rail is the readiness signal; Save-Data still prevents 3D.
      // Do not take an element screenshot while React replaces the native shell.
      await inspector.locator(".facility-stage").evaluate(stage => stage.scrollIntoView({ block: "center", behavior: "instant" }))
      await inspector.locator(".facility-systems button").first().waitFor({ state: "visible" })
      await scrollStage()
      // The native deferred preview uses picture/img directly; the enhanced
      // shell uses .facility-poster. Both must expose the actual responsive image.
      await inspector.locator(".facility-stage img").first().evaluate(image => image.decode())
      await inspector.screenshot({ path: join(output, `${name}-poster.png`) })
      // Use the same explicit intent as a visitor. Before enhancement this is
      // a native activation link; after enhancement it is the shell's button.
      const activation = inspector.getByRole("link", { name: "Explore the facility in 3D", exact: true })
        .or(inspector.getByRole("button", { name: "Explore in 3D", exact: true }))
      await activation.click()
      const canvas = inspector.locator("canvas[data-ready=true]")
      await canvas.waitFor({ timeout: 15_000 })
      const graphics = await canvas.evaluate(element => {
        const gl = element.getContext("webgl2"), extension = gl?.getExtension("WEBGL_debug_renderer_info")
        return { renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unavailable", vendor: extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : "unavailable", devicePixelRatio }
      })
      report.graphics.push({ route, device, ...graphics })
      if (angle === "metal") assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(graphics.renderer) && !/SwiftShader|llvmpipe|software/i.test(graphics.renderer), `Native M5 Metal requested but actual renderer is ${graphics.renderer}`)
      await canvas.evaluate((element, value) => element.__gnFacilityReviewDpr?.(value), dpr)
      await page.waitForTimeout(180)
      const capture = async (state, kind = "overview") => {
        await page.mouse.move(0, 0)
        await scrollStage()
        await page.waitForTimeout(200)
        const snapshot = await canvas.evaluate(element => ({ ...element.__gnFacilitySnapshot(true), buffer: [element.width, element.height] }))
        assert.equal(snapshot.dpr, dpr, "Review did not render at the requested DPR")
        assert(snapshot.drawCalls <= (kind === "overview" ? 39 : kind === "rack" ? 35 : 30), `${kind} draw budget exceeded`)
        assert(snapshot.materials <= 10 && snapshot.peakEstimatedBytes <= 32 * 1024 * 1024)
        assert.equal(snapshot.sceneKind, kind)
        const png = await canvas.screenshot({ path: join(output, `${name}-${state}.png`) })
        if (kind === "overview" && state === "neutral") {
          await inspector.screenshot({ path: join(output, `${name}-live.png`) })
          const { width, height } = await sharp(png).metadata()
          for (const [subject, box] of [["racks", [.29, .35, .36, .46]], ["cooling", [.40, .10, .39, .34]]]) {
            const [x, y, w, h] = box
            await sharp(png).extract({ left: Math.round(width * x), top: Math.round(height * y), width: Math.floor(width * w), height: Math.floor(height * h) }).png().toFile(join(output, `${name}-${subject}-closeup.png`))
          }
        }
        report.results.push({ route, device, viewport, state, snapshot })
      }
      await capture("neutral")
      for (const system of ["power", "cooling", "storage", "workloads"]) {
        await inspector.locator(".facility-systems").getByRole("button", { name: new RegExp(system, "i") }).click()
        await capture(system)
      }
      if (route === "/demo" && manifest.profile.inspection) {
        for (const [detail, label] of [["rack", "View rack close-up"], ["air-path", "View air-path cutaway"]]) {
          await inspector.getByRole("button", { name: label, exact: true }).click()
          await capture(`detail-${detail}`)
          const state = report.results.at(-1).snapshot
          assert.equal(state.cameraProjection, "perspective")
          assert.equal(state.cameraFov, 32)
        }
        await inspector.getByRole("button", { name: "Return to overview", exact: true }).click()
        await capture("returned-overview")
        assert.equal(report.results.at(-1).snapshot.cameraProjection, "orthographic")
      }
      if (route === "/demo" && manifest.specimens) {
        for (const kind of Object.keys(manifest.specimens)) {
          await chooseAssembly(inspector, kind)
          await page.waitForFunction(kind => document.querySelector('[data-testid="facility-inspection"]')?.dataset.view === kind, kind, { timeout: 10000 })
          for (const pose of ["closed", "cutaway", "service"]) {
            if (pose !== "closed") await choosePose(inspector, kind, pose)
            await page.waitForFunction(pose => document.querySelector('[data-testid="facility-inspection"]')?.dataset.pose === pose, pose)
            await capture(`${kind}-${pose}`, kind)
          }
          if (kind === "rack") {
            const detail = inspector.getByRole("button", { name: "Inspect service connection (cutaway)", exact: true })
            const supported = await detail.count() === 1
            if (requireServiceDetail) assert(supported, "Required service-detail capability is absent")
            if (supported) {
              await detail.click()
              await page.waitForFunction(() => document.querySelector("canvas[data-ready=true]")?.__gnFacilitySnapshot?.().view?.detail === "service-connection")
              await capture("rack-service-connection", "rack")
              assert.equal(report.results.at(-1).snapshot.rackMotion.cutaway, true)
              await inspector.screenshot({ path: join(output, `${name}-rack-service-connection-controls.png`) })
              await inspector.getByRole("button", { name: "Return to whole assembly", exact: true }).click()
              await page.waitForFunction(() => {
                const snapshot = document.querySelector("canvas[data-ready=true]")?.__gnFacilitySnapshot?.()
                return snapshot?.view?.kind === "specimen" && !snapshot.view.detail && snapshot.transitionRemaining === 0
              })
            }
          }
        }
      }
    } finally { await context.close() }
  }
  assert.deepEqual(report.errors, [])
  report.result = "pass"
  console.log(`Captured ${report.results.length} scene states at desktop DPR 1/1.5 and mobile DPR 1.`)
} catch (error) {
  report.result = "fail"; report.failure = String(error); process.exitCode = 1
} finally {
  await writeFile(join(output, "review-capture.json"), JSON.stringify(report, null, 2) + "\n")
  await browser.close()
}
