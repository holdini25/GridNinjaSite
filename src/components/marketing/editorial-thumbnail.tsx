/* eslint-disable @next/next/no-img-element -- Registry-pinned responsive WebP assets have intrinsic dimensions and no image runtime. */
import { homepageArtwork } from "@/content/editorial-artwork"
import type { EditorialRelease } from "@/types/editorial"

type Slot = "ai-cloud" | "colocation" | "platform"

export function EditorialThumbnail({ slot, release }: { slot: Slot; release: EditorialRelease | null }) {
  const assignment = homepageArtwork[slot]
  const image = release?.images[assignment.subject]
  return <figure className="gn-editorial-thumbnail" data-artwork-slot={slot} data-artwork-subject={assignment.subject}>
    {image ? <img src={image.src} srcSet={image.srcSet} sizes={slot === "platform" ? "(min-width: 1120px) 400px, (min-width: 820px) 40vw, (min-width: 640px) 720px, calc(100vw - 40px)" : "(min-width: 820px) 50vw, (min-width: 640px) 720px, calc(100vw - 40px)"} width={image.width} height={image.height} alt="" loading="lazy" decoding="async" /> : <div className="gn-editorial-unavailable">Illustration unavailable</div>}
    <figcaption>{assignment.caption}</figcaption>
  </figure>
}
