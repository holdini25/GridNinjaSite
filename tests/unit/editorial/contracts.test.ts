// @vitest-environment node
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, expect, it } from "vitest"
import sharp from "sharp"
import { manifestSchema, registrySchema } from "@/lib/editorial/manifest-schema.mjs"
import { readEditorialDirectory, sha256 } from "@/lib/editorial/files.mjs"
import { validateEditorialDirectory } from "../../../scripts/editorial/validate.mjs"
import { editorialFixture } from "./fixtures"

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function bundle(bytes = Buffer.from("illustration")) {
  const directory = await mkdtemp(join(tmpdir(), "editorial-integrity-")); temporary.push(directory)
  const manifest = editorialFixture(bytes), raw = Buffer.from(JSON.stringify(manifest))
  await writeFile(join(directory, "manifest.json"), raw)
  await Promise.all(manifest.files.map(file => writeFile(join(directory, file.file), bytes)))
  return { directory, manifest, digest: sha256(raw) }
}

it("requires the complete synthetic 16:10 delivery set with bounded bytes and source provenance", () => {
  expect(manifestSchema.safeParse(editorialFixture()).success).toBe(true)
  for (const mutate of [
    (data: ReturnType<typeof editorialFixture>) => { data.environment = "live" },
    (data: ReturnType<typeof editorialFixture>) => { data.files.pop() },
    (data: ReturnType<typeof editorialFixture>) => { data.files[0].file = data.files[1].file },
    (data: ReturnType<typeof editorialFixture>) => { data.files[0].file = "../../master.blend" },
    (data: ReturnType<typeof editorialFixture>) => { data.files[0].height = 480 },
    (data: ReturnType<typeof editorialFixture>) => { data.files[0].bytes = 204801 },
    (data: ReturnType<typeof editorialFixture>) => { data.source.masterSha256 = "unknown" },
    (data: ReturnType<typeof editorialFixture>) => { data.render.samples = 32 },
  ]) { const data = editorialFixture(); mutate(data); expect(manifestSchema.safeParse(data).success).toBe(false) }
  expect(registrySchema.safeParse([{ release: "editorial-v1", status: "available" }]).success).toBe(false)
})

it("checks every member before delivery, including unrelated corruption and extra files", async () => {
  const { directory, digest } = await bundle()
  expect((await readEditorialDirectory(directory, "editorial-v1", digest)).artifacts.size).toBe(9)
  await expect(readEditorialDirectory(directory, "editorial-v1", "0".repeat(64))).rejects.toThrow("manifest integrity")
  await writeFile(join(directory, "platform-systems-1280.webp"), "corrupt")
  await expect(readEditorialDirectory(directory, "editorial-v1", digest)).rejects.toThrow("asset integrity")
  await writeFile(join(directory, "private.blend"), "secret")
  await expect(readEditorialDirectory(directory, "editorial-v1", digest)).rejects.toThrow("file set")
})

it("rejects symlinked members even when their content hash matches", async () => {
  const { directory, digest } = await bundle()
  await rm(join(directory, "ai-workload-480.webp"))
  await symlink(join(directory, "ai-workload-800.webp"), join(directory, "ai-workload-480.webp"))
  await expect(readEditorialDirectory(directory, "editorial-v1", digest)).rejects.toThrow("regular files")
})

it("validates actual WebP dimensions, not just declared width/height", async () => {
  const bytes = await sharp({ create: { width: 8, height: 5, channels: 3, background: "#080808" } }).webp().toBuffer()
  const { directory, digest } = await bundle(bytes)
  await expect(validateEditorialDirectory(directory, "editorial-v1", digest)).rejects.toThrow("encoded dimensions")
})
