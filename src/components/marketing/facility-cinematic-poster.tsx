import type { CinematicRelease } from "@/types/cinematic"

/** Responsive server HTML until acquisition selects a rendition. Keep the same
 * image node and pin its source with the movie for every later fallback. */
export function FacilityCinematicPoster({ release, rendition }: { release: CinematicRelease; rendition: "desktop" | "mobile" | null }) {
  const selected = rendition ? release.renditions[rendition].poster : null
  const image = selected ?? release.renditions.desktop.poster
  return <picture className="cinematic-poster">
    <source media="(max-width: 639px)" srcSet={selected?.url ?? release.renditions.mobile.poster.url} />
    <img {...{ elementtiming: "cinematic-poster" }} src={image.url} width={image.width} height={image.height} fetchPriority="high" loading="eager" decoding="async" alt="Synthetic data center facility with graphite server racks, cooling fans, electrical equipment and amber service routes." />
  </picture>
}
