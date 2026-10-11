import { assessmentScopeHref, sampleBriefHref } from "../../src/lib/marketing-journeys"
import { expect, test } from "./support/client-health"

const solutions = [
  { path: "/solutions/ai-cloud", source: "ai-cloud-page", topic: "ai-cloud" },
  { path: "/solutions/colocation", source: "colocation-page", topic: "colocation" },
  { path: "/solutions/bridge-power", source: "bridge-power-page", topic: "power" },
] as const

test.describe("server-rendered solution decisions", () => {
  test.use({ javaScriptEnabled: false })

  for (const solution of solutions) {
    test(`${solution.path} delivers both assessment actions without JavaScript`, async ({ page }) => {
      await page.goto(solution.path, { waitUntil: "domcontentloaded" })
      const hero = page.locator(".gn-premium-hero")
      const primary = hero.getByRole("link", { name: "Scope an assessment", exact: true })
      const sample = hero.getByRole("link", { name: "See a sample decision brief", exact: true })
      await expect(primary).toBeVisible()
      await expect(sample).toBeVisible()
      await expect(primary).toHaveAttribute("href", assessmentScopeHref(solution.source, solution.topic))
      await expect(sample).toHaveAttribute("href", sampleBriefHref(solution.topic))
    })
  }
})

// Inspect the built response and browser navigation, not only React source props:
// a previous prerender omitted the sample action on two solution routes.
test.describe("premium solution journey continuity", () => {
  for (const solution of solutions) {
    test(`${solution.path} preserves both decisions and topic through sample, scoping and Back`, async ({ page, clientHealth }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto(solution.path, { waitUntil: "domcontentloaded" })
      const hero = page.locator(".gn-premium-hero")
      const primary = hero.getByRole("link", { name: "Scope an assessment", exact: true })
      const sample = hero.getByRole("link", { name: "See a sample decision brief", exact: true })
      await expect(primary).toBeVisible()
      await expect(sample).toBeVisible()
      await expect(primary).toHaveAttribute("href", assessmentScopeHref(solution.source, solution.topic))
      await expect(sample).toHaveAttribute("href", sampleBriefHref(solution.topic))
      await expect(hero).toContainText("Paid, bounded assessment of authorized historical inputs. No live connection or equipment control.")

      await sample.click()
      await expect(page).toHaveURL(url => url.pathname === "/demo" && url.searchParams.get("topic") === solution.topic)
      await expect(page.locator("main h1")).toBeVisible()
      await page.goBack({ waitUntil: "domcontentloaded" })
      await expect(sample).toBeVisible()
      await primary.click()
      await expect(page).toHaveURL(url => url.pathname === "/assessment" && url.searchParams.get("topic") === solution.topic)
      await expect(page.locator("main h1")).toBeVisible()
      await page.goBack({ waitUntil: "domcontentloaded" })
      await expect(primary).toBeVisible()
      await expect(sample).toBeVisible()
      await clientHealth.expectNoHorizontalOverflow()
    })
  }
})
