import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const SANDBOX_CHROME = Object.freeze({
  version: "155.0.8059.79",
  path: "/var/lib/gridninja-cft/155.0.8059.79/chrome-linux64/chrome",
  sha256: "58957d0e74a9073626131018aabf17d97318227cca9b5dbdf5dee16345f2d211",
  profile: "gridninja-cft-155",
})
const LIMITS = Object.freeze({ processCount: 8192, ownedCount: 128, fileBytes: 32768, logBytes: 8192,
  launchMs: 15000, operationMs: 10000, closeMs: 15000, helperMs: 70000, receiptBytes: 262144 })
const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms))
const sha256 = value => createHash("sha256").update(value).digest("hex")
const validPid = pid => Number.isSafeInteger(pid) && pid > 1
// Exact independently reviewed bootstrap shared with the workflow. The hash is
// a workflow literal, never calculated from the checkout by this helper.
export const VERIFIED_HELPER_BOOTSTRAP = String.raw`import hashlib
import os
import stat
import sys

try:
    expected, source_path, *arguments = sys.argv[1:]
    if len(expected) != 64 or any(c not in "0123456789abcdef" for c in expected):
        raise ValueError()
    descriptor = os.open(source_path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, "rb") as source:
        metadata = os.fstat(source.fileno())
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > 262144:
            raise ValueError()
        payload = source.read(262145)
    if len(payload) > 262144 or hashlib.sha256(payload).hexdigest() != expected:
        raise ValueError()
    code = compile(payload, source_path, "exec")
except Exception:
    sys.stderr.write("verified-helper-bootstrap-rejected\n")
    sys.exit(1)
sys.argv = [source_path, *arguments]
namespace = {"__name__": "__main__", "__file__": source_path, "__package__": None, "__verified_helper_sha256__": hashlib.sha256(payload).hexdigest()}
exec(code, namespace, namespace)
`
const fixedFailure = error => typeof error?.proofCode === "string" && /^[A-Z0-9_]{1,64}$/.test(error.proofCode) ? error.proofCode : "PROOF_REQUIREMENT_FAILED"
function requireProof(condition, code) { if (!condition) throw Object.assign(new Error(code), { proofCode: code }) }

