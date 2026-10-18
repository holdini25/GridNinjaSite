import { expect, test } from "./support/client-health"

test("founder profiles support keyboard disclosure and preserve the engagement boundary", async ({ page, clientHealth }) => {
  await page.goto("/about/founders")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meet the founders.")
  for (const name of ["Holden Chung", "Jonathan Malone"]) {
    const profile = page.getByRole("article", { name })
    await expect(profile.getByRole("img", { name })).toBeVisible()
    const disclosure = profile.locator("details")
    await disclosure.locator("summary").focus()
    await page.keyboard.press("Enter")
    await expect(disclosure).toHaveAttribute("open", "")
    await expect(disclosure.locator("p")).toBeVisible()
    await page.keyboard.press("Space")
    await expect(disclosure).not.toHaveAttribute("open", "")
  }
  await expect(page.locator("main")).toContainText("agreed during scoping")
  await expect(page.getByRole("link", { name: "Contact GridNinja", exact: true })).toHaveAttribute("href", "/contact")
  await expect(page.locator('main a[href^="tel:"], main a[href^="mailto:"]')).toHaveCount(0)
  await clientHealth.expectNoHorizontalOverflow()
})

test("founders remain readable and navigable without JavaScript and with reduced motion", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, reducedMotion: "reduce", viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()
    const submissions: string[] = []
    page.on("request", request => { if (request.method() !== "GET") submissions.push(request.method()) })
    await page.goto("/about/founders")
    await expect(page.getByRole("heading", { name: "Holden Chung", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Jonathan Malone", exact: true })).toBeVisible()
    const disclosure = page.getByRole("article", { name: "Jonathan Malone" }).locator("details")
    await disclosure.locator("summary").click()
    await expect(disclosure.locator("p")).toBeVisible()
    await page.getByRole("link", { name: "About GridNinja", exact: true }).click()
    await expect(page).toHaveURL(/\/about$/)
    await expect(page.getByRole("link", { name: "Meet Holden and Jonathan", exact: true })).toHaveAttribute("href", "/about/founders")
    expect(submissions).toEqual([])
  } finally { await context.close() }
})
