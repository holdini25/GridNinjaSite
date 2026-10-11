// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest"
vi.mock("@/lib/civic/files.mjs", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/civic/files.mjs")>()
  return { ...original, readCivicRegistry: vi.fn(), readCivicDirectory: vi.fn() }
})
import { readCivicDirectory, readCivicRegistry, sha256 } from "@/lib/civic/files.mjs"
import { civicAssetResponse, getCivicRelease } from "@/lib/civic/releases"
import { civicFixture } from "./fixtures"

const bytes = Buffer.from("civic illustration"), digest = sha256(bytes), manifest = civicFixture(bytes)
const request = (method = "GET", headers = {}) => new Request("https://gridninja.ai/assets/civic/civic-v1/landscape-960.webp", { method, headers })
beforeEach(() => {
  vi.mocked(readCivicRegistry).mockResolvedValue([{ release: "civic-v1", status: "available", manifestSha256: digest }])
  vi.mocked(readCivicDirectory).mockResolvedValue({ manifest, manifestBytes: Buffer.from("{}"), artifacts: new Map(manifest.files.map(file => [file.file, bytes])) } as unknown as Awaited<ReturnType<typeof readCivicDirectory>>)
})
afterEach(() => vi.resetAllMocks())

it("exposes distinct responsive compositions and their correct intrinsic dimensions", async () => {
  const release = await getCivicRelease()
  expect(release?.images.landscape).toMatchObject({ width: 960, height: 540, src: "/assets/civic/civic-v1/landscape-960.webp" })
  expect(release?.images.portrait).toMatchObject({ width: 640, height: 768, src: "/assets/civic/civic-v1/portrait-640.webp" })
  expect(release?.images.landscape.variants.map(file => file.width)).toEqual([640, 960, 1280])
  expect(release?.images.portrait.variants.map(file => file.width)).toEqual([400, 640, 800])
})

it("validates the whole bundle before GET, HEAD, conditional or range delivery", async () => {
  const get = await civicAssetResponse("civic-v1", "landscape-960.webp", request())
  expect(get.status).toBe(200); expect(await get.text()).toBe("civic illustration")
  expect(get.headers.get("content-type")).toBe("image/webp")
  expect(get.headers.get("x-robots-tag")).toBe("noindex")
  const head = await civicAssetResponse("civic-v1", "landscape-960.webp", request("HEAD"))
  expect(head.status).toBe(200); expect(await head.text()).toBe("")
  expect(head.headers.get("content-length")).toBe(String(bytes.length))
  expect((await civicAssetResponse("civic-v1", "landscape-960.webp", request("GET", { "If-None-Match": `"${digest}"` }))).status).toBe(304)
  const range = await civicAssetResponse("civic-v1", "landscape-960.webp", request("GET", { Range: "bytes=0-4" }))
  expect(range.status).toBe(206); expect(await range.text()).toBe("civic")
  expect(readCivicDirectory).toHaveBeenCalledTimes(4)
})

it.each([["withheld", 404], ["withdrawn", 410]] as const)("honors %s before HEAD or ETag handling", async (status, code) => {
  vi.mocked(readCivicRegistry).mockResolvedValue([{ release: "civic-v1", status, manifestSha256: digest }])
  for (const method of ["GET", "HEAD"]) {
    const response = await civicAssetResponse("civic-v1", "landscape-960.webp", request(method, { "If-None-Match": `"${digest}"` }))
    expect(response.status).toBe(code); expect(response.headers.get("cache-control")).toBe("no-store")
  }
  expect(readCivicDirectory).not.toHaveBeenCalled(); expect(await getCivicRelease()).toBeNull()
})

it("hides unregistered releases, private paths, and corrupt bundles without leaking errors", async () => {
  expect((await civicAssetResponse("civic-v9", "landscape-960.webp", request())).status).toBe(404)
  for (const file of ["manifest.json", "../../source.blend", "portrait-1280.webp"]) expect((await civicAssetResponse("civic-v1", file, request())).status).toBe(404)
  expect(readCivicDirectory).not.toHaveBeenCalled()
  vi.mocked(readCivicDirectory).mockRejectedValue(new Error("private filesystem path"))
  const response = await civicAssetResponse("civic-v1", "landscape-960.webp", request("HEAD", { "If-None-Match": `"${digest}"` }))
  expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.text()).toBe(""); expect(await getCivicRelease()).toBeNull()
})
