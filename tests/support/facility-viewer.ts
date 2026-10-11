import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test"

/** WebKit can replace its initial streamed node while a navigation settles.
 * Resolve a fresh locator after that transient detachment; never relax readiness.
 */
export async function scrollFacilityIntoView(inspector: Locator) {
  await expect(async () => { await inspector.locator(".facility-stage").scrollIntoViewIfNeeded() }).toPass({ timeout: 5_000, intervals: [50, 100, 250] })
}

/** Secondary graphics controls remain native and are usable while loading. */
export async function openFacilityDisplayOptions(inspector: Locator) {
  const summary = inspector.getByLabel("Display options", { exact: true })
  await expect(summary).toBeVisible()
  if (!await summary.evaluate(element => (element.parentElement as HTMLDetailsElement).open)) await summary.click()
  await expect(inspector.getByRole("button", { name: "Use still image", exact: true })).toBeVisible()
}

export async function chooseFacilityStillImage(inspector: Locator) {
  await openFacilityDisplayOptions(inspector)
  await inspector.getByRole("button", { name: "Use still image", exact: true }).click()
}

type EngineeringSettlementSnapshot = ReturnType<NonNullable<HTMLCanvasElement["__gnFacilitySnapshot"]>> & {
  schedulerPending: number; transitionRemaining: number; clockSeconds: number; interactionUntil: number
}

// These fields are emitted by EngineeringSession. The global snapshot also
// describes older non-engineering releases, which do not expose this scheduler.
const engineeringSnapshot = (canvas: Locator, includeEquipment = false) => canvas.evaluate((element, equipment) =>
  (element as HTMLCanvasElement).__gnFacilitySnapshot!(equipment) as EngineeringSettlementSnapshot, includeEquipment)

/** Verify the actual policy path without forcing a renderer tier. */
export async function settleFacilityActivity(page: Page, inspector: Locator, testInfo: TestInfo) {
  const pause = inspector.getByRole("button", { name: "Pause", exact: true })
  let mode: "explicit-pause" | "adaptive-still" = "explicit-pause"
  if (await inspector.getAttribute("data-quality") === "still") mode = "adaptive-still"
  else {
    try { await pause.click({ timeout: 2_000 }) }
    catch (error) {
      // The adaptive tier can change while the click waits for a stable target.
      if (await inspector.getAttribute("data-quality") !== "still") throw error
      mode = "adaptive-still"
    }
  }
  if (mode === "adaptive-still") {
    await expect(inspector).toHaveAttribute("data-quality", "still")
    await expect(inspector.locator(".facility-state-label")).toHaveText("Still for performance")
    await expect(inspector.getByRole("button", { name: /^(Pause|Resume)$/, exact: true })).toHaveCount(0)
    testInfo.annotations.push({ type: "adaptive-policy", description: "Verified Still fallback; no active-motion or explicit-Pause qualification is claimed." })
  } else await expect(inspector.getByRole("button", { name: "Resume", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.mouse.move(0, 0)
  const canvas = inspector.locator("canvas[data-ready=true]")
  await expect.poll(async () => {
    const state = await engineeringSnapshot(canvas)
    return state.schedulerPending === 0 && state.transitionRemaining === 0 && state.clockSeconds >= state.interactionUntil
  }, { timeout: 2_000 }).toBe(true)
  const before = await engineeringSnapshot(canvas, true)
  await page.waitForTimeout(350)
  const after = await engineeringSnapshot(canvas, true)
  expect(after.frames).toBe(before.frames)
  expect(after.equipment).toEqual(before.equipment)
  expect(after.schedulerPending).toBe(0)
  return mode
}

/** Native GET controls exist before the interactive island. Wait for its actual
 * Reset action before changing a scenario, then open the visitor's disclosure. */
export async function openAssessmentControls(page: Page) {
  const controls = page.locator("[data-assessment-controls]")
  await expect(controls.locator("button").filter({ hasText: /^Reset example$/ })).toHaveCount(1)
  if (await controls.getAttribute("open") === null) {
    const summary = controls.locator(":scope > summary")
    // The Linux WebKit release trace shows a click crossing an active native
    // scroll and the sticky header. Position the actual target, then require
    // stable unobscured geometry; retain an ordinary pointer click and outcome.
    await summary.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }))
    let previous: { x: number; y: number } | undefined
    let stable = 0
    await expect.poll(async () => {
      const target = await summary.evaluate(element => {
        const box = element.getBoundingClientRect()
        const x = box.x + box.width / 2, y = box.y + box.height / 2
        const hit = document.elementFromPoint(x, y)
        return { x, y, unobscured: box.width > 0 && box.height > 0 && x > 0 && y > 0 && x < innerWidth && y < innerHeight && Boolean(hit && element.contains(hit)) }
      })
      stable = target.unobscured && previous && Math.abs(target.x - previous.x) < .25 && Math.abs(target.y - previous.y) < .25 ? stable + 1 : 0
      previous = target
      return stable >= 3
    }, { timeout: 2_000, intervals: [50], message: "Scenario disclosure must settle clear of the sticky header before pointer activation" }).toBe(true)
    await summary.click()
  }
  await expect(controls).toHaveAttribute("open", "")
  await expect(page.getByRole("combobox", { name: "Scenario", exact: true })).toBeVisible()
}

