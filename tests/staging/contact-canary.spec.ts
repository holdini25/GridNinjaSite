import { Client } from "pg"

import { expect, test } from "@playwright/test"
import {
  assertStagingRequestTarget,
  assertStagingResponseStatus,
  stagingIntakeConfig,
} from "../../scripts/qa/staging-contract.mjs"

const { baseURL, databaseUrl, email } = stagingIntakeConfig(process.env)

test("one browser submission becomes one durable lead accepted by its providers", async ({
  page,
}) => {
  await page.route("**/*", async route => {
    const request = route.request()
    const mainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame()
    if (!mainNavigation && new URL(request.url()).pathname !== "/api/contact") {
      await route.continue()
      return
    }
    try {
      assertStagingRequestTarget(request.url(), baseURL)
      // Do not follow a 307/308 that could forward the submission elsewhere.
      const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 })
      assertStagingResponseStatus(response.status())
      await route.fulfill({ response })
    } catch (error) {
      await route.abort("blockedbyclient")
      throw error
    }
  })
  await page.goto("/contact?intent=capacity-audit&source=staging-canary")
  await page.getByLabel("Name", { exact: true }).fill("GridNinja Canary")
  const formEngagedAt = Date.now()
  await page.getByLabel("Organization", { exact: true }).fill("GridNinja Staging")
  await page
    .getByLabel("Work email", { exact: true })
    .fill(email)
  await page
    .getByLabel("Decision context (optional)", {
      exact: true,
    })
    .fill("Automated staging-only durability and delivery canary submission.")

  await expect(page.getByText("Security verification complete.")).toBeVisible()
  // Preserve the backend's 1,200 ms minimum interaction age for bot protection.
  await expect.poll(() => Date.now() - formEngagedAt).toBeGreaterThanOrEqual(1_200)
  assertStagingRequestTarget(page.url(), baseURL)
  await page.getByRole("button", { name: "Scope an assessment" }).click()
  await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible()
  const reference = page.getByText(/^Reference:/)
  await expect(reference).toBeVisible()
  const submissionId = (await reference.textContent())?.replace("Reference:", "").trim()

  expect(submissionId).toMatch(/^[0-9a-f-]{36}$/i)

  // The backend's delivered status records provider acceptance, not inbox receipt.
  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    await expect
      .poll(
        async () => {
          const result = await client.query<{
            lead_count: string
            delivery_count: string
            delivered_count: string
          }>(
            `select count(distinct l.id)::text as lead_count,
                    count(o.id)::text as delivery_count,
                    count(o.id) filter (where o.status = 'delivered')::text
                      as delivered_count
             from lead_submissions l
             left join lead_delivery_outbox o on o.lead_id = l.id
             where l.id = $1
             group by l.id`,
            [submissionId]
          )

          const row = result.rows[0]
          return row
            ? {
                leadCount: row.lead_count,
                deliveryCount: row.delivery_count,
                allDelivered:
                  Number(row.delivery_count) > 0 &&
                  row.delivery_count === row.delivered_count,
              }
            : null
        },
        { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
      )
      .toEqual(
        expect.objectContaining({
          leadCount: "1",
          deliveryCount: expect.stringMatching(/^[12]$/),
          allDelivered: true,
        })
      )
  } finally {
    await client.end()
  }
})
