import { act, cleanup, render } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FacilityHeroVideo } from "@/components/marketing/facility-hero-video"
import { FacilityCinematicPoster } from "@/components/marketing/facility-cinematic-poster"
import { createCinematicPlayback, INITIAL_CINEMATIC_STATE, type CinematicState } from "@/lib/cinematic/playback"
import type { CinematicRelease, CinematicRendition } from "@/types/cinematic"

vi.mock("@/lib/cinematic/playback", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/cinematic/playback")>(), createCinematicPlayback: vi.fn() }))
const rendition = (kind: string, width: number, height: number): CinematicRendition => ({
  width, height,
  poster: { url: `/poster-${kind}.webp`, width, height, bytes: 100, sha256: "a".repeat(64) },
  video: { url: `/${kind}.mp4`, mimeType: "video/mp4", width, height, bytes: 1000, sha256: "b".repeat(64), durationSeconds: 10, fps: 30 },
})
const release: CinematicRelease = { release: "cinematic-v1", environment: "synthetic", mode: "auto", renditions: { desktop: rendition("desktop", 1280, 800), mobile: rendition("mobile", 768, 576) } }
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe("cinematic poster rendition ownership", () => {
  it("retains responsive complete SSR HTML without a movie source or unusable controls", () => {
    const html = renderToStaticMarkup(<FacilityHeroVideo release={release} />)
    const document = new DOMParser().parseFromString(html, "text/html")
    expect(document.querySelector("picture source")?.getAttribute("srcset")).toBe("/poster-mobile.webp")
    expect(document.querySelector("picture img")?.getAttribute("src")).toBe("/poster-desktop.webp")
    expect(document.querySelector("picture img")?.getAttribute("elementtiming")).toBe("cinematic-poster")
    expect(document.querySelector("video")?.hasAttribute("src")).toBe(false)
    expect(document.querySelector("button")).toBeNull()
    expect(html).not.toContain(".mp4")
  })
  it.each(["desktop", "mobile"] as const)("pins both picture paths and intrinsic dimensions to %s", kind => {
    const { container } = render(<FacilityCinematicPoster release={release} rendition={kind} />)
    expect(container.querySelector("source")).toHaveAttribute("srcset", release.renditions[kind].poster.url)
    expect(container.querySelector("img")).toHaveAttribute("src", release.renditions[kind].poster.url)
    expect(container.querySelector("img")).toHaveAttribute("width", String(release.renditions[kind].width))
    expect(container.querySelector("img")).toHaveAttribute("height", String(release.renditions[kind].height))
  })
  it("keeps the decoder's exact image node and selected poster across presented and fallback states", () => {
    let publish!: (state: CinematicState) => void
    const controller = { play: vi.fn(), pause: vi.fn(), retry: vi.fn(), dispose: vi.fn() }
    vi.mocked(createCinematicPlayback).mockImplementation(({ onState }) => { publish = onState; return controller })
    const { container } = render(<FacilityHeroVideo release={release}><span>Authored system labels</span></FacilityHeroVideo>)
    const image = container.querySelector("img"), stage = container.querySelector(".cinematic-player")
    expect(vi.mocked(createCinematicPlayback).mock.calls[0][0].poster).toBe(image)
    const selected: CinematicState = { ...INITIAL_CINEMATIC_STATE, rendition: "mobile", phase: "playing", reason: "ready", frameReady: true, frameEvidence: "presented-frame" }
    for (const state of [selected, { ...selected, phase: "poster" as const, reason: "reduced-motion" as const, frameReady: false }, { ...selected, phase: "error" as const, reason: "network" as const, frameReady: false }]) {
      act(() => publish(state))
      expect(container.querySelector("img")).toBe(image)
      expect(image).toHaveAttribute("src", "/poster-mobile.webp")
      expect(container.querySelector("source")).toHaveAttribute("srcset", "/poster-mobile.webp")
      expect(stage).toHaveAttribute("data-rendition", "mobile")
    }
    expect(createCinematicPlayback).toHaveBeenCalledOnce()
  })
})
