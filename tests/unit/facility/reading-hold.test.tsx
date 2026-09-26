import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { FacilityContextualInspector } from "@/components/facility/facility-contextual-inspector"
import { readFacilityRelease } from "@/lib/facility/releases"
import { equipmentMotionAllowed } from "@/lib/facility/frame-policy"
import type { FacilityCanvasProps, FacilityVisualRelease } from "@/types/facility"

const renderer = vi.hoisted(() => ({ render: vi.fn() }))
vi.mock("@/components/facility/facility-canvas", () => ({ default: (props: FacilityCanvasProps) => { renderer.render(props); return <div data-testid="mock-facility-canvas" /> } }))
import { FacilityInspection } from "@/components/facility/facility-inspection"

let release: FacilityVisualRelease
beforeAll(async () => {
  const result = await readFacilityRelease("facility-v10")
  if (result.status !== 200) throw new Error("The immutable baseline release is unavailable")
  release = result.release
})
afterEach(() => { cleanup(); renderer.render.mockClear(); vi.restoreAllMocks(); window.sessionStorage.clear() })
const current = () => renderer.render.mock.lastCall![0] as FacilityCanvasProps
const props = () => ({ record: assessmentFixtures.b, release, variant: "demo" as const, loadingPolicy: "auto-adaptive" as const })
async function activate() {
  fireEvent.click(screen.getByRole("button", { name: "Explore in 3D" }))
  await waitFor(() => expect(renderer.render).toHaveBeenCalled())
  act(() => { current().onStaged(); current().onPresented(); current().onQuality!("balanced") })
}

describe("transient facility reading holds", () => {
  it("aggregates overlapping contextual disclosures and releases on unmount", async () => {
    const user = userEvent.setup(), changed = vi.fn()
    const { unmount } = render(<FacilityContextualInspector record={assessmentFixtures.b} target={{ system: "cooling" }} variant="demo" onReadingHoldChange={changed} />)
    await user.click(screen.getByText("Conditions", { selector: "summary" }))
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith(true))
    await user.click(screen.getByText("Evidence", { selector: "summary" }))
    await user.click(screen.getByText("Conditions", { selector: "summary" }))
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith(true))
    await user.click(screen.getByText("Evidence", { selector: "summary" }))
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith(false))
    await user.click(screen.getByText("Conditions", { selector: "summary" }))
    unmount()
    expect(changed).toHaveBeenLastCalledWith(false)
  })
  it("pauses a story at its current chapter and never resumes it when reading ends", async () => {
    const { rerender } = render(<FacilityInspection {...props()} />)
    await activate()
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    const command = current().presentation!
    act(() => current().onPresentationCheckpoint!({ revision: command.revision, chapter: 1, playing: true }))
    const saved = window.sessionStorage.getItem("gridninja.facility.preferences.v1")
    rerender(<FacilityInspection {...props()} readingHold />)
    expect(current().readingHold).toBe(true)
    expect(current().presentation).toMatchObject({ chapter: 1, playing: false, seekRevision: command.seekRevision })
    expect(screen.getByRole("button", { name: "Play story" })).toBeDisabled()
    rerender(<FacilityInspection {...props()} readingHold={false} />)
    expect(current().presentation).toMatchObject({ chapter: 1, playing: false })
    expect(screen.getByRole("button", { name: "Play story" })).toBeEnabled()
    expect(window.sessionStorage.getItem("gridninja.facility.preferences.v1")).toBe(saved)
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    expect(current().presentation?.playing).toBe(true)
  })
  it("allows committed selection and explicit detail views while ambient motion is held", async () => {
    const commit = vi.fn()
    render(<FacilityInspection {...props()} readingHold onCommittedTarget={commit} />)
    await activate()
    fireEvent.click(screen.getByRole("button", { name: "Cooling" }))
    expect(commit).toHaveBeenLastCalledWith({ system: "cooling" })
    expect(current().readingHold).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "View air-path cutaway" }))
    expect(current().view).toEqual({ kind: "overview", detail: "air-path", section: "air-path" })
    expect(current().paused).toBe(false)
    expect(current().equipmentEnabled).toBe(true)
  })
  it("keeps an external hold after an internal disclosure closes and releases internal holds on reset", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<FacilityInspection {...props()} readingHold initialTarget={{ system: "power" }} />)
    await activate()
    const inspector = screen.getByTestId("facility-contextual-inspector")
    await user.click(within(inspector).getByText("Conditions", { selector: "summary" }))
    await user.click(within(inspector).getByText("Conditions", { selector: "summary" }))
    expect(current().readingHold).toBe(true)
    rerender(<FacilityInspection {...props()} initialTarget={{ system: "power" }} />)
    expect(current().readingHold).toBe(false)
    await user.click(within(inspector).getByText("Evidence", { selector: "summary" }))
    await waitFor(() => expect(current().readingHold).toBe(true))
    rerender(<FacilityInspection {...props()} resetRevision={1} />)
    await waitFor(() => expect(current().readingHold).toBe(false))
  })
  it("never lets a diagnostic cadence override a reading hold or explicit motion preferences", () => {
    expect(equipmentMotionAllowed(true, false, false, "still", 30, true)).toBe(false)
    expect(equipmentMotionAllowed(true, false, false, "balanced", null, true)).toBe(false)
    expect(equipmentMotionAllowed(true, true, false, "balanced", null, false)).toBe(false)
    expect(equipmentMotionAllowed(true, false, true, "balanced", null, false)).toBe(false)
    expect(equipmentMotionAllowed(false, false, false, "balanced", null, false)).toBe(false)
    expect(equipmentMotionAllowed(true, false, false, "balanced", null, false)).toBe(true)
  })
})
