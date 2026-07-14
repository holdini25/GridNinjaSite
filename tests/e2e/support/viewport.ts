import { expect, type Locator } from "@playwright/test"

const SAFE_VIEWPORT_INSET = 16
const CENTER_TOLERANCE_PX = 4

export async function centerLocatorInViewport(locator: Locator) {
  await expect
    .poll(
      () =>
        locator.evaluate((element, config) => {
          element.scrollIntoView({
            behavior: "auto",
            block: "center",
            inline: "center",
          })

          const rect = element.getBoundingClientRect()
          const targetTop = Math.max(
            config.inset,
            (window.innerHeight - rect.height) / 2
          )
          const centered = Math.abs(rect.top - targetTop) <= config.tolerance
          const safe =
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
            left: rect.left,
            right: rect.right,
            safe,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
            width: rect.width,
          } satisfies ViewportGeometry
        }, {
          inset: SAFE_VIEWPORT_INSET,
          tolerance: CENTER_TOLERANCE_PX,
        }),
      { message: "Target should settle inside the centered safe viewport" }
    )
    .toMatchObject({ safe: true })
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
