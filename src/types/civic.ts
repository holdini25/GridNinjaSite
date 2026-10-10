export type CivicComposition = "landscape" | "portrait"
export interface CivicVariant { src: string; width: number; height: number; bytes: number; sha256: string }
export interface CivicImage { src: string; srcSet: string; width: number; height: number; variants: CivicVariant[] }
export interface CivicRelease { release: string; environment: "synthetic"; images: Record<CivicComposition, CivicImage> }
