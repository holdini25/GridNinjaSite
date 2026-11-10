// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  parseArgs: vi.fn(), measurementEnvironment: vi.fn(), verifiedBuildIdentity: vi.fn(),
  chromiumLaunch: vi.fn(), chromeLaunch: vi.fn(), fetch: vi.fn(), acquireComputeLock: vi.fn(),
}))
vi.mock("node:util", async importOriginal => ({ ...await importOriginal<typeof import("node:util")>(), parseArgs: mocks.parseArgs }))
vi.mock("../../../scripts/facility/performance-contract.mjs", async importOriginal => ({
  ...await importOriginal<typeof import("../../../scripts/facility/performance-contract.mjs")>(),
  measurementEnvironment: mocks.measurementEnvironment,
  verifiedBuildIdentity: mocks.verifiedBuildIdentity,
}))
vi.mock("../../../scripts/facility/compute-lock.mjs", () => ({ acquireComputeLock: mocks.acquireComputeLock }))
vi.mock("@playwright/test", () => ({ chromium: { launch: mocks.chromiumLaunch }, devices: {} }))
vi.mock("chrome-launcher", () => ({ launch: mocks.chromeLaunch }))
vi.mock("lighthouse", () => ({ default: vi.fn(), desktopConfig: {} }))

const values = (baseURL: string) => ({ values: { "base-url": baseURL, out: "build/civic/test-unused", phase: "transfer", release: "civic-v2" } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.stubEnv("FACILITY_BASE_URL", undefined)
  vi.stubGlobal("fetch", mocks.fetch)
  mocks.parseArgs.mockReturnValue(values("http://127.0.0.1:3000"))
  mocks.measurementEnvironment.mockImplementation(async () => ({ name: "local", measurementOrigin: process.env.FACILITY_BASE_URL }))
  mocks.verifiedBuildIdentity.mockRejectedValue(new Error("Test stops before build reads"))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

function expectNoCapture() {
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(mocks.acquireComputeLock).not.toHaveBeenCalled()
  expect(mocks.chromiumLaunch).not.toHaveBeenCalled()
  expect(mocks.chromeLaunch).not.toHaveBeenCalled()
}

describe("civic regression collector local qualification", () => {
  it("rejects a remote URL before identity reads, network, or browsers", async () => {
    mocks.parseArgs.mockReturnValue(values("https://gridninja.ai"))
    await expect(import("../../../scripts/civic/measure.mjs")).rejects.toThrow("Remote collection requires actual hosted build attestation")
    expect(mocks.measurementEnvironment).not.toHaveBeenCalled()
    expect(mocks.verifiedBuildIdentity).not.toHaveBeenCalled()
    expectNoCapture()
  })

  it("rejects conflicting local origins before identity reads", async () => {
    vi.stubEnv("FACILITY_BASE_URL", "http://localhost:3000")
    await expect(import("../../../scripts/civic/measure.mjs")).rejects.toThrow("Civic base URL differs from FACILITY_BASE_URL")
    expect(mocks.measurementEnvironment).not.toHaveBeenCalled()
    expect(mocks.verifiedBuildIdentity).not.toHaveBeenCalled()
    expectNoCapture()
  })

  it("rejects URL credentials before reducing the URL to its recorded origin", async () => {
    mocks.parseArgs.mockReturnValue(values("http://user:password@127.0.0.1:3000"))
    await expect(import("../../../scripts/civic/measure.mjs")).rejects.toThrow("homepage origin without credentials")
    expect(mocks.measurementEnvironment).not.toHaveBeenCalled()
    expect(mocks.verifiedBuildIdentity).not.toHaveBeenCalled()
    expectNoCapture()
  })

  it.each([undefined, "http://127.0.0.1:3000"])("binds the actual local origin before validation with prior setting %s", async previousOrigin => {
    vi.stubEnv("FACILITY_BASE_URL", previousOrigin)
    await expect(import("../../../scripts/civic/measure.mjs")).rejects.toThrow("Test stops before build reads")
    expect(process.env.FACILITY_BASE_URL).toBe("http://127.0.0.1:3000")
    expect(mocks.measurementEnvironment).toHaveBeenCalledOnce()
    expect(await mocks.measurementEnvironment.mock.results[0].value).toEqual({ name: "local", measurementOrigin: "http://127.0.0.1:3000" })
    expectNoCapture()
  })

  it("rejects hosted qualification even when the requested URL is local", async () => {
    mocks.measurementEnvironment.mockResolvedValueOnce({ name: "protected-staging", measurementOrigin: "https://candidate.vercel.app" })
    await expect(import("../../../scripts/civic/measure.mjs")).rejects.toThrow("Civic regression collection supports local qualification only")
    expect(mocks.verifiedBuildIdentity).not.toHaveBeenCalled()
    expectNoCapture()
  })
})
