import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import type { FacilityCanvasProps, FacilitySceneMetadata, FacilityTopology, FacilityVisualRelease } from "@/types/facility"
import ecosystemTopologySource from "./fixtures/ecosystem-topology.json"
import { testMatchMedia } from "../../support/match-media"

const renderer = vi.hoisted(() => ({ render: vi.fn() }))
vi.mock("@/components/facility/facility-canvas", () => ({ default: (props: FacilityCanvasProps) => { renderer.render(props); return <div data-testid="mock-facility-canvas" /> } }))
import { FacilityInspection } from "@/components/facility/facility-inspection"

const file = (url: string) => ({ url, bytes: 100, sha256: "0".repeat(64) })
const release: FacilityVisualRelease = {
  schemaVersion: "facility.v1", release: "test-r1", environment: "synthetic",
  model: file("/visuals/model.glb"), posters: { desktop: file("/visuals/desktop.webp"), mobile: file("/visuals/mobile.webp") },
  profile: { camera: [12, 10, 15], target: [0, 1, 0], padding: 1.12, background: "#0b1016", exposure: 1, colorSpace: "srgb", toneMapping: "aces-filmic", lighting: { hemisphere: { sky: "#e3efff", ground: "#514131", intensity: 2.1 }, directional: [] } },
  systems: Object.fromEntries(["power", "cooling", "storage", "workloads"].map(system => [system, { root: `GN_${system.toUpperCase()}`, accent: `GN_ACCENT_${system.toUpperCase()}`, pick: `GN_PICK_${system.toUpperCase()}` }])) as FacilityVisualRelease["systems"],
  equipment: { rotors: Array.from({ length: 4 }, (_, index) => ({ id: `GN_FAN_ROTOR_${String(index).padStart(2, "0")}`, axis: [0, 1, 0] as [number, number, number] })), leds: Array.from({ length: 48 }, (_, index) => `GN_LED_${String(index).padStart(2, "0")}`) },
}
const props = { record: assessmentFixtures.b, release, variant: "demo" as const, loadingPolicy: "manual" as const }
const currentCanvas = () => renderer.render.mock.lastCall?.[0] as FacilityCanvasProps
function displayOptionsControl() {
  return screen.getByLabelText("Display options")
}
function openDisplayOptions() {
  const summary = displayOptionsControl()
  if (!summary.closest("details")!.open) fireEvent.click(summary)
}
function stillImageControl() {
  openDisplayOptions()
  return screen.getByRole("button", { name: "Use still image" })
}
function equipmentMotionControl() {
  openDisplayOptions()
  return screen.getByRole("checkbox", { name: "Equipment motion" })
}
function openAssemblyParts() {
  const summary = screen.getByText("Inspect assembly parts", { selector: "summary" })
  if (!summary.closest("details")!.open) fireEvent.click(summary)
}

afterEach(() => { cleanup(); renderer.render.mockClear(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.sessionStorage.clear() })

describe("facility HTML shell and authoritative assessment", () => {
  it("starts with a poster and complete assessment without requesting the renderer", () => {
    render(<FacilityInspection {...props} />)
    expect(screen.getByRole("img")).toHaveAttribute("src", "/visuals/desktop.webp")
    expect(screen.getByTestId("facility-assessment-caption")).toHaveTextContent("7.0 MW")
    expect(screen.getByTestId("facility-assessment-caption")).toHaveTextContent("5.8 MW")
    expect(screen.getByTestId("facility-assessment-caption")).toHaveTextContent("20.0 MW")
    expect(screen.getByText(/No site action is authorized/)).toBeVisible()
    expect(renderer.render).not.toHaveBeenCalled()
  })

  it("keeps record values and exact evidence links while selecting, then replaces every scenario-dependent value", () => {
    const original = JSON.stringify(assessmentFixtures)
    const { rerender } = render(<FacilityInspection {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "Cooling" }))
    expect(screen.getByRole("button", { name: "Cooling" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("link", { name: /Inspect this published/ })).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
    rerender(<FacilityInspection {...props} record={assessmentFixtures.d} />)
    expect(screen.getByTestId("facility-assessment-caption")).toHaveTextContent("Unknown")
    expect(screen.getByTestId("facility-inspection")).not.toHaveTextContent("5.8 MW")
    expect(screen.getByText("Cooling evidence missing")).toBeVisible()
    expect(screen.getByRole("link", { name: /Inspect this published/ })).toHaveAttribute("href", "/evidence/assessments/demo-01-d/v1.0.0")
    expect(JSON.stringify(assessmentFixtures)).toBe(original)
  })

  it("identifies v3 equipment without changing the assessment or applying its layout to other releases", () => {
    const { rerender } = render(<FacilityInspection {...props} release={{ ...release, release: "facility-v3" }} record={assessmentFixtures.d} />)
    const originalCaption = screen.getByTestId("facility-assessment-caption").textContent
    for (const [system, equipment] of [
      ["Power", "Shown: three switchgear cabinets at left."],
      ["Cooling", "Shown: four cooling units behind the racks."],
      ["Storage", "Shown: two reserve cabinets at right."],
      ["Workloads", "Shown: twelve server racks in two rows of six."],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: system }))
      expect(screen.getByText(equipment)).toBeVisible()
      expect(screen.getByTestId("facility-assessment-caption").textContent).toBe(originalCaption)
      expect(screen.getByTestId("facility-assessment-caption")).toHaveTextContent("Unknown")
    }
    fireEvent.click(screen.getByRole("button", { name: "Cooling" }))
    expect(screen.getByText("Cooling evidence missing")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Storage" }))
    expect(screen.getByText(/Independent storage capacity and dispatchability are unassessed/)).toBeVisible()
    for (const otherRelease of ["facility-v1", "facility-v2", "facility-v4"]) {
      rerender(<FacilityInspection {...props} release={{ ...release, release: otherRelease }} />)
      for (const system of ["Power", "Cooling", "Storage", "Workloads"]) {
        fireEvent.click(screen.getByRole("button", { name: system }))
        expect(screen.queryByText(/^Shown:/)).not.toBeInTheDocument()
      }
    }
  })

  it("keeps sizing copies inert and hidden while exposing only the active explanation", () => {
    const { container, rerender } = render(<FacilityInspection {...props} release={{ ...release, release: "facility-v3" }} />)
    const explanation = container.querySelector(".facility-explanation")!
    for (const system of [null, "Power", "Cooling", "Storage", "Workloads"]) {
      if (system) fireEvent.click(screen.getByRole("button", { name: system }))
      const visibleCopies = explanation.querySelectorAll(".facility-explanation-copy > p:not([aria-hidden])")
      expect(visibleCopies).toHaveLength(1)
      expect(visibleCopies[0]).toBeVisible()
      expect(visibleCopies[0]).not.toHaveAttribute("inert")
      expect(explanation.querySelectorAll(".facility-explanation-titles > strong:not([aria-hidden])")).toHaveLength(1)
      for (const copy of explanation.querySelectorAll('.facility-explanation-titles > [aria-hidden="true"], .facility-explanation-copy > [aria-hidden="true"]')) {
        expect(copy).toHaveAttribute("inert")
        expect(copy).not.toBeVisible()
      }
      expect(within(explanation as HTMLElement).getAllByRole("button", { name: "Clear selection" })).toHaveLength(1)
      expect(within(explanation as HTMLElement).getAllByRole("link")).toHaveLength(1)
    }
    rerender(<FacilityInspection {...props} release={{ ...release, release: "facility-v3" }} record={assessmentFixtures.d} />)
    fireEvent.click(screen.getByRole("button", { name: "Cooling" }))
    expect(screen.getByText("Cooling evidence missing")).toBeVisible()
    expect(explanation).not.toHaveTextContent("5.8 MW")
  })

  it("clears locally with Escape, restores system focus, and resets selection without a full remount", () => {
    const { rerender } = render(<FacilityInspection {...props} />)
    const storage = screen.getByRole("button", { name: "Storage" })
    fireEvent.click(storage)
    fireEvent.keyDown(storage, { key: "Escape" })
    expect(storage).toHaveFocus()
    expect(storage).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(storage)
    rerender(<FacilityInspection {...props} resetRevision={1} />)
    expect(storage).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("Inspect the physical context")).toBeVisible()
  })

  it("hides a missing image while retaining static controls and manual 3D activation", () => {
    render(<FacilityInspection {...props} />)
    const image = screen.getByRole("img")
    Object.defineProperty(image, "complete", { value: true })
    fireEvent.error(image)
    expect(screen.getByText(/Facility illustration unavailable/)).toBeVisible()
    expect(screen.getByRole("button", { name: /Explore in 3D/ })).toBeVisible()
    expect(screen.getByRole("button", { name: "Power" })).toBeVisible()
  })

  it("recognizes a poster that failed before hydration could attach its error handler", () => {
    const completed = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true)
    try {
      render(<FacilityInspection {...props} />)
      expect(screen.getByText(/Facility illustration unavailable/)).toBeVisible()
      expect(screen.getByRole("button", { name: /Explore in 3D/ })).toBeVisible()
      expect(screen.queryByRole("img")).not.toBeInTheDocument()
    } finally { completed.mockRestore() }
  })

  it("keeps a new responsive-source failure when an old desktop decode completes later", async () => {
    let finishDesktop!: () => void, failMobile!: (reason: unknown) => void
    const desktop = new Promise<void>(resolve => { finishDesktop = resolve })
    const mobile = new Promise<void>((_, reject) => { failMobile = reject })
    render(<FacilityInspection {...props} />)
    const image = screen.getByRole("img") as HTMLImageElement
    let selectedSource = new URL(release.posters.desktop.url, document.baseURI).href
    Object.defineProperties(image, {
      currentSrc: { get: () => selectedSource }, naturalWidth: { value: 1200 }, complete: { value: true },
      decode: { value: vi.fn().mockReturnValueOnce(desktop).mockReturnValueOnce(mobile) },
    })
    fireEvent.load(image)
    await act(async () => { testMatchMedia.setMatches("(max-width: 639px)", true); await Promise.resolve() })
    selectedSource = new URL(release.posters.mobile.url, document.baseURI).href
    fireEvent.load(image)
    await act(async () => { failMobile(new Error("mobile decode failed")); await Promise.resolve() })
    expect(screen.getByText(/Facility illustration unavailable/)).toBeVisible()
    await act(async () => { finishDesktop(); await Promise.resolve() })
    expect(screen.getByText(/Facility illustration unavailable/)).toBeVisible()
  })

  it("poster release mode never offers or requests 3D", () => {
    render(<FacilityInspection {...props} mode="poster" />)
    expect(screen.queryByRole("button", { name: /Explore in 3D/ })).not.toBeInTheDocument()
    expect(renderer.render).not.toHaveBeenCalled()
  })
})

