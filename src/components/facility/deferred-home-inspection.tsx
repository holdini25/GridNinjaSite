"use client"

import { useCallback, useEffect, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from "react"
import type { AssessmentRecord } from "@/types/assessment"
import type { FacilityInspectionProps, FacilityMode, FacilityVisualRelease } from "@/types/facility"

type Viewer = ComponentType<FacilityInspectionProps>

/** Keep the published decision in HTML while the interactive viewer is offscreen. */
export function DeferredHomeInspection({ record, release, mode, shell }: { record: AssessmentRecord; release: FacilityVisualRelease; mode: FacilityMode; shell: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const attempt = useRef(0)
  const automaticAttempted = useRef(false)
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [Viewer, setViewer] = useState<Viewer | null>(null)
  const [activateOnMount, setActivateOnMount] = useState(false)
  const [failed, setFailed] = useState(false)
  const load = useCallback((activate = false) => {
    if (activate) setActivateOnMount(true)
    if (pending.current || (!activate && automaticAttempted.current)) return
    automaticAttempted.current = true
    pending.current = true
    setFailed(false)
    const generation = ++attempt.current
    const fail = () => {
      if (attempt.current !== generation) return
      ++attempt.current
      pending.current = false
      setFailed(true)
    }
    const timer = setTimeout(fail, 8_000)
    deadline.current = timer
    void import("./facility-inspection").then(module => {
      if (attempt.current !== generation) return
      pending.current = false
      setViewer(() => module.FacilityInspection)
    }, fail).finally(() => clearTimeout(timer))
  }, [])

  useEffect(() => () => {
    ++attempt.current
    pending.current = false
    if (deadline.current) clearTimeout(deadline.current)
  }, [])

  useEffect(() => {
    if (Viewer) return
    const stage = root.current?.querySelector<HTMLElement>(".facility-stage")
    if (!stage) return
    let pageLoaded = document.readyState === "complete", visible = false
    const advance = () => {
      if (!pageLoaded || document.visibilityState !== "visible") return
      if (visible) load()
    }
    const sample = () => {
      const rect = stage.getBoundingClientRect()
      visible = rect.bottom > 0 && rect.top < window.innerHeight && Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0) >= rect.height * .25
      advance()
    }
    const loaded = () => { pageLoaded = true; sample() }
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      const entry = entries.at(-1)
      if (entry) { visible = entry.isIntersecting && entry.intersectionRatio >= .25; advance() }
    }, { threshold: [0, .25] })
    observer?.observe(stage)
    if (!observer) { window.addEventListener("scroll", sample, { passive: true }); window.addEventListener("resize", sample, { passive: true }) }
    window.addEventListener("load", loaded, { once: true })
    document.addEventListener("visibilitychange", sample)
    queueMicrotask(sample)
    return () => {
      observer?.disconnect()
      window.removeEventListener("load", loaded); window.removeEventListener("scroll", sample); window.removeEventListener("resize", sample)
      document.removeEventListener("visibilitychange", sample)
    }
  }, [Viewer, load])

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return
    if (!event.target.closest("[data-facility-activate]")) return
    event.preventDefault()
    load(true)
  }
  return <div ref={root} onClick={onClick} data-facility-loading={activateOnMount && !Viewer && !failed ? true : undefined}>
    {Viewer ? <Viewer record={record} release={release} variant="hero" loadingPolicy="auto-adaptive" mode={mode} activateOnMount={activateOnMount} /> : shell}
    {activateOnMount && !Viewer && !failed && <p className="facility-motion-note" role="status">Preparing interactive facility inspection. The decision remains available.</p>}
    {failed && <p className="facility-motion-note" role="status">Interactive inspection could not load. The decision and demo links remain available. <button type="button" className="facility-action" onClick={() => load(true)}>Retry interactive inspection</button></p>}
  </div>
}
