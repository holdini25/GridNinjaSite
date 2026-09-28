// @vitest-environment node
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import frozenV1 from "@/content/facility-releases/facility-v1/manifest.json"
import { validateSelectedFacility } from "../../../scripts/facility/build-selection.mjs"

const execute = promisify(execFile)
const repository = process.cwd()
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
const release = "facility-v10"
let root: string, directory: string, manifest: typeof frozenV1

async function approve() {
  const bytes = Buffer.from(JSON.stringify(manifest))
  await writeFile(join(directory, "manifest.json"), bytes)
  await writeRegistry([{ release, status: "available", manifestSha256: sha256(bytes) }])
}
async function writeRegistry(entries: unknown[]) {
  await writeFile(join(root, "src/content/facility-releases/registry.json"), JSON.stringify(entries))
}
function environment(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const env = { ...process.env }
  delete env.FACILITY_ASSET_RELEASE
  delete env.FACILITY_3D_MODE
  return { ...env, ...overrides }
}
function run(script: string, env: NodeJS.ProcessEnv) {
  return execute(process.execPath, [resolve(repository, script)], { cwd: root, env, timeout: 10_000 })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "gridninja-build-selection-"))
  directory = join(root, "src/content/facility-releases", release)
  await mkdir(directory, { recursive: true })
  await mkdir(join(root, "src/lib/facility"), { recursive: true })
  await mkdir(join(root, ".next"))
  await writeFile(join(root, "src/lib/facility/releases.ts"), await readFile(join(repository, "src/lib/facility/releases.ts")))
  await writeFile(join(root, ".next/BUILD_ID"), "isolated-build-fixture")
  // Only byte integrity is exercised here; full GLB/image validation remains
  // the existing release validator's separate responsibility.
  manifest = { ...structuredClone(frozenV1), release }
  for (const file of manifest.files) {
    const bytes = Buffer.from(`isolated-${file.file}`)
    file.bytes = bytes.length
    file.sha256 = sha256(bytes)
    await writeFile(join(directory, file.file), bytes)
  }
  await approve()
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

describe("fail-closed facility build selection", () => {
  it("keeps the configured legacy default without an explicit override", async () => {
    const result = await validateSelectedFacility({ root, env: {} })
    expect(result.settings).toEqual({ selectedRelease: release, mode: "auto-adaptive" })
    expect(result.manifest.release).toBe(release)
  })
  it.each(["poster", "manual", "auto-desktop", "auto-adaptive"])("accepts an available release in %s mode", async mode => {
    const result = await validateSelectedFacility({ root, env: { FACILITY_ASSET_RELEASE: release, FACILITY_3D_MODE: mode } })
    expect(result.settings).toEqual({ selectedRelease: release, mode })
  })
  it.each(["", "automatic", "AUTO-ADAPTIVE", "auto-adaptive "])("rejects the explicit invalid mode %j", async mode => {
    await expect(validateSelectedFacility({ root, env: { FACILITY_3D_MODE: mode } })).rejects.toThrow("Invalid FACILITY_3D_MODE")
  })
  it.each(["", "../facility-v10", "facility-v0", "facility-v10 "])("rejects malformed release %j", async selectedRelease => {
    await expect(validateSelectedFacility({ root, env: { FACILITY_ASSET_RELEASE: selectedRelease } })).rejects.toThrow("Invalid selected facility release")
  })
  it("rejects an unregistered selection rather than attesting a missing viewer", async () => {
    await expect(validateSelectedFacility({ root, env: { FACILITY_ASSET_RELEASE: "facility-v99" } })).rejects.toThrow("not registered")
  })
  it.each(["withheld", "withdrawn"])("rejects an explicitly %s selection", async status => {
    await writeRegistry([{ release, status }])
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("not available")
  })
  it("rejects an invalid pending status and duplicate registry identities", async () => {
    await writeRegistry([{ release, status: "pending" }])
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow()
    await approve()
    const entries = JSON.parse(await readFile(join(root, "src/content/facility-releases/registry.json"), "utf8"))
    await writeRegistry([...entries, ...entries])
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("Invalid visual release registry")
  })
  it("rejects absent or changed selected manifests", async () => {
    await unlink(join(directory, "manifest.json"))
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("ENOENT")
    await approve()
    await writeFile(join(directory, "manifest.json"), JSON.stringify({ ...manifest, environment: "changed" }))
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("manifest digest mismatch")
  })
  it("rejects a digest-approved manifest with the wrong release identity", async () => {
    manifest.release = "facility-v9"
    await approve()
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("Manifest release identity mismatch")
  })
  it("rejects missing, extra, and symlinked selected artifacts", async () => {
    const model = join(directory, "facility.glb")
    const bytes = await readFile(model)
    await unlink(model)
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("complete allowlisted")
    await writeFile(model, bytes)
    await writeFile(join(directory, "private.blend"), "private")
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("complete allowlisted")
    await unlink(join(directory, "private.blend"))
    await unlink(model)
    await writeFile(join(root, "outside.glb"), bytes)
    await symlink(join(root, "outside.glb"), model)
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("regular file")
  })
  it("rejects truncated and same-size corrupt asset bytes", async () => {
    const model = join(directory, "facility.glb")
    const bytes = await readFile(model)
    await writeFile(model, bytes.subarray(1))
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("length mismatch")
    bytes[0] ^= 1
    await writeFile(model, bytes)
    await expect(validateSelectedFacility({ root, env: {} })).rejects.toThrow("digest mismatch")
  })
  it("attests a valid selection through the actual qualification identity reader", async () => {
    const moduleUrl = pathToFileURL(join(repository, "scripts/facility/performance-contract.mjs")).href
    const { stdout } = await execute(process.execPath, ["--input-type=module", "-e", `import { currentBuildIdentity } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(await currentBuildIdentity()))`], { cwd: root, env: environment({ FACILITY_3D_MODE: "manual" }), timeout: 10_000 })
    const identity = JSON.parse(stdout)
    expect(identity.buildId).toBe("isolated-build-fixture")
    expect(identity.buildSettings).toMatchObject({ selectedRelease: release, mode: "manual" })
    expect(identity.releases).toEqual([{ release, manifestSha256: sha256(await readFile(join(directory, "manifest.json"))) }])
  })
  it("fails both build lifecycle checks before an unknown release can replace the attestation", async () => {
    const marker = "retained previous attestation"
    await writeFile(join(root, ".next/facility-build.json"), marker)
    const env = environment({ FACILITY_ASSET_RELEASE: "facility-v99" })
    for (const script of ["scripts/facility/validate-release.mjs", "scripts/facility/record-build.mjs"]) {
      await expect(run(script, env)).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("not registered") })
    }
    expect(await readFile(join(root, ".next/facility-build.json"), "utf8")).toBe(marker)
  })
})
