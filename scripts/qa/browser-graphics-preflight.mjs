import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, firefox, webkit } from "playwright"

const engine = process.env.BROWSER_ENGINE ?? "chromium"
assert(["chrome", "chromium", "firefox", "webkit"].includes(engine), "Unknown browser engine")
const headed = process.env.BROWSER_HEADED === "1"
const browserType = engine === "firefox" ? firefox : engine === "webkit" ? webkit : chromium
const report = { engine, headed, platform: process.platform, checkedAt: new Date().toISOString(), result: "incomplete" }
let browser
try {
  browser = await browserType.launch({ headless: !headed, timeout: 20_000, ...(engine === "chrome" ? { channel: "chrome" } : {}) })
  report.browser = browser.version()
  const page = await browser.newPage()
  report.graphics = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 2; canvas.height = 2
    const gl = canvas.getContext("webgl2")
    if (!gl) return { webgl2: false, renderer: null, pixel: null }
    const debug = gl.getExtension("WEBGL_debug_renderer_info")
    gl.clearColor(.25, .5, .75, 1); gl.clear(gl.COLOR_BUFFER_BIT)
    const pixel = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    const error = gl.getError()
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return { webgl2: true, renderer, pixel: [...pixel], error }
  })
  assert(report.graphics.webgl2, "Browser runtime cannot create WebGL2; repair the runner before running facility tests")
  assert.equal(report.graphics.error, 0, "WebGL2 readback error")
  assert(report.graphics.pixel.every((v, i) => Math.abs(v - [64,128,191,255][i]) <= 1), "WebGL2 did not render the expected pixel")
  report.renderingClass = /SwiftShader|llvmpipe|software/i.test(report.graphics.renderer) ? "software-emulation" : "unclassified"
  report.note = "Browser functionality only. This preflight does not qualify hardware performance."
  report.result = "pass"
} catch (error) {
  report.result = "fail"; report.error = String(error); process.exitCode = 1
} finally {
  await browser?.close()
  await mkdir("test-results", { recursive: true })
  await writeFile(`test-results/graphics-preflight-${engine}.json`, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report))
}
