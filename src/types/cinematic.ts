export interface CinematicAsset { url: string; bytes: number; sha256: string }
export interface CinematicRendition {
  width: number
  height: number
  poster: CinematicAsset & { width: number; height: number }
  video: CinematicAsset & { mimeType: "video/mp4"; width: number; height: number; durationSeconds: number; fps: number }
}
export interface CinematicRelease {
  release: string
  environment: "synthetic"
  mode: "auto" | "poster"
  renditions: { desktop: CinematicRendition; mobile: CinematicRendition }
  stills?: Partial<Record<"construction" | "cooling", CinematicAsset & { width: number; height: number }>>
}
