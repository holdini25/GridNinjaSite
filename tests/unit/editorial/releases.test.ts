// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest"
vi.mock("@/lib/editorial/files.mjs", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/editorial/files.mjs")>()
  return { ...original, readEditorialRegistry: vi.fn(), readEditorialDirectory: vi.fn() }
})
import { readEditorialDirectory, readEditorialRegistry, sha256 } from "@/lib/editorial/files.mjs"
import { editorialAssetResponse, getEditorialRelease } from "@/lib/editorial/releases"
import { editorialFixture } from "./fixtures"

const bytes = Buffer.from("illustration"), digest = sha256(bytes), manifest = editorialFixture(bytes)
const request = (method = "GET", headers = {}) => new Request("https://gridninja.ai/assets/editorial/editorial-v1/ai-workload-800.webp", { method, headers })
beforeEach(() => {
  vi.mocked(readEditorialRegistry).mockResolvedValue([{ release: "editorial-v1", status: "available", manifestSha256: digest }])
  vi.mocked(readEditorialDirectory).mockResolvedValue({ manifest, manifestBytes: Buffer.from("{}"), artifacts: new Map(manifest.files.map(file => [file.file, bytes])) } as unknown as Awaited<ReturnType<typeof readEditorialDirectory>>)
})
afterEach(() => vi.resetAllMocks())

it("exposes exact intrinsic dimensions and all three responsive derivatives", async () => {
  const release = await getEditorialRelease()
  expect(release?.images["ai-workload"]).toMatchObject({ width: 800, height: 500, src: "/assets/editorial/editorial-v1/ai-workload-800.webp" })
  expect(release?.images["ai-workload"].srcSet).toContain("1280.webp 1280w")
  expect(release?.images["ai-workload"].variants.map(file => file.width)).toEqual([480, 800, 1280])
})

it("supports GET, HEAD, and conditional responses only after validating the whole bundle", async () => {
  const get = await editorialAssetResponse("editorial-v1", "ai-workload-800.webp", request())
  expect(get.status).toBe(200); expect(await get.text()).toBe("illustration")
  expect(get.headers.get("content-type")).toBe("image/webp")
  const head = await editorialAssetResponse("editorial-v1", "ai-workload-800.webp", request("HEAD"))
  expect(head.status).toBe(200); expect(await head.text()).toBe("")
  expect(head.headers.get("content-length")).toBe(String(bytes.length))
  expect((await editorialAssetResponse("editorial-v1", "ai-workload-800.webp", request("GET", { "If-None-Match": `"${digest}"` }))).status).toBe(304)
  expect(readEditorialDirectory).toHaveBeenCalledTimes(3)
})

it.each([["withheld", 404], ["withdrawn", 410]] as const)("honors %s before HEAD or ETag handling", async (status, code) => {
  vi.mocked(readEditorialRegistry).mockResolvedValue([{ release: "editorial-v1", status, manifestSha256: digest }])
  for (const method of ["GET", "HEAD"]) {
    const response = await editorialAssetResponse("editorial-v1", "ai-workload-800.webp", request(method, { "If-None-Match": `"${digest}"` }))
    expect(response.status).toBe(code); expect(response.headers.get("cache-control")).toBe("no-store")
  }
  expect(readEditorialDirectory).not.toHaveBeenCalled()
  expect(await getEditorialRelease()).toBeNull()
})

it("hides unregistered releases, manifests, paths, and corrupt bundles", async () => {
  expect((await editorialAssetResponse("editorial-v9", "ai-workload-800.webp", request())).status).toBe(404)
  for (const file of ["manifest.json", "../../source.blend"]) expect((await editorialAssetResponse("editorial-v1", file, request())).status).toBe(404)
  expect(readEditorialDirectory).not.toHaveBeenCalled()
  vi.mocked(readEditorialDirectory).mockRejectedValue(new Error("private filesystem path"))
  const response = await editorialAssetResponse("editorial-v1", "ai-workload-800.webp", request("GET", { "If-None-Match": `"${digest}"` }))
  expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.text()).not.toContain("private")
  expect(await getEditorialRelease()).toBeNull()
})
