// @vitest-environment node
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, expect, it } from "vitest"
import { readCivicDirectory, sha256 } from "@/lib/civic/files.mjs"
import { manifestSchema, registrySchema } from "@/lib/civic/manifest-schema.mjs"
import { civicFixture } from "./fixtures"

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
