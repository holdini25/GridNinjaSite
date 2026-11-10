import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AssessmentResultActions } from "@/components/assessment/assessment-result-actions"
import { AssessmentPreview } from "@/components/assessment/assessment-preview"
import { AssessmentExplorer } from "@/components/assessment/assessment-explorer"
import { VercelObservability } from "@/components/analytics/vercel-observability"
import { assessmentFixtures, ASSESSMENT_SCENARIOS } from "@/content/assessments/fixtures"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"

const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock("@vercel/analytics", () => ({ track }))
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }))
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }))
beforeEach(() => { track.mockReset(); window.history.replaceState({}, "", "/demo?private=discard#decision-brief") })
afterEach(cleanup)

describe("native result actions", () => {
  it.each(ASSESSMENT_SCENARIOS)("keeps fixture %s actions adjacent and identical before and after enhancement", scenario => {
    for (const perspective of ["business", "engineering"] as const) {
      const selection = resolveAssessmentSelection({ scenario, perspective })
      if (selection.status !== "ready") throw new Error("Fixture unavailable")
      for (const element of [<AssessmentPreview key="preview" selection={selection} record={assessmentFixtures[scenario]} release={null} topic="cooling" />, <AssessmentExplorer key="explorer" initialSelection={selection} records={assessmentFixtures} initialTopic="cooling" />]) {
        const document = new DOMParser().parseFromString(renderToStaticMarkup(element), "text/html")
        const groups = document.querySelectorAll("[data-assessment-result-actions]")
        expect(groups).toHaveLength(1)
        const group = groups[0]
        expect(group.previousElementSibling?.getAttribute("data-testid")).toBe("assessment-summary")
        expect(group.nextElementSibling?.hasAttribute("data-assessment-controls")).toBe(true)
        expect([...group.querySelectorAll("a")].map(link => link.getAttribute("href"))).toEqual([
          `/evidence/assessments/demo-01-${scenario}/v1.0.0`,
          `/downloads/assessment/demo-01-${scenario}/v1.0.0/pdf`,
          `/downloads/assessment/demo-01-${scenario}/v1.0.0/json`,
          "/assessment?source=assessment-explorer&topic=cooling#scope",
        ])
        expect(document.querySelector('[aria-label="Current example downloads"]')).toBeNull()
        expect(document.querySelector('[data-testid="assessment-summary"] a')).toBeNull()
      }
    }
  })

  it("counts each delegated click once with current record identity and keeps native navigation", () => {
    const { rerender } = render(<><VercelObservability /><AssessmentResultActions record={assessmentFixtures.b} perspective="business" /></>)
    const click = () => {
      const link = within(screen.getByRole("group", { name: "Current example actions" })).getByRole("link", { name: "Download this PDF" })
      // Observe navigation without asking jsdom to load an attachment.
      link.addEventListener("click", event => { expect(event.defaultPrevented).toBe(false); event.preventDefault() }, { once: true })
      fireEvent.click(link)
    }
    click()
    expect(track).toHaveBeenCalledExactlyOnceWith("sample_download_clicked", { route: "/demo", source: "assessment-explorer", scenario: "b", perspective: "business", artifact: "demo-01-b", version: "1.0.0" })
    rerender(<><VercelObservability /><AssessmentResultActions record={assessmentFixtures.d} perspective="engineering" /></>)
    click()
    expect(track).toHaveBeenCalledTimes(2)
    expect(track).toHaveBeenLastCalledWith("sample_download_clicked", expect.objectContaining({ scenario: "d", perspective: "engineering", artifact: "demo-01-d" }))
  })

  it("does not fabricate actions for an unsupported version", () => {
    render(<AssessmentExplorer initialSelection={resolveAssessmentSelection({ version: "99.0.0" })} records={assessmentFixtures} />)
    expect(screen.queryByRole("group", { name: "Current example actions" })).toBeNull()
    expect(screen.getByRole("link", { name: "Open the default example" })).toHaveAttribute("href", "/demo")
  })
})
