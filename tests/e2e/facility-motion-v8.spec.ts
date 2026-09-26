import { openFacilityDisplayOptions } from "../support/facility-viewer"
import { createHash } from "node:crypto"
import { expect, test, type Locator, type Page } from "@playwright/test"
import { scrollFacilityIntoView } from "../support/facility-viewer"

test.use({ video: "on" })

type RackSnapshot = {
  frames: number; hiddenFrameCount: number; quality: string
  cameraPosition: number[]; cameraTarget: number[]; cameraFrustum: number[]
  rackMotion: { door: number; tray: number; cutaway: boolean; targetDoor: number; targetTray: number; moving: boolean }
}
type MotionCanvas = Omit<HTMLCanvasElement, "__gnFacilitySnapshot"> & {
  __gnFacilitySnapshot: () => RackSnapshot
  __motionSamples?: RackSnapshot[]
  __motionSampling?: boolean
}
const snapshot = (canvas: Locator) => canvas.evaluate(element => (element as unknown as MotionCanvas).__gnFacilitySnapshot())
const cameraFrame = (state: RackSnapshot) => [state.cameraPosition, state.cameraTarget, state.cameraFrustum]

async function openRack(page: Page, reducedMotion = false) {
  await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
  await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" })
  await page.goto("/demo?scenario=b&perspective=engineering")
  const inspector = page.getByTestId("facility-inspection")
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-phase", "ready")
  await inspector.getByRole("button", { name: "Inspect rack construction", exact: true }).click()
  await expect(inspector).toHaveAttribute("data-view", "rack")
  // Mechanical capability is required by this suite, irrespective of release name.
  // A new release must not silently skip its inherited safety guarantees.
  await expect(inspector.locator('.facility-rack-actions[aria-label="Rack actions"]')).toBeVisible()
  const canvas = inspector.locator("canvas[data-ready=true]")
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 0, tray: 0, moving: false })
  return { inspector, canvas, actions: inspector.locator(".facility-rack-actions"), handles: inspector.locator(".facility-rack-handles") }
}

