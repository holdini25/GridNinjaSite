import {
  expect,
  test as base,
  type Page,
  type Request,
  type Response,
} from "@playwright/test"

const checkedResourceTypes = new Set(["script", "stylesheet"])

export type ClientHealth = {
  allowError: (pattern: RegExp) => void
  expectNoHorizontalOverflow: () => Promise<void>
}

export function observeClientHealth(page: Page) {
  const errors: string[] = []

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`)
  })
  page.on("console", (message) => {
    const text = message.text()
    const localTurnstileOriginWarning =
      page.url().startsWith("http://127.0.0.1:") &&
      text.includes("postMessage") &&
      text.includes("https://challenges.cloudflare.com") &&
      text.includes("http://127.0.0.1:3000")

    if (message.type() === "error" && !localTurnstileOriginWarning) {
      errors.push(`console: ${text}`)
    }
  })
  page.on("requestfailed", (request: Request) => {
    const errorText = request.failure()?.errorText ?? "unknown error"
    // WebKit spells native-navigation cancellation "cancelled". The RC04 trace
    // confirms these are outgoing-page imports, not destination load failures.
    const navigationCancelledRequest =
      errorText === "net::ERR_ABORTED" || errorText === "NS_BINDING_ABORTED" || errorText === "cancelled"

    if (
      checkedResourceTypes.has(request.resourceType()) &&
      !navigationCancelledRequest
    ) {
      errors.push(
        `requestfailed: ${request.method()} ${request.url()} (${errorText})`
      )
    }
  })
  page.on("response", (response: Response) => {
    const request = response.request()

    if (
      checkedResourceTypes.has(request.resourceType()) &&
      response.status() >= 400
    ) {
      errors.push(
        `response: ${response.status()} ${request.method()} ${response.url()}`
      )
    }
  })

  return {
    errors,
    async expectNoHorizontalOverflow() {
      await page.evaluate(async () => {
        await document.fonts?.ready
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
      })

      const overflow = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth
        const documentWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth
        )
        const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .filter((element) => {
            const rect = element.getBoundingClientRect()

            return rect.left < -1 || rect.right > viewportWidth + 1
          })
          .slice(0, 8)
          .map((element) => {
            const rect = element.getBoundingClientRect()

            return {
              element: element.tagName.toLowerCase(),
              id: element.id,
              className:
                typeof element.className === "string" ? element.className : "",
              left: Math.round(rect.left),
              right: Math.round(rect.right),
            }
          })

        return { documentWidth, viewportWidth, offenders }
      })

      expect(
        overflow.documentWidth,
        `Page overflows horizontally: ${JSON.stringify(overflow)}`
      ).toBeLessThanOrEqual(overflow.viewportWidth + 1)
    },
  }
}

export const test = base.extend<{ clientHealth: ClientHealth }>({
  clientHealth: [
    async ({ page, javaScriptEnabled }, use) => {
      const health = observeClientHealth(page)
      const allowedErrors: RegExp[] = []
      // Chromium reports script preload requests as CSP-blocked when this test
      // context deliberately disables JavaScript. Other failures still fail.
      if (javaScriptEnabled === false) allowedErrors.push(/requestfailed: GET https?:\/\/[^ ]+\/_next\/static\/chunks\/[^ ]+\.js \(csp\)$/)

      await use({
        allowError(pattern) {
          allowedErrors.push(pattern)
        },
        expectNoHorizontalOverflow: health.expectNoHorizontalOverflow,
      })

      const unexpectedErrors = health.errors.filter(
        (error) => !allowedErrors.some((pattern) => pattern.test(error))
      )

      expect(
        unexpectedErrors,
        `Unexpected client-side failures:\n${unexpectedErrors.join("\n")}`
      ).toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
