// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"
vi.mock("@/lib/cinematic/files.mjs", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/cinematic/files.mjs")>()
  return { ...original, readCinematicRegistry: vi.fn(), readCinematicDirectory: vi.fn() }
})
import { readCinematicDirectory, readCinematicRegistry } from "@/lib/cinematic/files.mjs"
import { cinematicAssetResponse, getCinematicRelease } from "@/lib/cinematic/releases"

const bytes = Buffer.from("movie bytes")
const digest = createHash("sha256").update(bytes).digest("hex")
const files = ["desktop.mp4", "mobile.mp4", "poster-desktop.webp", "poster-mobile.webp"].map(file => ({ file, bytes: bytes.length, sha256: digest, mimeType: file.endsWith("mp4") ? "video/mp4" : "image/webp" }))
const manifest = { release: "cinematic-v1", environment: "synthetic", files, renditions: Object.fromEntries(["desktop", "mobile"].map(kind => [kind, { width: 1280, height: 800, durationSeconds: 10, fps: 30, video: `${kind}.mp4`, poster: `poster-${kind}.webp` }])) }
const request = (origin = "http://localhost") => new Request(`${origin}/assets/cinematic/cinematic-v1/desktop.mp4`)
beforeEach(() => {
  vi.mocked(readCinematicRegistry).mockResolvedValue([])
  vi.mocked(readCinematicDirectory).mockResolvedValue({ manifest, manifestBytes: Buffer.from("{}"), artifacts: new Map(files.map(file => [file.file, bytes])) } as unknown as Awaited<ReturnType<typeof readCinematicDirectory>>)
})
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs() })

it("supports an explicit static fallback without serving an unregistered release", async () => {
  vi.stubEnv("CINEMATIC_ASSET_RELEASE", "")
  expect(await getCinematicRelease()).toBeNull()
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", request())).status).toBe(404)
  expect(readCinematicDirectory).not.toHaveBeenCalled()
})
it("selects the registered production default without a preview switch", async () => {
  vi.stubEnv("CINEMATIC_ASSET_RELEASE", undefined)
  vi.stubEnv("CINEMATIC_PREVIEW", undefined)
  vi.stubEnv("VERCEL", "1")
  vi.mocked(readCinematicRegistry).mockResolvedValue([{ release: "cinematic-v1", status: "available", manifestSha256: digest }])
  expect((await getCinematicRelease())?.release).toBe("cinematic-v1")
  expect(readCinematicDirectory).toHaveBeenCalledWith(expect.stringContaining("src/content/cinematic-releases/cinematic-v1"), "cinematic-v1", digest)
})
it.each([["withheld", 404], ["withdrawn", 410]] as const)("honors %s before reading media", async (status, code) => {
  vi.mocked(readCinematicRegistry).mockResolvedValue([{ release: "cinematic-v1", status, manifestSha256: digest }])
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", request())).status).toBe(code)
  const cachedRange = new Request(request(), { headers: { "If-None-Match": `"${digest}"`, Range: "bytes=0-1" } })
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", cachedRange)).status).toBe(code)
  expect(readCinematicDirectory).not.toHaveBeenCalled()
  vi.stubEnv("CINEMATIC_PREVIEW", "1"); vi.stubEnv("CINEMATIC_ASSET_RELEASE", "cinematic-v1"); vi.stubEnv("VERCEL", "")
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", cachedRange)).status).toBe(code)
  expect(await getCinematicRelease()).toBeNull()
  expect(readCinematicDirectory).not.toHaveBeenCalled()
})
it("serves an approved registered member and keeps corruption generic", async () => {
  vi.mocked(readCinematicRegistry).mockResolvedValue([{ release: "cinematic-v1", status: "available", manifestSha256: digest }])
  const response = await cinematicAssetResponse("cinematic-v1", "desktop.mp4", request())
  expect(response.status).toBe(200); expect(await response.text()).toBe("movie bytes")
  vi.mocked(readCinematicDirectory).mockRejectedValue(new Error("Secret filesystem path"))
  const unavailable = await cinematicAssetResponse("cinematic-v1", "desktop.mp4", request())
  expect(unavailable.status).toBe(503); expect(await unavailable.text()).not.toContain("Secret")
  expect(unavailable.headers.get("cache-control")).toBe("no-store")
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", new Request(request(), { headers: { "If-None-Match": `"${digest}"`, Range: "bytes=0-1" } }))).status).toBe(503)
  vi.stubEnv("CINEMATIC_ASSET_RELEASE", "cinematic-v1")
  expect(await getCinematicRelease()).toBeNull()
})
it("keeps immutable registered bytes authoritative when local preview is enabled", async () => {
  vi.stubEnv("CINEMATIC_PREVIEW", "1"); vi.stubEnv("CINEMATIC_ASSET_RELEASE", "cinematic-v1"); vi.stubEnv("VERCEL", "")
  vi.mocked(readCinematicRegistry).mockResolvedValue([{ release: "cinematic-v1", status: "available", manifestSha256: digest }])
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", request())).status).toBe(200)
  expect(readCinematicDirectory).toHaveBeenCalledWith(expect.stringContaining("src/content/cinematic-releases/cinematic-v1"), "cinematic-v1", digest)
})
it("limits private preview to the explicit release on loopback, never Vercel", async () => {
  vi.stubEnv("CINEMATIC_PREVIEW", "1"); vi.stubEnv("CINEMATIC_ASSET_RELEASE", "cinematic-v1"); vi.stubEnv("VERCEL", "")
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", request())).status).toBe(200)
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", request("https://gridninja.ai"))).status).toBe(404)
  expect((await cinematicAssetResponse("cinematic-v2", "desktop.mp4", request())).status).toBe(404)
  vi.stubEnv("VERCEL", "1")
  expect((await cinematicAssetResponse("cinematic-v1", "desktop.mp4", request())).status).toBe(404)
})
it("does not expose unknown filenames or source paths", async () => {
  expect((await cinematicAssetResponse("cinematic-v1", "manifest.json", request())).status).toBe(404)
  expect((await cinematicAssetResponse("cinematic-v1", "../../private.blend", request())).status).toBe(404)
  expect(readCinematicDirectory).not.toHaveBeenCalled()
})
