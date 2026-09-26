import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { createMaterialHarness, runMaterialHarness, verifyV5MaterialAsset } from "../../scripts/facility/verify-materials.mjs"
import { scrollFacilityIntoView } from "../support/facility-viewer"

test.describe("production material composer", () => {
  let harness: Awaited<ReturnType<typeof createMaterialHarness>>
  test.beforeAll(async () => { harness = await createMaterialHarness() })
  test.afterAll(async () => { await harness.close() })

  test("actual WebGL shaders preserve PBR maps, isolated uniforms and masked minification", async ({ page }, testInfo) => {
    const report = await runMaterialHarness(page, harness)
    expect(report.checks.length).toBeGreaterThanOrEqual(8)
    expect(report.checks.every((check: { pass: boolean }) => check.pass)).toBe(true)
    await testInfo.attach("material-benchmark", { body: JSON.stringify(report, null, 2), contentType: "application/json" })
  })
})

test("material highlights and assembly poses render without changing assessment evidence", async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error" && /shader|WebGL|GL_INVALID|program/i.test(message.text())) errors.push(message.text()) })
  await page.addInitScript(() => { window.__GN_FACILITY_DIAGNOSTICS__ = true })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/demo?scenario=d&perspective=engineering")
  const inspector = page.getByTestId("facility-inspection")
  const release = process.env.FACILITY_ASSET_RELEASE ?? "facility-v8"
  await expect(inspector).toHaveAttribute("data-release", release)
  await expect(inspector).toHaveAttribute("data-scenario", "d")
  await expect(page.getByRole("combobox", { name: "Scenario", exact: true })).toHaveValue("d")
  const materialAssets: Awaited<ReturnType<typeof verifyV5MaterialAsset>>[] = []
  const registry = JSON.parse(await readFile("src/content/facility-releases/registry.json", "utf8"))
  const approved = registry.find((entry: { release: string; status: string }) => entry.release === release && entry.status === "available")
  expect(approved).toBeTruthy()
  const manifestBytes = await readFile(`src/content/facility-releases/${approved.release}/manifest.json`)
  expect(createHash("sha256").update(manifestBytes).digest("hex")).toBe(approved.manifestSha256)
  const manifest = JSON.parse(manifestBytes.toString())
  for (const filename of ["facility.glb", "rack.glb", "cooling.glb"]) {
    const response = await page.request.get(`/assets/facility/${release}/${filename}`)
    expect(response.ok()).toBe(true)
    materialAssets.push(await verifyV5MaterialAsset(await response.body(), filename, manifest))
  }
  await testInfo.attach("exported-materials", { body: JSON.stringify(materialAssets, null, 2), contentType: "application/json" })
  await scrollFacilityIntoView(inspector)
  await expect(inspector).toHaveAttribute("data-phase", "ready")
  const canvas = inspector.locator("canvas[data-ready=true]")
  const assessment = page.getByTestId("assessment-summary")
  const initialCaption = await assessment.textContent()
  await expect(assessment.getByText("Requested increment", { exact: true }).locator("..")).toContainText("5.0 MW")
  await expect(assessment.getByText("Modeled eligible increment", { exact: true }).locator("..")).toContainText("Unknown")
  const initialCanvas = await canvas.elementHandle()
  const snapshot = () => canvas.evaluate(element => (element as HTMLCanvasElement).__gnFacilitySnapshot?.())
  const verifyFiniteBinding = async (filename: string) => {
    const asset = materialAssets.find(value => value.filename === filename)
    if (asset?.floorLighting === "runtime-finite-neutral") {
      // Validate the presented session source, not only manifest presence.
      const actual = await canvas.evaluate(element => {
        const measured = (element as HTMLCanvasElement).__gnFacilitySnapshot?.() as unknown as { finiteLight?: { position: number[]; intensity: number; count: number; shadows: boolean } }
        return measured?.finiteLight
      })
      expect(actual).toEqual({ position: asset.finiteLight!.position, intensity: asset.finiteLight!.intensity, count: 1, shadows: false })
    }
  }
  await verifyFiniteBinding("facility.glb")
  const imageHash = async () => createHash("sha256").update(await canvas.screenshot()).digest("hex")
  const initialImage = await imageHash()
  const selectedImages = []
  for (const system of ["Power", "Cooling", "Storage", "Workloads"]) {
    const button = inspector.locator(".facility-systems").getByRole("button", { name: system, exact: true })
    await button.focus()
    await scrollFacilityIntoView(inspector)
    const preview = await imageHash()
    expect(preview).not.toBe(initialImage)
    await button.click()
    await scrollFacilityIntoView(inspector)
    await expect(button).toHaveAttribute("aria-pressed", "true")
    if (system === "Cooling") {
      await expect(inspector).toContainText("Cooling evidence missing")
      await expect(inspector).toContainText("No cooling evidence is supplied")
    }
    selectedImages.push(await imageHash())
    await expect(assessment).toHaveText(initialCaption!)
    const stats = await snapshot()
    expect(stats?.drawCalls).toBeLessThanOrEqual(39)
    expect(stats?.materials).toBeLessThanOrEqual(10)
    expect(stats?.estimatedBytes).toBeLessThanOrEqual(16 * 1024 * 1024)
  }
  expect(new Set(selectedImages).size).toBe(4)
  for (const [kind, label] of [["rack", "Inspect rack construction"], ["cooling", "Inspect cooling construction"]]) {
    await inspector.getByRole("button", { name: label, exact: true }).click()
    await expect(inspector).toHaveAttribute("data-view", kind)
    const poseImages = []
    for (const pose of ["closed", "cutaway", "service"]) {
      if (kind === "rack" && await inspector.locator(".facility-rack-actions").count()) {
        const actions = inspector.locator(".facility-rack-actions")
        if (pose === "cutaway") await actions.getByRole("button", { name: "Cutaway view", exact: true }).click()
        if (pose === "service") {
          await actions.getByRole("button", { name: "Restore side panel", exact: true }).click()
          await actions.getByRole("button", { name: "Extend server tray", exact: true }).click()
        }
      } else await inspector.getByRole("button", { name: pose === "closed" ? "Restore closed assembly" : pose === "cutaway" ? "Reveal interior" : kind === "rack" ? "Extend server tray" : "Inspect coil and manifold", exact: true }).click()
      await expect(inspector).toHaveAttribute("data-pose", pose)
      await scrollFacilityIntoView(inspector)
      poseImages.push(await imageHash())
      const stats = await snapshot()
      await verifyFiniteBinding(`${kind}.glb`)
      expect(stats?.drawCalls).toBeLessThanOrEqual(kind === "rack" ? 35 : 30)
      expect(stats?.estimatedBytes).toBeLessThanOrEqual(6 * 1024 * 1024)
      expect(stats?.peakEstimatedBytes).toBeLessThanOrEqual(16 * 1024 * 1024)
      await expect(assessment).toHaveText(initialCaption!)
    }
    expect(new Set(poseImages).size).toBe(3)
  }
  await inspector.getByRole("button", { name: "Return to facility", exact: true }).click()
  await expect(inspector).toHaveAttribute("data-view", "overview")
  await verifyFiniteBinding("facility.glb")
  expect(await canvas.evaluate((element, original) => element === original, initialCanvas)).toBe(true)
  await expect(assessment).toHaveText(initialCaption!)
  expect(errors).toEqual([])
  await testInfo.attach("material-session", { body: JSON.stringify(await snapshot(), null, 2), contentType: "application/json" })
})
