import childProcess from "node:child_process"
import fs from "node:fs"
import { createHash } from "node:crypto"
import { mkdtemp, open, readFile, readdir } from "node:fs/promises"
import { createRequire, syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { SANDBOX_CHROME, VERIFIED_HELPER_BOOTSTRAP, assertProofEnvironment, parseProcStat,
  sameProcess, ownedDescendants, liveAttestationProcesses, assertSandboxArgv, sandboxPageFacts } from "./qualification-sandbox-proof.mjs"

const spawn = childProcess.spawn
const LIMIT = Object.freeze({ operation: 10000, launch: 20000, close: 15000, helper: 60000, output: 98304, capture: 16384 })
const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms))
const hash = value => createHash("sha256").update(value).digest("hex")
const required = (value, code) => { if (!value) throw Object.assign(new Error(code), { proofCode: code }) }
const failureCode = error => /^[A-Z0-9_]{1,64}$/.test(error?.proofCode ?? "") ? error.proofCode : "NATIVE_REQUIREMENT_FAILED"
const identity = p => ({ pid: p.pid, ppid: p.ppid, pgrp: p.pgrp, startTicks: p.startTicks })

export function filteredCapture(cap = LIMIT.capture) {
  let bytes = 0, prefix = Buffer.alloc(0)
  const digest = createHash("sha256")
  return { add(chunk) { const value = Buffer.from(chunk); bytes += value.length; digest.update(value)
    if (prefix.length < cap) prefix = Buffer.concat([prefix, value.subarray(0, cap - prefix.length)]) },
  facts() { const text = prefix.toString("utf8"); return { bytes, prefixTruncated: bytes > cap, sha256: digest.copy().digest("hex"),
    noUsableSandbox: text.includes("No usable sandbox!"), namespaceDenied: /Failed to move to new namespace|Operation not permitted/.test(text) } } }
}

export function filteredError(error) {
  const message = filteredCapture()
  message.add(typeof error?.message === "string" ? error.message : "")
  return { name: /^[A-Za-z0-9_]{1,64}$/.test(error?.name ?? "") ? error.name : "UnknownError", message: message.facts() }
}

export function assertNativeAttestation(attestation, request, rendererPids) {
  required(attestation?.status === "PASS" && attestation.action === "attest" && attestation.schemaVersion === "gridninja-native-sandbox.v1", "ATTESTATION_SCHEMA")
  required(attestation.headSha === request.headSha && String(attestation.runId) === request.runId, "ATTESTATION_IDENTITY")
  required(Array.isArray(attestation.processes) && attestation.processes.length <= 128, "ATTESTATION_PROCESS_LIMIT")
  required(Array.isArray(rendererPids) && rendererPids.length > 0 && rendererPids.length <= 32 && new Set(rendererPids).size === rendererPids.length, "MISSING_RENDERERS")
  const byPid = new Map(attestation.processes.map(p => [p.pid, p]))
  required(byPid.size === attestation.processes.length, "DUPLICATE_ATTESTED_PID")
  const root = byPid.get(request.rootPid), caller = attestation.callerContext
  required(root?.startTicks === request.rootStartTicks && root.role === "browser" && root.uid === request.runnerUid && root.ppid === request.caller.pid, "ROOT_PROCESS_IDENTITY")
  required(root.executable === SANDBOX_CHROME.path && root.binarySha256 === SANDBOX_CHROME.sha256 && root.argvSha256 === request.expectedArgvSha256, "ROOT_BINARY_OR_ARGV")
  const namespace = (p, key) => { const value = p?.namespaces?.[key]
    required(typeof value === "string" && new RegExp(`^${key}:\\[[1-9][0-9]*\\]$`).test(value), "INVALID_NAMESPACE_ID"); return value }
  const label = p => { required(typeof p?.label === "string" && p.label.length > 0 && p.label.length <= 4096 && !/[\x00-\x1f\x7f]/.test(p.label), "INVALID_PROCESS_LABEL"); return p.label }
  required(caller?.pid === request.caller.pid && caller.startTicks === request.caller.startTicks && caller.uid === request.runnerUid, "CALLER_IDENTITY")
  label(caller); label(root)
  for (const key of ["user", "pid", "net"]) required(namespace(root, key) === namespace(caller, key), "BROWSER_NOT_CALLER_NAMESPACE")
  const renderers = rendererPids.map(pid => {
    const p = byPid.get(pid), owned = request.ownedProcesses.find(value => value.pid === pid)
    required(owned && p?.startTicks === owned.startTicks && p.role === "renderer" && p.uid === request.runnerUid, "RENDERER_PROCESS_IDENTITY")
    required(p.executable === SANDBOX_CHROME.path && p.binarySha256 === SANDBOX_CHROME.sha256, "RENDERER_BINARY")
    label(p)
    required(p.NoNewPrivs === 1 && p.Seccomp === 2 && Number.isSafeInteger(p.Seccomp_filters) && p.Seccomp_filters > 0 && /^0+$/.test(p.CapEff ?? ""), "RENDERER_KERNEL_SANDBOX")
    for (const key of ["user", "pid", "net"]) required(namespace(root, key) !== namespace(p, key), "RENDERER_NAMESPACE_NOT_SEPARATE")
    required(Array.isArray(p.uidMap) && p.uidMap.length === 1 && p.uidMap[0][1] === request.runnerUid && p.uidMap[0][2] === 1, "RENDERER_USER_MAPPING")
    required(Array.isArray(p.NSpid) && p.NSpid.length >= 2 && p.NSpid[0] === pid, "RENDERER_NSPID")
    return { ...identity(p), label: p.label, namespaces: p.namespaces, uidMap: p.uidMap, NSpid: p.NSpid,
      NoNewPrivs: p.NoNewPrivs, Seccomp: p.Seccomp, Seccomp_filters: p.Seccomp_filters, CapEff: p.CapEff }
  })
  return { caller: { ...identity(caller), label: caller.label, namespaces: caller.namespaces, NoNewPrivs: caller.NoNewPrivs, Seccomp: caller.Seccomp, Seccomp_filters: caller.Seccomp_filters, CapEff: caller.CapEff },
    root: { ...identity(root), label: root.label, namespaces: root.namespaces, NoNewPrivs: root.NoNewPrivs, Seccomp: root.Seccomp, Seccomp_filters: root.Seccomp_filters, CapEff: root.CapEff,
      binarySha256: root.binarySha256, argvSha256: root.argvSha256 }, renderers,
    attachmentCollisionStatus: "NOT_DETERMINED", insertionTrialStatus: "NOT_ATTEMPTED" }
}

