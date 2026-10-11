export type EditorialSubject = "ai-workload" | "colocation-hall" | "platform-systems"
export interface EditorialVariant { src: string; width: number; height: number; bytes: number; sha256: string }
export interface EditorialImage { src: string; srcSet: string; width: 800; height: 500; variants: EditorialVariant[] }
export interface EditorialRelease { release: string; environment: "synthetic"; images: Record<EditorialSubject, EditorialImage> }