export function assertProofEnvironment(env, platform, uid, nodeVersion) {
  requireProof(platform === "linux" && uid > 0 && nodeVersion === "22.23.2", "WRONG_RUNTIME")
  requireProof(env.GITHUB_ACTIONS === "true" && env.RUNNER_OS === "Linux", "NOT_DISPOSABLE_CI")
  requireProof(env.GITHUB_REPOSITORY === "holdini25/GridNinjaSite" && env.GITHUB_REF === "refs/heads/codex/qualification-compatibility", "WRONG_REPOSITORY_OR_REF")
  requireProof(env.GITHUB_EVENT_NAME === "push" && env.GITHUB_RUN_ATTEMPT === "1", "WRONG_EVENT_OR_ATTEMPT")
  requireProof(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") && /^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? ""), "MISSING_CI_IDENTITY")
  requireProof(!env.HEADLESS && !env.FACILITY_CHROME_CHANNEL && env.FACILITY_EXPECTED_CHROME_VERSION === SANDBOX_CHROME.version, "BROWSER_OVERRIDE")
  requireProof(env.FACILITY_CHROME_EXECUTABLE_PATH === SANDBOX_CHROME.path && env.CHROME_PATH === SANDBOX_CHROME.path, "WRONG_EXECUTABLE")
  return { headSha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, runAttempt: 1 }
}

export function parseProcStat(text, pid) {
  requireProof(typeof text === "string" && text.length <= 4096, "INVALID_PROC_STAT")
  const close = text.lastIndexOf(") "), prefix = text.slice(0, text.indexOf(" ("))
  requireProof(close > 0 && prefix === String(pid), "PROC_PID_MISMATCH")
  const fields = text.slice(close + 2).trim().split(/\s+/)
  requireProof(fields.length >= 20 && /^[A-Z]$/.test(fields[0]), "INVALID_PROC_STAT")
  const ppid = Number(fields[1]), pgrp = Number(fields[2]), startTicks = fields[19]
  requireProof(Number.isSafeInteger(ppid) && ppid >= 0 && Number.isSafeInteger(pgrp) && pgrp > 0 && /^[1-9][0-9]*$/.test(startTicks), "INVALID_PROC_STAT")
  return { pid, ppid, pgrp, startTicks, state: fields[0] }
}

export function sameProcess(left, right) {
  return Boolean(left && right && validPid(left.pid) && left.pid === right.pid && left.startTicks === right.startTicks)
}

export function ownedDescendants(snapshot, previous, root) {
  requireProof(snapshot.length <= LIMITS.processCount && previous.length <= LIMITS.ownedCount, "PROCESS_LIMIT")
  const byPid = new Map(snapshot.map(p => [p.pid, p])), owned = new Map()
  // Retain a previously observed identity only while that exact task exists.
  for (const prior of [root, ...previous]) if (sameProcess(prior, byPid.get(prior.pid))) owned.set(prior.pid, byPid.get(prior.pid))
  for (let pass = 0; pass < LIMITS.ownedCount; pass++) {
    let changed = false
    for (const p of snapshot) {
      if (owned.has(p.pid)) continue
      const parent = owned.get(p.ppid)
      if (parent && BigInt(p.startTicks) >= BigInt(parent.startTicks)) { owned.set(p.pid, p); changed = true }
    }
    requireProof(owned.size <= LIMITS.ownedCount, "OWNED_PROCESS_LIMIT")
    if (!changed) break
  }
  return [...owned.values()]
}

export function liveAttestationProcesses(bound, root, rendererPids) {
  const byPid = new Map(bound.map(p => [p.pid, p])), selected = new Map([[root.pid, root]])
  requireProof(sameProcess(byPid.get(root.pid), root), "ROOT_NOT_LIVE")
  for (const rendererPid of rendererPids) {
    let current = byPid.get(rendererPid), count = 0
    while (current && current.pid !== root.pid && count++ < LIMITS.ownedCount) {
      selected.set(current.pid, current); current = byPid.get(current.ppid)
    }
    requireProof(current?.pid === root.pid && sameProcess(current, root), "RENDERER_NOT_LIVE_DESCENDANT")
  }
  return [...selected.values()].map(p => ({ pid: p.pid, startTicks: p.startTicks, ppid: p.ppid, pgrp: p.pgrp }))
}

const weakeningSwitch = /^--(?:single-process|no-zygote)(?:=|$)/
export function assertSandboxArgv(argv, kind, expectedLighthouse) {
  requireProof(Array.isArray(argv) && argv.length > 2 && argv.length <= 128 && argv.every(value => typeof value === "string" && value.length <= 4096), "INVALID_ARGV")
  requireProof(argv[0] === SANDBOX_CHROME.path && !argv.some(value => {
    const name = value.split("=", 1)[0]
    // The one frozen setuid-disable switch is intentional: namespace sandboxing
    // is the approved mechanism. Unknown sandbox/seccomp switches fail closed.
    return weakeningSwitch.test(value) || name.startsWith("--") && /sandbox|seccomp/i.test(name) && name !== "--disable-setuid-sandbox"
  }), "SANDBOX_DISABLED_ARGV")
  const profileArgs = argv.filter(value => value.startsWith("--user-data-dir="))
  requireProof(profileArgs.length === 1 && profileArgs[0].slice(16).startsWith("/"), "INVALID_FRESH_PROFILE_ARGV")
  if (kind === "lighthouse" || kind === "baseline") {
    requireProof(Array.isArray(expectedLighthouse), "MISSING_FROZEN_ARGV")
    requireProof(JSON.stringify(argv) === JSON.stringify(expectedLighthouse), "CHANGED_LIGHTHOUSE_ARGV")
    requireProof(argv.includes("--disable-setuid-sandbox"), "MISSING_FROZEN_SETUID_FLAG")
  } else {
    requireProof(kind === "playwright" && argv.includes("--remote-debugging-pipe") && argv.includes("--no-startup-window") && argv.includes("--headless"), "CHANGED_PLAYWRIGHT_TRANSPORT")
  }
  return { exactExecutable: true, noWeakeningSwitches: true, argc: argv.length, argvSha256: sha256(Buffer.from(argv.join("\0") + "\0")),
    transport: kind === "playwright" ? "remote-debugging-pipe" : "remote-debugging-port=0",
    disableSetuidSandbox: argv.includes("--disable-setuid-sandbox"), frozenLighthouseArgs: kind !== "playwright" }
}

export function sandboxPageFacts(rows) {
  requireProof(Array.isArray(rows) && rows.length <= 32 && Buffer.byteLength(JSON.stringify(rows)) <= 8192, "INVALID_SANDBOX_PAGE")
  const known = new Map()
  for (const row of rows) {
    requireProof(Array.isArray(row) && row.length <= 8 && row.every(cell => typeof cell === "string" && cell.length <= 512), "INVALID_SANDBOX_PAGE")
    if (row.length !== 2) continue
    const key = row[0].trim().replace(/\s+/g, " "), value = row[1].trim()
    if (key === "Layer 1 Sandbox") {
      requireProof(!known.has(key) && value === "Namespace", "LAYER_ONE_NOT_NAMESPACE")
      known.set(key, "Namespace")
      continue
    }
    if (!["SUID sandbox", "Namespace sandbox", "PID namespaces", "Network namespaces", "Seccomp-BPF sandbox", "Seccomp-BPF sandbox supports TSYNC", "Yama LSM"].includes(key)) continue
    requireProof(!known.has(key), "DUPLICATE_SANDBOX_INDICATOR")
    requireProof(value === "Yes" || value === "No", "UNKNOWN_SANDBOX_INDICATOR")
    known.set(key, value === "Yes")
  }
  requireProof(known.get("Layer 1 Sandbox") === "Namespace" && known.get("PID namespaces") === true && known.get("Network namespaces") === true && known.get("Seccomp-BPF sandbox") === true && known.get("Seccomp-BPF sandbox supports TSYNC") === true, "SANDBOX_PAGE_NOT_POSITIVE")
  if (known.has("Namespace sandbox")) requireProof(known.get("Namespace sandbox") === true, "NAMESPACE_SANDBOX_NOT_POSITIVE")
  return Object.fromEntries(known)
}

export function assertRootAttestation(attestation, request, rendererPids) {
  requireProof(attestation?.status === "PASS" && attestation.action === "attest" && attestation.headSha === request.headSha && String(attestation.runId) === request.runId, "ATTESTATION_IDENTITY")
  requireProof(attestation.profileName === SANDBOX_CHROME.profile && Array.isArray(attestation.processes) && attestation.processes.length <= LIMITS.ownedCount, "ATTESTATION_SCOPE")
  requireProof(Array.isArray(rendererPids) && rendererPids.length > 0 && rendererPids.length <= 32 && new Set(rendererPids).size === rendererPids.length, "MISSING_RENDERERS")
  const processes = new Map(attestation.processes.map(p => [p.pid, p]))
  requireProof(processes.size === attestation.processes.length, "DUPLICATE_ATTESTED_PID")
  const root = processes.get(request.rootPid)
  requireProof(root && String(root.startTicks) === request.rootStartTicks && root.role === "browser" && root.uid === request.runnerUid, "ROOT_PROCESS_IDENTITY")
  requireProof(root.executable === SANDBOX_CHROME.path && root.binarySha256 === SANDBOX_CHROME.sha256 && root.argvSha256 === request.expectedArgvSha256, "ROOT_BINARY_OR_ARGV")
  requireProof(root.label === `${SANDBOX_CHROME.profile} (unconfined)`, "WRONG_APPARMOR_ATTACHMENT")
  const namespace = (p, key) => {
    const value = p?.namespaces?.[key]
    requireProof(typeof value === "string" && new RegExp(`^${key}:\\[[1-9][0-9]*\\]$`).test(value), "INVALID_NAMESPACE_ID")
    return value
  }
  for (const key of ["user", "pid", "net"]) requireProof(namespace(root, key) === namespace({ namespaces: attestation.rootNamespaces }, key), "BROWSER_NOT_HOST_NAMESPACE")
  const rendererFacts = rendererPids.map(pid => {
    const p = processes.get(pid), expected = request.ownedProcesses.find(item => item.pid === pid)
    requireProof(p && expected && String(p.startTicks) === expected.startTicks && p.role === "renderer", "RENDERER_PROCESS_IDENTITY")
    requireProof(p.executable === SANDBOX_CHROME.path && p.uid === request.runnerUid && p.label === `${SANDBOX_CHROME.profile} (unconfined)`, "RENDERER_EXECUTABLE_OR_LABEL")
    requireProof(p.NoNewPrivs === 1 && p.Seccomp === 2 && Number.isSafeInteger(p.Seccomp_filters) && p.Seccomp_filters > 0 && /^0+$/.test(p.CapEff ?? ""), "RENDERER_KERNEL_SANDBOX")
    for (const key of ["user", "pid", "net"]) requireProof(namespace(p, key) !== namespace(root, key), "RENDERER_NAMESPACE_NOT_SEPARATE")
    requireProof(Array.isArray(p.uidMap) && p.uidMap.length === 1 && p.uidMap[0][1] === request.runnerUid && p.uidMap[0][2] === 1, "RENDERER_USER_MAPPING")
    // Membership in the captured tree is independently checked by the privileged reader.
    return { pid, startTicks: String(p.startTicks), namespaceUser: true, namespacePid: true, namespaceNetwork: true,
      noNewPrivileges: true, seccompFilter: true, seccompFilters: p.Seccomp_filters, effectiveCapabilitiesZero: true, expectedProfile: true }
  })
  return { rootBinary: true, rootArgv: true, exactAppArmorProfile: true, renderers: rendererFacts }
}

export function assertClosure(receipt, known, closed) {
  requireProof(closed === true, "DIRECT_CHILD_CLOSE_UNCONFIRMED")
  requireProof(receipt?.status === "PASS" && receipt.action === "closure" && receipt.allObservedIdentitiesGone === true && receipt.matchingInstallationProcesses === 0 && receipt.matchingProfileProcesses === 0 && receipt.unknownProcesses === 0, "PROCESS_CLOSURE_UNCONFIRMED")
  requireProof(known.length <= LIMITS.ownedCount && known.every(p => validPid(p.pid) && /^[1-9][0-9]*$/.test(p.startTicks)), "INVALID_OWNERSHIP_RECORD")
  return { directChildClosed: true, allObservedIdentitiesGone: true, matchingInstallationProcesses: 0, matchingProfileProcesses: 0, unknownProcesses: 0 }
}

export function boundedCapture(limit) {
  let bytes = 0, kept = Buffer.alloc(0)
  return { add(chunk) { const value = Buffer.from(chunk); bytes += value.length; if (kept.length < limit) kept = Buffer.concat([kept, value.subarray(0, limit - kept.length)]) },
    facts() { return { bytes, truncated: bytes > limit, noUsableSandbox: /No usable sandbox!/.test(kept.toString("utf8")), namespaceDenied: /(?:Failed to move to new namespace|Operation not permitted)/.test(kept.toString("utf8")) } } }
}

export function assertControlCallsClosed(records) {
  requireProof(Array.isArray(records) && records.length <= 1024, "CONTROL_CALL_LIMIT")
  for (const record of records) {
    requireProof(record.directory === true && record.symlink === false, "CONTROL_CALL_DIRECTORY_UNSAFE")
    requireProof(record.terminalFile === true && record.terminalSymlink === false, "PRIOR_HELPER_CLOSE_UNCONFIRMED")
    requireProof(record.terminalRecord && Number.isSafeInteger(record.terminalRecord.observedExitStatus)
      && record.terminalRecord.observedExitStatus >= -1 && record.terminalRecord.observedExitStatus <= 255
      && Number.isSafeInteger(record.terminalRecord.endedEpochMs) && record.terminalRecord.endedEpochMs > 0, "PRIOR_HELPER_CLOSE_UNCONFIRMED")
  }
}

async function boundedFile(path, cap = LIMITS.fileBytes) {
  const handle = await open(path, "r")
  try {
    const bytes = Buffer.alloc(cap + 1), { bytesRead } = await handle.read(bytes, 0, bytes.length, 0)
    requireProof(bytesRead <= cap, "FILE_READ_LIMIT")
    return bytes.subarray(0, bytesRead).toString("utf8")
  } finally { await handle.close() }
}
async function proc(pid) {
  try { return parseProcStat(await boundedFile(`/proc/${pid}/stat`, 4096), pid) }
  catch (error) { if (error.code === "ENOENT" || error.code === "ESRCH") return null; throw error }
}
async function snapshot() {
  const entries = (await readdir("/proc")).filter(value => /^[1-9][0-9]*$/.test(value))
  requireProof(entries.length <= LIMITS.processCount, "PROCESS_LIMIT")
  const out = []
  // Serial bounded reads avoid thousands of concurrent descriptors.
  for (const entry of entries) { const value = await proc(Number(entry)); if (value) out.push(value) }
  return out
}
function observeTree(root) {
  const known = new Map([[root.pid, root]]), state = { stop: false, error: null }
  const done = (async () => {
    while (!state.stop) {
      try { for (const p of ownedDescendants(await snapshot(), [...known.values()], root)) known.set(p.pid, p) }
      catch (error) { state.error = fixedFailure(error); break }
      await sleep(40)
    }
  })()
  return { known, state, async stop() { state.stop = true; await done; requireProof(!state.error, state.error ?? "PROCESS_OBSERVER_FAILED") } }
}
async function until(test, timeoutMs, code) {
  const deadline = Date.now() + timeoutMs
  do { const value = await test(); if (value) return value; await sleep(25) } while (Date.now() < deadline)
  requireProof(false, code)
}
async function deadline(promise, milliseconds, code) {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(code), { proofCode: code })), milliseconds) })]) }
  finally { clearTimeout(timer) }
}
async function jsonFile(path, value) {
  const text = JSON.stringify(value, null, 2) + "\n"
  requireProof(Buffer.byteLength(text) <= LIMITS.receiptBytes, "RECEIPT_LIMIT")
  await writeFile(path, text, { flag: "wx", mode: 0o600 })
}

