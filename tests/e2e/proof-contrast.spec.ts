import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

type TestViewTransition = {
  ready: Promise<void>
  skipTransition(): void
}

type TestViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => TestViewTransition
}

type ProofContrastWindow = Window & {
  __proofContrastTransition?: TestViewTransition
}

test("keeps proof contrast stable while Load Passport selection changes", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "The focused regression covers Lighthouse's desktop Chromium path."
  )

  await page.goto("/proof")

  await expect
    .poll(() =>
      page.locator("html").evaluate((root) =>
        window.getComputedStyle(root).getPropertyValue("view-transition-name")
      )
    )
    .toBe("none")

  const initialRendering = await page.evaluate(() =>
    [".gn-chain-stage", ".gn-v2-braid-node"].map((selector) => {
      const target = document.querySelector(selector)
      const section = target?.closest("section")

      if (!target || !section) {
        throw new Error(`Proof contrast target is unavailable: ${selector}`)
      }

      return {
        background: window.getComputedStyle(target).backgroundColor,
        contentVisibility: window.getComputedStyle(section).contentVisibility,
        selector,
      }
    })
  )

  expect(initialRendering.map(({ selector }) => selector)).toEqual([
    ".gn-chain-stage",
    ".gn-v2-braid-node",
  ])
  expect(
    initialRendering.every(
      ({ background, contentVisibility }) =>
        contentVisibility === "visible" &&
        background !== "rgb(107, 107, 107)" &&
        !background.startsWith("rgba(")
    )
  ).toBe(true)

  const initialResults = await new AxeBuilder({ page })
    .include(".gn-proof-chain")
    .include(".gn-v2-braid-node")
    .withRules(["color-contrast"])
    .analyze()

  expect(initialResults.violations).toEqual([])

  const passport = page
    .locator("section.gn-hd-panel")
    .filter({ hasText: "AI Data Center Load Passport" })
    .first()
  const telemetryTrust = passport.getByRole("button", {
    name: /Telemetry Trust Score/i,
  })

  await passport.scrollIntoViewIfNeeded()
  await telemetryTrust.focus()
  await expect(telemetryTrust).toHaveAttribute("aria-pressed", "true")

  await page.evaluate(() => {
    const transitionDocument = document as TestViewTransitionDocument
    const trackedWindow = window as ProofContrastWindow
    const proofChain = document.querySelector(".gn-proof-chain")

    if (!transitionDocument.startViewTransition) {
      throw new Error("Native view transitions are unavailable in Chromium")
    }
    if (!proofChain) {
      throw new Error("Proof chain target is unavailable")
    }

    proofChain.classList.add("gn-vt-rta-trace")
    trackedWindow.__proofContrastTransition =
      transitionDocument.startViewTransition(() => {
        proofChain.toggleAttribute("data-proof-contrast-transition")
      })
  })

  const transitionStyles = await page.evaluate(async () => {
    const trackedWindow = window as ProofContrastWindow
    const transition = trackedWindow.__proofContrastTransition
    const proofChain = document.querySelector(".gn-proof-chain")

    if (!transition || !proofChain) {
      throw new Error("Proof contrast transition did not start")
    }

    await transition.ready

    const namedDurations: Array<{ duration: number | string; pseudo: string }> = []

    for (const animation of document.getAnimations()) {
      const effect = animation.effect as (KeyframeEffect & {
        pseudoElement?: string | null
      }) | null
      const pseudo = effect?.pseudoElement

      if (!pseudo?.startsWith("::view-transition")) continue

      animation.pause()
      if (
        pseudo === "::view-transition-old(gn-rta-trace)" ||
        pseudo === "::view-transition-new(gn-rta-trace)"
      ) {
        const duration = effect?.getTiming().duration ?? 0

        namedDurations.push({
          duration:
            typeof duration === "number" ? duration : duration.toString(),
          pseudo,
        })
      }
    }

    const root = document.documentElement
    const group = window.getComputedStyle(
      root,
      "::view-transition-group(root)"
    )
    const oldSnapshot = window.getComputedStyle(
      root,
      "::view-transition-old(root)"
    )
    const newSnapshot = window.getComputedStyle(
      root,
      "::view-transition-new(root)"
    )

    return {
      groupDuration: group.animationDuration,
      namedDurations,
      namedTarget: window
        .getComputedStyle(proofChain)
        .getPropertyValue("view-transition-name"),
      newAnimation: newSnapshot.animationName,
      newBlendMode: newSnapshot.mixBlendMode,
      oldAnimation: oldSnapshot.animationName,
      oldDisplay: oldSnapshot.display,
    }
  })

  expect(transitionStyles).toMatchObject({
    groupDuration: "0s",
    namedTarget: "gn-rta-trace",
    newAnimation: "none",
    newBlendMode: "normal",
    oldAnimation: "none",
    oldDisplay: "none",
  })
  expect(transitionStyles.namedDurations).toEqual(
    expect.arrayContaining([
      {
        duration: 220,
        pseudo: "::view-transition-old(gn-rta-trace)",
      },
      {
        duration: 220,
        pseudo: "::view-transition-new(gn-rta-trace)",
      },
    ])
  )

  for (const selector of [".gn-chain-stage", ".gn-v2-braid-node"]) {
    const backgrounds = await page.locator(selector).evaluateAll((nodes) =>
      nodes.map((node) => window.getComputedStyle(node).backgroundColor)
    )

    expect(backgrounds.length).toBeGreaterThan(0)
    expect(
      backgrounds.every(
        (color) => !color.startsWith("rgba(") && !color.includes("/")
      )
    ).toBe(true)
  }

  const results = await new AxeBuilder({ page })
    .include(".gn-proof-chain")
    .include(".gn-v2-braid-node")
    .withRules(["color-contrast"])
    .analyze()

  await page.evaluate(() => {
    const trackedWindow = window as ProofContrastWindow
    const proofChain = document.querySelector(".gn-proof-chain")

    trackedWindow.__proofContrastTransition?.skipTransition()
    delete trackedWindow.__proofContrastTransition
    proofChain?.classList.remove("gn-vt-rta-trace")
    proofChain?.removeAttribute("data-proof-contrast-transition")
  })

  expect(results.violations).toEqual([])
})
