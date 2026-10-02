import { expect, type Locator } from "@playwright/test"

const SAFE_VIEWPORT_INSET = 16
const CENTER_TOLERANCE_PX = 4
const STABLE_FRAME_TOLERANCE_PX = 0.5

// Position the pointer target without inheriting page-level smooth scrolling.
// Callers still perform one normal click and assert its actual application result.
export async function centerLocatorInViewport(locator: Locator) {
  await expect
    .poll(
      () =>
        locator.evaluate(async (element, config) => {
          element.scrollIntoView({
            behavior: "instant",
            block: "center",
            inline: "center",
          })

          const sample = () => {
            const rect = element.getBoundingClientRect()
            return [rect.top, rect.left, rect.width, rect.height, window.scrollX, window.scrollY]
          }
          let previous = sample()
          let stable = true
          for (let frame = 0; frame < 2; frame++) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
            const current = sample()
            stable &&= current.every((value, index) => Math.abs(value - previous[index]) <= config.frameTolerance)
            previous = current
          }

          const rect = element.getBoundingClientRect()
          const targetTop = Math.max(
            config.inset,
            (window.innerHeight - rect.height) / 2
          )
          const centered = Math.abs(rect.top - targetTop) <= config.tolerance
          const hit = element.ownerDocument.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          )
          const hitTarget = hit !== null && element.contains(hit)
          const safe =
            stable &&
            hitTarget &&
            centered &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= config.inset &&
            rect.left >= config.inset &&
            rect.bottom <= window.innerHeight - config.inset &&
            rect.right <= window.innerWidth - config.inset

          return {
            bottom: rect.bottom,
            centered,
            height: rect.height,
            hitTarget,
            left: rect.left,
            right: rect.right,
            safe,
            stable,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            width: rect.width,
          } satisfies ViewportGeometry
        }, {
          inset: SAFE_VIEWPORT_INSET,
          tolerance: CENTER_TOLERANCE_PX,
          frameTolerance: STABLE_FRAME_TOLERANCE_PX,
        }),
      { message: "Target should settle inside the centered safe viewport and receive pointer input" }
    )
    .toMatchObject({ safe: true })
}

type ViewportGeometry = {
  bottom: number
  centered: boolean
  height: number
  hitTarget: boolean
  left: number
  right: number
  safe: boolean
  stable: boolean
  top: number
  viewportHeight: number
  viewportWidth: number
  width: number
}
