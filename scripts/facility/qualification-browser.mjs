import assert from "node:assert/strict"
import { realpath, readdir, stat } from "node:fs/promises"
import { isAbsolute } from "node:path"

export const QUALIFICATION_CHROME_VERSION = "155.0.8059.79"

// chrome-launcher 0.13.4's common defaults, observed unchanged in all twelve
// Linux diagnostic captures. Linux's additional flag is platform-specific.
const BASELINE_FLAGS = Object.freeze([
  "--disable-features=TranslateUI",
  "--disable-extensions",
  "--disable-component-extensions-with-background-pages",
  "--disable-background-networking",
  "--disable-sync",
  "--metrics-recording-only",
  "--disable-default-apps",
  "--mute-audio",
  "--no-default-browser-check",
  "--no-first-run",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling",
  "--force-fieldtrials=*BackgroundTracing/default/",
])

/** @typedef {{platform?: string, angle?: string, env?: Record<string, string|undefined>}} FlagOptions */
/** @param {FlagOptions} options */
export function qualificationChromeFlags({ platform = process.platform, angle, env = process.env } = {}) {
  assert(platform === "linux" || platform === "darwin", "Qualification Chrome supports only Linux and macOS")
  assert(!angle || angle === "metal", "Qualification Chrome supports only the Metal override")
  assert(!angle || platform === "darwin", "Metal qualification requires macOS")
  assert(!env.HEADLESS, "HEADLESS must be absent; headless mode is explicitly pinned")
  assert(!env.FACILITY_CHROME_CHANNEL, "A Chrome channel cannot override the pinned qualification executable")
  return [...BASELINE_FLAGS, ...(platform === "linux" ? ["--disable-setuid-sandbox"] : []),
    "--headless", ...(angle ? ["--use-angle=metal", "--use-gl=angle"] : [])]
}

/** @param {unknown} version @param {Record<string, string|undefined>} env */
export function assertQualificationBrowserVersion(version, env = process.env) {
  assert.equal(env.FACILITY_EXPECTED_CHROME_VERSION, QUALIFICATION_CHROME_VERSION,
    "Qualification requires the prespecified FACILITY_EXPECTED_CHROME_VERSION")
  assert.equal(typeof version, "string", "Missing actual qualification browser version")
  const actual = String(version).replace(/^(?:Headless)?Chrome\//, "")
  assert.equal(actual, QUALIFICATION_CHROME_VERSION, "Actual Chrome differs from the prespecified browser")
  return actual
}

/** @typedef {{pid: number, port: number, process: import('node:child_process').ChildProcess, kill: () => void, qualificationProcess?: {closeObserved: boolean}}} LaunchedChrome */
/** @typedef {FlagOptions & {chromePath: string, userDataDir: string}} ArgvContract */
/** Check the actual spawned argv, not merely the options supplied to launch.
 * Paths must already be canonical. Dynamic fields are checked exactly once.
 * @param {LaunchedChrome} chrome @param {ArgvContract} contract
 */
export function assertQualificationChromeArgv(chrome, { chromePath, userDataDir, ...options }) {
  assert(isAbsolute(chromePath) && isAbsolute(userDataDir), "Qualification paths must be absolute")
  assert(chrome?.process && Number.isInteger(chrome.pid) && chrome.pid > 0, "Missing spawned Chrome process")
  assert.equal(chrome.process.pid, chrome.pid, "Chrome process identity differs from launcher")
  assert(Number.isInteger(chrome.port) && chrome.port > 0 && chrome.port <= 65535, "Missing discovered Chrome debugging port")
  assert.equal(chrome.process.spawnfile, chromePath, "Launcher executed a different browser binary")
  const argv = chrome.process.spawnargs
  assert(Array.isArray(argv) && argv.every(arg => typeof arg === "string"), "Missing actual Chrome arguments")
  const expected = [chromePath, "--remote-debugging-port=0", `--user-data-dir=${userDataDir}`,
    ...qualificationChromeFlags(options), "about:blank"]
  assert.deepEqual(argv, expected, "Actual Chrome arguments differ from the platform qualification contract")
  return argv.slice(1).map(arg => arg === `--user-data-dir=${userDataDir}` ? "--user-data-dir=<fresh-profile>" : arg)
}

function shutdownError(message, cause, closed) {
  const error = new Error(message, cause ? { cause } : undefined)
  return Object.assign(error, { qualificationShutdownUncertain: !closed })
}

/** launcher 1.2.2 kill() returns void. Observe close before deleting a profile
 * or starting another capture. Repeated callers share the same terminal result.
 * @param {LaunchedChrome} chrome @param {number} timeoutMs
 */
export function observedShutdown(chrome, timeoutMs) {
  const child = chrome?.process
  assert(child && typeof child.on === "function" && typeof child.off === "function", "Missing observable Chrome child process")
  let closed = chrome.qualificationProcess?.closeObserved === true, childError
  let notify = () => {}
  const onClose = () => { closed = true; notify() }
  const onError = error => { childError = error; notify() }
  child.on("close", onClose)
  child.on("error", onError)
  let shutdown
  return () => {
    if (shutdown) return shutdown
    shutdown = new Promise((resolve, reject) => {
      let timer, settled = false
      const finish = error => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        child.off("close", onClose)
        child.off("error", onError)
        notify = () => {}
        if (error) reject(error)
        else resolve()
      }
      notify = () => {
        if (childError) finish(shutdownError("Chrome child error; qualification must stop", childError, closed))
        else if (closed) finish()
      }
      if (closed) return notify()
      timer = setTimeout(() => finish(shutdownError("Chrome shutdown was not confirmed before the deadline", undefined, closed)), timeoutMs)
      try { chrome.kill() }
      catch (error) { return finish(shutdownError("Chrome kill failed; qualification must stop", error, closed)) }
      notify()
    })
    return shutdown
  }
}

