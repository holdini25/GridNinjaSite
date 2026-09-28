import "server-only"
import { join } from "node:path"
import { allowedFiles, releasePattern } from "./manifest-schema.mjs"
import { localPreviewEnabled, readCinematicDirectory, readCinematicRegistry } from "./files.mjs"
import { assetResponse } from "./http.mjs"
import { selectedCinematicReleaseId } from "./selection.mjs"
import type { CinematicRelease } from "@/types/cinematic"

export async function readCinematicRelease(id: string) {
  if (!releasePattern.test(id)) return { status: 404 as const }
  const entry = (await readCinematicRegistry()).find(item => item.release === id)
  const preview = localPreviewEnabled() && id === process.env.CINEMATIC_ASSET_RELEASE && !entry
  if (entry?.status === "withheld" || (!preview && !entry)) return { status: 404 as const }
  if (entry?.status === "withdrawn") return { status: 410 as const }
  const directory = preview
    ? join(process.cwd(), "build/cinematic", id, "release")
    : join(process.cwd(), "src/content/cinematic-releases", id)
  const result = await readCinematicDirectory(directory, id, preview ? undefined : entry?.manifestSha256)
  const asset = (name: string) => {
    const item = result.manifest.files.find(file => file.file === name)!
    return { url: `/assets/cinematic/${id}/${name}`, bytes: item.bytes, sha256: item.sha256 }
  }
  const view = (kind: "desktop" | "mobile") => {
    const item = result.manifest.renditions[kind]
    return { width: item.width, height: item.height,
      poster: { ...asset(item.poster), width: item.width, height: item.height },
      video: { ...asset(item.video), mimeType: "video/mp4" as const, width: item.width, height: item.height, durationSeconds: item.durationSeconds, fps: item.fps },
    }
  }
  const stills: CinematicRelease["stills"] = {}
  for (const kind of ["construction", "cooling"] as const) {
    const file = result.manifest.files.find(item => item.file === `still-${kind}.webp`)
    if (file?.width && file.height) stills[kind] = { ...asset(file.file), width: file.width, height: file.height }
  }
  const release: CinematicRelease = { release: id, environment: "synthetic", mode: process.env.CINEMATIC_MODE === "poster" ? "poster" : "auto", renditions: { desktop: view("desktop"), mobile: view("mobile") }, stills }
  return { status: 200 as const, ...result, release, preview }
}

export async function getCinematicRelease(): Promise<CinematicRelease | null> {
  const id = selectedCinematicReleaseId()
  if (!id) return null
  try { const result = await readCinematicRelease(id); return result.status === 200 ? result.release : null } catch { return null }
}

export async function cinematicAssetResponse(id: string, file: string, request: Request) {
  const failure = (status: number) => new Response(request.method === "HEAD" ? null : "Cinematic illustration unavailable", { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" } })
  if (!(allowedFiles as readonly string[]).includes(file)) return failure(404)
  try {
    // A private build can preview the candidate on loopback; it cannot expose
    // unregistered candidates through an external hostname.
    const result = await readCinematicRelease(id)
    if (result.status !== 200) return failure(result.status)
    if (result.preview && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)) return failure(404)
    const descriptor = result.manifest.files.find(item => item.file === file)
    if (!descriptor) return failure(404)
    return assetResponse(result.artifacts.get(file)!, descriptor, request)
  } catch { return failure(503) }
}
