import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  await page.goto("/")
  await page.waitForLoadState("networkidle")
})

test("failed home enhancement retains the decision and an explicit recovery action", async ({ page }) => {
  await page.route("**/_next/static/**/*.js", route => route.abort())
  await page.locator("[data-facility-activate]").click()
  await expect(page.getByText(/Interactive inspection could not load/)).toBeVisible()
  await expect(page.getByRole("button", { name: /Retry.*inspection/i })).toBeVisible()
  await expect(page.getByTestId("facility-assessment-caption")).toContainText("7.0 MW")
  await expect(page.getByRole("link", { name: "Inspect rack construction", exact: true })).toBeVisible()
})

test("a hung home enhancement reaches its failure deadline without losing the static poster", async ({ page }) => {
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route("**/_next/static/**/*.js", async route => { await gate; await route.abort().catch(() => {}) })
  try {
    await page.locator("[data-facility-activate]").click()
    await expect(page.getByText(/Interactive inspection could not load/)).toBeVisible({ timeout: 11_000 })
    const poster = page.locator(".facility-stage img")
    await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
    await expect(page.getByTestId("facility-inspection")).toHaveAttribute("data-phase", "poster")
  } finally {
    release()
    await page.unroute("**/_next/static/**/*.js")
  }
})

test("modified home activation keeps native link behavior", async ({ page }) => {
  const activation = page.locator("[data-facility-activate]")
  const prevented = await activation.evaluate(link => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })
    // Cancel only at the final document boundary, after observing the component handler.
    let componentPrevented = false
    document.addEventListener("click", event => { componentPrevented = event.defaultPrevented; event.preventDefault() }, { once: true })
    link.dispatchEvent(event)
    return componentPrevented
  })
  expect(prevented).toBe(false)
  await expect(activation).toHaveAttribute("href", /\/demo\?.*activate=1/)
})

test("visited deferred sections retain their layout when the reader returns to the offer", async ({ page }) => {
  const sections = page.locator(".gn-content-auto")
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
