import "server-only"
import { join } from "node:path"
import { allowedFiles, releasePattern, subjects } from "./manifest-schema.mjs"
import { readEditorialDirectory, readEditorialRegistry } from "./files.mjs"
import { assetResponse } from "@/lib/cinematic/http.mjs"
import type { EditorialImage, EditorialRelease, EditorialSubject } from "@/types/editorial"

export async function readEditorialRelease(id: string) {
  if (!releasePattern.test(id)) return { status: 404 as const }
  const entry = (await readEditorialRegistry()).find(item => item.release === id)
  if (!entry || entry.status === "withheld") return { status: 404 as const }
  if (entry.status === "withdrawn") return { status: 410 as const }
  const result = await readEditorialDirectory(join(process.cwd(), "src/content/editorial-releases", id), id, entry.manifestSha256)
  const images = Object.fromEntries(subjects.map(subject => {
    const variants = result.manifest.files.filter(file => file.subject === subject).sort((a, b) => a.width - b.width)
      .map(file => ({ src: `/assets/editorial/${id}/${file.file}`, width: file.width, height: file.height, bytes: file.bytes, sha256: file.sha256 }))
    const image: EditorialImage = { src: variants.find(item => item.width === 800)!.src,
      srcSet: variants.map(item => `${item.src} ${item.width}w`).join(", "), width: 800, height: 500, variants }
    return [subject, image]
  })) as Record<EditorialSubject, EditorialImage>
  const release: EditorialRelease = { release: id, environment: "synthetic", images }
  return { status: 200 as const, ...result, release }
}

export async function getEditorialRelease(): Promise<EditorialRelease | null> {
  try { const result = await readEditorialRelease("editorial-v1"); return result.status === 200 ? result.release : null } catch { return null }
}

export async function editorialAssetResponse(id: string, file: string, request: Request) {
  const failure = (status: number) => new Response(request.method === "HEAD" ? null : "Editorial illustration unavailable", {
    status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" },
  })
  if (!(allowedFiles as readonly string[]).includes(file)) return failure(404)
  try {
    const result = await readEditorialRelease(id)
    if (result.status !== 200) return failure(result.status)
    const descriptor = result.manifest.files.find(item => item.file === file)
    if (!descriptor) return failure(404)
    return assetResponse(result.artifacts.get(file)!, descriptor, request)
  } catch { return failure(503) }
}