export function assertNativeClosure(receipt, childClosed) {
  required(childClosed === true, "DIRECT_CHILD_CLOSE_UNCONFIRMED")
  required(receipt?.status === "PASS" && receipt.action === "closure" && receipt.schemaVersion === "gridninja-native-sandbox.v1" && receipt.allObservedIdentitiesGone === true
    && receipt.matchingInstallationProcesses === 0 && receipt.unknownProcesses === 0, "PROCESS_CLOSURE_UNCONFIRMED")
  return { directChildAndPipesClosed: true, allObservedIdentitiesGone: true, matchingInstallationProcesses: 0, unknownProcesses: 0,
    baselineSha256: receipt.baselineSha256 }
}

async function boundedFile(path, cap = 32768) { const handle = await open(path, "r"); try {
  const bytes = Buffer.alloc(cap + 1), { bytesRead } = await handle.read(bytes, 0, bytes.length, 0)
  required(bytesRead <= cap, "FILE_LIMIT"); return bytes.subarray(0, bytesRead).toString("utf8")
} finally { await handle.close() } }
async function fileDiagnostic(path) {
  const handle = await open(path, "r")
  try {
    const before = await handle.stat(), buffer = Buffer.alloc(Math.min(before.size, 1048576))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0), capture = filteredCapture()
    capture.add(buffer.subarray(0, bytesRead)); const after = await handle.stat()
    return { ...capture.facts(), bytes: before.size, prefixTruncated: before.size > LIMIT.capture,
      hashScope: bytesRead === before.size ? "complete-file" : "bounded-file-prefix", hashedBytes: bytesRead,
      fileStableAfterChildClose: before.size === after.size && before.mtimeMs === after.mtimeMs }
  } finally { await handle.close() }
}
async function proc(pid) { try { return parseProcStat(await boundedFile(`/proc/${pid}/stat`, 4096), pid) }
  catch (error) { if (["ENOENT", "ESRCH"].includes(error.code)) return null; throw error } }
async function snapshot() { const names = (await readdir("/proc")).filter(name => /^[1-9][0-9]*$/.test(name)); required(names.length <= 8192, "PROCESS_LIMIT")
  const result = []; for (const name of names) { const p = await proc(Number(name)); if (p) result.push(p) } return result }
