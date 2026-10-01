import { waitForFacilityReady, expectFacilityAutomaticAcquisition } from "../support/facility-viewer"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, expect, test, type Browser } from "@playwright/test"
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
