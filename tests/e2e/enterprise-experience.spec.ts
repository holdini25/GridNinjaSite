import { expect, test, type Locator, type Page } from "@playwright/test"
import { openAssessmentControls, scrollFacilityIntoView } from "../support/facility-viewer"

type ReadingSnapshot = {
  readingHold: boolean; frames: number; activeSeconds: number; hiddenFrameCount: number
  quality: string; qualityProbe: boolean; tierHistory: unknown[]
  equipment: { fans: { phase: number }[]; ledColors: number[] }
}
const snapshot = (canvas: Locator) => canvas.evaluate(element => (element as unknown as { __gnFacilitySnapshot: (equipment: boolean) => ReadingSnapshot }).__gnFacilitySnapshot(true))
const savedPreferences = (page: Page) => page.evaluate(() => sessionStorage.getItem("gridninja.facility.preferences.v1"))
// A native capability run must execute the active path. Emulated functional
// runs may qualify the real adaptive Still path, recorded separately below.
const requireActivePath = process.env.FACILITY_REQUIRE_ACTIVE_READING_PATH === "1"
async function readingEvidence(canvas: Locator, label: string, story?: Locator) {
  const state = await snapshot(canvas)
  await test.info().attach(`reading-${label}.json`, { contentType: "application/json", body: JSON.stringify({ label, requireActivePath, state, ...(story ? { chapter: await story.getAttribute("data-chapter"), playing: await story.getAttribute("data-playing") } : {}) }, null, 2) })
  return state
}
async function awaitInitialMotion(inspector: Locator, canvas: Locator) {
  await scrollFacilityIntoView(inspector)
  await expect(inspector.locator(".facility-stage")).toBeInViewport({ ratio: .25 })
  await expect.poll(async () => { const state = await snapshot(canvas); return state.activeSeconds > .2 || state.quality === "still" }).toBe(true)
  const state = await readingEvidence(canvas, "initial")
  if (requireActivePath) expect(state.quality, "This native run requires actual activity; adaptive Still is not active-path evidence").not.toBe("still")
  return state
}
async function assertVisibleFreeze(page: Page, inspector: Locator, canvas: Locator) {
  await scrollFacilityIntoView(inspector)
  await expect(inspector.locator(".facility-stage")).toBeInViewport({ ratio: .25 })
  await page.waitForTimeout(1_000)
  const before = await snapshot(canvas)
  await page.waitForTimeout(400)
  expect(await snapshot(canvas)).toMatchObject({ frames: before.frames, activeSeconds: before.activeSeconds, equipment: before.equipment, hiddenFrameCount: 0 })
  return before
}
async function verifyPermittedActivity(page: Page, inspector: Locator, canvas: Locator, label: string) {
  await scrollFacilityIntoView(inspector)
  await expect(inspector.locator(".facility-stage")).toBeInViewport({ ratio: .25 })
  // Exclude the finite 750ms selection/resize settling window. Snapshot
  // activeSeconds is the equipment animation clock, not the scheduler clock.
  await page.waitForTimeout(1_000)
  const before = await readingEvidence(canvas, `${label}-before`)
  await page.waitForTimeout(400)
  const after = await readingEvidence(canvas, `${label}-after`)
  const active = before.quality !== "still" && after.quality !== "still"
  if (active) {
    expect(after.activeSeconds, "Continuous equipment time advances after finite feedback settles").toBeGreaterThan(before.activeSeconds)
    expect(after.equipment.fans.some((fan, index) => fan.phase !== before.equipment.fans[index].phase), "A fan physically moves in the active window").toBe(true)
  } else await expect(inspector.getByRole("button", { name: "Try motion again", exact: true })).toBeVisible()
  if (requireActivePath) expect(active, "Native qualification must retain permitted motion throughout the observation").toBe(true)
  return active
}
async function playIfPermitted(story: Locator, canvas: Locator) {
  if ((await snapshot(canvas)).quality === "still") return
  try {
    await story.getByRole("button", { name: "Play story", exact: true }).click({ timeout: 1_500 })
  } catch (error) {
    // A real tier demotion may disable the native button between the check
    // and the press. Only that observed adaptive state permits this branch.
    if ((await snapshot(canvas)).quality !== "still") throw error
  }
  await expect.poll(async () => await story.getAttribute("data-playing") === "true" || (await snapshot(canvas)).quality === "still").toBe(true)
}