async function startSampling(canvas: Locator) {
  await canvas.evaluate(element => {
    const target = element as unknown as MotionCanvas
    target.__motionSamples = []; target.__motionSampling = true
    const sample = () => {
      if (!target.__motionSampling || !target.isConnected) return
      if (target.__motionSamples!.length < 360) target.__motionSamples!.push(target.__gnFacilitySnapshot())
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}
async function stopSampling(canvas: Locator) {
  return canvas.evaluate(element => { const target = element as unknown as MotionCanvas; target.__motionSampling = false; const samples = target.__motionSamples ?? []; delete target.__motionSamples; return samples })
}

test("v8 extension opens the door first, shows real intermediate joints, and holds the camera during tray travel", async ({ page }) => {
  const { inspector, canvas, actions } = await openRack(page)
  const original = await canvas.elementHandle(), assessment = page.getByTestId("assessment-summary"), quantities = await assessment.textContent()
  const camera = cameraFrame(await snapshot(canvas))
  await startSampling(canvas)
  await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion, { intervals: [10, 20, 50] }).toMatchObject({ door: 1, tray: 1, moving: false })
  const forward = await stopSampling(canvas)
  expect(forward.some(state => state.rackMotion.door > .1 && state.rackMotion.door < .9)).toBe(true)
  expect(forward.some(state => state.rackMotion.tray > .1 && state.rackMotion.tray < .9)).toBe(true)
  for (const state of forward) {
    if (state.rackMotion.tray > 0) expect(state.rackMotion.door).toBe(1)
    expect(cameraFrame(state)).toEqual(camera)
  }
  await startSampling(canvas)
  await actions.getByRole("button", { name: "Close rack", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 0, tray: 0, moving: false })
  const reverse = await stopSampling(canvas)
  expect(reverse.some(state => state.rackMotion.tray > .1 && state.rackMotion.tray < .9)).toBe(true)
  expect(reverse.some(state => state.rackMotion.door > .1 && state.rackMotion.door < .9)).toBe(true)
  for (const state of reverse) if (state.rackMotion.door < 1) expect(state.rackMotion.tray).toBe(0)
  expect(await canvas.evaluate((element, prior) => element === prior, original)).toBe(true)
  await expect(inspector).toHaveAttribute("data-pose", "closed")
  await expect(assessment).toHaveText(quantities!)
})

test("v8 user reversal preserves current transforms and cutaway remains independent", async ({ page }) => {
  const { canvas, actions } = await openRack(page)
  await actions.getByRole("button", { name: "Open door", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion.door, { intervals: [10] }).toBeGreaterThan(.08)
  const before = (await snapshot(canvas)).rackMotion.door
  expect(before).toBeLessThan(.95)
  await startSampling(canvas)
  await actions.getByRole("button", { name: "Close rack", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 0, tray: 0, moving: false })
  const samples = await stopSampling(canvas)
  expect(samples.some(state => state.rackMotion.targetDoor === 0 && state.rackMotion.door > 0 && state.rackMotion.door < 1)).toBe(true)
  expect(Math.max(...samples.map(state => state.rackMotion.door))).toBeLessThan(1)
  await actions.getByRole("button", { name: "Cutaway view", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ cutaway: true, door: 0, tray: 0 })
  await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion.tray, { intervals: [10] }).toBeGreaterThan(.08)
  expect((await snapshot(canvas)).rackMotion.tray).toBeLessThan(.95)
  await startSampling(canvas)
  await actions.getByRole("button", { name: "Retract server tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 0, cutaway: true, moving: false })
  const trayReverse = await stopSampling(canvas)
  expect(trayReverse.some(state => state.rackMotion.targetTray === 0 && state.rackMotion.tray > 0 && state.rackMotion.tray < 1)).toBe(true)
  expect(Math.max(...trayReverse.map(state => state.rackMotion.tray))).toBeLessThan(1)
})

test("v8 reduced motion keeps native handle and toolbar commands equivalent without activity frames", async ({ page }) => {
  const { inspector, canvas, actions, handles } = await openRack(page, true)
  await expect(inspector.getByRole("button", { name: /^(Pause|Resume)$/ })).toHaveCount(0)
  await expect(handles.getByRole("button", { name: "Open door", exact: true })).toBeVisible()
  await handles.getByRole("button", { name: "Open door", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 0, moving: false })
  await expect(actions.getByRole("button", { name: "Close rack", exact: true })).toHaveAttribute("aria-pressed", "true")
  await handles.getByRole("button", { name: "Extend tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, moving: false })
  await expect(actions.getByRole("button", { name: "Retract server tray", exact: true })).toHaveAttribute("aria-pressed", "true")
  await actions.getByRole("button", { name: "Close rack", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 0, tray: 0, moving: false })
  await expect(handles.getByRole("button", { name: "Open door", exact: true })).toBeVisible()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  const before = await snapshot(canvas)
  await page.waitForTimeout(300)
  expect((await snapshot(canvas)).frames).toBe(before.frames)
})

test("authored service-detail capability preserves legacy controls or gates cutaway close-up behind completed extension", async ({ page }, testInfo) => {
  const modelRequests: string[] = []
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".glb")) modelRequests.push(request.url()) })
  const rackResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/rack.glb"))
  const { inspector, canvas, actions, handles } = await openRack(page, true)
  const bytes = await (await rackResponse).body()
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"))
  const rawMetadata = document.nodes.find((node: { extras?: { gnSpecimen?: unknown } }) => node.extras?.gnSpecimen)?.extras.gnSpecimen
  const metadata = typeof rawMetadata === "string" ? JSON.parse(rawMetadata) : rawMetadata
  expect(metadata?.rackMotion).toBeTruthy()
  const hasDetail = metadata.rackMotion.serviceDetail !== undefined
  if (process.env.FACILITY_REQUIRE_SERVICE_DETAIL === "1") expect(hasDetail, "This candidate claims the authored service-detail capability").toBe(true)
  await testInfo.attach("service-detail-capability", { body: JSON.stringify({ path: hasDetail ? "authored-service-detail" : "legacy-no-service-detail", modelSha256: createHash("sha256").update(bytes).digest("hex"), required: process.env.FACILITY_REQUIRE_SERVICE_DETAIL === "1" }), contentType: "application/json" })
  const originalCanvas = await canvas.elementHandle(), assessment = await page.getByTestId("assessment-summary").textContent()
  const wholeCamera = cameraFrame(await snapshot(canvas)), downloaded = [...modelRequests]
  const inspect = actions.getByRole("button", { name: "Inspect service connection (cutaway)", exact: true })
  if (!hasDetail) {
    await expect(inspect).toHaveCount(0)
    await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
    await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, moving: false })
    expect(cameraFrame(await snapshot(canvas))).toEqual(wholeCamera)
    expect(modelRequests).toEqual(downloaded)
    await expect(page.getByTestId("assessment-summary")).toHaveText(assessment!)
    return
  }
  await expect(inspect).toBeDisabled()
  await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect(inspect).toBeEnabled()
  await inspect.click()
  await expect(inspector.locator(".facility-stage")).toHaveAttribute("data-specimen-detail", "service-connection")
  expect((await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, cutaway: true, moving: false })
  expect(cameraFrame(await snapshot(canvas))).not.toEqual(wholeCamera)
  for (const name of ["Close rack", "Retract server tray", "Restore side panel"]) await expect(actions.getByRole("button", { name, exact: true })).toBeDisabled()
  expect(await handles.locator("button").evaluateAll(buttons => buttons.every(button => (button as HTMLButtonElement).disabled))).toBe(true)
  await expect(inspector.getByText(/Service connection cutaway:/)).toContainText("side panel is removed")
  await actions.getByRole("button", { name: "Return to whole assembly", exact: true }).click()
  await expect(inspector.locator(".facility-stage")).not.toHaveAttribute("data-specimen-detail")
  expect(cameraFrame(await snapshot(canvas))).toEqual(wholeCamera)
  expect((await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, cutaway: true, moving: false })
  await expect(actions.getByRole("button", { name: "Retract server tray", exact: true })).toBeEnabled()
  await actions.getByRole("button", { name: "Retract server tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 0, cutaway: true, moving: false })
  expect(modelRequests).toEqual(downloaded)
  expect(await canvas.evaluate((element, previous) => element === previous, originalCanvas)).toBe(true)
  await expect(page.getByTestId("assessment-summary")).toHaveText(assessment!)
})

test("v8 explicit Pause and equipment-off snap safely and retain the pause preference", async ({ page }) => {
  const { inspector, canvas, actions } = await openRack(page)
  await inspector.getByRole("button", { name: "Pause", exact: true }).click()
  await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, moving: false })
  await expect(inspector.getByRole("button", { name: "Resume", exact: true })).toHaveAttribute("aria-pressed", "true")
  await actions.getByRole("button", { name: "Close rack", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 0, tray: 0, moving: false })
  await openFacilityDisplayOptions(inspector)
  await inspector.getByRole("checkbox", { name: "Equipment motion" }).uncheck()
  await inspector.getByRole("button", { name: "Resume", exact: true }).click()
  await expect(inspector.getByRole("button", { name: /^(Pause|Resume)$/ })).toHaveCount(0)
  await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, moving: false })
})

