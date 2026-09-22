import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock("@/lib/analytics", () => ({ trackGridNinjaEvent: track }))

import { AssessmentExplorer } from "@/components/assessment/assessment-explorer"
import { ASSESSMENT_SCENARIOS, assessmentFixtures } from "@/content/assessments/fixtures"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"

afterEach(() => { track.mockClear(); cleanup(); window.history.replaceState(null, "", "/demo") })

describe("one-record assessment explorer", () => {
  it("switches every ordered scenario pair with matching evidence and download targets", async () => {
    const user = userEvent.setup()
    render(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({ perspective: "engineering" })} />)
    for (const from of ASSESSMENT_SCENARIOS) {
      await user.selectOptions(screen.getByLabelText("Scenario"), from)
      for (const to of ASSESSMENT_SCENARIOS) {
        await user.selectOptions(screen.getByLabelText("Scenario"), to)
        const summary = screen.getByTestId("assessment-summary")
        expect(summary).toHaveAttribute("data-scenario", to)
        expect(within(summary).getByText(`Model screen: ${assessmentFixtures[to].screeningOutcome}`)).toBeVisible()
        expect(screen.getByRole("link", { name: "Download this PDF" })).toHaveAttribute("href", `/downloads/assessment/demo-01-${to}/v1.0.0/pdf`)
        if (to === "d") {
          expect(summary).not.toHaveTextContent("5.8 MW")
          expect(screen.queryByTestId("assessment-attribution")).not.toBeInTheDocument()
          expect(screen.getByTestId("assessment-capacity-table")).toHaveTextContent("Unknown")
        } else expect(screen.getByTestId("assessment-attribution")).toBeVisible()
        await user.selectOptions(screen.getByLabelText("Scenario"), from)
      }
    }
  })

  it("perspective changes preserve the result; reset restores B, business, and collapsed disclosures", async () => {
    const user = userEvent.setup()
    render(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({ scenario: "c" })} />)
    await user.selectOptions(screen.getByLabelText("Perspective"), "engineering")
    expect(screen.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "c")
    expect(screen.getByTestId("assessment-capacity-table")).toHaveTextContent("6.5 MW")
    await user.click(screen.getByText("Options to investigate · all unassessed"))
    expect(screen.getByText("Options to investigate · all unassessed").closest("details")).toHaveAttribute("open")
    await user.click(screen.getByRole("button", { name: "Reset example" }))
    expect(screen.getByLabelText("Scenario")).toHaveValue("b")
    expect(screen.getByLabelText("Perspective")).toHaveValue("business")
    expect(screen.queryByTestId("assessment-capacity-table")).not.toBeInTheDocument()
    expect(screen.getByText("Options to investigate · all unassessed").closest("details")).not.toHaveAttribute("open")
    expect(window.location.search).toBe("?scenario=b&version=1.0.0&perspective=business")
  })

  it("restores history selections and removes all results for unavailable historical versions", () => {
    render(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({})} />)
    act(() => { window.history.replaceState(null, "", "/demo?scenario=d&perspective=engineering&version=1.0.0"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(screen.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "d")
    act(() => { window.history.replaceState(null, "", "/demo?scenario=b&version=99.0.0"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(screen.getByRole("heading", { name: "Requested example unavailable" })).toBeVisible()
    expect(screen.queryByTestId("assessment-summary")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Download this PDF" })).not.toBeInTheDocument()
  })

  it("accepts a new server selection when same-page navigation follows local changes", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({})} />)
    await user.selectOptions(screen.getByLabelText("Scenario"), "d")
    rerender(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({})} />)
    expect(screen.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "b")
  })
  it("tracks validated opening, explicit selections and current publication clicks only", async () => {
    const user = userEvent.setup()
    render(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({})} />)
    expect(track).toHaveBeenCalledWith("sample_opened", expect.objectContaining({ scenario: "b", artifact: "demo-01-b", version: "1.0.0" }))
    await user.selectOptions(screen.getByLabelText("Scenario"), "d")
    await user.selectOptions(screen.getByLabelText("Perspective"), "engineering")
    expect(track).toHaveBeenCalledWith("scenario_selected", expect.objectContaining({ scenario: "d", artifact: "demo-01-d" }))
    expect(track).toHaveBeenCalledWith("perspective_selected", expect.objectContaining({ scenario: "d", perspective: "engineering" }))
    const download = screen.getByRole("link", { name: "Download this PDF" })
    download.addEventListener("click", event => event.preventDefault())
    fireEvent.click(download)
    expect(track).toHaveBeenCalledWith("sample_download_clicked", expect.objectContaining({ artifact: "demo-01-d", version: "1.0.0" }))
    act(() => { window.history.replaceState(null, "", "/demo?scenario=a&version=1.0.0"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(track.mock.calls.filter(([name]) => name === "sample_opened")).toHaveLength(1)
    expect(track.mock.calls.filter(([name]) => name === "scenario_selected")).toHaveLength(1)
  })

  it("does not count an unavailable publication as an opened sample", () => {
    render(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({ version: "99.0.0" })} />)
    expect(track).not.toHaveBeenCalled()
  })

})
