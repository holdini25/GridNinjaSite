import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import lighthouse, { desktopConfig } from "lighthouse"
import { launch } from "chrome-launcher"
import { provenance, verifiedBuildIdentity, verifyMeasurementServing, measurementEnvironment, isProtectedMeasurement, verifyMeasurementDocument, assertMeasurementServingPair } from "./performance-contract.mjs"
import { authorizeHostedChrome, redactHostedSecrets } from "./hosted-auth.mjs"
import { captureValidLighthouseReport } from "./lighthouse-capture.mjs"
import { performanceMatrix, lighthouseGroups, lighthousePriorityGroups, lighthouseSlug } from "./lighthouse-matrix.mjs"
import { acquireComputeLock } from "./compute-lock.mjs"
import { evaluateLighthouseGroup } from "./lighthouse-group-budget.mjs"
import { lighthouseDocumentResponse } from "./measurement-document.mjs"

const require = createRequire(import.meta.url)
const config = require("./lighthouse.cjs")
const baseURL = process.env.FACILITY_BASE_URL ?? "http://localhost:3000"
const diagnostic = process.env.FACILITY_LIGHTHOUSE_DIAGNOSTIC === "1"
const stopOnFailure = process.env.FACILITY_LIGHTHOUSE_STOP_ON_FAILURE === "1"
const priorityOnly = process.env.FACILITY_LIGHTHOUSE_PRIORITY_ONLY === "1"
assert(!priorityOnly || !stopOnFailure, "Priority preflight records both groups; do not combine it with stop-on-failure")
assert(!priorityOnly || !diagnostic, "Priority preflight uses the unchanged release throttling settings")
const matrix = performanceMatrix(process.env.FACILITY_PERFORMANCE_MATRIX)
const outputRoot = process.env.FACILITY_PERFORMANCE_DIR ?? "build/facility"
assert(resolve(outputRoot) === resolve("build/facility") || resolve(outputRoot).startsWith(`${resolve("build/facility")}/`), "Performance output must remain under build/facility")
assert(matrix.name !== "premium-civic" || process.env.FACILITY_PERFORMANCE_DIR, "The premium release matrix requires a fresh FACILITY_PERFORMANCE_DIR")
const angle = process.env.FACILITY_ANGLE
const evidenceJson = (value, indent) => JSON.stringify(process.env.FACILITY_HOSTED_ATTESTATION_FILE ? redactHostedSecrets(value) : value, null, indent)
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
const environment = await measurementEnvironment()
const index = { measuredAt: new Date().toISOString(), qualificationEnvironment: environment, matrix: matrix.name, diagnostic: diagnostic || priorityOnly, priorityOnly, reviewedRouteCaptures: matrix.reviewedRoutes.length * matrix.profiles.length * matrix.runs, requiredCaptures: matrix.routes.length * matrix.profiles.length * matrix.runs, result: "incomplete", runs: [] }
if (stopOnFailure || priorityOnly) index.groupBudgetChecks = []
const releaseCompute = await acquireComputeLock("lighthouse-performance")
let outputReady = false
let harnessRevision
try {
  await mkdir(dirname(outputRoot), { recursive: true })
  await mkdir(outputRoot, { recursive: !process.env.FACILITY_PERFORMANCE_DIR })
  outputReady = true
  const before = await verifyMeasurementServing()
  if (before) index.hostedServing = { before, after: null, collectionStartedAt: new Date().toISOString(), collectionFinishedAt: null }
  for (const profile of diagnostic ? ["mobile"] : ["desktop", "mobile"]) {
    const directory = `${outputRoot}/lighthouse-${profile}${diagnostic ? "-throttled" : ""}`
    if (!process.env.FACILITY_PERFORMANCE_DIR) await rm(directory, { recursive: true, force: true })
    await mkdir(directory, { recursive: true })
  }
  for (const { profile, route } of priorityOnly ? lighthousePriorityGroups(matrix.name) : lighthouseGroups(matrix.name)) {
    if (diagnostic && profile !== "mobile") continue
    const directory = `${outputRoot}/lighthouse-${profile}${diagnostic ? "-throttled" : ""}`
    const group = []
    for (let run = 1; run <= matrix.runs; run++) {
      const slug = lighthouseSlug(route)
      const output = `${directory}/${slug}-${run}.json`
      const attempt = { route, profile, run, output, complete: false, captures: [] }
      index.runs.push(attempt)
      const chromeFlags = ["--headless", ...(angle ? ["--use-angle=metal", "--use-gl=angle"] : [])]
      let browser, graphics
      const result = await captureValidLighthouseReport(async number => {
        const capture = { number, freshBrowserProfile: true, startedAt: new Date().toISOString(), result: "incomplete" }
        attempt.captures.push(capture)
        const userDataDir = await mkdtemp(join(tmpdir(), "gridninja-lighthouse-"))
        let chrome
        try {
          chrome = await launch({ chromeFlags, userDataDir })
          const versionResponse = await fetch(`http://localhost:${chrome.port}/json/version`)
          const version = await versionResponse.json()
          browser = String(version.Browser).replace(/^Chrome\//, "")
          capture.browser = browser
          if (isProtectedMeasurement()) await authorizeHostedChrome(version.webSocketDebuggerUrl, new URL(baseURL).origin)
          const settings = { ...config.ci.collect.settings, ...(profile === "desktop" ? desktopConfig.settings : { formFactor: "mobile" }) }
          if (diagnostic) settings.throttlingMethod = "devtools"
          delete settings.chromeFlags
          delete settings.preset
          const result = await lighthouse(baseURL + route, { port: chrome.port, output: "json", logLevel: "error" }, { extends: "lighthouse:default", settings })
          capture.result = result?.lhr && !result.lhr.runtimeError ? "valid" : "invalid"
          capture.runtimeError = result?.lhr?.runtimeError ?? null
          if (capture.result === "valid") {
            try { graphics = { status: "available", ...await graphicsBackend(version.webSocketDebuggerUrl) } }
            catch (error) { graphics = { status: "unavailable", renderer: "unavailable", error: error instanceof Error ? error.message : String(error) } }
          }
          return result
        } catch (error) {
          capture.result = "error"
          capture.error = error instanceof Error ? error.message : String(error)
          throw error
        } finally {
          capture.finishedAt = new Date().toISOString()
          try { await chrome?.kill() } finally { await rm(userDataDir, { recursive: true, force: true }) }
        }
      }, async (invalid, number) => {
        const prefix = `${directory}/invalid-captures/${slug}-${run}-attempt-${number}`
        await mkdir(`${directory}/invalid-captures`, { recursive: true })
        await writeFile(`${prefix}-report.json`, `${evidenceJson(invalid?.lhr ?? { missingReport: true }, 2)}\n`)
        await writeFile(`${prefix}-trace.json`, evidenceJson(invalid?.artifacts?.Trace ?? null))
        await writeFile(`${prefix}-network.json`, evidenceJson(invalid?.artifacts?.DevtoolsLog ?? null))
        const capture = attempt.captures.at(-1)
        capture.preserved = { report: `${prefix}-report.json`, trace: `${prefix}-trace.json`, network: `${prefix}-network.json` }
        capture.provenance = await provenance(browser, { profile, settings: invalid?.lhr?.configSettings ?? null, freshBrowserProfile: true, chromeFlags })
      })
      await mkdir(`${directory}/artifacts`, { recursive: true })
      await writeFile(`${directory}/artifacts/${slug}-${run}-trace.json`, evidenceJson(result.artifacts.Trace))
      await writeFile(`${directory}/artifacts/${slug}-${run}-network.json`, evidenceJson(result.artifacts.DevtoolsLog))
      const hardwareAccepted = !angle || (graphics.status === "available" && /Apple M5.*Metal|Metal.*Apple M5/i.test(graphics.renderer) && !/SwiftShader|llvmpipe|software/i.test(graphics.renderer))
      const evidence = { provenance: await provenance(browser, { profile, settings: result.lhr.configSettings, freshBrowserProfile: true, chromeFlags }), graphics, route, run, measuredAt: new Date().toISOString(), measurementComplete: true, complete: hardwareAccepted }
      try {
        evidence.documentResponse = lighthouseDocumentResponse(result)
        evidence.documentIdentity = await verifyMeasurementDocument(result.artifacts.MainDocumentContent, evidence.documentResponse)
      } catch (error) {
        evidence.complete = false
        evidence.documentFailure = error instanceof Error ? error.message : String(error)
      }
      harnessRevision ??= evidence.provenance.harnessRevision
      assert.equal(evidence.provenance.harnessRevision, harnessRevision, "Harness changed during Lighthouse collection")
      const report = { ...result.lhr, facilityEvidence: evidence }
      await writeFile(output, `${evidenceJson(report, 2)}\n`)
      if (stopOnFailure || priorityOnly) group.push(report)
      attempt.graphics = graphics; attempt.complete = evidence.complete
      assert(hardwareAccepted, `M5 Metal requested; actual backend: ${graphics.renderer}; ${graphics.error ?? ""}`)
      assert(evidence.complete, evidence.documentFailure)
      console.log(JSON.stringify({ route, profile, run, lcp: result.lhr.audits["largest-contentful-paint"].numericValue, output }))
    }
    if (stopOnFailure || priorityOnly) {
      const check = { route, profile, runs: group.map(report => report.facilityEvidence.run), result: "incomplete", failures: [] }
      index.groupBudgetChecks.push(check)
      try {
        const budget = evaluateLighthouseGroup(group, { route, profile, buildSettings: initialIdentity.buildSettings, environment })
        check.medians = budget.medians
        check.failures = budget.failures
        check.publicAcceptanceFailures = budget.publicAcceptanceFailures
        if (stopOnFailure) assert.equal(budget.failures.length, 0, `Lighthouse group failed unchanged release gates: ${budget.failures.join("; ")}`)
        check.result = budget.failures.length ? "fail" : "pass"
      } catch (error) {
        check.result = "fail"
        if (!check.failures.length) check.failures.push(error instanceof Error ? error.message : String(error))
        index.stoppedAfterGroup = { route, profile, completedRuns: group.length, reason: "decisive-lighthouse-group-failure" }
        throw error
      }
    }
  }
  assert.deepEqual(await verifiedBuildIdentity(), initialIdentity, "Build changed during Lighthouse collection")
  index.result = priorityOnly ? "incomplete" : "pass"
  if (priorityOnly) {
    index.preflightResult = index.groupBudgetChecks.some(group => group.result !== "pass") ? "fail" : "pass"
    if (index.preflightResult === "fail") process.exitCode = 1
  }
} catch (error) {
  index.result = "fail"
  index.failure = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
} finally {
  try {
    if (index.hostedServing) {
      index.hostedServing.collectionFinishedAt = new Date().toISOString()
      try { index.hostedServing.after = await verifyMeasurementServing(); await assertMeasurementServingPair(index.hostedServing) }
      catch (error) {
        const failure = error instanceof Error ? error.message : String(error)
        index.hostedServing.after ??= { result: "fail", failure }
        index.hostedServing.validationFailure = failure
        index.result = "fail"; process.exitCode = 1
      }
    }
    if (outputReady) await writeFile(`${outputRoot}/${diagnostic ? "lighthouse-throttled-index.json" : "lighthouse-index.json"}`, `${evidenceJson(index, 2)}\n`)
  }
  finally { await releaseCompute() }
}
