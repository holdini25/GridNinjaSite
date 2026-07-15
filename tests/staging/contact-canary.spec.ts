import { Client } from "pg"

import { expect, test } from "@playwright/test"

const databaseUrl = process.env.STAGING_DATABASE_URL

test.skip(!databaseUrl, "STAGING_DATABASE_URL is required.")

test("one browser submission becomes one durable delivered lead", async ({
  page,
}) => {
  await page.goto("/contact?intent=capacity-audit&source=staging-canary")
  await page.getByLabel("Name", { exact: true }).fill("GridNinja Canary")
  await page.getByLabel("Company", { exact: true }).fill("GridNinja Staging")
  await page
    .getByLabel("Work email", { exact: true })
    .fill("contact-canary@gridninja.ai")
  await page
    .getByLabel("What constraint or decision are you working through?", {
      exact: true,
    })
    .fill("Automated staging-only durability and delivery canary submission.")

  await expect(page.getByText("Security verification complete.")).toBeVisible()
  await page.getByRole("button", { name: "Request assessment" }).click()
  await expect(page).toHaveURL(/\/contact\/thanks$/)
  const reference = page.getByText(/^Reference:/)
  await expect(reference).toBeVisible()
  const submissionId = (await reference.textContent())?.replace("Reference:", "").trim()

  expect(submissionId).toMatch(/^[0-9a-f-]{36}$/i)

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
