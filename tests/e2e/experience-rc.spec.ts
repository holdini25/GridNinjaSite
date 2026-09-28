import { expect, test } from "@playwright/test"

test("native evidence activation survives a press begun before hydration and enhancement", async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route("**/_next/static/**/*.js", async route => { await gate; await route.continue().catch(() => {}) })
  try {
    await page.goto("/demo?scenario=c&version=1.0.0", { waitUntil: "commit" })
    const link = page.getByRole("link", { name: "Download this technical record", exact: true })
    await expect(link).toHaveAttribute("href", "/downloads/assessment/demo-01-c/v1.0.0/json")
    await link.scrollIntoViewIfNeeded()
    const box = await link.boundingBox()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await expect.poll(() => link.evaluate(node => node.matches(":active"))).toBe(true)
    release()
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("button", { name: "Retry interactive inspection" })).toHaveCount(0)
    await expect(page.getByText("Preparing interactive inspection.", { exact: false })).toHaveCount(0)
    await expect(page.locator(".facility-systems")).toHaveCount(0)
    await expect.poll(() => link.evaluate(node => node.matches(":active"))).toBe(true)
    const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/downloads/assessment/demo-01-c/v1.0.0/json")
    const downloadPromise = browserName === "webkit" && process.platform === "linux" ? null : page.waitForEvent("download")
    await page.mouse.up()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    expect(response.headers()["content-disposition"]).toBe('attachment; filename="gridninja-demo-01-c-v1.0.0.json"')
    if (downloadPromise) expect((await downloadPromise).suggestedFilename()).toBe("gridninja-demo-01-c-v1.0.0.json")
    // Engines that focus links retain that native node until focus leaves it.
    const outside = page.getByRole("link", { name: "GridNinja home", exact: true }).first()
    await outside.focus()
    await expect(page.getByRole("button", { name: "Reset example", exact: true, includeHidden: true })).toBeAttached()
    await expect(outside).toBeFocused()
    await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "c")
  } finally {
    release()
    await page.mouse.up().catch(() => {})
    await page.unroute("**/_next/static/**/*.js")
  }
})

test("the mobile decision and form destination expose useful content immediately", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  await page.goto("/demo")
  const summary = page.getByTestId("assessment-summary")
  for (const label of ["7.0 MW", "5.8 MW"]) {
    const value = summary.getByRole("definition").filter({ hasText: label })
    await expect(value).toHaveText(label)
    await expect(value).toBeVisible()
  }
  const question = summary.locator("[data-decision-question]")
  const box = await question.boundingBox()
  expect(box!.y + box!.height).toBeLessThan(844)
  await expect(page.locator("[data-assessment-controls]")).not.toHaveAttribute("open")
  await page.goto("/assessment?source=demo-final&topic=ai-cloud#scope")
  const anchor = page.locator("#scope")
  await expect(anchor).toHaveJSProperty("tagName", "H2")
  await expect.poll(async () => (await anchor.boundingBox())!.y).toBeGreaterThan(70)
  await expect.poll(async () => (await anchor.boundingBox())!.y).toBeLessThan(110)
  const name = page.getByLabel("Name", { exact: true })
  await expect.poll(async () => { const box = await name.boundingBox(); return box!.y + box!.height }).toBeLessThan(844)
  await expect(name).not.toBeFocused()
  await expect(page.getByRole("heading", { name: "Start with the decision in front of your team" })).toBeVisible()
})

test("a rejected enhancement retains real posters and truthful native assessment selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  // Exercise the explicit activation path with no observer-based prefetch.
  await page.addInitScript(() => Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined }))
  await page.goto("/demo?scenario=b&topic=ai-cloud")
  await page.waitForLoadState("networkidle")
  await page.route("**/_next/static/**/*.js", route => route.abort())
  await page.getByRole("link", { name: "Explore the facility in 3D", exact: true }).click()
  await expect(page.getByRole("button", { name: "Retry interactive inspection" })).toBeVisible()
  await expect(page.locator("#facility-construction")).toHaveCount(1)
  const staticStory = page.locator("#workload-story")
  await staticStory.locator("summary").click()
  await expect(staticStory.getByRole("heading")).toHaveCount(6)
  await staticStory.locator("summary").click()
  const poster = page.locator(".facility-stage img")
  await expect(poster).toHaveCount(1)
  await expect.poll(() => poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth >= 680 && /poster-mobile\.webp/.test(image.currentSrc))).toBe(true)
  await page.getByText("Change scenario or perspective", { exact: true }).click()
  await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("d")
  await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "b")
  await expect(page).toHaveURL(/scenario=b/)
  await page.getByRole("button", { name: "Apply selection", exact: true }).click()
  await expect(page).toHaveURL(/scenario=d/)
  await expect(page).toHaveURL(/topic=ai-cloud/)
  await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "d")
  await expect(page.getByTestId("assessment-summary")).toContainText("Unknown")
  await expect(page.getByTestId("assessment-summary")).not.toContainText("5.8 MW")
  await expect(page.getByRole("link", { name: "Download this technical record", exact: true })).toHaveAttribute("href", "/downloads/assessment/demo-01-d/v1.0.0/json")
  await page.goBack()
  await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "b")
})