async function deadline(promise, ms, code) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(code), { proofCode: code })), ms) })]) } finally { clearTimeout(timer) } }
async function until(test, ms, code) { const end = Date.now() + ms; do { const value = await test(); if (value) return value; await sleep(30) } while (Date.now() < end); required(false, code) }
function observe(root) { const known = new Map([[`${root.pid}:${root.startTicks}`, root]]), state = { stopped: false, error: null }
  const done = (async () => { while (!state.stopped) { try { for (const p of ownedDescendants(await snapshot(), [...known.values()], root)) known.set(`${p.pid}:${p.startTicks}`, p) }
    catch (error) { state.error = failureCode(error); break } await sleep(40) } })()
  return { known, async stop() { state.stopped = true; await done; required(!state.error, state.error ?? "OBSERVER_FAILED") } } }

function captureChild(child) { const capture = { child, root: null, observer: null, closeObserved: false, spawnError: false, exitCode: null, signal: null,
  stdout: filteredCapture(), stderr: filteredCapture(), rootCaptureError: null }
  child.on("error", () => { capture.spawnError = true })
  child.once("close", (code, signal) => { capture.closeObserved = true; capture.exitCode = code; capture.signal = signal })
  child.stdout?.on("data", chunk => capture.stdout.add(chunk)); child.stderr?.on("data", chunk => capture.stderr.add(chunk))
  try { if (child.pid) { capture.root = parseProcStat(fs.readFileSync(`/proc/${child.pid}/stat`, "utf8"), child.pid); capture.observer = observe(capture.root) } }
  catch (error) { capture.rootCaptureError = failureCode(error) }
  return capture
}

async function helperCall(context, action, extra = {}, privileged = false) {
  required(!context.helperUncertain, "HELPER_CLOSE_UNCONFIRMED")
  const request = { schemaVersion: "gridninja-native-sandbox.v1", headSha: context.headSha, runId: context.runId, runnerUid: process.getuid(), caller: identity(context.caller), ...extra }
  const args = ["-I", "-c", VERIFIED_HELPER_BOOTSTRAP, process.env.GN_NATIVE_OBSERVER_SHA256,
    join(context.repo, "scripts/facility/qualification-native-observer.py"), action]
  const child = spawn(privileged ? "/usr/bin/sudo" : "/usr/bin/python3", privileged ? ["-n", "/usr/bin/python3", ...args] : args,
    { stdio: ["pipe", "pipe", "pipe"], shell: false })
  let output = Buffer.alloc(0), overflow = false, spawnError = false; const stderr = filteredCapture()
  child.stdout.on("data", chunk => { if (output.length + chunk.length > LIMIT.output) overflow = true; else output = Buffer.concat([output, chunk]) })
  child.stderr.on("data", chunk => stderr.add(chunk)); child.on("error", () => { spawnError = true }); child.stdin.on("error", () => {})
  child.stdin.end(JSON.stringify(request))
  let terminal
  try { terminal = await deadline(new Promise(resolvePromise => child.once("close", (code, signal) => resolvePromise({ code, signal }))), LIMIT.helper, "HELPER_CLOSE_UNCONFIRMED") }
  catch (error) { context.helperUncertain = true; throw error }
  let receipt; try { receipt = JSON.parse(output) } catch { /* Only fixed diagnostics leave the process. */ }
  const control = { action, privileged, closeObserved: true, ...terminal, spawnError, outputBytes: output.length, outputOverflow: overflow, stderr: stderr.facts(),
    code: /^[a-z0-9-]{1,96}$/.test(receipt?.code ?? "") ? receipt.code : null }
  context.controlCalls.push(control)
  required(!overflow && !spawnError && terminal.signal === null && stderr.facts().bytes === 0, "HELPER_TERMINAL_INVALID")
  if (!privileged && receipt?.status === "FAIL" && receipt.code === "permission-denied") return helperCall(context, action, extra, true)
  required(terminal.code === 0 && receipt?.status === "PASS" && receipt.action === action, "HELPER_REJECTED")
  return receipt
}

function requestOwned(context, capture, argvFacts) { return { rootPid: capture.root?.pid ?? null, rootStartTicks: capture.root?.startTicks ?? null,
  expectedArgvSha256: argvFacts?.argvSha256, ownedProcesses: capture.observer ? [...capture.observer.known.values()].map(identity) : [] } }
