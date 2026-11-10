import { expect, test } from "./support/client-health"

const routes = [
  { path: "/", body: "main .gn-home-lead", text: "paid, bounded assessment", bodyColor: "rgb(205, 211, 216)" },
  { path: "/contact", body: "main h1 + p", text: "historical inputs", bodyColor: "rgb(184, 184, 184)" },
  { path: "/evidence", body: "main header p.text-lg", text: "synthetic examples", bodyColor: "rgb(184, 184, 184)" },
] as const

function luminance(color: string) {
  const channels = color.match(/[\d.]+/g)?.map(Number)
  if (!channels || channels.length !== 3) throw new Error(`Expected opaque sRGB color: ${color}`)
  const [r, g, b] = channels.map(channel => {
    const value = channel / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  return .2126 * r + .7152 * g + .0722 * b
}

for (const javaScriptEnabled of [true, false]) {
  test.describe(`server styles with JavaScript ${javaScriptEnabled ? "enabled" : "disabled"}`, () => {
    test.use({ javaScriptEnabled })
    for (const route of routes) {
      test(`${route.path} preserves its painted surface on initial load, navigation and Back`, async ({ page }, testInfo) => {
        const stylesheetRequests: string[] = [], enhancementRequests: string[] = [], navigationRequests: { url: string; kind: string }[] = []
        page.on("request", request => {
          if (request.resourceType() === "stylesheet") stylesheetRequests.push(request.url())
          if (new URL(request.url()).pathname === "/header-controls.mjs") enhancementRequests.push(request.url())
          if (request.resourceType() === "document" || new URL(request.url()).searchParams.has("_rsc")) navigationRequests.push({ url: request.url(), kind: request.resourceType() })
        })

        const inspect = async (target: typeof routes[number], stage: string, serverHTML?: string) => {
          // No routing, injected styles, response substitution or init scripts.
          const html = serverHTML ?? await page.content()
          const inlineStyles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1])
          const stylesheetLinks = html.match(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/g) ?? []
          const styles = await page.evaluate(({ bodySelector, path }) => {
            const main = document.querySelector("main")
            const heading = document.querySelector("main h1")
            const body = document.querySelector(bodySelector)
            // Positive paint ownership: Home has its own opaque gradient;
            // Contact has an explicit canvas; Evidence uses the layout canvas.
            const owner = path === "/" ? document.querySelector(".gn-home-hero")
              : path === "/contact" ? main?.querySelector(":scope > div.bg-background") ?? null
              : main?.parentElement ?? null
            const describe = (element: Element | null) => {
              if (!element) return null
              const css = getComputedStyle(element), rect = element.getBoundingClientRect()
              return { tag: element.tagName, className: element.getAttribute("class"), backgroundColor: css.backgroundColor, backgroundImage: css.backgroundImage, backgroundToken: css.getPropertyValue("--background").trim(), opacity: css.opacity, color: css.color, fontSize: parseFloat(css.fontSize), rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } }
            }
            const chain = (element: Element | null) => {
              const result = []
              for (let node = element; node; node = node.parentElement) result.push(describe(node)!)
              return result
            }
            const stylesheets = [...document.styleSheets].map(sheet => {
              try { return { href: sheet.href, disabled: sheet.disabled, rules: sheet.cssRules.length, hasCanvasToken: [...sheet.cssRules].some(rule => rule.cssText.includes("--gn-canvas")), error: null } }
              catch (error) { return { href: sheet.href, disabled: sheet.disabled, rules: 0, hasCanvasToken: false, error: String(error) } }
            })
            return {
              root: describe(document.documentElement), documentBody: describe(document.body),
              marketingWrapper: describe(main?.parentElement ?? null),
              introductionRoot: describe(heading?.closest("section") ?? heading?.closest("main > div") ?? null),
              owner: describe(owner), ownerContainsIntroduction: Boolean(owner && heading && body && owner.contains(heading) && owner.contains(body)),
              heading: describe(heading), body: describe(body), headingChain: chain(heading), bodyChain: chain(body), stylesheets,
            }
          }, { bodySelector: target.body, path: target.path })
          // Capture null/missing owners and ancestor diagnostics before style assertions.
          await testInfo.attach(`${stage}-style-delivery.json`, {
            contentType: "application/json",
            body: Buffer.from(JSON.stringify({ evidence: serverHTML ? "untampered initial production response" : "warm browser document; navigation transport recorded separately", qualification: "surface and typography checks, not complete manual contrast or performance qualification", route: target.path, javaScriptEnabled, inlineStyleBlocks: inlineStyles.length, stylesheetLinks, stylesheetRequests, enhancementRequests, navigationRequests, styles }, null, 2)),
          })
          await testInfo.attach(`${stage}-style-delivery.png`, { contentType: "image/png", body: await page.screenshot() })
          expect(inlineStyles.some(css => css.includes("--gn-canvas:"))).toBe(false)
          expect(stylesheetLinks.length).toBeGreaterThan(0)
          expect(stylesheetRequests.length).toBeGreaterThan(0)
          expect(styles.stylesheets.every(sheet => sheet.error === null)).toBe(true)
          expect(styles.stylesheets.some(sheet => sheet.href && !sheet.disabled && sheet.rules && sheet.hasCanvasToken)).toBe(true)
          await expect(page.locator("main h1")).toBeVisible()
          await expect(page.locator(target.body)).toBeVisible()
          await expect(page.locator(target.body)).toContainText(target.text)
          await expect(page.locator("#site-header")).not.toHaveAttribute("data-enhanced", "true")
          expect(enhancementRequests).toEqual([])
          expect(styles.ownerContainsIntroduction).toBe(true)
          expect(styles.owner).not.toBeNull()
          expect(styles.heading).not.toBeNull()
          expect(styles.body).not.toBeNull()
          const owner = styles.owner!, heading = styles.heading!, body = styles.body!
          if (target.path === "/") {
            expect(owner.backgroundImage).toMatch(/^linear-gradient\((?:(?:180deg|to bottom), )?rgb\(1, 1, 1\) 90%, rgb\(8, 8, 8\)\)$/)
          } else {
            expect(owner.backgroundColor).toBe("rgb(8, 8, 8)")
            expect(owner.backgroundImage).toBe("none")
          }
          expect(owner.opacity).toBe("1")
          expect([...styles.headingChain, ...styles.bodyChain].every(ancestor => ancestor.opacity === "1")).toBe(true)
          for (const text of [heading, body]) {
            expect(text.rect.left).toBeGreaterThanOrEqual(owner.rect.left)
            expect(text.rect.right).toBeLessThanOrEqual(owner.rect.right)
            expect(text.rect.top).toBeGreaterThanOrEqual(owner.rect.top)
            expect(text.rect.bottom).toBeLessThanOrEqual(owner.rect.bottom)
          }
          expect(heading.fontSize).toBeGreaterThanOrEqual(32)
          expect(body.fontSize).toBeGreaterThanOrEqual(16)
          expect(heading.color).toBe("rgb(244, 247, 250)")
          expect(body.color).toBe(target.bodyColor)
          // #080808 is also the lighter endpoint of Home's opaque gradient.
          expect((luminance(body.color) + .05) / (luminance("rgb(8, 8, 8)") + .05)).toBeGreaterThanOrEqual(4.5)
        }

        const response = await page.goto(route.path, { waitUntil: "load" })
        await inspect(route, "initial", await response!.text())
        expect(response?.status()).toBe(200)
        const destination = route.path === "/evidence" ? routes[1] : routes[2]
        await page.locator(`footer a[href="${destination.path}"]`).click()
        await page.waitForURL(url => url.pathname === destination.path)
        await expect(page.locator(destination.body)).toContainText(destination.text)
        await page.evaluate(() => scrollTo(0, 0))
        await inspect(destination, "navigation")
        await page.goBack()
        await page.waitForURL(url => url.pathname === route.path)
        await expect(page.locator(route.body)).toContainText(route.text)
        await page.evaluate(() => scrollTo(0, 0))
        await inspect(route, "back")
      })
    }
  })
}
