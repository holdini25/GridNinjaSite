export type CivicComposition = "landscape" | "portrait"
export interface CivicVariant { src: string; width: number; height: number; bytes: number; sha256: string }
export interface CivicSource { src: string; srcSet: string; width: number; height: number; variants: CivicVariant[] }
/** Existing fields remain the WebP fallback for v1 and v2. */
export interface CivicImage extends CivicSource { avif?: CivicSource }
export interface CivicRelease { release: string; environment: "synthetic"; images: Record<CivicComposition, CivicImage> }