describe("facility graphics session", () => {
  it("keeps a WebKit null-relatedTarget blur from cancelling an internal still-image click", async () => {
    render(<FacilityInspection {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    act(() => { currentCanvas().onStaged(); currentCanvas().onPresented() })
    const summary = displayOptionsControl()
    const options = summary.closest("details")!
    summary.focus()
    openDisplayOptions()
    const button = screen.getByRole("button", { name: "Use still image" })
    fireEvent.pointerDown(button)
    fireEvent.mouseDown(button)
    // WebKit does not focus this button on pointer activation. Its preceding
    // focusout has no relatedTarget, while the pointer still belongs to it.
    fireEvent.blur(summary, { relatedTarget: null })
    expect(options).toHaveAttribute("open")
    fireEvent.pointerUp(button)
    fireEvent.mouseUp(button)
    fireEvent.click(button)
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "poster")
    expect(screen.queryByTestId("mock-facility-canvas")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Explore in 3D/ })).toHaveFocus()
  })

  it("preserves an internal checkbox click through WebKit ancestor focus and handles Escape from that ancestor", async () => {
    render(<article tabIndex={-1} aria-label="Decision"><FacilityInspection {...props} /></article>)
    fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    act(() => { currentCanvas().onStaged(); currentCanvas().onPresented() })
    const summary = displayOptionsControl(), options = summary.closest("details")!
    const ancestor = screen.getByRole("article", { name: "Decision" })
    openDisplayOptions()
    summary.focus()
    const equipment = screen.getByRole("checkbox", { name: "Equipment motion" }) as HTMLInputElement
    const initial = equipment.checked
    fireEvent.pointerDown(equipment)
    ancestor.focus()
    expect(options).toHaveAttribute("open")
    fireEvent.pointerUp(equipment)
    fireEvent.click(equipment)
    expect(equipment.checked).toBe(!initial)
    expect(options).toHaveAttribute("open")
    fireEvent.keyDown(ancestor, { key: "Escape" })
    expect(options).not.toHaveAttribute("open")
    expect(summary).toHaveFocus()
  })

  it("dismisses display options on an outside pointer or known outside focus without stealing focus", async () => {
    render(<FacilityInspection {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    act(() => { currentCanvas().onStaged(); currentCanvas().onPresented() })
    const summary = displayOptionsControl()
    const options = summary.closest("details")!
    const outside = screen.getByRole("button", { name: "Power" })
    openDisplayOptions()
    const equipment = screen.getByRole("checkbox", { name: "Equipment motion" })
    fireEvent.blur(summary, { relatedTarget: equipment })
    fireEvent.pointerDown(equipment)
    expect(options).toHaveAttribute("open")
    summary.focus()
    fireEvent.pointerDown(outside)
    expect(options).not.toHaveAttribute("open")
    expect(summary).toHaveFocus()
    openDisplayOptions()
    outside.focus()
    expect(options).not.toHaveAttribute("open")
    expect(outside).toHaveFocus()
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "ready")
  })

  it("removes outside-pointer dismissal when graphics close and when the inspector unmounts", async () => {
    const add = vi.spyOn(document, "addEventListener")
    const remove = vi.spyOn(document, "removeEventListener")
    const { unmount } = render(<FacilityInspection {...props} />)
    const pointerListeners = () => add.mock.calls.filter(([type]) => type === "pointerdown").map(([, listener]) => listener)
    expect(pointerListeners()).toHaveLength(0)
    fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    expect(pointerListeners()).toHaveLength(1)
    const first = pointerListeners()[0]
    fireEvent.click(stillImageControl())
    expect(remove).toHaveBeenCalledWith("pointerdown", first, true)
    fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
    expect(pointerListeners()).toHaveLength(2)
    const second = pointerListeners()[1]
    expect(second).not.toBe(first)
    unmount()
    expect(remove).toHaveBeenCalledWith("pointerdown", second, true)
  })

  it("keeps keyboard focus on Display options through loading and readiness, closes options with Escape, then restores Retry or Explore", async () => {
    const user = userEvent.setup()
    render(<FacilityInspection {...props} />)
    screen.getByRole("button", { name: /Explore in 3D/ }).focus()
    await user.keyboard("{Enter}")
    expect(displayOptionsControl()).toHaveFocus()
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    act(() => { currentCanvas().onStaged(); currentCanvas().onPresented() })
    expect(displayOptionsControl()).toHaveFocus()
    fireEvent.click(screen.getByRole("button", { name: "Power" }))
    await user.click(displayOptionsControl())
    expect(displayOptionsControl().closest("details")).toHaveAttribute("open")
    await user.tab()
    await user.keyboard("{Escape}")
    expect(displayOptionsControl().closest("details")).not.toHaveAttribute("open")
    expect(displayOptionsControl()).toHaveFocus()
    expect(screen.getByRole("button", { name: "Power" })).toHaveAttribute("aria-pressed", "true")
    act(() => currentCanvas().onFailure("context_lost"))
    expect(screen.getByRole("button", { name: "Retry 3D" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(displayOptionsControl()).toHaveFocus()
    await user.click(displayOptionsControl())
    await user.click(screen.getByRole("button", { name: "Use still image" }))
    expect(screen.getByRole("button", { name: /Explore in 3D/ })).toHaveFocus()
  })

  it("keeps the poster through staging, defaults mobile still, and rejects late callbacks after close", async () => {
    render(<FacilityInspection {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    const stale = currentCanvas()
    expect(stale.equipmentEnabled).toBe(false)
    act(() => stale.onStaged())
    expect(screen.getByRole("img")).toBeVisible()
    act(() => stale.onPresented())
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "ready")
    fireEvent.click(stillImageControl())
    expect(screen.getByRole("button", { name: /Explore in 3D/ })).toHaveFocus()
    act(() => { stale.onPresented(); stale.onFailure("late") })
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "poster")
    expect(screen.getByRole("img")).toBeVisible()
  })

  it("preserves Pause and equipment preferences through resetting an example", async () => {
    testMatchMedia.setMatches("(min-width: 1024px) and (hover: hover) and (pointer: fine)", true)
    const { rerender } = render(<FacilityInspection {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    act(() => { currentCanvas().onStaged(); currentCanvas().onPresented() })
    expect(equipmentMotionControl()).toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    fireEvent.click(equipmentMotionControl())
    fireEvent.click(screen.getByRole("button", { name: "Workloads" }))
    rerender(<FacilityInspection {...props} resetRevision={1} />)
    expect(screen.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-pressed", "true")
    expect(equipmentMotionControl()).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Workloads" })).toHaveAttribute("aria-pressed", "false")
  })

  it("offers explicit retry on a renderer failure without losing the current assessment", async () => {
    render(<FacilityInspection {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    act(() => currentCanvas().onFailure("context_lost"))
    expect(screen.getByRole("button", { name: "Retry 3D" })).toBeVisible()
    expect(within(screen.getByTestId("facility-assessment-caption")).getByText("5.8 MW")).toBeVisible()
    expect(screen.getByRole("img")).toBeVisible()
  })

  it("uses one eight-second deadline across import and staging, then requires explicit retry", async () => {
    vi.useFakeTimers()
    render(<FacilityInspection {...props} />)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ })); await vi.advanceTimersByTimeAsync(4_000) })
    expect(renderer.render).toHaveBeenCalled()
    act(() => currentCanvas().onStaged())
    await act(async () => { await vi.advanceTimersByTimeAsync(3_999) })
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "staging")
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "failed")
    expect(screen.getByRole("button", { name: "Retry 3D" })).toBeVisible()
  })

  it("loads automatically only after poster decode and 25% visibility, rechecks preferences, and stays closed", async () => {
    testMatchMedia.setMatches("(min-width: 1024px) and (hover: hover) and (pointer: fine)", true)
    let intersection: IntersectionObserverCallback = () => {}
    vi.stubGlobal("IntersectionObserver", class { constructor(callback: IntersectionObserverCallback) { intersection = callback } observe() {} disconnect() {} })
    const idles: (() => void)[] = []
    vi.stubGlobal("requestIdleCallback", vi.fn((callback: () => void) => { idles.push(callback); return idles.length }))
    vi.stubGlobal("cancelIdleCallback", vi.fn())
    render(<><button type="button">Outside inspector</button><FacilityInspection {...props} loadingPolicy="auto-desktop" /></>)
    const outside = screen.getByRole("button", { name: "Outside inspector" })
    outside.focus()
    act(() => { intersection([{ isIntersecting: true, intersectionRatio: 0.2 } as IntersectionObserverEntry], {} as IntersectionObserver) })
    expect(idles).toHaveLength(0)
    const image = screen.getByRole("img")
    Object.defineProperty(image, "naturalWidth", { value: 1200 })
    Object.defineProperty(image, "complete", { value: true })
    fireEvent.load(image)
    expect(idles).toHaveLength(0)
    act(() => { intersection([{ isIntersecting: true, intersectionRatio: 0.3 } as IntersectionObserverEntry], {} as IntersectionObserver) })
    expect(idles).toHaveLength(1)
    act(() => { testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", true); idles[0]() })
    expect(renderer.render).not.toHaveBeenCalled()
    act(() => { testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", false) })
    act(() => idles[idles.length - 1]())
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    expect(outside).toHaveFocus()
    act(() => { currentCanvas().onStaged(); currentCanvas().onPresented() })
    expect(outside).toHaveFocus()
    fireEvent.click(stillImageControl())
    const idleCount = idles.length
    act(() => { intersection([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver) })
    act(() => { intersection([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver) })
    expect(idles).toHaveLength(idleCount)
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "poster")
  })
})


const engineeringRelease: FacilityVisualRelease = {
  ...release, release: "facility-v4", profile: { ...release.profile, engineering: {
    version: 1, seed: 42,
    accent: { resting: "#a97132", hover: "#ffd18a", selected: "#ffbd59", previewWeight: .8, baseEmission: .2, activeEmission: 1.5, transitionMs: 160 },
    activity: { resting: .3, peak: 1, steady: .7, pulseMs: [100, 180], eventMs: [200, 600], maxPulses: 4, ambientTraceSeconds: [5, 10], selectedTraceQuietSeconds: 3 },
    cameraTransitionMs: 360, poseTransitionMs: 420,
    rendering: { ambientFps: 30, interactionFps: 60, mobilePixels: 400000, desktopPixels: 1200000, probeSeconds: 2 },
  } },
  specimens: { rack: { kind: "rack", label: "Server rack", system: "workloads", model: file("/rack.glb"), posters: { closed: file("/rack.webp"), cutaway: file("/rack-cutaway.webp") }, profile: release.profile, requiredIds: [] } },
}
const specimenMetadata: FacilitySceneMetadata = { specimen: { schemaVersion: "facility-specimen.v1", kind: "rack", system: "workloads", parts: Array.from({ length: 6 }, (_, index) => ({ id: `part-${index}`, index, label: `Rack part ${index + 1}`, role: "Authored rack component", objectId: `GN_PART_${index}`, bounds: { min: [0, 0, 0], max: [1, 1, 1] }, connections: [] })), poses: Object.fromEntries(["closed", "cutaway", "service"].map(pose => [pose, { camera: { camera: [1, 1, 1], target: [0, 0, 0], padding: 1.12 }, transforms: [] }])) as unknown as NonNullable<FacilitySceneMetadata["specimen"]>["poses"] } }

const ecosystemRelease: FacilityVisualRelease = { ...engineeringRelease, release: "facility-v6", profile: { ...engineeringRelease.profile, ecosystem: {
  version: 1, seed: 42, ambientIntervalSeconds: [8, 12], sequenceSeconds: 24, chapterSeconds: [4, 4, 5, 4, 4, 3],
  colors: { electrical: "#e6e6df", cooling: "#7cbcc5", heat: "#bc8d68" }, fanModulation: .12, maxEquipment: 96, maxRoutes: 128, maxTraces: 2,
} } }

const nightRelease: FacilityVisualRelease = {
  ...ecosystemRelease, release: "facility-v7",
  profile: { ...ecosystemRelease.profile, inspection: {
    version: 1, fitSubjects: { overview: { min: [-5, 0, -5], max: [5, 4, 5] }, "air-path": { min: [-4, 1, -4], max: [4, 4, 4] } },
    details: { rack: { camera: [2, 2, 2], target: [0, 1, 0], padding: 1.12, projection: "perspective", fov: 32 }, "air-path": { camera: [3, 4, 3], target: [0, 2, 0], padding: 1.12, projection: "perspective", fov: 32 } },
  } },
  equipmentIndex: { schemaVersion: "facility-equipment-index.v1", equipment: [{ id: "rack-02", label: "Rack 03", system: "workloads", role: "rack", bounds: { min: [0, 0, 0], max: [1, 1, 1] } }] },
}

describe("v7 public identities and explicit construction views", () => {
  it("reserves the requested rack layout before readiness and restores the usable view on failure", async () => {
    const portraitRelease = { ...nightRelease, profile: { ...nightRelease.profile, inspection: { ...nightRelease.profile.inspection!, mobileRackAspect: .85 } } }
    render(<FacilityInspection {...props} release={portraitRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    const inspector = screen.getByTestId("facility-inspection"), stage = inspector.querySelector(".facility-stage")!
    fireEvent.click(await screen.findByRole("button", { name: "Inspect rack construction" }))
    const requested = currentCanvas().view!
    expect(stage).toHaveAttribute("data-assembly", "rack")
    expect(stage).toHaveAttribute("aria-label", "Facility model")
    expect(inspector).toHaveAttribute("data-view", "overview")
    expect(inspector.querySelector(".facility-rack-handle-controls")).toHaveAttribute("data-pending", "true")
    expect(screen.queryByRole("group", { name: "Rack handle actions" })).toBeNull()
    act(() => currentCanvas().onAssetState!({ phase: "loading", view: requested }))
    expect(stage).toHaveAttribute("aria-busy", "true")
    act(() => currentCanvas().onAssetState!({ phase: "failed", view: requested, reason: "Test failure" }))
    expect(stage).not.toHaveAttribute("data-assembly")
    expect(inspector.querySelector(".facility-rack-handle-controls")).toBeNull()
    expect(inspector).toHaveAttribute("data-view", "overview")
    act(() => currentCanvas().onAssetState!({ phase: "loading", view: requested }))
    expect(stage).toHaveAttribute("data-assembly", "rack")
    act(() => { currentCanvas().onMetadata!(specimenMetadata); currentCanvas().onAssetState!({ phase: "ready", view: requested }) })
    expect(stage).toHaveAttribute("data-assembly", "rack")
    expect(inspector).toHaveAttribute("data-view", "rack")
    expect(stage).toHaveAttribute("aria-busy", "false")
  })

  it("keeps modern poster rollback useful without exposing a dead construction activation", async () => {
    vi.useFakeTimers()
    const markup = renderToStaticMarkup(<FacilityInspection {...props} release={nightRelease} mode="poster" activateOnMount />)
    expect(markup).not.toContain("Load 3D to inspect construction")
    expect(markup).not.toContain("View rack close-up")
    expect(markup).toContain('id="facility-construction"')
    render(<FacilityInspection {...props} release={nightRelease} mode="poster" activateOnMount initialTarget={{ system: "workloads", equipmentId: "rack-02" }} />)
    const inspector = screen.getByTestId("facility-inspection")
    expect(screen.queryByRole("button", { name: /Explore in 3D|Retry 3D|Load 3D|View rack close-up|View air-path cutaway|Inspect rack construction|Inspect cooling construction/ })).toBeNull()
    expect(inspector).toHaveTextContent("Connection details are not available in this still illustration")
    fireEvent.click(screen.getByRole("button", { name: "Cooling" }))
    expect(screen.getByRole("button", { name: "Cooling" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("facility-contextual-inspector")).toHaveTextContent("Evidence")
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    const story = screen.getByTestId("facility-ecosystem-story")
    expect(within(story).getByRole("button", { name: "Play story" })).toBeDisabled()
    expect(story).toHaveTextContent("This example uses a still illustration")
    fireEvent.click(within(story).getByRole("button", { name: "Chapter 6: Evidence" }))
    expect(within(story).getByRole("link", { name: "Read the versioned brief" })).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
    await act(async () => { await vi.advanceTimersByTimeAsync(9_000) })
    expect(inspector).toHaveAttribute("data-phase", "poster")
    expect(inspector).not.toHaveTextContent("Preparing the facility view")
    expect(inspector).not.toHaveTextContent("3D could not be displayed")
    expect(renderer.render).not.toHaveBeenCalled()
  })

  it.each(["demo", "hero"] as const)("offers an honest explicit construction action for a rear rack in %s", async variant => {
    const rearRelease: FacilityVisualRelease = { ...nightRelease, equipmentIndex: { schemaVersion: "facility-equipment-index.v1", equipment: [
      { id: "rack-02", label: "Rack 03", system: "workloads", role: "server_rack", bounds: { min: [0, 0, 1], max: [1, 3, 2] } },
      { id: "rack-06", label: "Rack 07", system: "workloads", role: "server_rack", bounds: { min: [0, 0, -2], max: [1, 3, -1] } },
    ] } }
    render(<FacilityInspection {...props} release={rearRelease} record={assessmentFixtures.d} variant={variant} topic="colocation" initialTarget={{ system: "workloads", equipmentId: "rack-06" }} loadingPolicy="auto-adaptive" />)
    if (variant === "hero") {
      const journey = screen.getByRole("navigation", { name: "Continue facility inspection" })
      expect(within(journey).getByRole("link", { name: "Inspect rack construction" })).toHaveAttribute("href", "/demo?scenario=d&version=1.0.0&perspective=business&focus=rack-06&topic=colocation#facility-construction")
      expect(within(journey).getByRole("link", { name: "Follow one workload" })).toHaveAttribute("href", "/demo?scenario=d&version=1.0.0&perspective=business&focus=rack-06&topic=colocation#workload-story")
      expect(screen.queryByRole("button", { name: "View rack close-up" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Inspect rack construction" })).not.toBeInTheDocument()
      expect(screen.getByTestId("facility-assessment-caption")).toHaveTextContent("Unknown")
      expect(renderer.render).not.toHaveBeenCalled()
      return
    }
    await activateEcosystem()
    expect(screen.queryByTestId("facility-rack-occlusion")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "View rack close-up" }))
    expect(currentCanvas().view).toEqual({ kind: "overview", detail: "rack", equipmentId: "rack-06" })
    act(() => currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }))
    expect(screen.getByTestId("facility-rack-occlusion")).toHaveTextContent("In-place detail: Rack 07")
    expect(screen.getByTestId("facility-assessment-caption")).toHaveTextContent("Unknown")
    // Until this explicit action, the request remains the overview asset.
    expect(currentCanvas().view!.kind).toBe("overview")
    fireEvent.click(screen.getByRole("button", { name: "Open representative rack assembly" }))
    expect(currentCanvas().view).toEqual({ kind: "specimen", specimen: "rack", pose: "closed" })
    act(() => { currentCanvas().onMetadata!(specimenMetadata); currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }) })
    fireEvent.click(await screen.findByRole("button", { name: "Return to facility" }))
    expect(currentCanvas().view).toEqual({ kind: "overview", detail: "rack", equipmentId: "rack-06" })
    act(() => currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }))
    fireEvent.click(screen.getByRole("button", { name: "Return to overview" }))
    act(() => currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }))
    expect(screen.queryByTestId("facility-rack-occlusion")).toBeNull()
  })

  it("does not commit a stale graphics pick to browser history after Close in the same event turn", async () => {
    const committed = vi.fn()
    render(<FacilityInspection {...props} release={nightRelease} loadingPolicy="auto-adaptive" onCommittedTarget={committed} />)
    await activateEcosystem()
    const stale = currentCanvas()
    act(() => {
      stillImageControl().click()
      stale.onTarget!({ system: "power" })
    })
    expect(committed).not.toHaveBeenCalled()
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "poster")
  })

  it("renders authored identities before graphics, commits clicks only, and restores history focus without remounting", () => {
    const committed = vi.fn()
    const { rerender } = render(<FacilityInspection {...props} release={nightRelease} mode="poster" initialTarget={{ system: "workloads", equipmentId: "rack-02" }} onCommittedTarget={committed} />)
    expect(screen.getByText("Selected equipment: Rack 03")).toBeVisible()
    expect(renderer.render).not.toHaveBeenCalled()
    const cooling = screen.getByRole("button", { name: "Cooling" })
    fireEvent.focus(cooling)
    expect(committed).not.toHaveBeenCalled()
    fireEvent.click(cooling)
    expect(committed).toHaveBeenLastCalledWith({ system: "cooling" })
    expect(document.querySelectorAll(".facility-explanation-copy > p")).toHaveLength(1)
    rerender(<FacilityInspection {...props} release={nightRelease} mode="poster" initialTarget={{ system: "workloads", equipmentId: "rack-02" }} resetRevision={1} onCommittedTarget={committed} />)
    expect(screen.getByText("Selected equipment: Rack 03")).toBeVisible()
    expect(committed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("button", { name: "View rack close-up" })).toBeNull()
  })

  it("exits the story only on an explicit close-up and retains the system on returning to overview", async () => {
    render(<FacilityInspection {...props} release={nightRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    expect(currentCanvas().presentation?.chapter).toBe(0)
    fireEvent.click(screen.getByRole("button", { name: "View rack close-up" }))
    expect(currentCanvas().presentation?.chapter).toBeNull()
    expect(currentCanvas().view).toEqual({ kind: "overview", detail: "rack", equipmentId: "rack-02" })
    act(() => currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }))
    fireEvent.click(screen.getByRole("button", { name: "Cooling" }))
    fireEvent.click(screen.getByRole("button", { name: "Return to overview" }))
    expect(currentCanvas().view).toEqual({ kind: "overview" })
    expect(currentCanvas().target).toEqual({ system: "cooling" })
  })
})

async function activateEcosystem() {
  fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
  await waitFor(() => expect(renderer.render).toHaveBeenCalled())
  act(() => { currentCanvas().onStaged(); currentCanvas().onPresented(); currentCanvas().onQuality!("balanced") })
  await waitFor(() => expect(screen.getByRole("button", { name: "Follow one workload" })).toBeVisible())
}

describe("facility-v6 record-backed workload story", () => {
  it("offers all six HTML chapters in poster mode without importing graphics and retains B's exact revision", () => {
    render(<FacilityInspection {...props} release={ecosystemRelease} mode="poster" variant="demo" />)
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    const story = screen.getByTestId("facility-ecosystem-story")
    expect(story).toHaveAttribute("data-chapter", "0")
    expect(story).toHaveAttribute("data-playing", "false")
    expect(story).toHaveTextContent("Rack 03")
    expect(story).toHaveTextContent("whole facility")
    expect(screen.getByRole("button", { name: "Play story" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Chapter 5: Screening result" }))
    expect(story).toHaveTextContent(assessmentFixtures.b.conclusion)
    expect(story.querySelector("details")).toHaveTextContent("7.0 MW")
    expect(story.querySelector("details")).toHaveTextContent("5.8 MW")
    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }))
    expect(within(story).getByRole("link", { name: "Read the versioned brief" })).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
    fireEvent.click(screen.getByRole("button", { name: "Finish story" }))
    expect(screen.queryByTestId("facility-ecosystem-story")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Follow one workload" })).toHaveFocus()
    expect(renderer.render).not.toHaveBeenCalled()
  })

  it("opens still, separates transport and seek revisions, and rejects stale checkpoints", async () => {
    render(<FacilityInspection {...props} release={ecosystemRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    const opened = currentCanvas().presentation!
    expect(opened).toMatchObject({ chapter: 0, playing: false, rackId: "rack-02", coolingEvidence: "available" })
    expect(screen.queryByRole("button", { name: "Explain this assessment" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    const playing = currentCanvas().presentation!
    expect(playing.revision).toBeGreaterThan(opened.revision)
    expect(playing.seekRevision).toBe(opened.seekRevision)
    expect(playing.playing).toBe(true)
    act(() => currentCanvas().onPresentationCheckpoint!({ revision: playing.revision, chapter: 1, playing: true }))
    expect(screen.getByTestId("facility-ecosystem-story")).toHaveAttribute("data-chapter", "1")
    fireEvent.click(screen.getByRole("button", { name: "Pause story" }))
    const paused = currentCanvas().presentation!
    expect(paused.seekRevision).toBe(playing.seekRevision)
    act(() => currentCanvas().onPresentationCheckpoint!({ revision: playing.revision, chapter: 4, playing: true }))
    expect(currentCanvas().presentation).toEqual(paused)
    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }))
    expect(currentCanvas().presentation).toMatchObject({ chapter: 2, playing: false, seekRevision: paused.seekRevision + 1 })
    fireEvent.click(screen.getByRole("button", { name: "Replay story" }))
    expect(currentCanvas().presentation).toMatchObject({ chapter: 0, playing: true, seekRevision: paused.seekRevision + 2 })
  })

  it("lets D stop at missing cooling, continue manually to NO-PROOF and replay only the supported opening", async () => {
    render(<FacilityInspection {...props} release={ecosystemRelease} record={assessmentFixtures.d} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    const playing = currentCanvas().presentation!
    expect(playing.coolingEvidence).toBe("missing")
    act(() => currentCanvas().onPresentationCheckpoint!({ revision: playing.revision, chapter: 2, playing: false, reason: "cooling-missing" }))
    expect(screen.getByTestId("facility-ecosystem-story")).toHaveTextContent("Cooling evidence is missing")
    expect(screen.getByRole("button", { name: "Play story" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }))
    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }))
    expect(screen.getByTestId("facility-ecosystem-story")).toHaveTextContent("NO-PROOF")
    expect(screen.getByTestId("facility-ecosystem-story")).toHaveTextContent("Unknown")
    expect(screen.getByTestId("facility-inspection")).not.toHaveTextContent("5.8 MW")
    expect(screen.queryByText("Compare the recorded revision")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Replay story" }))
    expect(currentCanvas().presentation).toMatchObject({ chapter: 0, playing: true })
  })

  it("keeps hover previews separate and clears stories for manual inspection or record/reset changes", async () => {
    const { rerender } = render(<FacilityInspection {...props} release={ecosystemRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Cooling" }), { pointerType: "mouse", buttons: 0 })
    expect(screen.getByTestId("facility-ecosystem-story")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Cooling" }))
    expect(screen.queryByTestId("facility-ecosystem-story")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    rerender(<FacilityInspection {...props} release={ecosystemRelease} record={assessmentFixtures.d} loadingPolicy="auto-adaptive" />)
    expect(screen.queryByTestId("facility-ecosystem-story")).not.toBeInTheDocument()
    expect(currentCanvas().presentation).toMatchObject({ chapter: null, coolingEvidence: "missing", playing: false })
    expect(screen.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    rerender(<FacilityInspection {...props} release={ecosystemRelease} record={assessmentFixtures.d} resetRevision={1} loadingPolicy="auto-adaptive" />)
    expect(screen.queryByTestId("facility-ecosystem-story")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-pressed", "true")
  })

  it("never resumes a story automatically after pause, equipment-off or quality demotion", async () => {
    render(<FacilityInspection {...props} release={ecosystemRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(currentCanvas().presentation?.playing).toBe(false)
    expect(screen.getByRole("button", { name: "Play story" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    expect(currentCanvas().presentation?.playing).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    fireEvent.click(equipmentMotionControl())
    expect(currentCanvas().presentation?.playing).toBe(false)
    fireEvent.click(equipmentMotionControl())
    expect(currentCanvas().presentation?.playing).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    act(() => currentCanvas().onQuality!("still"))
    expect(currentCanvas().presentation?.playing).toBe(false)
    expect(screen.getByRole("button", { name: "Play story" })).toBeDisabled()
    act(() => currentCanvas().onQuality!("balanced"))
    expect(currentCanvas().presentation?.playing).toBe(false)
  })

  it("keeps readable chapters after graphics failure and exposes an explicit air-path section", async () => {
    render(<FacilityInspection {...props} release={ecosystemRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    const generation = currentCanvas().generation
    fireEvent.click(screen.getByRole("button", { name: "Show air-path section" }))
    expect(currentCanvas().view).toEqual({ kind: "overview", section: "air-path" })
    expect(currentCanvas().generation).toBe(generation)
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    expect(currentCanvas().view).toEqual({ kind: "overview" })
    const stale = currentCanvas()
    act(() => stale.onFailure("context_lost"))
    expect(screen.getByTestId("facility-ecosystem-story")).toBeVisible()
    expect(screen.getByRole("button", { name: "Play story" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Chapter 6: Evidence" }))
    expect(within(screen.getByTestId("facility-ecosystem-story")).getByRole("link", { name: "Read the versioned brief" })).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
    act(() => stale.onPresentationCheckpoint!({ revision: stale.presentation!.revision, chapter: 0, playing: true }))
    expect(screen.getByTestId("facility-ecosystem-story")).toHaveAttribute("data-chapter", "5")
  })

  it("follows the selected authored rack, preserves it across chapters, and recovers focus on Escape", async () => {
    render(<FacilityInspection {...props} release={ecosystemRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    const metadata: FacilitySceneMetadata = { topology: { schemaVersion: "facility-topology.v2", equipment: [
      { id: "rack-08", index: 0, label: "Rack 09", system: "workloads", role: "server_rack", bounds: { min: [0, 0, 0], max: [1, 1, 1] }, diagram: [0, 0] },
    ], ports: [], routes: [], internalLinks: [] } }
    act(() => { currentCanvas().onMetadata!(metadata); currentCanvas().onAssetState!({ phase: "ready", view: { kind: "overview" } }) })
    await screen.findByRole("button", { name: "Authored equipment connections" })
    fireEvent.click(screen.getByRole("button", { name: "Authored equipment connections" }))
    fireEvent.click(screen.getByRole("button", { name: "Show full topology" }))
    fireEvent.click(screen.getByRole("button", { name: "1. Rack 09" }))
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    expect(currentCanvas().presentation?.rackId).toBe("rack-08")
    expect(screen.getByTestId("facility-ecosystem-story")).toHaveTextContent("Rack 09")
    fireEvent.click(screen.getByRole("button", { name: "Chapter 3: Air and cooling" }))
    expect(currentCanvas().presentation?.rackId).toBe("rack-08")
    fireEvent.keyDown(screen.getByRole("button", { name: "Next chapter" }), { key: "Escape" })
    expect(screen.getByRole("button", { name: "Follow one workload" })).toHaveFocus()
    expect(screen.queryByTestId("facility-ecosystem-story")).not.toBeInTheDocument()
  })

  it("respects reduced motion while retaining all chapter content and a still replay", async () => {
    testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", true)
    render(<FacilityInspection {...props} release={ecosystemRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    expect(screen.getByRole("button", { name: "Play story" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Chapter 5: Screening result" }))
    expect(screen.getByTestId("facility-ecosystem-story")).toHaveTextContent(assessmentFixtures.b.conclusion)
    fireEvent.click(screen.getByRole("button", { name: "Replay story" }))
    expect(currentCanvas().presentation).toMatchObject({ chapter: 0, playing: false })
  })

  it("synchronizes partial diagram paths and HTML identities without committing selection, and keeps D section closed", async () => {
    const { rerender } = render(<FacilityInspection {...props} release={ecosystemRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    const topology = ecosystemTopologySource as FacilityTopology
    act(() => { currentCanvas().onMetadata!({ topology }); currentCanvas().onAssetState!({ phase: "ready", view: { kind: "overview" } }) })
    fireEvent.click(await screen.findByRole("button", { name: "Authored equipment connections" }))
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    fireEvent.click(screen.getByRole("button", { name: "Chapter 2: Electrical path" }))
    const inspector = screen.getByTestId("facility-inspection")
    const rack = topology.ecosystem!.racks.find(item => item.equipmentId === "rack-02")!
    const paths = Array.from(inspector.querySelectorAll<SVGPathElement>("[data-story-route]"))
    expect(new Set(paths.map(path => path.dataset.storyRoute))).toEqual(new Set(rack.electrical.map(segment => segment.routeId)))
    const branch = paths.find(path => Number(path.dataset.toS) < 1)!
    expect(branch).toBeDefined()
    expect(branch).toHaveAttribute("mask")
    expect(inspector.querySelector('[data-story-equipment="rack-02"]')).toBeInTheDocument()
    expect(currentCanvas().target).toBeNull()
    expect(screen.getByRole("list", { name: "Connection media" })).toHaveTextContent("Electrical · solid")
    expect(screen.getByRole("list", { name: "Connection media" })).toHaveTextContent("Air · dashed")
    expect(screen.getByRole("list", { name: "Connection media" })).toHaveTextContent("Water · dotted")
    const routeButton = inspector.querySelector<HTMLButtonElement>(`button[data-route-id="${rack.electrical[0].routeId}"]`)!
    expect(routeButton).toHaveAttribute("aria-pressed", "false")
    expect(routeButton).toHaveAttribute("data-story-active", "true")
    fireEvent.click(routeButton)
    expect(currentCanvas().target?.routeId).toBe(rack.electrical[0].routeId)
    expect(screen.queryByTestId("facility-ecosystem-story")).not.toBeInTheDocument()
    expect(inspector.querySelectorAll("[data-story-route]")).toHaveLength(0)
    rerender(<FacilityInspection {...props} release={ecosystemRelease} record={assessmentFixtures.d} loadingPolicy="auto-adaptive" />)
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    fireEvent.click(screen.getByRole("button", { name: "Chapter 3: Air and cooling" }))
    expect(inspector.querySelectorAll("[data-story-route]")).toHaveLength(0)
    expect(screen.getByRole("button", { name: "Show air-path section" })).toHaveAttribute("aria-pressed", "false")
  })

  it("settles pending focus scroll even for a visible stage and cancels alignment on pause", async () => {
    render(<FacilityInspection {...props} release={ecosystemRelease} loadingPolicy="auto-adaptive" />)
    await activateEcosystem()
    const stage = screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-stage")!
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ top: 160, bottom: 400, left: 0, right: 375, width: 375, height: 240 } as DOMRect)
    vi.spyOn(screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-heading")!, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 144, left: 0, right: 375, width: 375, height: 44 } as DOMRect)
    stage.style.scrollMarginTop = "80px"
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    fireEvent.click(screen.getByRole("button", { name: "Follow one workload" }))
    scroll.mockClear()
    const frames = new Map<number, FrameRequestCallback>(); let frame = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frame, callback); return frame })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
    const paint = () => act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(10)) })
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    expect(scroll).not.toHaveBeenCalled()
    paint(); expect(scroll).not.toHaveBeenCalled()
    paint(); expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll).toHaveBeenLastCalledWith({ top: 20, left: 0, behavior: "instant" })
    fireEvent.click(screen.getByRole("button", { name: "Pause story" }))
    fireEvent.click(screen.getByRole("button", { name: "Play story" }))
    paint()
    fireEvent.click(screen.getByRole("button", { name: "Pause story" }))
    paint(); expect(scroll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Next chapter" }))
    paint(); expect(scroll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Replay story" }))
    paint(); paint(); expect(scroll).toHaveBeenCalledTimes(2)
  })
})

async function activateEngineering() {
  fireEvent.click(screen.getByRole("button", { name: /Explore in 3D/ }))
  await waitFor(() => expect(renderer.render).toHaveBeenCalled())
  act(() => { currentCanvas().onStaged(); currentCanvas().onPresented() })
  await waitFor(() => expect(screen.getByRole("button", { name: "Explain this assessment" })).toBeVisible())
}

describe("facility-v4 engineering experience", () => {
  it("keeps heading controls accessible when a zoomed visual viewport cannot fit the whole stage", async () => {
    render(<FacilityInspection {...props} release={engineeringRelease} />)
    await activateEngineering()
    const inspector = screen.getByTestId("facility-inspection")
    const stage = inspector.querySelector<HTMLElement>(".facility-stage")!
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ top: 200, bottom: 600, left: 0, right: 375, width: 375, height: 400 } as DOMRect)
    vi.spyOn(inspector.querySelector<HTMLElement>(".facility-heading")!, "getBoundingClientRect").mockReturnValue({ top: 100, bottom: 180, left: 0, right: 375, width: 375, height: 80 } as DOMRect)
    stage.style.scrollMarginTop = "86px"
    vi.stubGlobal("visualViewport", { offsetTop: 37, offsetLeft: 12, height: 220, width: 320 })
    vi.stubGlobal("scrollY", 500); vi.stubGlobal("scrollX", 17)
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const power = screen.getByRole("button", { name: "Power" })
    fireEvent.click(power)
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 477, left: 17, behavior: "instant" })
    fireEvent.pointerEnter(power, { pointerType: "mouse", buttons: 0 }); fireEvent.focus(power)
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it("corrects one explicit view after its committed layout and never follows later paints", async () => {
    render(<FacilityInspection {...props} release={engineeringRelease} />)
    await activateEngineering()
    const stage = screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-stage")!
    const bounds = vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ top: -400, bottom: -160, left: 0, right: 375, width: 375, height: 240 } as DOMRect)
    stage.style.scrollMarginTop = "86px"
    vi.spyOn(screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-heading")!, "getBoundingClientRect").mockImplementation(() => ({ ...stage.getBoundingClientRect(), top: stage.getBoundingClientRect().top - 40 }))
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const frames = new Map<number, FrameRequestCallback>(); let frame = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frame, callback); return frame })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
    const paint = () => act(() => { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback(10)) })
    fireEvent.click(screen.getByRole("button", { name: "Inspect rack construction" }))
    expect(scroll).toHaveBeenCalledTimes(1)
    // The first reveal used the old DOM. An inserted/removed action rail can
    // shift the committed stage behind the header without moving the camera.
    vi.stubGlobal("scrollY", 500)
    vi.stubGlobal("scrollX", 17)
    bounds.mockReturnValue({ top: 120, bottom: 360, left: 0, right: 375, width: 375, height: 240 } as DOMRect)
    vi.spyOn(screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-heading")!, "getBoundingClientRect").mockReturnValue({ top: 28, bottom: 72, left: 0, right: 375, width: 375, height: 44 } as DOMRect)
    act(() => { currentCanvas().onMetadata!(specimenMetadata); currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }) })
    paint(); expect(scroll).toHaveBeenCalledTimes(1)
    paint(); expect(scroll).toHaveBeenCalledTimes(2)
    expect(scroll).toHaveBeenLastCalledWith({ top: 442, left: 17, behavior: "instant" })
    expect(stage).toHaveFocus()
    paint(); paint(); expect(scroll).toHaveBeenCalledTimes(2)
  })

  it.each(["wheel", "Tab", "hidden", "joint", "failure", "close"] as const)("cancels a queued view reveal after %s instead of taking the visitor back", async reason => {
    render(<FacilityInspection {...props} release={engineeringRelease} />)
    await activateEngineering()
    const stage = screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-stage")!
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ top: -400, bottom: -160, left: 0, right: 375, width: 375, height: 240 } as DOMRect)
    vi.spyOn(screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-heading")!, "getBoundingClientRect").mockImplementation(() => ({ ...stage.getBoundingClientRect(), top: stage.getBoundingClientRect().top - 40 }))
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const frames = new Map<number, FrameRequestCallback>(); let frame = 0
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frame, callback); return frame })
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
    const paint = () => act(() => { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback(10)) })
    fireEvent.click(screen.getByRole("button", { name: "Inspect rack construction" }))
    act(() => { currentCanvas().onMetadata!(specimenMetadata); currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }) })
    paint()
    expect(scroll).toHaveBeenCalledTimes(1)
    const visibility = vi.spyOn(document, "visibilityState", "get")
    try {
      if (reason === "wheel") fireEvent.wheel(window)
      if (reason === "Tab") fireEvent.keyDown(window, { key: "Tab" })
      if (reason === "hidden") { visibility.mockReturnValue("hidden"); fireEvent(document, new Event("visibilitychange")) }
      if (reason === "joint") fireEvent.click(screen.getByRole("button", { name: "Reveal interior" }))
      if (reason === "failure") act(() => currentCanvas().onAssetState!({ phase: "failed", view: currentCanvas().view!, reason: "model" }))
      if (reason === "close") fireEvent.click(stillImageControl())
      paint(); paint()
      expect(scroll).toHaveBeenCalledTimes(1)
    } finally { visibility.mockRestore() }
  })

  it("reveals explicit offscreen entry and return without scrolling for previews or repeated assembly actions", async () => {
    render(<FacilityInspection {...props} release={engineeringRelease} />)
    await activateEngineering()
    const stage = screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-stage")!
    const bounds = vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ top: -400, bottom: -160, left: 0, right: 375, width: 375, height: 240 } as DOMRect)
    stage.style.scrollMarginTop = "86px"
    vi.spyOn(screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-heading")!, "getBoundingClientRect").mockImplementation(() => ({ ...stage.getBoundingClientRect(), top: stage.getBoundingClientRect().top - 40 }))
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    const power = screen.getByRole("button", { name: /^Power$/ })
    fireEvent.pointerEnter(power, { pointerType: "mouse", buttons: 0 })
    fireEvent.focus(power)
    expect(scroll).not.toHaveBeenCalled()
    fireEvent.click(power)
    expect(scroll).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" })
    scroll.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Inspect rack construction" }))
    expect(scroll).toHaveBeenCalledTimes(1)
    act(() => { currentCanvas().onMetadata!(specimenMetadata); currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }) })
    fireEvent.click(screen.getByRole("button", { name: "Reveal interior" }))
    expect(scroll).toHaveBeenCalledTimes(1)
    act(() => currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }))
    openAssemblyParts()
    fireEvent.click(screen.getByRole("button", { name: /Rack part 1/ }))
    expect(scroll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Extend server tray" }))
    expect(scroll).toHaveBeenCalledTimes(1)
    act(() => currentCanvas().onAssetState!({ phase: "failed", view: currentCanvas().view!, reason: "model" }))
    fireEvent.click(screen.getByRole("button", { name: "Retry assembly" }))
    expect(scroll).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole("button", { name: "Return to facility" }))
    expect(scroll).toHaveBeenCalledTimes(3)
    bounds.mockReturnValue({ top: 200, bottom: 440, left: 0, right: 375, width: 375, height: 240 } as DOMRect)
    fireEvent.click(power)
    expect(scroll).toHaveBeenCalledTimes(3)
  })

  it("reveals a live specimen return for reset and walkthrough without scrolling an ordinary overview reset", async () => {
    const { rerender } = render(<FacilityInspection {...props} release={engineeringRelease} />)
    await activateEngineering()
    const stage = screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-stage")!
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ top: -400, bottom: -160, left: 0, right: 375, width: 375, height: 240 } as DOMRect)
    vi.spyOn(screen.getByTestId("facility-inspection").querySelector<HTMLElement>(".facility-heading")!, "getBoundingClientRect").mockImplementation(() => ({ ...stage.getBoundingClientRect(), top: stage.getBoundingClientRect().top - 40 }))
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {})
    rerender(<FacilityInspection {...props} release={engineeringRelease} resetRevision={1} />)
    expect(scroll).not.toHaveBeenCalled()
    const openRack = () => {
      fireEvent.click(screen.getByRole("button", { name: "Inspect rack construction" }))
      act(() => { currentCanvas().onMetadata!(specimenMetadata); currentCanvas().onAssetState!({ phase: "ready", view: currentCanvas().view! }) })
      scroll.mockClear()
    }
    openRack()
    rerender(<FacilityInspection {...props} release={engineeringRelease} resetRevision={2} />)
    expect(currentCanvas().view).toEqual({ kind: "overview" })
    expect(scroll).toHaveBeenCalledTimes(1)
    act(() => currentCanvas().onAssetState!({ phase: "ready", view: { kind: "overview" } }))
    openRack()
    fireEvent.click(screen.getByRole("button", { name: "Explain this assessment" }))
    expect(currentCanvas().view).toEqual({ kind: "overview" })
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it("retains the old assembly and callouts until replacement is ready, and retries without remounting the canvas", async () => {
    render(<FacilityInspection {...props} release={engineeringRelease} />)
    await activateEngineering()
    const generation = currentCanvas().generation
    fireEvent.click(screen.getByRole("button", { name: "Inspect rack construction" }))
    const requested = currentCanvas().view!
    expect(requested).toEqual({ kind: "specimen", specimen: "rack", pose: "closed" })
    act(() => { currentCanvas().onAssetState!({ phase: "loading", view: requested }); currentCanvas().onMetadata!(specimenMetadata) })
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-view", "overview")
    expect(screen.queryByRole("button", { name: /Rack part 1/ })).not.toBeInTheDocument()
    act(() => currentCanvas().onAssetState!({ phase: "failed", view: requested, reason: "model" }))
    fireEvent.click(screen.getByRole("button", { name: "Retry assembly" }))
    expect(currentCanvas().assetRetry).toBe(1)
    expect(currentCanvas().generation).toBe(generation)
    act(() => { currentCanvas().onMetadata!(specimenMetadata); currentCanvas().onAssetState!({ phase: "ready", view: requested }) })
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-view", "rack")
    await waitFor(() => expect(screen.getByTestId("facility-inspection").querySelector(".facility-stage")).toHaveFocus())
    expect(screen.getByText("Inspect assembly parts", { selector: "summary" }).closest("details")).not.toHaveAttribute("open")
    openAssemblyParts()
    expect(screen.getByRole("group", { name: "Authored assembly parts" }).querySelectorAll("button")).toHaveLength(6)
    fireEvent.click(screen.getByRole("button", { name: /Rack part 1/ }))
    expect(currentCanvas().target).toEqual({ system: "workloads", partId: "part-0" })
    const caption = screen.getByTestId("facility-assessment-caption").textContent
    fireEvent.click(screen.getByRole("button", { name: "Extend server tray" }))
    expect(currentCanvas().view).toEqual({ kind: "specimen", specimen: "rack", pose: "service" })
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-pose", "closed")
    expect(screen.getByTestId("facility-assessment-caption").textContent).toBe(caption)
    fireEvent.click(screen.getByRole("button", { name: "Expand model" }))
    expect(currentCanvas().generation).toBe(generation)
    expect(screen.getByRole("button", { name: "Compact model" })).toHaveAttribute("aria-expanded", "true")
  })

  it("uses explicit walkthrough steps, exits for manual inspection, and clears on history/reset without changing preferences", async () => {
    testMatchMedia.setMatches("(min-width: 1024px) and (hover: hover) and (pointer: fine)", true)
    const { rerender } = render(<FacilityInspection {...props} release={engineeringRelease} record={assessmentFixtures.d} />)
    await activateEngineering()
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    fireEvent.click(screen.getByRole("button", { name: "Explain this assessment" }))
    expect(screen.getByTestId("facility-walkthrough")).toHaveTextContent("Step 1 of 4")
    fireEvent.click(screen.getByRole("button", { name: "Next step" }))
    expect(screen.getByTestId("facility-walkthrough")).toHaveTextContent("Step 2 of 4")
    expect(screen.getByTestId("facility-walkthrough")).toHaveTextContent("No cooling evidence")
    expect(screen.getByTestId("facility-walkthrough")).toHaveTextContent("No attribution chart is available")
    fireEvent.click(screen.getByRole("button", { name: "Highlight cooling equipment" }))
    expect(screen.getByTestId("facility-walkthrough")).toHaveTextContent("Step 2 of 4")
    expect(currentCanvas().target).toEqual({ system: "cooling" })
    fireEvent.click(screen.getByRole("button", { name: "Next step" }))
    expect(screen.getByTestId("facility-walkthrough")).toHaveTextContent("Unknown")
    expect(screen.getByTestId("facility-walkthrough")).not.toHaveTextContent("5.8 MW")
    fireEvent.click(screen.getByRole("button", { name: "Next step" }))
    const evidence = within(screen.getByRole("navigation", { name: "Walkthrough publication files" }))
    expect(evidence.getByRole("link", { name: "Read the versioned brief" })).toHaveAttribute("href", "/evidence/assessments/demo-01-d/v1.0.0")
    expect(evidence.getByRole("link", { name: "Download this PDF" })).toHaveAttribute("href", "/downloads/assessment/demo-01-d/v1.0.0/pdf")
    expect(evidence.getByRole("link", { name: "Download this technical record" })).toHaveAttribute("href", "/downloads/assessment/demo-01-d/v1.0.0/json")
    fireEvent.click(screen.getByRole("button", { name: "Power" }))
    expect(screen.queryByTestId("facility-walkthrough")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Explain this assessment" }))
    rerender(<FacilityInspection {...props} release={engineeringRelease} resetRevision={1} />)
    expect(screen.queryByTestId("facility-walkthrough")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-pressed", "true")
  })

  it("restores tab-session explicit preferences after remount and ignores stale assembly completions", async () => {
    const first = render(<FacilityInspection {...props} release={engineeringRelease} loadingPolicy="auto-adaptive" />)
    await activateEngineering()
    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    fireEvent.click(equipmentMotionControl())
    const stale = currentCanvas()
    fireEvent.click(stillImageControl())
    act(() => { stale.onMetadata!(specimenMetadata); stale.onAssetState!({ phase: "ready", view: { kind: "specimen", specimen: "rack", pose: "service" } }) })
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-view", "overview")
    first.unmount()
    render(<FacilityInspection {...props} release={engineeringRelease} loadingPolicy="auto-adaptive" />)
    expect(screen.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "poster")
    await activateEngineering()
    expect(screen.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-pressed", "true")
    expect(equipmentMotionControl()).not.toBeChecked()
  })

  it("automatically activates reduced-motion mobile only after decoded poster paint and idle", async () => {
    testMatchMedia.setMatches("(prefers-reduced-motion: reduce)", true)
    const frames = new Map<number, FrameRequestCallback>(), idles: (() => void)[] = []
    let frameId = 0
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId }))
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)))
    vi.stubGlobal("requestIdleCallback", vi.fn((callback: () => void) => { idles.push(callback); return idles.length }))
    vi.stubGlobal("cancelIdleCallback", vi.fn())
    render(<FacilityInspection {...props} release={engineeringRelease} loadingPolicy="auto-adaptive" />)
    const image = screen.getByRole("img")
    Object.defineProperty(image, "naturalWidth", { value: 1200 }); Object.defineProperty(image, "complete", { value: true })
    fireEvent.load(image)
    expect(idles).toHaveLength(0)
    act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(10)) })
    expect(idles).toHaveLength(0)
    act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(20)) })
    expect(idles).toHaveLength(1)
    act(() => idles[0]())
    await waitFor(() => expect(renderer.render).toHaveBeenCalled())
    expect(currentCanvas().reducedMotion).toBe(true)
    expect(currentCanvas().equipmentEnabled).toBe(true)
    act(() => { currentCanvas().onStaged(); currentCanvas().onPresented() })
    expect(equipmentMotionControl()).toBeDisabled()
  })
})