async function durableControlFile(path, value) {
  const bytes = JSON.stringify(value) + "\n"
  requireProof(Buffer.byteLength(bytes) <= 4096, "CONTROL_RECORD_LIMIT")
  const handle = await open(path, "wx", 0o600)
  try { await handle.writeFile(bytes); await handle.sync() }
  finally { await handle.close() }
}

async function beginControlCall(context, action) {
  const uncertain = await lstat(join(context.evidence, "helper-uncertain.json")).catch(error => {
    if (error.code === "ENOENT") return null
    throw error
  })
  requireProof(!uncertain, "PRIOR_HELPER_CLOSE_UNCONFIRMED")
  const directory = join(context.evidence, "control-calls")
  await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== "EEXIST") throw error })
  const metadata = await lstat(directory)
  requireProof(metadata.isDirectory() && !metadata.isSymbolicLink(), "CONTROL_ROOT_UNSAFE")
  const names = await readdir(directory)
  requireProof(names.length <= 1024, "CONTROL_CALL_LIMIT")
  const records = []
  for (const name of names) {
    const prior = join(directory, name), priorMetadata = await lstat(prior)
    requireProof(priorMetadata.isDirectory() && !priorMetadata.isSymbolicLink(), "CONTROL_CALL_DIRECTORY_UNSAFE")
    const terminal = await lstat(join(prior, "terminal.json")).catch(error => {
      if (error.code === "ENOENT") return null
      throw error
    })
    let terminalRecord = null
    if (terminal?.isFile() && !terminal.isSymbolicLink()) {
      try { terminalRecord = JSON.parse(await boundedFile(join(prior, "terminal.json"), 4096)) }
      catch { /* Missing, truncated or malformed terminal evidence is pending. */ }
    }
    records.push({ directory: priorMetadata.isDirectory(), symlink: priorMetadata.isSymbolicLink(),
      terminalFile: terminal?.isFile() === true, terminalSymlink: terminal?.isSymbolicLink() === true, terminalRecord })
  }
  assertControlCallsClosed(records)
  // This directory is created before intent and remains pending on interruption
  // at any later point. Shell control calls use the same directory/filenames.
  const callDirectory = await mkdtemp(join(directory, "call-"))
  await durableControlFile(join(callDirectory, "intent.json"), { schemaVersion: "gridninja-helper-control.v1", action,
    phase: context.phase, startedEpochMs: Date.now(), head: context.headSha, runId: context.runId })
  return callDirectory
}

