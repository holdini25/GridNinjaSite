// @vitest-environment node
import { describe, expect, it } from "vitest"
import { assertQualificationToolchainIdentity, QUALIFICATION_CATEGORIES, QUALIFICATION_VERSIONS } from "../../../scripts/facility/qualification-toolchain.mjs"

const identity = () => ({
  schemaVersion: "gridninja-qualification-toolchain.v1", versions: { ...QUALIFICATION_VERSIONS }, actualNode: "22.23.2",
  manifestSha256: "a".repeat(64), lockSha256: "b".repeat(64),
  resolvedPackages: { lighthouse: "node_modules/lighthouse/package.json", "puppeteer-core": "node_modules/puppeteer-core/package.json", "chrome-launcher": "node_modules/chrome-launcher/package.json" },
})

describe("fixed isolated qualification identity", () => {
  it("keeps collection limited to the original four categories", () => {
    expect(QUALIFICATION_CATEGORIES).toEqual(["performance", "accessibility", "best-practices", "seo"])
  })
  it("accepts the complete fixed toolchain contract", () => {
    expect(() => assertQualificationToolchainIdentity(identity(), identity())).not.toThrow()
  })
  it.each(["lighthouse", "puppeteerCore", "chromeLauncher", "chrome", "node"])("rejects drift in %s", key => {
    const value = identity()
    value.versions[key as keyof typeof value.versions] = "0.0.0"
    expect(() => assertQualificationToolchainIdentity(value)).toThrow("versions")
  })
  it("rejects absent/malformed identity, unpinned Node and mixed locks", () => {
    expect(() => assertQualificationToolchainIdentity(undefined)).toThrow()
    expect(() => assertQualificationToolchainIdentity({ ...identity(), actualNode: "24.0.0" })).toThrow("Node")
    expect(() => assertQualificationToolchainIdentity({ ...identity(), lockSha256: "missing" })).toThrow("lockSha256")
    expect(() => assertQualificationToolchainIdentity(identity(), { ...identity(), lockSha256: "c".repeat(64) })).toThrow("Mixed")
  })
  it("rejects fallback root/nested/partial resolutions", () => {
    for (const path of ["../../node_modules/lighthouse/package.json", "node_modules/other/node_modules/lighthouse/package.json"]) {
      const value = identity(); value.resolvedPackages.lighthouse = path
      expect(() => assertQualificationToolchainIdentity(value)).toThrow("isolated root")
    }
    expect(() => assertQualificationToolchainIdentity({ ...identity(), resolvedPackages: {} })).toThrow("resolutions")
  })
})
