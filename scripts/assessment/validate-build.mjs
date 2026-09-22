import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
const root = process.cwd()
const registry = JSON.parse(await readFile(join(root, "src/content/assessment-publications/registry.json"), "utf8"))
const names = ["snapshot.json", "narrative.json", "brief.html", "brief.pdf", "manifest.json"]
const approved = new Set(["src/content/assessment-publications/registry.json", ...registry.filter(entry => entry.status === "available").flatMap(entry => names.map(file => `src/content/assessment-publications/${entry.publicationId}/${entry.version}/${file}`))])
async function files(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(async entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat()
}
for (const file of await files(join(root, "public"))) assert(!file.includes("/evidence/releases/"), "Legacy candidate evidence must not be public")
const traces = (await files(join(root, ".next/server"))).filter(file => file.endsWith(".nft.json"))
let publicationTraces = 0
for (const trace of traces) {
  const traced = JSON.parse(await readFile(trace, "utf8")).files.map(file => relative(root, resolve(trace, "..", file)))
  for (const file of traced) {
    assert(!file.startsWith("evidence-candidates/"), `Private candidate traced: ${file}`)
    if (file.startsWith("src/content/assessment-publications/")) assert(approved.has(file), `Unapproved publication traced: ${file}`)
  }
  if (trace.includes("/evidence/assessments/") || trace.includes("/downloads/assessment/")) {
    publicationTraces++
    for (const file of approved) if (!file.endsWith("/registry.json")) assert(traced.includes(file), `Deployment is missing ${file}`)
  }
}
assert.equal(publicationTraces, 2, "Both publication handlers must have deployable traces")
console.log("Publication deployment traces passed: exact registered files present; private and unapproved files excluded.")
