import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { basename, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import sharp from "sharp"
import { readEditorialDirectory, readEditorialRegistry } from "../../src/lib/editorial/files.mjs"
import { allowedFiles } from "../../src/lib/editorial/manifest-schema.mjs"

export async function validateEditorialDirectory(directory, release, digest) {
  const result = await readEditorialDirectory(directory, release, digest)
  for (const item of result.manifest.files) {
    const metadata = await sharp(result.artifacts.get(item.file)).metadata()
    assert(metadata.format === "webp" && metadata.width === item.width && metadata.height === item.height,
      `${item.file}: encoded dimensions do not match the manifest`)
    assert(!metadata.hasAlpha && !metadata.pages, `${item.file}: static opaque editorial image required`)
  }
  return result
}

export async function validateEditorial({ root = process.cwd(), build = false } = {}) {
  const registry = await readEditorialRegistry(root)
  const approved = new Set(["src/content/editorial-releases/registry.json"])
  for (const entry of registry.filter(item => item.status === "available")) {
    const base = `src/content/editorial-releases/${entry.release}`
    const result = await validateEditorialDirectory(join(root, base), entry.release, entry.manifestSha256)
    for (const file of ["manifest.json", ...result.manifest.files.map(item => item.file)]) approved.add(`${base}/${file}`)
  }
  if (build) {
    const walk = async directory => (await Promise.all((await readdir(directory, { withFileTypes: true })).map(item =>
      item.isDirectory() ? walk(join(directory, item.name)) : [join(directory, item.name)]))).flat()
    for (const file of await walk(join(root, "public"))) {
      assert(!file.includes("/editorial/") && !allowedFiles.includes(basename(file)), "Editorial registry cannot be bypassed through public/")
    }
    const traces = (await walk(join(root, ".next/server"))).filter(file => file.endsWith(".nft.json"))
    let routeFound = false
    for (const trace of traces) {
      const files = JSON.parse(await readFile(trace, "utf8")).files.map(file => relative(root, resolve(trace, "..", file)))
      for (const file of files) {
        assert(!file.startsWith("build/cinematic/") && !file.startsWith("assets-source/"), `Private editorial source traced: ${file}`)
        if (file.startsWith("src/content/editorial-releases/")) assert(approved.has(file), `Unregistered editorial asset traced: ${file}`)
      }
      if (trace.includes("/assets/editorial/")) {
        routeFound = true
        for (const file of approved) assert(files.includes(file), `Editorial deployment missing ${file}`)
      }
    }
    assert(routeFound, "Editorial asset handler trace missing")
  }
  return { availableReleases: registry.filter(item => item.status === "available").map(item => item.release), approvedFileCount: approved.size }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv.slice(2).every(arg => arg === "--build"), "Usage: validate.mjs [--build]")
  console.log(JSON.stringify({ editorialValidation: "pass", ...await validateEditorial({ build: process.argv.includes("--build") }) }))
}
