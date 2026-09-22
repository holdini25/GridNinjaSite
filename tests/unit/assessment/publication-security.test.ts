// @vitest-environment node
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import registry from "@/content/assessment-publications/registry.json" with { type: "json" }
import { assessmentPublicationResponse, parsePublicationManifest, parsePublicationRegistry, readAssessmentPublication } from "@/lib/assessment/publications"

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return { ...actual, readFile: vi.fn(actual.readFile) }
})
const disk = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises")
const baseline = structuredClone(registry)
const directory = join(process.cwd(), "src/content/assessment-publications/demo-01-b/v1.0.0")
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
afterEach(() => {
  registry.splice(0, registry.length, ...structuredClone(baseline))
  vi.mocked(readFile).mockReset().mockImplementation(disk.readFile)
})

describe("publication approval and fail-closed delivery", () => {
  it("requires a manifest approval and one unambiguous registry state", () => {
    const entry = baseline[0]
    expect(() => parsePublicationRegistry([{ ...entry, manifestSha256: undefined }])).toThrow()
    expect(() => parsePublicationRegistry([entry, { ...entry, status: "withdrawn" }])).toThrow(/Duplicate publication identity/)
    expect(() => parsePublicationRegistry([{ ...entry, publicationId: "../../private" }])).toThrow()
    expect(() => parsePublicationRegistry([{ ...entry, status: "published-maybe" }])).toThrow()
  })

  it("serves no bytes for withdrawn or withheld records, even when files are absent", async () => {
    const entry = registry.find(item => item.publicationId === "demo-01-b")!
    entry.status = "withdrawn"
    vi.mocked(readFile).mockRejectedValue(new Error("must not read private or retired bytes"))
    expect((await assessmentPublicationResponse(entry.publicationId, entry.version, "pdf")).status).toBe(410)
    entry.status = "withheld"
    expect((await assessmentPublicationResponse(entry.publicationId, entry.version, "html")).status).toBe(404)
    expect(readFile).not.toHaveBeenCalled()
  })

  it("blocks edited manifest approval before reading artifacts", async () => {
    vi.mocked(readFile).mockResolvedValue(Buffer.from('{"private":"unapproved content"}'))
    const response = await assessmentPublicationResponse("demo-01-b", "v1.0.0", "html")
    expect(response.status).toBe(503)
    expect(readFile).toHaveBeenCalledTimes(1)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.text()).not.toMatch(/private|manifest|src\//)
  })

  it("blocks artifact corruption rather than substituting another publication", async () => {
    vi.mocked(readFile).mockImplementation(async (...args) => {
      const bytes = await disk.readFile(...args)
      return String(args[0]).endsWith("brief.pdf") ? Buffer.from("%PDF-corrupt") : bytes
    })
    await expect(readAssessmentPublication("demo-01-b", "v1.0.0", "pdf")).rejects.toThrow(/integrity check/)
    expect((await assessmentPublicationResponse("demo-01-b", "v1.0.0", "pdf")).status).toBe(503)
  })

  it("does not leak filesystem failures or private names", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("ENOENT /private/customer-internal/brief.pdf"))
    const response = await assessmentPublicationResponse("demo-01-b", "v1.0.0", "pdf")
    expect(response.status).toBe(503)
    expect(await response.text()).not.toMatch(/ENOENT|customer-internal|private/)
  })

  it("checks the full v1 narrative against its own snapshot even when hashes are approved", async () => {
    const manifest = JSON.parse(await disk.readFile(join(directory, "manifest.json"), "utf8"))
    const narrative = JSON.parse(await disk.readFile(join(directory, "narrative.json"), "utf8"))
    narrative.businessQuestion = "A contradictory business decision"
    const narrativeBytes = Buffer.from(JSON.stringify(narrative))
    const narrativeArtifact = manifest.artifacts.find((artifact: { file: string }) => artifact.file === "narrative.json")
    narrativeArtifact.sha256 = hash(narrativeBytes)
    narrativeArtifact.bytes = narrativeBytes.length
    const manifestBytes = Buffer.from(JSON.stringify(manifest))
    registry.find(item => item.publicationId === "demo-01-b")!.manifestSha256 = hash(manifestBytes)
    vi.mocked(readFile).mockImplementation(async (...args) => {
      if (String(args[0]).endsWith("manifest.json")) return manifestBytes
      if (String(args[0]).endsWith("narrative.json")) return narrativeBytes
      return disk.readFile(...args)
    })
    await expect(readAssessmentPublication("demo-01-b", "v1.0.0", "html")).rejects.toThrow(/narrative and snapshot disagree/)
  })

  it("rejects arbitrary artifact paths and duplicate names", async () => {
    const manifest = JSON.parse(await disk.readFile(join(directory, "manifest.json"), "utf8"))
    manifest.artifacts[0].file = "../../private.json"
    expect(() => parsePublicationManifest(manifest)).toThrow()
    manifest.artifacts[0].file = manifest.artifacts[1].file
    expect(() => parsePublicationManifest(manifest)).toThrow(/unique/)
  })
})
