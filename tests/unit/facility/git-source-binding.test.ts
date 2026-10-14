// @vitest-environment node
import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { CLI_SOURCE_MODE, GIT_SOURCE_MODE, assertGitCheckoutCommit, expectedGitPlatformIdentity, gitConfigBinding, productionGitIdentity, validateGitConfigBinding } from "../../../scripts/facility/git-source-binding.mjs"
import { expectedHostedConfig, hostedAttestationLogLines, hostedSourceBinding, parseHostedAttestationLogs, validateHostedAttestation } from "../../../scripts/facility/hosted-attestation.mjs"
import { expectedGitSource, sourceSnapshot } from "../../../scripts/facility/performance-contract.mjs"
import { validatePublicAttestation, validatePublicProductionPins } from "../../../scripts/facility/public-production.mjs"
import { PRODUCTION_PROJECT } from "../../../scripts/facility/vercel-production-metadata.mjs"
import { performanceMatrix } from "../../../scripts/facility/lighthouse-matrix.mjs"

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const commit = "a".repeat(40), origin = "https://gridninja-git-build.vercel.app"
const config = Buffer.from('{\n  "$schema": "https://openapi.vercel.sh/vercel.json",\n  "git": {"deploymentEnabled":{"branch":false}}\n}\n')
const environment: NodeJS.ProcessEnv = {
  NODE_ENV: "test", VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_ID: PRODUCTION_PROJECT.id,
  VERCEL_DEPLOYMENT_ID: "dpl_ActualGitProduction", VERCEL_URL: new URL(origin).hostname,
  VERCEL_GIT_REPO_OWNER: "holdini25", VERCEL_GIT_REPO_SLUG: "GridNinjaSite", VERCEL_GIT_COMMIT_REF: "main", VERCEL_GIT_COMMIT_SHA: commit,
}
const head = () => vi.fn(() => ({ status: 0, stdout: `${commit}\n` }))
function fixture() {
  const identity = { sourceRevision: sha("source"), buildId: "actual-git-build", releases: [{ release: "facility-v1", manifestSha256: sha("release") }], buildSettings: { observability: true, httpsPolicy: true, csp: "enforce", verification: "live", verificationSiteKeySha256: sha("public-site-key"), privateCandidate: null } }
  const attestation = {
    schemaVersion: "gridninja-hosted-build.v1", recordedAt: "2026-01-01T00:00:00.000Z", origin, environment: "production", identity,
    sourceBinding: hostedSourceBinding(identity, config, environment), harnessRevision: sha("harness"),
    resources: [...performanceMatrix("premium-civic").routes.map(path => ({ path, kind: "html", sha256: sha("html"), bytes: 4 })), { path: "/_next/static/chunk.js", kind: "asset", sha256: sha("asset"), bytes: 5 }],
  }
  const pins = {
    schemaVersion: "gridninja-public-production-pins.v1", origin: "https://gridninja.ai", projectId: PRODUCTION_PROJECT.id, projectName: PRODUCTION_PROJECT.name, scope: PRODUCTION_PROJECT.scope,
    deploymentId: environment.VERCEL_DEPLOYMENT_ID!, deploymentCommit: commit, immutableOrigin: origin, sourceMode: GIT_SOURCE_MODE,
    sourceRevision: identity.sourceRevision, hostedSourceRevision: identity.sourceRevision, configTransformation: gitConfigBinding(config),
    buildId: identity.buildId, buildSettings: identity.buildSettings, releases: identity.releases, harnessRevision: attestation.harnessRevision,
    providerSettings: { projectNodeVersion: "22.x", deploymentNodeVersion: "22.x", gitConnected: true, protectionScope: "all_except_custom_domains" },
  }
  const options = { baseURL: origin, sourceRevision: pins.sourceRevision, hostedSourceRevision: pins.hostedSourceRevision, configTransformation: pins.configTransformation, harnessRevision: pins.harnessRevision, platformIdentity: expectedGitPlatformIdentity(pins) }
  return { attestation, pins, options }
}

