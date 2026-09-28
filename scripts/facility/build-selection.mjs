import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, readFile, readdir, realpath } from "node:fs/promises"
import { join, resolve } from "node:path"
import { expectedReleaseFiles, manifestSchema, registrySchema, releasePattern } from "../../src/lib/facility/manifest-schema.mjs"

const modes = ["poster", "manual", "auto-desktop", "auto-adaptive"]
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const releaseDirectory = (root, release) => join(root, "src/content/facility-releases", release)

export async function readFacilityRegistry(root = process.cwd()) {
  return registrySchema.parse(JSON.parse(await readFile(join(root, "src/content/facility-releases/registry.json"), "utf8")))
}

export async function readApprovedManifest(entry, root = process.cwd()) {
  assert(entry?.status === "available", "Selected facility release is not available")
  assert.match(entry.release, releasePattern, "Invalid facility release ID")
  const bytes = await readFile(join(releaseDirectory(root, entry.release), "manifest.json"))
  assert.equal(hash(bytes), entry.manifestSha256, `Release manifest digest mismatch: ${entry.release}`)
  const manifest = manifestSchema.parse(JSON.parse(bytes))
  assert.equal(manifest.release, entry.release, "Manifest release identity mismatch")
  return { manifest, manifestBytes: bytes }
}

/** The production fallback remains in the runtime reader. Build intent is
 * stricter: a typo must not silently produce a valid page without its viewer.
 * @param {{ root?: string, env?: Record<string, string | undefined>, registry?: unknown }} options
 */
export async function validateSelectedFacility({ root = process.cwd(), env = process.env, registry } = {}) {
  root = await realpath(resolve(root))
  const source = await readFile(join(root, "src/lib/facility/releases.ts"), "utf8")
  const defaultRelease = source.match(/process\.env\.FACILITY_ASSET_RELEASE\s*\?\?\s*"([^"]+)"/)?.[1]
  assert(defaultRelease, "Cannot determine the configured facility release")
  const selectedRelease = env.FACILITY_ASSET_RELEASE ?? defaultRelease
  const mode = env.FACILITY_3D_MODE ?? "auto-adaptive"
  assert.match(selectedRelease, releasePattern, "Invalid selected facility release")
  assert(modes.includes(mode), "Invalid FACILITY_3D_MODE; use poster, manual, auto-desktop, or auto-adaptive")
  const entries = registrySchema.parse(registry ?? await readFacilityRegistry(root))
  const entry = entries.find(item => item.release === selectedRelease)
  assert(entry, `Selected facility release is not registered: ${selectedRelease}`)
  assert.equal(entry.status, "available", `Selected facility release is not available: ${selectedRelease}`)
  const { manifest, manifestBytes } = await readApprovedManifest(entry, root)
  const directory = releaseDirectory(root, selectedRelease)
  const expected = ["manifest.json", ...expectedReleaseFiles(manifest)].sort()
  assert.deepEqual((await readdir(directory)).sort(), expected, "Selected release must contain only complete allowlisted artifacts")
  for (const name of expected) {
    const path = join(directory, name)
    assert((await lstat(path)).isFile() && await realpath(path) === path, `Selected release artifact must be a regular file: ${name}`)
    if (name === "manifest.json") continue
    const file = manifest.files.find(item => item.file === name)
    const bytes = await readFile(path)
    assert.equal(bytes.length, file.bytes, `Selected artifact length mismatch: ${name}`)
    assert.equal(hash(bytes), file.sha256, `Selected artifact digest mismatch: ${name}`)
  }
  return { settings: { selectedRelease, mode }, entry, manifest, manifestBytes }
}
