import { createHash } from "node:crypto"
import { lstat, readFile, readdir, realpath } from "node:fs/promises"
import { join, resolve } from "node:path"
import { manifestSchema, registrySchema, releasePattern } from "./manifest-schema.mjs"
import { selectedCinematicReleaseId } from "./selection.mjs"

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex")
export const localPreviewEnabled = (env = process.env) => env.CINEMATIC_PREVIEW === "1" && env.VERCEL !== "1"

/** A complete bundle is checked before serving any member, including a range. */
export async function readCinematicDirectory(directory, release, manifestDigest) {
  // Keep the caller's statically bounded directory in file reads. Using the
  // return value of realpath as the read root loses that boundary during tracing.
  const root = resolve(directory)
  const canonicalRoot = await realpath(root)
  // This generic verifier also serves local authoring directories. Production
  // bundle membership is enumerated from the approved registry in next.config;
  // tracing this generic parameter would include unrelated candidate manifests.
  const raw = await readFile(join(/* turbopackIgnore: true */ root, "manifest.json"))
  if (manifestDigest && sha256(raw) !== manifestDigest) throw new Error("Cinematic manifest integrity failure")
  const manifest = manifestSchema.parse(JSON.parse(raw.toString("utf8")))
  if (manifest.release !== release) throw new Error("Cinematic release identity mismatch")
  const expected = ["manifest.json", ...manifest.files.map(file => file.file)].sort()
  if (JSON.stringify((await readdir(root)).sort()) !== JSON.stringify(expected)) throw new Error("Unexpected cinematic file set")
  const artifacts = new Map()
  for (const name of expected) {
    const path = join(/* turbopackIgnore: true */ root, name)
    if (!(await lstat(path)).isFile() || await realpath(path) !== join(canonicalRoot, name)) throw new Error("Cinematic artifacts must be regular files")
    if (name === "manifest.json") continue
    const descriptor = manifest.files.find(file => file.file === name)
    const bytes = await readFile(path)
    if (bytes.length !== descriptor.bytes || sha256(bytes) !== descriptor.sha256) throw new Error("Cinematic asset integrity failure")
    artifacts.set(name, bytes)
  }
  return { manifest, manifestBytes: raw, artifacts }
}

export async function readCinematicRegistry(root = process.cwd()) {
  return registrySchema.parse(JSON.parse(await readFile(join(root, "src/content/cinematic-releases/registry.json"), "utf8")))
}

/** @param {{root?: string, env?: Record<string, string | undefined>}} options */
export async function selectedCinematicIdentity({ root = process.cwd(), env = process.env } = {}) {
  if (env.CINEMATIC_PREVIEW === "1" && env.VERCEL === "1") throw new Error("Private cinematic previews cannot be deployed to Vercel")
  const release = selectedCinematicReleaseId(env)
  const mode = env.CINEMATIC_MODE ?? "auto"
  if (!["auto", "poster"].includes(mode)) throw new Error("Invalid CINEMATIC_MODE")
  if (!release) return { selectedRelease: null, mode, preview: false, manifestSha256: null }
  if (!releasePattern.test(release)) throw new Error("Invalid selected cinematic release")
  const entry = (await readCinematicRegistry(root)).find(item => item.release === release)
  // Preview applies only to a new identity. Registered status and immutable
  // registered bytes remain authoritative even on a local preview server.
  const preview = localPreviewEnabled(env) && !entry
  if (!preview && entry?.status !== "available") throw new Error("Selected cinematic release is not available")
  const directory = preview
    ? join(root, "build/cinematic", release, "release")
    : join(root, "src/content/cinematic-releases", release)
  const result = await readCinematicDirectory(directory, release, preview ? undefined : entry.manifestSha256)
  return { selectedRelease: release, mode, preview, manifestSha256: sha256(result.manifestBytes) }
}