async function rootAction(context, action, request) {
  requireProof(["attest", "closure", "stop"].includes(action), "UNAPPROVED_HELPER_ACTION")
  requireProof(!context.helperUncertain, "PRIOR_HELPER_CLOSE_UNCONFIRMED")
  requireProof(/^[a-f0-9]{64}$/.test(process.env.GN_SANDBOX_PROVISION_SHA256 ?? ""), "HELPER_PIN_MISSING")
  const path = join(context.evidence, `${context.phase}-${action}-${context.call++}.request.json`)
  if (request) await jsonFile(path, request)
  const helper = join(context.repo, "scripts/facility/qualification-sandbox-provision.py")
  const callDirectory = await beginControlCall(context, action)
  const child = spawn("/usr/bin/sudo", ["-n", "/usr/bin/python3", "-I", "-c", VERIFIED_HELPER_BOOTSTRAP, process.env.GN_SANDBOX_PROVISION_SHA256,
    helper, action, ...(request ? ["--request", path] : []), "--head", context.headSha, "--run-id", context.runId], { stdio: ["ignore", "pipe", "pipe"], shell: false })
  let bytes = Buffer.alloc(0), stderrBytes = 0, overflow = false
  child.stdout.on("data", chunk => { if (bytes.length + chunk.length > LIMITS.receiptBytes) overflow = true; else bytes = Buffer.concat([bytes, chunk]) })
  child.stderr.on("data", chunk => { stderrBytes += chunk.length })
  let result
  try {
    result = await deadline(new Promise(resolvePromise => {
      let spawnError = false
      child.once("error", () => { spawnError = true })
      child.once("close", (code, signal) => resolvePromise({ code, signal, spawnError }))
    }), LIMITS.helperMs, "HELPER_CLOSE_UNCONFIRMED")
  } catch (error) {
    context.helperUncertain = true
    await jsonFile(join(context.evidence, "helper-uncertain.json"), { schemaVersion: "gridninja-helper-uncertain.v1", phase: context.phase,
      action, headSha: context.headSha, runId: context.runId, code: fixedFailure(error), prohibitFurtherHelperCalls: true,
      disposalRequired: true })
    throw error
  }
  // Persist observed child/pipes closure before parsing or trusting its output.
  // An abrupt outer-step timeout before this write leaves an intent-only call.
  await durableControlFile(join(callDirectory, "terminal.json"), { observedExitStatus: result.code ?? -1, signal: result.signal,
    spawnError: result.spawnError, endedEpochMs: Date.now() })
  let parsed
  try { parsed = JSON.parse(bytes.toString("utf8")) } catch { /* Record only typed diagnostics below. */ }
  if (overflow || stderrBytes !== 0 || result.spawnError || result.code !== 0 || result.signal !== null || parsed?.status !== "PASS" || parsed.action !== action) {
    await jsonFile(join(context.evidence, `${context.phase}-${action}-${context.call - 1}.receipt.json`), {
      status: "FAIL", action, exitCode: result.code, signal: result.signal, stderrBytes, outputOverflow: overflow,
      code: parsed?.action === action && /^[a-z0-9-]{1,96}$/.test(parsed?.code ?? "") ? parsed.code : "helper-terminal-result-invalid",
    })
    requireProof(false, "HELPER_REJECTED")
  }
  requireProof(parsed.status === "PASS" && parsed.action === action, "HELPER_REJECTED")
  await jsonFile(join(context.evidence, `${context.phase}-${action}-${context.call - 1}.receipt.json`), parsed)
  return parsed
}