/**
 * @typedef {{ignoreDefaultFlags: true, chromePath: string, userDataDir: string, chromeFlags: string[], startingUrl: string, port: number}} LaunchOptions
 * @param {ArgvContract & {launch: (options: LaunchOptions) => Promise<LaunchedChrome>, shutdownTimeoutMs?: number}} options
 */
export async function launchQualifiedChrome({ launch, chromePath, userDataDir, angle,
  platform = process.platform, env = process.env, shutdownTimeoutMs = 10_000 }) {
  assert.equal(typeof launch, "function", "An explicitly resolved launcher is required")
  assert.equal(env.FACILITY_EXPECTED_CHROME_VERSION, QUALIFICATION_CHROME_VERSION,
    "Qualification requires the prespecified FACILITY_EXPECTED_CHROME_VERSION")
  const chromeFlags = qualificationChromeFlags({ platform, angle, env })
  // The launcher reads HEADLESS from process.env directly, even with envVars.
  assert(!process.env.HEADLESS, "Ambient HEADLESS cannot override qualification")
  assert(Number.isInteger(shutdownTimeoutMs) && shutdownTimeoutMs > 0 && shutdownTimeoutMs <= 60_000, "Invalid shutdown deadline")
  assert(typeof chromePath === "string" && isAbsolute(chromePath), "Supply an explicit absolute Chrome executable")
  assert(typeof userDataDir === "string" && isAbsolute(userDataDir), "Supply an explicit fresh Chrome profile")
  const [binary, profile] = await Promise.all([realpath(chromePath), realpath(userDataDir)])
  const [binaryStat, profileStat, profileFiles] = await Promise.all([stat(binary), stat(profile), readdir(profile)])
  assert(binaryStat.isFile(), "Pinned Chrome executable must be a file")
  assert(profileStat.isDirectory() && profileFiles.length === 0, "Qualification requires a fresh empty profile directory")
  for (const key of ["CHROME_PATH", "FACILITY_CHROME_PATH", "FACILITY_CHROME_EXECUTABLE_PATH", "PUPPETEER_EXECUTABLE_PATH", "LIGHTHOUSE_CHROMIUM_PATH"]) {
    if (!env[key]) continue
    assert(isAbsolute(env[key]), `${key} must identify the explicit pinned executable`)
    assert.equal(await realpath(env[key]), binary, `${key} conflicts with the explicit pinned executable`)
  }
  let chrome
  try {
    chrome = await launch({ ignoreDefaultFlags: true, chromePath: binary, userDataDir: profile,
      chromeFlags, startingUrl: "about:blank", port: 0 })
  } catch (error) {
    // The adapter supplies pre-readiness observation when available. Preserve its
    // evidence and never treat a rejected launch alone as confirmed shutdown.
    const failure = shutdownError("Chrome launch rejected before readiness", error, error?.qualificationLaunchDiagnostics?.process?.closeObserved === true)
    throw Object.assign(failure, { qualificationLaunchDiagnostics: error?.qualificationLaunchDiagnostics })
  }
  let kill
  try { kill = observedShutdown(chrome, shutdownTimeoutMs) }
  catch (error) {
    try { chrome?.kill() } catch { /* Shutdown remains unconfirmed. */ }
    throw shutdownError("Cannot observe launched Chrome shutdown", error, false)
  }
  try {
    const effectiveArgs = assertQualificationChromeArgv(chrome, { chromePath: binary, userDataDir: profile, platform, angle, env })
    return { ...chrome, kill, qualificationLaunch: { platform, chromePath: binary, effectiveArgs, ...(chrome.qualificationProcess ? { process: chrome.qualificationProcess } : {}) } }
  } catch (error) {
    try { await kill() }
    catch (shutdownFailure) {
      throw Object.assign(new AggregateError([error, shutdownFailure], "Chrome launch contract failed and shutdown is unconfirmed", { cause: shutdownFailure }),
        { qualificationShutdownUncertain: true })
    }
    throw error
  }
}
