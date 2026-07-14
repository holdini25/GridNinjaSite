import { readFile } from "node:fs/promises"

import { expect, test, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

const canonicalDomainIds = [
  "electrical",
  "storage",
  "cooling-water",
  "bridge-power",
  "workload-sla",
  "telemetry-policy",
]

function collectClientErrors(page: Page) {
  const errors: string[] = []

  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text())
    }
  })

  return errors
}

async function expectUrlParam(page: Page, key: string, value: string) {
  await expect
    .poll(() => new URL(page.url()).searchParams.get(key), { timeout: 1_000 })
    .toBe(value)
}

async function getTableRowIds(page: Page) {
  return page
    .locator('[data-testid^="dispatch-table-row-"]')
    .evaluateAll((rows) =>
      rows.map((row) =>
        row.getAttribute("data-testid")?.replace("dispatch-table-row-", "")
      )
    )
}

async function getAcceptedRevealState(page: Page) {
  const reveal = page.locator("rect.gn-dispatch-accepted-reveal").first()

  await expect(reveal).toBeAttached()

  return reveal.evaluate((node: SVGRectElement) => {
    const style = window.getComputedStyle(node)

    return {
      animationName: style.animationName,
      transform: style.transform,
      width: node.getAttribute("width"),
      height: node.getAttribute("height"),
    }
  })
}

