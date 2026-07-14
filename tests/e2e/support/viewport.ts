import { expect, type Locator } from "@playwright/test"

const SAFE_VIEWPORT_INSET = 16
const CENTER_TOLERANCE_PX = 2
const MAX_LAYOUT_PASSES = 60

export async function centerLocatorInViewport(locator: Locator) {
  let lastGeometry: ViewportGeometry | undefined

  for (let pass = 0; pass < MAX_LAYOUT_PASSES; pass += 1) {
    lastGeometry = await locator.evaluate(async (element, config) => {
      const before = readGeometry(element, config.inset, config.tolerance)

      if (!before.centered) {
        const targetTop = Math.max(
          config.inset,
          (window.innerHeight - before.height) / 2
        )

        window.scrollBy({
          top: before.top - targetTop,
          behavior: "auto",
        })
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
      }

      return readGeometry(element, config.inset, config.tolerance)

      function readGeometry(
        target: Element,
        safeInset: number,
        centerTolerance: number
      ) {
        const rect = target.getBoundingClientRect()
        const targetTop = Math.max(
          safeInset,
          (window.innerHeight - rect.height) / 2
        )
        const centered = Math.abs(rect.top - targetTop) <= centerTolerance
        const safe =
          centered &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= safeInset &&
          rect.left >= safeInset &&
          rect.bottom <= window.innerHeight - safeInset &&
          rect.right <= window.innerWidth - safeInset

        return (
          {
            bottom: rect.bottom,
            centered,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            safe,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            width: rect.width,
          } satisfies ViewportGeometry
        )
      }
    }, {
      inset: SAFE_VIEWPORT_INSET,
      tolerance: CENTER_TOLERANCE_PX,
    })

    if (lastGeometry.safe) {
      return
    }
  }

  expect(
    lastGeometry?.safe,
    `Target did not settle inside the safe viewport: ${JSON.stringify(lastGeometry)}`
  ).toBe(true)
}

type ViewportGeometry = {
  bottom: number
  centered: boolean
  height: number
  left: number
  right: number
  safe: boolean
  top: number
  viewportHeight: number
  viewportWidth: number
  width: number
}
