import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { performanceMatrix } from "./lighthouse-matrix.mjs"

export const HOSTED_SCHEMA = "gridninja-hosted-build.v1"
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const marker = "GRIDNINJA_HOSTED_ATTESTATION_V1"

export function hostedOrigin(value) {
  const url = new URL(value)
  assert(url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === "/", "Hosted origin must be a bare HTTPS origin")
  assert(url.hostname.endsWith(".vercel.app"), "Use the immutable Vercel deployment origin")
  return url.origin
}

async function filesAt(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesAt(join(directory, entry.name)) : [join(directory, entry.name)]))).flat().sort()
}

/** Produced inside the actual Vercel build, never synthesized from local .next. */
export async function createHostedAttestation(identity, harnessRevision, env = process.env) {
  assert(env.VERCEL === "1" && env.VERCEL_URL && ["preview", "production"].includes(env.VERCEL_ENV), "Hosted attestation requires the actual Vercel build environment")
  const origin = hostedOrigin(`https://${env.VERCEL_URL}`)
  const resources = []
  for (const route of performanceMatrix("premium-civic").routes) {
    // Demo reads searchParams and is rendered by Vercel at request time. Never
    // mislabel a locally invented HTML body as an emitted hosted build asset.
    if (route === "/demo") continue
    const publication = /^\/evidence\/assessments\/([a-z0-9-]+)\/([a-z0-9.]+)$/.exec(route)
    const file = publication ? `src/content/assessment-publications/${publication[1]}/${publication[2]}/brief.html` : `.next/server/app/${route === "/" ? "index" : route.slice(1)}.html`
    const bytes = await readFile(file)
    if (!publication) assert(bytes.includes(Buffer.from(identity.buildId)), `Build ID absent from generated HTML: ${route}`)
    resources.push({ path: route, kind: "html", sha256: hash(bytes), bytes: bytes.length })
  }
  for (const file of await filesAt(".next/static")) {
    const bytes = await readFile(file)
    resources.push({ path: `/_next/${file.slice(".next/".length)}`, kind: "asset", sha256: hash(bytes), bytes: bytes.length })
  }
  const demoAssets = resources.filter(resource => /^\/_next\/static\/chunks\/app\/\(marketing\)\/demo\/page-[a-f0-9]+\.js$/.test(resource.path))
  assert.equal(demoAssets.length, 1, "Missing unique emitted demo page chunk")
  resources.push({ path: "/demo", kind: "html", verification: "dynamic-build-id-and-asset", requiredAsset: demoAssets[0].path, sha256: null, bytes: null })
  return { schemaVersion: HOSTED_SCHEMA, recordedAt: new Date().toISOString(), origin, environment: env.VERCEL_ENV, identity, harnessRevision, resources }
}

/** Small numbered lines survive private build-log line limits. No environment
 * values, headers, credentials, source bodies or lead data enter the log. */
export function hostedAttestationLogLines(attestation) {
  const bytes = Buffer.from(JSON.stringify(attestation))
  const encoded = bytes.toString("base64"), count = Math.ceil(encoded.length / 1800), digest = hash(bytes)
  return Array.from({ length: count }, (_, index) => `${marker} ${index + 1}/${count} ${digest} ${encoded.slice(index * 1800, (index + 1) * 1800)}`)
}

export function parseHostedAttestationLogs(logs) {
  const matches = [...logs.matchAll(new RegExp(`${marker} (\\d+)\\/(\\d+) ([a-f0-9]{64}) ([A-Za-z0-9+/=]+)`, "g"))]
  assert(matches.length > 0, "No hosted attestation in private build logs")
  const count = Number(matches[0][2]), digest = matches[0][3], chunks = new Map()
  assert(count > 0 && count <= 10000 && matches.length === count, "Incomplete or duplicate hosted attestation log chunks")
  for (const match of matches) {
    const number = Number(match[1])
    assert(Number(match[2]) === count && match[3] === digest && number >= 1 && number <= count && !chunks.has(number), "Mixed or duplicate hosted attestation logs")
    chunks.set(number, match[4])
  }
  const bytes = Buffer.from(Array.from({ length: count }, (_, index) => chunks.get(index + 1)).join(""), "base64")
  assert.equal(hash(bytes), digest, "Hosted attestation log digest mismatch")
  return JSON.parse(bytes.toString("utf8"))
}

