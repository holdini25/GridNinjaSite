import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import lighthouse, { desktopConfig } from "lighthouse"
import { launch } from "chrome-launcher"
import { provenance, verifiedBuildIdentity } from "./performance-contract.mjs"

const require = createRequire(import.meta.url)
const config = require("./lighthouse.cjs")
const baseURL = process.env.FACILITY_BASE_URL ?? "http://localhost:3000"
const diagnostic = process.env.FACILITY_LIGHTHOUSE_DIAGNOSTIC === "1"
const angle = process.env.FACILITY_ANGLE
assert(!angle || angle === "metal", "FACILITY_ANGLE supports only metal")
// Browser-level diagnostics avoid introducing a probe canvas into the measured
// document. Read after the audit so this request cannot change its startup path.
async function graphicsBackend(endpoint) {
  return new Promise((accept, reject) => {
    const socket = new WebSocket(endpoint)
    let settled = false
    const finish = (error, value) => {
      if (settled) return
      settled = true; clearTimeout(deadline); socket.close()
      if (error) reject(error)
      else accept(value)
    }
    const deadline = setTimeout(() => finish(new Error("GPU diagnostics timed out")), 3_000)
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method: "SystemInfo.getInfo" })))
    socket.addEventListener("error", () => finish(new Error("GPU diagnostics connection failed")), { once: true })
    socket.addEventListener("message", event => {
      try {
        const message = JSON.parse(event.data)
        if (message.id !== 1) return
        if (message.error) return finish(new Error(message.error.message))
        const gpu = message.result.gpu
        finish(null, { renderer: gpu.auxAttributes?.glRenderer ?? "unavailable", vendor: gpu.auxAttributes?.glVendor ?? "unavailable", featureStatus: gpu.featureStatus })
      } catch (error) { finish(error) }
    })
  })
}
const initialIdentity = await verifiedBuildIdentity()
const index = { measuredAt: new Date().toISOString(), result: "incomplete", runs: [] }
await mkdir("build/facility", { recursive: true })
try {
  for (const profile of diagnostic ? ["mobile"] : ["desktop", "mobile"]) {
    const directory = `build/facility/lighthouse-${profile}${diagnostic ? "-throttled" : ""}`
    await rm(directory, { recursive: true, force: true })
    await mkdir(directory, { recursive: true })
    for (const route of ["/", "/demo", "/assessment"]) for (let run = 1; run <= 5; run++) {
      const output = `${directory}/${route === "/" ? "home" : route.slice(1)}-${run}.json`
      const attempt = { route, profile, run, output, complete: false }
      index.runs.push(attempt)
      const userDataDir = await mkdtemp(join(tmpdir(), "gridninja-lighthouse-"))
      const chromeFlags = ["--headless", ...(angle ? ["--use-angle=metal", "--use-gl=angle"] : [])]
      const chrome = await launch({ chromeFlags, userDataDir })
      try {
        const versionResponse = await fetch(`http://localhost:${chrome.port}/json/version`)
        const version = await versionResponse.json()
        const browser = String(version.Browser).replace(/^Chrome\//, "")
        const settings = { ...config.ci.collect.settings, ...(profile === "desktop" ? desktopConfig.settings : { formFactor: "mobile" }) }
        if (diagnostic) settings.throttlingMethod = "devtools"
        delete settings.chromeFlags
        delete settings.preset
        const result = await lighthouse(baseURL + route, { port: chrome.port, output: "json", logLevel: "error" }, { extends: "lighthouse:default", settings })
        assert(result?.lhr && !result.lhr.runtimeError, `Lighthouse failed: ${result?.lhr.runtimeError?.message ?? "no report"}`)
        await mkdir(`${directory}/artifacts`, { recursive: true })
        await writeFile(`${directory}/artifacts/${route === "/" ? "home" : route.slice(1)}-${run}-trace.json`, JSON.stringify(result.artifacts.Trace))
        await writeFile(`${directory}/artifacts/${route === "/" ? "home" : route.slice(1)}-${run}-network.json`, JSON.stringify(result.artifacts.DevtoolsLog))
        let graphics
        try { graphics = { status: "available", ...await graphicsBackend(version.webSocketDebuggerUrl) } }
        catch (error) { graphics = { status: "unavailable", renderer: "unavailable", error: error instanceof Error ? error.message : String(error) } }
        const hardwareAccepted = !angle || (graphics.status === "available" && /Apple M5.*Metal|Metal.*Apple M5/i.test(graphics.renderer) && !/SwiftShader|llvmpipe|software/i.test(graphics.renderer))
        const evidence = { provenance: await provenance(browser, { profile, settings: result.lhr.configSettings, freshBrowserProfile: true, chromeFlags }), graphics, route, run, measuredAt: new Date().toISOString(), measurementComplete: true, complete: hardwareAccepted }
        await writeFile(output, `${JSON.stringify({ ...result.lhr, facilityEvidence: evidence }, null, 2)}\n`)
        attempt.graphics = graphics; attempt.complete = hardwareAccepted
        assert(hardwareAccepted, `M5 Metal requested; actual backend: ${graphics.renderer}; ${graphics.error ?? ""}`)
        console.log(JSON.stringify({ route, profile, run, lcp: result.lhr.audits["largest-contentful-paint"].numericValue, output }))
      } finally { await chrome.kill(); await rm(userDataDir, { recursive: true, force: true }) }
    }
  }
  assert.deepEqual(await verifiedBuildIdentity(), initialIdentity, "Build changed during Lighthouse collection")
  index.result = "pass"
} catch (error) {
  index.result = "fail"
  index.failure = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
} finally { await writeFile(diagnostic ? "build/facility/lighthouse-throttled-index.json" : "build/facility/lighthouse-index.json", `${JSON.stringify(index, null, 2)}\n`) }
