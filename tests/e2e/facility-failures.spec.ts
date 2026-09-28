import { expect, test, type Page, type Route } from "@playwright/test"
import { scrollFacilityIntoView } from "../support/facility-viewer"

const modelPath = "**/assets/facility/**/facility.glb"

async function openManual(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  await page.goto("/")
  const inspector = page.getByTestId("facility-inspection")
  await scrollFacilityIntoView(inspector)
  await expect(inspector.locator(".facility-systems").getByRole("button", { name: "Power", exact: true })).toBeVisible()
  await expect(inspector.getByRole("button", { name: "Explore in 3D", exact: true })).toBeVisible()
  await expect(inspector).toHaveAttribute("data-phase", "poster")
  return inspector
}

/** Keep a request pending without leaving a delayed route handler after a test. */
async function holdModel(page: Page) {
  let unblock = () => {}
  let held: Route | undefined
  const gate = new Promise<void>(resolve => { unblock = resolve })
  await page.route(modelPath, async route => {
    held = route
    await gate
    await route.continue().catch(() => {}) // A disposed session may have aborted it.
  })
  return {
    requested: () => Boolean(held),
    release: async () => { await page.unroute(modelPath); unblock() },
  }
}

test.describe("facility failure boundaries", () => {
  test.setTimeout(30_000)

  test("a missing poster retains evidence controls and supports explicit 3D activation", async ({ page }) => {
    let missingPosters = 0
    await page.route("**/assets/facility/**/poster-*.webp", route => { missingPosters++; return route.fulfill({ status: 404, contentType: "text/plain", body: "Missing poster fixture" }) })
    const inspector = await openManual(page)
    expect(missingPosters).toBeGreaterThan(0)
    await expect(inspector).toContainText("Facility illustration unavailable")
    await expect(inspector.getByTestId("facility-assessment-caption")).toContainText("5.8 MW")
    await inspector.getByRole("button", { name: /Storage/ }).click()
    await expect(inspector).toContainText("Independent storage capacity and dispatchability are unassessed")
    await inspector.getByRole("button", { name: "Explore in 3D" }).click()
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    await expect(inspector).not.toContainText("Facility illustration unavailable")
  })

  test("same-length corrupt model bytes fail integrity and leave the assessment unchanged", async ({ page }) => {
    let intercepted = 0
    await page.route(modelPath, async route => {
      const response = await route.fetch({ headers: { ...route.request().headers(), "accept-encoding": "identity" } })
      const bytes = Buffer.from(await response.body())
      bytes[bytes.length - 1] ^= 1
      intercepted++
      await route.fulfill({ status: 200, contentType: "model/gltf-binary", headers: { "content-length": String(bytes.length), "cache-control": "no-store" }, body: bytes })
    })
    const inspector = await openManual(page)
    const before = await inspector.getByTestId("facility-assessment-caption").textContent()
    await inspector.getByRole("button", { name: "Explore in 3D" }).click()
    await expect(inspector).toHaveAttribute("data-phase", "failed")
    expect(intercepted).toBe(1)
    await expect(inspector.locator(".facility-poster")).toBeVisible()
    await expect(inspector.getByTestId("facility-assessment-caption")).toHaveText(before!)
    await expect(inspector.locator("canvas")).toHaveCount(0)
    await expect(inspector.getByRole("button", { name: "Retry 3D" })).toBeVisible()
  })

  test("an oversized model response is rejected before rendering", async ({ page }) => {
    await page.route(modelPath, route => route.fulfill({ status: 200, contentType: "model/gltf-binary", body: Buffer.alloc(2_500_001) }))
    const inspector = await openManual(page)
    await inspector.getByRole("button", { name: "Explore in 3D" }).click()
    await expect(inspector).toHaveAttribute("data-phase", "failed")
    await expect(inspector.locator("canvas")).toHaveCount(0)
    await expect(inspector.getByTestId("facility-assessment-caption")).toContainText("7.0 MW")
    await expect(inspector.getByRole("button", { name: "Retry 3D" })).toBeVisible()
  })

  test("the overall deadline restores the poster and the next attempt requires explicit retry", async ({ page }) => {
    const transfer = await holdModel(page)
    try {
      const inspector = await openManual(page)
      const started = Date.now()
      await inspector.getByRole("button", { name: "Explore in 3D" }).focus()
      await page.keyboard.press("Enter")
      await expect(inspector.getByLabel("Display options", { exact: true })).toBeFocused()
      await expect.poll(transfer.requested).toBe(true)
      await expect(inspector).toHaveAttribute("data-phase", "failed", { timeout: 11_000 })
      expect(Date.now() - started).toBeGreaterThanOrEqual(7_500)
      await expect(inspector).toHaveAttribute("data-failure", "timeout")
      await expect(inspector.getByRole("button", { name: "Retry 3D" })).toBeFocused()
      await expect(inspector.locator(".facility-poster")).toBeVisible()
      await transfer.release()
      await page.waitForTimeout(250)
      await expect(inspector).toHaveAttribute("data-phase", "failed")
      await page.keyboard.press("Enter")
      await expect(inspector).toHaveAttribute("data-phase", "ready")
      await expect(inspector.getByLabel("Display options", { exact: true })).toBeFocused()
      await expect(inspector.getByTestId("facility-assessment-caption")).toContainText("5.8 MW")
    } finally { await transfer.release() }
  })

  test("a failed deferred script import is contained by the poster and HTML controls", async ({ page }) => {
    const inspector = await openManual(page)
    let blockedScripts = 0, modelRequests = 0
    page.on("request", request => { if (request.url().endsWith("facility.glb")) modelRequests++ })
    // Initial scripts have loaded. Save-Data prevents an earlier graphics import.
    await page.route("**/_next/static/**/*.js", route => {
      if (route.request().resourceType() === "script") { blockedScripts++; return route.abort("failed") }
      return route.continue()
    })
    await inspector.getByRole("button", { name: "Explore in 3D" }).click()
    await expect(inspector).toHaveAttribute("data-phase", "failed")
    expect(blockedScripts).toBeGreaterThan(0)
    expect(modelRequests).toBe(0)
    await expect(inspector.locator(".facility-poster")).toBeVisible()
    await inspector.getByRole("button", { name: /Cooling/ }).click()
    await expect(inspector).toContainText("Cooling evidence")
    await expect(inspector.getByTestId("facility-assessment-caption")).toContainText("5.8 MW")
    await page.unroute("**/_next/static/**/*.js")
    await inspector.getByRole("button", { name: "Retry 3D" }).click()
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    await expect(inspector.getByRole("button", { name: /Cooling/ })).toHaveAttribute("aria-pressed", "true")
  })

  test("client navigation during a pending model load cannot mount or announce a stale scene", async ({ page }) => {
    const transfer = await holdModel(page)
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    try {
      const inspector = await openManual(page)
      await inspector.getByRole("button", { name: "Explore in 3D" }).click()
      await expect.poll(transfer.requested).toBe(true)
      await page.locator('a[data-analytics-source="home-hero"]').click()
      await expect(page).toHaveURL(url => url.pathname === "/assessment" && url.hash === "#scope")
      await transfer.release()
      await expect(page.getByTestId("facility-inspection")).toHaveCount(0)
      await page.waitForTimeout(350)
      await expect(page.locator("canvas[data-facility-canvas]")).toHaveCount(0)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      expect(errors).toEqual([])
    } finally { await transfer.release() }
  })

  test("actual WebGL context loss restores the poster and explicit retry creates a fresh session", async ({ page }) => {
    await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    const inspector = await openManual(page)
    const caption = inspector.getByTestId("facility-assessment-caption")
    const before = await caption.textContent()
    const scenario = await inspector.getAttribute("data-scenario")
    const brief = page.getByRole("link", { name: "Read this decision brief", exact: true })
    const publication = await brief.getAttribute("href")
    await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    const original = await inspector.locator("canvas").elementHandle()
    expect(original).not.toBeNull()
    try {
      const lost = await original!.evaluate(element => {
        const extension = (element as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context")
        if (!extension) return false
        extension.loseContext()
        return true
      })
      expect(lost, "This check requires actual WEBGL_lose_context support").toBe(true)
      await expect(inspector).toHaveAttribute("data-phase", "failed")
      await expect(inspector.locator(".facility-poster")).toBeVisible()
      await expect(inspector.locator("canvas")).toHaveCount(0)
      await expect(caption).toHaveText(before!)
      await expect(inspector).toHaveAttribute("data-scenario", scenario!)
      await expect(brief).toHaveAttribute("href", publication!)
      await expect.poll(() => original!.evaluate(element => !element.isConnected && typeof (element as HTMLCanvasElement).__gnFacilitySnapshot === "undefined")).toBe(true)
      // Failure must remain static until the user requests a new graphics session.
      await page.waitForTimeout(350)
      await expect(inspector).toHaveAttribute("data-phase", "failed")
      await inspector.getByRole("button", { name: "Retry 3D", exact: true }).click()
      await scrollFacilityIntoView(inspector)
      await expect(inspector).toHaveAttribute("data-phase", "ready")
      await expect(page.locator("canvas[data-facility-canvas]")).toHaveCount(1)
      expect(await inspector.locator("canvas").evaluate((element, previous) => element !== previous, original)).toBe(true)
      await expect(caption).toHaveText(before!)
      await expect(caption).toContainText("7.0 MW")
      await expect(caption).toContainText("5.8 MW")
      await expect(inspector).toHaveAttribute("data-scenario", scenario!)
      await expect(brief).toHaveAttribute("href", publication!)
      expect(errors).toEqual([])
    } finally { await original?.dispose() }
  })

  test("three client route pairs replace sessions without growing owned resources or retaining stale canvases", async ({ page }) => {
    test.setTimeout(60_000)
    await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
    const errors: string[] = [], modelRequests: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/facility.glb")) modelRequests.push(request.url()) })
    const inspector = await openManual(page)
    await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    const documentOrigin = await page.evaluate(() => performance.timeOrigin)
    let documentRequests = 0
    page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests++ })
    const resources = () => inspector.locator("canvas").evaluate(element => {
      const snapshot = (element as HTMLCanvasElement).__gnFacilitySnapshot!()
      // These are session-owned counts/estimates, not total browser-process memory.
      return { geometries: snapshot.geometries, textures: snapshot.textures, materials: snapshot.materials, estimatedBytes: snapshot.estimatedBytes, environmentBytes: snapshot.environmentBytes }
    })
    const baseline = await resources()
    expect(baseline.geometries).toBeGreaterThan(0)
    expect(baseline.textures).toBeGreaterThan(0)
    expect(modelRequests).toHaveLength(1)
    let activations = 1
    for (let pair = 0; pair < 3; pair++) for (const destination of ["/demo", "/"]) {
      const previous = await inspector.locator("canvas").elementHandle()
      try {
        // The hero is a real Next Link. Back returns through its client history;
        // the intentionally native header Home link belongs to the separate test.
        if (destination === "/demo") await page.getByRole("link", { name: "See a sample decision brief", exact: true }).first().click()
        else await page.goBack()
        await expect(page).toHaveURL(url => url.pathname === destination)
        await expect(page.locator(destination === "/demo" ? ".facility-inspection--demo" : ".facility-inspection--hero")).toBeVisible()
        expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentOrigin)
        await scrollFacilityIntoView(inspector)
        await expect(inspector).toHaveAttribute("data-phase", "poster")
        await expect(page.locator("canvas[data-facility-canvas]")).toHaveCount(0)
        await expect.poll(() => previous!.evaluate(element => !element.isConnected && typeof (element as HTMLCanvasElement).__gnFacilitySnapshot === "undefined")).toBe(true)
        expect(modelRequests).toHaveLength(activations)
        await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
        await scrollFacilityIntoView(inspector)
        await expect(inspector).toHaveAttribute("data-phase", "ready")
        activations++
        await expect(page.locator("canvas[data-facility-canvas]")).toHaveCount(1)
        expect(await resources()).toEqual(baseline)
        expect(modelRequests).toHaveLength(activations)
        await expect(destination === "/demo" ? page.getByTestId("assessment-summary") : inspector.getByTestId("facility-assessment-caption")).toContainText("5.8 MW")
      } finally { await previous?.dispose() }
    }
    expect(activations).toBe(7)
    expect(documentRequests).toBe(0)
    expect(errors).toEqual([])
  })

  test("native header navigation destroys the previous document and creates a bounded fresh graphics session", async ({ page }) => {
    await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    const inspector = await openManual(page)
    await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    const previous = await inspector.locator("canvas").elementHandle()
    const before = await inspector.locator("canvas").evaluate(element => {
      const state = (element as HTMLCanvasElement).__gnFacilitySnapshot!()
      return { origin: performance.timeOrigin, geometries: state.geometries, textures: state.textures, materials: state.materials, estimatedBytes: state.estimatedBytes }
    })
    let documents = 0
    page.on("request", request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++ })
    try {
      const trigger = page.locator("[data-mobile-menu] > summary")
      if (await trigger.isVisible()) await trigger.click()
      await page.getByRole("banner").getByRole("link", { name: "Sample brief", exact: true }).click()
      await expect(page).toHaveURL(url => url.pathname === "/demo" && url.hash === "#decision-brief")
      expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(before.origin)
      expect(documents).toBe(1)
      await expect(previous!.evaluate(element => element.isConnected)).rejects.toThrow()
      await scrollFacilityIntoView(inspector)
      await expect(inspector.getByRole("button", { name: "Explore in 3D", exact: true })).toBeVisible()
      await expect(page.locator("canvas[data-facility-canvas]")).toHaveCount(0)
      await inspector.getByRole("button", { name: "Explore in 3D", exact: true }).click()
      await expect(inspector).toHaveAttribute("data-phase", "ready")
      const after = await inspector.locator("canvas").evaluate(element => {
        const state = (element as HTMLCanvasElement).__gnFacilitySnapshot!()
        return { geometries: state.geometries, textures: state.textures, materials: state.materials, estimatedBytes: state.estimatedBytes }
      })
      expect(after).toEqual({ geometries: before.geometries, textures: before.textures, materials: before.materials, estimatedBytes: before.estimatedBytes })
      await expect(page.locator("canvas[data-facility-canvas]")).toHaveCount(1)
      await expect(page.getByTestId("assessment-summary")).toContainText("5.8 MW")
      expect(errors).toEqual([])
    } finally { await previous?.dispose() }
  })

  test("a slow connection prevents automatic model download but permits manual activation", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: false, effectiveType: "2g" } }))
    const requests: string[] = []
    page.on("request", request => { if (request.url().endsWith("facility.glb")) requests.push(request.url()) })
    await page.goto("/")
    const inspector = page.getByTestId("facility-inspection")
    await scrollFacilityIntoView(inspector)
    await page.waitForTimeout(1_700)
    expect(requests).toEqual([])
    await expect(inspector).toHaveAttribute("data-phase", "poster")
    await inspector.getByRole("button", { name: "Explore in 3D" }).click()
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    expect(requests).toHaveLength(1)
  })

  test("an offscreen viewer waits for 25% visibility before automatic download", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 130 })
    const requests: string[] = []
    page.on("request", request => { if (request.url().endsWith("facility.glb")) requests.push(request.url()) })
    await page.goto("/")
    const inspector = page.getByTestId("facility-inspection")
    // Avoid locator actions that would scroll the viewer into the viewport.
    const bounds = await inspector.locator(".facility-stage").boundingBox()
    expect(bounds).not.toBeNull()
    expect(Math.max(0, 130 - bounds!.y) / bounds!.height).toBeLessThan(0.25)
    await page.waitForTimeout(1_700)
    expect(requests).toEqual([])
    await expect(inspector).toHaveAttribute("data-phase", "poster")
    await page.setViewportSize({ width: 1440, height: 1100 })
    await expect(inspector).toHaveAttribute("data-phase", "ready")
    expect(requests).toHaveLength(1)
  })
})
