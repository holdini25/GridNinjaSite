import assert from "node:assert/strict"
import { spawn as nodeSpawn } from "node:child_process"
import { homedir } from "node:os"
import { observedShutdown } from "./qualification-browser.mjs"
import { boundedLaunchText, readLaunchLogs, serializeLaunchError } from "./qualification-launch-diagnostics.mjs"

// Launcher and ModuleOverrides.spawn are public in pinned chrome-launcher 1.2.2.
// Observe the actual child before its asynchronous readiness promise can reject.
/** @param {Function} Launcher
 * @param {{spawn?: typeof nodeSpawn, signalSource?: import('node:events').EventEmitter & {exit: (code: number) => void}, shutdownTimeoutMs?: number}} dependencies
 */
export function createQualificationLauncher(Launcher, { spawn = nodeSpawn, signalSource = process, shutdownTimeoutMs = 10_000 } = {}) {
  assert(Number.isInteger(shutdownTimeoutMs) && shutdownTimeoutMs > 0 && shutdownTimeoutMs <= 60_000)
  return async options => {
    const context = { paths: { binary: options.chromePath, profile: options.userDataDir, workspace: process.cwd(), home: homedir() } }
    const receipt = { schemaVersion: "gridninja-launch-diagnostics.v1", phase: "launching", process: {
      spawnCalls: 0, childReturned: false, spawnObserved: false, closeObserved: false,
      killRequested: false, pid: null, executable: null, argv: [], error: null, exit: null, close: null,
    } }
    let child, instance, shutdown, signalHandler, capturedOwnership = false
    const detachSignal = () => { if (signalHandler) signalSource.off("SIGINT", signalHandler) }
    const liveReference = () => child && instance?.chromeProcess === child && Number.isInteger(child.pid) && child.pid > 0
    const owned = () => {
      if (liveReference()) capturedOwnership = true
      return capturedOwnership
    }
    const kill = () => {
      // Never signal an exited PID, or issue a second request from a racing path.
      // An exit still requires a separately observed close before cleanup passes.
      if (receipt.process.exit || receipt.process.closeObserved || receipt.process.killRequested) return
      assert(owned() && liveReference(), "Cannot signal a Chrome process without its captured ownership")
      receipt.process.killRequested = true
      instance.kill()
    }
    const stop = () => {
      if (!shutdown) {
        assert(owned(), "Cannot confirm shutdown without a captured Chrome child")
        shutdown = observedShutdown({ process: child, kill, qualificationProcess: receipt.process }, shutdownTimeoutMs)()
      }
      return shutdown
    }
    try {
      instance = new Launcher(options, { spawn: (...args) => {
        assert.equal(receipt.process.spawnCalls++, 0, "A launcher may spawn only one qualification child")
        child = spawn(...args)
        receipt.process.childReturned = true
        receipt.process.pid = Number.isInteger(child.pid) ? child.pid : null
        const executable = boundedLaunchText(child.spawnfile, 2048, context)
        receipt.process.executable = executable.value
        receipt.process.executableTruncated = executable.truncated
        const argv = (child.spawnargs ?? []).slice(0, 64).map(arg => boundedLaunchText(arg, 2048, context))
        receipt.process.argv = argv.map(arg => arg.value)
        receipt.process.truncatedArgIndices = argv.flatMap((arg, index) => arg.truncated ? [index] : [])
        receipt.process.argvTruncated = (child.spawnargs?.length ?? 0) > 64
        const onSpawn = () => { receipt.process.spawnObserved = true; owned() }
        const onError = error => { receipt.process.error ??= serializeLaunchError(error, context) }
        const onExit = (code, signal) => { receipt.process.exit = { code, signal } }
        const onClose = (code, signal) => {
          owned()
          receipt.process.closeObserved = true
          receipt.process.close = { code, signal, observedAt: new Date().toISOString() }
          child.off("spawn", onSpawn); child.off("error", onError); child.off("exit", onExit); child.off("close", onClose)
          detachSignal()
        }
        child.on("spawn", onSpawn); child.on("error", onError); child.on("exit", onExit); child.on("close", onClose)
        return child
      } })
      // Scope interruption to this owned instance; never use global killAll().
      signalHandler = () => {
        const pending = owned() ? stop() : Promise.reject(new Error("Interrupted before process ownership was established"))
        void pending.catch(() => {}).finally(() => { detachSignal(); signalSource.exit(130) })
      }
      signalSource.once("SIGINT", signalHandler)
      await instance.launch()
      assert(owned() && liveReference(), "Launcher resolved without its captured Chrome child")
      assert(!receipt.process.error && !receipt.process.exit && !receipt.process.closeObserved, "Chrome terminated before launcher readiness resolved")
      receipt.phase = "ready"
      return { pid: instance.pid, port: instance.port, process: child, remoteDebuggingPipes: instance.remoteDebuggingPipes,
        kill, qualificationProcess: receipt.process }
    } catch (error) {
      receipt.phase = "launch-rejected"
      receipt.error = serializeLaunchError(error, context)
      receipt.ownership = owned() ? "captured-child" : "unknown"
      // No guessed PID, killAll(), retry or profile deletion on failure.
      // A kill request is recorded separately from the observed close event.
      if (owned() && !receipt.process.closeObserved) {
        try { await stop() }
        catch (shutdownError) { receipt.shutdownError = serializeLaunchError(shutdownError, context) }
      }
      try { receipt.logs = await readLaunchLogs(options.userDataDir, context) }
      catch (logError) { receipt.logReadError = serializeLaunchError(logError, context) }
      detachSignal()
      const failure = new Error("Chrome launcher rejected before readiness", { cause: error })
      throw Object.assign(failure, { qualificationLaunchDiagnostics: receipt, qualificationShutdownUncertain: !receipt.process.closeObserved })
    }
  }
}
