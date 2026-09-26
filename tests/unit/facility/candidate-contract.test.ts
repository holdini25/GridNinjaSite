// @vitest-environment node
import { describe, expect, it } from "vitest"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
import { auditPlaywrightReport, candidateMetadata, createCandidateLedger, evaluateCandidate, recordCandidateEvidence } from "../../../scripts/qa/candidate-contract.mjs"

const identity = { sourceRevision: "source", buildId: "build", buildSettings: { selectedRelease: "facility-v9" } }
const evidence = { path: "build/result.json", sha256: "a".repeat(64) }
describe("candidate evidence cannot manufacture readiness", () => {
  it("records actual tools and explicit frozen publication hashes, invalidating changed bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "gridninja-candidate-metadata-"))
    try {
      const publications = join(root, "src/content/assessment-publications")
      await mkdir(join(publications, "demo/v1.0.0"), { recursive: true })
      await writeFile(join(root, "package.json"), JSON.stringify({ packageManager: "npm@10.9.2" }))
      await writeFile(join(root, "package-lock.json"), "lock-v1")
      await writeFile(join(publications, "registry.json"), "[]")
      await writeFile(join(publications, "demo/v1.0.0/brief.pdf"), "frozen-pdf")
      const before = await candidateMetadata(root)
      expect(before.toolchain).toMatchObject({ node: process.version, declaredPackageManager: "npm@10.9.2", platform: process.platform, arch: process.arch, packageLockSha256: createHash("sha256").update("lock-v1").digest("hex") })
      expect(before.toolchain.npm).toMatch(/^\d+\.\d+\.\d+/)
      expect(before.publications.registrySha256).toBe(createHash("sha256").update("[]").digest("hex"))
      expect(before.publications.files).toHaveLength(2)
      expect(before.publications.files[0]).toMatchObject({ path: "src/content/assessment-publications/demo/v1.0.0/brief.pdf", bytes: 10 })
      expect(await candidateMetadata(root)).toEqual(before)
      await writeFile(join(publications, "demo/v1.0.0/brief.pdf"), "changed-pdf")
      const after = await candidateMetadata(root)
      expect(after.publications.filesSha256).not.toBe(before.publications.filesSha256)
      const ledger = createCandidateLedger({ ...identity, ...before }, {})
      expect(() => recordCandidateEvidence(ledger, "assessment-publication-integrity", { identity: { ...identity, ...after }, owner: "reviewer", status: "pass", evidence: [evidence] })).toThrow(/different/)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it("keeps external qualification separate from local readiness", () => {
    const ledger = createCandidateLedger(identity, {})
    for (const gate of ledger.gates) if (gate.scope === "local") recordCandidateEvidence(ledger, gate.id, { identity, owner: "reviewer", status: "pass", evidence: [evidence] })
    expect(evaluateCandidate(ledger)).toMatchObject({ localReady: true, publicReady: false })
  })
  it("rejects stale builds, artifactless passes, missing gates and invalid statuses", () => {
    const ledger = createCandidateLedger(identity, {})
    expect(() => recordCandidateEvidence(ledger, "performance", { identity: { ...identity, buildId: "old" }, owner: "reviewer", status: "pass", evidence: [evidence] })).toThrow(/different/)
    expect(() => recordCandidateEvidence(ledger, "performance", { identity, owner: "reviewer", status: "pass", evidence: [] })).toThrow(/hashed/)
    expect(() => recordCandidateEvidence(ledger, "performance", { identity, owner: "reviewer", status: "skipped", evidence: [] })).toThrow(/status/)
    ledger.gates.pop(); expect(() => evaluateCandidate(ledger)).toThrow(/Missing/)
  })
  it("retains failed attempts and requires a resolution before passing", () => {
    const ledger = createCandidateLedger(identity, { externalActionsAuthorized: false })
    recordCandidateEvidence(ledger, "performance", { identity, owner: "reviewer", status: "fail", evidence: [evidence] })
    expect(() => recordCandidateEvidence(ledger, "performance", { identity, owner: "reviewer", status: "pass", evidence: [evidence] })).toThrow(/resolution/)
    recordCandidateEvidence(ledger, "performance", { identity, owner: "reviewer", status: "pass", resolution: "Measurement contamination resolved; complete clean rerun retained.", evidence: [evidence] })
    expect(ledger.gates.find(gate => gate.id === "performance")?.attempts.map(attempt => attempt.status)).toEqual(["fail", "pass"])
    expect(() => recordCandidateEvidence(ledger, "staging-delivery", { identity, owner: "reviewer", status: "pass", evidence: [evidence] })).toThrow(/local-only/)
  })
  it("does not turn a retry, expected failure or missing required test into a clean pass", () => {
    const report = { suites: [{ specs: [{ title: "rack", tests: [{ projectName: "webkit-mobile", results: [{ status: "failed" }, { status: "passed" }] }] }] }] }
    expect(auditPlaywrightReport(report).failures).toContain("Failed attempt retained: webkit-mobile: rack")
    expect(auditPlaywrightReport({ suites: [] }).result).toBe("fail")
    expect(auditPlaywrightReport(report, { requiredTitles: [{ title: "native hidden", project: "chrome-stable" }] }).failures).toContain("Missing required execution: chrome-stable: native hidden")
  })
  it("permits only exact reviewed skip reasons and projects", () => {
    const report = { suites: [{ specs: [{ title: "native", tests: [{ projectName: "webkit-mobile", annotations: [{ type: "skip", description: "Chrome-only API" }], results: [{ status: "skipped" }] }] }] }] }
    expect(auditPlaywrightReport(report).result).toBe("fail")
    expect(auditPlaywrightReport(report, { allowedSkips: [{ title: "native", project: "webkit-mobile", reason: "Chrome-only API" }] }).result).toBe("pass")
  })
})
