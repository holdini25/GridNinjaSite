import { createHash } from "node:crypto"
import { lstat, readFile, readdir, realpath } from "node:fs/promises"
import { join, resolve } from "node:path"
import { manifestSchema, registrySchema } from "./manifest-schema.mjs"

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex")

/** Verify the entire exact bundle before any member, HEAD, or conditional response. */
export async function readEditorialDirectory(directory, release, manifestDigest) {
  const root = resolve(directory), canonicalRoot = await realpath(root)
  const raw = await readFile(join(/* turbopackIgnore: true */ root, "manifest.json"))
  if (!manifestDigest || sha256(raw) !== manifestDigest) throw new Error("Editorial manifest integrity failure")
  const manifest = manifestSchema.parse(JSON.parse(raw.toString("utf8")))
  if (manifest.release !== release) throw new Error("Editorial release identity mismatch")
  const expected = ["manifest.json", ...manifest.files.map(file => file.file)].sort()
  if (JSON.stringify((await readdir(root)).sort()) !== JSON.stringify(expected)) throw new Error("Unexpected editorial file set")
  const artifacts = new Map()
  for (const name of expected) {
    const path = join(/* turbopackIgnore: true */ root, name)
    if (!(await lstat(path)).isFile() || await realpath(path) !== join(canonicalRoot, name)) throw new Error("Editorial artifacts must be regular files")
    if (name === "manifest.json") continue
    const descriptor = manifest.files.find(file => file.file === name)
    const bytes = await readFile(path)
    if (bytes.length !== descriptor.bytes || sha256(bytes) !== descriptor.sha256) throw new Error("Editorial asset integrity failure")
    artifacts.set(name, bytes)
  }
  return { manifest, manifestBytes: raw, artifacts }
}

export async function readEditorialRegistry(root = process.cwd()) {
  return registrySchema.parse(JSON.parse(await readFile(join(root, "src/content/editorial-releases/registry.json"), "utf8")))
}
