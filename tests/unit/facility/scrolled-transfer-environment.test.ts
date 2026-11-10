// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  measurementEnvironment: vi.fn(),
  isProtectedMeasurement: vi.fn(),
  verifyMeasurementDocument: vi.fn(),
  collectTransfers: vi.fn(),
  settleTransfers: vi.fn(),
  authorizeHostedContext: vi.fn(),
}))

vi.mock("../../../scripts/facility/performance-contract.mjs", async importOriginal => ({
  ...await importOriginal<typeof import("../../../scripts/facility/performance-contract.mjs")>(),
  ...mocks,
}))
vi.mock("../../../scripts/facility/hosted-auth.mjs", async importOriginal => ({
  ...await importOriginal<typeof import("../../../scripts/facility/hosted-auth.mjs")>(),
  authorizeHostedContext: mocks.authorizeHostedContext,
}))

import { measureScrolledRoutes } from "../../../scripts/facility/scrolled-transfer.mjs"

const publicEnvironment = { schemaVersion: "facility-qualification-environment.v1", name: "public-production", measurementOrigin: "https://gridninja.ai" }
const transfer = { complete: true, issues: [], bytes: 300, requests: [{ url: "https://gridninja.ai/evidence", type: "Document", bytes: 300 }] }
const proof = { schemaVersion: "test-document-proof", route: "/evidence", htmlSha256: "actual-navigation-body" }
const options = { matrix: { routes: ["/evidence"], profiles: ["desktop"], runs: 1 }, baseURL: publicEnvironment.measurementOrigin, buildSettings: {}, desktopViewport: { width: 1440, height: 1100 }, qualificationEnvironment: publicEnvironment }

