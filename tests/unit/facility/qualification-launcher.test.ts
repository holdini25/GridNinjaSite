// @vitest-environment node
import { EventEmitter } from "node:events"
import type { ChildProcess } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createQualificationLauncher } from "../../../scripts/facility/qualification-launcher.mjs"

let profile: string
beforeEach(async () => { profile = await mkdtemp(join(tmpdir(), "launcher-fixture-")) })
afterEach(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await rm(profile, { recursive: true, force: true }) })
function fixture(mode = "ready") {
  const child = Object.assign(new EventEmitter(), { pid: 1234, spawnfile: "/pinned/chrome", spawnargs: ["/pinned/chrome", "--headless", "about:blank"] }) as unknown as ChildProcess
  const spawn = vi.fn(() => child)
  const signals = Object.assign(new EventEmitter(), { exit: vi.fn() })
  const options = { chromePath: "/pinned/chrome", userDataDir: profile, port: 0, chromeFlags: ["--headless"], startingUrl: "about:blank", ignoreDefaultFlags: true }
  const cause = new Error("debugging port was not published", { cause: new Error("original reason") })
  const kill = vi.fn(() => {
    if (mode === "kill-throws") throw new Error("kill refused")
    if (mode !== "exit-only") child.emit("close", null, "SIGKILL")
    else child.emit("exit", null, "SIGKILL")
  })
  let suppliedOptions: unknown
  let currentChildReference: () => ChildProcess | undefined = () => undefined
  class Launcher {
    pid?: number
    port = 4321
    chromeProcess?: ChildProcess
    remoteDebuggingPipes = null
    constructor(opts: unknown, private overrides: { spawn: typeof spawn }) { suppliedOptions = opts; currentChildReference = () => this.chromeProcess }
    async launch() {
      if (mode === "before-spawn") throw cause
      this.chromeProcess = this.overrides.spawn()
      if (mode === "unknown-child") this.chromeProcess = Object.assign(new EventEmitter(), { pid: 5678 }) as unknown as ChildProcess
      child.emit("spawn")
      if (mode === "two-spawns") this.overrides.spawn()
      if (mode === "child-error") child.emit("error", new Error("spawn error"))
      if (mode === "early-close") { child.emit("exit", 1, null); child.emit("close", 1, null) }
      if (mode === "exit-before-rejection") child.emit("exit", 1, null)
      if (mode === "sigint-rejection") signals.emit("SIGINT")
      if (mode !== "ready") throw cause
      this.pid = child.pid
    }
    kill = () => {
      if (mode === "cleared-on-close") child.once("close", () => { delete this.chromeProcess })
      kill()
    }
  }
  const launch = createQualificationLauncher(Launcher, { spawn: spawn as unknown as typeof import("node:child_process").spawn, signalSource: signals, shutdownTimeoutMs: 10 })
  return { launch: () => launch(options), child, spawn, signals, cause, kill, options, suppliedOptions: () => suppliedOptions,
    currentChildReference: () => currentChildReference() }
}

