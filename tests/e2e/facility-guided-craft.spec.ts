import { expect, test, type Locator, type Page } from "@playwright/test"
import { openAssessmentControls, scrollFacilityIntoView } from "../support/facility-viewer"

type GuidedSnapshot = {
  hiddenFrameCount: number
  view: { kind: "overview" | "specimen"; detail?: string }
  rackMotion: { door: number; tray: number; cutaway: boolean; moving: boolean }
  cameraPosition: number[]
  cameraTarget: number[]
  cameraFrustum: number[]
}

const snapshot = (canvas: Locator) => canvas.evaluate(element => (element as unknown as { __gnFacilitySnapshot: () => GuidedSnapshot }).__gnFacilitySnapshot())
const framing = (state: GuidedSnapshot) => [state.cameraPosition, state.cameraTarget, state.cameraFrustum]

async function openRack(page: Page, motion: "reduce" | "no-preference" = "reduce") {
  await page.addInitScript(() => {
    window.__GN_FACILITY_DIAGNOSTICS__ = true
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } })
  })
  await page.emulateMedia({ reducedMotion: motion })
  await page.goto("/demo?scenario=b&version=1.0.0&perspective=business&focus=rack-02&interactive=1")
  const inspector = page.getByTestId("facility-inspection")
  await scrollFacilityIntoView(inspector)
  await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
  await expect(inspector).toHaveAttribute("data-phase", "ready")
  await inspector.getByRole("button", { name: "Inspect rack construction", exact: true }).click()
  await expect(inspector).toHaveAttribute("data-view", "rack")
  const controls = inspector.getByRole("region", { name: "Rack service controls", exact: true })
  // This suite requires the new guided capability. No release-number skip can
  // turn an older/misconfigured candidate into a successful craft qualification.
  await expect(controls).toBeVisible()
  const primary = controls.locator("button[data-guided-primary]")
  const canvas = inspector.locator("canvas[data-ready=true]")
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 0, tray: 0, moving: false })
  await expect(primary).toHaveAccessibleName("Open door")
  return { inspector, controls, primary, canvas, stage: inspector.locator(".facility-stage") }
}

async function extendRack(rack: Awaited<ReturnType<typeof openRack>>) {
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Extend server tray")
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Inspect service connection")
  await expect.poll(async () => (await snapshot(rack.canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, moving: false })
}

async function showOptions(controls: Locator) {
  const summary = controls.locator("summary").filter({ hasText: /^More inspection options$/ })
  await expect(summary).toBeVisible()
  if (!await summary.evaluate(element => (element.parentElement as HTMLDetailsElement).open)) await summary.click()
}

async function publicationIdentity(page: Page) {
  return {
    summary: await page.getByTestId("assessment-summary").textContent(),
    pdf: await page.getByRole("link", { name: "Download this PDF", exact: true }).first().getAttribute("href"),
    record: await page.getByRole("link", { name: "Download this technical record", exact: true }).first().getAttribute("href"),
  }
}

test("guided rack service preserves pose, evidence, one canvas and explicit detail navigation", async ({ page }) => {
  const requests: string[] = []
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".glb")) requests.push(request.url()) })
  const rack = await openRack(page)
  const baseline = await publicationIdentity(page), url = page.url(), oldCanvas = await rack.canvas.elementHandle()
  const wholeFrame = framing(await snapshot(rack.canvas)), downloads = [...requests]
  await extendRack(rack)
  expect(framing(await snapshot(rack.canvas))).toEqual(wholeFrame)
  await rack.primary.focus()
  await rack.primary.press("Enter")
  await expect(rack.stage).toHaveAttribute("data-specimen-detail", "service-connection")
  await expect(rack.primary).toHaveAccessibleName("Return to whole assembly")
  expect((await snapshot(rack.canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, cutaway: true, moving: false })
  expect(framing(await snapshot(rack.canvas))).not.toEqual(wholeFrame)
  for (const name of ["Close door", "Retract server tray", "Restore side panel"]) {
    await expect(rack.controls.getByRole("button", { name, exact: true })).toHaveCount(0)
  }
  await rack.primary.press("Enter")
  await expect(rack.stage).not.toHaveAttribute("data-specimen-detail")
  await expect(rack.primary).toHaveAccessibleName("Retract server tray")
  await expect(rack.controls.locator('[data-service-inspect="true"]')).toHaveAccessibleName("Inspect service connection again")
  await expect(rack.controls.locator('[data-service-inspect="true"]')).toBeFocused()
  await expect.poll(() => rack.controls.locator('[data-service-inspect="true"]').evaluate(element => {
    const bounds = element.getBoundingClientRect(), viewport = window.visualViewport
    const top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? window.innerHeight)
    const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? top
    return bounds.top >= Math.max(top, headerBottom) && bounds.bottom <= bottom
  })).toBe(true)
  await expect.poll(() => rack.inspector.evaluate(element => {
    const rail = element.querySelector(".facility-rack-handle-controls")?.getBoundingClientRect()
    const scene = element.querySelector(".facility-stage")?.getBoundingClientRect()
    const action = element.querySelector('[data-service-inspect="true"]')?.getBoundingClientRect()
    const viewport = window.visualViewport
    const top = Math.max(viewport?.offsetTop ?? 0, document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 12
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 12
    if (!rail || !scene || !action) return false
    // On short/zoomed screens the focus target takes priority. At normal phone
    // height the complete handle rail and assembly must remain unobscured.
    return action.bottom - rail.top > bottom - top || rail.top >= top - 1 && scene.bottom <= bottom + 1
  })).toBe(true)
  expect((await snapshot(rack.canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, cutaway: true, moving: false })
  expect(framing(await snapshot(rack.canvas))).toEqual(wholeFrame)
  await rack.primary.press("Enter")
  await expect(rack.primary).toHaveAccessibleName("Close door")
  await rack.primary.press("Enter")
  await expect(rack.primary).toHaveAccessibleName("Open door")
  expect((await snapshot(rack.canvas)).rackMotion).toMatchObject({ door: 0, tray: 0, cutaway: true, moving: false })
  expect(await rack.canvas.evaluate((element, prior) => element === prior, oldCanvas)).toBe(true)
  expect(requests).toEqual(downloads)
  expect(page.url()).toBe(url)
  expect(await publicationIdentity(page)).toEqual(baseline)
  await rack.inspector.getByRole("button", { name: "Return to facility", exact: true }).click()
  await expect(rack.inspector).toHaveAttribute("data-view", "overview")
  expect(new URL(page.url()).searchParams.get("focus")).toBe("rack-02")
})