test("native mobile preview has one real responsive image and working scenario form without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, baseURL })
  try {
    const page = await context.newPage()
    await page.goto("/demo")
    const image = page.locator(".facility-stage").getByRole("img", { name: /^Architectural cutaway of a synthetic data center:/ })
    await image.scrollIntoViewIfNeeded()
    await expect(image).toHaveCount(1)
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth >= 680 && /poster-mobile\.webp/.test(node.currentSrc))).toBe(true)
    await expect(image.locator("..").locator("source")).toHaveAttribute("srcset", /poster-mobile/)
    await expect(page.locator("#facility-construction")).toHaveCount(1)
    const story = page.locator("#workload-story")
    await story.locator("summary").click()
    await expect(story.getByRole("heading")).toHaveCount(6)
    await expect(story.getByRole("link", { name: "Read the versioned brief", exact: true })).toHaveAttribute("href", "/evidence/assessments/demo-01-b/v1.0.0")
    await story.locator("summary").click()
    await page.getByText("Change scenario or perspective", { exact: true }).click()
    await page.getByRole("combobox", { name: "Scenario", exact: true }).selectOption("d")
    await page.getByRole("button", { name: "Apply selection", exact: true }).click()
    await expect(page.getByTestId("assessment-summary")).toHaveAttribute("data-scenario", "d")
  } finally { await context.close() }
})

test("enhanced mobile navigation releases scroll and inertness across the desktop breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto("/")
  await page.locator("[data-mobile-menu] > summary").click()
  const dialog = page.getByRole("dialog", { name: "Site navigation" })
  await expect(dialog).toHaveAttribute("aria-modal", "true")
  await expect(dialog.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused()
  expect(await page.locator("main").evaluate(node => node.hasAttribute("inert"))).toBe(true)
  await page.setViewportSize({ width: 1366, height: 768 })
  await expect(dialog).toBeHidden()
  await expect.poll(() => page.locator("body").evaluate(node => node.style.overflow)).not.toBe("hidden")
  expect(await page.locator("main").evaluate(node => node.hasAttribute("inert"))).toBe(false)
  await expect(page.locator("#site-header > div").first().getByRole("link", { name: "GridNinja home", exact: true })).toBeFocused()
})

test("failed header enhancement shows explicit retry while native destinations remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route("**/header-controls.mjs", route => route.abort())
  await page.goto("/")
  await page.locator("[data-mobile-menu] > summary").click()
  await expect(page.getByRole("button", { name: "Retry navigation", exact: true })).toBeVisible()
  const dialog = page.getByRole("dialog", { name: "Site navigation" })
  await expect(dialog.getByRole("link", { name: "Sample brief", exact: true })).toHaveAttribute("href", "/demo#decision-brief")
  await page.getByRole("link", { name: "Use footer navigation", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator("#footer-navigation")).toBeFocused()
})

