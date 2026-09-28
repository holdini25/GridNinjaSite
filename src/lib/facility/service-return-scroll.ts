type VerticalBounds = { top: number; bottom: number }

/** Restore the inspection action without clipping the assembly's handle rail.
 * All bounds are viewport coordinates. A short/zoomed viewport prioritizes the
 * focused action; a normal phone keeps the whole inspection group together. */
export function serviceReturnScroll(
  scrollY: number,
  viewport: VerticalBounds,
  subject: VerticalBounds,
  action: VerticalBounds,
): number {
  const whole = { top: Math.min(subject.top, action.top), bottom: Math.max(subject.bottom, action.bottom) }
  const target = whole.bottom - whole.top <= viewport.bottom - viewport.top ? whole : action
  const minimum = scrollY + target.bottom - viewport.bottom
  const maximum = scrollY + target.top - viewport.top
  return Math.max(0, Math.min(Math.max(scrollY, minimum), maximum))
}
