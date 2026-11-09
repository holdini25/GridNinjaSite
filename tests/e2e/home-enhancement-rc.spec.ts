import { expect, test } from "@playwright/test"

// The home no longer imports a facility viewer. Graphics import recovery remains
// covered on /demo; this route must retain its actual server-first contract.
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
})

test("failed JavaScript leaves the homepage poster, decision and native destinations usable", async ({ page }) => {
  await page.route("**/_next/static/**/*.js", route => route.abort())
  const motion: string[] = []
  page.on("request", request => { if (/\.(mp4|glb)(?:\?|$)/.test(request.url())) motion.push(request.url()) })
  await page.goto("/")
  const poster = page.locator(".gn-home-hero .cinematic-poster img")
  await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await expect(page.locator(".gn-home-decision")).toContainText("7.0 MW")
  await expect(page.locator(".gn-home-decision")).toContainText("5.8 MW")
  await expect(page.locator(".gn-home-decision")).toContainText("No site action is authorized")
  await expect(page.getByTestId("facility-inspection")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /facility animation/ })).toHaveCount(0)
  expect(motion).toEqual([])
  await page.locator(".gn-home-hero").getByRole("link", { name: "See a sample decision brief", exact: true }).click()
  await expect(page).toHaveURL(/\/demo.*#decision-brief/)
  await expect(page.getByTestId("assessment-summary")).toContainText("5.8 MW")
})

test("a delayed script cannot block the server-rendered offer or the sample-brief destination", async ({ page }) => {
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route("**/_next/static/**/*.js", async route => { await gate; await route.abort().catch(() => {}) })
  try {
    await page.goto("/", { waitUntil: "commit" })
    await expect(page.locator(".gn-home-decision")).toContainText("5.8 MW")
    const poster = page.locator(".gn-home-hero .cinematic-poster img")
    await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    await expect(page.locator(".gn-home-hero").getByRole("link", { name: /Scope an assessment/ })).toHaveAttribute("href", "/assessment?source=home-hero#scope")
    await page.locator(".gn-home-hero").getByRole("link", { name: "See a sample decision brief", exact: true }).click({ noWaitAfter: true })
    await expect(page).toHaveURL(/\/demo.*#decision-brief/)
    await expect(page.getByTestId("assessment-summary")).toContainText("5.8 MW")
  } finally {
    release()
    await page.unroute("**/_next/static/**/*.js")
  }
})

test("modified sample-brief activation keeps native link behavior", async ({ page }) => {
  await page.goto("/")
  const activation = page.locator(".gn-home-hero").getByRole("link", { name: "See a sample decision brief", exact: true })
  const prevented = await activation.evaluate(link => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })
    // Cancel only at the final document boundary, after observing the component handler.
    let componentPrevented = false
    document.addEventListener("click", event => { componentPrevented = event.defaultPrevented; event.preventDefault() }, { once: true })
    link.dispatchEvent(event)
    return componentPrevented
  })
  expect(prevented).toBe(false)
  await expect(activation).toHaveAttribute("href", "/demo?scenario=b&version=1.0.0&perspective=business#decision-brief")
})

test("visited homepage sections retain their layout when the reader returns to the offer", async ({ page }) => {
  await page.goto("/")
  const sections = page.locator(".gn-home-section")
  const count = await sections.count()
  expect(count).toBeGreaterThan(0)
  const observed: number[] = []
  for (let index = 0; index < count; index++) {
    const section = sections.nth(index)
    await section.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }))
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    observed.push(await section.evaluate(element => element.getBoundingClientRect().height))
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }))
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const revisited = await sections.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
  expect(revisited).toHaveLength(observed.length)
  for (let index = 0; index < count; index++) {
    expect(Math.abs(revisited[index] - observed[index]), `Visited section ${index} changed height after leaving view`).toBeLessThanOrEqual(1)
  }
})
