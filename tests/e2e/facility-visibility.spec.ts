import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, expect, test, type Browser } from "@playwright/test"
import { Launcher } from "chrome-launcher"

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
    await page.goto(baseURL!, { waitUntil: "domcontentloaded" })
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
    await expect(viewer).toHaveAttribute("data-phase", "ready")
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
