import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFile, writeFile, mkdir, mkdtemp, rm, realpath } from "node:fs/promises"
import { createReadStream } from "node:fs"
import { createRequire } from "node:module"
import { hostname, platform, release, arch, cpus, totalmem, freemem, loadavg, tmpdir } from "node:os"
import { dirname, resolve, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { installProtocolObserver, preserveLighthouseArtifacts, COVERAGE_LIMITS } from "./observer.mjs"

const BASE_COMMIT = "e49a16e9f7f5c5000eea56bafa1c7c3bf75fa1eb"
const BASE_SOURCE = "1e52d18d508947f3a24238721a819af6f32ac076e40f822ba240697ff9529bfd"
const BASE_HARNESS = "12402446a422b35e7dad4b3c25001ec6b4a3a495e00c6245a688955e8e717d3a"
const CHROME = "155.0.8059.79"
const PLAN = Object.freeze(Array.from({ length: 12 }, (_, index) => ({ capture: index + 1, repetition: Math.floor(index / 2) + 1, route: index % 2 ? "/demo" : "/assessment", profile: index % 2 ? "desktop" : "mobile" })))
const ALLOWED = new Set(["vercel.json", ".github/workflows/navstart-diagnostic.yml", "scripts/qa/navigation-diagnostic/run.mjs", "scripts/qa/navigation-diagnostic/observer.mjs", "scripts/qa/navigation-diagnostic/observer.test.mjs"])
const root = resolve(process.argv[2] ?? "."), origin = process.argv[3] ?? process.env.FACILITY_BASE_URL ?? "http://localhost:3000"
const output = resolve(root, process.argv[4] ?? process.env.GN_NAVSTART_DIAGNOSTIC_OUTPUT ?? "build/qa/navstart-diagnostic-01")
assert(process.argv.length <= 5, "Usage: node run.mjs [repository-root] [loopback-origin] [fresh-output-directory]")
const url = new URL(origin)
assert(url.origin === origin && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !url.username && !url.password && !url.search && !url.hash && url.pathname === "/", "Only a bare HTTP loopback origin is allowed")
assert(output.startsWith(`${join(root, "build", "qa")}/`), "Output must be a fresh directory under build/qa")
process.chdir(root)
const require = createRequire(join(root, "package.json"))
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const json = value => `${JSON.stringify(value, null, 2)}\n`
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] })
const artifact = (name, value) => writeFile(join(output, name), json(value), { flag: "wx", mode: 0o600 })
const fileIdentity = async path => { const bytes = await readFile(path); return { bytes: bytes.length, sha256: sha(bytes) } }
const safeError = error => ({ name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) })
async function optionalText(path) {
  try { return { status: "available", text: await readFile(path, "utf8") } }
  catch (error) { return { status: "unavailable", code: error.code ?? "unknown" } }
}
async function memorySnapshot(chromePid, phase) {
  const startedAt = new Date().toISOString(), processes = [], seen = new Set()
  async function processTree(pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0 || seen.has(pid) || seen.size >= 256) return
    seen.add(pid)
    const status = await optionalText(`/proc/${pid}/status`), children = await optionalText(`/proc/${pid}/task/${pid}/children`)
    processes.push({ pid, status: status.status === "available" ? Object.fromEntries(status.text.split("\n").filter(line => /^(?:Name|State|Pid|PPid|Threads|VmPeak|VmSize|VmRSS|RssAnon|RssFile|RssShmem|VmSwap):/.test(line)).map(line => { const colon = line.indexOf(":"); return [line.slice(0, colon), line.slice(colon + 1).trim()] })) : status })
    if (children.status === "available") for (const child of children.text.trim().split(/\s+/)) await processTree(Number(child))
  }
  await processTree(chromePid)
  const proc = {}
  for (const name of ["meminfo", "loadavg", "pressure/cpu", "pressure/io", "pressure/memory", "self/cgroup"]) proc[name] = await optionalText(`/proc/${name}`)
  const cgroup = {}
  const relativeGroup = proc["self/cgroup"].text?.split("\n").find(line => line.startsWith("0::"))?.slice(3)
  if (relativeGroup && !relativeGroup.split("/").includes("..")) {
    const directory = resolve("/sys/fs/cgroup", `.${relativeGroup}`)
    if (directory === "/sys/fs/cgroup" || directory.startsWith("/sys/fs/cgroup/")) {
      for (const name of ["memory.current", "memory.max", "memory.peak", "memory.events", "memory.stat", "memory.pressure", "cpu.stat", "cpu.pressure", "io.pressure", "pids.current", "pids.max"]) cgroup[name] = await optionalText(join(directory, name))
    }
  }
  return { startedAt, finishedAt: new Date().toISOString(), phase, node: { memory: process.memoryUsage(), resourceUsage: process.resourceUsage() }, system: { freeMemory: freemem(), totalMemory: totalmem(), loadAverage: loadavg() }, proc, cgroup, chromeProcesses: processes, processLimitReached: seen.size >= 256 }
}
async function hashExecutable(path) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest("hex")
}
async function frozenSource(contract) {
  const changed = git(["diff", "--name-only", BASE_COMMIT, "--"]).trim().split("\n").filter(Boolean)
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).trim().split("\n").filter(Boolean)
  assert([...changed, ...untracked].every(path => ALLOWED.has(path)), "Original application files differ from frozen e49; refusing diagnostic")
  const original = Buffer.from(git(["show", `${BASE_COMMIT}:vercel.json`])), actual = await readFile("vercel.json")
  const modified = JSON.parse(original.toString())
  modified.git.deploymentEnabled["codex/navstart-diagnostic"] = false
  const approved = Buffer.from(`${JSON.stringify(modified, null, 2)}\n`)
  assert(actual.equals(original) || actual.equals(approved), "Only the exact diagnostic-branch deployment disable is permitted in vercel.json")
  const snapshot = await contract.sourceSnapshot(contract.SOURCE_PATHS, ".", original)
  assert.equal(snapshot.hostedSourceRevision, BASE_SOURCE, "Runtime source differs from frozen e49 after declared config exclusion")
  assert.equal(await contract.harnessRevision(), BASE_HARNESS, "Original measurement harness differs from frozen e49")
  return { baselineCommit: BASE_COMMIT, checkoutCommit: git(["rev-parse", "HEAD"]).trim(), changedPaths: changed, untrackedPaths: untracked, baselineSourceRevision: snapshot.hostedSourceRevision, actualSourceRevision: snapshot.sourceRevision, harnessRevision: BASE_HARNESS, vercelConfig: { actual: { bytes: actual.length, sha256: sha(actual) }, baseline: { bytes: original.length, sha256: sha(original) }, branchDisableOnly: !actual.equals(original) } }
}