async function attest(context, capture, argvFacts, session, rows) {
  const page = sandboxPageFacts(rows), cdp = await deadline(session.send("SystemInfo.getProcessInfo"), LIMIT.operation, "CDP_PROCESS_TIMEOUT")
  required(Array.isArray(cdp?.processInfo) && cdp.processInfo.length <= 128, "INVALID_CDP_PROCESS_LIST")
  required(cdp.processInfo.filter(p => p.type === "browser" && p.id === capture.root.pid).length === 1, "CDP_BROWSER_PID_MISMATCH")
  const rendererPids = cdp.processInfo.filter(p => p.type === "renderer").map(p => p.id)
  required(rendererPids.length > 0 && rendererPids.every(pid => Number.isSafeInteger(pid) && pid > 1), "MISSING_RENDERERS")
  const current = ownedDescendants(await snapshot(), [...capture.observer.known.values()], capture.root)
  for (const p of current) capture.observer.known.set(`${p.pid}:${p.startTicks}`, p)
  const live = liveAttestationProcesses(current, capture.root, rendererPids)
  const extra = { ...requestOwned(context, capture, argvFacts), ownedProcesses: live, rendererPids }
  const response = await helperCall(context, "attest", extra)
  return { page, kernel: assertNativeAttestation(response, { ...extra, headSha: context.headSha, runId: context.runId,
    runnerUid: process.getuid(), caller: identity(context.caller) }, rendererPids) }
}
async function close(context, capture, argvFacts, graceful, receipt) {
  if (!capture) { const closure = await helperCall(context, "closure", { ownedProcesses: [] }); receipt.closure = assertNativeClosure(closure, true); return }
  let gracefulError = null
  if (!capture.closeObserved && graceful) try { await deadline(graceful(), LIMIT.close, "GRACEFUL_CLOSE_TIMEOUT") } catch (error) { gracefulError = failureCode(error) }
  try {
    await until(() => capture.closeObserved, LIMIT.close, "DIRECT_CHILD_CLOSE_UNCONFIRMED")
    // Allow ordinary asynchronous descendant exit to complete; never signal by
    // label, process name, group or a reused PID. The helper then independently
    // checks every retained identity and the protected installation.
    if (capture.observer) await until(async () => {
      for (const known of capture.observer.known.values()) if (sameProcess(known, await proc(known.pid))) return false
      return true
    }, LIMIT.close, "OWNED_DESCENDANT_CLOSE_UNCONFIRMED")
  }
  catch (error) { receipt.disposalRequired = true; throw error }
  finally { if (capture.observer) await capture.observer.stop(); receipt.child = { pid: capture.child.pid ?? null, rootStartTicks: capture.root?.startTicks ?? null,
    directChildAndPipesClosed: capture.closeObserved, exitCode: capture.exitCode, signal: capture.signal, spawnError: capture.spawnError,
    stdout: capture.stdout.facts(), stderr: capture.stderr.facts() }; receipt.gracefulError = gracefulError }
  const extra = requestOwned(context, capture, argvFacts), closure = await helperCall(context, "closure", extra)
  receipt.ownedProcesses = extra.ownedProcesses
  receipt.closure = assertNativeClosure(closure, capture.closeObserved)
}

