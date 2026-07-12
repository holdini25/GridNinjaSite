import { type Page } from "@playwright/test"

import { expect, test } from "./support/client-health"

type LeadPayload = Record<string, unknown> & {
  startedAt: number
}

async function fillContactForm(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Ada Operator")
  await page.getByLabel("Company", { exact: true }).fill("Atlas Compute")
  await page.getByLabel("Role", { exact: true }).fill("VP Infrastructure")
  await page.getByLabel("Email", { exact: true }).fill("ada@example.com")
  await page
    .getByLabel("Buyer type", { exact: true })
    .selectOption("AI cloud operator")
  await page
    .getByLabel("Site type", { exact: true })
    .selectOption("AI training campus")
  await page
    .getByLabel("Desired timeline", { exact: true })
    .selectOption("Immediate (0-3 months)")
  await page.getByLabel("interconnection delay", { exact: true }).check()
  await page
    .getByLabel("Message", { exact: true })
    .fill("We need a proof-backed capacity baseline for the next deployment.")
}

async function fillCapacityAuditForm(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Grace Operator")
  await page.getByLabel("Company", { exact: true }).fill("Proof Cloud")
  await page.getByLabel("Email", { exact: true }).fill("grace@example.com")
  await page
    .getByLabel("Buyer type", { exact: true })
    .selectOption("Colo / REIT")
  await page
    .getByLabel("Site type", { exact: true })
    .selectOption("Colocation facility")
  await page
    .getByLabel("Desired timeline", { exact: true })
    .selectOption("Near term (3-6 months)")
}

function captureSuccessfulSubmission(page: Page) {
  let resolvePayload: (payload: LeadPayload) => void
  const payload = new Promise<LeadPayload>((resolve) => {
    resolvePayload = resolve
  })

  return {
    payload,
    async install() {
      await page.route("**/api/contact", async (route) => {
        resolvePayload(route.request().postDataJSON() as LeadPayload)
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      })
    },
  }
}

test.describe("lead form browser behavior", () => {
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
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
      "autocomplete",
      "email"
    )
    await expect(page.getByLabel("Buyer type", { exact: true })).toHaveJSProperty(
      "tagName",
      "SELECT"
    )
    await expect(page.getByLabel("Site type", { exact: true })).toHaveJSProperty(
      "tagName",
      "SELECT"
    )
    await expect(
      page.getByLabel("Desired timeline", { exact: true })
    ).toHaveJSProperty("tagName", "SELECT")

    const constraint = page.getByLabel("interconnection delay", { exact: true })
    await expect(constraint).toHaveAttribute("name", "constraints")
    await expect(constraint).toHaveAttribute("value", "interconnection delay")
    await expect(constraint).toHaveAttribute("id", /contact-constraint-/)

    await page.getByRole("button", { name: "Start the conversation" }).click()
    await expect(page.getByText("Enter your name.", { exact: true })).toHaveRole(
      "alert"
    )
    await expect(page.getByText("Enter a valid email address.", { exact: true })).toHaveRole(
      "alert"
    )
    await expect(
      page.getByText("Select at least one current constraint.", { exact: true })
    ).toHaveRole("alert")
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "aria-describedby",
      "contact-name-error"
    )
  })

  test("submits current DOM values even when autofill emits no input events", async ({
    page,
  }) => {
    const capture = captureSuccessfulSubmission(page)
    await capture.install()
    await page.goto("/contact?intent=partnership&source=e2e-autofill")

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
      setValue("buyerType", "AI cloud operator")
      setValue("siteType", "AI training campus")
      setValue("timeline", "Immediate (0-3 months)")
      setValue(
        "message",
        "These values were inserted directly without input or change events."
      )

      const constraint = form.querySelector<HTMLInputElement>(
        'input[name="constraints"][value="interconnection delay"]'
      )
      if (constraint) constraint.checked = true

      form.requestSubmit()
    })

    const payload = await capture.payload
    expect(payload).toMatchObject({
      name: "Chrome Autofill",
      company: "Browser Filled Compute",
      role: "Capacity Director",
      email: "chrome@example.com",
      buyerType: "AI cloud operator",
      siteType: "AI training campus",
      timeline: "Immediate (0-3 months)",
      constraints: ["interconnection delay"],
      intent: "partnership",
      source: "e2e-autofill",
      website: "",
    })
    expect(payload.startedAt).toEqual(expect.any(Number))
    await expect(page.getByRole("status")).toContainText("Intake submitted")
  })

  test("submits the Capacity Audit payload and keeps startedAt stable across retries", async ({
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
            : { ok: true }
        ),
      })
    })

    await page.goto("/roi")
    const auditForm = page.locator("form")

    await expect(auditForm).toHaveCount(1)
    await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
      "autocomplete",
      "name"
    )
    await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
      "name",
      "email"
    )
    await expect(page.getByLabel("Buyer type", { exact: true })).toHaveJSProperty(
      "tagName",
      "SELECT"
    )
    await fillCapacityAuditForm(page)
    const submit = page.getByRole("button", { name: "Request Capacity Audit" }).last()

    await submit.click()
    await expect(
      page.getByText("Too many requests. Please try again later.", { exact: true })
    ).toHaveRole("alert")
    await submit.click()

    await expect(page.getByRole("status")).toContainText(
      "Capacity Audit intake submitted"
    )
    expect(submissions).toHaveLength(2)
    expect(submissions[0].startedAt).toBe(submissions[1].startedAt)
    expect(submissions[1]).toMatchObject({
      name: "Grace Operator",
      company: "Proof Cloud",
      email: "grace@example.com",
      buyerType: "Colo / REIT",
      siteType: "Colocation facility",
      timeline: "Near term (3-6 months)",
      intent: "capacity-audit",
      source: "roi-page",
      website: "",
    })
  })

  test("surfaces field, rate-limit, delivery, and network failures", async ({
    page,
    clientHealth,
  }) => {
    clientHealth.allowError(/console: Failed to load resource:/)
    await page.goto("/contact")
    await fillContactForm(page)
    const submit = page.getByRole("button", { name: "Start the conversation" })

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
    await expect(page.getByText("Use a work email address.", { exact: true })).toHaveRole(
      "alert"
    )
    await expect(page.getByText("Review the highlighted field.", { exact: true })).toHaveRole(
      "alert"
    )

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
      page.getByText("Too many requests. Please try again later.", { exact: true })
    ).toHaveRole("alert")

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
      page.getByText("Lead delivery is temporarily unavailable.", { exact: true })
    ).toHaveRole("alert")

    await page.unroute("**/api/contact")
    await page.route("**/api/contact", (route) => route.abort("failed"))
    await submit.click()
    await expect(page.getByText("Unable to submit the request.", { exact: true })).toHaveRole(
      "alert"
    )
  })
})