test("a hypothetical minimum never changes assessment identity, files, or navigation", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } }))
  await page.goto("/demo?scenario=b&version=1.0.0&perspective=business&interactive=1#hypothetical-minimum")
  const comparison = page.getByTestId("hypothetical-minimum")
  await expect(comparison).toHaveAttribute("open", "")
  const identity = page.url(), summary = await page.getByTestId("assessment-summary").textContent()
  const input = page.getByLabel("Hypothetical minimum increment (MW)")
  await input.fill("6.5")
  await comparison.getByRole("button", { name: "Compare minimum", exact: true }).click()
  await expect(page.getByTestId("hypothetical-result")).toContainText("0.7 MW below")
  await expect(page.getByTestId("assessment-summary")).toHaveText(summary!)
  expect(page.url()).toBe(identity)
  await expect(page.getByRole("link", { name: "Download this PDF", exact: true })).toHaveAttribute("href", "/downloads/assessment/demo-01-b/v1.0.0/pdf")
  await input.fill("5.8")
  await expect(page.getByTestId("hypothetical-result")).not.toContainText("0.7 MW below")
  await comparison.getByRole("button", { name: "Compare minimum", exact: true }).click()
  await expect(page.getByTestId("hypothetical-result")).toContainText("no additional numerical margin")
  await openAssessmentControls(page)
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("d")
  await expect(comparison).toHaveCount(0)
  await expect(page.getByTestId("assessment-summary")).toContainText("Unknown")
  await expect(page.getByTestId("assessment-summary")).not.toContainText("5.8 MW")
  await page.goBack()
  await expect(comparison).toHaveCount(1)
  await comparison.locator(":scope > summary").click()
  await expect(page.getByLabel("Hypothetical minimum increment (MW)")).toHaveValue("")
  await expect(page.locator("canvas")).toHaveCount(0)
})

test("visible reading stops scene frames, keeps interaction, and resumes ambient activity without rewriting preferences", async ({ page }) => {
  await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/demo?scenario=b&interactive=1")
  const inspector = page.getByTestId("facility-inspection")
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-phase", "ready")
  const canvas = inspector.locator("canvas")
  await awaitInitialMotion(inspector, canvas)
  const initiallyActive = await verifyPermittedActivity(page, inspector, canvas, "ambient-initial")
  const saved = await savedPreferences(page)
  const comparison = page.getByTestId("hypothetical-minimum")
  await comparison.locator(":scope > summary").click()
  await scrollFacilityIntoView(inspector)
  await expect.poll(async () => (await snapshot(canvas)).readingHold).toBe(true)
  const held = await assertVisibleFreeze(page, inspector, canvas)
  await readingEvidence(canvas, "held")
  await inspector.getByRole("button", { name: "Cooling", exact: true }).click()
  await expect(inspector.getByRole("button", { name: "Cooling", exact: true })).toHaveAttribute("aria-pressed", "true")
  await inspector.getByRole("button", { name: "View air-path cutaway", exact: true }).click()
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-detail", "air-path")
  expect((await snapshot(canvas)).readingHold).toBe(true)
  expect((await snapshot(canvas)).frames).toBeGreaterThan(held.frames)
  await inspector.getByRole("button", { name: "Return to overview", exact: true }).click()
  await comparison.locator(":scope > summary").click()
  await scrollFacilityIntoView(inspector)
  await expect.poll(async () => (await snapshot(canvas)).readingHold).toBe(false)
  await expect.poll(async () => { const state = await snapshot(canvas); return state.activeSeconds > held.activeSeconds || state.quality === "still" }).toBe(true)
  const resumed = await readingEvidence(canvas, "closed")
  if (resumed.quality === "still") {
    await expect(inspector.getByRole("button", { name: "Try motion again", exact: true })).toBeVisible()
    await assertVisibleFreeze(page, inspector, canvas)
  } else expect(resumed.activeSeconds).toBeGreaterThan(held.activeSeconds)
  const resumedActive = await verifyPermittedActivity(page, inspector, canvas, "ambient-resumed")
  const activePath = initiallyActive && resumedActive
  test.info().annotations.push({ type: "reading-hold-path", description: activePath ? "Active scene paused and resumed; this is functional motion evidence, not a cadence measurement." : "Adaptive Still preserved; visible freeze, finite inspection, hold release and preferences checked. Active pause/resume not claimed." })
  if (requireActivePath) expect(activePath, "Native qualification requires active pause/resume").toBe(true)
  expect(await savedPreferences(page)).toBe(saved)
})