export function validateHostedAttestation(attestation, { baseURL, sourceRevision, harnessRevision }) {
  assert.equal(attestation.schemaVersion, HOSTED_SCHEMA, "Unknown hosted attestation")
  assert.equal(hostedOrigin(baseURL), attestation.origin, "Hosted attestation origin differs from requested deployment")
  assert.equal(baseURL, attestation.origin, "Hosted base URL must be the exact origin without a trailing slash")
  assert.equal(hostedOrigin(attestation.origin), attestation.origin, "Noncanonical hosted origin")
  assert(["preview", "production"].includes(attestation.environment), "Missing hosted environment")
  assert(Number.isFinite(Date.parse(attestation.recordedAt)) && Date.parse(attestation.recordedAt) <= Date.now() + 60000, "Invalid hosted build timestamp")
  assert(sha256(sourceRevision) && sha256(harnessRevision), "Missing local source/harness identity")
  assert.equal(attestation.identity?.sourceRevision, sourceRevision, "Hosted source differs from local source")
  assert.equal(attestation.harnessRevision, harnessRevision, "Hosted harness differs from local harness")
  assert(typeof attestation.identity.buildId === "string" && /^[A-Za-z0-9_-]+$/.test(attestation.identity.buildId), "Missing hosted build ID")
  assert(attestation.identity.buildSettings?.observability === true && attestation.identity.buildSettings?.httpsPolicy === true, "Attestation does not describe a Vercel build")
  assert(Array.isArray(attestation.identity.releases) && attestation.identity.releases.length > 0, "Missing hosted release identity")
  assert(Array.isArray(attestation.resources) && attestation.resources.length > 13 && attestation.resources.length <= 10000, "Missing hosted resource manifest")
  const paths = new Set()
  for (const resource of attestation.resources) {
    assert(typeof resource.path === "string" && resource.path.startsWith("/") && !resource.path.startsWith("//") && !/[?#\\%]/.test(resource.path) && new URL(resource.path, attestation.origin).pathname === resource.path, "Unsafe hosted resource path")
    assert(!paths.has(resource.path), "Duplicate hosted resource")
    paths.add(resource.path)
    const dynamic = resource.verification === "dynamic-build-id-and-asset"
    if (dynamic) assert(resource.path === "/demo" && resource.kind === "html" && resource.sha256 === null && resource.bytes === null && attestation.resources.some(asset => asset.kind === "asset" && asset.path === resource.requiredAsset), "Invalid dynamic hosted route identity")
    else assert(!resource.verification && sha256(resource.sha256) && Number.isSafeInteger(resource.bytes) && resource.bytes > 0 && resource.bytes <= 32 * 1024 * 1024, "Invalid hosted resource digest/size")
    assert(resource.kind === "html" || resource.kind === "asset" && resource.path.startsWith("/_next/static/"), "Unknown hosted resource kind")
  }
  assert.deepEqual(attestation.resources.filter(resource => resource.kind === "html").map(resource => resource.path).sort(), [...performanceMatrix("premium-civic").routes].sort(), "Hosted HTML coverage differs from release matrix")
  return attestation
}

export function hostedBinding(attestation) {
  return { origin: attestation.origin, environment: attestation.environment, attestationSha256: hash(JSON.stringify(attestation)) }
}

/** Never attach global browser headers: Lighthouse would forward them to third
 * parties. Protected deployments fail closed until a separately reviewed scoped
 * authentication mechanism exists. Fetch follows no redirects and saves only
 * an explicit harmless header allowlist, never Set-Cookie or request headers. */
export async function verifyHostedServing(attestation, { baseURL, fetcher = fetch }) {
  assert.equal(hostedOrigin(baseURL), attestation.origin, "Hosted serving origin mismatch")
  const startedAt = new Date().toISOString(), resources = []
  for (const expected of attestation.resources) {
    const url = new URL(expected.path, attestation.origin).href
    let response
    try { response = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(20000), headers: { "Accept-Encoding": "br, gzip" } }) }
    catch { throw new Error(`Hosted resource fetch failed: ${expected.path}`) }
    assert.equal(response.status, 200, `Hosted resource unavailable or protected: ${expected.path}`)
    assert.equal(response.url, url, `Hosted resource redirected: ${expected.path}`)
    const type = response.headers.get("content-type") ?? ""
    assert(expected.kind === "html" ? /text\/html/i.test(type) : !/text\/html/i.test(type), `Unexpected hosted content type: ${expected.path}`)
    const chunks = [], reader = response.body?.getReader()
    assert(reader, "Missing hosted response body")
    let size = 0
    try {
      while (true) {
        const next = await reader.read()
        if (next.done) break
        size += next.value.length
        assert(size <= (expected.bytes ?? 8 * 1024 * 1024), `Hosted resource size changed: ${expected.path}`)
        chunks.push(next.value)
      }
    } finally { await reader.cancel().catch(() => undefined) }
    const bytes = Buffer.concat(chunks), digest = hash(bytes)
    if (expected.verification === "dynamic-build-id-and-asset") {
      assert(bytes.includes(Buffer.from(attestation.identity.buildId)) && bytes.includes(Buffer.from(expected.requiredAsset)), "Dynamic hosted HTML lacks attested build ID/page chunk")
    } else {
      assert.equal(size, expected.bytes, `Hosted resource size changed: ${expected.path}`)
      assert.equal(digest, expected.sha256, `Hosted resource digest changed: ${expected.path}`)
    }
    resources.push({ path: expected.path, sha256: digest, bytes: size, contentType: type, encoding: response.headers.get("content-encoding") ?? "identity", robots: response.headers.get("x-robots-tag") ?? null })
  }
  return { result: "pass", ...hostedBinding(attestation), startedAt, finishedAt: new Date().toISOString(), resources }
}