async function lighthouseSmoke(context, receipt) {
  const { qualificationChromeFlags } = await import(pathToFileURL(join(context.repo, "scripts/facility/qualification-browser.mjs")).href)
  const profile = await mkdtemp(join(tmpdir(), "gridninja-native-lighthouse-"))
  const argv = [SANDBOX_CHROME.path, "--remote-debugging-port=0", `--user-data-dir=${profile}`, ...qualificationChromeFlags({ platform: "linux" }), "about:blank"]
  const expectedArgvFacts = assertSandboxArgv(argv, "lighthouse", argv)
  let argvFacts
  const require = createRequire(join(context.repo, "tools/qualification/package.json"))
  const { Launcher } = await import(pathToFileURL(require.resolve("chrome-launcher")).href)
  let capture, browser, failure, spawns = 0
  const launcher = new Launcher({ ignoreDefaultFlags: true, chromePath: SANDBOX_CHROME.path, userDataDir: profile,
    chromeFlags: qualificationChromeFlags({ platform: "linux" }), startingUrl: "about:blank", port: 0 },
  { spawn: (...args) => { required(spawns++ === 0, "SECOND_LIGHTHOUSE_SPAWN"); const child = spawn(...args); capture = captureChild(child)
      try { argvFacts = assertSandboxArgv(child.spawnargs, "lighthouse", argv); receipt.argv = { ...argvFacts, capturedFromActualChild: true } }
      catch (error) { capture.argvError = failureCode(error); receipt.argvCaptureError = capture.argvError }
      return child } })
  receipt.launcher = "installed chrome-launcher Launcher with public spawn override"; receipt.lifecycleDifference = "Actual Launcher readiness and argv; graceful CDP browser.close replaces adapter kill because its Linux process-group signal is outside this probe."
  receipt.expectedArgv = expectedArgvFacts
  try {
    await deadline(launcher.launch(), 35000, "LIGHTHOUSE_LAUNCH_TIMEOUT")
    required(capture?.root && capture.observer && !capture.rootCaptureError && launcher.chromeProcess === capture.child, "ROOT_IDENTITY_UNCAPTURED")
    required(!capture.argvError && argvFacts, "ACTUAL_LIGHTHOUSE_ARGV_INVALID")
    required(Number.isSafeInteger(launcher.port) && launcher.port > 0 && launcher.port <= 65535, "INVALID_DEVTOOLS_ENDPOINT")
    const endpoint = `http://127.0.0.1:${launcher.port}`
    browser = await deadline(context.toolchain.puppeteerCore.connect({ browserURL: endpoint, protocolTimeout: LIMIT.operation }), LIMIT.operation, "PUPPETEER_CONNECT_TIMEOUT")
    required((await deadline(browser.version(), LIMIT.operation, "VERSION_TIMEOUT")).replace(/^(?:Headless)?Chrome\//, "") === SANDBOX_CHROME.version, "BROWSER_VERSION")
    const page = await deadline(browser.newPage(), LIMIT.operation, "PAGE_TIMEOUT")
    await page.goto("chrome://sandbox", { waitUntil: "load", timeout: LIMIT.operation })
    const rows = await deadline(page.evaluate(() => [...document.querySelectorAll("tr")].map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent.trim()))), LIMIT.operation, "PAGE_FACTS_TIMEOUT")
    const session = await deadline(browser.target().createCDPSession(), LIMIT.operation, "CDP_SESSION_TIMEOUT")
    receipt.sandbox = await attest(context, capture, argvFacts, session, rows)
  } catch (error) { failure = error; receipt.failureCode = failureCode(error); receipt.launchOrProofError = filteredError(error) }
  finally {
    try { await close(context, capture, argvFacts, browser ? () => browser.close() : null, receipt) }
    finally {
      if (capture?.closeObserved) {
        for (const [name, field] of [["chrome-out.log", "stdout"], ["chrome-err.log", "stderr"]]) {
          if (receipt.child) receipt.child[field] = await fileDiagnostic(join(profile, name))
        }
        for (const fd of [launcher.outFile, launcher.errFile]) if (Number.isSafeInteger(fd)) fs.closeSync(fd)
      }
    }
  }
  if (failure) throw failure
}

export function installPlaywrightObservation(onChild, primitives = { childProcess, process, fs }) {
  const originalSpawn = primitives.childProcess.spawn, originalKill = primitives.process.kill,
    originalRm = primitives.fs.promises.rm, originalRmSync = primitives.fs.rmSync
  const state = { spawns: 0, groupKillAttempts: 0, profileDeletionDeferrals: 0, profile: null, restored: false }
  primitives.childProcess.spawn = function(command, args, options) {
    required(command === SANDBOX_CHROME.path && state.spawns++ === 0, "UNEXPECTED_PLAYWRIGHT_SPAWN")
    const profileArgs = args.filter(arg => arg.startsWith("--user-data-dir="))
    required(profileArgs.length === 1 && profileArgs[0].slice(16).startsWith("/"), "PLAYWRIGHT_PROFILE_MISSING")
    state.profile = profileArgs[0].slice(16)
    required(primitives.fs.readdirSync(state.profile).length === 0, "PLAYWRIGHT_PROFILE_NOT_FRESH")
    const child = originalSpawn.call(this, command, args, options); onChild(child); return child
  }
  primitives.process.kill = function(pid, signal) { if (pid <= 0) { state.groupKillAttempts++; throw Object.assign(new Error("BROAD_SIGNAL_REJECTED"), { proofCode: "BROAD_SIGNAL_REJECTED" }) }
    return originalKill.call(this, pid, signal) }
  const protectedProfile = path => state.profile && (String(path) === state.profile || String(path).startsWith(`${state.profile}/`))
  primitives.fs.promises.rm = async function(path, options) { if (protectedProfile(path)) { state.profileDeletionDeferrals++; return } return originalRm.call(this, path, options) }
  primitives.fs.rmSync = function(path, options) { if (protectedProfile(path)) { state.profileDeletionDeferrals++; return } return originalRmSync.call(this, path, options) }
  if (primitives.childProcess === childProcess) syncBuiltinESMExports()
  return { state, restore() { primitives.childProcess.spawn = originalSpawn; primitives.process.kill = originalKill
    primitives.fs.promises.rm = originalRm; primitives.fs.rmSync = originalRmSync; state.restored = true
    if (primitives.childProcess === childProcess) syncBuiltinESMExports() } }
}

