import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { FacilityInspectionProps, FacilityVisualRelease } from "@/types/facility"
const { inspect } = vi.hoisted(() => ({ inspect: vi.fn() }))
vi.mock("@/lib/analytics", () => ({ trackGridNinjaEvent: vi.fn() }))
vi.mock("@/components/facility/facility-inspection", () => ({ FacilityInspection: (props: FacilityInspectionProps) => {
  inspect(props)
  return <button onClick={() => props.onCommittedTarget?.({ system: "workloads", equipmentId: "rack-02" })}>Select authored rack</button>
} }))
import { AssessmentExplorer } from "@/components/assessment/assessment-explorer"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"
const release = { equipmentIndex: { equipment: [{ id: "rack-02", system: "workloads" }] } } as FacilityVisualRelease
const current = () => inspect.mock.lastCall![0] as FacilityInspectionProps
afterEach(() => { cleanup(); inspect.mockClear(); window.history.replaceState(null, "", "/demo") })

describe("assessment-owned visual history", () => {
  it("normalizes committed equipment against the public index before writing history", () => {
    render(<AssessmentExplorer initialSelection={resolveAssessmentSelection({})} records={assessmentFixtures} facilityRelease={release} />)
    act(() => current().onCommittedTarget!({ system: "power", equipmentId: "rack-02" }))
    expect(current().initialTarget).toEqual({ system: "workloads", equipmentId: "rack-02" })
    act(() => current().onCommittedTarget!({ system: "workloads", equipmentId: "unlisted-private-value" }))
    expect(current().initialTarget).toBeNull()
    expect(window.location.search).not.toContain("focus")
    expect(window.location.search).not.toContain("unlisted")
  })

  it("commits public focus and restores it with an overview reset while preserving the record", () => {
    render(<AssessmentExplorer initialSelection={resolveAssessmentSelection({})} records={assessmentFixtures} facilityRelease={release} initialTopic="ai-cloud" />)
    fireEvent.click(screen.getByRole("button", { name: "Select authored rack" }))
    expect(window.location.search).toBe("?scenario=b&version=1.0.0&perspective=business&focus=rack-02&topic=ai-cloud")
    expect(current().record).toBe(assessmentFixtures.b)
    const revision = current().resetRevision!
    act(() => { window.history.replaceState(null, "", "/demo?scenario=d&focus=cooling&topic=colocation"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(current().initialTarget).toEqual({ system: "cooling" })
    expect(current().topic).toBe("colocation")
    expect(current().resetRevision).toBeGreaterThan(revision)
    expect(current().record).toBe(assessmentFixtures.d)
    fireEvent.change(screen.getByLabelText("Perspective"), { target: { value: "engineering" } })
    expect(current().initialTarget).toBeNull()
    expect(window.location.search).not.toContain("focus")
    expect(current().record).toBe(assessmentFixtures.d)
  })
  it("drops invalid focus without replacing D and removes the entire assessment for conflicting identity", () => {
    render(<AssessmentExplorer initialSelection={resolveAssessmentSelection({})} records={assessmentFixtures} facilityRelease={release} />)
    act(() => { window.history.replaceState(null, "", "/demo?scenario=d&focus=unknown"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(current().initialTarget).toBeNull()
    expect(current().record).toBe(assessmentFixtures.d)
    act(() => { window.history.replaceState(null, "", "/demo?scenario=d&scenario=b&focus=power"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(screen.getByRole("heading", { name: "Requested example unavailable" })).toBeVisible()
    expect(screen.queryByRole("button", { name: "Select authored rack" })).toBeNull()
  })
})
