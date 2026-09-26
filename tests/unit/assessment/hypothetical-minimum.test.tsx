import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { assessmentFixtures } from "@/content/assessments/fixtures"
import { canCompareHypotheticalMinimum, compareHypotheticalMinimum, parseHypotheticalMinimum, type HypotheticalMinimumSource } from "@/lib/assessment/hypothetical-minimum"
import { readHypotheticalMinimumSource } from "@/lib/assessment/publications"
import { AssessmentExplorer } from "@/components/assessment/assessment-explorer"
import { AssessmentPreview } from "@/components/assessment/assessment-preview"
import { selectCapacityComparison, resolveAssessmentSelection } from "@/lib/assessment/selectors"
import { writeAssessmentHistory } from "@/lib/assessment/history"

const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock("@/lib/analytics", () => ({ trackGridNinjaEvent: track }))
const source: HypotheticalMinimumSource = { publicationId: "demo-01-b", version: "1.0.0", snapshotSha256: "b".repeat(64), basisId: assessmentFixtures.b.basis.id, requestedKW: 7_000, modeledKW: 5_800 }
afterEach(() => { cleanup(); track.mockClear(); window.history.replaceState(null, "", "/demo") })

describe("publication-bound hypothetical minimum", () => {
  it("uses native navigation if history cannot commit, before replacing the displayed record", () => {
    const native = vi.fn()
    expect(writeAssessmentHistory("/demo?scenario=d", { push: () => { throw new DOMException("Denied", "SecurityError") }, native })).toBe(false)
    expect(native).toHaveBeenCalledWith("/demo?scenario=d")
    expect(writeAssessmentHistory("/demo?scenario=b", { push: vi.fn(), native })).toBe(true)
    expect(native).toHaveBeenCalledTimes(1)
  })
  it.each([["0", 0], ["0.0", 0], ["5.80", 5_800], [" 6.5 ", 6_500], ["7.000", 7_000], ["0.1", 100]])("parses decimal %s as integer kW", (value, minimumKW) => {
    expect(parseHypotheticalMinimum(value as string)).toEqual({ ok: true, minimumKW })
  })
  it.each(["", " ", "NaN", "Infinity", "1e0", "0x1", "-0", "-1", "7.1", "99", "5.81", "5.801", "5,8", ".5", "7."])("rejects invalid input %s without clamping", value => {
    expect(parseHypotheticalMinimum(value).ok).toBe(false)
  })
  it("uses an approved, integrity-checked publication digest and rejects modified source records", async () => {
    expect(await readHypotheticalMinimumSource(assessmentFixtures.b)).toMatchObject({ ...source, snapshotSha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(await readHypotheticalMinimumSource({ ...assessmentFixtures.b, title: "Modified record" })).toBeNull()
    expect(await readHypotheticalMinimumSource(assessmentFixtures.d)).toBeNull()
  })
  it("isolates the arithmetic from record outcomes and rejects stale identities and digests", () => {
    const before = JSON.stringify(assessmentFixtures)
    for (const [minimumKW, marginKW] of [[5_000, 800], [5_800, 0], [6_000, -200], [6_500, -700], [7_000, -1_200]]) {
      expect(compareHypotheticalMinimum(assessmentFixtures.b, source, { origin: "visitor-assumption", source, minimumKW })).toMatchObject({ marginKW, minimumKW })
    }
    expect(JSON.stringify(assessmentFixtures)).toBe(before)
    for (const scenario of ["a", "c", "d"] as const) expect(canCompareHypotheticalMinimum(assessmentFixtures[scenario], source)).toBe(false)
    expect(compareHypotheticalMinimum(assessmentFixtures.b, source, { origin: "visitor-assumption", source: { ...source, snapshotSha256: "c".repeat(64) }, minimumKW: 5_000 })).toBeNull()
    expect(compareHypotheticalMinimum(assessmentFixtures.b, source, { origin: "visitor-assumption", source: { ...source, basisId: "other-hour" }, minimumKW: 5_000 })).toBeNull()
    expect(compareHypotheticalMinimum(assessmentFixtures.b, source, { origin: "visitor-assumption", source, minimumKW: 5_850 })).toBeNull()
  })
  it("keeps D unknown and C's authored minimum on a shared scale", () => {
    expect(selectCapacityComparison(assessmentFixtures.d).rows[1].valueKW).toBeNull()
    expect(selectCapacityComparison(assessmentFixtures.d).requestDifferenceKW).toBeNull()
    expect(selectCapacityComparison(assessmentFixtures.c)).toMatchObject({ maximumKW: 7_000, rows: [{ valueKW: 7_000 }, { valueKW: 5_800 }, { valueKW: 6_500 }] })
  })
  it("provides five readable server examples without JavaScript or graphics", () => {
    const selection = resolveAssessmentSelection({})
    if (selection.status !== "ready") throw new Error("Missing fixture")
    render(<AssessmentPreview record={assessmentFixtures.b} selection={selection} release={null} hypotheticalSource={source} />)
    const disclosure = document.getElementById("hypothetical-minimum")!
    expect(disclosure).not.toHaveAttribute("open")
    expect(within(disclosure).getAllByRole("row", { hidden: true })).toHaveLength(6)
    expect(disclosure).toHaveTextContent("+0.8 MW")
    expect(disclosure).toHaveTextContent("−1.2 MW")
    expect(disclosure.querySelector("input")).toBeNull()
  })
  it("applies explicit input and presets, clears stale results on edit, and sends no assumptions anywhere", async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, "", "/demo?scenario=b&version=1.0.0&perspective=business")
    const startingUrl = window.location.href
    const sessionBefore = JSON.stringify(sessionStorage)
    render(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({})} hypotheticalSource={source} />)
    await user.click(screen.getByText("Explore a hypothetical minimum"))
    const input = screen.getByLabelText("Hypothetical minimum increment (MW)")
    expect(input).toHaveValue(null)
    await user.type(input, "6.5")
    expect(screen.getByTestId("hypothetical-result")).not.toHaveTextContent("0.7 MW below")
    await user.click(screen.getByRole("button", { name: "Compare minimum" }))
    expect(screen.getByTestId("hypothetical-result")).toHaveTextContent("0.7 MW below the assumed 6.5 MW minimum")
    await user.clear(input)
    expect(screen.getByTestId("hypothetical-result")).not.toHaveTextContent("0.7 MW")
    await user.click(screen.getByRole("button", { name: "5.8 MW" }))
    expect(screen.getByTestId("hypothetical-result")).toHaveTextContent("no additional numerical margin")
    expect(screen.getByRole("link", { name: "Download this PDF" })).toHaveAttribute("href", "/downloads/assessment/demo-01-b/v1.0.0/pdf")
    expect(screen.getByTestId("assessment-summary")).toHaveTextContent("Model screen: REPAIR")
    expect(window.location.href).toBe(startingUrl)
    expect(JSON.stringify(sessionStorage)).toBe(sessionBefore)
    expect(track.mock.calls).toHaveLength(1)
    expect(track.mock.calls[0][0]).toBe("sample_opened")
    await user.click(screen.getByRole("button", { name: "Reset comparison" }))
    expect(input).toHaveValue(null)
    expect(screen.getByTestId("hypothetical-result")).not.toHaveTextContent("no additional numerical margin")
  })
  it("retains a local comparison across disclosure toggles but clears on perspective/history/reset", async () => {
    const user = userEvent.setup()
    render(<AssessmentExplorer records={assessmentFixtures} initialSelection={resolveAssessmentSelection({})} hypotheticalSource={source} />)
    await user.click(screen.getByText("Explore a hypothetical minimum"))
    await user.click(screen.getByRole("button", { name: "6.0 MW" }))
    await user.click(screen.getByText("Explore a hypothetical minimum"))
    await user.click(screen.getByText("Explore a hypothetical minimum"))
    expect(screen.getByLabelText("Hypothetical minimum increment (MW)")).toHaveValue(6)
    await user.selectOptions(screen.getByLabelText("Perspective"), "engineering")
    expect(screen.getByLabelText("Hypothetical minimum increment (MW)")).toHaveValue(null)
    await user.click(screen.getByText("Explore a hypothetical minimum"))
    await user.click(screen.getByRole("button", { name: "7.0 MW" }))
    act(() => { window.history.replaceState(null, "", "/demo?scenario=b"); window.dispatchEvent(new PopStateEvent("popstate")) })
    expect(screen.getByLabelText("Hypothetical minimum increment (MW)")).toHaveValue(null)
    fireEvent.change(screen.getByLabelText("Scenario"), { target: { value: "d" } })
    expect(screen.queryByTestId("hypothetical-minimum")).toBeNull()
    expect(screen.getByTestId("assessment-summary")).not.toHaveTextContent("5.8 MW")
  })
})