async function playwrightSmoke(context, receipt) {
  const require = createRequire(join(context.repo, "package.json")), pkg = JSON.parse(await readFile(require.resolve("playwright/package.json"), "utf8"))
  required(pkg.version === "1.61.1", "PLAYWRIGHT_VERSION")
  const { qualificationPlaywrightOptions } = await import(pathToFileURL(join(context.repo, "scripts/facility/qualification-playwright.mjs")).href)
  const options = await qualificationPlaywrightOptions({ headless: true })
  required(options.chromiumSandbox === true && options.executablePath === SANDBOX_CHROME.path, "PLAYWRIGHT_SANDBOX_OPTION")
  let capture, browser, argvFacts, failure, launchSettled = false
  const observation = installPlaywrightObservation(child => {
    capture = captureChild(child)
    try { argvFacts = assertSandboxArgv(child.spawnargs, "playwright"); receipt.argv = { ...argvFacts, capturedFromActualChild: true } }
    catch (error) { capture.argvError = failureCode(error); receipt.argvCaptureError = capture.argvError }
  })
  receipt.launcher = "actual chromium.launch with qualificationPlaywrightOptions"; receipt.playwrightVersion = pkg.version
  receipt.lifecycleDifference = "Scoped spawn observer preserves profile and rejects process-group kill fallbacks; any fallback request fails this smoke. No browser argument or sandbox setting is changed."
  try {
    const { chromium } = await import(pathToFileURL(require.resolve("playwright")).href)
    const launching = chromium.launch({ ...options, timeout: LIMIT.launch, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false })
    void launching.then(() => { launchSettled = true }, () => { launchSettled = true })
    browser = await deadline(launching, LIMIT.launch + 10000, "PLAYWRIGHT_LAUNCH_TIMEOUT")
    required(capture?.root && capture.observer && !capture.rootCaptureError && !capture.closeObserved, "PLAYWRIGHT_ROOT_UNAVAILABLE")
    required(!capture.argvError && argvFacts, "ACTUAL_PLAYWRIGHT_ARGV_INVALID")
    required(browser.version() === SANDBOX_CHROME.version, "BROWSER_VERSION")
    const page = await deadline(browser.newPage(), LIMIT.operation, "PAGE_TIMEOUT")
    await page.goto("chrome://sandbox", { waitUntil: "load", timeout: LIMIT.operation })
    const rows = await deadline(page.evaluate(() => [...document.querySelectorAll("tr")].map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent.trim()))), LIMIT.operation, "PAGE_FACTS_TIMEOUT")
    const session = await deadline(browser.newBrowserCDPSession(), LIMIT.operation, "CDP_SESSION_TIMEOUT")
    receipt.sandbox = await attest(context, capture, argvFacts, session, rows)
  } catch (error) { failure = error; receipt.failureCode = failureCode(error); receipt.launchOrProofError = filteredError(error) }
  finally {
    try { await close(context, capture, argvFacts, browser ? () => browser.close() : null, receipt) }
    finally { receipt.lifecycle = { browserSpawns: observation.state.spawns, groupKillAttempts: observation.state.groupKillAttempts,
      profileDeletionDeferrals: observation.state.profileDeletionDeferrals, profilePreserved: true, launchPromiseSettled: launchSettled }
      // Keep guards active through process exit if browser lifecycle is uncertain.
      if (receipt.closure?.allObservedIdentitiesGone && launchSettled) observation.restore()
      else receipt.disposalRequired = true }
  }
  required(observation.state.spawns === 1 && observation.state.groupKillAttempts === 0, "PLAYWRIGHT_LIFECYCLE_FALLBACK")
  if (failure) throw failure
}

