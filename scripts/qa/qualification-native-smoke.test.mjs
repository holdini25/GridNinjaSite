import test from "node:test"
import { spawn } from "node:child_process"
import { EventEmitter, once } from "node:events"
import fs from "node:fs"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import assert from "node:assert/strict"
import { assertNativeAttestation, assertNativeClosure, filteredCapture, installPlaywrightObservation, parseNativeProcStat, assertOwnedRoot, observeProcessTree, captureChild, closeNativeSmoke, helperCall } from "../facility/qualification-native-smoke.mjs"

const chrome = "/var/lib/gridninja-cft/155.0.8059.79/chrome-linux64/chrome"
const binarySha256 = "58957d0e74a9073626131018aabf17d97318227cca9b5dbdf5dee16345f2d211"
const clone = value => JSON.parse(JSON.stringify(value))
const ns = base => Object.fromEntries(["user", "pid", "net", "mnt"].map((key, i) => [key, `${key}:[${base + i}]`]))
function fixture() {
  const caller = { pid: 70, startTicks: "900", uid: 1001, label: "unconfined", namespaces: ns(100), NoNewPrivs: 0, Seccomp: 0, Seccomp_filters: 0, CapEff: "0000000000000000" }
  const request = { headSha: "a".repeat(40), runId: "123", runnerUid: 1001, caller: clone(caller),
    rootPid: 100, rootStartTicks: "1000", expectedArgvSha256: "b".repeat(64), ownedProcesses: [{ pid: 100, startTicks: "1000" }, { pid: 101, startTicks: "1001" }] }
  const root = { ...caller, pid: 100, ppid: 70, startTicks: "1000", role: "browser", executable: chrome, binarySha256, argvSha256: request.expectedArgvSha256 }
  const renderer = { ...root, pid: 101, ppid: 100, startTicks: "1001", role: "renderer", label: "chrome (unconfined)", namespaces: ns(200),
    NoNewPrivs: 1, Seccomp: 2, Seccomp_filters: 1, uidMap: [[1001, 1001, 1]], NSpid: [101, 2] }
  return { request, attestation: { status: "PASS", action: "attest", schemaVersion: "gridninja-native-sandbox.v1", headSha: request.headSha,
    runId: request.runId, callerContext: caller, processes: [root, renderer] } }
}

test("natural labels remain observed facts without inserted profile or collision claims", () => {
  const { request, attestation } = fixture(), result = assertNativeAttestation(attestation, request, [101])
  assert.equal(result.root.label, "unconfined"); assert.equal(result.renderers[0].label, "chrome (unconfined)")
  assert.equal(result.attachmentCollisionStatus, "NOT_DETERMINED"); assert.equal(result.insertionTrialStatus, "NOT_ATTEMPTED")
})
test("the old insertion trial schema cannot masquerade as native proof", () => {
  const { request, attestation } = fixture(); attestation.schemaVersion = "gridninja-sandbox-proof.v1"
  assert.throws(() => assertNativeAttestation(attestation, request, [101]), /ATTESTATION_SCHEMA/)
})
for (const [label, mutate] of [
  ["other run", a => { a.runId = "124" }], ["other head", a => { a.headSha = "c".repeat(40) }],
  ["reused root PID", a => { a.processes[0].startTicks = "1002" }], ["reparented root", a => { a.processes[0].ppid = 1 }],
  ["root different executable", a => { a.processes[0].executable = "/tmp/chrome" }],
  ["root different digest", a => { a.processes[0].binarySha256 = "0".repeat(64) }],
  ["root different argv", a => { a.processes[0].argvSha256 = "0".repeat(64) }],
  ["renderer reused PID", a => { a.processes[1].startTicks = "2001" }],
  ["renderer missing executable hash", a => { delete a.processes[1].binarySha256 }],
  ["renderer wrong UID", a => { a.processes[1].uid = 0 }], ["renderer role false", a => { a.processes[1].role = "utility" }],
  ["caller reused PID", a => { a.callerContext.startTicks = "901" }],
  ["caller UID root", a => { a.callerContext.uid = 0 }],
  ["duplicate PID", a => { a.processes.push(clone(a.processes[1])) }],
]) test(`rejects ${label}`, () => { const { request, attestation } = fixture(); mutate(attestation); assert.throws(() => assertNativeAttestation(attestation, request, [101])) })