describe("pre-resolution launcher observation", () => {
  it("preserves options and observes the actual child before readiness resolves", async () => {
    const f = fixture(); const result = await f.launch()
    expect(f.suppliedOptions()).toBe(f.options)
    expect(result.process).toBe(f.child)
    expect(result.qualificationProcess).toMatchObject({ pid: 1234, spawnObserved: true, closeObserved: false })
    result.kill()
    expect(result.qualificationProcess.closeObserved).toBe(true)
    expect(f.signals.listenerCount("SIGINT")).toBe(0)
  })
  it("retains the original cause and early exit/close without signaling a dead PID", async () => {
    const f = fixture("early-close")
    const error = await f.launch().catch(error => error)
    expect(error.cause).toBe(f.cause)
    expect(error.qualificationLaunchDiagnostics).toMatchObject({ phase: "launch-rejected", ownership: "captured-child", process: { pid: 1234, closeObserved: true, close: { code: 1, signal: null }, killRequested: false } })
    expect(error.qualificationLaunchDiagnostics.error.cause.message).toContain("original reason")
    expect(f.kill).not.toHaveBeenCalled()
    expect(error.qualificationShutdownUncertain).toBe(false)
  })
  it("records requested kill separately and waits for its observed close", async () => {
    const f = fixture("rejected")
    const error = await f.launch().catch(error => error)
    expect(f.kill).toHaveBeenCalledTimes(1)
    expect(error.qualificationLaunchDiagnostics.process).toMatchObject({ killRequested: true, closeObserved: true })
    expect(f.spawn).toHaveBeenCalledTimes(1)
  })
  it("does not turn exit or a void kill into close evidence", async () => {
    vi.useFakeTimers(); const f = fixture("exit-only")
    const pending = f.launch().catch(error => error)
    await vi.advanceTimersByTimeAsync(10)
    const error = await pending
    expect(error.qualificationShutdownUncertain).toBe(true)
    expect(error.qualificationLaunchDiagnostics.process).toMatchObject({ killRequested: true, closeObserved: false, exit: { signal: "SIGKILL" } })
    expect(error.qualificationLaunchDiagnostics.shutdownError.message).toContain("not confirmed")
    expect(f.kill).toHaveBeenCalledTimes(1)
    f.child.emit("close", null, "SIGKILL")
  })
  it.each(["before-spawn", "unknown-child"])("never kills or retries unknown ownership: %s", async mode => {
    const f = fixture(mode); const error = await f.launch().catch(error => error)
    expect(error.qualificationLaunchDiagnostics.ownership).toBe("unknown")
    expect(error.qualificationShutdownUncertain).toBe(true)
    expect(f.kill).not.toHaveBeenCalled()
    expect(f.spawn.mock.calls.length).toBeLessThanOrEqual(1)
    f.child.emit("close", null, "SIGKILL")
  })
  it("retains primary launch and secondary kill errors", async () => {
    const f = fixture("kill-throws"); const error = await f.launch().catch(error => error)
    expect(error.cause).toBe(f.cause)
    expect(error.qualificationLaunchDiagnostics.shutdownError.cause.message).toContain("kill refused")
    expect(error.qualificationShutdownUncertain).toBe(true)
    f.child.emit("close", null, "SIGKILL")
  })
  it("retains child errors and rejects a second spawn before creating another process", async () => {
    for (const mode of ["child-error", "two-spawns"]) {
      const f = fixture(mode); const error = await f.launch().catch(error => error)
      expect(f.spawn).toHaveBeenCalledTimes(1)
      if (mode === "child-error") expect(error.qualificationLaunchDiagnostics.process.error.message).toContain("spawn error")
      else expect(error.qualificationLaunchDiagnostics.error.message).toContain("only one")
    }
  })
  it("retains bounded startup logs and never deletes the failed profile", async () => {
    await writeFile(join(profile, "chrome-err.log"), "startup failed\n")
    const f = fixture("early-close"); const error = await f.launch().catch(error => error)
    expect(JSON.stringify(error.qualificationLaunchDiagnostics.logs)).toContain("startup failed")
    await expect(writeFile(join(profile, "retained-proof"), "retained")).resolves.toBeUndefined()
  })
  it("scopes SIGINT to the captured instance and observes close before exit", async () => {
    const f = fixture(); await f.launch()
    f.signals.emit("SIGINT")
    await vi.waitFor(() => expect(f.signals.exit).toHaveBeenCalledWith(130))
    expect(f.kill).toHaveBeenCalledTimes(1)
  })
  it("shares one shutdown when SIGINT races launch rejection and requires close", async () => {
    const f = fixture("sigint-rejection")
    f.kill.mockImplementation(() => {})
    let settled = false
    const pending = f.launch().catch(error => { settled = true; return error })
    await Promise.resolve(); await Promise.resolve()
    expect(f.kill).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)
    expect(f.signals.exit).not.toHaveBeenCalled()
    f.child.emit("exit", null, "SIGKILL")
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(f.signals.exit).not.toHaveBeenCalled()
    f.child.emit("close", null, "SIGKILL")
    const error = await pending
    expect(error.cause).toBe(f.cause)
    expect(error.qualificationShutdownUncertain).toBe(false)
    expect(error.qualificationLaunchDiagnostics.process).toMatchObject({ killRequested: true, closeObserved: true })
    expect(f.kill).toHaveBeenCalledTimes(1)
    expect(f.signals.exit).toHaveBeenCalledExactlyOnceWith(130)
    expect(f.signals.listenerCount("SIGINT")).toBe(0)
  })
  it("does not signal an exited child and keeps shutdown uncertain until close", async () => {
    vi.useFakeTimers()
    const f = fixture("exit-before-rejection")
    const pending = f.launch().catch(error => error)
    await vi.advanceTimersByTimeAsync(10)
    const error = await pending
    expect(f.kill).not.toHaveBeenCalled()
    expect(error.qualificationShutdownUncertain).toBe(true)
    expect(error.qualificationLaunchDiagnostics).toMatchObject({ ownership: "captured-child", process: {
      killRequested: false, closeObserved: false, exit: { code: 1, signal: null },
    } })
    expect(error.qualificationLaunchDiagnostics.shutdownError.message).toContain("not confirmed")
    f.child.emit("close", 1, null)
  })
  it("retains captured ownership after the launcher clears its child on close", async () => {
    const f = fixture("cleared-on-close")
    const error = await f.launch().catch(error => error)
    expect(f.currentChildReference()).toBeUndefined()
    expect(f.kill).toHaveBeenCalledTimes(1)
    expect(error.qualificationLaunchDiagnostics).toMatchObject({ ownership: "captured-child", process: {
      pid: 1234, spawnObserved: true, killRequested: true, closeObserved: true,
    } })
    expect(error.qualificationShutdownUncertain).toBe(false)
  })
  it("bounds and redacts the observed executable and each argument", async () => {
    const secret = "known-argv-secret", f = fixture("early-close")
    vi.stubEnv("QUALIFICATION_DIAGNOSTICS_TEST_TOKEN", secret)
    Object.defineProperty(f.child, "spawnfile", { value: `https://name:unknown-password@example.test/${"🧪".repeat(1000)}?token=${secret}` })
    f.child.spawnargs.splice(0, f.child.spawnargs.length, f.child.spawnfile, `--user-data-dir=${profile}`, `--api-key=${secret}`,
      "https://user:password@example.test/path?value=unknown-query#unknown-fragment",
      ...Array.from({ length: 66 }, () => `${secret} ${"🧪".repeat(1000)}`))
    const error = await f.launch().catch(error => error), evidence = error.qualificationLaunchDiagnostics.process
    expect(evidence).toMatchObject({ executableTruncated: true, argvTruncated: true })
    expect(evidence.argv).toHaveLength(64)
    expect(evidence.truncatedArgIndices).toContain(0)
    expect(evidence.truncatedArgIndices).toContain(4)
    expect(Buffer.byteLength(evidence.executable)).toBeLessThanOrEqual(2048)
    for (const arg of evidence.argv) expect(Buffer.byteLength(arg)).toBeLessThanOrEqual(2048)
    const text = JSON.stringify(evidence)
    for (const value of [secret, profile, "unknown-password", "user:password", "unknown-query", "unknown-fragment", "�"]) expect(text).not.toContain(value)
    expect(evidence.argv[1]).toBe("--user-data-dir=<fresh-profile>")
  })
})