export function assertHostedServingPair(pair, attestation) {
  for (const phase of ["before", "after"]) {
    const receipt = pair?.[phase]
    assert.equal(receipt?.result, "pass", `Missing hosted ${phase} serving verification`)
    for (const [key, value] of Object.entries(hostedBinding(attestation))) assert.equal(receipt[key], value, "Mixed hosted serving identity")
    assert.deepEqual(receipt.resources.map(resource => resource.path), attestation.resources.map(resource => resource.path), "Hosted serving resource coverage changed")
    for (const [index, resource] of attestation.resources.entries()) {
      const observed = receipt.resources[index]
      assert(sha256(observed.sha256) && Number.isSafeInteger(observed.bytes) && observed.bytes > 0, "Missing decoded hosted resource identity")
      if (resource.verification !== "dynamic-build-id-and-asset") assert(observed.sha256 === resource.sha256 && observed.bytes === resource.bytes, "Hosted serving resource coverage changed")
    }
  }
  assert.deepEqual(pair.before.resources.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })), pair.after.resources.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })), "Hosted decoded HTML/assets changed during collection")
  assert(Date.parse(pair.before.startedAt) >= Date.parse(attestation.recordedAt)
    && Date.parse(pair.before.finishedAt) >= Date.parse(pair.before.startedAt)
    && Date.parse(pair.collectionStartedAt) >= Date.parse(pair.before.finishedAt)
    && Date.parse(pair.collectionFinishedAt) >= Date.parse(pair.collectionStartedAt)
    && Date.parse(pair.after.startedAt) >= Date.parse(pair.collectionFinishedAt)
    && Date.parse(pair.after.finishedAt) >= Date.parse(pair.after.startedAt), "Hosted serving receipts have invalid chronology")
}
