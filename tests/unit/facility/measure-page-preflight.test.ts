// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  measurementEnvironment: vi.fn(), provenance: vi.fn(), verifyMeasurementServing: vi.fn(), assertMeasurementServingPair: vi.fn(),
  launch: vi.fn(), rm: vi.fn(), mkdir: vi.fn(), writeFile: vi.fn(), release: vi.fn(),
}))

vi.mock("../../../scripts/facility/performance-contract.mjs", async importOriginal => ({
  ...await importOriginal<typeof import("../../../scripts/facility/performance-contract.mjs")>(),
  measurementEnvironment: mocks.measurementEnvironment,
  provenance: mocks.provenance,
  verifyMeasurementServing: mocks.verifyMeasurementServing,
  assertMeasurementServingPair: mocks.assertMeasurementServingPair,
  isProtectedMeasurement: () => false,
}))
vi.mock("node:fs/promises", async importOriginal => ({ ...await importOriginal<typeof import("node:fs/promises")>(), rm: mocks.rm, mkdir: mocks.mkdir, writeFile: mocks.writeFile }))
vi.mock("@playwright/test", () => ({ chromium: { launch: mocks.launch }, devices: { "Pixel 5": {} } }))
vi.mock("../../../scripts/facility/compute-lock.mjs", () => ({ acquireComputeLock: async () => mocks.release }))

let previousExitCode: typeof process.exitCode
beforeEach(() => {
  previousExitCode = process.exitCode
  vi.clearAllMocks()
  vi.resetModules()
  vi.stubEnv("FACILITY_RUNS", "1")
  vi.stubEnv("FACILITY_MEASUREMENT_SCOPE", "ci-functional")
  vi.stubEnv("FACILITY_PERFORMANCE_MATRIX", "core")
  mocks.launch.mockRejectedValue(new Error("Test browser boundary: no browser launched"))
  mocks.rm.mockResolvedValue(undefined)
  mocks.mkdir.mockResolvedValue(undefined)
  mocks.writeFile.mockResolvedValue(undefined)
  mocks.release.mockResolvedValue(undefined)
})
afterEach(() => { process.exitCode = previousExitCode; vi.unstubAllEnvs() })

describe("page measurement preflight", () => {
  it("preserves prior evidence and never launches a browser if environment/build validation fails", async () => {
    mocks.measurementEnvironment.mockRejectedValueOnce(new Error("Hosted build is not production-equivalent"))
    await expect(import("../../../scripts/facility/measure-page.mjs")).rejects.toThrow("Hosted build is not production-equivalent")
    expect(mocks.rm).not.toHaveBeenCalled()
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it("validates identity before clearing the old output and reaching the browser boundary", async () => {
    const order: string[] = []
    mocks.measurementEnvironment.mockImplementationOnce(async () => { order.push("validated"); return { name: "local" } })
    mocks.rm.mockImplementationOnce(async () => { order.push("output-cleared") })
    mocks.launch.mockImplementationOnce(async () => { order.push("browser-boundary"); throw new Error("Test browser boundary: no browser launched") })
    await expect(import("../../../scripts/facility/measure-page.mjs")).rejects.toThrow("Test browser boundary")
    expect(order).toEqual(["validated", "output-cleared", "browser-boundary"])
    expect(mocks.release).toHaveBeenCalledOnce()
  })

  it("retains the actual serving receipt when its environment policy fails", async () => {
    const environment = { name: "public-production", measurementOrigin: "https://gridninja.ai" }
    const before = { result: "pass", resources: [] }
    const after = { result: "pass", resources: [{ path: "/", robots: "noindex", contentType: "text/html" }] }
    const browser = { version: () => "test-browser", newContext: vi.fn(async () => { throw new Error("Test stops before capture") }), close: vi.fn(async () => {}) }
    mocks.measurementEnvironment.mockResolvedValueOnce(environment)
    mocks.provenance.mockResolvedValueOnce({ qualificationEnvironment: environment })
    mocks.launch.mockResolvedValueOnce(browser)
    mocks.verifyMeasurementServing.mockResolvedValueOnce(before).mockResolvedValueOnce(after)
    mocks.assertMeasurementServingPair.mockRejectedValueOnce(new Error("Public page cannot be noindex"))

    await import("../../../scripts/facility/measure-page.mjs")
    const report = JSON.parse(String(mocks.writeFile.mock.calls[0][1]))
    expect(report.result).toBe("fail")
    expect(report.hostedServing).toMatchObject({ before, after, validationFailure: "Public page cannot be noindex" })
    expect(mocks.assertMeasurementServingPair).toHaveBeenCalledOnce()
    expect(process.exitCode).toBe(1)
    expect(browser.close).toHaveBeenCalledOnce()
    expect(mocks.release).toHaveBeenCalledOnce()
  })
})