it("reuses the sequential attribution and authored system inventory without manufacturing independent bounds", async () => {
  render(<FacilityInspection {...props} release={engineeringRelease} />)
  await activateEngineering()
  const metadata: FacilitySceneMetadata = { topology: { schemaVersion: "facility-topology.v1", equipment: [
    { id: "electrical-1", index: 0, label: "Electrical cabinet 1", system: "power", role: "distribution", bounds: { min: [0, 0, 0], max: [1, 1, 1] }, diagram: [0, 0] },
    { id: "cooler-1", index: 1, label: "Cooling unit 1", system: "cooling", role: "heat_exchanger", bounds: { min: [1, 0, 0], max: [2, 1, 1] }, diagram: [1, 0] },
  ], ports: [], routes: [], internalLinks: [] } }
  act(() => { currentCanvas().onMetadata!(metadata); currentCanvas().onAssetState!({ phase: "ready", view: { kind: "overview" } }) })
  fireEvent.click(screen.getByRole("button", { name: /^Power$/ }))
  expect(screen.getByText("Shown: Electrical cabinet 1.")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /^Cooling$/ }))
  expect(screen.getByText("Shown: Cooling unit 1.")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Explain this assessment" }))
  fireEvent.click(screen.getByRole("button", { name: "Next step" }))
  const walkthrough = within(screen.getByTestId("facility-walkthrough"))
  expect(walkthrough.getByTestId("assessment-attribution")).toHaveTextContent("Illustrative sequential attribution")
  expect(walkthrough.getByTestId("assessment-attribution")).toHaveTextContent("Order matters; interacting constraints may overlap")
  expect(walkthrough.getByTestId("assessment-attribution")).toHaveTextContent("5.8 MW remaining")
  expect(walkthrough.getByRole("button", { name: "Highlight electrical equipment" })).toHaveAttribute("aria-pressed", "true")
  fireEvent.click(walkthrough.getByRole("button", { name: "Highlight cooling equipment" }))
  expect(walkthrough.getByRole("button", { name: "Highlight cooling equipment" })).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByTestId("facility-walkthrough")).toHaveTextContent("Step 2 of 4")
})
