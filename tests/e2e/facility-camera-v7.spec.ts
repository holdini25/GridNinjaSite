import { expect, test, type Locator } from "@playwright/test"
import { mkdir, readFile } from "node:fs/promises"
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three"
import type { FacilityEquipmentIndex } from "../../src/types/facility"
import { scrollFacilityIntoView } from "../support/facility-viewer"

type PickCamera = {
  cameraProjection: "orthographic" | "perspective"; cameraFov: number | null; cameraAspect: number
  cameraFrustum: [number, number, number, number] | null; cameraClip: [number, number]
  cameraPosition: [number, number, number]; cameraTarget: [number, number, number]
  transitionRemaining: number; ecosystem?: { section: boolean }
}
const cameraSnapshot = (canvas: Locator) => canvas.evaluate(element => (element as unknown as { __gnFacilitySnapshot: () => PickCamera }).__gnFacilitySnapshot())

/** Project an authored front-face point using only public camera diagnostics.
 * Selection itself always goes through real pointer events and the live raycast. */
async function rackFacePoint(canvas: Locator) {
  await expect.poll(async () => (await cameraSnapshot(canvas)).transitionRemaining).toBe(0)
  const release = await canvas.locator("xpath=ancestor::*[@data-release][1]").getAttribute("data-release")
  expect(release).toMatch(/^facility-v\d+$/)
  const manifest = JSON.parse(await readFile(`src/content/facility-releases/${release}/manifest.json`, "utf8")) as { equipmentIndex: FacilityEquipmentIndex }
  const rack = manifest.equipmentIndex.equipment.find(item => item.id === "rack-02")!
  expect(rack, "The current release must publish the authored Rack 03 bounds").toBeDefined()
  const frame = await cameraSnapshot(canvas), box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  const camera = frame.cameraProjection === "perspective"
    ? new PerspectiveCamera(frame.cameraFov!, frame.cameraAspect, ...frame.cameraClip)
    : new OrthographicCamera(...frame.cameraFrustum!, ...frame.cameraClip)
  camera.position.fromArray(frame.cameraPosition); camera.lookAt(new Vector3(...frame.cameraTarget)); camera.updateMatrixWorld(true)
  const point = new Vector3((rack.bounds.min[0] + rack.bounds.max[0]) / 2, rack.bounds.min[1] + (rack.bounds.max[1] - rack.bounds.min[1]) * .42, rack.bounds.max[2]).project(camera)
  expect(Math.abs(point.x)).toBeLessThan(.95); expect(Math.abs(point.y)).toBeLessThan(.95)
  expect(point.z).toBeGreaterThan(-1); expect(point.z).toBeLessThan(1)
  return { x: box!.x + (point.x + 1) * box!.width / 2, y: box!.y + (1 - point.y) * box!.height / 2 }
}

test("the homepage assessment CTA remains above the fold at 1366 by 768", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto("/")
  const callToAction = page.locator('main a[data-gn-event="hero-primary-cta"]')
  await expect(callToAction).toHaveText("Contact Us")
  await expect(callToAction).toHaveAttribute("href", "/assessment?source=home-hero#scope")
  const bounds = await callToAction.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.y).toBeGreaterThan(0)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(768)
})

test("v7 explicit projection changes reuse the canvas, preserve evidence, and restore closed overview", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/demo?scenario=b&perspective=engineering")
  const inspector = page.getByTestId("facility-inspection")
  await expect(inspector).toHaveAttribute("data-night-inspection", "true")
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-phase", "ready")
  const canvas = inspector.locator("canvas[data-ready=true]"), original = await canvas.elementHandle()
  const caption = page.getByTestId("assessment-summary"), evidence = await caption.textContent()
  const snapshot = () => canvas.evaluate(element => (element as unknown as { __gnFacilitySnapshot: () => { cameraProjection: string; cameraFov: number | null; cameraAspect: number; probeRendered: boolean; ecosystem?: { section: boolean } } }).__gnFacilitySnapshot())
  expect((await snapshot()).cameraProjection).toBe("orthographic")
  await inspector.getByRole("button", { name: "View rack close-up", exact: true }).click()
  await expect(inspector).toHaveAttribute("data-detail", "rack")
  await expect.poll(async () => (await snapshot()).cameraProjection).toBe("perspective")
  expect((await snapshot()).cameraFov).toBe(32)
  expect((await snapshot()).probeRendered).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  await scrollFacilityIntoView(inspector)
  await expect.poll(async () => (await snapshot()).cameraAspect).toBeCloseTo(4 / 3, 2)
  await inspector.getByRole("button", { name: "View air-path cutaway", exact: true }).click()
  await expect.poll(async () => (await snapshot()).ecosystem?.section).toBe(true)
  await inspector.getByRole("button", { name: "Return to overview", exact: true }).click()
  await expect.poll(async () => (await snapshot()).cameraProjection).toBe("orthographic")
  expect((await snapshot()).ecosystem?.section).toBe(false)
  expect(await canvas.evaluate((element, prior) => element === prior, original)).toBe(true)
  await expect(caption).toHaveText(evidence!)
  expect(errors).toEqual([])
})