for (const [key, value] of [["NoNewPrivs", 0], ["Seccomp", 0], ["Seccomp", 1], ["Seccomp_filters", 0], ["Seccomp_filters", "2"], ["CapEff", "0000000000000001"], ["label", ""], ["label", "chrome\n"], ["uidMap", [[0, 0, 1]]], ["uidMap", [[0, 1001, 65536]]], ["NSpid", [101]], ["NSpid", [102, 2]]]) {
  test(`rejects missing renderer protection ${key}=${JSON.stringify(value)}`, () => { const { request, attestation } = fixture(); attestation.processes[1][key] = value; assert.throws(() => assertNativeAttestation(attestation, request, [101])) })
}
for (const key of ["user", "pid", "net"]) {
  test(`renderer ${key} namespace must differ from browser`, () => { const { request, attestation } = fixture(); attestation.processes[1].namespaces[key] = attestation.processes[0].namespaces[key]; assert.throws(() => assertNativeAttestation(attestation, request, [101])) })
  test(`browser ${key} namespace must match ordinary caller`, () => { const { request, attestation } = fixture(); attestation.processes[0].namespaces = ns(400); assert.throws(() => assertNativeAttestation(attestation, request, [101])) })
}
test("CDP renderer list must be nonempty, unique and fully attested", () => {
  for (const ids of [[], [101, 101], [102], [101, 102]]) { const { request, attestation } = fixture(); assert.throws(() => assertNativeAttestation(attestation, request, ids)) }
})
const closure = { schemaVersion: "gridninja-native-sandbox.v1", action: "closure", status: "PASS", allObservedIdentitiesGone: true, matchingInstallationProcesses: 0, unknownProcesses: 0 }
test("closure uses owned/install identities without requiring globally empty natural label", () => {
  assert.equal(assertNativeClosure({ ...closure, matchingProfileProcesses: 27 }, true).allObservedIdentitiesGone, true)
})
test("closure requires positive child close plus no owned or installation leftovers", () => {
  assert.throws(() => assertNativeClosure(closure, false))
  for (const [key, value] of [["status", "FAIL"], ["allObservedIdentitiesGone", false], ["matchingInstallationProcesses", 1], ["unknownProcesses", 1], ["schemaVersion", "gridninja-sandbox-proof.v1"]]) assert.throws(() => assertNativeClosure({ ...closure, [key]: value }, true))
})
test("capture emits hash/count/classification and never arbitrary stderr", () => {
  const capture = filteredCapture(1000); capture.add("TOKEN=secret\n##[error]no\nNo usable sandbox! Operation not permitted")
  const result = capture.facts(); assert(result.noUsableSandbox); assert(result.namespaceDenied); assert.match(result.sha256, /^[a-f0-9]{64}$/)
  assert(!JSON.stringify(result).includes("secret")); assert(!JSON.stringify(result).includes("##["))
})
test("capture hashes all bytes while classifying only retained bounded prefix", () => {
  const a = filteredCapture(2), b = filteredCapture(100); a.add("ok"); a.add("No usable sandbox!"); b.add("okNo usable sandbox!")
  assert.equal(a.facts().sha256, b.facts().sha256); assert(a.facts().prefixTruncated); assert(!a.facts().noUsableSandbox); assert(b.facts().noUsableSandbox)
})
function primitives() {
  const calls = [], child = { pid: 99 }
  return { calls, child, childProcess: { spawn: (...args) => { calls.push(["spawn", ...args]); return child } },
    process: { kill: (...args) => { calls.push(["kill", ...args]); return true } },
    fs: { readdirSync: () => [], promises: { rm: async (...args) => { calls.push(["rm", ...args]) } }, rmSync: (...args) => { calls.push(["rmSync", ...args]) } } }
}
test("Playwright observes exactly one actual child and rejects implicit launch retry", () => {
  const p = primitives(), children = [], original = p.childProcess.spawn, guard = installPlaywrightObservation(child => children.push(child), p)
  const args = ["--user-data-dir=/tmp/pw", "--remote-debugging-pipe"]
  assert.equal(p.childProcess.spawn(chrome, args, { detached: true }), p.child)
  assert.deepEqual(children, [p.child]); assert.throws(() => p.childProcess.spawn(chrome, args, {}), /UNEXPECTED_PLAYWRIGHT_SPAWN/)
  assert.equal(p.calls.filter(call => call[0] === "spawn").length, 1); guard.restore(); assert.equal(p.childProcess.spawn, original)
})
test("Playwright guard rejects another executable before any spawn", () => {
  const p = primitives(), guard = installPlaywrightObservation(() => {}, p)
  assert.throws(() => p.childProcess.spawn("/tmp/chrome", ["--user-data-dir=/tmp/pw"], {})); assert.equal(p.calls.length, 0); guard.restore()
})
test("Playwright group kill is rejected and counted, not silently replaced", () => {
  const p = primitives(), guard = installPlaywrightObservation(() => {}, p)
  assert.throws(() => p.process.kill(-99, "SIGKILL"), /BROAD_SIGNAL_REJECTED/); assert.equal(guard.state.groupKillAttempts, 1)
  assert.equal(p.calls.length, 0); guard.restore()
})
test("profile cleanup is deferred only for this captured profile and descendants", async () => {
  const p = primitives(), guard = installPlaywrightObservation(() => {}, p)
  p.childProcess.spawn(chrome, ["--user-data-dir=/tmp/pw"], {})
  await p.fs.promises.rm("/tmp/pw", { recursive: true }); p.fs.rmSync("/tmp/pw/Default", { recursive: true })
  await p.fs.promises.rm("/tmp/pw-other", { recursive: true })
  assert.equal(guard.state.profileDeletionDeferrals, 2); assert.deepEqual(p.calls.filter(c => c[0] === "rm"), [["rm", "/tmp/pw-other", { recursive: true }]])
  guard.restore()
})
test("Playwright rejects a nonempty profile before spawn", () => {
  const p = primitives(); p.fs.readdirSync = () => ["existing"]
  const guard = installPlaywrightObservation(() => {}, p)
  assert.throws(() => p.childProcess.spawn(chrome, ["--user-data-dir=/tmp/pw"], {}), /PLAYWRIGHT_PROFILE_NOT_FRESH/)
  assert.equal(p.calls.length, 0); guard.restore()
})


