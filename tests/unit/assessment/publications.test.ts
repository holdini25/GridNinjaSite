// @vitest-environment node
import { describe, expect, it } from "vitest"
import { readAssessmentPublication, assessmentPublicationResponse } from "@/lib/assessment/publications"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { renderAssessmentBrief, assessmentNarrative } from "@/lib/assessment/brief-template"
import { GET as legacyDownload } from "@/app/downloads/sample-proof-pack/route"

describe("frozen assessment publications", () => {
  for (const [scenario, record] of Object.entries(assessmentFixtures)) {
    it(`binds ${scenario.toUpperCase()} snapshot, frozen HTML, PDF and narrative identity`, async () => {
      const version = `v${record.publication.version}`
      const json = await readAssessmentPublication(record.publication.id, version, "json")
      expect(json.status).toBe(200)
      if (json.status !== 200) throw new Error("Missing publication")
      expect(JSON.parse(json.bytes.toString())).toEqual(record)
      const html = await readAssessmentPublication(record.publication.id, version, "html")
      if (html.status !== 200) throw new Error("Missing HTML")
      expect(html.bytes.toString()).toBe(renderAssessmentBrief(record))
      expect(html.bytes.toString()).toContain(assessmentNarrative(record).title)
      const pdf = await readAssessmentPublication(record.publication.id, version, "pdf")
      if (pdf.status !== 200) throw new Error("Missing PDF")
      expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-")
      expect(pdf.manifest.artifacts).toHaveLength(4)
    })
  }
  it("escapes authored narrative metadata in the HTML publication", () => {
    const record = structuredClone(assessmentFixtures.b)
    record.publication.narrativeVersion = '<script>unapproved()</script>'
    const html = renderAssessmentBrief(record)
    expect(html).toContain("&lt;script&gt;unapproved()&lt;/script&gt;")
    expect(html).not.toContain("<script>unapproved()</script>")
  })
  it("fails unknown versions, candidates, formats and path traversal without substituting the default", async () => {
    for (const args of [["demo-01-b", "v999", "pdf"], ["candidate", "v1.0.0", "json"], ["demo-01-b", "v1.0.0", "manifest"], ["../..", "v1.0.0", "html"]]) {
      expect((await readAssessmentPublication(...args as [string, string, string])).status).toBe(404)
    }
  })
  it("returns selected filenames, MIME types, canonical and restrictive headers", async () => {
    const response = await assessmentPublicationResponse("demo-01-d", "v1.0.0", "json", true)
    expect(response.headers.get("Content-Type")).toContain("application/json")
    expect(response.headers.get("Content-Disposition")).toContain("demo-01-d-v1.0.0.json")
    expect(response.headers.get("Link")).toContain("/demo-01-d/v1.0.0")
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex")
    expect((await response.json()).modeledEligible.status).toBe("unknown")
  })
  it("keeps the legacy filename and MIME while pointing to one frozen default", async () => {
    const response = legacyDownload()
    expect(response.headers.get("Content-Type")).toContain("text/markdown")
    expect(response.headers.get("Content-Disposition")).toContain("gridninja-sample-proof-pack.md")
    const body = await response.text()
    expect(body).toContain("/demo-01-b/v1.0.0/pdf")
    expect(body).not.toMatch(/5\.8|18\.4|accepted MW/i)
  })
})
