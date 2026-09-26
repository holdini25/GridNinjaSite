import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { FacilityEngineeringControls } from "@/components/facility/facility-engineering-controls"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import type { FacilitySpecimenMetadata, FacilityView, FacilityVisualRelease } from "@/types/facility"

const closed: FacilityView = { kind: "specimen", specimen: "rack", pose: "closed", rack: { door: "closed", tray: "retracted", cutaway: false } }
const service: FacilityView = { kind: "specimen", specimen: "rack", pose: "service", rack: { door: "open", tray: "extended", cutaway: false } }
const closeup: FacilityView = { ...service, rack: { door: "open", tray: "extended", cutaway: true }, detail: "service-connection" }
function setup() {
  const specimen = { kind: "rack", parts: [{ id: "tray", label: "Server tray", role: "tray" }, { id: "frame", label: "Structural frame", role: "frame" }, { id: "power", label: "Rear distribution", role: "power" }], rackMotion: { serviceDetail: { version: 1, partIds: ["tray", "frame", "power"], requiresCutaway: true } } } as FacilitySpecimenMetadata
  const props: ComponentProps<typeof FacilityEngineeringControls> = {
    release: { profile: { ecosystem: {}, inspection: {} } } as FacilityVisualRelease,
    record: assessmentFixtures.b, ready: true, activeView: closed, requestedView: closed, assetPhase: "ready", metadata: { specimen }, target: null, previewTarget: null, expanded: false, walkthroughStep: null,
    onView: vi.fn(), onReturn: vi.fn(), onTarget: vi.fn(), onPreview: vi.fn(), onExpand: vi.fn(), onWalkthrough: vi.fn(), onWalkthroughSystem: vi.fn(), onRetry: vi.fn(),
  }
  return props
}
afterEach(cleanup)

it("offers close-up only at a completed extension, locks mechanics through camera return and names the actual part families", () => {
  const props = setup(), rendered = render(<FacilityEngineeringControls {...props} />)
  const action = () => screen.getByRole("button", { name: "Inspect service connection (cutaway)" })
  expect(action()).toBeDisabled()
  rendered.rerender(<FacilityEngineeringControls {...props} requestedView={service} assetPhase="loading" />)
  expect(action()).toBeDisabled()
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={service} requestedView={service} />)
  expect(action()).toBeEnabled(); fireEvent.click(action())
  expect(props.onView).toHaveBeenLastCalledWith(closeup)
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={service} requestedView={closeup} assetPhase="loading" />)
  for (const name of ["Close rack", "Retract server tray", "Restore side panel", "Return to whole assembly"]) expect(screen.getByRole("button", { name })).toBeDisabled()
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={closeup} requestedView={closeup} />)
  expect(screen.getByRole("status")).toHaveTextContent("Server tray, Structural frame, Rear distribution")
  expect(screen.getByRole("status")).toHaveTextContent("side panel is removed")
  fireEvent.click(screen.getByRole("button", { name: "Return to whole assembly" }))
  const returning: FacilityView = { ...service, rack: { door: "open", tray: "extended", cutaway: true } }
  expect(props.onView).toHaveBeenLastCalledWith(returning)
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={closeup} requestedView={returning} assetPhase="loading" />)
  expect(screen.getByRole("button", { name: "Retract server tray" })).toBeDisabled()
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={returning} requestedView={returning} />)
  expect(screen.getByRole("button", { name: "Retract server tray" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "Retract server tray" }))
  expect(props.onView).toHaveBeenLastCalledWith({ kind: "specimen", specimen: "rack", pose: "cutaway", rack: { door: "open", tray: "retracted", cutaway: true } })
})

it("preserves legacy controls and allows an explicit facility exit while the detail camera is moving", () => {
  const props = setup(), rendered = render(<FacilityEngineeringControls {...props} activeView={service} requestedView={closeup} assetPhase="loading" />)
  fireEvent.click(screen.getByRole("button", { name: "Return to facility" }))
  expect(props.onReturn).toHaveBeenCalledOnce()
  delete props.metadata.specimen!.rackMotion!.serviceDetail
  rendered.rerender(<FacilityEngineeringControls {...props} />)
  expect(screen.queryByRole("button", { name: "Inspect service connection (cutaway)" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Open door" })).toBeEnabled()
})