test("v8 offscreen suspension freezes an unfinished joint without replaying elapsed hidden time", async ({ page }) => {
  const { inspector, canvas, actions } = await openRack(page)
  await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion.door, { intervals: [10] }).toBeGreaterThan(.05)
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }))
  await expect(inspector.locator(".facility-stage")).not.toBeInViewport()
  await page.waitForTimeout(120)
  const before = await snapshot(canvas)
  expect(before.rackMotion.moving).toBe(true)
  // Longer than the asset deadline: an already-loaded joint must remain pending
  // while hidden, without being mistaken for a timed-out asset switch.
  await page.waitForTimeout(8_500)
  const hidden = await snapshot(canvas)
  expect(hidden.rackMotion).toEqual(before.rackMotion)
  expect(hidden.frames).toBe(before.frames)
  expect(hidden.hiddenFrameCount).toBe(0)
  await scrollFacilityIntoView(inspector)
  const resumed = await snapshot(canvas)
  expect(resumed.rackMotion.tray).toBeLessThan(1)
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, moving: false })
})

test("mechanical commands remain bounded after a delayed main-thread callback", async ({ page }) => {
  const { canvas, actions } = await openRack(page)
  await startSampling(canvas)
  await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
  await expect.poll(async () => (await snapshot(canvas)).rackMotion.door, { intervals: [10] }).toBeGreaterThan(.05)
  await page.evaluate(() => { const end = performance.now() + 250; while (performance.now() < end) { /* Controlled main-thread stall, local test only. */ } })
  await expect.poll(async () => (await snapshot(canvas)).rackMotion).toMatchObject({ door: 1, tray: 1, moving: false })
  const samples = await stopSampling(canvas)
  expect(samples.length).toBeGreaterThan(2)
  let previousDoor = 0, previousTray = 0
  for (const { rackMotion: joint } of samples) {
    expect(joint.door).toBeGreaterThanOrEqual(previousDoor); expect(joint.door).toBeLessThanOrEqual(1)
    expect(joint.tray).toBeGreaterThanOrEqual(previousTray); expect(joint.tray).toBeLessThanOrEqual(1)
    if (joint.tray > 0) expect(joint.door).toBe(1)
    previousDoor = joint.door; previousTray = joint.tray
  }
})
