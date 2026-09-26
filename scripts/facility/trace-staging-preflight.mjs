import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"

export async function traceStagingPreflightArtifacts(nextDirectory = ".next") {
  const root = resolve(nextDirectory)
  const route = join(root, "server/app/api/internal/lead-staging-preflight/route.js")
  const tracePath = `${route}.nft.json`
  const artifacts = [join(root, "facility-build.json"), join(root, "BUILD_ID")]
  assert((await stat(route)).isFile(), "Staging preflight route was not built")
  for (const artifact of artifacts) assert((await stat(artifact)).isFile(), "Required staging attestation artifact is missing")
  const [attestation, buildId] = await Promise.all([readFile(artifacts[0], "utf8"), readFile(artifacts[1], "utf8")])
  assert.equal(JSON.parse(attestation).identity?.buildId, buildId.trim(), "Staging attestation and packaged build ID disagree")
  const trace = JSON.parse(await readFile(tracePath, "utf8"))
  assert.equal(trace.version, 1, "Unsupported Next output-trace format")
  assert(Array.isArray(trace.files) && trace.files.every(file => typeof file === "string"), "Invalid Next output trace")
  const required = artifacts.map(file => relative(dirname(tracePath), file).replaceAll("\\", "/"))
  trace.files = [...new Set([...trace.files, ...required])].sort()
  const temporary = `${tracePath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(trace)}\n`, { flag: "wx" })
    await rename(temporary, tracePath)
  } finally { await unlink(temporary).catch(() => {}) }
  const packaged = JSON.parse(await readFile(tracePath, "utf8"))
  for (const file of required) {
    assert(packaged.files.includes(file), "Required staging artifact was not retained in output trace")
    assert((await stat(resolve(dirname(tracePath), file))).isFile(), "Traced staging artifact is unavailable")
  }
  return { schemaVersion: "staging-preflight-trace.v1", result: "passed", trace: tracePath, files: required,
    hostedPackaging: "not-run: verify the actual hosted preflight before submitting any staging inquiry" }
}
