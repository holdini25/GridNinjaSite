// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

const mocked = vi.hoisted(() => ({
  readFile: vi.fn(async () => Buffer.from('{"$schema":"https://openapi.vercel.sh/vercel.json"}\n')),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(async () => undefined),
  identity: { sourceRevision: "a".repeat(64), buildId: "built-in-production-build" },
  harness: "b".repeat(64),
  hostedConfigDiagnostics: vi.fn(() => ({ diagnostic: "original-cli" })),
  hostedOutputDiagnostics: vi.fn(async () => ({ adapter: true, htmlFiles: [] })),
  createHostedAttestation: vi.fn(async () => ({ sourceBinding: { fixture: true }, fixture: "actual-build-resource-collector" })),
  hostedAttestationLogLines: vi.fn(() => ["GRIDNINJA_HOSTED_ATTESTATION_V1 fixture"]),
}))
vi.mock("node:fs/promises", () => ({ readFile: mocked.readFile, writeFile: mocked.writeFile }))
vi.mock("../../../scripts/facility/performance-contract.mjs", () => ({ currentBuildIdentity: async () => mocked.identity, harnessRevision: async () => mocked.harness, sourceSnapshot: async () => ({ sourceRevision: mocked.identity.sourceRevision, files: [] }) }))
vi.mock("../../../scripts/facility/hosted-attestation.mjs", () => ({ createHostedAttestation: mocked.createHostedAttestation, hostedAttestationLogLines: mocked.hostedAttestationLogLines, hostedConfigDiagnostics: mocked.hostedConfigDiagnostics, hostedOutputDiagnostics: mocked.hostedOutputDiagnostics }))

const env = {
  VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_ID: "prj_9JSTjPiUBQEC6VTv363zVm7EA54S", VERCEL_DEPLOYMENT_ID: "dpl_GitProduction",
  VERCEL_URL: "gridninja-git-production.vercel.app", VERCEL_GIT_REPO_OWNER: "holdini25", VERCEL_GIT_REPO_SLUG: "GridNinjaSite", VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_COMMIT_SHA: "c".repeat(40),
}
function prepare(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules(); vi.clearAllMocks()
  for (const [key, value] of Object.entries({ ...env, FACILITY_HOSTED_ATTESTATION: undefined, ...overrides })) vi.stubEnv(key, value)
  return vi.spyOn(console, "log").mockImplementation(() => undefined)
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe("postbuild automatic Git attestation entrypoint", () => {
  it("automatically emits the private artifact and existing log chunks without facility pins", async () => {
    const log = prepare()
    await import("../../../scripts/facility/record-build.mjs")
    expect(mocked.writeFile.mock.calls.map(call => call[0])).toEqual([".next/facility-build.json", ".next/hosted-build-attestation.json"])
    expect(mocked.createHostedAttestation).toHaveBeenCalledExactlyOnceWith(mocked.identity, mocked.harness)
    expect(mocked.hostedConfigDiagnostics).not.toHaveBeenCalled()
    expect(log.mock.calls.flat()).toContain("GRIDNINJA_HOSTED_ATTESTATION_V1 fixture")
    expect(log.mock.calls.flat().join("\n")).toContain('"kind":"git-unmodified.v1"')
  })
  it.each([{ VERCEL: undefined }, { VERCEL_ENV: "preview" }, { VERCEL_PROJECT_ID: "prj_Other" }])("leaves the ordinary local/other-project postbuild unchanged", async overrides => {
    prepare(overrides)
    await import("../../../scripts/facility/record-build.mjs")
    expect(mocked.writeFile.mock.calls.map(call => call[0])).toEqual([".next/facility-build.json"])
    expect(mocked.createHostedAttestation).not.toHaveBeenCalled()
  })
  it("fails before writing attestations when the production identity is incomplete", async () => {
    prepare({ VERCEL_DEPLOYMENT_ID: undefined })
    await expect(import("../../../scripts/facility/record-build.mjs")).rejects.toThrow("deployment ID")
    expect(mocked.writeFile).not.toHaveBeenCalled()
    expect(mocked.createHostedAttestation).not.toHaveBeenCalled()
  })
  it("retains the explicitly enabled CLI diagnostics and collector path", async () => {
    prepare({ FACILITY_HOSTED_ATTESTATION: "1" })
    await import("../../../scripts/facility/record-build.mjs")
    expect(mocked.hostedConfigDiagnostics).toHaveBeenCalledTimes(1)
    expect(mocked.createHostedAttestation).toHaveBeenCalledExactlyOnceWith(mocked.identity, mocked.harness)
    expect(mocked.writeFile.mock.calls.map(call => call[0])).toEqual([".next/facility-build.json", ".next/hosted-build-attestation.json"])
  })
})
