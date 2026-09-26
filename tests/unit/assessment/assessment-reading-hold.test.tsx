import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { AssessmentExplorer } from "@/components/assessment/assessment-explorer"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"
import type { FacilityInspectionProps, FacilityVisualRelease } from "@/types/facility"
const { inspect } = vi.hoisted(() => ({ inspect: vi.fn() }))
vi.mock("@/lib/analytics", () => ({ trackGridNinjaEvent: vi.fn() }))
vi.mock("@/components/facility/facility-inspection", () => ({ FacilityInspection: (props: FacilityInspectionProps) => { inspect(props); return null } }))
const release = { equipmentIndex: { equipment: [] } } as unknown as FacilityVisualRelease
const current = () => inspect.mock.lastCall![0] as FacilityInspectionProps
afterEach(() => { cleanup(); inspect.mockClear(); window.history.replaceState(null, "", "/demo") })

it("holds for either disclosure and releases both on assessment navigation", async () => {
  const user = userEvent.setup()
  render(<AssessmentExplorer initialSelection={resolveAssessmentSelection({})} records={assessmentFixtures} facilityRelease={release} />)
  expect(current().readingHold).toBe(false)
  await user.click(screen.getByText("Explore a hypothetical minimum", { selector: "summary" }))
  await waitFor(() => expect(current().readingHold).toBe(true))
  await user.click(screen.getByText("Conditions and assessment evidence", { selector: "summary" }))
  await user.click(screen.getByText("Explore a hypothetical minimum", { selector: "summary" }))
  expect(current().readingHold).toBe(true)
  await user.click(screen.getByText("Conditions and assessment evidence", { selector: "summary" }))
  await waitFor(() => expect(current().readingHold).toBe(false))
  await user.click(screen.getByText("Explore a hypothetical minimum", { selector: "summary" }))
  act(() => { window.history.replaceState(null, "", "/demo?scenario=d"); window.dispatchEvent(new PopStateEvent("popstate")) })
  expect(current().readingHold).toBe(false)
  fireEvent.change(screen.getByLabelText("Perspective"), { target: { value: "engineering" } })
  expect(current().readingHold).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Reset example" }))
  expect(current().readingHold).toBe(false)
})
