import { type Page } from "@playwright/test"

import { expect, test } from "./support/client-health"
import { centerLocatorInViewport } from "./support/viewport"

type LayoutShiftRecord = {
  value: number
  hadRecentInput: boolean
  startTime: number
}

async function observeLayoutShifts(page: Page) {
  await page.addInitScript(() => {
    const trackedWindow = window as Window & {
      __contactLayoutShifts?: LayoutShiftRecord[]
    }
    trackedWindow.__contactLayoutShifts = []

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number
          hadRecentInput: boolean
        }
        trackedWindow.__contactLayoutShifts?.push({
          value: shift.value,
          hadRecentInput: shift.hadRecentInput,
          startTime: shift.startTime,
        })
      }
    }).observe({ type: "layout-shift", buffered: true })
  })
}

async function installDelayedTurnstile(page: Page) {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js**",
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 650))
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.turnstile = {
            render(container, options) {
              const widget = document.createElement("div");
              widget.style.width = "300px";
              widget.style.height = "65px";
              widget.dataset.testTurnstile = "ready";
              container.appendChild(widget);
              queueMicrotask(() => options.callback("layout-token"));
              return "layout-widget";
            },
            reset() {},
            remove() {}
          };
        `,
      })
    }
  )
}

test.describe("contact intake layout", () => {
  test("renders the focused static intake without deferred marketing sections", async ({
    page,
    clientHealth,
  }) => {
    await page.goto("/contact", { waitUntil: "domcontentloaded" })

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Tell us where capacity is constrained.",
      })
    ).toBeVisible()
    await expect(
      page.getByText(
        "Share the operating decision, site constraint, or proof gap in front of your team. GridNinja will determine the safest evidence path—from a read-only Capacity Audit to Shadow Mode.",
        { exact: true }
      )
    ).toBeVisible()
    await expect(page.getByLabel("Intake commitments").getByRole("listitem")).toHaveCount(4)
    await expect(page.locator("main .gn-content-auto")).toHaveCount(0)
    await expect(page.locator("form [required]")).toHaveCount(4)
    await expect(page.locator("details > summary")).toContainText(
      "Add optional site details"
    )
    await expect(page.locator("#contact-next-steps + ol > li")).toHaveCount(3)

    const h1Box = await page.getByRole("heading", { level: 1 }).boundingBox()
    const formBox = await page.locator("form").boundingBox()
    expect(h1Box).not.toBeNull()
    expect(formBox).not.toBeNull()
    expect(formBox!.y).toBeLessThan(page.viewportSize()!.height)

    if (page.viewportSize()!.width >= 1024) {
      expect(formBox!.x).toBeGreaterThan(h1Box!.x + h1Box!.width)
      expect(Math.abs(formBox!.y - h1Box!.y)).toBeLessThan(180)
    } else {
      expect(formBox!.y).toBeGreaterThan(h1Box!.y + h1Box!.height)
    }

    for (const label of ["Capacity Audit", "Shadow Mode", "Partnership", "Other"]) {
      const target = page.getByRole("radio", { name: label }).locator("..")
      expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    }

    await clientHealth.expectNoHorizontalOverflow()
  })

  test("keeps CLS below 0.05 through verification, validation, scrolling, and success", async ({
    page,
  }) => {
    await observeLayoutShifts(page)
    await installDelayedTurnstile(page)
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "request-layout",
          submissionId: "0a40bf9f-3e46-4d0c-b550-89e992ed5eef",
          status: "queued",
        }),
      })
    })

    await page.goto("/contact", { waitUntil: "domcontentloaded" })
    const form = page.locator("form")
    const initialFormBox = await form.boundingBox()

    await page.getByLabel("Name", { exact: true }).focus()
    await expect(page.locator('[data-test-turnstile="ready"]')).toBeVisible()
    await expect(page.getByText("Security verification complete.")).toBeVisible()

    const submit = page.getByRole("button", { name: "Request assessment" })
    await centerLocatorInViewport(submit)
    await submit.click()
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toBeFocused()
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toContainText("Review the highlighted fields before submitting.")
    expect(
      await page
        .locator('[aria-labelledby="contact-error-summary-title"]')
        .evaluate((element) => element.scrollHeight <= element.clientHeight)
    ).toBe(true)

    const validationFormBox = await form.boundingBox()
    expect(Math.abs(validationFormBox!.height - initialFormBox!.height)).toBeLessThan(2)

    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    for (const ratio of [0.25, 0.5, 0.75, 1]) {
      await page.evaluate(
        async (top) => {
          window.scrollTo({ top, behavior: "auto" })
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
        },
        pageHeight * ratio
      )
    }

    await page.getByLabel("Name", { exact: true }).fill("Ada Operator")
    await page.getByLabel("Company", { exact: true }).fill("Atlas Compute")
    await page.getByLabel("Work email", { exact: true }).fill("ada@example.com")
    await page
      .getByLabel("What constraint or decision are you working through?", {
        exact: true,
      })
      .fill("We need a proof-backed capacity baseline for the next deployment.")

    const scores = await readLayoutShiftScores(page)
    expect(scores.cls).toBeLessThan(0.05)
    expect(scores.allInputStates).toBeLessThan(0.05)

    await submit.click()
    await expect(page).toHaveURL(/\/contact\/thanks$/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Request received."
    )
  })
})

async function readLayoutShiftScores(page: Page) {
  return page.evaluate(() => {
    const entries =
      (window as Window & { __contactLayoutShifts?: LayoutShiftRecord[] })
        .__contactLayoutShifts ?? []

    return {
      cls: maximumSessionWindow(entries.filter((entry) => !entry.hadRecentInput)),
      allInputStates: maximumSessionWindow(entries),
    }

    function maximumSessionWindow(records: LayoutShiftRecord[]) {
      let maximum = 0
      let sessionValue = 0
      let sessionStart = 0
      let previous = 0

      for (const record of records) {
        if (
          sessionValue === 0 ||
          record.startTime - previous > 1_000 ||
          record.startTime - sessionStart > 5_000
        ) {
          sessionStart = record.startTime
          sessionValue = record.value
        } else {
          sessionValue += record.value
        }

        previous = record.startTime
        maximum = Math.max(maximum, sessionValue)
      }

      return maximum
    }
  })
}