/** Interactive tests may follow the real software-renderer fallback through the
 * visitor's native control. Unavailable graphics is a failure, never a skip. */
export async function waitForFacilityReady(page: Page, inspector: Locator, testInfo: TestInfo = test.info()) {
  let state = { phase: "", graphics: "" }
  await expect.poll(async () => {
    state = await inspector.evaluate(element => ({ phase: element.getAttribute("data-phase") ?? "", graphics: element.getAttribute("data-automatic-graphics") ?? "" }))
    if (state.graphics === "unavailable" || state.phase === "failed") return "failed"
    if (state.phase === "ready") return "ready"
    return state.phase === "poster" && state.graphics === "software" ? "software-poster" : "pending"
  }, { message: "Wait for native readiness or an explicitly reported software poster", timeout: 15_000 }).not.toBe("pending")
  expect(state.graphics, "Graphics-specific coverage requires WebGL2; unavailable graphics must fail").not.toBe("unavailable")
  expect(state.phase, "The native graphics session failed before readiness").not.toBe("failed")
  if (state.phase === "poster" && state.graphics === "software") {
    await expect(inspector.locator(".facility-poster")).toBeVisible()
    await expect(inspector.locator("canvas")).toHaveCount(0)
    testInfo.annotations.push({ type: "graphics-activation", description: "Actual software-renderer poster fallback verified; interactive coverage uses the visitor's explicit Explore in 3D action. No automatic or hardware qualification is claimed." })
    await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
  }
  await expect(inspector).toHaveAttribute("data-phase", "ready")
  await expect(inspector.locator("canvas[data-ready=true]")).toBeVisible()
  await expect(page.locator("canvas[data-facility-canvas]")).toHaveCount(1)
}

/** Automatic-loading tests inspect the actual native policy before any helper
 * may choose manual graphics. The software poster must acquire no model. */
export async function expectFacilityAutomaticAcquisition(page: Page, inspector: Locator, modelRequests: readonly string[]) {
  await expect(inspector).toHaveAttribute("data-automatic-graphics", /^(available|unknown|software|unavailable)$/, { timeout: 15_000 })
  const graphics = await inspector.getAttribute("data-automatic-graphics")
  expect(graphics, "Graphics-specific coverage requires actual WebGL2 support").not.toBe("unavailable")
  if (graphics === "software") {
    await expect(inspector).toHaveAttribute("data-phase", "poster")
    await expect(inspector.locator(".facility-poster")).toBeVisible()
    await expect(inspector.locator("canvas")).toHaveCount(0)
    await page.waitForTimeout(350)
    expect(modelRequests, "Software graphics must not automatically acquire a model").toEqual([])
  } else {
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    expect(modelRequests, "An eligible native renderer must acquire exactly one overview model").toHaveLength(1)
  }
  return graphics
}
