"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DEFER_V7_MOBILE_POSTER, FACILITY_POSTER_PLACEHOLDER, usePosterAcquisition } from "./use-poster-acquisition"

type PosterProps = { desktopUrl: string; mobileUrl: string; alt: string; deferMobile: boolean }
type PosterState = { attempt: number; phase: "initial" | "loaded" | "failed" | "retrying" }
const MAX_RETRIES = 2
const RETRY_TIMEOUT_MS = 8_000
// Approved asset URLs have no fragment. A bounded, explicit query refresh also
// retries cached failures without replacing the image node or fetching a model.
const retryUrl = (url: string, attempt: number) => attempt ? `${url}${url.includes("?") ? "&" : "?"}poster-retry=${attempt}` : url

/** Static preview imagery loads independently of the optional explorer chunk. */
export function FacilityPreviewPoster(props: PosterProps) {
  return <PreviewPoster key={`${props.desktopUrl}\0${props.mobileUrl}`} {...props} />
}

function PreviewPoster({ desktopUrl, mobileUrl, alt, deferMobile }: PosterProps) {
  const focusTarget = useRef<HTMLDivElement>(null)
  const picture = useRef<HTMLPictureElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const mounted = useRef(false)
  const [state, setState] = useState<PosterState>({ attempt: 0, phase: "initial" })
  const current = useRef(state)
  const deferred = deferMobile && DEFER_V7_MOBILE_POSTER
  const acquisition = usePosterAcquisition(picture, deferred)

  const update = useCallback((next: PosterState) => { current.current = next; setState(next) }, [])
  const settle = useCallback((element: HTMLImageElement, loaded: boolean) => {
    if (!mounted.current || !element.currentSrc || element.currentSrc === FACILITY_POSTER_PLACEHOLDER) return
    const attempt = current.current.attempt
    const expected = [retryUrl(desktopUrl, attempt), ...(acquisition.requested ? [retryUrl(mobileUrl, attempt)] : [])]
    if (!expected.some(url => element.currentSrc === new URL(url, document.baseURI).href)) return
    const previous = current.current
    // A timed-out or failed explicit attempt cannot be revived by a late event.
    if (previous.phase === "failed" && previous.attempt > 0) return
    if (previous.phase === (loaded ? "loaded" : "failed")) return
    if (loaded && document.activeElement === retryButton.current) focusTarget.current?.focus({ preventScroll: true })
    update({ ...previous, phase: loaded ? "loaded" : "failed" })
  }, [acquisition.requested, desktopUrl, mobileUrl, update])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    let active = true
    // Cached success/failure can precede hydration's event handlers. A deferred
    // placeholder is never a successful illustration or a failed request.
    queueMicrotask(() => {
      const element = image.current
      if (active && element?.complete) settle(element, element.naturalWidth > 0)
    })
    return () => { active = false }
  }, [settle, state.attempt])
  useEffect(() => {
    if (state.phase !== "retrying") return
    const attempt = state.attempt
    const timeout = window.setTimeout(() => {
      if (mounted.current && current.current.attempt === attempt && current.current.phase === "retrying") {
        update({ attempt, phase: "failed" })
      }
    }, RETRY_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [state.attempt, state.phase, update])

  const notice = state.phase === "failed" || state.phase === "retrying"
  const exhausted = state.attempt === MAX_RETRIES
  const message = state.phase === "retrying" ? "Retrying the still illustration…"
    : state.phase === "failed" ? exhausted ? "The illustration is unavailable. Use the still-image link below or continue reading." : "The still illustration couldn’t load. The assessment remains available."
      : state.phase === "loaded" && state.attempt > 0 ? "Still illustration loaded." : ""
  return <div ref={focusTarget} tabIndex={-1} role="group" aria-label="Facility illustration" data-assessment-preview-focus className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
    <picture ref={picture} className={`facility-poster${deferred ? " facility-preview-poster--deferred" : ""}`}>
      <source media="(max-width: 639px)" srcSet={acquisition.requested ? retryUrl(mobileUrl, state.attempt) : FACILITY_POSTER_PLACEHOLDER} />
      <img ref={image} src={retryUrl(desktopUrl, state.attempt)} width={1360} height={800} alt={alt} loading="lazy" fetchPriority="low" decoding="async"
        onLoad={event => settle(event.currentTarget, event.currentTarget.naturalWidth > 0)} onError={event => settle(event.currentTarget, false)}
        aria-hidden={notice || undefined} className={notice ? "opacity-0" : undefined} />
    </picture>
    <div className={notice ? "absolute inset-x-4 bottom-4 z-10 max-h-[calc(100%_-_2rem)] overflow-y-auto rounded-xl bg-surface p-4 text-sm leading-6 text-foreground" : "sr-only"}>
      <p role="status" aria-live="polite" aria-atomic="true">{message}</p>
      {notice && (!exhausted || state.phase === "retrying") && <button ref={retryButton} type="button" disabled={state.phase === "retrying"}
        className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-input px-4 font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait"
        onClick={() => {
          const previous = current.current
          if (previous.phase !== "failed" || previous.attempt >= MAX_RETRIES) return
          // This explicit action owns its focus handoff. Safari touch activation
          // may never focus the button; the stable target also protects the
          // recovery from background enhancement while the control is disabled.
          focusTarget.current?.focus({ preventScroll: true })
          update({ attempt: previous.attempt + 1, phase: "retrying" })
        }}>Retry illustration</button>}
    </div>
    {deferred && <noscript>
      <style>{".facility-preview-poster--deferred{display:none!important}"}</style>
      <picture className="facility-poster">
        <source media="(max-width: 639px)" srcSet={mobileUrl} />
        <img src={desktopUrl} width={1360} height={800} alt={alt} loading="lazy" decoding="async" />
      </picture>
    </noscript>}
  </div>
}
