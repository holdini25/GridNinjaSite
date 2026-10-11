// @vitest-environment node
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, expect, it } from "vitest"
import sharp from "sharp"
import { sha256 } from "@/lib/editorial/files.mjs"

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function fixture(referenceThreads = 4) {
  const parent = join(process.cwd(), "build/cinematic/editorial")
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(join(parent, "package-contract-")); temporary.push(root)
  const final = join(root, "final"), reference = join(root, "reference"), output = join(root, "release")
  const bytes = await sharp({ create: { width: 8, height: 5, channels: 3, background: "#080808" } }).png().toBuffer()
  for (const [directory, samples, threads, mode] of [[final, 128, 4, "final"], [reference, 256, referenceThreads, "reference"]] as const) {
    const frames = ["ai-workload", "colocation-hall", "platform-systems"].map(subject => ({ subject, camera: {}, files: ["0000.png", "0000.exr"].map(file => ({ file, sha256: sha256(bytes) })) }))
    await mkdir(directory)
    await writeFile(join(directory, `${mode}-C-frontal-all-report.json`), JSON.stringify({ status: "complete", samples, threads, adaptiveThreshold: .005, frame: 0, motionBlur: false, settings: {}, frames, source: { device: { requested: "metal", cyclesDevice: "GPU" } } }))
    for (const frame of frames) {
      const path = join(directory, "C-frontal", frame.subject); await mkdir(path, { recursive: true })
      for (const file of frame.files) await writeFile(join(path, file.file), bytes)
    }
  }
  return () => execFileSync(process.execPath, ["scripts/editorial/package.mjs", final, reference, "C-frontal", output], { cwd: process.cwd(), stdio: "pipe" })
}

it("rejects a reference with mismatched runtime thread settings", async () => {
  const run = await fixture(6)
  expect(run).toThrow("Reference threads must match the final")
})

it("rejects byte-compatible tiny inputs rather than stretching them into reviewed masters", async () => {
  const run = await fixture()
  expect(run).toThrow("Reviewed 1600x1000 RGB PNG master required")
})