describe("automatic production Git producer", () => {
  it("uses only complete built-in production identity and needs no facility environment pins", () => {
    expect(productionGitIdentity(environment)).toEqual({ projectId: PRODUCTION_PROJECT.id, deploymentId: environment.VERCEL_DEPLOYMENT_ID, deploymentCommit: commit, repositoryOwner: "holdini25", repositoryName: "GridNinjaSite", gitRef: "main", origin })
    const { attestation, pins } = fixture()
    expect(attestation.sourceBinding.repositorySourceRevision).toBe(attestation.sourceBinding.hostedSourceRevision)
    expect(validatePublicAttestation(parseHostedAttestationLogs(hostedAttestationLogLines(attestation).join("\n")), pins)).toEqual(attestation)
  })
  it.each([{}, { ...environment, VERCEL: "0" }, { ...environment, VERCEL_ENV: "preview" }, { ...environment, VERCEL_PROJECT_ID: "prj_OtherProject", VERCEL_GIT_REPO_OWNER: undefined }])("does not autoactivate local, preview or other projects", env => {
    expect(productionGitIdentity({ NODE_ENV: "test", ...env })).toBeNull()
  })
  it.each(["VERCEL_PROJECT_ID", "VERCEL_DEPLOYMENT_ID", "VERCEL_URL", "VERCEL_GIT_REPO_OWNER", "VERCEL_GIT_REPO_SLUG", "VERCEL_GIT_COMMIT_REF", "VERCEL_GIT_COMMIT_SHA"])("fails closed with missing or empty %s on the production target", key => {
    for (const value of [undefined, ""]) expect(() => productionGitIdentity({ ...environment, [key]: value })).toThrow()
  })
  it.each([
    { VERCEL_GIT_REPO_OWNER: "other" }, { VERCEL_GIT_REPO_SLUG: "other" }, { VERCEL_GIT_COMMIT_REF: "feature" },
    { VERCEL_GIT_COMMIT_SHA: "abcd123" }, { VERCEL_GIT_COMMIT_SHA: "A".repeat(40) }, { VERCEL_DEPLOYMENT_ID: "not-deployment" },
    { VERCEL_URL: "foreign.example" }, { VERCEL_URL: "user:password@host.vercel.app" }, { VERCEL_URL: "host.vercel.app/route" },
  ])("rejects malformed or wrong built-in production metadata", patch => {
    expect(() => productionGitIdentity({ ...environment, ...patch })).toThrow()
  })
  it("cannot disable auto attestation with a flag of zero", () => {
    expect(productionGitIdentity({ ...environment, FACILITY_HOSTED_ATTESTATION: "0" })).toEqual(productionGitIdentity(environment))
    expect(() => productionGitIdentity({ ...environment, FACILITY_HOSTED_ATTESTATION: "0", VERCEL_GIT_COMMIT_SHA: undefined })).toThrow()
  })
  it("preserves explicit CLI rewrite bytes and source-binding output", () => {
    const original = Buffer.from('{"$schema":"https://openapi.vercel.sh/vercel.json"}')
    const cliPins = { projectName: "gridninja", originalCanonicalSha256: sha(original) }
    const expected = expectedHostedConfig(original, cliPins)
    const env = { ...environment, FACILITY_HOSTED_ATTESTATION: "1", FACILITY_REPOSITORY_SOURCE_REVISION: sha("repository"), FACILITY_HOSTED_PROJECT_NAME: cliPins.projectName, FACILITY_EXPECTED_VERCEL_CONFIG_SHA256: cliPins.originalCanonicalSha256 }
    expect(productionGitIdentity(env)).toBeNull()
    expect(expected.bytes.toString()).toBe('{"$schema":"https://openapi.vercel.sh/vercel.json","name":"gridninja","version":2}\n')
    expect(hostedSourceBinding({ sourceRevision: sha("built") }, expected.bytes, env)).toEqual({ repositorySourceRevision: sha("repository"), hostedSourceRevision: sha("built"), configTransformation: expected.transformation })
  })
  it("binds raw config bytes without rewriting or normalizing whitespace/key order", () => {
    const initial = gitConfigBinding(config)
    expect(initial).toEqual({ kind: GIT_SOURCE_MODE, projectName: "gridninja", builtConfigSha256: sha(config), builtConfigBytes: config.length })
    expect(gitConfigBinding(Buffer.from(JSON.stringify(JSON.parse(config.toString()))))).not.toEqual(initial)
    expect(() => validateGitConfigBinding({ ...initial, version: 2 })).toThrow("exact")
  })
})

