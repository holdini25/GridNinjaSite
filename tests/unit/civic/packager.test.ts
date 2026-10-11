// @vitest-environment node
import { mkdir, mkdtemp, rm, readFile, writeFile, access } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, expect, it } from "vitest"
import sharp from "sharp"
import { packageGeneratedCivic } from "../../../scripts/civic/package.mjs"

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function fixture(model = "not reported by tool") {
  const root = await mkdtemp(join(tmpdir(), "gridninja-generated-civic-")); temporary.push(root)
  const source = join(root, "assets-source/civic/generated-v1")
  await mkdir(source, { recursive: true })
  const bytes = await sharp({ create: { width: 16, height: 9, channels: 3, background: "#080808" } }).png().toBuffer()
  for (const composition of ["landscape", "portrait"]) await writeFile(join(source, `${composition}.png`), bytes)
  await writeFile(join(root, "assets-source/civic/generation-record.json"), JSON.stringify({
    schema: "gridninja.civic-generation.v1", tool: "image_gen.imagegen", mode: "built-in", model, environment: "synthetic",
    images: ["landscape", "portrait"].map(composition => ({ composition, master: `assets-source/civic/generated-v1/${composition}.png`,
      originalToolOutput: `/private/generated/${composition}.png`, arguments: { prompt: `Synthetic ${composition} fixture`, transparent_background: false,
        ...(composition === "portrait" ? { referenced_image_paths: ["/private/generated/landscape.png"] } : {}) } })),
  }))
  return { root, output: "build/civic/fixture-package" }
}

it("rejects invented model attribution instead of emitting a misleading provenance record", async () => {
  const options = await fixture("invented-model")
  await expect(packageGeneratedCivic(options)).rejects.toThrow("Truthful built-in image-generation record required")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it("rejects tiny source inputs before creating output rather than upscaling them", async () => {
  const options = await fixture()
  await expect(packageGeneratedCivic(options)).rejects.toThrow("cannot be upscaled")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})

it("rejects a portrait whose recorded edit reference is disconnected from the landscape", async () => {
  const options = await fixture(), path = join(options.root, "assets-source/civic/generation-record.json")
  const record = JSON.parse(await readFile(path, "utf8"))
  record.images[1].arguments.referenced_image_paths = ["/private/generated/unrelated.png"]
  await writeFile(path, JSON.stringify(record))
  await expect(packageGeneratedCivic(options)).rejects.toThrow("Portrait reference must exactly match")
  await expect(access(join(options.root, options.output))).rejects.toThrow()
})