test("real v7 pointer picks survive perspective resize and overview restoration while an eight-pixel excursion cancels", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto("/demo?scenario=b&perspective=engineering")
  const inspector = page.getByTestId("facility-inspection")
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-night-inspection", "true")
  await expect(inspector.getByRole("button", { name: "View rack close-up", exact: true })).toBeEnabled()
  const canvas = inspector.locator("canvas[data-ready=true]")
  await expect(canvas).toBeVisible()
  const caption = page.getByTestId("assessment-summary"), evidence = await caption.textContent()
  const selectedRack = inspector.locator('[data-public-equipment-id="rack-02"]')
  const clickRack = async () => {
    // A completed DOM scroll can precede IntersectionObserver visibility delivery.
    // Wait for visible paints before presenting an actual user pointer gesture.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))))
    const point = await rackFacePoint(canvas)
    await page.mouse.click(point.x, point.y)
  }
  const expectRack = async () => {
    await expect(page).toHaveURL(url => url.searchParams.get("focus") === "rack-02")
    await expect(selectedRack).toHaveAttribute("aria-pressed", "true")
    await expect(inspector.locator(".facility-systems").getByRole("button", { name: "Workloads", exact: true })).toHaveAttribute("aria-pressed", "true")
  }
  await inspector.getByRole("button", { name: "View rack close-up", exact: true }).click()
  await expect(inspector).toHaveAttribute("data-detail", "rack")
  expect((await cameraSnapshot(canvas)).cameraProjection).toBe("perspective")
  await clickRack(); await expectRack()

  await inspector.getByRole("button", { name: "Clear selection", exact: true }).click()
  await expect(page).toHaveURL(url => !url.searchParams.has("focus"))
  await scrollFacilityIntoView(inspector)
  const gesture = await rackFacePoint(canvas)
  await page.mouse.move(gesture.x, gesture.y); await page.mouse.down()
  await page.mouse.move(gesture.x + 8, gesture.y); await page.mouse.move(gesture.x, gesture.y); await page.mouse.up()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(null))))
  await expect(page).toHaveURL(url => !url.searchParams.has("focus"))
  await expect(selectedRack).toHaveAttribute("aria-pressed", "false")

  await page.setViewportSize({ width: 390, height: 844 })
  await scrollFacilityIntoView(inspector)
  await expect.poll(async () => (await cameraSnapshot(canvas)).cameraAspect).toBeCloseTo(4 / 3, 2)
  await clickRack(); await expectRack()
  await inspector.getByRole("button", { name: "View air-path cutaway", exact: true }).click()
  await expect.poll(async () => (await cameraSnapshot(canvas)).ecosystem?.section).toBe(true)
  await inspector.getByRole("button", { name: "Return to overview", exact: true }).click()
  await expect.poll(async () => (await cameraSnapshot(canvas)).cameraProjection).toBe("orthographic")
  expect((await cameraSnapshot(canvas)).ecosystem?.section).toBe(false)
  await expectRack()

  await inspector.getByRole("button", { name: "Clear selection", exact: true }).click()
  await scrollFacilityIntoView(inspector)
  await clickRack(); await expectRack()
  await expect(caption).toHaveText(evidence!)
  expect(errors).toEqual([])
})

test("rear Rack 09 detail preserves its identity and provides an explicit unobstructed assembly alternative", async ({ page }, testInfo) => {
  await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 1440, height: 1100 })
  const specimenRequests: string[] = []
  page.on("request", request => { if (/\/(rack|cooling)\.glb$/.test(new URL(request.url()).pathname)) specimenRequests.push(request.url()) })
  await page.goto("/demo?scenario=b&perspective=engineering&focus=rack-08")
  const inspector = page.getByTestId("facility-inspection")
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-night-inspection", "true")
  await expect(inspector.getByRole("button", { name: "View rack close-up", exact: true })).toBeEnabled()
  const canvas = inspector.locator("canvas[data-ready=true]")
  await expect(canvas).toBeVisible()
  await inspector.getByRole("button", { name: "View rack close-up", exact: true }).click()
  await expect(inspector).toHaveAttribute("data-detail", "rack")
  const note = inspector.getByTestId("facility-rack-occlusion")
  await expect(note).toContainText("In-place detail: Rack 09")
  await expect(note).toContainText("Front-row equipment obscures this in-place view.")
  await expect(note.getByRole("button", { name: "Open representative rack assembly", exact: true })).toBeEnabled()
  const output = `build/facility/${await inspector.getAttribute("data-release")}/picking-review/${testInfo.project.name}`
  await mkdir(output, { recursive: true })
  for (const [device, width, height] of [["desktop", 1440, 1100], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height })
    await scrollFacilityIntoView(inspector)
    await expect.poll(async () => (await cameraSnapshot(canvas)).transitionRemaining).toBe(0)
    await canvas.screenshot({ path: `${output}/rear-rack09-${device}-detail.png` })
    await note.screenshot({ path: `${output}/rear-rack09-${device}-note.png` })
    await expect(page).toHaveURL(url => url.searchParams.get("focus") === "rack-08")
    await expect(inspector.locator('[data-public-equipment-id="rack-08"]')).toHaveAttribute("aria-pressed", "true")
    await testInfo.attach(`rear-rack09-${device}`, { path: `${output}/rear-rack09-${device}-detail.png`, contentType: "image/png" })
  }
  expect(specimenRequests).toEqual([])
  await note.getByRole("button", { name: "Open representative rack assembly", exact: true }).click()
  await expect(inspector).toHaveAttribute("data-view", "rack")
  expect(specimenRequests.filter(url => url.endsWith("/rack.glb"))).toHaveLength(1)
})