describe("independent Git source and production consumer", () => {
  it("recomputes unchanged source/config after checking exact checkout HEAD", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gridninja-git-source-")), run = head()
    try {
      await writeFile(join(directory, "vercel.json"), config)
      await writeFile(join(directory, "source.ts"), "export const value = 1\n")
      const paths = ["vercel.json", "source.ts"], expected = await expectedGitSource({ deploymentCommit: commit }, directory, paths, { run })
      expect(run.mock.calls).toEqual([["git", ["rev-parse", "--verify", "HEAD"], { cwd: directory, encoding: "utf8", timeout: 10000, maxBuffer: 4096, stdio: ["ignore", "pipe", "pipe"] }]])
      expect(expected.sourceRevision).toBe((await sourceSnapshot(paths, directory)).sourceRevision)
      expect(expected.hostedSourceRevision).toBe(expected.sourceRevision)
      expect(expected.configTransformation).toEqual(gitConfigBinding(config))
      const { attestation, pins } = fixture()
      Object.assign(pins, expected)
      attestation.identity.sourceRevision = expected.sourceRevision
      Object.assign(attestation.sourceBinding, { repositorySourceRevision: expected.sourceRevision, hostedSourceRevision: expected.sourceRevision, configTransformation: expected.configTransformation })
      expect(() => validatePublicAttestation(attestation, pins)).not.toThrow()
      for (const [file, bytes] of [["source.ts", "export const value = 2\n"], ["vercel.json", `${config}\n`]]) {
        await writeFile(join(directory, file), bytes)
        const dirty = await expectedGitSource({ deploymentCommit: commit }, directory, paths, { run })
        expect(dirty.sourceRevision).not.toBe(expected.sourceRevision)
        expect(() => validatePublicAttestation(attestation, { ...pins, ...dirty })).toThrow("binding")
      }
      await expect(expectedGitSource({ deploymentCommit: "b".repeat(40) }, directory, paths, { run })).rejects.toThrow("HEAD")
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it.each([{ status: 1, stdout: "private error" }, { status: 0, stdout: "b".repeat(40) }, { status: 0, stdout: commit, signal: "SIGTERM" }])("rejects failed or mismatched checkout identity", result => {
    expect(() => assertGitCheckoutCommit("/fixture", commit, () => result)).toThrow()
  })
  it("selects the mode from explicit independent pins, rejects cross-mode claims", () => {
    const { attestation, pins, options } = fixture()
    expect(() => validateHostedAttestation(attestation, options)).not.toThrow()
    expect(() => validateHostedAttestation(attestation, { ...options, platformIdentity: null })).toThrow("platform identity")
    for (const sourceMode of [undefined, "automatic", CLI_SOURCE_MODE]) expect(() => validatePublicProductionPins({ ...pins, sourceMode })).toThrow()
    expect(() => validatePublicAttestation({ ...attestation, sourceBinding: { ...attestation.sourceBinding, configTransformation: { ...pins.configTransformation, kind: CLI_SOURCE_MODE } } }, pins)).toThrow("binding")
    expect(() => validatePublicAttestation(attestation, { ...pins, providerSettings: { ...pins.providerSettings, gitConnected: false } })).toThrow("connection")
  })
  it.each([
    { projectId: "prj_Other" }, { deploymentId: "dpl_Other" }, { deploymentCommit: "b".repeat(40) }, { repositoryOwner: "other" },
    { repositoryName: "Other" }, { gitRef: "feature" }, { origin: "https://other.vercel.app" }, { extra: "not-approved" },
  ])("rejects changed producer platform claims against independent provider pins", patch => {
    const { attestation, pins } = fixture()
    Object.assign(attestation.sourceBinding.platformIdentity!, patch)
    expect(() => validatePublicAttestation(attestation, pins)).toThrow("binding")
  })
  it("rejects mixed repository/source identities and altered raw config claims", () => {
    const { attestation, pins } = fixture()
    expect(() => validatePublicAttestation(attestation, { ...pins, hostedSourceRevision: sha("rewritten") })).toThrow("equal")
    expect(() => validatePublicAttestation(attestation, { ...pins, configTransformation: gitConfigBinding(Buffer.from(`${config}\n`)) })).toThrow("binding")
    expect(() => validatePublicAttestation({ ...attestation, environment: "preview" }, pins)).toThrow("production")
  })
})
