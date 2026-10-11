import type { EditorialSubject } from "@/types/editorial"

type ArchitecturalSlot<S extends EditorialSubject> = {
  kind: "architectural"
  subject: S
  caption: string
  accessibility: "decorative-with-html-context"
  aspectRatio: "8 / 5"
  crop: "whole-subject"
}

/** Slot-specific subjects prevent an accidental shared-image fallback. */
type HomepageArtwork = {
  "ai-cloud": ArchitecturalSlot<"ai-workload">
  colocation: ArchitecturalSlot<"colocation-hall">
  brief: { kind: "publication-excerpt"; publicationId: "demo-01-b"; version: "1.0.0" }
  proof: { kind: "authority-diagram"; caption: string }
  platform: ArchitecturalSlot<"platform-systems">
}

export const homepageArtwork = {
  "ai-cloud": { kind: "architectural", subject: "ai-workload", caption: "Illustrative compute infrastructure", accessibility: "decorative-with-html-context", aspectRatio: "8 / 5", crop: "whole-subject" },
  colocation: { kind: "architectural", subject: "colocation-hall", caption: "Illustrative tenant-capacity hall", accessibility: "decorative-with-html-context", aspectRatio: "8 / 5", crop: "whole-subject" },
  brief: { kind: "publication-excerpt", publicationId: "demo-01-b", version: "1.0.0" },
  proof: { kind: "authority-diagram", caption: "Review precedes operating permission" },
  platform: { kind: "architectural", subject: "platform-systems", caption: "Illustrative facility · declared boundary", accessibility: "decorative-with-html-context", aspectRatio: "8 / 5", crop: "whole-subject" },
} as const satisfies HomepageArtwork