test("reading pauses playback at the current chapter and closing it requires explicit Play", async ({ page }) => {
  await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto("/demo?scenario=b&interactive=1")
  const inspector = page.getByTestId("facility-inspection")
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-phase", "ready")
  const canvas = inspector.locator("canvas")
  await awaitInitialMotion(inspector, canvas)
  await inspector.getByRole("button", { name: "Follow one workload", exact: true }).click()
  const story = inspector.getByTestId("facility-ecosystem-story")
  await playIfPermitted(story, canvas)
  const initiallyActive = await verifyPermittedActivity(page, inspector, canvas, "story-initial")
  const startedPlaying = initiallyActive && await story.getAttribute("data-playing") === "true"
  if (!startedPlaying) {
    await expect(inspector).toHaveAttribute("data-quality", "still")
    await expect(story.getByRole("button", { name: "Play story", exact: true })).toBeDisabled()
    await story.getByRole("button", { name: "Chapter 2: Electrical path", exact: true }).click()
    await expect(story).toHaveAttribute("data-chapter", "1")
  }
  await readingEvidence(canvas, "before-story-hold", story)
  if (requireActivePath) expect(startedPlaying, "Native qualification requires actual Play before the reading hold").toBe(true)
  const comparison = page.getByTestId("hypothetical-minimum")
  await comparison.locator(":scope > summary").click()
  await expect(story).toHaveAttribute("data-playing", "false")
  const chapter = await story.getAttribute("data-chapter")
  const saved = await savedPreferences(page)
  await scrollFacilityIntoView(inspector)
  await expect.poll(async () => (await snapshot(canvas)).readingHold).toBe(true)
  await page.waitForTimeout(500)
  await expect(story).toHaveAttribute("data-chapter", chapter!)
  await expect(story.getByRole("button", { name: "Play story", exact: true })).toBeDisabled()
  await assertVisibleFreeze(page, inspector, canvas)
  await readingEvidence(canvas, "story-held", story)
  await comparison.locator(":scope > summary").click()
  await scrollFacilityIntoView(inspector)
  await expect.poll(async () => (await snapshot(canvas)).readingHold).toBe(false)
  await page.waitForTimeout(500)
  await expect(story).toHaveAttribute("data-playing", "false")
  await expect(story).toHaveAttribute("data-chapter", chapter!)
  expect(await savedPreferences(page)).toBe(saved)
  await playIfPermitted(story, canvas)
  const resumedActive = await verifyPermittedActivity(page, inspector, canvas, "story-resumed")
  if (!resumedActive) {
    await expect(story.getByRole("button", { name: "Play story", exact: true })).toBeDisabled()
    await expect(story).toContainText("Motion is resting to keep interaction responsive")
    await story.getByRole("button", { name: "Chapter 5: Screening result", exact: true }).click()
    await expect(story).toHaveAttribute("data-chapter", "4")
    await expect(story).toHaveAttribute("data-playing", "false")
  }
  const final = await readingEvidence(canvas, "story-explicit-resume-or-still", story)
  const activePath = startedPlaying && resumedActive && final.quality !== "still" && await story.getAttribute("data-playing") === "true"
  test.info().annotations.push({ type: "reading-story-path", description: activePath ? "Actual Play → reading hold → stopped chapter → explicit Play verified." : "Adaptive Still preserved; manual chapters, reading hold and no automatic playback verified. Active playback interruption not claimed." })
  if (requireActivePath) expect(activePath, "Native qualification requires actual Play → hold → explicit Play").toBe(true)
})

test("published briefs and hypothetical examples remain usable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const page = await context.newPage()
  try {
    await page.goto("/demo?scenario=b")
    const comparison = page.locator("#hypothetical-minimum")
    await comparison.locator(":scope > summary").click()
    await expect(comparison.getByRole("table")).toBeVisible()
    await expect(comparison.getByRole("row")).toHaveCount(6)
    await expect(page.locator("canvas")).toHaveCount(0)
    await page.goto("/evidence")
    for (const scenario of ["A", "B", "C", "D"]) {
      await expect(page.getByRole("link", { name: `Read fixture ${scenario} brief`, exact: true })).toHaveAttribute("href", `/evidence/assessments/demo-01-${scenario.toLowerCase()}/v1.0.0`)
      await expect(page.getByRole("link", { name: `Download fixture ${scenario} technical record`, exact: true })).toHaveAttribute("href", `/downloads/assessment/demo-01-${scenario.toLowerCase()}/v1.0.0/json`)
    }
  } finally { await context.close() }
})
