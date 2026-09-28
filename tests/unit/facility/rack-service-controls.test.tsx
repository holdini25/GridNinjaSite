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

it("guides committed endpoints, permits skipping inspection, and preserves cutaway on return", () => {
  const props = setup(), rendered = render(<FacilityEngineeringControls {...props} />)
  const primary = () => document.querySelector<HTMLButtonElement>("[data-guided-primary]")!
  expect(primary()).toHaveTextContent("Open door")
  fireEvent.click(primary())
  const open = { ...closed, rack: { door: "open", tray: "retracted", cutaway: false } } as FacilityView
  expect(props.onView).toHaveBeenLastCalledWith(open)
  rendered.rerender(<FacilityEngineeringControls {...props} requestedView={open} assetPhase="loading" />)
  expect(primary()).toHaveTextContent("Opening door…"); expect(primary()).toBeDisabled()
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={open} requestedView={open} />)
  expect(primary()).toHaveTextContent("Extend server tray"); fireEvent.click(primary())
  expect(props.onView).toHaveBeenLastCalledWith(service)
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={service} requestedView={service} />)
  expect(primary()).toHaveTextContent("Inspect service connection")
  fireEvent.click(screen.getByText("More inspection options"))
  fireEvent.click(screen.getByRole("button", { name: "Retract server tray" }))
  expect(props.onView).toHaveBeenLastCalledWith(open)
  fireEvent.click(primary()); expect(props.onView).toHaveBeenLastCalledWith(closeup)
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={service} requestedView={closeup} assetPhase="loading" />)
  expect(primary()).toHaveTextContent("Inspecting service connection…"); expect(primary()).toBeDisabled()
  expect(screen.queryByRole("button", { name: "Retract server tray" })).not.toBeInTheDocument()
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={closeup} requestedView={closeup} rackJourney={{ detailSeen: true, hasExtended: true }} />)
  expect(primary()).toHaveTextContent("Return to whole assembly"); fireEvent.click(primary())
  const returning = { ...closeup, detail: undefined }
  expect(props.onView).toHaveBeenLastCalledWith(returning)
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={returning} requestedView={returning} rackJourney={{ detailSeen: true, hasExtended: true }} />)
  expect(primary()).toHaveTextContent("Retract server tray")
  expect(screen.getByRole("button", { name: "Restore side panel" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "Inspect service connection again" })).toBeEnabled()
  rendered.rerender(<FacilityEngineeringControls {...props} activeView={open} requestedView={open} rackJourney={{ detailSeen: false, hasExtended: true }} />)
  expect(primary()).toHaveTextContent("Close door")
})

it("reports guard failures and retains facility exit during camera movement", () => {
  const props = setup(), rendered = render(<FacilityEngineeringControls {...props} activeView={service} requestedView={closeup} assetPhase="loading" />)
  fireEvent.click(screen.getByRole("button", { name: "Return to facility" })); expect(props.onReturn).toHaveBeenCalledOnce()
  rendered.rerender(<FacilityEngineeringControls {...props} assetPhase="failed" assetReason="Wait for the assembly and camera to finish." />)
  expect(screen.getByRole("status")).toHaveTextContent("Wait for the assembly and camera to finish.")
  delete props.metadata.specimen!.rackMotion!.serviceDetail
  rendered.rerender(<FacilityEngineeringControls {...props} />)
  expect(screen.queryByRole("region", { name: "Rack service controls" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Open door" })).toBeEnabled()
})
