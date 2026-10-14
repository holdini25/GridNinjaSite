import { Client } from "pg"
import { expect, test } from "@playwright/test"
import {
  assertStagingDatabaseIdentity, assertStagingMonitorHealthy,
  assertStagingRequestTarget, assertStagingResponseStatus, evaluateStagingDelivery,
  readStagingApproval, readStagingDeliveryEvidence, stagingCanaryConfig, stagingIntakeConfig, stagingRehearsalMode,
} from "../../scripts/qa/staging-contract.mjs"

const mode = stagingRehearsalMode(process.env)
const full = mode === "observation-chain"
const config = full ? stagingCanaryConfig(process.env) : stagingIntakeConfig(process.env)
// Traces can capture the host bypass/monitor credentials and designated test
// addresses. Retain only the explicit sanitized evidence attachment below.
test.use({ trace: "off", screenshot: "off", video: "off" })

test(full ? "staffed staging observation chain requires recipient delivery and a real human acknowledgement"
  : "staging intake smoke proves durable receipt and provider acceptance only", async ({ page }, testInfo) => {
  const fullConfig = full ? stagingCanaryConfig(process.env) : null
  test.setTimeout(120_000 + (fullConfig?.acknowledgementTimeoutMs ?? 0))
  const approval = await readStagingApproval(config, mode)
  // Read-only at the connection level. This runner never writes SQL, posts an
  // acknowledgement, forges a callback or resets a delivery for another try.
  const client = new Client({ connectionString: config.databaseUrl, options: "-c default_transaction_read_only=on", connectionTimeoutMillis: 5000, query_timeout: 5000 })
  let stage = "preflight", outboxId: string | undefined, submissionId: string | undefined
  let result = "incomplete"
  let frozenRequestSha256: string | undefined
  const startedAt = new Date()
  try {
    try { await client.connect() } catch { throw new Error("StagingDatabaseUnavailable") }
    const identity = await client.query("select current_database() as database_name, current_user as database_user, current_setting('transaction_read_only') as transaction_read_only")
    assertStagingDatabaseIdentity(identity.rows[0], approval)
    // Verify actual host protection before supplying its bypass. Never follow
    // unauthenticated redirects, which may lead to an external login page.
    const unauthorized = await page.request.get(`${config.baseURL}/contact`, { maxRedirects: 0, failOnStatusCode: false })
    if (![401, 403, 302, 307].includes(unauthorized.status())) throw new Error("StagingHostProtectionNotObserved")
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url())
      const mainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame()
      if (!mainNavigation && url.origin !== config.baseURL && url.pathname !== "/api/contact") { await route.continue(); return }
      try {
        if (Date.now() >= Date.parse(approval.expiresAt)) throw new Error("StagingApprovalExpired")
        assertStagingRequestTarget(request.url(), config.baseURL)
        const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, headers: { ...request.headers(), "x-vercel-protection-bypass": config.deploymentBypass } })
        assertStagingResponseStatus(response.status())
        await route.fulfill({ response })
      } catch { await route.abort("blockedbyclient"); throw new Error("StagingRequestBoundaryFailed") }
    })
    async function monitor() {
      if (!fullConfig) return
      await readStagingApproval(config, mode)
      const response = await page.request.get(`${config.baseURL}/api/internal/lead-monitor`, {
        maxRedirects: 0, failOnStatusCode: false,
        headers: { "x-vercel-protection-bypass": config.deploymentBypass, authorization: `Bearer ${fullConfig.monitorSecret}` },
      })
      let body: unknown
      try { body = await response.json() } catch { throw new Error("StagingMonitorInvalidResponse") }
      assertStagingMonitorHealthy(response.status(), body)
    }
    await monitor()
    await page.goto("/contact?intent=capacity-audit&source=staging-canary")
    await page.getByLabel("Name", { exact: true }).fill("GridNinja Canary")
    const formEngagedAt = Date.now()
    await page.getByLabel("Organization", { exact: true }).fill("GridNinja Staging")
    await page.getByLabel("Work email", { exact: true }).fill(config.email)
    await page.getByLabel("Decision context (optional)", { exact: true }).fill("Authorized isolated staging rehearsal; synthetic inquiry only.")
    await expect(page.getByText("Security verification complete.")).toBeVisible()
    await expect.poll(() => Date.now() - formEngagedAt).toBeGreaterThanOrEqual(1_200)
    assertStagingRequestTarget(page.url(), config.baseURL)
    await page.getByRole("button", { name: "Scope an assessment" }).click()
    await expect(page.getByRole("heading", { name: "Inquiry received" })).toBeVisible()
    const reference = page.getByText(/^Reference:/)
    await expect(reference).toBeVisible()
    submissionId = (await reference.textContent())?.replace("Reference:", "").trim()
    if (!submissionId || !/^[0-9a-f-]{36}$/i.test(submissionId)) throw new Error("StagingReceiptMissing")
    const deadline = Date.now() + (fullConfig?.acknowledgementTimeoutMs ?? 60_000)
    let accepted = false, complete = false, announced = false
    do {
      const evidence = await readStagingDeliveryEvidence(client, submissionId)
      if (!evidence.lead || new Date(evidence.lead.accepted_at).getTime() < startedAt.getTime()) throw new Error("StagingDurableReceiptMismatch")
      const result = evaluateStagingDelivery(evidence, approval, fullConfig?.operatorReference)
      stage = result.stage
      if ("outboxId" in result) { outboxId = result.outboxId; frozenRequestSha256 = result.frozenRequestSha256 ?? undefined }
      accepted = ["provider-accepted", "recipient-observed", "human-acknowledged"].includes(stage)
      complete = result.complete
      if (accepted && (!full || complete)) break
      if (outboxId && !announced) {
        // Opaque operational identity only, so the assigned human can review it.
        console.log(`Staging outbox awaiting recipient observation/human handling: ${outboxId}`)
        announced = true
      }
      await new Promise(resolve => setTimeout(resolve, 1000))
    } while (Date.now() < deadline)
    if (!accepted) throw new Error("StagingProviderAcceptanceNotObserved")
    if (full && !complete) throw new Error(stage === "recipient-observed" ? "StagingHumanAcknowledgementNotObserved" : "StagingRecipientDeliveryNotObserved")
    await monitor()
    result = full ? "observation-chain-complete" : "intake-smoke-complete"
  } finally {
    await client.end().catch(() => undefined)
    await testInfo.attach("staging-sanitized-evidence", { contentType: "application/json", body: Buffer.from(JSON.stringify({
      schemaVersion: "gridninja-staging-canary.v2", mode, result, startedAt: startedAt.toISOString(), stage,
      submissionId, outboxId, frozenRequestSha256, approvalSha256: config.approvalSha256,
      buildAttestationSha256: config.expectedAttestationSha256,
      productionReady: false, activationApproved: false,
      limitations: ["Private approval must independently establish hosted build/configuration, database/account isolation and authenticated callback/ack write paths.", "No provider key or raw callback signature is retained in database evidence.", "This chain does not replace outage, rotation, duplicate-callback, scheduler-loss, sink-failure, restore/rollback or manual release gates."],
    }, null, 2)) })
  }
})
