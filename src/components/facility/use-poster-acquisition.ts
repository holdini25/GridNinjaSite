"use client"

import { useCallback, useEffect, useState, type RefObject } from "react"
export { FACILITY_POSTER_PLACEHOLDER } from "@/lib/facility/poster-placeholder"

/** One explicit experiment switch; retained only after matched production measurements. */
export const DEFER_V7_MOBILE_POSTER = true

/** Desktop source discovery stays in SSR. Mobile acquisition waits until the
 * document has loaded and the illustration approaches the viewport. No image
 * decode/graphics readiness is inferred from this acquisition state. */
export function usePosterAcquisition(stage: RefObject<HTMLElement | null>, enabled: boolean) {
  const [requested, setRequested] = useState(false)
  const request = useCallback(() => setRequested(true), [])
  useEffect(() => {
    if (!enabled || requested) return
    const mobile = window.matchMedia("(max-width: 639px)")
    let loaded = document.readyState === "complete", near = false, active = true
    const acquire = () => { if (active && mobile.matches && loaded && near && document.visibilityState === "visible") request() }
    const sample = () => {
      const rect = stage.current?.getBoundingClientRect()
      near = !!rect && rect.bottom >= -200 && rect.top <= window.innerHeight + 200
      acquire()
    }
    const loadedDocument = () => { loaded = true; sample() }
    const visibleDocument = () => { if (document.visibilityState === "visible") sample() }
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      const entry = entries.at(-1)
      if (entry) { near = entry.isIntersecting; acquire() }
    }, { rootMargin: "200px 0px", threshold: 0 })
    if (stage.current) observer?.observe(stage.current)
    // Queue initial inspection so acquisition remains outside hydration's commit.
    queueMicrotask(sample)
    mobile.addEventListener("change", sample)
    window.addEventListener("load", loadedDocument, { once: true })
    document.addEventListener("visibilitychange", visibleDocument)
    if (!observer) { window.addEventListener("scroll", sample, { passive: true }); window.addEventListener("resize", sample, { passive: true }) }
    return () => {
      active = false; observer?.disconnect()
      mobile.removeEventListener("change", sample); window.removeEventListener("load", loadedDocument)
      document.removeEventListener("visibilitychange", visibleDocument)
      window.removeEventListener("scroll", sample); window.removeEventListener("resize", sample)
    }
  }, [enabled, requested, request, stage])
  return { requested: !enabled || requested, request }
}
