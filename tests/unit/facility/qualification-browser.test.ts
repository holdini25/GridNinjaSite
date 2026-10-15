// @vitest-environment node
import { EventEmitter } from "node:events"
import type { ChildProcess } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { realpath, readdir, stat } from "node:fs/promises"
import { assertQualificationBrowserVersion, assertQualificationChromeArgv, launchQualifiedChrome, qualificationChromeFlags } from "../../../scripts/facility/qualification-browser.mjs"

vi.mock("node:fs/promises", () => ({ realpath: vi.fn(), readdir: vi.fn(), stat: vi.fn() }))
const env = { FACILITY_EXPECTED_CHROME_VERSION: "155.0.8059.79" }
const binary = "/qualification/chrome", profile = "/tmp/fresh-profile"
const common = [
  "--disable-features=TranslateUI", "--disable-extensions", "--disable-component-extensions-with-background-pages",
  "--disable-background-networking", "--disable-sync", "--metrics-recording-only", "--disable-default-apps",
  "--mute-audio", "--no-default-browser-check", "--no-first-run", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--disable-background-timer-throttling", "--force-fieldtrials=*BackgroundTracing/default/",
]
function fixture(platform = "linux", angle?: string) {
  const emitter = Object.assign(new EventEmitter(), { pid: 1234, spawnfile: binary, exitCode: null, signalCode: null,
    spawnargs: [binary, "--remote-debugging-port=0", `--user-data-dir=${profile}`,
      ...common, ...(platform === "linux" ? ["--disable-setuid-sandbox"] : []), "--headless",
      ...(angle ? ["--use-angle=metal", "--use-gl=angle"] : []), "about:blank"] })
  const chrome = { pid: 1234, port: 45678, process: emitter as unknown as ChildProcess, kill: vi.fn(() => { emitter.emit("close", 0, null) }) }
  return { emitter, chrome, launch: vi.fn(async () => chrome) }
}
const contract = { chromePath: binary, userDataDir: profile, platform: "linux", env }

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv("HEADLESS", "")
  vi.mocked(realpath).mockImplementation(async value => String(value))
  vi.mocked(readdir).mockResolvedValue([])
  vi.mocked(stat).mockImplementation(async value => ({ isFile: () => value === binary, isDirectory: () => value === profile }) as Awaited<ReturnType<typeof stat>>)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.clearAllMocks() })

