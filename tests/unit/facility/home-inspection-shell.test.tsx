import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { HomeInspectionShell } from "@/components/facility/home-inspection-shell"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import type { FacilityVisualRelease } from "@/types/facility"

it("renders the mobile and desktop posters with the decision before hydration", () => {
  const release = {
    release: "facility-v7",
    posters: {
      mobile: { url: "/assets/facility/facility-v7/poster-mobile.webp" },
      desktop: { url: "/assets/facility/facility-v7/poster-desktop.webp" },
    },
    profile: { inspection: true, engineering: true },
  } as unknown as FacilityVisualRelease
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(<HomeInspectionShell record={assessmentFixtures.b} release={release} mode="auto-adaptive" />)

  expect(root.querySelector(".facility-stage source")?.getAttribute("srcset")).toBe(release.posters.mobile.url)
  expect(root.querySelector(".facility-stage img")?.getAttribute("src")).toBe(release.posters.desktop.url)
  expect(root.querySelector("[data-testid='facility-assessment-caption']")?.textContent).toContain("5.8 MW")
  expect(root.querySelector("[data-facility-activate]")?.getAttribute("href")).toContain("interactive=1&activate=1#facility-construction")
})