function browserFixture() {
  const events: string[] = []
  const body = Buffer.from("<!doctype html><title>Captured navigation</title>")
  const headers = { "content-type": "text/html; charset=utf-8", "x-vercel-id": "actual-navigation" }
  const response = { body: vi.fn(async () => { events.push("document-body"); return body }), url: () => "https://gridninja.ai/evidence", status: () => 200, allHeaders: vi.fn(async () => headers) }
  const page = {
    on: vi.fn(),
    goto: vi.fn(async () => response),
    evaluate: vi.fn(async () => ({ y: 1000, height: 2000, viewportHeight: 1000 })),
    locator: vi.fn(() => ({ evaluateAll: vi.fn(async () => { events.push("visible-images"); return [] }) })),
  }
  const context = { newPage: vi.fn(async () => page), newCDPSession: vi.fn(async () => ({})), close: vi.fn(async () => {}) }
  const browser = { newContext: vi.fn(async () => context) }
  mocks.collectTransfers.mockResolvedValue({ snapshot: () => transfer })
  mocks.settleTransfers.mockImplementation(async () => { events.push("settle"); return transfer })
  return { browser, context, page, response, body, headers, events }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.measurementEnvironment.mockResolvedValue(publicEnvironment)
  mocks.isProtectedMeasurement.mockReturnValue(false)
  mocks.verifyMeasurementDocument.mockResolvedValue(proof)
  mocks.authorizeHostedContext.mockResolvedValue(undefined)
  vi.spyOn(console, "log").mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe("full-scroll qualification environment and captured document identity", () => {
  it("proves the actual navigation response after observations and never authenticates public collection", async () => {
    const fixture = browserFixture()
    const [result] = await measureScrolledRoutes(fixture.browser, options)

    expect(fixture.page.goto).toHaveBeenCalledExactlyOnceWith("https://gridninja.ai/evidence", { waitUntil: "load", timeout: 30_000 })
    expect(mocks.verifyMeasurementDocument).toHaveBeenCalledExactlyOnceWith(fixture.body, { url: fixture.response.url(), status: 200, headers: fixture.headers })
    expect(mocks.verifyMeasurementDocument.mock.calls[0][0]).toBe(fixture.body)
    expect(fixture.events).toEqual(["settle", "settle", "settle", "visible-images", "document-body"])
    expect(result).toMatchObject({ complete: true, qualificationEnvironment: publicEnvironment, documentIdentity: proof, initialTransfer: transfer, fullPageTransfer: transfer })
    expect(mocks.authorizeHostedContext).not.toHaveBeenCalled()
    expect(fixture.context.close).toHaveBeenCalledOnce()
  })

  it.each(["local", "protected-staging"])("keeps %s capture separate from public proof", async name => {
    const fixture = browserFixture()
    const environment = { ...publicEnvironment, name, measurementOrigin: name === "local" ? "http://localhost:3000" : "https://candidate.vercel.app" }
    mocks.measurementEnvironment.mockResolvedValue(environment)
    mocks.isProtectedMeasurement.mockReturnValue(name === "protected-staging")
    const [result] = await measureScrolledRoutes(fixture.browser, { ...options, baseURL: environment.measurementOrigin, qualificationEnvironment: environment })

    expect(result).toMatchObject({ complete: true, documentIdentity: null, qualificationEnvironment: environment })
    expect(fixture.response.body).not.toHaveBeenCalled()
    expect(mocks.verifyMeasurementDocument).not.toHaveBeenCalled()
    if (name === "protected-staging") expect(mocks.authorizeHostedContext).toHaveBeenCalledExactlyOnceWith(fixture.context, environment.measurementOrigin)
    else expect(mocks.authorizeHostedContext).not.toHaveBeenCalled()
  })

  it("rejects failed identity validation before creating any context", async () => {
    const fixture = browserFixture()
    mocks.measurementEnvironment.mockRejectedValueOnce(new Error("Source identity differs from pinned build"))
    await expect(measureScrolledRoutes(fixture.browser, options)).rejects.toThrow("Source identity differs")
    expect(fixture.browser.newContext).not.toHaveBeenCalled()
    expect(mocks.authorizeHostedContext).not.toHaveBeenCalled()
  })

  it("rejects a changed supplied environment before creating any context", async () => {
    const fixture = browserFixture()
    await expect(measureScrolledRoutes(fixture.browser, { ...options, qualificationEnvironment: { ...publicEnvironment, name: "protected-staging" } })).rejects.toThrow("differs from page provenance")
    expect(fixture.browser.newContext).not.toHaveBeenCalled()
  })

  it("resolves and records the environment for existing callers that omit it", async () => {
    const fixture = browserFixture()
    const legacyOptions = { matrix: options.matrix, baseURL: options.baseURL, buildSettings: options.buildSettings, desktopViewport: options.desktopViewport }
    const [result] = await measureScrolledRoutes(fixture.browser, legacyOptions)
    expect(mocks.measurementEnvironment).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ complete: true, qualificationEnvironment: publicEnvironment, documentIdentity: proof })
  })

  it("rejects a capture URL outside the resolved environment before creating a context", async () => {
    const fixture = browserFixture()
    await expect(measureScrolledRoutes(fixture.browser, { ...options, baseURL: "https://other.vercel.app" })).rejects.toThrow("URL differs from qualification environment")
    expect(fixture.browser.newContext).not.toHaveBeenCalled()
    expect(mocks.authorizeHostedContext).not.toHaveBeenCalled()
  })

  it("retains measured transfers and closes the context when document proof rejects", async () => {
    const fixture = browserFixture()
    mocks.verifyMeasurementDocument.mockRejectedValueOnce(new Error("Captured HTML differs from pinned resource"))
    const [result] = await measureScrolledRoutes(fixture.browser, options)
    expect(result).toMatchObject({ complete: false, failure: "Captured HTML differs from pinned resource", documentIdentity: null, initialTransfer: transfer, fullPageTransfer: transfer })
    expect(fixture.context.close).toHaveBeenCalledOnce()
  })

  it("does not mark a public capture complete when its navigation has no response", async () => {
    const fixture = browserFixture()
    fixture.page.goto.mockResolvedValueOnce(null as unknown as typeof fixture.response)
    const [result] = await measureScrolledRoutes(fixture.browser, options)
    expect(result).toMatchObject({ complete: false, documentIdentity: null, fullPageTransfer: transfer })
    expect(result.failure).toContain("Missing navigation response")
    expect(mocks.verifyMeasurementDocument).not.toHaveBeenCalled()
    expect(fixture.context.close).toHaveBeenCalledOnce()
  })

  it("does not accept an absent public proof as a completed capture", async () => {
    const fixture = browserFixture()
    mocks.verifyMeasurementDocument.mockResolvedValueOnce(null)
    const [result] = await measureScrolledRoutes(fixture.browser, options)
    expect(result).toMatchObject({ complete: false, documentIdentity: null, fullPageTransfer: transfer })
    expect(result.failure).toContain("Missing public full-scroll document identity")
    expect(fixture.context.close).toHaveBeenCalledOnce()
  })
})