describe("prespecified qualification Chrome contract", () => {
  it("preserves common flags and the Linux-only existing sandbox flag", () => {
    expect(qualificationChromeFlags({ platform: "linux", env })).toEqual([...common, "--disable-setuid-sandbox", "--headless"])
    expect(qualificationChromeFlags({ platform: "darwin", env })).toEqual([...common, "--headless"])
    expect(qualificationChromeFlags({ platform: "darwin", angle: "metal", env })).toEqual([...common, "--headless", "--use-angle=metal", "--use-gl=angle"])
  })
  it.each([
    { platform: "win32", env }, { platform: "linux", angle: "metal", env },
    { platform: "darwin", angle: "swiftshader", env }, { platform: "linux", env: { ...env, HEADLESS: "0" } },
    { platform: "linux", env: { ...env, FACILITY_CHROME_CHANNEL: "chrome" } },
  ])("rejects unsupported or implicit launch selection: %j", options => {
    expect(() => qualificationChromeFlags(options)).toThrow()
  })
  it.each(["155.0.8059.79", "Chrome/155.0.8059.79", "HeadlessChrome/155.0.8059.79"])("accepts the exact actual browser %s", version => {
    expect(assertQualificationBrowserVersion(version, env)).toBe("155.0.8059.79")
  })
  it("rejects absent/changed expected version and mismatched or missing actual version", () => {
    for (const version of ["155.0.8059.39", "154.0.0.0", "Chrome/155.0.8059.79 extra", undefined]) {
      expect(() => assertQualificationBrowserVersion(version, env)).toThrow()
    }
    expect(() => assertQualificationBrowserVersion("155.0.8059.79", {})).toThrow()
    expect(() => assertQualificationBrowserVersion("155.0.8059.79", { FACILITY_EXPECTED_CHROME_VERSION: "155.0.8059.39" })).toThrow()
  })
  it("checks and normalizes actual argv without ignoring dynamic arguments", () => {
    const { chrome } = fixture()
    expect(assertQualificationChromeArgv(chrome, contract)).toEqual([
      "--remote-debugging-port=0", "--user-data-dir=<fresh-profile>", ...common, "--disable-setuid-sandbox", "--headless", "about:blank",
    ])
    expect(() => assertQualificationChromeArgv(fixture("darwin", "metal").chrome, { ...contract, platform: "darwin", angle: "metal" })).not.toThrow()
  })
  it.each(["--no-sandbox", "--disable-features=RenderDocument", "--remote-debugging-port=1234", "--headless", "--user-data-dir=/tmp/other", "about:blank"])("rejects extra actual argument %s", extra => {
    const { chrome } = fixture()
    chrome.process.spawnargs.splice(1, 0, extra)
    expect(() => assertQualificationChromeArgv(chrome, contract)).toThrow()
  })
  it("rejects a different executable, process ID, unresolved port or missing baseline flag", () => {
    const wrongBinary = fixture(); wrongBinary.emitter.spawnfile = "/another/chrome"
    const wrongPid = fixture().chrome; wrongPid.pid = 2345
    const wrongPort = fixture().chrome; wrongPort.port = 0
    const missing = fixture().chrome; missing.process.spawnargs.splice(3, 1)
    for (const chrome of [wrongBinary.chrome, wrongPid, wrongPort, missing]) expect(() => assertQualificationChromeArgv(chrome, contract)).toThrow()
  })
})