const retained = JSON.parse(await readFile(new URL("./fixtures/qualification-native-observer-repair.json", import.meta.url), "utf8"))
// Explicitly synthetic stat lines. No raw stat bytes were retained from Ubuntu26.
const syntheticStat = ({ pid = 2, ppid = 0, pgrp = 0, state = "S", start = "0", comm = "synthetic kernel task" } = {}) =>
  `${pid} (${comm}) ${[state, ppid, pgrp, ...Array(16).fill(0), start, 0].join(" ")}`
const codeError = code => Object.assign(new Error(code), { proofCode: code })
const passClosure = { ...closure, namespaceControlsUnchanged: true }

test("genuine retained caller fields remain usable without inventing raw stat bytes", () => {
  assert.equal(retained.rawProcStatAvailable, false)
  assert.equal(assertOwnedRoot(retained.ubuntu26Caller).startTicks, "18252")
  assert.equal(retained.ubuntu26Caller.role, "runner")
  assert.equal(retained.ubuntu26ReadinessError.message.sha256, "641aaf7a2a3147f99f99059d1daf04ad2d2560a24195f9ecd406c4a78abda0fe")
  assert.deepEqual(retained.ubuntu26MissingDirectReceipts, ["child", "closure", "sandbox"])
})
for (const state of ["R", "S", "D", "Z", "T", "t", "X", "x", "K", "W", "P", "I"]) {
  test(`synthetic global Linux stat accepts documented ${state} state with zero kernel identity fields`, () => {
    const p = parseNativeProcStat(syntheticStat({ state }), 2)
    assert.equal(p.state, state); assert.equal(p.pgrp, 0); assert.equal(p.startTicks, "0")
    assert.throws(() => assertOwnedRoot(p), /INVALID_OWNED_ROOT/)
  })
}
test("synthetic stat preserves comm parentheses, large start ticks and distinct PID identity", () => {
  const p = parseNativeProcStat(syntheticStat({ pid: 81, ppid: 5, pgrp: 81, start: "18446744073709551615", comm: "name ) ( with spaces" }), 81)
  assert.equal(p.startTicks, "18446744073709551615"); assert.equal(p.ppid, 5)
  assert.throws(() => parseNativeProcStat(syntheticStat({ pid: 81 }), 82), /PROC_PID_MISMATCH/)
})
test("synthetic malformed proc identities still fail closed", () => {
  for (const values of [{ ppid: -1 }, { pgrp: -1 }, { pgrp: "1e2" }, { ppid: "9007199254740992" }, { start: "-1" }, { start: "1.5" }, { state: "Q" }, { state: "ss" }]) {
    assert.throws(() => parseNativeProcStat(syntheticStat(values), 2), JSON.stringify(values))
  }
  assert.throws(() => parseNativeProcStat("2 (short) S 0 0", 2))
  assert.throws(() => parseNativeProcStat("x".repeat(4097), 2))
})
test("an immediately dead owned child keeps its positive historical identity", () => {
  for (const state of ["Z", "X", "x"]) {
    const p = parseNativeProcStat(syntheticStat({ pid: 81, ppid: 5, pgrp: 81, start: "44", state }), 81)
    assert.equal(assertOwnedRoot(p).state, state)
  }
})

