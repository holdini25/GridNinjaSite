// @vitest-environment node
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, expect, it } from "vitest"
import { readCivicDirectory, sha256 } from "@/lib/civic/files.mjs"
import { manifestSchema, registrySchema } from "@/lib/civic/manifest-schema.mjs"
import { civicFixture, civicV2Fixture } from "./fixtures"
import { validateCivic } from "../../../scripts/civic/validate.mjs"

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "gridninja-civic-contract-")); temporary.push(directory)
  const bytes = Buffer.from("civic illustration"), manifest = civicFixture(bytes), raw = Buffer.from(JSON.stringify(manifest))
  await writeFile(join(directory, "manifest.json"), raw)
  for (const file of manifest.files) await writeFile(join(directory, file.file), bytes)
  return { directory, manifest, digest: sha256(raw) }
}

it("requires six exact composition-specific sizes, identity and byte ceilings", () => {
  expect(manifestSchema.safeParse(civicFixture()).success).toBe(true)
  for (const mutate of [
    (value: ReturnType<typeof civicFixture>) => { value.files[0].height += 1 },
    (value: ReturnType<typeof civicFixture>) => { value.files[0].composition = "portrait" },
    (value: ReturnType<typeof civicFixture>) => { value.files[0].bytes = 204801 },
    (value: ReturnType<typeof civicFixture>) => { value.files[0] = value.files[1] },
  ]) { const value = civicFixture(); mutate(value); expect(manifestSchema.safeParse(value).success).toBe(false) }
  expect(registrySchema.safeParse([{ release: "civic-v1", status: "available" }]).success).toBe(false)
  expect(registrySchema.safeParse([{ release: "civic-v1", status: "withheld" }]).success).toBe(true)
  expect(manifestSchema.safeParse({ ...civicFixture(), render: { device: "METAL", samples: 128 } }).success).toBe(false)
  expect(manifestSchema.safeParse({ ...civicFixture(), source: { ...civicFixture().source, blenderVersion: "5.2.2" } }).success).toBe(false)
})

it("verifies every byte and rejects an extra source file before exposing a member", async () => {
  const { directory, manifest, digest } = await fixture()
  expect((await readCivicDirectory(directory, "civic-v1", digest)).artifacts.size).toBe(6)
  await expect(readCivicDirectory(directory, "civic-v1", "0".repeat(64))).rejects.toThrow("manifest integrity")
  await writeFile(join(directory, manifest.files[5].file), "corrupt")
  await expect(readCivicDirectory(directory, "civic-v1", digest)).rejects.toThrow("asset integrity")
  await writeFile(join(directory, "source.blend"), "private")
  await expect(readCivicDirectory(directory, "civic-v1", digest)).rejects.toThrow("Unexpected civic file set")
})

it("rejects symlinked release members even when their bytes match", async () => {
  const { directory, manifest, digest } = await fixture()
  const member = join(directory, manifest.files[0].file)
  await rm(member); await symlink(manifest.files[1].file, member)
  await expect(readCivicDirectory(directory, "civic-v1", digest)).rejects.toThrow("regular files")
})

it("keeps v1 immutable while validating v2 codec pairs, native resolution and byte ceilings", () => {
  expect(manifestSchema.safeParse(civicV2Fixture()).success).toBe(true)
  const ceiling = civicV2Fixture()
  for (const file of ceiling.files) file.bytes = 204800
  expect(manifestSchema.safeParse(ceiling).success).toBe(true)
  for (const mutate of [
    (value: ReturnType<typeof civicV2Fixture>) => { value.files.pop() },
    (value: ReturnType<typeof civicV2Fixture>) => { value.files[0] = value.files[1] },
    (value: ReturnType<typeof civicV2Fixture>) => { value.files[0].mimeType = "image/webp" },
    (value: ReturnType<typeof civicV2Fixture>) => { value.files[0].bytes = 204801 },
    (value: ReturnType<typeof civicV2Fixture>) => { value.files.find(file => file.width === 1600)!.bytes = 204801 },
    (value: ReturnType<typeof civicV2Fixture>) => { value.compositions.landscape.width = 1536; value.compositions.landscape.height = 864 },
    (value: ReturnType<typeof civicV2Fixture>) => { value.source.native.device = "CPU" },
  ]) { const value = civicV2Fixture(); mutate(value); expect(manifestSchema.safeParse(value).success).toBe(false) }
  const legacy = civicFixture()
  legacy.files[0].bytes = 204801
  expect(manifestSchema.safeParse(legacy).success).toBe(false)
})

it("requires optional native-resolution derivatives to include both codecs", () => {
  const value = civicV2Fixture()
  const avif = value.files.find(file => file.composition === "portrait" && file.mimeType === "image/avif")!
  const webp = value.files.find(file => file.composition === "portrait" && file.mimeType === "image/webp")!
  value.files.push({ ...avif, file: "portrait-1360.avif", width: 1360, height: 1632 })
  expect(manifestSchema.safeParse(value).success).toBe(false)
  value.files.push({ ...webp, file: "portrait-1360.webp", width: 1360, height: 1632 })
  expect(manifestSchema.safeParse(value).success).toBe(true)
  value.compositions.portrait = { ...value.compositions.portrait, width: 800, height: 960 }
  expect(manifestSchema.safeParse(value).success).toBe(false)
})

it("validates public paths relative to the checkout while still rejecting civic registry bypasses", async () => {
  const parent = await mkdtemp(join(tmpdir(), "gridninja-civic-build-")); temporary.push(parent)
  const root = join(parent, "civic", "baseline-source")
  const registry = join(root, "src/content/civic-releases/registry.json")
  const trace = join(root, ".next/server/app/assets/civic/[release]/[file]/route.js.nft.json")
  await mkdir(dirname(registry), { recursive: true })
  await mkdir(dirname(trace), { recursive: true })
  await mkdir(join(root, "public/brand"), { recursive: true })
  await writeFile(registry, "[]")
  await writeFile(trace, JSON.stringify({ files: [relative(dirname(trace), registry)] }))
  await writeFile(join(root, "public/brand/icon.png"), "ordinary public asset")
  await expect(validateCivic({ root, build: true })).resolves.toMatchObject({ availableReleases: [] })

  for (const path of ["civic/source.png", "assets/civic/source.png", "images/landscape-1600.avif", "portrait-800.webp"]) {
    const file = join(root, "public", path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, "unregistered civic artwork")
    await expect(validateCivic({ root, build: true })).rejects.toThrow("Civic registry cannot be bypassed through public/")
    await rm(file)
  }
  await expect(validateCivic({ root, build: true })).resolves.toMatchObject({ availableReleases: [] })
})