describe("qualified launcher lifecycle without a real browser", () => {
  it("uses the supported explicit launch options and waits for close before cleanup can proceed", async () => {
    const { launch, chrome, emitter } = fixture()
    chrome.kill.mockImplementation(() => {})
    const result = await launchQualifiedChrome({ ...contract, launch })
    expect(launch).toHaveBeenCalledExactlyOnceWith({ ignoreDefaultFlags: true, chromePath: binary, userDataDir: profile,
      chromeFlags: [...common, "--disable-setuid-sandbox", "--headless"], startingUrl: "about:blank", port: 0 })
    let cleaned = false
    const first = result.kill()
    expect(result.kill()).toBe(first)
    const completion = first.then(() => { cleaned = true })
    await Promise.resolve()
    expect(cleaned).toBe(false)
    emitter.emit("close", 0, "SIGKILL")
    await completion
    expect(cleaned).toBe(true)
    expect(chrome.kill).toHaveBeenCalledTimes(1)
    expect(emitter.listenerCount("close")).toBe(0)
  })
  it("handles close during kill and close before kill", async () => {
    const first = fixture()
    await (await launchQualifiedChrome({ ...contract, launch: first.launch })).kill()
    const second = fixture()
    const result = await launchQualifiedChrome({ ...contract, launch: second.launch })
    second.emitter.emit("close", 0, null)
    await result.kill()
    expect(second.chrome.kill).not.toHaveBeenCalled()
  })
  it("rejects unknown shutdown after the bounded deadline without a second kill", async () => {
    vi.useFakeTimers()
    const { launch, chrome } = fixture(); chrome.kill.mockImplementation(() => {})
    const result = await launchQualifiedChrome({ ...contract, launch, shutdownTimeoutMs: 10 })
    const stopped = result.kill()
    const rejection = expect(stopped).rejects.toMatchObject({ qualificationShutdownUncertain: true })
    await vi.advanceTimersByTimeAsync(10)
    await rejection
    expect(result.kill()).toBe(stopped)
    expect(chrome.kill).toHaveBeenCalledTimes(1)
  })
  it("rejects kill and child errors instead of claiming successful shutdown", async () => {
    const first = fixture(); first.chrome.kill.mockImplementation(() => { throw new Error("kill refused") })
    await expect((await launchQualifiedChrome({ ...contract, launch: first.launch })).kill()).rejects.toMatchObject({ qualificationShutdownUncertain: true })
    const second = fixture(); second.chrome.kill.mockImplementation(() => { second.emitter.emit("error", new Error("process error")) })
    await expect((await launchQualifiedChrome({ ...contract, launch: second.launch })).kill()).rejects.toMatchObject({ qualificationShutdownUncertain: true })
  })
  it("kills a launched process when actual argv is rejected", async () => {
    const { launch, chrome } = fixture(); chrome.process.spawnargs.push("--no-sandbox")
    await expect(launchQualifiedChrome({ ...contract, launch })).rejects.toThrow("Actual Chrome arguments")
    expect(chrome.kill).toHaveBeenCalledTimes(1)
  })
  it("retains both contract and shutdown failures", async () => {
    const { launch, chrome } = fixture(); chrome.process.spawnargs.push("--no-sandbox")
    chrome.kill.mockImplementation(() => { throw new Error("kill refused") })
    const error = await launchQualifiedChrome({ ...contract, launch }).catch(error => error)
    expect(error).toBeInstanceOf(AggregateError)
    expect(error.qualificationShutdownUncertain).toBe(true)
    expect(error.errors).toHaveLength(2)
  })
  it("does not retry a launch rejection with unknown process ownership", async () => {
    const launch = vi.fn(async () => { throw new Error("launch rejected") })
    await expect(launchQualifiedChrome({ ...contract, launch })).rejects.toMatchObject({ qualificationShutdownUncertain: true })
    expect(launch).toHaveBeenCalledTimes(1)
  })
  it.each([false, true])("preserves pre-readiness diagnostics and observed close=%s without retry", async closed => {
    const diagnostics = { process: { closeObserved: closed }, error: { message: "original readiness error" } }
    const cause = Object.assign(new Error("launch rejected"), { qualificationLaunchDiagnostics: diagnostics })
    const launch = vi.fn(async () => { throw cause })
    const error = await launchQualifiedChrome({ ...contract, launch }).catch(error => error)
    expect(error.cause).toBe(cause)
    expect(error.qualificationLaunchDiagnostics).toBe(diagnostics)
    expect(error.qualificationShutdownUncertain).toBe(!closed)
    expect(launch).toHaveBeenCalledTimes(1)
  })
  it("checks canonical executable/profile paths and compatible explicit selectors", async () => {
    vi.mocked(realpath).mockImplementation(async value => value === "/alias/chrome" ? binary : value === "/alias/profile" ? profile : String(value))
    const { launch } = fixture()
    const result = await launchQualifiedChrome({ ...contract, chromePath: "/alias/chrome", userDataDir: "/alias/profile", env: { ...env, CHROME_PATH: "/alias/chrome" }, launch })
    expect(result.qualificationLaunch.chromePath).toBe(binary)
    await result.kill()
  })
  it("rejects reused profiles, conflicting selectors and ambient headless mode before launch", async () => {
    const { launch } = fixture()
    vi.mocked(readdir).mockResolvedValue(["Default"] as unknown as Awaited<ReturnType<typeof readdir>>)
    await expect(launchQualifiedChrome({ ...contract, launch })).rejects.toThrow("fresh empty profile")
    vi.mocked(readdir).mockResolvedValue([])
    await expect(launchQualifiedChrome({ ...contract, env: { ...env, CHROME_PATH: "/another/chrome" }, launch })).rejects.toThrow("conflicts")
    await expect(launchQualifiedChrome({ ...contract, env: { ...env, FACILITY_CHROME_EXECUTABLE_PATH: "/another/chrome" }, launch })).rejects.toThrow("conflicts")
    vi.stubEnv("HEADLESS", "1")
    await expect(launchQualifiedChrome({ ...contract, launch })).rejects.toThrow("Ambient HEADLESS")
    expect(launch).not.toHaveBeenCalled()
  })
})