async function localNodeCapture({ invalidSnapshot = false, delayMs = 0 } = {}) {
  // This is a harmless local Node child, never Chrome. Its /proc input is an
  // explicitly synthetic fixture so the lifecycle test also runs on macOS.
  const child = spawn(process.execPath, ["-e", `process.stderr.write(${JSON.stringify("SYNTHETIC_TEST No usable sandbox!\n")}); setTimeout(() => process.exit(23), ${delayMs})`], { stdio: ["ignore", "pipe", "pipe"] })
  const capture = captureChild(child, {
    readRootStat: pid => syntheticStat({ pid, ppid: process.pid, pgrp: pid, start: "1000" }),
    startObserver: root => observeProcessTree(root, {
      snapshotProcesses: async () => invalidSnapshot ? [parseNativeProcStat("2 (synthetic malformed) S 0", 2)] : [],
    }),
  })
  return { child, capture }
}

test("actual child close plus actual observer failure retains diagnostics and attempts independent closure", async () => {
  const { child, capture } = await localNodeCapture({ invalidSnapshot: true })
  await once(child, "close")
  const dir = await mkdtemp(join(tmpdir(), "gn-native-repair-test-")), out = join(dir, "out"), err = join(dir, "err")
  await writeFile(out, "SYNTHETIC_STDOUT_CANARY"); await writeFile(err, "SYNTHETIC_STDERR_CANARY No usable sandbox!\n")
  const fds = [fs.openSync(out, "r"), fs.openSync(err, "r")], calls = []
  const receipt = { outcome: "FAIL", failureCode: "NATIVE_REQUIREMENT_FAILED", launchOrProofError: clone(retained.ubuntu26ReadinessError) }
  await assert.rejects(closeNativeSmoke({}, capture, {}, null, receipt, {
    readProcess: async () => null,
    runHelper: async (_context, action, request) => { calls.push({ action, request }); return passClosure },
    logs: [{ path: out, field: "stdout" }, { path: err, field: "stderr" }], fileDescriptors: fds,
  }), /INVALID_PROC_STAT/)
  assert.equal(receipt.observerFailureCode, "INVALID_PROC_STAT"); assert.equal(receipt.observationIncomplete, true)
  assert.equal(receipt.child.pid, child.pid); assert.equal(receipt.child.spawnObserved, true); assert.equal(receipt.child.exitObserved, true)
  assert.equal(receipt.child.directChildAndPipesClosed, true); assert.equal(receipt.child.exitCode, 23)
  assert.equal(receipt.child.stderr.noUsableSandbox, true); assert.equal(receipt.child.stderr.readAfterChildClose, true)
  assert.equal(receipt.closure.allObservedIdentitiesGone, true); assert.equal(calls.length, 1); assert.equal(calls[0].action, "closure")
  assert.equal(receipt.disposalRequired, true); assert.equal(receipt.outcome, "FAIL")
  assert.deepEqual(receipt.launchOrProofError, retained.ubuntu26ReadinessError)
  assert(!JSON.stringify(receipt).includes("CANARY"))
  for (const fd of fds) assert.throws(() => fs.fstatSync(fd), { code: "EBADF" })
})

test("independent closure failure cannot erase observer error or child diagnostics", async () => {
  const { child, capture } = await localNodeCapture({ invalidSnapshot: true }); await once(child, "close")
  const receipt = { outcome: "FAIL" }
  await assert.rejects(closeNativeSmoke({}, capture, {}, null, receipt, {
    readProcess: async () => null, runHelper: async () => { throw codeError("HELPER_REJECTED") },
  }), /INVALID_PROC_STAT/)
  assert.deepEqual(receipt.cleanupErrors.map(e => e.phase), ["observer-stop", "independent-closure"])
  assert.equal(receipt.child.directChildAndPipesClosed, true); assert.equal(receipt.child.stderr.noUsableSandbox, true)
  assert.equal(receipt.closure, undefined); assert.equal(receipt.disposalRequired, true)
})

test("missing stdout log does not hide stderr or prevent either descriptor close", async () => {
  const { child, capture } = await localNodeCapture(); await once(child, "close")
  const dir = await mkdtemp(join(tmpdir(), "gn-native-repair-logs-")), out = join(dir, "out"), err = join(dir, "err")
  await writeFile(out, "unused"); await writeFile(err, "SYNTHETIC No usable sandbox!\n")
  const fds = [fs.openSync(out, "r"), fs.openSync(err, "r")], receipt = {}
  await assert.rejects(closeNativeSmoke({}, capture, {}, null, receipt, {
    readProcess: async () => null, runHelper: async () => passClosure,
    logs: [{ path: join(dir, "missing"), field: "stdout" }, { path: err, field: "stderr" }], fileDescriptors: fds,
  }))
  assert.equal(receipt.child.stderr.noUsableSandbox, true); assert.equal(receipt.cleanupErrors[0].phase, "diagnostic-stdout")
  assert.equal(receipt.disposalRequired, false); assert.equal(receipt.closure.allObservedIdentitiesGone, true)
  for (const fd of fds) assert.throws(() => fs.fstatSync(fd), { code: "EBADF" })
})