test.describe("dispatch envelope page", () => {
  test("renders route, CTA, active platform nav, and no client errors", async ({
    page,
  }, testInfo) => {
    const errors = collectClientErrors(page)

    await page.goto("/platform/dispatch-envelope")

    await expect(
      page.getByRole("heading", {
        name: /How much virtual capacity is safe/i,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Request Capacity Audit" }).first()
    ).toBeVisible()
    await expect(page.getByTestId("dispatch-envelope-visual")).toBeVisible()
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click()
      const dialog = page.getByRole("dialog")

      await expect(
        dialog.getByRole("link", { name: "Platform", exact: true })
      ).toHaveAttribute("aria-current", "page")
      await expect(
        dialog.getByRole("link", { name: "Dispatch Envelope", exact: true })
      ).toHaveAttribute("aria-current", "page")
    } else {
      const header = page.locator("header")
      const platformMenu = header.getByRole("button", {
        name: "Platform",
        exact: true,
      })
      const dispatchLink = header.getByRole("link", {
        name: "Dispatch Envelope",
        exact: true,
      })

      await platformMenu.hover()
      await expect(dispatchLink).toBeVisible()
      await expect(dispatchLink).toHaveAttribute("aria-current", "page")

      await dispatchLink.hover()
      await expect(dispatchLink).toBeVisible()

      const solutionsMenu = header.getByRole("button", {
        name: "Solutions",
        exact: true,
      })

      await solutionsMenu.hover()
      await expect(dispatchLink).toBeHidden()
      await expect(
        header.getByRole("link", { name: "AI Cloud", exact: true })
      ).toBeVisible()

      await platformMenu.click()
      await expect(dispatchLink).toBeVisible()
      await header.getByRole("link", { name: "Proof & Trust" }).focus()
      await expect(dispatchLink).toBeHidden()
    }
    expect(errors).toEqual([])
  })

  test("supports scenario decisions, canonical domains, visual layers, and URL state", async ({
    page,
  }, testInfo) => {
    await page.goto("/platform/dispatch-envelope")

    await expect(page.getByTestId("dispatch-decision-pill")).toContainText("REPAIR")
    await expect(page.getByTestId("dispatch-ribbon-flow")).toContainText("4.0 MW")
    await expect(page.getByTestId("dispatch-ribbon-flow")).toContainText("2.8 MW")
    await expect(page.getByTestId("dispatch-proof-eligibility")).toContainText(
      "Proof eligible"
    )
    await expect(page.getByTestId("dispatch-constraint-storage")).toHaveAttribute(
      "data-constraint-status",
      "binding"
    )
    await expect(
      page.getByTestId("dispatch-constraint-cooling-water")
    ).toHaveAttribute("data-constraint-status", "binding")
    await expect(page.locator('[data-testid^="dispatch-constraint-"][role="option"]').first()).toHaveAttribute(
      "data-testid",
      "dispatch-constraint-storage"
    )
    await expect(page.getByTestId("dispatch-accepted-path")).toHaveAttribute("d", /M/)
    await expect(page.getByTestId("dispatch-repair-delta")).toHaveAttribute("d", /M/)

    await page.getByTestId("dispatch-scenario-normal").click()
    await expect(page.getByTestId("dispatch-decision-pill")).toContainText("ALLOW")
    await expect(page.getByTestId("dispatch-accepted-path")).toHaveAttribute("d", /M/)
    await expect(page.getByTestId("dispatch-repair-delta")).toHaveCount(0)

    if (testInfo.project.name.includes("mobile")) {
      await page.getByTestId("dispatch-mode-constraints").click()
    }

    await page.getByTestId("dispatch-scenario-cooling-contingency").click()
    await expect(page.getByTestId("dispatch-decision-pill")).toContainText("REJECT")
    await expect(page.getByTestId("dispatch-hard-block-cooling-water")).toHaveAttribute(
      "stroke",
      "#ff6b6b"
    )
    await expect(page.getByTestId("dispatch-reject-marker")).toBeVisible()
    await expect(page.getByTestId("dispatch-accepted-path")).toHaveCount(0)
    await expect(page.getByTestId("dispatch-repair-delta")).toHaveCount(0)
    await expect(page.locator('[data-testid^="dispatch-constraint-"][role="option"]').first()).toHaveAttribute(
      "data-testid",
      "dispatch-constraint-cooling-water"
    )

    await page.getByTestId("dispatch-scenario-telemetry-loss").click()
    await expect(page.getByTestId("dispatch-decision-pill")).toContainText("NO-PROOF")
    await expect(page.getByTestId("dispatch-proof-eligibility")).toContainText("No-proof")
    await expect(page.getByTestId("dispatch-no-proof-band")).toBeVisible()
    await expect(page.getByTestId("dispatch-accepted-path")).toHaveCount(0)
    await expect(page.getByTestId("dispatch-repair-delta")).toHaveCount(0)
    await expect(page).toHaveURL(/dispatch=telemetry-loss/)

    await page.getByTestId("dispatch-scenario-bridge-power").click()
    await expect(page.getByTestId("dispatch-decision-pill")).toContainText("REPAIR")
    await expect(page.getByTestId("dispatch-ribbon-flow")).toContainText("5.0 MW")
    await expect(page.getByTestId("dispatch-ribbon-flow")).toContainText("3.4 MW")
    await expect(page.locator('[data-testid^="dispatch-constraint-"][role="option"]').first()).toHaveAttribute(
      "data-testid",
      "dispatch-constraint-bridge-power"
    )

    await page.goto("/platform/dispatch-envelope?dispatch=telemetry-loss")
    await expect(page.getByTestId("dispatch-decision-pill")).toContainText("NO-PROOF")
  })

  test("keeps binding rail ArrowUp/ArrowDown and constraint URL state in sync", async ({
    page,
  }) => {
    await page.goto("/platform/dispatch-envelope?dispatch=grid-stress&constraint=storage")

    await expectUrlParam(page, "dispatch", "grid-stress")
    await expectUrlParam(page, "constraint", "storage")
    await expect(page.getByTestId("dispatch-constraint-storage")).toHaveAttribute(
      "aria-selected",
      "true"
    )

    await page.getByTestId("dispatch-constraint-storage").focus()
    await page.keyboard.press("ArrowDown")
    await expect(page.getByTestId("dispatch-constraint-cooling-water")).toBeFocused({
      timeout: 1_000,
    })
    await expect(
      page.getByTestId("dispatch-constraint-cooling-water")
    ).toHaveAttribute("aria-selected", "true")
    await expectUrlParam(page, "constraint", "cooling-water")

    await page.keyboard.press("ArrowUp")
    await expect(page.getByTestId("dispatch-constraint-storage")).toBeFocused({
      timeout: 1_000,
    })
    await expect(page.getByTestId("dispatch-constraint-storage")).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expectUrlParam(page, "constraint", "storage")

    await page.goto(
      "/platform/dispatch-envelope?dispatch=grid-stress&constraint=cooling-water"
    )
    await expect(
      page.getByTestId("dispatch-constraint-cooling-water")
    ).toHaveAttribute("aria-selected", "true")
  })

  test("focuses event markers and reflects the selected event in the inspector", async ({
    page,
  }) => {
    await page.goto("/platform/dispatch-envelope")

    const rampMarker = page.getByRole("button", {
      name: /Full accepted ramp/i,
    })
    const holdMarker = page.getByRole("button", { name: /Hold complete/i })

    await expect(rampMarker).toBeVisible({ timeout: 1_000 })
    await rampMarker.focus()
    await expect(rampMarker).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.getByTestId("dispatch-event-marker-inspector")).toContainText(
      "Full accepted ramp",
      { timeout: 1_000 }
    )
    await expect(page.getByTestId("dispatch-event-marker-inspector")).toContainText(
      /T\+\d/
    )

    await page.keyboard.press("ArrowRight")
    await expect(holdMarker).toBeFocused({ timeout: 1_000 })
    await expect(page.getByTestId("dispatch-event-marker-inspector")).toContainText(
      "Hold complete",
      { timeout: 1_000 }
    )
  })

  test("supports keyboard tabs, modes, and proof lens", async ({
    page,
  }, testInfo) => {
    await page.goto("/platform/dispatch-envelope")

    await page.getByTestId("dispatch-scenario-grid-stress").focus()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByTestId("dispatch-scenario-normal")).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(page.getByTestId("dispatch-live-region")).toContainText(
      "Normal operation: ALLOW"
    )
    await expect(page).toHaveURL(/dispatch=normal/)
    await page.getByTestId("dispatch-scenario-grid-stress").click()

    await page.getByTestId("dispatch-constraint-cooling-water").click()
    await page.getByTestId("dispatch-mode-decision").focus()
    await expect(page.getByTestId("dispatch-mode-decision")).toHaveAttribute(
      "tabindex",
      "0"
    )
    await page.keyboard.press("ArrowRight")
    await expect(page.getByTestId("dispatch-mode-constraints")).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(page.getByTestId("dispatch-mode-constraints")).toHaveAttribute(
      "tabindex",
      "0"
    )
    await expect(page.getByTestId("dispatch-mode-constraints")).toBeFocused()
    await expect(page.getByTestId("dispatch-mode-panel")).toHaveAttribute(
      "aria-labelledby",
      "dispatch-mode-tab-constraints"
    )
    await expect(page.getByText("Cooling / water constraint")).toBeVisible()

    await page.keyboard.press("End")
    await expect(page.getByTestId("dispatch-mode-evidence")).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(page.getByTestId("dispatch-mode-evidence")).toBeFocused()
    await expect(page.getByText("Evidence quality")).toBeVisible()

    await page.keyboard.press("Home")
    await expect(page.getByTestId("dispatch-mode-decision")).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await expect(page.getByTestId("dispatch-mode-decision")).toBeFocused()
    await expect(page.getByTestId("dispatch-domain-electrical")).toHaveCount(0)
    if (testInfo.project.name.includes("mobile")) {
      await page.getByTestId("dispatch-mode-constraints").click()
    }
    await page.getByTestId("dispatch-show-all").click()
    await expect(page.getByTestId("dispatch-domain-electrical")).toHaveCount(1)

    await page.getByTestId("dispatch-proof-lens-range").focus()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByTestId("dispatch-proof-lens-card")).toBeVisible()
    await expect(page.getByTestId("dispatch-proof-lens-card")).toContainText(
      "proof lens"
    )
    await expect(page.getByTestId("dispatch-proof-lens-card")).toContainText(
      "Requested"
    )
    await expect(page.getByTestId("dispatch-proof-lens-card")).toContainText(
      "Accepted"
    )
    await expect(page.getByTestId("dispatch-proof-lens-card")).toContainText(
      "Repair delta"
    )
    await expect(page.getByTestId("dispatch-proof-lens-card")).toContainText(
      "Binding"
    )
    await expect(page.getByTestId("dispatch-proof-lens-card")).toContainText(
      "Proof"
    )
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("dispatch-proof-lens-card")).toBeHidden()
  })

  test("opens evidence after deep proof inspection and restores the exact trigger", async ({
    page,
  }) => {
    await page.goto("/platform/dispatch-envelope")

    const proofButton = page.getByTestId("dispatch-proof-button")
    const proofRange = page.getByTestId("dispatch-proof-lens-range")

    await expect(proofButton).toHaveAttribute("aria-haspopup", "dialog")
    await expect(proofButton).toHaveAttribute("aria-expanded", "false")
    const controlledDrawerId = await proofButton.getAttribute("aria-controls")

    expect(controlledDrawerId).toBeTruthy()

    await proofRange.focus()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByTestId("dispatch-proof-lens-card")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("dispatch-proof-lens-card")).toBeHidden()

    await proofButton.click()
    const drawer = page.getByTestId("dispatch-evidence-drawer")

    await expect(drawer).toBeVisible()
    await expect(drawer).toHaveAttribute("role", "dialog")
    await expect(drawer).toHaveAttribute("id", controlledDrawerId ?? "")
    await expect(proofButton).toHaveAttribute("aria-expanded", "true")
    await expect(drawer.getByText("schema_version")).toBeVisible()
    await expect(
      drawer.getByText("dispatch-envelope.v1")
    ).toBeVisible()
    await expect(drawer).toContainText("proof_root")
    await expect(drawer).toContainText(/sha256:[a-f0-9]{64}/)
    await expect(drawer).toContainText(
      "never grants authority or mints proof"
    )
    await expect(
      drawer.getByText("reserve_floor_report.csv")
    ).toBeVisible()
    await drawer.getByRole("button", { name: "Close" }).click()
    await expect(drawer).toBeHidden()
    await expect(proofButton).toHaveAttribute("aria-expanded", "false")
    await expect(proofButton).toBeFocused()

    const pinnedTrigger = page
      .getByTestId("dispatch-pinned-artifact")
      .getByRole("button")
      .first()

    await pinnedTrigger.click()
    await expect(drawer).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
    await expect(pinnedTrigger).toBeFocused()

    const traceTrigger = page.getByTestId("dispatch-proof-trace-proof-root")

    await traceTrigger.click()
    await expect(drawer).toBeVisible()
    await drawer.getByRole("button", { name: "Close" }).click()
    await expect(drawer).toBeHidden()
    await expect(traceTrigger).toBeFocused()
  })

  test("renders the equivalent table and exports deterministic evidence", async ({
    page,
  }, testInfo) => {
    await page.goto("/platform/dispatch-envelope")

    await page.getByTestId("dispatch-table-toggle").click()
    await expect(page.getByTestId("dispatch-table-toggle")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    await expect(page.getByTestId("dispatch-equivalent-table")).toBeVisible()
    for (const domainId of canonicalDomainIds) {
      await expect(page.getByTestId(`dispatch-table-row-${domainId}`)).toBeVisible()
    }
    await expect(page.getByTestId("dispatch-table-group-scenario")).toContainText(
      "Grid stress"
    )
    await expect(page.getByTestId("dispatch-table-group-scenario")).toContainText(
      "proof root"
    )
    for (const [testId, name] of [
      ["dispatch-table-group-constraints", "Domain constraints"],
      ["dispatch-table-group-timeline", "Timeline samples"],
      ["dispatch-table-group-dimensions", "Dimension audit"],
    ] as const) {
      const region = page.getByTestId(testId)

      await expect(region).toBeVisible()
      await expect(region).toHaveAttribute("tabindex", "0")
      await expect(region).toHaveAccessibleName(name)
    }
    await expect(page.getByTestId("dispatch-table-group-artifacts")).toContainText(
      "reserve_floor_report.csv"
    )
    await expect(page.locator('[data-testid^="dispatch-table-row-"]')).toHaveCount(
      canonicalDomainIds.length
    )
    expect((await getTableRowIds(page)).sort()).toEqual(
      [...canonicalDomainIds].sort()
    )
    await expect(page.locator('[data-testid^="dispatch-table-row-"]').nth(0)).toHaveAttribute(
      "data-testid",
      "dispatch-table-row-storage"
    )
    await expect(page.locator('[data-testid^="dispatch-table-row-"]').nth(1)).toHaveAttribute(
      "data-testid",
      "dispatch-table-row-cooling-water"
    )
    await expect(page.locator('[data-testid^="dispatch-table-row-"]').nth(0)).toContainText(
      "Binding"
    )
    await expect(page.locator('[data-testid^="dispatch-table-row-"]').nth(1)).toContainText(
      "Binding"
    )
    await expect(page.getByTestId("dispatch-table-row-storage")).toContainText(
      "reserve_floor_report.csv"
    )

    const downloadPromise = page.waitForEvent("download")
    await page.getByTestId("dispatch-export-json").click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(
      "gridninja-grid-stress-dispatch-envelope.json"
    )
    const downloadPath = testInfo.outputPath(download.suggestedFilename())
    await download.saveAs(downloadPath)
    const exported = JSON.parse(await readFile(downloadPath, "utf8")) as {
      schemaVersion: string
      scenarioId: string
      decision: string
      evidenceClass: string
      signature: string
      constraints: Array<{ id: string }>
    }

    expect(exported).toMatchObject({
      schemaVersion: "dispatch-envelope.v1",
      scenarioId: "grid-stress",
      decision: "repair",
      evidenceClass: "illustrative",
      signature: "illustrative:unsigned",
    })
    expect(exported.constraints.map((constraint) => constraint.id)).toEqual(
      canonicalDomainIds
    )
    expect(
      exported.constraints.some((constraint) =>
        ["cooling", "bridge", "workload", "trust"].includes(constraint.id)
      )
    ).toBe(false)
  })

  test("is responsive without page overflow and captures review screenshots", async ({
    page,
  }, testInfo) => {
    await page.goto("/platform/dispatch-envelope")
    await expect(page.getByTestId("dispatch-envelope-svg")).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(1)

    const screenshotPath = testInfo.outputPath(
      `dispatch-envelope-${testInfo.project.name}.png`
    )

    if (testInfo.project.name.includes("mobile")) {
      await page.getByTestId("dispatch-envelope-visual").scrollIntoViewIfNeeded()
      await page.screenshot({ path: screenshotPath })
    } else {
      await page.screenshot({ fullPage: true, path: screenshotPath })
    }
  })

  test("uses the compact mobile composition without chart overflow", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "Mobile-only layout assertion"
    )

    const viewports = [
      { width: 390, height: 844 },
      { width: 375, height: 667 },
      { width: 412, height: 915 },
      { width: 844, height: 390 },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto("/platform/dispatch-envelope")

      const chart = page.getByTestId("dispatch-envelope-chart")
      const measurements = await chart.evaluate((element) => {
        const svg = element.querySelector("svg")

        if (!svg) {
          throw new Error("Dispatch SVG missing")
        }

        const hostBounds = element.getBoundingClientRect()
        const svgBounds = svg.getBoundingClientRect()

        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          viewportWidth: window.innerWidth,
          hostWidth: hostBounds.width,
          containerWidth:
            element.parentElement?.getBoundingClientRect().width ?? hostBounds.width,
          hostLeft: hostBounds.left,
          hostRight: hostBounds.right,
          svgLeft: svgBounds.left,
          svgRight: svgBounds.right,
        }
      })

      await expect(chart).toHaveAttribute(
        "data-chart-layout",
        measurements.containerWidth < 560 ? "compact" : "wide"
      )
      expect(measurements.scrollWidth - measurements.clientWidth).toBeLessThanOrEqual(1)
      expect(measurements.hostWidth).toBeLessThanOrEqual(measurements.viewportWidth)
      expect(measurements.svgLeft).toBeGreaterThanOrEqual(measurements.hostLeft - 1)
      expect(measurements.svgRight).toBeLessThanOrEqual(measurements.hostRight + 1)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/platform/dispatch-envelope")
    await expect(page.getByTestId("dispatch-mobile-summary")).toBeVisible()
    await expect(page.getByTestId("dispatch-envelope-chart")).toHaveAttribute(
      "data-chart-layout",
      "compact"
    )
    await expect(page.getByTestId("dispatch-domain-storage")).toHaveCount(0)
    await expect(page.getByTestId("dispatch-table-toggle")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    await expect(page.getByTestId("dispatch-equivalent-table")).toHaveCount(0)

    const visual = page.getByTestId("dispatch-envelope-visual")

    const siteHeader = page.locator("header").first()

    await siteHeader.evaluate((element) => {
      element.style.display = "none"
    })
    await page.locator("nextjs-portal").evaluateAll((portals) => {
      portals.forEach((portal) => {
        const element = portal as HTMLElement

        element.style.display = "none"
      })
    })
    await expect(siteHeader).toBeHidden()
    await expect(visual).toHaveAttribute("data-animation-phase", "settled")
    await visual.screenshot({
      path: testInfo.outputPath(
        `dispatch-envelope-mobile-${testInfo.project.name}.png`
      ),
      animations: "disabled",
    })
  })

  test("keeps mobile summary values and inspectors progressive", async ({
    page,
  }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes("mobile"),
      "Mobile-only interaction assertion"
    )

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/platform/dispatch-envelope")

    const summary = page.getByTestId("dispatch-mobile-summary")

    await expect(summary).toContainText("Requested")
    await expect(summary).toContainText("4.0 MW")
    await expect(summary).toContainText("Accepted")
    await expect(summary).toContainText("2.8 MW")
    await expect(summary).toContainText("Repair delta")
    await expect(summary).toContainText("−1.2 MW")
    await expect(summary).toContainText("Eligible")

    await page.getByTestId("dispatch-scenario-normal").click()
    await expect(summary).toContainText("ALLOW")
    await page.getByTestId("dispatch-scenario-cooling-contingency").click()
    await expect(summary).toContainText("Withheld")
    await expect(summary).toContainText("REJECT")
    await page.getByTestId("dispatch-scenario-telemetry-loss").click()
    await expect(summary).toContainText("NO-PROOF")
    await expect(summary).toContainText("Withheld")

    await page.getByTestId("dispatch-scenario-grid-stress").click()
    const proofRange = page.getByTestId("dispatch-proof-lens-range")
    const proofStep = (await proofRange.getAttribute("step")) ?? "1"

    await proofRange.fill(proofStep)
    const proofCard = page.getByTestId("dispatch-proof-lens-card")

    await expect(proofCard).toBeVisible()
    await expect(proofCard).toHaveCSS("position", "static")

    await page.getByTestId("dispatch-event-control-1").click()
    const eventCard = page.getByTestId("dispatch-event-marker-inspector")

    await expect(eventCard).toBeVisible()
    await expect(eventCard).toHaveCSS("position", "static")
    await expect(page.getByTestId("dispatch-mobile-event-strip")).toHaveCSS(
      "scroll-snap-type",
      /x/
    )
    await expect(page.getByTestId("dispatch-constraint-rail")).toHaveCSS(
      "scroll-snap-type",
      /x/
    )
  })

  test("keeps proof inspectors positioned over the wide chart", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "Desktop-only layout assertion")

    await page.goto("/platform/dispatch-envelope")
    const proofRange = page.getByTestId("dispatch-proof-lens-range")

    await proofRange.focus()
    await page.keyboard.press("ArrowRight")
    await expect(page.getByTestId("dispatch-proof-lens-card")).toHaveCSS(
      "position",
      "absolute"
    )
  })

  test("keeps final paths correct with reduced motion replay", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/platform/dispatch-envelope")
    await expect(page.getByTestId("dispatch-envelope-chart")).toHaveAttribute(
      "data-chart-layout",
      testInfo.project.name.includes("mobile") ? "compact" : "wide"
    )

    const initialAcceptedPath = await page
      .getByTestId("dispatch-accepted-path")
      .getAttribute("d")

    await expect(page.getByTestId("dispatch-envelope-visual")).toHaveAttribute(
      "data-animation-phase",
      "settled"
    )
    await page.getByTestId("dispatch-replay-button").click()
    await expect(page.getByTestId("dispatch-request-path")).toBeVisible()
    await expect(page.getByTestId("dispatch-accepted-path")).toBeVisible()
    await expect(page.getByTestId("dispatch-accepted-path")).toHaveAttribute(
      "d",
      initialAcceptedPath ?? ""
    )
    expect(await getAcceptedRevealState(page)).toMatchObject({
      animationName: "none",
      transform: "none",
    })

    await page.getByTestId("dispatch-scenario-bridge-power").click()
    await page.getByTestId("dispatch-replay-button").click()
    await expect(page.getByTestId("dispatch-accepted-path")).toHaveAttribute("d", /M/)
    expect(await getAcceptedRevealState(page)).toMatchObject({
      animationName: "none",
      transform: "none",
    })

    await page.getByTestId("dispatch-scenario-cooling-contingency").click()
    await page.getByTestId("dispatch-replay-button").click()
    await expect(page.getByTestId("dispatch-request-path")).toBeVisible()
    await expect(page.getByTestId("dispatch-accepted-path")).toHaveCount(0)

    await page.getByTestId("dispatch-scenario-telemetry-loss").click()
    await page.getByTestId("dispatch-replay-button").click()
    await expect(page.getByTestId("dispatch-request-path")).toBeVisible()
    await expect(page.getByTestId("dispatch-accepted-path")).toHaveCount(0)
  })

  test("has no serious or critical automated accessibility violations", async ({ page }) => {
    await page.goto("/platform/dispatch-envelope")
    for (const scenario of ["normal", "grid-stress", "cooling-contingency", "telemetry-loss"]) {
      await page.getByTestId(`dispatch-scenario-${scenario}`).click()
      const results = await new AxeBuilder({ page })
        .include("[data-testid=dispatch-envelope-visual]")
        .analyze()
      expect(
        results.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? "")
        )
      ).toEqual([])
    }
  })
})
