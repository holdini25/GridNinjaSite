// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { harnessRevision } from "../../../scripts/facility/performance-contract.mjs"

const requiredFiles = ["tools/qualification/package.json", "tools/qualification/package-lock.json", ".github/workflows/qualification-compatibility.yml"]
const files = ["scripts/facility/qualification-toolchain.mjs", "scripts/cinematic/capture.mjs", "lighthouserc.cjs", "scripts/seo/validate-lighthouse-budgets.mjs", ...requiredFiles]
async function write(directory: string, path: string, content: string) {
  await mkdir(dirname(join(directory, path)), { recursive: true })
  await writeFile(join(directory, path), content)
}
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "gridninja-harness-"))
  for (const path of files) await write(directory, path, `synthetic fixture: ${path}`)
  return directory
}

describe("qualification harness source identity", () => {
  it("binds every qualification manifest, lock, workflow and adapter byte", async () => {
    const directory = await fixture()
    try {
      const original = await harnessRevision(directory)
      for (const path of files) {
        await write(directory, path, `changed fixture: ${path}`)
        expect(await harnessRevision(directory)).not.toBe(original)
        await write(directory, path, `synthetic fixture: ${path}`)
        expect(await harnessRevision(directory)).toBe(original)
      }
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it.each(requiredFiles)("fails closed when required %s is absent or is a directory", async path => {
    const directory = await fixture()
    try {
      await rm(join(directory, path))
      await expect(harnessRevision(directory)).rejects.toThrow(`Missing required qualification harness file: ${path}`)
      await mkdir(join(directory, path))
      await expect(harnessRevision(directory)).rejects.toThrow(`Missing required qualification harness file: ${path}`)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it("excludes installed dependencies and keeps the digest independent of checkout location", async () => {
    const directory = await fixture(), other = await fixture()
    try {
      const original = await harnessRevision(directory)
      expect(await harnessRevision(other)).toBe(original)
      for (const path of ["tools/qualification/node_modules/lighthouse/index.js", "scripts/facility/node_modules/unshipped/index.js", "scripts/facility/__pycache__/cache.pyc"]) {
        await write(directory, path, "not harness source")
      }
      expect(await harnessRevision(directory)).toBe(original)
    } finally { await Promise.all([directory, other].map(path => rm(path, { recursive: true, force: true }))) }
  })
})
