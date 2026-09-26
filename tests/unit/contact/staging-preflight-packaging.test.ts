// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { traceStagingPreflightArtifacts } from "../../../scripts/facility/trace-staging-preflight.mjs"

const folders: string[] = []
afterEach(async () => { await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function fixture() {
  const path = await mkdtemp(join(tmpdir(), "gridninja-preflight-trace-")); folders.push(path)
  const route = join(path, "server/app/api/internal/lead-staging-preflight/route.js")
  await mkdir(dirname(route), { recursive: true })
  await writeFile(route, "// fixture")
  await writeFile(`${route}.nft.json`, JSON.stringify({ version: 1, files: ["existing-runtime.js"] }))
  await writeFile(join(path, "facility-build.json"), JSON.stringify({ identity: { buildId: "fixture" } }))
  await writeFile(join(path, "BUILD_ID"), "fixture\n")
  return { path, route, trace: `${route}.nft.json` }
}

describe("postbuild staging attestation packaging", () => {
  it("adds and verifies the finalized artifacts without removing the original dependency trace", async () => {
    const test = await fixture()
    const result = await traceStagingPreflightArtifacts(test.path)
    expect(result.result).toBe("passed")
    const trace = JSON.parse(await readFile(test.trace, "utf8"))
    expect(trace.files).toContain("existing-runtime.js")
    expect(result.files.map(file => resolve(dirname(test.trace), file)).sort()).toEqual([
      join(test.path, "BUILD_ID"), join(test.path, "facility-build.json"),
    ].sort())
    await traceStagingPreflightArtifacts(test.path)
    expect(JSON.parse(await readFile(test.trace, "utf8"))).toEqual(trace)
  })

  it("fails the build when tracing or identity is unavailable instead of publishing an unbound endpoint", async () => {
    const test = await fixture()
    await writeFile(join(test.path, "BUILD_ID"), "different")
    await expect(traceStagingPreflightArtifacts(test.path)).rejects.toThrow("disagree")
    await writeFile(join(test.path, "BUILD_ID"), "fixture")
    await rm(join(test.path, "facility-build.json"))
    await expect(traceStagingPreflightArtifacts(test.path)).rejects.toThrow()
    await writeFile(join(test.path, "facility-build.json"), JSON.stringify({ identity: { buildId: "fixture" } }))
    await writeFile(test.trace, JSON.stringify({ version: 2, files: [] }))
    await expect(traceStagingPreflightArtifacts(test.path)).rejects.toThrow("Unsupported")
  })
})
