import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DeferredAssessmentExplorer } from "@/components/assessment/deferred-assessment-explorer"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { resolveAssessmentSelection } from "@/lib/assessment/selectors"

const { load, reload } = vi.hoisted(() => ({ load: vi.fn(), reload: vi.fn() }))
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
vi.mock("@/components/assessment/assessment-explorer-loader", () => ({ loadAssessmentExplorer: load, reloadAssessmentLocation: reload }))
const explorerModule = { AssessmentExplorer: ({ initialSelection, activateOnMount, initialConditionsOpen }: { initialSelection: { scenario: string }; activateOnMount: boolean; initialConditionsOpen?: boolean }) =>
  <div id="decision-brief" tabIndex={-1} data-testid="loaded-explorer" data-scenario={initialSelection.scenario} data-activate={activateOnMount} data-conditions-open={initialConditionsOpen}><div className="facility-stage" role="group" aria-label="Facility model" tabIndex={-1} /><div id="facility-construction" tabIndex={-1}>Construction actions</div><div id="workload-story" tabIndex={-1}>Story actions</div></div> }

function mount(eager = false) {
  const selection = resolveAssessmentSelection({})
  if (selection.status !== "ready") throw new Error("Default fixture unavailable")
  return render(<DeferredAssessmentExplorer eager={eager} initialSelection={selection} initialTarget={null} records={assessmentFixtures} facilityRelease={null} facilityMode="auto-adaptive" preview={<div id="decision-brief" tabIndex={-1}>
    <p>Fixture B — 7.0 MW requested / 5.8 MW modeled</p><a href="/evidence/assessments/demo-01-b/v1.0.0">Versioned B brief</a>
    <details data-assessment-conditions><summary>Conditions and assessment evidence</summary><p>Recorded conditions</p></details>
    <form action="/demo#decision-brief" method="get" data-assessment-preview-form><select id="assessment-scenario" name="scenario" aria-label="Scenario" defaultValue="b"><option value="b">B</option><option value="d">D</option></select><button type="submit">Apply selection</button></form>
    <div className="facility-stage" id="facility-construction" tabIndex={-1} /><details id="workload-story" tabIndex={-1}><summary>Read workload story</summary></details><a href="/demo?interactive=1&activate=1" data-assessment-preview-activate>Explore the facility in 3D</a>
  </div>} />)
}
function activate() { const link = screen.getByRole("link", { name: "Explore the facility in 3D" }); link.focus(); fireEvent.click(link) }
beforeEach(() => { load.mockReset(); reload.mockReset(); window.history.replaceState(null, "", "/demo") })
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks()
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView)
  else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe("deferred assessment identity and fallback", () => {
  it("keeps an explicitly opened reading disclosure across enhancement", async () => {
    load.mockResolvedValue(explorerModule)
    mount()
    fireEvent.click(screen.getByText("Conditions and assessment evidence", { selector: "summary" }))
    activate()
    expect(await screen.findByTestId("loaded-explorer")).toHaveAttribute("data-conditions-open", "true")
  })
  it("keeps unapplied changes in a native GET form without writing a false URL or changing evidence", () => {
    mount()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "d" } })
    const form = screen.getByRole("button", { name: "Apply selection" }).closest("form")!
    expect(fireEvent.submit(form)).toBe(true)
    expect(form).toHaveAttribute("method", "get")
    expect(window.location.search).toBe("")
    expect(screen.getByText(/Fixture B/)).toBeVisible()
    expect(screen.getByRole("link", { name: "Versioned B brief" })).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
    expect(load).not.toHaveBeenCalled()
  })
  it("reports import rejection and explicitly retries while keeping the selected brief readable", async () => {
    load.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(explorerModule)
    mount(); activate()
    expect(await screen.findByRole("button", { name: "Retry interactive inspection" })).toBeVisible()
    expect(screen.getByText(/Fixture B/)).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Retry interactive inspection" }))
    expect(await screen.findByTestId("loaded-explorer")).toHaveAttribute("data-scenario", "b")
  })
  it("bounds a hung import and ignores its late completion", async () => {
    vi.useFakeTimers()
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    mount(); activate()
    await act(async () => { await vi.advanceTimersByTimeAsync(8_000) })
    expect(screen.getByRole("button", { name: "Retry interactive inspection" })).toBeVisible()
    await act(async () => { resolve(explorerModule) })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
  })
  it("restores history natively and never mounts an obsolete late import", async () => {
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    mount(); activate()
    act(() => { window.history.replaceState(null, "", "/demo?scenario=d"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(reload).toHaveBeenCalledOnce()
    expect(screen.queryByText(/Fixture B/)).toBeNull()
    await act(async () => { resolve(explorerModule) })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
  })
  it("does not discard a native select draft when a background import completes", async () => {
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    mount(); activate()
    const select = screen.getByRole("combobox"); select.focus(); fireEvent.change(select, { target: { value: "d" } })
    await act(async () => { resolve(explorerModule) })
    expect(select).toHaveValue("d")
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
  })
  it("rechecks the location when a loaded module waits for focus to leave the native form", async () => {
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    mount(); activate()
    const select = screen.getByRole("combobox"); select.focus()
    await act(async () => { resolve(explorerModule) })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    window.history.replaceState(null, "", "/demo?scenario=d")
    await act(async () => { select.blur() })
    expect(reload).toHaveBeenCalledOnce()
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
  })
  it("hands explicit activation focus to the facility, with no specimen requested by the shell", async () => {
    load.mockResolvedValue(explorerModule)
    mount(); activate()
    expect(await screen.findByTestId("loaded-explorer")).toHaveAttribute("data-activate", "true")
    expect(screen.getByRole("group", { name: "Facility model" })).toHaveFocus()
  })
  it("does not reclaim focus when the visitor leaves during import", async () => {
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    mount(); activate()
    const outside = document.createElement("button"); outside.textContent = "Other task"; document.body.append(outside); outside.focus()
    await act(async () => { resolve(explorerModule) })
    expect(outside).toHaveFocus()
    outside.remove()
  })
  it("preserves a native link from pointerdown through click default activation when its import completes", async () => {
    vi.useFakeTimers()
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    mount(); activate()
    const link = screen.getByRole("link", { name: "Versioned B brief" })
    document.getElementById("decision-brief")!.focus() // Safari focuses the container, not its link.
    fireEvent.pointerDown(link, { pointerId: 7 })
    await act(async () => { resolve(explorerModule) })
    expect(link.isConnected).toBe(true)
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    fireEvent.pointerUp(link, { pointerId: 7 })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    const activation = vi.fn((event: Event) => { expect(link.isConnected).toBe(true); event.preventDefault() })
    link.addEventListener("click", activation)
    fireEvent.click(link)
    expect(activation).toHaveBeenCalledOnce()
    expect(link.isConnected).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByTestId("loaded-explorer")).toBeVisible()
  })
  it("adopts a native press that began before React captured pointerdown", async () => {
    vi.useFakeTimers()
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    const view = mount(); activate()
    const link = screen.getByRole("link", { name: "Versioned B brief" })
    document.getElementById("decision-brief")!.focus()
    const shell = view.container.firstElementChild as HTMLElement
    const query = shell.querySelector.bind(shell)
    let nativePressed = true
    vi.spyOn(shell, "querySelector").mockImplementation(selector => selector === ":active" ? nativePressed ? link : null : query(selector))
    await act(async () => { resolve(explorerModule) })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    nativePressed = false
    fireEvent.pointerUp(link, { pointerId: 42 })
    link.addEventListener("click", event => { expect(link.isConnected).toBe(true); event.preventDefault() }, { once: true })
    fireEvent.click(link)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByTestId("loaded-explorer")).toBeVisible()
  })
  it.each(["before", "after"])("does not re-adopt sticky touch :active when import completes %s the terminal event", async completion => {
    vi.useFakeTimers()
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    const view = mount(true)
    await act(async () => { await Promise.resolve() })
    const link = screen.getByRole("link", { name: "Explore the facility in 3D" })
    const shell = view.container.firstElementChild as HTMLElement
    const query = shell.querySelector.bind(shell)
    vi.spyOn(shell, "querySelector").mockImplementation(selector => selector === ":active" ? link : query(selector))
    fireEvent.pointerDown(link, { pointerId: 31, pointerType: "touch" })
    // A background import may finish while the explicit press is in progress.
    if (completion === "before") await act(async () => { resolve(explorerModule) })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    fireEvent.pointerUp(link, { pointerId: 31, pointerType: "touch" })
    fireEvent.click(link)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    if (completion === "after") {
      expect(screen.queryByTestId("loaded-explorer")).toBeNull()
      await act(async () => { resolve(explorerModule) })
    }
    expect(screen.getByTestId("loaded-explorer")).toBeVisible()
  })
  it("keeps a newer press protected after a previous gesture completed", async () => {
    vi.useFakeTimers()
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    const view = mount()
    const link = screen.getByRole("link", { name: "Explore the facility in 3D" })
    const shell = view.container.firstElementChild as HTMLElement
    const query = shell.querySelector.bind(shell)
    vi.spyOn(shell, "querySelector").mockImplementation(selector => selector === ":active" ? link : query(selector))
    fireEvent.pointerDown(link, { pointerId: 32 })
    fireEvent.pointerUp(link, { pointerId: 32 })
    fireEvent.click(link)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    fireEvent.pointerDown(link, { pointerId: 33 })
    await act(async () => { resolve(explorerModule); await vi.advanceTimersByTimeAsync(400) })
    expect(link.isConnected).toBe(true)
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    fireEvent.pointerUp(link, { pointerId: 33 })
    fireEvent.click(link)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByTestId("loaded-explorer")).toBeVisible()
  })
  it.each(["pointercancel", "pointerup"])("releases an interrupted native gesture on %s without taking outside focus", async kind => {
    vi.useFakeTimers()
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    mount(); activate()
    const link = screen.getByRole("link", { name: "Versioned B brief" })
    fireEvent.pointerDown(link, { pointerId: 9 })
    await act(async () => { resolve(explorerModule) })
    const outside = document.createElement("button"); document.body.append(outside); outside.focus()
    if (kind === "pointercancel") fireEvent.pointerCancel(outside, { pointerId: 9 })
    else fireEvent.pointerUp(outside, { pointerId: 9 })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByTestId("loaded-explorer")).toBeVisible()
    expect(outside).toHaveFocus()
    outside.remove()
  })
  it("keeps keyboard activation intact and transfers explicit activation focus after its default action", async () => {
    vi.useFakeTimers()
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    mount()
    const link = screen.getByRole("link", { name: "Explore the facility in 3D" }); link.focus()
    fireEvent.keyDown(link, { key: "Enter" }); fireEvent.click(link)
    await act(async () => { resolve(explorerModule) })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByRole("group", { name: "Facility model" })).toHaveFocus()
  })
  it("cancels a pending gesture fallback during teardown", async () => {
    vi.useFakeTimers()
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    const view = mount(); activate()
    const link = screen.getByRole("link", { name: "Versioned B brief" })
    fireEvent.pointerDown(link, { pointerId: 10 }); fireEvent.pointerUp(link, { pointerId: 10 })
    view.unmount()
    await act(async () => { resolve(explorerModule); await vi.advanceTimersByTimeAsync(400) })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each(["modified", "middle"])("does not intercept %s native activation", async kind => {
    vi.useFakeTimers()
    mount()
    const link = screen.getByRole("link", { name: "Explore the facility in 3D" })
    // A fragment keeps jsdom's native default local; event semantics are intact.
    link.setAttribute("href", "#native-destination")
    fireEvent.pointerDown(link, { pointerId: 11, button: kind === "middle" ? 1 : 0 })
    fireEvent.pointerUp(link, { pointerId: 11, button: kind === "middle" ? 1 : 0 })
    const event = new MouseEvent(kind === "middle" ? "auxclick" : "click", { bubbles: true, cancelable: true, button: kind === "middle" ? 1 : 0, ctrlKey: kind === "modified" })
    expect(fireEvent(link, event)).toBe(true)
    expect(event.defaultPrevented).toBe(false)
    expect(load).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(screen.queryByTestId("loaded-explorer")).toBeNull()
  })
  it.each(["facility-construction", "workload-story"])("hands the explicit %s journey to its enhanced section exactly once", async target => {
    const scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll })
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    window.history.replaceState(null, "", `/demo#${target}`)
    mount()
    document.getElementById(target)!.focus()
    await act(async () => { await Promise.resolve() })
    await act(async () => { resolve(explorerModule) })
    expect(document.getElementById(target)).toHaveFocus()
    expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: "start", behavior: "instant" })
    expect(screen.getByTestId("loaded-explorer")).toHaveAttribute("data-activate", "false")
  })
  it("does not scroll or reclaim a journey after focus moves to another task", async () => {
    const scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll })
    let resolve!: (value: typeof explorerModule) => void
    load.mockImplementation(() => new Promise(value => { resolve = value }))
    window.history.replaceState(null, "", "/demo#workload-story")
    mount()
    await act(async () => { await Promise.resolve() })
    const outside = document.createElement("button"); document.body.append(outside); outside.focus()
    await act(async () => { resolve(explorerModule) })
    expect(outside).toHaveFocus()
    expect(scroll).not.toHaveBeenCalled()
    outside.remove()
  })
})
