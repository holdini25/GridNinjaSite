import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { basename, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import sharp from "sharp"
import { readCivicDirectory, readCivicRegistry } from "../../src/lib/civic/files.mjs"
import { allAllowedCivicFiles } from "../../src/lib/civic/manifest-schema.mjs"

export async function validateCivicDirectory(directory, release, digest) {
  const result = await readCivicDirectory(directory, release, digest)
  for (const item of result.manifest.files) {
    const metadata = await sharp(result.artifacts.get(item.file)).metadata()
    const formatMatches = item.mimeType === "image/webp" ? metadata.format === "webp" : metadata.format === "heif" && metadata.compression === "av1"
    assert(formatMatches && metadata.width === item.width && metadata.height === item.height,
      `${item.file}: encoded dimensions do not match the manifest`)
    const staticImage = item.mimeType === "image/avif" ? (metadata.pages ?? 1) === 1 : !metadata.pages
    assert(!metadata.hasAlpha && staticImage, `${item.file}: static opaque civic image required`)
  }
  return result
}

export async function validateCivic({ root = process.cwd(), build = false } = {}) {
  const registry = await readCivicRegistry(root)
  const approved = new Set(["src/content/civic-releases/registry.json"])
  for (const entry of registry.filter(item => item.status === "available")) {
    const base = `src/content/civic-releases/${entry.release}`
    const result = await validateCivicDirectory(join(root, base), entry.release, entry.manifestSha256)
    for (const file of ["manifest.json", ...result.manifest.files.map(item => item.file)]) approved.add(`${base}/${file}`)
  }
  if (build) {
    const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(item =>
      item.isDirectory() ? walk(join(directory, item.name)) : [join(directory, item.name)]))).flat()
    const publicRoot = join(root, "public")
    for (const file of await walk(publicRoot)) {
      const directories = relative(publicRoot, file).split(sep).slice(0, -1)
      assert(!directories.includes("civic") && !allAllowedCivicFiles.includes(basename(file)), "Civic registry cannot be bypassed through public/")
    }
    const traces = (await walk(join(root, ".next/server"))).filter(file => file.endsWith(".nft.json"))
    let routeFound = false
    for (const trace of traces) {
      const files = JSON.parse(await readFile(trace, "utf8")).files.map(file => relative(root, resolve(trace, "..", file)))
      for (const file of files) {
        assert(!file.startsWith("build/civic/") && !file.startsWith("build/civic-hybrid/") && !file.startsWith("build/cinematic/") && !file.startsWith("assets-source/"), `Private civic source traced: ${file}`)
        if (file.startsWith("src/content/civic-releases/")) assert(approved.has(file), `Unregistered civic asset traced: ${file}`)
      }
      if (trace.includes("/assets/civic/")) {
        routeFound = true
        for (const file of approved) assert(files.includes(file), `Civic deployment missing ${file}`)
      }
    }
    assert(routeFound, "Civic asset handler trace missing")
  }
  return { availableReleases: registry.filter(item => item.status === "available").map(item => item.release), approvedFileCount: approved.size }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv.slice(2).every(arg => arg === "--build"), "Usage: validate.mjs [--build]")
  console.log(JSON.stringify({ civicValidation: "pass", ...await validateCivic({ build: process.argv.includes("--build") }) }))
}
