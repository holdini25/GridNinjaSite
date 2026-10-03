"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createCinematicPlayback, INITIAL_CINEMATIC_STATE } from "@/lib/cinematic/playback"
import type { CinematicRelease } from "@/types/cinematic"
import { FacilityCinematicPoster } from "./facility-cinematic-poster"

export function FacilityHeroVideo({ release, children }: { release: CinematicRelease; children?: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const controller = useRef<ReturnType<typeof createCinematicPlayback> | null>(null)
  const [state, setState] = useState(INITIAL_CINEMATIC_STATE)
  useEffect(() => {
    const stage = root.current?.querySelector<HTMLElement>(".cinematic-stage")
    const poster = stage?.querySelector<HTMLImageElement>("img")
    if (!stage || !poster || !video.current) return
    const playback = createCinematicPlayback({ stage, poster, video: video.current, release, onState: setState })
    controller.current = playback
    return () => { controller.current = null; playback.dispose() }
  }, [release])
  const running = state.phase === "playing" || state.phase === "loading"
  const status = state.reason === "poster-unavailable" ? "Facility illustration unavailable. Select Retry to try again."
    : state.phase === "error" ? "Animation unavailable. The illustration remains visible."
    : state.phase === "blocked" ? "Select Play to view the animation."
    : state.reason === "reduced-motion" ? "Still image · reduced motion"
    : state.reason === "save-data" ? "Still image · data saving"
    : state.phase === "paused" ? "Animation paused"
    : state.phase === "loading" ? "Preparing animation…" : "Illustrative motion · no live telemetry"
  return <div ref={root} className="cinematic-player" data-testid="cinematic-facility" data-release={release.release} data-mode={release.mode} data-state={state.phase} data-reason={state.reason} data-frame-ready={state.frameReady} data-frame-evidence={state.frameEvidence} data-poster-ready-ms={state.posterReadyMs ?? undefined} data-first-frame-ms={state.firstFrameMs ?? undefined} data-rendition={state.rendition ?? "unassigned"}>
    <div className="cinematic-stage">
      <FacilityCinematicPoster release={release} rendition={state.rendition} />
      {children}
      <video ref={video} className="cinematic-video" aria-hidden="true" tabIndex={-1} muted playsInline loop preload="none" disablePictureInPicture style={{ opacity: state.frameReady ? 1 : 0 }} />
    </div>
    {(release.mode !== "poster" || state.phase === "error") && state.reason !== "initial" && <div className="cinematic-controls">
      <button type="button" className="cinematic-toggle" onClick={() => state.phase === "error" ? controller.current?.retry() : running ? controller.current?.pause() : controller.current?.play()} aria-label={state.reason === "poster-unavailable" ? "Retry facility illustration" : state.phase === "error" ? "Retry facility animation" : running ? "Pause facility animation" : "Play facility animation"}>{state.phase === "error" ? "Retry" : running ? "Pause" : "Play"}</button>
      <span className="cinematic-status" role={state.phase === "error" || state.phase === "blocked" ? "status" : undefined}>{status}</span>
    </div>}
  </div>
}
