// @vitest-environment node
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, describe, expect, it } from "vitest"
import { manifestSchema } from "@/lib/cinematic/manifest-schema.mjs"
import { readCinematicDirectory, sha256, selectedCinematicIdentity } from "@/lib/cinematic/files.mjs"
import { assetResponse } from "@/lib/cinematic/http.mjs"
import { cinematicFixture } from "./fixtures"

const bytes = Buffer.from("0123456789")
const descriptor = { mimeType: "video/mp4", sha256: sha256(bytes) }
const request = (headers: Record<string, string> = {}, method = "GET") => new Request("http://localhost/assets/cinematic/cinematic-v1/desktop.mp4", { headers, method })
const manifest = () => cinematicFixture(bytes)
const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

describe("cinematic range delivery", () => {
  it.each([["bytes=2-5", "2345", "bytes 2-5/10"], ["bytes=7-", "789", "bytes 7-9/10"], ["bytes=-3", "789", "bytes 7-9/10"], ["bytes=0-99", "0123456789", "bytes 0-9/10"]])("serves %s with exact headers", async (range, expected, contentRange) => {
    const response = assetResponse(bytes, descriptor, request({ range }))
    expect(response.status).toBe(206); expect(await response.text()).toBe(expected)
    expect(response.headers.get("content-range")).toBe(contentRange)
    expect(response.headers.get("content-length")).toBe(String(expected.length))
    expect(response.headers.get("content-encoding")).toBeNull()
  })
  it.each(["bytes=10-", "bytes=-0"])("rejects unsatisfiable %s", range => {
    const response = assetResponse(bytes, descriptor, request({ range }))
    expect(response.status).toBe(416); expect(response.headers.get("content-range")).toBe("bytes */10")
  })
  it.each(["bytes=1-2,4-5", "bytes=6-2", "bytes=-", "bytes=9007199254740993-", "garbage"])("ignores unsupported or invalid %s", async range => {
    const response = assetResponse(bytes, descriptor, request({ range }))
    expect(response.status).toBe(200); expect(await response.text()).toBe(bytes.toString())
  })
  it("evaluates conditional requests before a range and ignores Range on HEAD", async () => {
    const etag = `"${descriptor.sha256}"`
    const cached = assetResponse(bytes, descriptor, request({ "if-none-match": `W/${etag}`, range: "bytes=2-3" }))
    expect(cached.status).toBe(304); expect(await cached.text()).toBe("")
    const head = assetResponse(bytes, descriptor, request({ range: "bytes=2-3" }, "HEAD"))
    expect(head.status).toBe(200); expect(head.headers.get("content-length")).toBe("10"); expect(await head.text()).toBe("")
    expect(assetResponse(bytes, descriptor, request({ "if-range": etag, range: "bytes=2-3" })).status).toBe(206)
    expect(assetResponse(bytes, descriptor, request({ "if-range": '"old"', range: "bytes=2-3" })).status).toBe(200)
  })
})

describe("cinematic publication integrity", () => {
  it("rejects live claims, unknown files, incomplete releases, and mismatched timing", () => {
    expect(manifestSchema.safeParse(manifest()).success).toBe(true)
    expect(manifestSchema.safeParse({ ...manifest(), environment: "production" }).success).toBe(false)
    const missing = manifest(); missing.files.pop(); expect(manifestSchema.safeParse(missing).success).toBe(false)
    const timing = manifest(); timing.renditions.mobile.frameCount = 200; expect(manifestSchema.safeParse(timing).success).toBe(false)
    const extra = manifest(); extra.files.push({ ...extra.files[0], file: "../secret" }); expect(manifestSchema.safeParse(extra).success).toBe(false)
  })
  it("checks all artifacts before returning any and rejects symlinks", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cinematic-integrity-")); temporary.push(directory)
    const data = manifest(), raw = Buffer.from(JSON.stringify(data))
    await writeFile(join(directory, "manifest.json"), raw)
    await Promise.all(data.files.map(file => writeFile(join(directory, file.file), bytes)))
    expect((await readCinematicDirectory(directory, "cinematic-v1", sha256(raw))).artifacts.size).toBe(4)
    await writeFile(join(directory, "mobile.mp4"), "corrupt")
    await expect(readCinematicDirectory(directory, "cinematic-v1", sha256(raw))).rejects.toThrow("integrity")
    await rm(join(directory, "mobile.mp4")); await symlink(join(directory, "desktop.mp4"), join(directory, "mobile.mp4"))
    await expect(readCinematicDirectory(directory, "cinematic-v1", sha256(raw))).rejects.toThrow("regular files")
  })
  it("requires source composition, SDR delivery and poster correspondence to its exact encoded file", () => {
    const missing = manifest(); Reflect.deleteProperty(missing.source, "masterIdentity")
    expect(manifestSchema.safeParse(missing).success).toBe(false)
    const camera = manifest(); camera.renditions.mobile.composition.camera.fixed = false
    expect(manifestSchema.safeParse(camera).success).toBe(false)
    const crop = manifest(); crop.renditions.mobile.composition.renderHeight = 900
    expect(manifestSchema.safeParse(crop).success).toBe(false)
    const color = manifest(); color.encoding.color.transfer = "bt709"
    expect(manifestSchema.safeParse(color).success).toBe(false)
    const frame = manifest(); frame.renditions.desktop.posterCorrespondence.encodedVideoSha256 = "d".repeat(64)
    expect(manifestSchema.safeParse(frame).success).toBe(false)
  })
  it("rejects hosted private previews and invalid modes before reading assets", async () => {
    await expect(selectedCinematicIdentity({ env: { CINEMATIC_PREVIEW: "1", VERCEL: "1" } })).rejects.toThrow("cannot be deployed")
    await expect(selectedCinematicIdentity({ env: { CINEMATIC_MODE: "fast" } })).rejects.toThrow("Invalid CINEMATIC_MODE")
    expect(await selectedCinematicIdentity({ env: { CINEMATIC_ASSET_RELEASE: "" } })).toEqual({ selectedRelease: null, mode: "auto", preview: false, manifestSha256: null })
  })
  it("validates the default registered production bytes without a preview switch", async () => {
    expect(await selectedCinematicIdentity({ env: { VERCEL: "1" } })).toEqual({
      selectedRelease: "cinematic-v1", mode: "auto", preview: false,
      manifestSha256: "b19c53acb14dd4a0318696a18de6b706b97061f1887fcbbf4edca23190dd3a3c",
    })
    await expect(selectedCinematicIdentity({ env: { CINEMATIC_ASSET_RELEASE: "cinematic-v99", VERCEL: "1" } })).rejects.toThrow("not available")
  })
})
