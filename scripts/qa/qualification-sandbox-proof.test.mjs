import test from "node:test"
import assert from "node:assert/strict"
import { SANDBOX_CHROME, assertProofEnvironment, parseProcStat, sameProcess, ownedDescendants, liveAttestationProcesses,
  assertSandboxArgv, sandboxPageFacts, assertRootAttestation, assertClosure, boundedCapture, assertControlCallsClosed } from "../facility/qualification-sandbox-proof.mjs"

const env = { GITHUB_ACTIONS: "true", RUNNER_OS: "Linux", GITHUB_REPOSITORY: "holdini25/GridNinjaSite",
  GITHUB_REF: "refs/heads/codex/qualification-compatibility", GITHUB_EVENT_NAME: "push", GITHUB_RUN_ATTEMPT: "1",
  GITHUB_SHA: "a".repeat(40), GITHUB_RUN_ID: "123", FACILITY_EXPECTED_CHROME_VERSION: SANDBOX_CHROME.version,
  FACILITY_CHROME_EXECUTABLE_PATH: SANDBOX_CHROME.path, CHROME_PATH: SANDBOX_CHROME.path }
const pid = (id, parent, start, extra = {}) => ({ pid: id, ppid: parent, pgrp: 100, startTicks: String(start), state: "S", ...extra })
const root = pid(100, 90, 1000)
const rows = [["Layer 1 Sandbox", "Namespace"], ["PID namespaces", "Yes"], ["Network namespaces", "Yes"],
  ["Seccomp-BPF sandbox", "Yes"], ["Seccomp-BPF sandbox supports TSYNC", "Yes"], ["Yama LSM", "Yes"]]
const expected = [SANDBOX_CHROME.path, "--remote-debugging-port=0", "--user-data-dir=/tmp/fresh-profile", "--disable-setuid-sandbox", "--headless", "about:blank"]
const clone = value => JSON.parse(JSON.stringify(value))
const ns = n => Object.fromEntries(["user", "pid", "net", "mnt"].map((key, i) => [key, `${key}:[${n + i}]`]))
function fixture() {
  const request = { headSha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, rootPid: 100, rootStartTicks: "1000", runnerUid: 1001,
    expectedArgvSha256: "f".repeat(64), ownedProcesses: [{ pid: 100, startTicks: "1000" }, { pid: 101, startTicks: "1001" }] }
  const attestation = { status: "PASS", action: "attest", headSha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID,
    profileName: SANDBOX_CHROME.profile, rootNamespaces: ns(4000), processes: [
      { pid: 100, startTicks: "1000", role: "browser", uid: 1001, executable: SANDBOX_CHROME.path,
        binarySha256: SANDBOX_CHROME.sha256, argvSha256: request.expectedArgvSha256,
        label: `${SANDBOX_CHROME.profile} (unconfined)`, namespaces: ns(4000) },
      { pid: 101, startTicks: "1001", role: "renderer", uid: 1001, executable: SANDBOX_CHROME.path,
        label: `${SANDBOX_CHROME.profile} (unconfined)`, namespaces: ns(5000), NoNewPrivs: 1, Seccomp: 2,
        Seccomp_filters: 2, CapEff: "0000000000000000", uidMap: [[0, 1001, 1]] },
    ] }
  return { request, attestation }
}

