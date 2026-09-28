import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { chromium } from "@playwright/test"
import sharp from "sharp"
import { hash, manifestSchema, releasePattern } from "./validate-release.mjs"

const args = process.argv.slice(2)
assert(args.length === 2 && args[0] === "--release" && releasePattern.test(args[1]), "Usage: capture-ecosystem.mjs --release facility-vN")
const release = args[1], baseURL = process.env.FACILITY_BASE_URL ?? "http://127.0.0.1:3001"
const output = join("build/facility", release, "ecosystem-review")
const manifestBytes = await readFile(join("build/facility", release, "release/manifest.json"))
const manifest = manifestSchema.parse(JSON.parse(manifestBytes.toString("utf8")))
assert(manifest.profile.ecosystem, "Review requires an ecosystem release")
await mkdir(output, { recursive: true })
const report = { release, capturedAt: new Date().toISOString(), purpose: "Chapter/cutaway visual review; diagnostic DPR overrides are separate from adaptive performance evidence", manifestSha256: hash(manifestBytes), results: [], errors: [] }
const native = process.env.FACILITY_ANGLE === "metal", headed = process.env.FACILITY_HEADED === "1"
assert(!process.env.FACILITY_ANGLE || native, "FACILITY_ANGLE supports only metal")
report.launch = { channel: "chrome", headed, angle: native ? "metal" : "default" }
report.graphics = []
const browser = await chromium.launch({ channel: "chrome", headless: !headed, ...(native ? { args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] } : {}) })
const setup = async (context, route) => {
  await context.addInitScript(() => {
    window.__GN_FACILITY_DIAGNOSTICS__ = true
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } })
  })
  const page = await context.newPage()
  page.on("pageerror", error => report.errors.push({ route, message: error.message }))
  await page.goto(baseURL + route)
  const inspector = page.getByTestId("facility-inspection")
  assert.equal(await inspector.getAttribute("data-release"), release)
  await inspector.locator(".facility-stage").evaluate(stage => stage.scrollIntoView({ block: "center", behavior: "instant" }))
  await inspector.locator(".facility-systems button").first().waitFor({ state: "visible" })
  if (route === "/") {
    // Home now offers a native journey to the demo instead of an inline story.
    // Exercise that exact link, then record the real destination separately.
    const journey = inspector.getByRole("link", { name: "Follow one workload", exact: true })
    const destination = new URL(await journey.getAttribute("href"), baseURL)
    assert.equal(destination.pathname, "/demo")
    assert.equal(destination.hash, "#workload-story")
    await journey.click()
    await page.waitForURL(url => url.pathname === "/demo" && url.hash === "#workload-story")
    await inspector.locator(".facility-stage").evaluate(stage => stage.scrollIntoView({ block: "center", behavior: "instant" }))
    await inspector.locator(".facility-systems button").first().waitFor({ state: "visible" })
  }
  await inspector.locator(".facility-stage").scrollIntoViewIfNeeded()
  await inspector.getByRole("button", { name: "Explore in 3D", exact: true })
    .or(inspector.getByRole("link", { name: "Explore the facility in 3D", exact: true })).click()
  const canvas = inspector.locator("canvas[data-ready=true]")
  await canvas.waitFor({ timeout: 12_000 })
  const renderer = await canvas.evaluate(element => {
    const gl = element.getContext("webgl2"), extension = gl?.getExtension("WEBGL_debug_renderer_info")
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unavailable"
  })
  if (native) assert(/Apple M5.*Metal|Metal.*Apple M5/i.test(renderer) && !/SwiftShader|llvmpipe|software/i.test(renderer), `Native M5 Metal requested but actual renderer is ${renderer}`)
  report.graphics.push({ route, viewport: page.viewportSize(), renderer })
  return { page, inspector, canvas, storyRoute: new URL(page.url()).pathname }
}
try {
  report.browser = browser.version()
  for (const route of ["/", "/demo"]) for (const [device, viewport, dpr] of [
    ["desktop-dpr1", { width: 1440, height: 1100 }, 1],
    ["desktop-dpr1.5", { width: 1440, height: 1100 }, 1.5],
    ["mobile-dpr1", { width: 390, height: 844 }, 1],
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, reducedMotion: "reduce", isMobile: device.startsWith("mobile"), hasTouch: device.startsWith("mobile") })
    try {
      const { page, inspector, canvas, storyRoute } = await setup(context, route)
      await canvas.evaluate((element, value) => element.__gnFacilityReviewDpr?.(value), dpr)
      const story = inspector.getByTestId("facility-ecosystem-story")
      if (!await story.count()) await inspector.getByRole("button", { name: "Follow one workload", exact: true }).click()
      for (let chapter = 0; chapter < 6; chapter++) {
        assert.equal(Number(await story.getAttribute("data-chapter")), chapter)
        await inspector.locator(".facility-stage").scrollIntoViewIfNeeded()
        await page.mouse.move(0, 0)
        await page.waitForTimeout(180)
        const snapshot = await canvas.evaluate(element => ({ ...element.__gnFacilitySnapshot(true), buffer: [element.width, element.height] }))
        assert.equal(snapshot.dpr, dpr)
        assert(snapshot.drawCalls <= 39 && snapshot.materials <= 10 && snapshot.triangles <= 40_000)
        assert(snapshot.peakEstimatedBytes <= 32 * 1024 * 1024)
        const name = `${route === "/" ? "home" : "demo"}-${device}-chapter-${chapter}`
        await canvas.screenshot({ path: join(output, `${name}.png`) })
        if (chapter === 2 || chapter === 4) await story.screenshot({ path: join(output, `${name}-caption.png`) })
        report.results.push({ route, storyRoute, device, chapter, snapshot, text: await story.innerText() })
        if (chapter < 5) await story.getByRole("button", { name: "Next chapter", exact: true }).click()
      }
    } finally { await context.close() }
  }
  // Native Mac GPU recording: one ambient sequence, then one explicitly played story.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, reducedMotion: "no-preference", recordVideo: { dir: join(output, "motion"), size: { width: 1440, height: 1100 } } })
  try {
    const { page, inspector, canvas } = await setup(context, "/demo")
    const samples = []
    for (let second = 0; second < 28; second++) {
      samples.push({ mode: "ambient", second, snapshot: await canvas.evaluate(element => element.__gnFacilitySnapshot(true)) })
      await page.waitForTimeout(1000)
    }
    await inspector.getByRole("button", { name: "Follow one workload", exact: true }).click()
    const story = inspector.getByTestId("facility-ecosystem-story")
    await story.getByRole("button", { name: "Play story", exact: true }).click()
    await inspector.locator(".facility-stage").scrollIntoViewIfNeeded()
    for (let second = 0; second < 27; second++) {
      samples.push({ mode: "story", second, chapter: Number(await story.getAttribute("data-chapter")), snapshot: await canvas.evaluate(element => element.__gnFacilitySnapshot(true)) })
      await page.waitForTimeout(1000)
    }
    assert.equal(Number(await story.getAttribute("data-chapter")), 5)
    assert.equal(await story.getAttribute("data-playing"), "false", "Story must finish in a still evidence state")
    const renderer = await canvas.evaluate(element => { const gl = element.getContext("webgl2"), extension = gl.getExtension("WEBGL_debug_renderer_info"); return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unavailable" })
    if (native) assert(/Apple.*Metal|Metal.*Apple/i.test(renderer), "Native Apple Metal requested but unavailable")
    report.motion = { environment: "Chrome on the local host; no phone or sustained-energy claim", renderer, samples }
  } finally { await context.close() }
  const labels = ["Request", "Electrical path", "Air and cooling", "Governing conditions", "Screening result", "Evidence"]
  const tiles = await Promise.all(Array.from({ length: 6 }, async (_, chapter) => ({ input: await sharp(join(output, `demo-desktop-dpr1-chapter-${chapter}.png`)).resize(480, 282, { fit: "contain", background: "#080808" }).extend({ top: 32, bottom: 0, left: 0, right: 0, background: "#080808" }).composite([{ input: Buffer.from(`<svg width="480" height="32"><text x="14" y="23" fill="#eeeeee" font-family="sans-serif" font-size="16">0${chapter + 1} · ${labels[chapter]}</text></svg>`), left: 0, top: 0 }]).png().toBuffer(), left: (chapter % 3) * 480, top: Math.floor(chapter / 3) * 314 })))
  await sharp({ create: { width: 1440, height: 628, channels: 3, background: "#080808" } }).composite(tiles).png().toFile(join(output, "story-contact-sheet.png"))
  assert.deepEqual(report.errors, [])
  report.result = "pass"
} catch (error) {
  report.result = "fail"; report.failure = String(error); process.exitCode = 1
} finally {
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n")
  await browser.close()
}
console.log(JSON.stringify({ result: report.result, capturedStates: report.results.length, output, failure: report.failure }))