test("essential controls retain touch targets and page content reflows under text spacing", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true, effectiveType: "4g" } }))
  for (const width of [320, 390, 768, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ["/demo", "/assessment#scope"]) {
      await page.goto(route)
      const disclosure = route === "/demo" ? page.locator("[data-assessment-controls]") : page.locator("form details")
      if (await disclosure.count() && await disclosure.getAttribute("open") === null) await disclosure.locator("summary").click()
      const controls = await page.locator('header a, header summary, header button, [data-assessment-controls] > summary, [data-assessment-controls] select, .gn-lead-form input:not([type="hidden"]), .gn-lead-form select, .gn-lead-form button[type="submit"]').evaluateAll(nodes => nodes.filter(node => node.checkVisibility({ checkVisibilityCSS: true })).map(node => {
        const target = node instanceof HTMLInputElement && ["checkbox", "radio"].includes(node.type) ? node.closest("label") ?? node : node
        return { name: node.getAttribute("aria-label") || node.id || node.textContent?.trim(), height: target.getBoundingClientRect().height }
      }))
      for (const control of controls) expect(control.height, `${route} ${width}px ${control.name}`).toBeGreaterThanOrEqual(44)
    }
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto("/demo")
  await page.addStyleTag({ content: "main * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } main p { margin-bottom: 2em !important; }" })
  const clipped = await page.locator('[data-testid="assessment-summary"] h2, [data-decision-question], [data-assessment-controls] > summary').evaluateAll(nodes => nodes.filter(node => !node.classList.contains("sr-only")).filter(node => { const box = node.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 1 }).map(node => node.textContent))
  expect(clipped).toEqual([])
  await expect(page.locator("[data-decision-question]")).toContainText("Would the reduced 5.8 MW profile")

  // A clipped parent can hide text collisions without causing document overflow.
  // Exercise the enhanced HTML controls without downloading a graphics session.
  await page.goto("/demo?interactive=1")
  const viewer = page.getByTestId("facility-inspection")
  await viewer.locator(".facility-systems").getByRole("button", { name: "Workloads", exact: true }).click()
  await page.evaluate(() => document.fonts.ready)
  await viewer.evaluate(root => {
    const sizes = Array.from(root.querySelectorAll<HTMLElement>("*")).map(node => ({ node, size: Number.parseFloat(getComputedStyle(node).fontSize), line: getComputedStyle(node).lineHeight }))
    for (const { node, size, line } of sizes) {
      node.style.setProperty("font-size", `${size * 2}px`, "important")
      if (line.endsWith("px")) node.style.setProperty("line-height", `${Number.parseFloat(line) * 2}px`, "important")
    }
  })
  const collisions = await viewer.evaluate(root => {
    const problems: string[] = []
    const contained = (inner: DOMRect, outer: DOMRect) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1
    const overlaps = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
    for (const [groupSelector, itemSelector, count] of [
      [".facility-systems", "button", 4],
      [".facility-explanation-heading", "strong:not([aria-hidden]), .facility-clear", 2],
      [".facility-heading", "h2, .facility-synthetic", 2],
    ] as const) {
      const group = root.querySelector(groupSelector)!
      const items = Array.from(group.querySelectorAll<HTMLElement>(itemSelector))
      if (items.length !== count) problems.push(`${groupSelector}: expected ${count} controls or labels, found ${items.length}`)
      const groupBox = group.getBoundingClientRect()
      for (const [index, item] of items.entries()) {
        const box = item.getBoundingClientRect()
        const label = item.textContent?.trim()
        if (!contained(box, groupBox) || !contained(box, root.getBoundingClientRect())) problems.push(`${label}: element clipped`)
        if (item.tagName === "BUTTON" && box.height < 44) problems.push(`${label}: target below 44px`)
        const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT)
        let text: Node | null
        let visibleText = 0
        while ((text = walker.nextNode())) {
          if (!text.textContent?.trim() || !text.parentElement?.checkVisibility({ checkVisibilityCSS: true })) continue
          const range = document.createRange()
          range.selectNodeContents(text)
          for (const rect of Array.from(range.getClientRects())) {
            if (!rect.width || !rect.height) continue
            visibleText++
            if (!contained(rect, box)) problems.push(`${label}: text escapes its element`)
          }
        }
        if (!visibleText) problems.push(`${label}: no visible text`)
        for (const other of items.slice(index + 1)) if (overlaps(box, other.getBoundingClientRect())) problems.push(`${label}: overlaps ${other.textContent?.trim()}`)
      }
    }
    return problems
  })
  expect(collisions).toEqual([])

  // Cover the page outside the inspector too: clipped parents can conceal
  // overflowing hero/form grids, while footer links may overlap adjacent cells.
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ["/", "/demo", "/assessment", "/contact"]) {
      await page.goto(route)
      if (route === "/assessment" || route === "/contact") await expect(page.getByLabel("Name", { exact: true })).toBeEnabled()
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => {
        const sizes = Array.from(document.querySelectorAll<HTMLElement>("body *")).map(node => ({ node, size: Number.parseFloat(getComputedStyle(node).fontSize), line: getComputedStyle(node).lineHeight }))
        for (const { node, size, line } of sizes) {
          node.style.setProperty("font-size", `${size * 2}px`, "important")
          if (line.endsWith("px")) node.style.setProperty("line-height", `${Number.parseFloat(line) * 2}px`, "important")
        }
        const optional = document.querySelector<HTMLDetailsElement>(".gn-lead-form details")
        if (optional) optional.open = true
      })
      const footer = page.getByRole("contentinfo")
      await footer.evaluate(element => element.scrollIntoView({ behavior: "instant", block: "end" }))
      const failures = await page.evaluate(() => {
        const problems: string[] = []
        const textRects = (element: Element) => {
          const rects: DOMRect[] = []
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
          let text: Node | null
          while ((text = walker.nextNode())) {
            const parent = text.parentElement
            if (!text.textContent?.trim() || !parent?.checkVisibility({ checkVisibilityCSS: true }) || parent.closest("svg, .sr-only")) continue
            const range = document.createRange()
            range.selectNodeContents(text)
            rects.push(...Array.from(range.getClientRects()).filter(rect => rect.width && rect.height))
          }
          return rects
        }
        const targets = document.querySelectorAll<HTMLElement>('header [data-gn-logo-trigger], header [data-gn-event="header-capacity-audit"], [data-mobile-menu] > summary, main h1, main h2, main h3, main article[aria-label^="Decision brief preview"], main [data-gn-event="hero-primary-cta"], main [data-gn-event="hero-secondary-cta"], .gn-lead-form, footer')
        for (const target of targets) {
          if (!target.checkVisibility({ checkVisibilityCSS: true }) || target.closest(".facility-inspection, .sr-only")) continue
          const box = target.getBoundingClientRect()
          if (box.left < -1 || box.right > innerWidth + 1) problems.push(`${target.tagName}: element outside viewport width`)
          for (const rect of textRects(target)) {
            if (rect.left < -1 || rect.right > innerWidth + 1) problems.push(`${target.tagName}: text outside viewport width`)
            for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement) {
              const style = getComputedStyle(parent)
              if (!/hidden|clip|auto|scroll/.test(style.overflowX)) continue
              const parentBox = parent.getBoundingClientRect()
              if (rect.left < parentBox.left - 1 || rect.right > parentBox.right + 1) { problems.push(`${target.tagName}: text clipped by ${parent.tagName}`); break }
            }
          }
        }
        for (const preview of document.querySelectorAll('main article[aria-label^="Decision brief preview"]')) {
          const quantities = Array.from(preview.querySelectorAll("dl > div"), textRects)
          for (let a = 0; a < quantities.length; a++) for (let b = a + 1; b < quantities.length; b++) {
            if (quantities[a].some(left => quantities[b].some(right => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1))) problems.push("Decision brief quantities overlap")
          }
        }
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("footer nav a"))
        const glyphs = links.map(textRects)
        for (let a = 0; a < links.length; a++) for (let b = a + 1; b < links.length; b++) {
          if (glyphs[a].some(left => glyphs[b].some(right => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1))) problems.push(`Footer links overlap: ${links[a].textContent} / ${links[b].textContent}`)
        }
        const header = document.querySelector("header")!
        const controls = Array.from(header.querySelectorAll<HTMLElement>('[data-gn-logo-trigger], [data-gn-event="header-capacity-audit"], [data-mobile-menu] > summary')).filter(node => node.checkVisibility({ checkVisibilityCSS: true }))
        for (const node of controls) {
          const box = node.getBoundingClientRect()
          if (box.height < 44 || box.width < 44) problems.push("Header target below 44px")
        }
        for (let a = 0; a < controls.length; a++) for (let b = a + 1; b < controls.length; b++) {
          const left = controls[a].getBoundingClientRect(), right = controls[b].getBoundingClientRect()
          if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1) problems.push("Header controls overlap")
        }
        return [...new Set(problems)]
      })
      expect(failures, `${route} at ${width}px and 200% computed text`).toEqual([])
      await expect(page.locator('header a[data-gn-event="header-capacity-audit"]:visible')).toHaveText("Contact Us")
    }
  }
})
