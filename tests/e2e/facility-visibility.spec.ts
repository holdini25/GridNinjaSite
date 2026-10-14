import { waitForFacilityReady, expectFacilityAutomaticAcquisition } from "../support/facility-viewer"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, expect, test, type Browser, type Page } from "@playwright/test"
import { Launcher } from "chrome-launcher"

test("real background-tab explicit deep link waits past its deadline then activates on foreground", async ({ baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "chrome-stable" || testInfo.project.use.headless !== false, "Requires an isolated headed Chrome default context without focus emulation")
  let userDataDir: string | undefined
  let chrome: Launcher | undefined
  let browser: Browser | undefined
  try {
    userDataDir = await mkdtemp(join(tmpdir(), "gridninja-deep-link-visibility-"))
    chrome = new Launcher({ userDataDir, chromeFlags: ["--window-size=1440,1100", "--no-first-run"] })
    await chrome.launch()
    // noDefaults preserves native tab visibility; never emulate a foreground tab.
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`, { noDefaults: true })
    const context = browser.contexts()[0]
    const page = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.addInitScript(() => {
      const changes = [document.visibilityState]
      Object.assign(window, { __GN_DEEP_LINK_VISIBILITY__: changes })
      document.addEventListener("visibilitychange", () => changes.push(document.visibilityState))
    })
    const modelRequests: string[] = []
    page.on("request", request => { if (new URL(request.url()).pathname.endsWith(".glb")) modelRequests.push(request.url()) })
    const blocker = await context.newPage()
    await blocker.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden")
    await page.goto(new URL("/demo?activate=1#facility-construction", baseURL).href, { waitUntil: "domcontentloaded" })
    const viewer = page.getByTestId("facility-inspection")
    // Require the enhanced inspector, not just the server's static preview.
    await expect(viewer.locator(".facility-systems button")).toHaveCount(4)
    const hiddenStartedAt = Date.now()
    await page.waitForTimeout(9_000)
    const hiddenVisibility = await page.evaluate(() => (window as unknown as Window & { __GN_DEEP_LINK_VISIBILITY__: string[] }).__GN_DEEP_LINK_VISIBILITY__)
    expect(hiddenVisibility.every(state => state === "hidden")).toBe(true)
    expect(await page.evaluate(() => document.visibilityState)).toBe("hidden")
    await expect(viewer).toHaveAttribute("data-phase", "poster")
    await expect(viewer).not.toHaveAttribute("data-failure")
    await expect(viewer.locator("canvas")).toHaveCount(0)
    expect(modelRequests).toEqual([])
    const hiddenDurationMs = Date.now() - hiddenStartedAt

    await page.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible")
    // No fallback helper or extra click: the original deep-link intent must work.
    await expect(viewer).toHaveAttribute("data-phase", "ready")
    await expect(viewer.locator("canvas[data-ready=true]")).toHaveCount(1)
    expect(modelRequests).toHaveLength(1)
    await page.screenshot({ path: testInfo.outputPath("foreground-ready.png") })
    await testInfo.attach("native-deep-link-visibility", {
      body: Buffer.from(JSON.stringify({ hiddenDurationMs, hiddenVisibility, hiddenPhase: "poster", hiddenModelRequests: 0, foregroundPhase: "ready", modelRequests }, null, 2)),
      contentType: "application/json",
    })
  } finally {
    try { await browser?.close() } finally {
      try { await chrome?.kill() } finally { if (userDataDir) await rm(userDataDir, { recursive: true, force: true }) }
    }
  }
})

test("real background-tab startup retains its model past the deadline and becomes ready on foreground", async ({ baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "chrome-stable" || testInfo.project.use.headless !== false, "Requires an isolated headed Chrome default context without focus emulation")
  let userDataDir: string | undefined
  let chrome: Launcher | undefined
  let browser: Browser | undefined
  let page: Page | undefined
  let releaseModel = () => {}
  try {
    userDataDir = await mkdtemp(join(tmpdir(), "gridninja-startup-visibility-"))
    chrome = new Launcher({ userDataDir, chromeFlags: ["--window-size=1440,1100", "--no-first-run"] })
    await chrome.launch()
    // Use the same real visibility owner as the other headed cases, not a
    // Playwright context that makes background tabs appear visible.
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`, { noDefaults: true })
    const context = browser.contexts()[0]
    const activePage = page = await context.newPage()
    await activePage.setViewportSize({ width: 1440, height: 1100 })
    await activePage.addInitScript(() => {
      const changes = [document.visibilityState]
      Object.assign(window, { __GN_STARTUP_VISIBILITY__: changes })
      document.addEventListener("visibilitychange", () => changes.push(document.visibilityState))
    })
    const modelGate = new Promise<void>(resolve => { releaseModel = resolve })
    await activePage.route("**/*.glb", async route => { await modelGate; await route.continue() })
    const modelRequests: string[] = []
    activePage.on("request", request => { if (new URL(request.url()).pathname.endsWith(".glb")) modelRequests.push(request.url()) })
    const blocker = await context.newPage()
    await activePage.bringToFront()
    await expect.poll(() => activePage.evaluate(() => document.visibilityState)).toBe("visible")
    await activePage.goto(new URL("/demo?activate=1#facility-construction", baseURL).href, { waitUntil: "domcontentloaded" })
    const viewer = activePage.getByTestId("facility-inspection")
    await expect(viewer.locator(".facility-systems button")).toHaveCount(4)
    await expect.poll(() => modelRequests.length).toBe(1)
    await expect(viewer).toHaveAttribute("data-phase", "loading")
    await expect(viewer.locator("canvas[data-ready=true]")).toHaveCount(0)
    expect(await activePage.evaluate(() => document.visibilityState)).toBe("visible")

    await blocker.bringToFront()
    await expect.poll(() => activePage.evaluate(() => document.visibilityState)).toBe("hidden")
    const visibilityHistory = () => activePage.evaluate(() => (window as unknown as Window & { __GN_STARTUP_VISIBILITY__: string[] }).__GN_STARTUP_VISIBILITY__)
    await expect.poll(async () => (await visibilityHistory()).at(-1)).toBe("hidden")
    const hiddenStartIndex = (await visibilityHistory()).length - 1
    const hiddenStartedAt = Date.now()
    const modelResponse = activePage.waitForResponse(response => new URL(response.url()).pathname.endsWith(".glb"))
    releaseModel()
    const response = await modelResponse
    expect(response.ok()).toBe(true)
    expect(await response.finished()).toBeNull()
    // The real asset completes in the background. Even after the entire old
    // wall-clock deadline, the first-frame wait must retain this acquisition.
    await activePage.waitForTimeout(9_000)
    const hiddenVisibility = (await visibilityHistory()).slice(hiddenStartIndex)
    const hiddenState = {
      hiddenDurationMs: Date.now() - hiddenStartedAt,
      hiddenVisibility,
      visibility: await activePage.evaluate(() => document.visibilityState),
      phase: await viewer.getAttribute("data-phase"),
      failure: await viewer.getAttribute("data-failure"),
      readyCanvases: await viewer.locator("canvas[data-ready=true]").count(),
      modelRequests: [...modelRequests],
      modelResponseStatus: response.status(),
    }
    await testInfo.attach("native-background-startup", { body: Buffer.from(JSON.stringify(hiddenState, null, 2)), contentType: "application/json" })
    expect(hiddenVisibility.every(state => state === "hidden")).toBe(true)
    expect(hiddenState.visibility).toBe("hidden")
    expect(hiddenState.hiddenDurationMs).toBeGreaterThan(8_000)
    expect(hiddenState.phase).toMatch(/^(loading|staging)$/)
    expect(hiddenState.failure).toBeNull()
    expect(hiddenState.readyCanvases).toBe(0)
    expect(modelRequests).toHaveLength(1)

    await activePage.bringToFront()
    await expect.poll(() => activePage.evaluate(() => document.visibilityState)).toBe("visible")
    // No readiness helper, Retry click, or second activation may recover it.
    await expect(viewer).toHaveAttribute("data-phase", "ready")
    await expect(viewer).not.toHaveAttribute("data-failure")
    await expect(viewer.locator("canvas[data-ready=true]")).toHaveCount(1)
    await expect(viewer.getByRole("button", { name: "Retry 3D", exact: true })).toHaveCount(0)
    expect(modelRequests).toHaveLength(1)
    const equipmentConnections = viewer.getByRole("button", { name: "Authored equipment connections", exact: true })
    await expect(equipmentConnections).toBeVisible()
    await expect(equipmentConnections).toBeEnabled()
    await activePage.screenshot({ path: testInfo.outputPath("foreground-startup-ready.png") })
    await expect(viewer.getByRole("button", { name: "Retry assembly", exact: true })).toHaveCount(0)
    await expect(viewer.getByText("The requested view did not become ready within eight seconds.", { exact: false })).toHaveCount(0)
    await testInfo.attach("native-background-startup-recovery", {
      body: Buffer.from(JSON.stringify({ foregroundPhase: "ready", visibilityHistory: await visibilityHistory(), modelRequests }, null, 2)),
      contentType: "application/json",
    })
  } finally {
    releaseModel()
    try { await page?.unrouteAll({ behavior: "wait" }) } finally {
      try { await browser?.close() } finally {
        try { await chrome?.kill() } finally { if (userDataDir) await rm(userDataDir, { recursive: true, force: true }) }
      }
    }
  }
})

