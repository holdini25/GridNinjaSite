// @vitest-environment node
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { preparePrivateCandidate } from "../../../scripts/qa/prepare-private-candidate.mjs"
import { containedPath, privateCandidateEnvironment, privateDigest, privateSourceInventory, verifyPrivateCandidate } from "../../../scripts/qa/private-candidate-contract.mjs"
import { productionQualificationIssues } from "../../../scripts/qa/release-preflight-contract.mjs"
import { cinematicFixture } from "./fixtures"

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const write = async (root: string, path: string, content: string | Buffer) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content) }
const bytes = Buffer.from("test-media")

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "gridninja-private-test-")); temporary.push(root)
  const source = join(root, "source"), out = join(root, "candidate")
  await mkdir(source)
  await write(source, "src/content/facility-releases/registry.json", "[]\n")
  const manifest = JSON.parse(await readFile("src/content/facility-releases/facility-v1/manifest.json", "utf8"))
  manifest.release = "facility-v99"
  manifest.files = manifest.files.map((file: { file: string }) => ({ file: file.file, bytes: bytes.length, sha256: privateDigest(bytes) }))
  const facilityBase = "build/facility/facility-v99/release"
  await write(source, `${facilityBase}/manifest.json`, JSON.stringify(manifest))
  for (const file of manifest.files) await write(source, `${facilityBase}/${file.file}`, bytes)
  const movie = cinematicFixture(bytes, "cinematic-v99", manifest.source.masterSha256)
  const movieBase = "build/cinematic/cinematic-v99/release"
  await write(source, `${movieBase}/manifest.json`, JSON.stringify(movie))
  for (const file of movie.files) await write(source, `${movieBase}/${file.file}`, bytes)
  await write(source, "package-lock.json", '{"lockfileVersion":3}')
  await write(source, "node_modules/.package-lock.json", '{"lockfileVersion":3}')
  await write(source, "src/page.tsx", "export default 1")
  await write(source, "scripts/cinematic/__pycache__/ignored.pyc", "generated")
  await write(source, ".env.local", "FAKE_TEST_SECRET=not-copied")
  return { root, source, out, facility: "facility-v99", cinematic: "cinematic-v99", env: {} }
}

describe("isolated private candidate preparation", () => {
  it("copies a complete hashed snapshot, scopes registry derivation there and refuses changed evidence", async () => {
    const input = await fixture(), before = await privateSourceInventory(input.source)
    const result = await preparePrivateCandidate(input)
    expect(result).toMatchObject({ privateOnly: true, releaseApproval: false })
    expect(await privateSourceInventory(input.source)).toEqual(before)
    expect(await readFile(join(input.source, "src/content/facility-releases/registry.json"), "utf8")).toBe("[]\n")
    expect(await readdir(input.out)).not.toContain(".env.local")
    expect((await privateSourceInventory(input.out)).some(file => file.path.includes("__pycache__"))).toBe(false)
    const marker = await verifyPrivateCandidate(input.out)
    expect(marker.facility.release).toBe("facility-v99")
    await expect(preparePrivateCandidate(input)).rejects.toThrow("already exists")
    await write(input.out, "src/page.tsx", "changed after freeze")
    await expect(verifyPrivateCandidate(input.out)).rejects.toThrow("source changed")
  })
  it("rejects source symlinks, in-checkout destinations and hosted environments", async () => {
    const input = await fixture()
    await symlink(join(input.source, "package-lock.json"), join(input.source, "src", "escape"))
    await expect(privateSourceInventory(input.source)).rejects.toThrow("symlink")
    await expect(preparePrivateCandidate({ ...input, out: join(input.source, "nested") })).rejects.toThrow("outside")
    await expect(preparePrivateCandidate({ ...input, env: { VERCEL: "1" } })).rejects.toThrow("hosted")
    expect(() => containedPath(input.out, "../../outside")).toThrow("escapes")
  })
  it("strips operational credentials and cannot pass the public production gate", () => {
    const marker = { facility: { release: "facility-v99" }, cinematic: { release: "cinematic-v99" } }
    const env = privateCandidateEnvironment(marker, { PATH: "/bin", DATABASE_URL: "test-only", RESEND_API_KEY: "test-only", FACILITY_PREVIEW: "1", GRIDNINJA_HTTPS: "1" })
    expect(env).toMatchObject({ NODE_ENV: "production", FACILITY_ASSET_RELEASE: "facility-v99", CINEMATIC_PREVIEW: "1" })
    expect(env).not.toHaveProperty("DATABASE_URL"); expect(env).not.toHaveProperty("RESEND_API_KEY"); expect(env).not.toHaveProperty("FACILITY_PREVIEW"); expect(env).not.toHaveProperty("GRIDNINJA_HTTPS")
    const build = privateCandidateEnvironment(marker, { NODE_ENV: "production", PATH: "/bin", DATABASE_URL: "test-only" }, "build")
    expect(build).not.toHaveProperty("NODE_ENV")
    expect(build).not.toHaveProperty("DATABASE_URL")
    expect(build).toMatchObject({ GRIDNINJA_CSP_MODE: "enforce", CINEMATIC_PREVIEW: "1", FACILITY_ASSET_RELEASE: "facility-v99" })
    expect(productionQualificationIssues({ observability: true, httpsPolicy: true, verification: "live", csp: "enforce", privateCandidate: { privateOnly: true } })).toEqual(["private-candidate-is-not-release-approved"])
  })
  it("refuses to mix independently sourced facility and cinematic masters before writing a snapshot", async () => {
    const input = await fixture(), path = "build/cinematic/cinematic-v99/release/manifest.json"
    const movie = JSON.parse(await readFile(join(input.source, path), "utf8"))
    movie.source.masterSha256 = "f".repeat(64)
    await write(input.source, path, JSON.stringify(movie))
    await expect(preparePrivateCandidate(input)).rejects.toThrow("same editable master")
    expect(await readdir(input.root)).not.toContain("candidate")
  })
})