test("guided inspection can be skipped and a fresh extension offers connection inspection again", async ({ page }) => {
  const rack = await openRack(page)
  await extendRack(rack)
  await showOptions(rack.controls)
  await rack.controls.getByRole("button", { name: "Retract server tray", exact: true }).click()
  await expect(rack.primary).toHaveAccessibleName("Close door")
  await rack.controls.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect(rack.primary).toHaveAccessibleName("Inspect service connection")
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Return to whole assembly")
  await expect(rack.stage).toBeInViewport({ ratio: .25 })
  expect((await snapshot(rack.canvas)).hiddenFrameCount).toBe(0)
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Retract server tray")
  await showOptions(rack.controls)
  await rack.controls.getByRole("button", { name: "Inspect service connection again", exact: true }).click()
  await expect(rack.stage).toHaveAttribute("data-specimen-detail", "service-connection")
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Retract server tray")
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Close door")
  await showOptions(rack.controls)
  await rack.controls.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect(rack.primary).toHaveAccessibleName("Inspect service connection")
})

test("selected assembly part survives inspection while assessment history clears transient service progress", async ({ page }) => {
  const rack = await openRack(page)
  await extendRack(rack)
  await showOptions(rack.controls)
  const part = rack.inspector.locator('button[data-part-id="GN_RACK_TRAY"]')
  // Open native ancestor disclosures in document order; no hidden activation.
  for (const details of await part.locator("xpath=ancestor::details[not(@open)]").all()) await details.locator(":scope > summary").click()
  await part.click()
  await expect(part).toHaveAttribute("aria-pressed", "true")
  const identity = await publicationIdentity(page)
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Return to whole assembly")
  await expect(rack.stage).toBeInViewport({ ratio: .25 })
  expect((await snapshot(rack.canvas)).hiddenFrameCount).toBe(0)
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Retract server tray")
  await expect(part).toHaveAttribute("aria-pressed", "true")
  expect(await publicationIdentity(page)).toEqual(identity)
  await openAssessmentControls(page)
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("d")
  await expect(rack.inspector).toHaveAttribute("data-view", "overview")
  await expect(page.getByTestId("assessment-summary")).toContainText("Unknown")
  await expect(page.getByRole("link", { name: "Download this PDF", exact: true }).first()).toHaveAttribute("href", "/downloads/assessment/demo-01-d/v1.0.0/pdf")
  await page.goBack()
  await expect(rack.inspector).toHaveAttribute("data-view", "overview")
  await expect(page.getByTestId("assessment-summary")).toContainText("5.8 MW")
  await rack.inspector.getByRole("button", { name: "Inspect rack construction", exact: true }).click()
  await expect(rack.primary).toHaveAccessibleName("Open door")
  await extendRack(rack)
  await expect(rack.primary).toHaveAccessibleName("Inspect service connection")
})

test("a later keyboard intent cancels detail-return focus restoration", async ({ page }) => {
  const rack = await openRack(page, "no-preference")
  await extendRack(rack)
  await rack.primary.click()
  await expect(rack.primary).toHaveAccessibleName("Return to whole assembly")
  await rack.primary.click()
  // This is intentional new navigation during a finite camera transition. The
  // renderer must not pull focus back after the visitor chooses another action.
  await page.keyboard.press("Tab")
  const exit = rack.inspector.getByRole("button", { name: "Return to facility", exact: true })
  await exit.focus()
  await expect(exit).toBeFocused()
  expect((await snapshot(rack.canvas)).hiddenFrameCount).toBe(0)
  // On phones, focusing the lower action scrolls the stage out of view and
  // intentionally suspends camera frames. Reveal it without changing focus
  // before asserting completion; focus restoration must remain cancelled.
  await scrollFacilityIntoView(rack.inspector)
  await expect(rack.primary).toHaveAccessibleName("Retract server tray")
  await expect(exit).toBeFocused()
  await expect(rack.stage).not.toHaveAttribute("data-specimen-detail")
  expect((await snapshot(rack.canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, cutaway: true, moving: false })
  expect((await snapshot(rack.canvas)).hiddenFrameCount).toBe(0)
})
