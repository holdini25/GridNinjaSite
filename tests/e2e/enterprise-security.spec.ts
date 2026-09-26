import { expect, test } from "@playwright/test"

test("production CSP preserves native journeys while blocking handlers and external scripts", async ({ page, request }) => {
  const response = await request.get("/demo")
  const policy = response.headers()["content-security-policy"]
  expect(policy).toContain("script-src-attr 'none'")
  expect(policy).toContain("object-src 'none'")
  expect(policy).not.toContain("unsafe-eval")
  await page.goto("/demo")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  const result = await page.evaluate(async () => {
    const local = URL.createObjectURL(new Blob(["embedded-image-fixture"]))
    let blobReadable = false
    try { blobReadable = await (await fetch(local)).text() === "embedded-image-fixture" } finally { URL.revokeObjectURL(local) }
    const violations: string[] = []
    const blocked = (event: SecurityPolicyViolationEvent) => violations.push(event.effectiveDirective)
    document.addEventListener("securitypolicyviolation", blocked)
    const marker = document.createElement("button")
    marker.setAttribute("onclick", "document.documentElement.dataset.cspEscaped = 'yes'")
    document.body.append(marker); marker.click(); marker.remove()
    const script = document.createElement("script")
    script.src = "https://example.invalid/blocked-script.js"
    await new Promise<void>(resolve => { script.onerror = () => resolve(); document.head.append(script) })
    script.remove()
    await new Promise(resolve => setTimeout(resolve, 100))
    document.removeEventListener("securitypolicyviolation", blocked)
    return { blobReadable, escaped: document.documentElement.dataset.cspEscaped, violations }
  })
  expect(result.blobReadable).toBe(true)
  expect(result.escaped).toBeUndefined()
  expect(result.violations).toContain("script-src-attr")
  expect(result.violations.some(value => value === "script-src-elem" || value === "script-src")).toBe(true)
})

test("frozen publications retain their stricter CSP and no executable application code", async ({ request }) => {
  const response = await request.get("/evidence/assessments/demo-01-b/v1.0.0")
  expect(response.status()).toBe(200)
  expect(response.headers()["content-security-policy"]).toContain("default-src 'none'")
  expect(await response.text()).not.toContain("/_next/")
})
