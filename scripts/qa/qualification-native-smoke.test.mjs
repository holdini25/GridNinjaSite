import test from "node:test"
import assert from "node:assert/strict"
import { assertNativeAttestation, assertNativeClosure, filteredCapture, installPlaywrightObservation } from "../facility/qualification-native-smoke.mjs"

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
