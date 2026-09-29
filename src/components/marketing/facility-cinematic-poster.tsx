import type { CinematicRelease } from "@/types/cinematic"

/** Keep image URLs stable when locking the selected rendition. Reassigning a
 * picture's src/srcset after a retry can re-fetch the same URL in Chromium.
 * Pin the source's media match instead, including after orientation changes. */
export function FacilityCinematicPoster({ release, rendition }: { release: CinematicRelease; rendition: "desktop" | "mobile" | null }) {
  const selected = rendition ? release.renditions[rendition].poster : null
  const image = selected ?? release.renditions.desktop.poster
  const media = rendition === "mobile" ? "all" : rendition === "desktop" ? "not all" : "(max-width: 639px)"
  return <picture className="cinematic-poster">
    <source media={media} srcSet={release.renditions.mobile.poster.url} />
    <img {...{ elementtiming: "cinematic-poster" }} src={release.renditions.desktop.poster.url} width={image.width} height={image.height} fetchPriority="high" loading="eager" decoding="async" alt="Synthetic data center facility with graphite server racks, cooling fans, electrical equipment and amber service routes." />
  </picture>
}
