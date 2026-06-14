type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => void
}

export function runViewTransition(updateCallback: () => void) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    updateCallback()
    return
  }

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches
  const viewTransitionDocument = document as ViewTransitionDocument

  if (reducedMotion || !viewTransitionDocument.startViewTransition) {
    updateCallback()
    return
  }

  viewTransitionDocument.startViewTransition(updateCallback)
}
