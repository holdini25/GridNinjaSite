import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { AssessmentPreview } from "@/components/assessment/assessment-preview"
import DemoPage from "@/app/(marketing)/demo/page"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"
import { readFacilityRelease } from "@/lib/facility/releases"
import type { FacilityMode, FacilityVisualRelease } from "@/types/facility"

let release: FacilityVisualRelease
beforeAll(async () => {
  const result = await readFacilityRelease("facility-v10")
  if (result.status !== 200) throw new Error("Immutable release fixture unavailable")
  release = result.release
})
afterEach(() => vi.unstubAllEnvs())
const parse = (markup: string) => new DOMParser().parseFromString(markup, "text/html")

describe("truthful server preview activation", () => {
  it.each([undefined, "poster", "manual", "auto-desktop", "auto-adaptive"] as const)("matches the invitation to %s mode before hydration", mode => {
    const selection = resolveAssessmentSelection({})
    if (selection.status !== "ready") throw new Error("Missing assessment fixture")
    const document = parse(renderToStaticMarkup(<AssessmentPreview selection={selection} record={assessmentFixtures.b} release={release} mode={mode} />))
    const link = document.querySelector<HTMLAnchorElement>("[data-assessment-preview-activate]")!
    expect(link.textContent).toBe(mode === "poster" ? "Inspect this example" : "Explore the facility in 3D")
    expect(link.getAttribute("href")).toBe("/demo?scenario=b&version=1.0.0&perspective=business&interactive=1&activate=1#decision-brief")
    expect(document.querySelector(".facility-stage img")?.getAttribute("src")).toBe(release.posters.desktop.url)
    expect(document.querySelector(`a[href="${release.posters.desktop.url}"]`)?.textContent).toBe("View still illustration")
    expect(document.querySelector("canvas")).toBeNull()
  })

  it.each(["poster", "auto-adaptive"] satisfies FacilityMode[])("threads the selected %s mode into the full server-rendered demo", async mode => {
    vi.stubEnv("FACILITY_3D_MODE", mode)
    vi.stubEnv("FACILITY_VISUAL_RELEASE", "facility-v10")
    const document = parse(renderToStaticMarkup(await DemoPage({ searchParams: Promise.resolve({ scenario: "d" }) })))
    expect(document.querySelector("[data-assessment-preview-activate]")?.textContent).toBe(mode === "poster" ? "Inspect this example" : "Explore the facility in 3D")
    expect(document.querySelector('[data-testid="assessment-summary"]')?.textContent).toContain("Unknown")
    expect(document.querySelector('[href="/downloads/assessment/demo-01-d/v1.0.0/json"]')).not.toBeNull()
    expect(document.querySelectorAll(".facility-preview-poster--deferred img")).toHaveLength(1)
    expect(document.querySelectorAll(".facility-stage noscript picture img")).toHaveLength(1)
    expect(document.querySelector("canvas")).toBeNull()
    const schema = document.querySelector('script[type="application/ld+json"]')!
    expect(() => JSON.parse(schema.textContent!)).not.toThrow()
    if (mode === "poster") expect(document.body.textContent).not.toContain("Explore the facility in 3D")
  })
})
