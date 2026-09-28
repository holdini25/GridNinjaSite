import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FacilityHero } from "@/components/marketing/facility-hero"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import type { FacilityVisualRelease } from "@/types/facility"

const fallback = { posters: { desktop: { url: "/assets/facility/facility-v10/poster-desktop.webp" }, mobile: { url: "/assets/facility/facility-v10/poster-mobile.webp" } } } as FacilityVisualRelease

describe("server-rendered cinematic unavailability", () => {
  it("explicitly identifies an unavailable configured animation while retaining a static illustration and authoritative decision", () => {
    const html = renderToStaticMarkup(<FacilityHero record={assessmentFixtures.b} release={null} fallback={fallback} cinematicUnavailable />)
    expect(html).toContain("Animation unavailable. A static facility illustration is shown.")
    expect(html).toContain("/assets/facility/facility-v10/poster-desktop.webp")
    expect(html).toContain("7.0 MW"); expect(html).toContain("5.8 MW")
    expect(html).toContain("No site action is authorized")
    expect(html).toContain("/evidence/assessments/demo-01-b/v1.0.0")
    expect(html).not.toContain("<video")
  })
  it("does not claim a failure when cinema is unconfigured, or a surviving illustration when none exists", () => {
    const ordinary = renderToStaticMarkup(<FacilityHero record={assessmentFixtures.b} release={null} fallback={fallback} />)
    expect(ordinary).not.toContain("Animation unavailable")
    const absent = renderToStaticMarkup(<FacilityHero record={assessmentFixtures.b} release={null} fallback={null} cinematicUnavailable />)
    expect(absent).toContain("Animation unavailable. The sample decision remains readable below.")
    expect(absent).not.toContain("A static facility illustration is shown")
  })
})
