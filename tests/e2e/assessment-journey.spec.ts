import { expect, test } from "./support/client-health"

test("homepage advances the worked decision and offer while preserving the complete civic chapter", async ({ page, clientHealth }) => {
  await page.goto("/")
  const order = await page.locator(".gn-home").evaluate(home => [...home.children].map(section => section.id || section.className))
  expect(order).toEqual(["gn-home-hero", "decision-brief", "assessment-process", "solutions", "evidence", "gn-home-section gn-home-mechanism", "shared-infrastructure", "gn-home-section gn-home-research", "gn-home-invitation"])
  await expect(page.locator("#shared-infrastructure .gn-civic-responsibilities li")).toHaveCount(3)
  await expect(page.locator("#shared-infrastructure [data-civic-release]")).toHaveAttribute("data-civic-release", "civic-v2")
  await expect(page.locator("#assessment-process")).toContainText("before paid work begins")
  await clientHealth.expectNoHorizontalOverflow()
})

test("direct scope links retain visible form access after the fuller offer", async ({ page, clientHealth }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/assessment#scope")
  const heading = page.locator("#scope")
  await expect(heading).toBeVisible()
  await expect.poll(async () => {
    const [header, title, name] = await Promise.all([
      page.getByRole("banner").boundingBox(), heading.boundingBox(), page.getByLabel("Name", { exact: true }).boundingBox(),
    ])
    return Boolean(header && title && name && title.y >= header.y + header.height && name.y + name.height <= 844)
  }, { message: "The scope anchor keeps its heading and first field below the sticky header" }).toBe(true)
  await expect(page.locator("[data-assessment-offer] details")).not.toHaveAttribute("open", "")
  await clientHealth.expectNoHorizontalOverflow()
})

test("no-JS assessment reading and navigation remain available without an unsafe submission", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  try {
    const page = await context.newPage()
    const intakeRequests: string[] = []
    page.on("request", request => { if (new URL(request.url()).pathname === "/api/contact") intakeRequests.push(request.method()) })
    await page.goto("/assessment#scope")
    await expect(page.locator("[data-assessment-offer]")).toContainText("authorized historical inputs")
    await expect(page.getByLabel("Name", { exact: true })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Scope an assessment" })).toBeDisabled()
    // Playwright's aggregate text matcher skips noscript descendants even in
    // a no-JS context. Assert the actual rendered paragraph directly.
    const noScriptNotice = page.locator("form noscript p")
    await expect(noScriptNotice).toBeVisible()
    await expect(noScriptNotice).toHaveText("This form needs JavaScript and security verification to submit safely. Enable JavaScript and reload this page. No inquiry has been sent by opening this page.")
    expect(intakeRequests).toEqual([])
  } finally { await context.close() }
})