await mkdir(dirname(output), { recursive: true })
await mkdir(output) // Fail rather than mix with old evidence.
const index = { schemaVersion: "gridninja-navigation-diagnostic.v1", diagnosticOnly: true, qualification: false, result: "incomplete", requestedOrigin: origin, plan: PLAN, retries: 0, coverageLimits: COVERAGE_LIMITS, startedAt: new Date().toISOString(), captures: [] }
let releaseCompute
try {
  assert.equal(platform(), "linux", "Linux-only experiment; no platform substitution")
  assert.equal(process.version, "v22.23.2", "Use the frozen Node 22.23.2 toolchain")
  for (const key of ["FACILITY_HOSTED_ATTESTATION_FILE", "FACILITY_PUBLIC_PRODUCTION_PINS_FILE", "FACILITY_HOSTED_BYPASS_SECRET", "VERCEL_AUTOMATION_BYPASS_SECRET", "FACILITY_ANGLE", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "VERCEL"]) assert(!process.env[key], `Diagnostic forbids ${key}`)
  assert(!process.env.FACILITY_BASE_URL || process.env.FACILITY_BASE_URL === origin, "Conflicting measurement origin")
  assert(!process.env.FACILITY_QUALIFICATION_ENVIRONMENT || process.env.FACILITY_QUALIFICATION_ENVIRONMENT === "local", "Only local diagnostic environment is permitted")
  const contract = await import(pathToFileURL(join(root, "scripts/facility/performance-contract.mjs")))
  const { acquireComputeLock } = await import(pathToFileURL(join(root, "scripts/facility/compute-lock.mjs")))
  index.source = await frozenSource(contract)
  index.build = await contract.verifiedBuildIdentity()
  assert.equal(index.build.sourceRevision, index.source.actualSourceRevision, "Build source differs from frozen diagnostic source")
  const packages = {}
  for (const name of ["lighthouse", "chrome-launcher", "puppeteer-core"]) {
    const path = require.resolve(`${name}/package.json`), bytes = await readFile(path)
    packages[name] = { version: JSON.parse(bytes).version, packageSha256: sha(bytes) }
  }
  assert.equal(packages.lighthouse.version, "12.6.1", "Use exact installed Lighthouse 12.6.1")
  assert.equal(packages["chrome-launcher"].version, "0.13.4", "Use the installed frozen chrome-launcher")
  const { default: lighthouse, desktopConfig } = await import(pathToFileURL(require.resolve("lighthouse")))
  const { launch } = require("chrome-launcher")
  const sessionPath = require.resolve("lighthouse/core/gather/session.js")
  const { ProtocolSession } = await import(pathToFileURL(sessionPath))
  const config = require(join(root, "scripts/facility/lighthouse.cjs"))
  const settingsByProfile = Object.fromEntries(["mobile", "desktop"].map(profile => {
    const settings = { ...config.ci.collect.settings, ...(profile === "desktop" ? desktopConfig.settings : { formFactor: "mobile" }) }
    delete settings.chromeFlags; delete settings.preset
    return [profile, settings]
  }))
  const chromeFlags = ["--headless"] // Exactly collect-lighthouse's software path.
  const here = dirname(fileURLToPath(import.meta.url)), files = {}
  for (const path of ["package.json", "package-lock.json", "scripts/facility/collect-lighthouse.mjs", "scripts/facility/lighthouse.cjs", "node_modules/lighthouse/core/gather/session.js", "node_modules/lighthouse/core/gather/driver/target-manager.js", "node_modules/lighthouse/core/gather/gatherers/trace.js", "node_modules/lighthouse/core/config/default-config.js", "node_modules/chrome-launcher/dist/chrome-launcher.js", "node_modules/chrome-launcher/dist/flags.js"]) files[path] = await fileIdentity(join(root, path))
  index.identity = { packages, files, diagnosticFiles: { runner: await fileIdentity(fileURLToPath(import.meta.url)), observer: await fileIdentity(join(here, "observer.mjs")) }, settingsByProfile, requestedChromeFlags: chromeFlags, node: { version: process.version, versions: process.versions }, os: { platform: platform(), release: release(), architecture: arch(), cpuModels: [...new Set(cpus().map(cpu => cpu.model))], logicalCpus: cpus().length, totalMemory: totalmem(), osRelease: await optionalText("/etc/os-release") }, hostnameSha256: sha(hostname()), expectedBrowser: CHROME }
  await artifact("identity.json", { ...index, captures: undefined })
  releaseCompute = await acquireComputeLock("navigation-diagnostic", { task: "diagnostic-only-no-qualification" })
  for (const item of PLAN) {
    const prefix = `${String(item.capture).padStart(2, "0")}-${item.route.slice(1)}-${item.profile}`
    const capture = { ...item, prefix, result: "incomplete", freshProfile: true, startedAt: new Date().toISOString() }
    index.captures.push(capture)
    const profileDirectory = await mkdtemp(join(tmpdir(), "gridninja-navigation-diagnostic-"))
    let chrome, observer, result, thrown, stop = false, observerStopped = false, observerFinished = false, rawAttempted = false
    function stopObserver() {
      if (!observer || observerStopped) return
      observerStopped = true
      try { observer.stop(); capture.observerRestored = true }
      catch (error) { capture.observerRestored = false; capture.observerStopError = safeError(error); capture.observerEvidence = { complete: false, lossClassification: "unknown", reasons: ["observer-stop-error"] }; stop = true }
    }
    async function saveRaw() {
      if (rawAttempted || !capture.measuredCallStartedAt) return
      rawAttempted = true
      capture.rawPreservation = await preserveLighthouseArtifacts(result, thrown ? safeError(thrown) : null, (name, value) => artifact(`${prefix}-${name}`, value))
      if (!capture.rawPreservation.complete) stop = true
    }
    async function finishObserver() {
      if (!observer || observerFinished) return
      stopObserver(); observerFinished = true
      try {
        const { earlyChunks, ...observation } = observer.finish()
        capture.observerEvidence = capture.observerStopError
          ? { ...observation.observerEvidence, complete: false, reasons: [...observation.observerEvidence.reasons, "observer-stop-error"], lossClassification: observation.observerEvidence.reportedLossObserved ? "reported-loss" : "unknown" }
          : observation.observerEvidence
        await artifact(`${prefix}-observer.json`, observation)
        await artifact(`${prefix}-early-chunks.json`, earlyChunks)
      } catch (error) { capture.observerFinishError = safeError(error); capture.observerEvidence = { ...capture.observerEvidence, complete: false, reasons: [...(capture.observerEvidence?.reasons ?? []), "observer-finalization-error"], lossClassification: capture.observerEvidence?.reportedLossObserved ? "reported-loss" : "unknown" }; stop = true }
      finally { observer = null }
    }
    try {
      await artifact(`${prefix}-before-memory.json`, await memorySnapshot(undefined, "before-browser-launch"))
      chrome = await launch({ chromeFlags, userDataDir: profileDirectory })
      const versionURL = `http://localhost:${chrome.port}/json/version`
      const response = await fetch(versionURL, { redirect: "error", credentials: "omit", signal: AbortSignal.timeout(10000) })
      assert.equal(response.status, 200, "Cannot read loopback browser identity")
      const version = await response.json()
      capture.browser = { Browser: version.Browser, protocolVersion: version["Protocol-Version"], userAgent: version["User-Agent"], v8Version: version["V8-Version"], webkitVersion: version["WebKit-Version"], actualSpawnArguments: chrome.process.spawnargs, pid: chrome.pid }
      if (version.Browser !== `Chrome/${CHROME}`) { stop = true; throw new Error(`Browser identity mismatch: required Chrome/${CHROME}; actual ${version.Browser}`) }
      observer = installProtocolObserver(ProtocolSession, { origin })
      capture.measuredCallStartedAt = new Date().toISOString()
      try { result = await lighthouse(origin + item.route, { port: chrome.port, output: "json", logLevel: "error" }, { extends: "lighthouse:default", settings: settingsByProfile[item.profile] }) }
      catch (error) { thrown = error }
      finally {
        capture.measuredCallFinishedAt = new Date().toISOString()
        stopObserver() // Nonthrowing; uncertain restoration aborts subsequent captures.
        await saveRaw() // Independent attempts before other fallible processing.
      }
      capture.result = thrown ? "thrown-error" : result?.lhr && !result.lhr.runtimeError ? "valid-lhr-diagnostic-only" : "invalid-lhr"
      capture.runtimeError = result?.lhr?.runtimeError ?? null
      capture.error = thrown ? safeError(thrown) : null
      capture.effectiveSettings = result?.lhr?.configSettings ?? null
      capture.lighthouseVersion = result?.lhr?.lighthouseVersion ?? null
      // Snapshot is after raw preservation, explicitly not an immediate end-of-LH sample.
      const afterMemory = await memorySnapshot(chrome.pid, "after-lighthouse-and-raw-artifact-preservation")
      for (const [label, path] of [["actualProcessExecutable", `/proc/${chrome.pid}/exe`], ["launcherExecutableOrWrapper", chrome.process.spawnfile]]) {
        try { const executable = await realpath(path); capture.browser[label] = { executable, sha256: await hashExecutable(executable), inspected: "after-lighthouse-settled" } }
        catch (error) { capture.browser[label] = { status: "unavailable", code: error.code ?? "unknown" } }
      }
      await artifact(`${prefix}-after-memory.json`, afterMemory)
      await finishObserver()
    } catch (error) {
      capture.result = "capture-error"; capture.error = safeError(error)
    } finally {
      stopObserver()
      await saveRaw()
      await finishObserver()
      try { await chrome?.kill() }
      catch (error) { capture.cleanupError = safeError(error); stop = true }
      finally {
        capture.chromeLogs = {}
        for (const name of ["chrome-out.log", "chrome-err.log"]) {
          try {
            const bytes = await readFile(join(profileDirectory, name))
            await writeFile(join(output, `${prefix}-${name}`), bytes, { flag: "wx", mode: 0o600 })
            capture.chromeLogs[name] = { status: "preserved", bytes: bytes.length, sha256: sha(bytes) }
          } catch (error) { capture.chromeLogs[name] = { status: "unavailable", code: error.code ?? "unknown" } }
        }
        if (capture.cleanupError) capture.retainedProfileDirectory = profileDirectory
        else await rm(profileDirectory, { recursive: true, force: true })
      }
      capture.finishedAt = new Date().toISOString()
      await artifact(`${prefix}-capture.json`, capture)
      await writeFile(join(output, "index.json"), json(index), { mode: 0o600 })
    }
    if (stop) throw new Error("Diagnostic aborted without browser substitution or retry; see capture identity")
  }
  assert.deepEqual(await frozenSource(contract), index.source, "Frozen source changed during diagnostic")
  assert.deepEqual(await contract.verifiedBuildIdentity(), index.build, "Build changed during diagnostic")
  index.result = "complete-diagnostic-only"
  index.invalidCaptures = index.captures.filter(capture => capture.result !== "valid-lhr-diagnostic-only").length
  index.observerIncompleteCaptures = index.captures.filter(capture => capture.observerEvidence?.complete !== true).length
  if (index.captures.some(capture => capture.result === "capture-error" || capture.cleanupError)) process.exitCode = 1
} catch (error) {
  index.result = "aborted-diagnostic-only"; index.error = safeError(error); process.exitCode = 1
} finally {
  index.finishedAt = new Date().toISOString()
  index.unattemptedCaptures = PLAN.filter(item => !index.captures.some(capture => capture.capture === item.capture))
  index.completedLighthouseCalls = index.captures.filter(capture => capture.measuredCallFinishedAt).length
  try { await writeFile(join(output, "index.json"), json(index), { mode: 0o600 }) }
  finally { await releaseCompute?.() }
}