function childEvents(child) {
  const facts = { closeObserved: false, exitCode: null, signal: null, spawnError: false }
  child.on("error", () => { facts.spawnError = true })
  child.once("close", (code, signal) => { facts.closeObserved = true; facts.exitCode = code; facts.signal = signal })
  return facts
}
function requestFor(context, root, observer, argvFacts, extra = {}) {
  return { schemaVersion: "gridninja-sandbox-proof.v1", phase: context.phase, headSha: context.headSha, runId: context.runId,
    runAttempt: 1, runnerUid: process.getuid(), rootPid: root.pid, rootStartTicks: root.startTicks,
    expectedArgvSha256: argvFacts.argvSha256, ownedProcesses: [...observer.known.values()].map(p => ({ pid: p.pid, startTicks: p.startTicks, ppid: p.ppid, pgrp: p.pgrp })), ...extra }
}
async function closeOwned(context, child, facts, observer, root, argvFacts, graceful) {
  let gracefulSucceeded = false, gracefulError = null
  try {
    if (!facts.closeObserved && graceful) {
      try { await deadline(graceful(), 5000, "GRACEFUL_CLOSE_TIMEOUT"); gracefulSucceeded = true }
      catch (error) { gracefulError = fixedFailure(error) }
    }
    // The root helper uses pidfds and exact start-time/executable/UID ownership checks.
    // No negative PID, process-group kill, killall, or guessed/reused numeric PID.
    if (!facts.closeObserved || [...observer.known.values()].some(p => p.pid !== root.pid)) {
      await rootAction(context, "stop", requestFor(context, root, observer, argvFacts))
    }
    await until(() => facts.closeObserved, LIMITS.closeMs, "DIRECT_CHILD_CLOSE_UNCONFIRMED")
    await observer.stop()
    const request = requestFor(context, root, observer, argvFacts)
    const closure = await rootAction(context, "closure", request)
    return { ...assertClosure(closure, request.ownedProcesses, facts.closeObserved), gracefulSucceeded, gracefulError }
  } finally { await observer.stop() }
}