test("proof accepts only exact CI runtime and fresh run identity", () => {
  assert.deepEqual(assertProofEnvironment(env, "linux", 1001, "22.23.2"), { headSha: env.GITHUB_SHA, runId: "123", runAttempt: 1 })
  for (const values of [[env, "darwin", 1001, "22.23.2"], [env, "linux", 0, "22.23.2"], [env, "linux", 1001, "22.23.1"]]) assert.throws(() => assertProofEnvironment(...values))
})
test("proof rejects rerun, other branches, PR events and executable overrides", () => {
  for (const [key, value] of Object.entries({ GITHUB_RUN_ATTEMPT: "2", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REPOSITORY: "other/GridNinjaSite", GITHUB_ACTIONS: "false", HEADLESS: "1", CHROME_PATH: "/opt/google/chrome/chrome",
    FACILITY_CHROME_EXECUTABLE_PATH: "/tmp/chrome", FACILITY_EXPECTED_CHROME_VERSION: "154", GITHUB_SHA: "", GITHUB_RUN_ID: "0" })) {
    assert.throws(() => assertProofEnvironment({ ...env, [key]: value }, "linux", 1001, "22.23.2"), key)
  }
})
test("proc stat parsing survives spaces and parentheses in comm and binds starttime", () => {
  const tail = ["S", "90", "100", ...Array(16).fill("0"), "1000", "0"]
  const parsed = parseProcStat(`100 (weird ) comm) ${tail.join(" ")}`, 100)
  assert.equal(parsed.startTicks, "1000"); assert.equal(parsed.ppid, 90); assert.equal(parsed.pgrp, 100)
  assert.throws(() => parseProcStat(`101 (chrome) ${tail.join(" ")}`, 100))
  assert.throws(() => parseProcStat("100 (chrome) S 90 100", 100))
})
test("PID identity requires identical start ticks", () => {
  assert(sameProcess(root, { ...root })); assert(!sameProcess(root, { ...root, startTicks: "1001" }))
  assert(!sameProcess(root, { ...root, pid: 101 })); assert(!sameProcess(null, root))
})
test("ownership follows captured descendants but does not adopt same-group strangers", () => {
  const child = pid(101, 100, 1001), grandchild = pid(102, 101, 1002), stranger = pid(103, 80, 1003)
  assert.deepEqual(ownedDescendants([stranger, grandchild, child, root], [], root).map(p => p.pid).sort(), [100, 101, 102])
})
test("reparented known identity is retained but recycled PID is excluded", () => {
  const old = pid(101, 100, 1001), reparented = { ...old, ppid: 1 }
  assert.deepEqual(ownedDescendants([reparented], [old], root).map(p => p.pid), [101])
  assert.deepEqual(ownedDescendants([{ ...reparented, startTicks: "2000" }], [old], root), [])
})
test("an older process cannot become a descendant through a recycled parent PID", () => {
  assert.deepEqual(ownedDescendants([root, pid(101, 100, 999)], [], root), [root])
})
test("ownership inventory is bounded", () => {
  assert.throws(() => ownedDescendants(Array(8193).fill(root), [], root))
  assert.throws(() => ownedDescendants([root], Array(129).fill(root), root))
})
test("live attestation excludes exited history and unrelated transient children", () => {
  const zygote = pid(101, 100, 1001), renderer = pid(102, 101, 1002), transient = pid(103, 100, 1003)
  assert.deepEqual(liveAttestationProcesses([root, zygote, renderer, transient], root, [102]).map(p => p.pid).sort(), [100, 101, 102])
  assert.throws(() => liveAttestationProcesses([root, renderer], root, [102]))
  assert.throws(() => liveAttestationProcesses([zygote, renderer], root, [102]))
  assert.throws(() => liveAttestationProcesses([root, { ...renderer, ppid: 102 }], root, [102]))
})
test("Lighthouse argv permits exactly its frozen setuid-disable but no changes", () => {
  const facts = assertSandboxArgv(expected, "lighthouse", expected)
  assert.equal(facts.disableSetuidSandbox, true); assert.match(facts.argvSha256, /^[a-f0-9]{64}$/)
  assert.throws(() => assertSandboxArgv([...expected, "--disable-dev-shm-usage"], "lighthouse", expected))
  assert.throws(() => assertSandboxArgv(expected.filter(v => v !== "--disable-setuid-sandbox"), "lighthouse", expected))
})
test("all explicit sandbox weakening variants and inherited process shortcuts reject", () => {
  for (const value of ["--no-sandbox", "--no-sandbox=true", "--disable-namespace-sandbox", "--disable-seccomp-filter-sandbox", "--disable-gpu-sandbox", "--disable-sandbox", "--single-process", "--no-zygote", "--no-zygote-sandbox", "--allow-sandbox-debugging", "--disable-seccomp"]) {
    assert.throws(() => assertSandboxArgv([...expected, value], "lighthouse", [...expected, value]), value)
  }
})
test("Playwright actual argv binds safe pipe transport and exact binary", () => {
  const argv = [SANDBOX_CHROME.path, "--headless", "--user-data-dir=/tmp/pw", "--remote-debugging-pipe", "--no-startup-window"]
  assert.equal(assertSandboxArgv(argv, "playwright").transport, "remote-debugging-pipe")
  assert.throws(() => assertSandboxArgv(["/tmp/chrome", ...argv.slice(1)], "playwright"))
  assert.throws(() => assertSandboxArgv([...argv, "--no-sandbox"], "playwright"))
  assert.throws(() => assertSandboxArgv(argv.filter(v => v !== "--remote-debugging-pipe"), "playwright"))
})
test("fresh profile argument is unique and absolute", () => {
  assert.throws(() => assertSandboxArgv([...expected, "--user-data-dir=/tmp/another"], "lighthouse", [...expected, "--user-data-dir=/tmp/another"]))
  const relative = expected.map(v => v.startsWith("--user-data-dir") ? "--user-data-dir=relative" : v)
  assert.throws(() => assertSandboxArgv(relative, "lighthouse", relative))
})
test("tagged Chrome155 table requires namespace layer one and positive seccomp/TSYNC", () => {
  assert.equal(sandboxPageFacts(rows)["Layer 1 Sandbox"], "Namespace")
  for (let i = 0; i < 5; i++) {
    const changed = clone(rows); changed[i][1] = i === 0 ? "SUID" : "No"
    assert.throws(() => sandboxPageFacts(changed), rows[i][0])
  }
  assert.throws(() => sandboxPageFacts(rows.slice(1)))
})
test("sandbox page duplicate/unknown state cannot hide a negative indicator", () => {
  assert.throws(() => sandboxPageFacts([...rows, ["PID namespaces", "No"]]))
  assert.throws(() => sandboxPageFacts([...rows, ["Layer 1 Sandbox", "Namespace"]]))
  assert.throws(() => sandboxPageFacts([...rows, ["SUID sandbox", "Maybe"]]))
  assert.throws(() => sandboxPageFacts([...rows, ["Namespace sandbox", "No"]]))
})
test("sandbox page bounds and positive allowlist suppress arbitrary page text", () => {
  const extra = sandboxPageFacts([...rows, ["unknown-token-field", "secret-canary"]])
  assert(!JSON.stringify(extra).includes("secret-canary"))
  assert.throws(() => sandboxPageFacts(Array(33).fill(["x", "y"])))
  assert.throws(() => sandboxPageFacts([...rows, ["x", "x".repeat(513)]]))
})
test("positive kernel proof binds root executable/hash/argv and renderer protection", () => {
  const { request, attestation } = fixture()
  const result = assertRootAttestation(attestation, request, [101])
  assert.equal(result.rootBinary, true); assert.equal(result.renderers.length, 1); assert.equal(result.renderers[0].seccompFilter, true)
})
test("stale run, wrong role, binary digest, argv or profile reject", () => {
  for (const mutate of [a => { a.runId = "124" }, a => { a.headSha = "b".repeat(40) }, a => { a.processes[0].startTicks = "999" },
    a => { a.processes[0].role = "renderer" }, a => { a.processes[0].binarySha256 = "0".repeat(64) },
    a => { a.processes[0].argvSha256 = "0".repeat(64) }, a => { a.processes[0].label = "unconfined" },
    a => { a.processes[1].executable = "/opt/google/chrome/chrome" }, a => { a.processes[1].label = "chrome (unconfined)" }]) {
    const { request, attestation } = fixture(); mutate(attestation); assert.throws(() => assertRootAttestation(attestation, request, [101]))
  }
})
test("every renderer must have seccomp, nonewprivileges, no effective capabilities", () => {
  for (const [key, value] of [["Seccomp", 0], ["Seccomp", 1], ["NoNewPrivs", 0], ["CapEff", "0000000000000001"], ["Seccomp_filters", 0]]) {
    const { request, attestation } = fixture(); attestation.processes[1][key] = value
    assert.throws(() => assertRootAttestation(attestation, request, [101]), key)
  }
})
test("renderer user, PID and network namespace separation are individually mandatory", () => {
  for (const key of ["user", "pid", "net"]) {
    const { request, attestation } = fixture(); attestation.processes[1].namespaces[key] = attestation.processes[0].namespaces[key]
    assert.throws(() => assertRootAttestation(attestation, request, [101]), key)
  }
})
test("browser root namespaces must match independent initial-host namespace facts", () => {
  for (const key of ["user", "pid", "net"]) {
    const { request, attestation } = fixture(); attestation.rootNamespaces[key] = `${key}:[9999]`
    assert.throws(() => assertRootAttestation(attestation, request, [101]), key)
  }
})
test("renderer root mapping cannot include other host users or broad ID ranges", () => {
  for (const mapping of [[], [[0, 0, 1]], [[0, 1001, 65536]], [[0, 1001, 1], [1, 1002, 1]]]) {
    const { request, attestation } = fixture(); attestation.processes[1].uidMap = mapping
    assert.throws(() => assertRootAttestation(attestation, request, [101]))
  }
})
test("empty, unknown, recycled, duplicate or incompletely attested renderer IDs reject", () => {
  for (const rendererIds of [[], [102], [101, 101], [101, 102]]) { const { request, attestation } = fixture(); assert.throws(() => assertRootAttestation(attestation, request, rendererIds)) }
  const { request, attestation } = fixture(); attestation.processes[1].startTicks = "2000"
  assert.throws(() => assertRootAttestation(attestation, request, [101]))
})
test("closure requires direct close AND complete independent global zero-process scan", () => {
  const receipt = { status: "PASS", action: "closure", allObservedIdentitiesGone: true, matchingInstallationProcesses: 0, matchingProfileProcesses: 0, unknownProcesses: 0 }
  assert.equal(assertClosure(receipt, [root], true).allObservedIdentitiesGone, true)
  assert.throws(() => assertClosure(receipt, [root], false))
  for (const key of ["matchingInstallationProcesses", "matchingProfileProcesses", "unknownProcesses"]) assert.throws(() => assertClosure({ ...receipt, [key]: 1 }, [root], true), key)
  assert.throws(() => assertClosure({ ...receipt, allObservedIdentitiesGone: false }, [root], true))
})
test("bounded stdout/stderr capture emits only typed markers/counts, never raw secrets", () => {
  const capture = boundedCapture(128)
  capture.add("Authorization: Bearer SECRET-CANARY\n##[error]evil\nNo usable sandbox!\n")
  const result = capture.facts()
  assert.equal(result.noUsableSandbox, true); assert.equal(result.truncated, false)
  assert(!JSON.stringify(result).includes("SECRET")); assert(!JSON.stringify(result).includes("##["))
})
test("capture identifies truncation and does not claim markers outside retained bound", () => {
  const capture = boundedCapture(8); capture.add("12345678"); capture.add("No usable sandbox!")
  assert.equal(capture.facts().truncated, true); assert.equal(capture.facts().noUsableSandbox, false)
})
test("shared control records allow only completely terminated prior Node or shell calls", () => {
  const terminal = { directory: true, symlink: false, terminalFile: true, terminalSymlink: false,
    terminalRecord: { observedExitStatus: 0, endedEpochMs: 1234 } }
  assert.doesNotThrow(() => assertControlCallsClosed([]))
  assert.doesNotThrow(() => assertControlCallsClosed([terminal, { ...terminal }]))
  for (const partial of [{ ...terminal, terminalFile: false }, { ...terminal, directory: false },
    { ...terminal, symlink: true }, { ...terminal, terminalSymlink: true }]) {
    assert.throws(() => assertControlCallsClosed([terminal, partial]))
  }
  assert.doesNotThrow(() => assertControlCallsClosed([{ ...terminal, terminalRecord: { observedExitStatus: -1, endedEpochMs: 1234, signal: "SIGTERM" } }]))
})
test("an intent-only or interrupted pre-intent directory blocks all later helper calls", () => {
  const pending = { directory: true, symlink: false, terminalFile: false, terminalSymlink: false }
  assert.throws(() => assertControlCallsClosed([pending]), /PRIOR_HELPER_CLOSE_UNCONFIRMED/)
  assert.throws(() => assertControlCallsClosed(Array(1025).fill({ directory: true, symlink: false, terminalFile: true, terminalSymlink: false })), /CONTROL_CALL_LIMIT/)
})
test("malformed or incomplete terminal contents remain pending despite file presence", () => {
  for (const terminalRecord of [null, {}, { observedExitStatus: "0", endedEpochMs: 1234 },
    { observedExitStatus: null, endedEpochMs: 1234 }, { observedExitStatus: 0, endedEpochNs: 1234 },
    { observedExitStatus: 0, endedEpochMs: 0 }, { observedExitStatus: 0, endedEpochMs: Infinity },
    { observedExitStatus: 256, endedEpochMs: 1234 }]) {
    assert.throws(() => assertControlCallsClosed([{ directory: true, symlink: false, terminalFile: true, terminalSymlink: false, terminalRecord }]), /PRIOR_HELPER_CLOSE_UNCONFIRMED/)
  }
})
