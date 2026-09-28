import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, expect, test, type Browser } from "@playwright/test"
import { Launcher } from "chrome-launcher"

test("real background tabs defer cinematic acquisition and pause native playback without losing user intent", async ({ baseURL }, testInfo) => {
  test.skip(process.env.CINEMATIC_E2E !== "1", "Requires the explicitly selected cinematic candidate; absence is not animation evidence")
  test.skip(testInfo.project.name !== "chrome-stable" || testInfo.project.use.headless !== false, "Requires isolated headed Chrome with native tab visibility")
  // Ordinary Playwright contexts emulate every tab as visible. This fresh
  // profile and noDefaults CDP connection preserve real visibility transitions.
  let userDataDir: string | undefined, chrome: Launcher | undefined, browser: Browser | undefined
  let releasePoster = () => {}
  try {
    userDataDir = await mkdtemp(join(tmpdir(), "gridninja-cinematic-visibility-"))
    chrome = new Launcher({ userDataDir, chromeFlags: ["--window-size=1440,1100", "--no-first-run"] })
    await chrome.launch()
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`, { noDefaults: true })
    const context = browser.contexts()[0], page = await context.newPage(), blocker = await context.newPage()
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.emulateMedia({ reducedMotion: "no-preference" })
    const posterGate = new Promise<void>(resolve => { releasePoster = resolve })
    await page.route("**/assets/cinematic/**/poster-*.webp", async route => { await posterGate; await route.continue().catch(() => {}) })
    const movies = new Set<string>(), models: string[] = []
    page.on("request", request => {
      const path = new URL(request.url()).pathname
      if (path.endsWith(".mp4")) movies.add(request.url())
      if (path.endsWith(".glb")) models.push(request.url())
    })
    await page.bringToFront()
    await page.goto(new URL("/", baseURL).href, { waitUntil: "domcontentloaded" })
    const player = page.getByTestId("cinematic-facility"), video = player.locator("video")
    await page.locator(".gn-home-invitation").scrollIntoViewIfNeeded()
    await expect(player).toHaveAttribute("data-reason", "offscreen")
    await player.locator(".cinematic-stage").scrollIntoViewIfNeeded()
    const decision = await page.locator(".gn-home-decision").textContent()
    await blocker.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden")
    releasePoster()
    await expect(player).toHaveAttribute("data-poster-ready-ms", /\d/)
    await page.waitForTimeout(500)
    await expect(video).not.toHaveAttribute("src")
    await expect(player).toHaveAttribute("data-reason", "hidden")
    expect(movies.size).toBe(0)

    await page.bringToFront()
    await expect(player).toHaveAttribute("data-state", "playing", { timeout: 20_000 })
    await expect(player).toHaveAttribute("data-frame-evidence", "presented-frame")
    const snapshot = () => video.evaluate(element => ({ time: (element as HTMLVideoElement).currentTime, paused: (element as HTMLVideoElement).paused }))
    await expect.poll(async () => (await snapshot()).time).toBeGreaterThan(.25)
    await blocker.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden")
    await expect(player).toHaveAttribute("data-state", "suspended")
    await expect.poll(async () => (await snapshot()).paused).toBe(true)
    const before = await snapshot()
    await page.waitForTimeout(500)
    expect(await snapshot()).toEqual(before)
    await page.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible")
    const returned = await snapshot()
    expect(Math.abs(returned.time - before.time)).toBeLessThan(.4)
    await expect(player).toHaveAttribute("data-state", "playing")
    await expect.poll(async () => (await snapshot()).time).toBeGreaterThan(before.time + .05)

    await player.getByRole("button", { name: "Pause facility animation", exact: true }).click()
    await expect(player).toHaveAttribute("data-state", "paused")
    const userPaused = await snapshot()
    await blocker.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden")
    await page.bringToFront()
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible")
    await expect(player).toHaveAttribute("data-state", "paused")
    expect(await snapshot()).toEqual(userPaused)
    expect(movies.size).toBe(1)
    expect(models).toEqual([])
    expect(await page.locator(".gn-home-decision").textContent()).toBe(decision)
    await testInfo.attach("native-cinematic-visibility", { body: Buffer.from(JSON.stringify({ visibility: "real-background-tab", acquisitionWhileHidden: false, before, returned, userPaused, renditions: [...movies], models })), contentType: "application/json" })
  } finally {
    releasePoster()
    try { await browser?.close() } finally {
      try { await chrome?.kill() } finally { if (userDataDir) await rm(userDataDir, { recursive: true, force: true }) }
    }
  }
})
