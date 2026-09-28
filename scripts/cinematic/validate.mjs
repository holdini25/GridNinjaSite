import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import sharp from "sharp"
import { readCinematicDirectory, readCinematicRegistry, selectedCinematicIdentity } from "../../src/lib/cinematic/files.mjs"
import { inspectMp4 } from "../../src/lib/cinematic/mp4.mjs"

export async function validateCinematicDirectory(directory, release, digest) {
  const result = await readCinematicDirectory(directory, release, digest)
  for (const [kind, view] of Object.entries(result.manifest.renditions)) {
    const movie = inspectMp4(result.artifacts.get(view.video))
    assert.deepEqual(movie.encoding, result.manifest.encoding, `${kind}: encoded media declaration mismatch`)
    assert.equal(movie.width, view.width, `${kind}: video width mismatch`)
    assert.equal(movie.height, view.height, `${kind}: video height mismatch`)
    assert.equal(movie.frameCount, view.frameCount, `${kind}: frame count mismatch`)
    assert(Math.abs(movie.durationSeconds - view.durationSeconds) < .001, `${kind}: duration mismatch`)
    assert(Math.abs(movie.fps - view.fps) < .001, `${kind}: frame rate mismatch`)
    const poster = await sharp(result.artifacts.get(view.poster)).metadata()
    assert(poster.format === "webp" && poster.width === view.width && poster.height === view.height, `${kind}: poster and video dimensions differ`)
  }
  for (const item of result.manifest.files.filter(file => file.file.startsWith("still-"))) {
    const metadata = await sharp(result.artifacts.get(item.file)).metadata()
    assert(metadata.format === "webp" && metadata.width === item.width && metadata.height === item.height, "Supporting still metadata mismatch")
  }
  return result
}

export async function validateCinematic({ root = process.cwd(), env = process.env, build = false } = {}) {
  const registry = await readCinematicRegistry(root)
  const selected = await selectedCinematicIdentity({ root, env })
  const approved = new Set(["src/content/cinematic-releases/registry.json"])
  for (const entry of registry.filter(item => item.status === "available")) {
    const base = `src/content/cinematic-releases/${entry.release}`
    const result = await validateCinematicDirectory(join(root, base), entry.release, entry.manifestSha256)
    for (const file of ["manifest.json", ...result.manifest.files.map(item => item.file)]) approved.add(`${base}/${file}`)
  }
  if (selected.preview) await validateCinematicDirectory(join(root, "build/cinematic", selected.selectedRelease, "release"), selected.selectedRelease, selected.manifestSha256)
  if (build) {
    const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(item => item.isDirectory() ? walk(join(dir, item.name)) : [join(dir, item.name)]))).flat()
    const publicFiles = await walk(join(root, "public"))
    assert(!publicFiles.some(file => /\/cinematic\//.test(file)), "Cinematic release gating cannot be bypassed through public/")
    const traces = (await walk(join(root, ".next/server"))).filter(file => file.endsWith(".nft.json"))
    let routeFound = false
    for (const trace of traces) {
      const files = JSON.parse(await readFile(trace, "utf8")).files.map(file => relative(root, resolve(trace, "..", file)))
      for (const file of files) {
        assert(!file.startsWith("build/cinematic/") && !file.startsWith("assets-source/"), `Private cinematic asset traced: ${file}`)
        if (file.startsWith("src/content/cinematic-releases/")) assert(approved.has(file), `Unregistered cinematic asset traced: ${file}`)
      }
      if (trace.includes("/assets/cinematic/")) {
        routeFound = true
        for (const file of approved) assert(files.includes(file), `Cinematic deployment missing ${file}`)
      }
    }
    assert(routeFound, "Cinematic asset handler trace missing")
  }
  return selected
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv.slice(2).every(arg => arg === "--build"), "Usage: validate.mjs [--build]")
  const selected = await validateCinematic({ build: process.argv.includes("--build") })
  console.log(JSON.stringify({ cinematicValidation: "pass", ...selected }))
}
