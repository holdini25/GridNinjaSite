import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { execFileSync } from "node:child_process"
import sharp from "sharp"
import { readFacilityRegistry, validateSelectedFacility } from "./build-selection.mjs"

import { overviewFiles as expectedFiles, expectedReleaseFiles, manifestSchema, registrySchema, releasePattern } from "../../src/lib/facility/manifest-schema.mjs"
export { expectedFiles, expectedReleaseFiles, manifestSchema, registrySchema, releasePattern }
export const hash = bytes => createHash("sha256").update(bytes).digest("hex")

/** A saved specimen master can otherwise retain an older packed image with the
 * same name. V5 derivatives share one baked atlas set, including exact bytes. */
function embeddedSurfaceHashes(bytes) {
  const jsonLength = bytes.readUInt32LE(12)
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  const binaryStart = 28 + jsonLength
  const roles = new Map()
  for (const material of document.materials) {
    for (const [role, reference] of [["normal", material.normalTexture], ["orm", material.pbrMetallicRoughness?.metallicRoughnessTexture], ["color", material.pbrMetallicRoughness?.baseColorTexture]]) {
      if (!reference) continue
      const image = document.images[document.textures[reference.index].source]
      const view = document.bufferViews[image.bufferView]
      const start = binaryStart + (view.byteOffset ?? 0)
      const digest = hash(bytes.subarray(start, start + view.byteLength))
      if (roles.has(role)) assert.equal(roles.get(role), digest, `Multiple ${role} atlases in one asset`)
      roles.set(role, digest)
    }
  }
  assert.deepEqual([...roles.keys()].sort(), ["color", "normal", "orm"], "V5 must contain its complete shared atlas set")
  return Object.fromEntries([...roles].sort(([a], [b]) => a.localeCompare(b)))
}

/** Shared by staging, freezing and registered-release validation. */
export async function validateFacilityDirectory(directory, release, { manifestDigest, reportPath } = {}) {
  assert.match(release, releasePattern, "Invalid facility release ID")
  const manifestBytes = await readFile(join(directory, "manifest.json"))
  if (manifestDigest) assert.equal(hash(manifestBytes), manifestDigest, "Unapproved manifest bytes")
  const manifest = manifestSchema.parse(JSON.parse(manifestBytes))
  assert.equal(manifest.release, release, "Manifest release identity mismatch")
  let surfaceHashes
  assert.deepEqual((await readdir(directory)).sort(), [...expectedReleaseFiles(manifest), "manifest.json"].sort(), "Release must contain only complete allowlisted artifacts")
  for (const file of manifest.files) {
    const bytes = await readFile(join(directory, file.file))
    assert.equal(bytes.length, file.bytes, `${file.file} length mismatch`)
    assert.equal(hash(bytes), file.sha256, `${file.file} digest mismatch`)
    if (file.file.endsWith(".webp")) {
      const metadata = await sharp(bytes).metadata()
      assert.equal(metadata.format, "webp", "Posters must be actual WebP files")
      assert.deepEqual([metadata.width, metadata.height], file.file === "poster-mobile.webp" ? [680, manifest.profile.inspection ? 510 : 400] : [1360, 800], "Poster camera aspect/dimensions mismatch")
    } else {
      if (file.file === "facility.glb" && manifest.equipmentIndex) {
        const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
        const root = document.nodes.find(node => node.extras?.gnId === "GN_EXPORT")
        const topology = typeof root?.extras?.gnTopology === "string" ? JSON.parse(root.extras.gnTopology) : root?.extras?.gnTopology
        assert(topology?.equipment, "Public equipment index requires authored topology")
        assert.deepEqual(manifest.equipmentIndex.equipment, topology.equipment.map(({ id, label, system, role, bounds }) => ({ id, label, system, role, bounds })), "Public equipment index differs from authored topology")
      }
      execFileSync(process.execPath, ["assets-source/facility/validate.mjs", join(directory, file.file), file.file === "facility.glb" ? (reportPath ?? resolve("build/facility", release, "validation.json")) : resolve("build/facility", release, file.file.replace(".glb", "-validation.json"))], { stdio: "pipe" })
      if (manifest.profile.surfaces) {
        const hashes = embeddedSurfaceHashes(bytes)
        if (surfaceHashes) assert.deepEqual(hashes, surfaceHashes, `${file.file} contains stale or divergent surface atlases`)
        else surfaceHashes = hashes
      }
    }
  }
  return { manifest, manifestBytes }
}

async function main() {
  const args = process.argv.slice(2)
  assert(args.every(arg => arg === "--build") && args.length <= 1, "Usage: validate-release.mjs [--build]")
  const root = process.cwd()
  const registry = await readFacilityRegistry(root)
  await validateSelectedFacility({ root, registry })
  const approved = new Set(["src/content/facility-releases/registry.json"])
  for (const entry of registry.filter(entry => entry.status === "available")) {
    const base = `src/content/facility-releases/${entry.release}`
    const { manifest } = await validateFacilityDirectory(join(root, base), entry.release, { manifestDigest: entry.manifestSha256 })
    for (const file of ["manifest.json", ...expectedReleaseFiles(manifest)]) approved.add(`${base}/${file}`)
  }
  if (args.includes("--build")) {
    const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(item => item.isDirectory() ? walk(join(dir, item.name)) : [join(dir, item.name)]))).flat()
    const publicFiles = await walk(join(root, "public"))
    assert(!publicFiles.some(file => /\/facility\//.test(file)), "Facility release gating must not be bypassed through public/")
    const traces = (await walk(join(root, ".next/server"))).filter(file => file.endsWith(".nft.json"))
    let foundRoute = false
    for (const trace of traces) {
      const files = JSON.parse(await readFile(trace, "utf8")).files.map(file => relative(root, resolve(trace, "..", file)))
      for (const file of files) {
        assert(!file.startsWith("assets-source/") && !file.startsWith("build/facility/"), `Private asset traced: ${file}`)
        if (file.startsWith("src/content/facility-releases/")) assert(approved.has(file), `Unregistered visual traced: ${file}`)
      }
      if (trace.includes("/assets/facility/")) {
        foundRoute = true
        for (const file of approved) if (!file.endsWith("registry.json")) assert(files.includes(file), `Visual deployment missing ${file}`)
      }
    }
    assert(foundRoute, "Facility asset handler trace missing")
  }
  console.log(`Facility release validation passed (${registry.filter(entry => entry.status === "available").length} available releases).`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
