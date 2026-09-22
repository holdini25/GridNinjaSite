import { type Page } from "@playwright/test"

import { expect, test } from "./support/client-health"
import { centerLocatorInViewport } from "./support/viewport"

type LeadPayload = Record<string, unknown> & {
  schemaVersion: 1 | 2
  formType: "contact" | "capacity_audit"
  clientSubmissionId: string
  turnstileToken: string
  startedAt: number
}

async function installTurnstileStub(page: Page) {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          (() => {
            let sequence = 0;
            const widgets = new Map();
            window.turnstile = {
              render(container, options) {
                const id = "test-widget-" + (++sequence);
                widgets.set(id, options);
                container.dataset.testWidgetId = id;
                queueMicrotask(() => options.callback("test-turnstile-token-" + sequence));
                return id;
              },
              reset(id) {
                const options = widgets.get(id);
                if (options) {
                  queueMicrotask(() => options.callback("test-turnstile-token-" + (++sequence)));
                }
              },
              remove(id) {
                widgets.delete(id);
              }
            };
          })();
        `,
      })
    }
  )
}

async function fillContactForm(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Ada Operator")
  await page.getByLabel("Company", { exact: true }).fill("Atlas Compute")
  await page.getByLabel("Work email", { exact: true }).fill("ada@example.com")
  await page
    .getByLabel("What constraint or decision are you working through?", {
      exact: true,
    })
    .fill("We need a proof-backed capacity baseline for the next deployment.")
}

function captureSuccessfulSubmission(page: Page) {
  let requestCount = 0
  let resolvePayload: (payload: LeadPayload) => void
  const payload = new Promise<LeadPayload>((resolve) => {
    resolvePayload = resolve
  })

  return {
    payload,
    async install() {
      await page.route("**/api/contact", async (route) => {
        requestCount += 1
        resolvePayload(route.request().postDataJSON() as LeadPayload)
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            requestId: "request-e2e",
            submissionId: "0a40bf9f-3e46-4d0c-b550-89e992ed5eef",
            status: "queued",
          }),
        })
      })
    },
    requestCount: () => requestCount,
  }
}

test.describe("lead form browser behavior", () => {
  test.beforeEach(async ({ page }) => {
    await installTurnstileStub(page)
  })

  test("exposes native, autofill-friendly semantics and uniform Zod errors", async ({
    page,
  }) => {
    await page.goto("/contact")
    const form = page.locator("form")

    await expect(form).toHaveCount(1)
    expect(await form.evaluate((element: HTMLFormElement) => element.noValidate)).toBe(
      true
    )

    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "name",
      "name"
    )
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "autocomplete",
      "name"
    )
    await expect(page.getByLabel("Company", { exact: true })).toHaveAttribute(
      "autocomplete",
      "organization"
    )
    await expect(page.getByLabel("Work email", { exact: true })).toHaveAttribute(
      "autocomplete",
      "email"
    )
    await expect(page.getByRole("radio", { name: "Capacity assessment" })).toBeChecked()
    await expect(page.locator("form [required]")).toHaveCount(3)

    await page.getByLabel("Name", { exact: true }).focus()
    await expect(page.getByText("Security verification complete.")).toHaveRole("status")
    const submit = page.getByRole("button", {
      name: "Scope an assessment",
    })

    await centerLocatorInViewport(submit)
    await submit.click()
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "aria-describedby",
      "contact-name-error"
    )
    await expect(page.getByText("Enter your name.", { exact: true }).first()).toHaveRole(
      "alert"
    )
    await expect(page.getByText("Enter a valid email address.", { exact: true }).first()).toHaveRole(
      "alert"
    )
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toBeFocused()
  })

  test("submits current DOM values even when autofill emits no input events", async ({
    page,
  }) => {
    const capture = captureSuccessfulSubmission(page)
    await capture.install()
    await page.goto("/contact?intent=book-demo&source=e2e-autofill")
    await page.getByLabel("Name", { exact: true }).focus()
    await expect(page.getByText("Security verification complete.")).toHaveRole("status")
    await expect(page.getByRole("radio", { name: "Other" })).toBeChecked()

    await page.locator("form").evaluate((form: HTMLFormElement) => {
      const setValue = (name: string, value: string) => {
        const control = form.elements.namedItem(name) as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
        control.value = value
      }

      setValue("name", "Chrome Autofill")
      setValue("company", "Browser Filled Compute")
      setValue("role", "Capacity Director")
      setValue("email", "chrome@example.com")
      setValue("siteType", "AI training campus")
      setValue("timeline", "Immediate (0-3 months)")
      setValue("capacityRange", "5–20 MW")
      setValue(
        "message",
        "These values were inserted directly without input or change events."
      )

      const constraint = form.querySelector<HTMLInputElement>(
        'input[name="constraints"][value="interconnection delay"]'
      )
      if (constraint) constraint.checked = true

      form.requestSubmit()
      form.requestSubmit()
    })

    const payload = await capture.payload
    expect(payload).toMatchObject({
      schemaVersion: 2,
      formType: "contact",
      turnstileToken: expect.stringMatching(/^test-turnstile-token-/),
      name: "Chrome Autofill",
      company: "Browser Filled Compute",
      role: "Capacity Director",
      email: "chrome@example.com",
      siteType: "AI training campus",
      timeline: "Immediate (0-3 months)",
      capacityRange: "5–20 MW",
      constraints: ["interconnection delay"],
      intent: "book-demo",
      source: "e2e-autofill",
      website: "",
    })
    expect(payload.clientSubmissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(payload.startedAt).toEqual(expect.any(Number))
    await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible()
    await expect(page.getByText(/^Reference:/)).toContainText(
      "0a40bf9f-3e46-4d0c-b550-89e992ed5eef"
    )
    expect(capture.requestCount()).toBe(1)
  })

  test("maps every incoming intent to four stable conversation cards", async ({
    page,
  }) => {
    const cases = [
      ["capacity-audit", "Capacity assessment"],
      ["sellable-capacity", "Capacity assessment"],
      ["shadow-mode", "Shadow Mode"],
      ["partnership", "Partnership"],
      ["book-demo", "Other"],
      ["dcii-memo", "Other"],
      ["load-passport", "Other"],
      ["other", "Other"],
    ] as const

    for (const [intent, label] of cases) {
      await page.goto(`/contact?intent=${intent}&source=footer`)
      await expect(page.getByRole("radio", { name: label })).toBeChecked()
    }
  })

  test("loads Turnstile after engagement when idle loading is deferred", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.requestIdleCallback = () => 1
      window.cancelIdleCallback = () => undefined
    })
    await page.goto("/contact", { waitUntil: "domcontentloaded" })

    const verification = page.locator('[data-turnstile-container="contact"]')
    await expect(verification).not.toHaveAttribute("data-test-widget-id")

    await page.getByLabel("Name", { exact: true }).focus()
    await expect(page.getByText("Security verification complete.")).toHaveRole(
      "status"
    )
    await expect(verification).toHaveAttribute("data-test-widget-id", /test-widget-/)
  })

  test("submits the assessment inquiry and keeps startedAt stable across retries", async ({
    page,
    clientHealth,
  }) => {
    clientHealth.allowError(/console: Failed to load resource:.*429/)
    const submissions: LeadPayload[] = []
    await page.route("**/api/contact", async (route) => {
      submissions.push(route.request().postDataJSON() as LeadPayload)
      const firstAttempt = submissions.length === 1

      await route.fulfill({
        status: firstAttempt ? 429 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          firstAttempt
            ? { ok: false, message: "Too many requests. Please try again later." }
            : {
                ok: true,
                requestId: "request-retry-e2e",
                submissionId: "a130cb30-f0bb-4a87-9983-b3c64e246329",
                status: "already_received",
              }
        ),
      })
    })

    await page.goto("/assessment")
    await page.getByLabel("Name", { exact: true }).focus()
    await expect(page.getByText("Security verification complete.")).toHaveRole(
      "status"
    )
    const auditForm = page.locator("form")

    await expect(auditForm).toHaveCount(1)
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "autocomplete",
      "name"
    )
    await expect(page.getByLabel("Work email", { exact: true })).toHaveAttribute(
      "name",
      "email"
    )
    await fillContactForm(page)
    const submit = page.getByRole("button", { name: "Scope an assessment" }).last()

    await submit.click()
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toContainText("Too many requests. Please try again later.")
    await submit.click()

    await expect(page.getByRole("status")).toContainText(
      "Inquiry received"
    )
    expect(submissions).toHaveLength(2)
    expect(submissions[0].startedAt).toBe(submissions[1].startedAt)
    expect(submissions[0].clientSubmissionId).toBe(
      submissions[1].clientSubmissionId
    )
    expect(submissions[0].turnstileToken).not.toBe(
      submissions[1].turnstileToken
    )
    expect(submissions[1]).toMatchObject({
      schemaVersion: 2,
      formType: "contact",
      name: "Ada Operator",
      company: "Atlas Compute",
      email: "ada@example.com",
      intent: "capacity-audit",
      source: "assessment-page",
      website: "",
    })
  })

  test("surfaces field, rate-limit, delivery, and network failures", async ({
    page,
    clientHealth,
  }) => {
    clientHealth.allowError(/console: Failed to load resource:/)
    await page.goto("/contact")
    await page.getByLabel("Name", { exact: true }).focus()
    await expect(page.getByText("Security verification complete.")).toHaveRole(
      "status"
    )
    await fillContactForm(page)
    const submit = page.getByRole("button", { name: "Scope an assessment" })

    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          fieldErrors: { email: "Use a work email address." },
          message: "Review the highlighted field.",
        }),
      })
    })
    await submit.click()
    await expect(page.getByText("Use a work email address.", { exact: true }).first()).toHaveRole(
      "alert"
    )
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toHaveRole("alert")
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toContainText("Review the highlighted field.")

    await page.unroute("**/api/contact")
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          message: "Too many requests. Please try again later.",
        }),
      })
    })
    await submit.click()
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toContainText("Too many requests. Please try again later.")

    await page.unroute("**/api/contact")
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          message: "Lead delivery is temporarily unavailable.",
        }),
      })
    })
    await submit.click()
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toContainText("Receipt is unconfirmed.")

    await page.unroute("**/api/contact")
    await page.route("**/api/contact", (route) => route.abort("failed"))
    await page.getByRole("button", { name: "Retry original inquiry" }).click()
    await expect(
      page.locator('[aria-labelledby="contact-error-summary-title"]')
    ).toContainText("Receipt is unconfirmed.")
  })
})

test.describe("static inquiry recovery", () => {
  test.use({ javaScriptEnabled: false })

  test("keeps no-JavaScript inputs disabled with POST transport and recovery instructions", async ({ page }) => {
    const apiRequests: string[] = []
    page.on("request", request => { if (new URL(request.url()).pathname === "/api/contact") apiRequests.push(request.url()) })
    await page.goto("/contact")
    await expect(page.locator("form")).toHaveAttribute("method", "post")
    await expect(page.locator("form")).toHaveAttribute("action", "/api/contact")
    await expect(page.getByLabel("Name", { exact: true })).toBeDisabled()
    await expect(page.getByRole("button", { name: "Scope an assessment" })).toBeDisabled()
    await expect(page.getByText(/Enable JavaScript and reload this page/)).toBeVisible()
    expect(apiRequests).toEqual([])
  })

  test("a direct receipt-page visit never claims an inquiry was received", async ({ page }) => {
    await page.goto("/contact/thanks")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your inquiry receipt.")
    await expect(page.getByText(/No current receipt is available in this tab/)).toBeVisible()
    await expect(page.getByRole("heading", { name: "Inquiry received" })).toHaveCount(0)
  })
})