async function rendererIds(session, rootPid) {
  const result = await deadline(session.send("SystemInfo.getProcessInfo"), LIMITS.operationMs, "CDP_PROCESS_TIMEOUT")
  requireProof(Array.isArray(result?.processInfo) && result.processInfo.length <= 128, "INVALID_CDP_PROCESSES")
  requireProof(result.processInfo.filter(p => p.type === "browser" && p.id === rootPid).length === 1, "CDP_BROWSER_PID_MISMATCH")
  const ids = result.processInfo.filter(p => p.type === "renderer").map(p => p.id)
  requireProof(ids.length > 0 && ids.length <= 32 && ids.every(validPid), "MISSING_RENDERERS")
  return ids
}
async function attestLive(context, root, observer, argvFacts, session, pageRows) {
  const page = sandboxPageFacts(pageRows), rendererPids = await rendererIds(session, root.pid)
  const fresh = await snapshot(), bound = ownedDescendants(fresh, [...observer.known.values()], root)
  for (const p of bound) observer.known.set(p.pid, p)
  for (const pid of rendererPids) requireProof(bound.some(p => p.pid === pid), "RENDERER_NOT_OWNED")
  // Attest only live root/renderer ancestor chains. Historical identities stay
  // in the separate ownership receipt for pidfd cleanup and final closure.
  const request = { ...requestFor(context, root, observer, argvFacts), ownedProcesses: liveAttestationProcesses(bound, root, rendererPids) }
  const attestation = await rootAction(context, "attest", request)
  return { page, kernel: assertRootAttestation(attestation, request, rendererPids) }
}

async function directChrome(context) {
  const { qualificationChromeFlags } = await import(pathToFileURL(join(context.repo, "scripts/facility/qualification-browser.mjs")).href)
  const profile = await mkdtemp(join(tmpdir(), `gridninja-sandbox-${context.phase}-`))
  const argv = [SANDBOX_CHROME.path, "--remote-debugging-port=0", `--user-data-dir=${profile}`, ...qualificationChromeFlags({ platform: "linux" }), "about:blank"]
  const expectedFacts = assertSandboxArgv(argv, context.phase, argv)
  const child = spawn(argv[0], argv.slice(1), { detached: true, stdio: ["ignore", "pipe", "pipe"], shell: false })
  const facts = childEvents(child), stdout = boundedCapture(LIMITS.logBytes), stderr = boundedCapture(LIMITS.logBytes)
  child.stdout.on("data", chunk => stdout.add(chunk)); child.stderr.on("data", chunk => stderr.add(chunk))
  const result = { child, facts, stdout, stderr, argvFacts: expectedFacts, root: null, observer: null, profile, setupError: null }
  try {
    result.root = await until(async () => validPid(child.pid) && await proc(child.pid), 1000, "ROOT_IDENTITY_UNCAPTURED")
    result.observer = observeTree(result.root)
    result.argvFacts = assertSandboxArgv(child.spawnargs, context.phase, argv)
  } catch (error) { result.setupError = error }
  return result
}

async function finishDirect(context, chrome, receipt, graceful) {
  if (chrome.root && chrome.observer) {
    receipt.closure = await closeOwned(context, chrome.child, chrome.facts, chrome.observer, chrome.root, chrome.argvFacts, graceful)
    receipt.ownedProcesses = requestFor(context, chrome.root, chrome.observer, chrome.argvFacts).ownedProcesses
  } else {
    // Without a captured start identity there is no permission to signal a PID.
    // An already exited child can still be independently checked for leftovers.
    requireProof(chrome.facts.closeObserved, "OWNERSHIP_UNCAPTURED_DISPOSAL_REQUIRED")
    receipt.closure = await rootAction(context, "closure")
    receipt.ownedProcesses = []
  }
  receipt.directChildClosed = chrome.facts.closeObserved
}

