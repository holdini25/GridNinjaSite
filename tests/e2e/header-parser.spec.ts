import { expect, test } from "@playwright/test"

for (const route of ["/", "/assessment"] as const) {
  test(`hero parses through a held stylesheet fixture on ${route}`, async ({ page, baseURL }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const documentURL = new URL(route, baseURL).href
    const fixturePath = "/__qa__/header-parser-stylesheet-gate.css"
    const fixtureURL = new URL(fixturePath, documentURL).href
    const heldStylesheets: string[] = []
    const releasedStylesheets: string[] = []
    const clientErrors: string[] = []
    let enhancementRequests = 0
    let releaseStyles!: () => void
    let releaseEnhancement!: () => void
    const stylesGate = new Promise<void>(resolve => { releaseStyles = resolve })
    const enhancementGate = new Promise<void>(resolve => { releaseEnhancement = resolve })
    page.on("pageerror", error => clientErrors.push(error.message))
    page.on("console", message => {
      if (message.type() === "error" && /hydrat|server rendered|did not match/i.test(message.text())) clientErrors.push(message.text())
    })
    await page.route(fixtureURL, async request => {
      heldStylesheets.push(request.request().url())
      await stylesGate
      await request.fulfill({
        contentType: "text/css",
        body: "/* Test-only parser gate. No application style rules. */",
      })
      releasedStylesheets.push(request.request().url())
    })
    await page.route(documentURL, async request => {
      if (request.request().resourceType() !== "document") {
        await request.continue()
        return
      }
      const response = await request.fetch()
      expect(response.status()).toBe(200)
      const html = await response.text()
      expect(html.match(/<\/head>/g)).toHaveLength(1)
      // Preserve the actual production response and styles. The additional
      // no-op stylesheet recreates a parser barrier even when production CSS
      // is inlined. This is controlled regression evidence, not load timing.
      await request.fulfill({
        response,
        body: html.replace("</head>", `<link rel="stylesheet" href="${fixturePath}"></head>`),
      })
    })
    await page.route("**/header-controls.mjs", async request => {
      enhancementRequests += 1
      await enhancementGate
      await request.continue()
    })

    try {
      await page.goto(route, { waitUntil: "commit" })
      await expect.poll(() => heldStylesheets).toEqual([fixtureURL])
      // Attachment, not visibility: the fixture stylesheet is unavailable. A
      // classic inline script before <main> blocks on it even if app CSS exists.
      const heading = page.locator("main h1")
      const body = page.locator(route === "/" ? "main .gn-home-lead" : "main [data-hero-body]")
      await expect(heading, "main heading must parse before stylesheet release").toBeAttached({ timeout: 3_000 })
      await expect(body, "main body must parse before stylesheet release").toBeAttached({ timeout: 3_000 })
      await expect(body).toContainText(route === "/" ? "paid, bounded assessment" : "authorized historical inputs")
      expect(releasedStylesheets).toEqual([])
      expect(enhancementRequests).toBe(0)
      await testInfo.attach("stylesheet-gated-parser", {
        body: Buffer.from(JSON.stringify({ evidence: "controlled-document-fixture; additional no-op stylesheet, production CSS unchanged; not performance qualification", route, fixtureURL, heldStylesheets, releasedStylesheets, heading: await heading.textContent(), body: await body.textContent() }, null, 2)),
        contentType: "application/json",
      })

      releaseStyles()
      await page.waitForLoadState("domcontentloaded")
      await expect(heading).toBeVisible()
      await expect(body).toBeVisible()
      await expect.poll(() => releasedStylesheets.length).toBe(heldStylesheets.length)
      const header = page.locator("#site-header")
      if (route === "/assessment") {
        await expect(header.locator('a[aria-current="page"]').first()).toHaveAttribute("href", "/assessment")
      } else {
        await expect(header.locator('a[aria-current="page"]')).toHaveCount(0)
      }
      expect(enhancementRequests).toBe(0)

      const menu = page.locator("[data-mobile-menu]")
      const trigger = menu.locator(":scope > summary")
      await trigger.click()
      await expect(menu).toHaveAttribute("open", "")
      await expect.poll(() => enhancementRequests).toBe(1)
      // With its enhancement response still held, the native disclosure and
      // exact destinations are already usable.
      await expect(header).not.toHaveAttribute("data-enhanced", "true")
      const dialog = page.getByRole("dialog", { name: "Site navigation" })
      await expect(dialog.getByRole("link", { name: "Sample brief", exact: true })).toHaveAttribute("href", "/demo#decision-brief")
      await expect(dialog.getByRole("link", { name: "Scope an assessment", exact: true })).toHaveAttribute("href", "/assessment?source=header#scope")

      releaseEnhancement()
      await expect(header).toHaveAttribute("data-enhanced", "true")
      await expect(dialog).toHaveAttribute("aria-modal", "true")
      await expect(dialog.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused()
      await page.keyboard.press("Escape")
      await expect(menu).not.toHaveAttribute("open")
      await expect(trigger).toBeFocused()
      expect(enhancementRequests).toBe(1)
      expect(clientErrors).toEqual([])
    } finally {
      releaseStyles()
      releaseEnhancement()
      await page.unrouteAll({ behavior: "wait" })
    }
  })
}
