import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { isPublicationPromotable } from "@/seo/publication-eligibility"
import { getRelatedSeoRoutes, getSeoRoute } from "@/seo/route-manifest"
import { seoResources } from "@/content/seo-resources"
import { PublishedAssessmentLibrary } from "@/components/assessment/published-assessment-library"

describe("truthful publication discovery", () => {
  it("promotes approved resources only", () => {
    expect(isPublicationPromotable("published")).toBe(true)
    expect(isPublicationPromotable("available")).toBe(true)
    for (const status of ["gated", "withheld", "withdrawn", undefined] as const) expect(isPublicationPromotable(status)).toBe(false)
  })
  it("filters pending artifacts without hiding published explanatory destinations", () => {
    const related = getRelatedSeoRoutes("/platform/dispatch-envelope").map(route => route.path)
    expect(related).toContain("/platform")
    expect(related).toContain("/proof")
    expect(related).not.toContain("/methodology/claims-and-evidence")
    expect(getSeoRoute("/methodology/claims-and-evidence")).toBeDefined()
    expect(getRelatedSeoRoutes("/proof").map(route => route.path)).toContain("/proof/proof-pack")
    const pending = new Set(seoResources.filter(resource => resource.publicationStatus === "gated").map(resource => resource.path))
    expect(getRelatedSeoRoutes("/assessment").some(route => pending.has(route.path as typeof seoResources[number]["path"]))).toBe(false)
  })
  it("leads with all four exact, verified publication formats", async () => {
    const html = renderToStaticMarkup(await PublishedAssessmentLibrary())
    for (const scenario of ["a", "b", "c", "d"]) {
      expect(html).toContain(`/evidence/assessments/demo-01-${scenario}/v1.0.0`)
      expect(html).toContain(`/downloads/assessment/demo-01-${scenario}/v1.0.0/pdf`)
      expect(html).toContain(`/downloads/assessment/demo-01-${scenario}/v1.0.0/json`)
    }
    expect(html).toContain("Synthetic")
    expect(html).not.toContain("/evidence/releases/")
  })
})