async function runBaseline(context, receipt) {
  const chrome = await directChrome(context)
  Object.assign(receipt, { rootPid: chrome.root?.pid ?? null, rootStartTicks: chrome.root?.startTicks ?? null, argv: chrome.argvFacts })
  let failure
  try {
    if (chrome.setupError) throw chrome.setupError
    await until(() => chrome.facts.closeObserved, LIMITS.launchMs, "BASELINE_DID_NOT_EXIT")
    requireProof(!chrome.facts.spawnError && chrome.facts.exitCode !== 0, "BASELINE_NOT_REJECTED")
    requireProof(chrome.stderr.facts().noUsableSandbox === true, "BASELINE_NO_SANDBOX_FAILURE_MARKER")
    requireProof(!chrome.stdout.facts().truncated && !chrome.stderr.facts().truncated, "BASELINE_LOG_LIMIT")
  } catch (error) { failure = error }
  finally {
    receipt.endedEpochMs = Date.now()
    receipt.stdout = chrome.stdout.facts(); receipt.stderr = chrome.stderr.facts()
    receipt.exit = { code: chrome.facts.exitCode, signal: chrome.facts.signal }
    await finishDirect(context, chrome, receipt)
  }
  if (failure) throw failure
  receipt.outcome = "DENIED_BASELINE_CLOSED"
  receipt.denialAttribution = "Pending independent privileged fresh-window AppArmor userns denial check; stderr alone is insufficient."
}

async function runLighthouseProof(context, receipt) {
  const chrome = await directChrome(context)
  let browser, failure
  Object.assign(receipt, { rootPid: chrome.root?.pid ?? null, rootStartTicks: chrome.root?.startTicks ?? null, argv: chrome.argvFacts,
    launcher: "owned direct spawn with frozen chrome-launcher argv", lifecycleDifference: "Mechanism proof uses direct spawn; matrix uses the existing chrome-launcher adapter with the same frozen argv." })
  try {
    if (chrome.setupError) throw chrome.setupError
    const endpoint = await until(async () => {
      requireProof(!chrome.facts.closeObserved && !chrome.facts.spawnError, "CHROME_EXITED_BEFORE_READY")
      try {
        const lines = (await boundedFile(join(chrome.profile, "DevToolsActivePort"), 1024)).trim().split("\n")
        requireProof(lines.length === 2 && /^[1-9][0-9]*$/.test(lines[0]) && Number(lines[0]) <= 65535 && /^\/devtools\/browser\/[a-f0-9-]+$/.test(lines[1]), "INVALID_DEVTOOLS_ENDPOINT")
        return `ws://127.0.0.1:${lines[0]}${lines[1]}`
      } catch (error) { if (error.code === "ENOENT") return null; throw error }
    }, LIMITS.launchMs, "DEVTOOLS_READY_TIMEOUT")
    const { loadQualificationToolchain } = await import(pathToFileURL(join(context.repo, "scripts/facility/qualification-toolchain.mjs")).href)
    const toolchain = await loadQualificationToolchain()
    receipt.toolchain = toolchain.identity
    browser = await deadline(toolchain.puppeteerCore.connect({ browserWSEndpoint: endpoint, protocolTimeout: LIMITS.operationMs }), LIMITS.operationMs, "PUPPETEER_CONNECT_TIMEOUT")
    requireProof((await deadline(browser.version(), LIMITS.operationMs, "BROWSER_VERSION_TIMEOUT")).replace(/^(?:Headless)?Chrome\//, "") === SANDBOX_CHROME.version, "ACTUAL_BROWSER_VERSION")
    const page = await deadline(browser.newPage(), LIMITS.operationMs, "PAGE_CREATE_TIMEOUT")
    await page.goto("chrome://sandbox", { waitUntil: "load", timeout: LIMITS.operationMs })
    const rows = await deadline(page.evaluate(() => [...document.querySelectorAll("tr")].map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent.trim()))), LIMITS.operationMs, "SANDBOX_PAGE_TIMEOUT")
    const session = await deadline(browser.target().createCDPSession(), LIMITS.operationMs, "CDP_SESSION_TIMEOUT")
    receipt.sandbox = await attestLive(context, chrome.root, chrome.observer, chrome.argvFacts, session, rows)
    requireProof(!chrome.stdout.facts().truncated && !chrome.stderr.facts().truncated, "PROOF_LOG_LIMIT")
  } catch (error) { failure = error }
  finally {
    receipt.stdout = chrome.stdout.facts(); receipt.stderr = chrome.stderr.facts()
    await finishDirect(context, chrome, receipt, browser ? () => browser.close() : undefined)
    receipt.endedEpochMs = Date.now()
  }
  if (failure) throw failure
  receipt.outcome = "PASS_SANDBOX_AND_CLOSURE"
}