test("real background-tab visibility defers activation and freezes equipment", async ({ baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "chrome-stable" || testInfo.project.use.headless !== false, "Requires an isolated headed Chrome default context without focus emulation")
  // Playwright's normal contexts force every tab to appear visible. Its documented
  // noDefaults CDP option preserves native visibility in a fresh private profile.
  let userDataDir: string | undefined
  let chrome: Launcher | undefined
  let browser: Browser | undefined
  let releasePoster = () => {}
  try {
    userDataDir = await mkdtemp(join(tmpdir(), "gridninja-tab-visibility-"))
    // Keep the owner before launch so even a partially started Chrome is cleaned up.
    chrome = new Launcher({ userDataDir, chromeFlags: ["--window-size=1440,1100", "--no-first-run"] })
    await chrome.launch()
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`, { noDefaults: true })
    const context = browser.contexts()[0]
    const page = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.addInitScript(() => { (window as Window & { __GN_FACILITY_DIAGNOSTICS__?: boolean }).__GN_FACILITY_DIAGNOSTICS__ = true })
    const posterGate = new Promise<void>(resolve => { releasePoster = resolve })
    await page.route("**/assets/facility/**/poster-*.webp", async route => { await posterGate; await route.continue().catch(() => {}) })
    const modelRequests: string[] = []
    page.on("request", request => { if (request.url().endsWith("/facility.glb")) modelRequests.push(request.url()) })
    const blocker = await context.newPage()
    await page.bringToFront()
    await page.goto(new URL("/demo?interactive=1", baseURL).href, { waitUntil: "domcontentloaded" })
    const viewer = page.getByTestId("facility-inspection")
    // The server preview has native links and is replaced during enhancement.
    // Wait for the real system controls before scrolling its persistent stage;
    // the intercepted poster still prevents automatic graphics activation.
    const systems = viewer.locator(".facility-systems button")
    await expect(systems).toHaveCount(4)
    await expect(systems.first()).toBeVisible()
    await viewer.locator(".facility-stage").scrollIntoViewIfNeeded()
    await blocker.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden")
    releasePoster()
    await page.waitForTimeout(2_000)
    expect(modelRequests).toEqual([])
    await expect(viewer).toHaveAttribute("data-phase", "poster")

    await page.bringToFront()
    await expectFacilityAutomaticAcquisition(page, viewer, modelRequests)
    await waitForFacilityReady(page, viewer, testInfo)
    const canvas = viewer.locator("canvas")
    const snapshot = () => canvas.evaluate(element => {
      const diagnostic = (element as HTMLCanvasElement & { __gnFacilitySnapshot: (equipment: boolean) => { frames: number; equipment: { fans: { phase: number }[]; ledColors: number[] } } }).__gnFacilitySnapshot(true)
      if (!diagnostic.equipment) throw new Error("Missing equipment diagnostics")
      return { frames: diagnostic.frames, equipment: diagnostic.equipment }
    })
    await page.waitForTimeout(150)
    await blocker.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden")
    await page.waitForTimeout(150)
    const before = await snapshot()
    await page.waitForTimeout(500)
    expect(await snapshot()).toEqual(before)
    await page.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible")
    const resumed = await snapshot()
    for (const [index, fan] of resumed.equipment.fans.entries()) {
      expect((fan.phase - before.equipment.fans[index].phase + 2 * Math.PI) % (2 * Math.PI)).toBeLessThan(0.4)
    }
    await expect.poll(async () => (await snapshot()).frames).toBeGreaterThan(resumed.frames)
  } finally {
    releasePoster()
    try { await browser?.close() } finally {
      try { await chrome?.kill() } finally { if (userDataDir) await rm(userDataDir, { recursive: true, force: true }) }
    }
  }
})