test("unclosed child remains failed even if an independent fixture claims closure and stable log", async () => {
  const { child, capture } = await localNodeCapture({ delayMs: 500 })
  const closed = once(child, "close"), dir = await mkdtemp(join(tmpdir(), "gn-native-repair-open-")), log = join(dir, "err")
  await writeFile(log, "SYNTHETIC stable file while child lives")
  const receipt = {}
  await assert.rejects(closeNativeSmoke({}, capture, {}, null, receipt, {
    readProcess: async () => null, runHelper: async () => passClosure, timeoutMs: 1,
    logs: [{ path: log, field: "stderr" }],
  }), /DIRECT_CHILD_CLOSE_UNCONFIRMED/)
  assert.equal(receipt.child.directChildAndPipesClosed, false); assert.equal(receipt.child.stderr.fileStableDuringRead, true)
  assert.equal(receipt.child.stderr.readAfterChildClose, false); assert.equal(receipt.closure, undefined)
  assert.equal(receipt.independentClosure.allObservedIdentitiesGone, true); assert.equal(receipt.disposalRequired, true)
  await closed
})

test("actual OS spawn failure is distinct from returned spawn arguments", async () => {
  const child = spawn("/gridninja-test-nonexistent-executable", [], { stdio: ["ignore", "pipe", "pipe"] })
  const capture = captureChild(child), closed = new Promise(resolve => child.once("close", resolve))
  await closed
  const receipt = { outcome: "FAIL" }
  await closeNativeSmoke({}, capture, {}, null, receipt, { runHelper: async () => passClosure })
  assert.equal(receipt.child.spawnObserved, false); assert.equal(receipt.child.spawnError, true)
  assert.equal(receipt.child.pid, null); assert.equal(receipt.child.directChildAndPipesClosed, true)
  assert.equal(receipt.outcome, "FAIL"); assert.match(receipt.child.spawnErrorFacts.message.sha256, /^[a-f0-9]{64}$/)
})

test("separate historical Ubuntu24 lifecycle replay retains SIGABRT without assigning it to Ubuntu26", async () => {
  const historical = retained.ubuntu24Lifecycle, child = Object.assign(new EventEmitter(), { pid: historical.pid })
  const capture = captureChild(child, { readRootStat: () => { throw codeError("FIXTURE_NO_STAT") } })
  child.emit("spawn"); child.emit("exit", historical.exit.code, historical.exit.signal); child.emit("close", historical.close.code, historical.close.signal)
  const receipt = { outcome: "FAIL" }
  await closeNativeSmoke({}, capture, {}, null, receipt, { runHelper: async () => passClosure })
  assert.equal(receipt.child.spawnObserved, historical.spawnObserved); assert.equal(receipt.child.signal, "SIGABRT")
  assert.equal(receipt.child.rootCaptureError, "FIXTURE_NO_STAT"); assert(retained.ubuntu26MissingDirectReceipts.includes("child"))
})

test("actual helper child receipts keep numeric exit status separate from helper failure code", async () => {
  const calls = [], context = { headSha: "a".repeat(40), runId: "123", repo: "/synthetic-repo", caller: { pid: process.pid, startTicks: "1000" }, controlCalls: [] }
  const spawnHelper = (command, args, options) => {
    const index = calls.length; calls.push({ command, args })
    const response = index === 0 ? { status: "FAIL", action: "closure", code: "permission-denied" } : { status: "PASS", action: "closure" }
    const program = `process.stdin.resume(); process.stdin.on('end', () => process.stdout.write(${JSON.stringify(JSON.stringify(response))}, () => process.exit(${index === 0 ? 1 : 0})))`
    return spawn(process.execPath, ["-e", program], options)
  }
  await helperCall(context, "closure", {}, false, { spawnHelper })
  assert.equal(calls[0].command, "/usr/bin/python3"); assert.equal(calls[1].command, "/usr/bin/sudo")
  assert.deepEqual(context.controlCalls.map(call => [call.exitCode, call.code]), [[1, "permission-denied"], [0, null]])
  assert(context.controlCalls.every(call => call.closeObserved))
})