async function dependencies() {
  const child = spawn("/usr/bin/ldd", [SANDBOX_CHROME.path], { stdio: ["ignore", "pipe", "pipe"], shell: false })
  let output = Buffer.alloc(0), overflow = false, spawnError = false; const stderr = filteredCapture()
  child.stdout.on("data", chunk => { if (output.length + chunk.length <= 32768) output = Buffer.concat([output, chunk]); else overflow = true })
  child.stderr.on("data", chunk => stderr.add(chunk)); child.on("error", () => { spawnError = true })
  const terminal = await deadline(new Promise(resolvePromise => child.once("close", (code, signal) => resolvePromise({ code, signal }))), LIMIT.operation, "LDD_CLOSE_UNCONFIRMED")
  required(!spawnError && !overflow && terminal.code === 0 && terminal.signal === null && !/not found/.test(output.toString("utf8")) && stderr.facts().bytes === 0, "MISSING_CHROME_LIBRARY")
  return { closeObserved: true, missingLibrary: false, stdoutSha256: hash(output), stdoutBytes: output.length }
}

export async function main() {
  const identityFacts = assertProofEnvironment(process.env, process.platform, process.getuid?.() ?? -1, process.versions.node)
  required(process.arch === "x64" && process.env.RUNNER_ARCH === "X64", "WRONG_ARCHITECTURE")
  required(!process.env.DEBUG && !process.env.PWDEBUG && /^[a-f0-9]{64}$/.test(process.env.GN_NATIVE_OBSERVER_SHA256 ?? ""), "UNSAFE_DEBUG_OR_HELPER_PIN")
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../.."), caller = await proc(process.pid)
  required(caller, "CALLER_IDENTITY")
  const context = { ...identityFacts, repo, caller, controlCalls: [], helperUncertain: false }
  const result = { schemaVersion: "gridninja-native-smoke.v1", ...identityFacts, outcome: "FAIL", attachmentCollisionStatus: "NOT_DETERMINED",
    insertionTrialStatus: "NOT_ATTEMPTED", qualification: false, startedEpochMs: Date.now(), smokes: [], maximumBrowserLaunches: 2 }
  try {
    await deadline((async () => {
    const prepared = await helperCall(context, "prepare", { archivePath: process.env.GN_CFT_ARCHIVE }, true)
    result.prepared = prepared; result.libraries = await dependencies()
    const { loadQualificationToolchain } = await import(pathToFileURL(join(repo, "scripts/facility/qualification-toolchain.mjs")).href)
    context.toolchain = await loadQualificationToolchain(); result.toolchain = context.toolchain.identity
    for (const [phase, run] of [["lighthouse", lighthouseSmoke], ["playwright", playwrightSmoke]]) {
      const receipt = { phase, outcome: "FAIL", startedEpochMs: Date.now() }; result.smokes.push(receipt)
      try { receipt.context = await helperCall(context, "context"); await run(context, receipt); receipt.outcome = "PASS_OBSERVED_NATIVE_SANDBOX" }
      finally { receipt.endedEpochMs = Date.now() }
    }
    result.outcome = "PASS_OBSERVED_NATIVE_SANDBOX"
    })(), 225000, "SMOKE_TOTAL_TIMEOUT")
  } catch (error) { result.failureCode = failureCode(error); result.disposalRequired = error?.proofCode === "SMOKE_TOTAL_TIMEOUT" || context.helperUncertain || result.smokes.some(smoke => smoke.disposalRequired || !smoke.closure) }
  result.controlCalls = context.controlCalls; result.endedEpochMs = Date.now()
  const output = JSON.stringify(result)
  required(Buffer.byteLength(output) <= LIMIT.output, "FINAL_OUTPUT_LIMIT")
  return { result, output, exitCode: result.outcome === "PASS_OBSERVED_NATIVE_SANDBOX" ? 0 : 1 }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(({ output, exitCode }) => { process.stdout.write(output + "\n", () => process.exit(exitCode)) })
    .catch(error => { process.stdout.write(JSON.stringify({ schemaVersion: "gridninja-native-smoke.v1", outcome: "FAIL", failureCode: failureCode(error), disposalRequired: true }) + "\n", () => process.exit(1)) })
}