async function runPlaywrightProof(context, receipt) {
  const require = createRequire(join(context.repo, "package.json"))
  const packageBytes = await readFile(require.resolve("playwright/package.json"))
  requireProof(JSON.parse(packageBytes).version === "1.61.1", "PLAYWRIGHT_VERSION")
  const { chromium } = await import(pathToFileURL(require.resolve("playwright")).href)
  const { qualificationPlaywrightOptions } = await import(pathToFileURL(join(context.repo, "scripts/facility/qualification-playwright.mjs")).href)
  const options = await qualificationPlaywrightOptions({ headless: true })
  requireProof(options.chromiumSandbox === true && options.executablePath === SANDBOX_CHROME.path, "PLAYWRIGHT_SANDBOX_OPTION")
  // Public launchServer uses the same server-side Chromium launch/defaultArgs path.
  // Its transport/lifecycle wrapper differs from the matrix's chromium.launch.
  const server = await chromium.launchServer({ ...options, timeout: LIMITS.launchMs, host: "127.0.0.1", port: 0 })
  let child, facts, root, observer, browser, failure, argvFacts = { argvSha256: "0".repeat(64) }
  try {
    child = server.process(); facts = childEvents(child)
    root = await proc(child.pid)
    requireProof(root && child.exitCode === null && child.signalCode === null, "PLAYWRIGHT_ROOT_UNAVAILABLE")
    observer = observeTree(root)
    argvFacts = assertSandboxArgv(child.spawnargs, "playwright")
    Object.assign(receipt, { rootPid: root.pid, rootStartTicks: root.startTicks, argv: argvFacts, playwrightVersion: "1.61.1",
      launcher: "public chromium.launchServer with qualificationPlaywrightOptions", lifecycleDifference: "Matrix uses chromium.launch; launchServer adds a local transport/server wrapper while sharing Chromium launch and defaultArgs implementation." })
    browser = await chromium.connect(server.wsEndpoint(), { timeout: LIMITS.operationMs })
    requireProof(browser.version() === SANDBOX_CHROME.version, "ACTUAL_BROWSER_VERSION")
    const page = await deadline(browser.newPage(), LIMITS.operationMs, "PAGE_CREATE_TIMEOUT")
    await page.goto("chrome://sandbox", { waitUntil: "load", timeout: LIMITS.operationMs })
    const rows = await deadline(page.evaluate(() => [...document.querySelectorAll("tr")].map(row => [...row.querySelectorAll("th,td")].map(cell => cell.textContent.trim()))), LIMITS.operationMs, "SANDBOX_PAGE_TIMEOUT")
    const session = await deadline(browser.newBrowserCDPSession(), LIMITS.operationMs, "CDP_SESSION_TIMEOUT")
    receipt.sandbox = await attestLive(context, root, observer, argvFacts, session, rows)
  } catch (error) { failure = error }
  finally {
    if (root && observer) {
      receipt.closure = await closeOwned(context, child, facts, observer, root, argvFacts, () => server.close())
      receipt.ownedProcesses = requestFor(context, root, observer, argvFacts).ownedProcesses
    } else {
      await deadline(server.close(), LIMITS.closeMs, "PLAYWRIGHT_UNIDENTIFIED_CLOSE_TIMEOUT")
      requireProof(facts?.closeObserved === true, "PLAYWRIGHT_UNIDENTIFIED_CLOSE_UNCONFIRMED")
      receipt.closure = await rootAction(context, "closure")
      receipt.ownedProcesses = []
    }
    receipt.directChildClosed = facts?.closeObserved === true
    receipt.endedEpochMs = Date.now()
  }
  if (failure) throw failure
  receipt.outcome = "PASS_SANDBOX_AND_CLOSURE"
}

export async function main(argv = process.argv.slice(2)) {
  requireProof(argv.length === 1 && ["baseline", "lighthouse", "playwright"].includes(argv[0]), "INVALID_PHASE")
  const phase = argv[0], repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  const identity = assertProofEnvironment(process.env, process.platform, process.getuid?.() ?? -1, process.versions.node)
  const evidence = join(repo, "build/qa/qualification-compatibility/sandbox-trial")
  await mkdir(evidence, { recursive: true, mode: 0o700 })
  const context = { ...identity, phase, repo, evidence, call: 0 }
  const receipt = { schemaVersion: "gridninja-sandbox-proof.v1", ...identity, phase, chromeVersion: SANDBOX_CHROME.version,
    chromePath: SANDBOX_CHROME.path, binarySha256: SANDBOX_CHROME.sha256, startedEpochMs: Date.now(), outcome: "FAIL" }
  try {
    requireProof(await realpath(SANDBOX_CHROME.path) === SANDBOX_CHROME.path, "BINARY_PATH_ALIAS")
    const digest = createHash("sha256")
    for await (const chunk of createReadStream(SANDBOX_CHROME.path)) digest.update(chunk)
    requireProof(digest.digest("hex") === SANDBOX_CHROME.sha256, "BINARY_DIGEST")
    if (phase === "baseline") await runBaseline(context, receipt)
    else if (phase === "lighthouse") await runLighthouseProof(context, receipt)
    else await runPlaywrightProof(context, receipt)
  } catch (error) { receipt.failureCode = fixedFailure(error); receipt.outcome = "FAIL"; process.exitCode = 1 }
  finally {
    receipt.endedEpochMs ??= Date.now()
    await jsonFile(join(evidence, `${phase}-proof.json`), receipt)
    // Only fixed labels/counts; no Chrome stderr, argv, local endpoint or raw proc data.
    process.stdout.write(JSON.stringify({ phase, outcome: receipt.outcome, failureCode: receipt.failureCode ?? null,
      ownedProcesses: receipt.ownedProcesses?.length ?? null, renderers: receipt.sandbox?.kernel?.renderers?.length ?? null,
      allObservedIdentitiesGone: receipt.closure?.allObservedIdentitiesGone === true }) + "\n")
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(JSON.stringify({ outcome: "FAIL", failureCode: fixedFailure(error) }) + "\n"); process.exitCode = 1 })
}
