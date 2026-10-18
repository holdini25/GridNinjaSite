import "server-only"
import { join } from "node:path"
import { allAllowedCivicFiles, compositions, releasePattern } from "./manifest-schema.mjs"
import { readCivicDirectory, readCivicRegistry } from "./files.mjs"
import { assetResponse } from "@/lib/cinematic/http.mjs"
import type { CivicComposition, CivicImage, CivicRelease, CivicSource } from "@/types/civic"

export async function readCivicRelease(id: string) {
  if (!releasePattern.test(id)) return { status: 404 as const }
  const entry = (await readCivicRegistry()).find(item => item.release === id)
  if (!entry || entry.status === "withheld") return { status: 404 as const }
  if (entry.status === "withdrawn") return { status: 410 as const }
  const result = await readCivicDirectory(join(process.cwd(), "src/content/civic-releases", id), id, entry.manifestSha256)
  const images = Object.fromEntries(compositions.map(composition => {
    const source = (mimeType: "image/webp" | "image/avif"): CivicSource | undefined => {
      const variants = result.manifest.files.filter(file => file.composition === composition && file.mimeType === mimeType).sort((a, b) => a.width - b.width)
        .map(file => ({ src: `/assets/civic/${id}/${file.file}`, width: file.width, height: file.height, bytes: file.bytes, sha256: file.sha256 }))
      if (!variants.length) return undefined
      const defaultVariant = variants.find(item => item.width === (composition === "landscape" ? 960 : 640))!
      return { src: defaultVariant.src, srcSet: variants.map(item => `${item.src} ${item.width}w`).join(", "),
        width: defaultVariant.width, height: defaultVariant.height, variants }
    }
    const avif = source("image/avif")
    const image: CivicImage = { ...source("image/webp")!, ...(avif ? { avif } : {}) }
    return [composition, image]
  })) as Record<CivicComposition, CivicImage>
  const release: CivicRelease = { release: id, environment: "synthetic", images }
  return { status: 200 as const, ...result, release }
}

export async function getCivicRelease(id = "civic-v1"): Promise<CivicRelease | null> {
  try { const result = await readCivicRelease(id); return result.status === 200 ? result.release : null } catch { return null }
}

export async function civicAssetResponse(id: string, file: string, request: Request) {
  const failure = (status: number) => new Response(request.method === "HEAD" ? null : "Civic illustration unavailable", {
    status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" },
  })
  if (!(allAllowedCivicFiles as readonly string[]).includes(file)) return failure(404)
  try {
    const result = await readCivicRelease(id)
    if (result.status !== 200) return failure(result.status)
    const descriptor = result.manifest.files.find(item => item.file === file)
    if (!descriptor) return failure(404)
    return assetResponse(result.artifacts.get(file)!, descriptor, request)
  } catch { return failure(503) }
}
