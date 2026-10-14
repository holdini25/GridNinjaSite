import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { createRequire } from "node:module"
import { performanceMatrix } from "./lighthouse-matrix.mjs"
import { GIT_SOURCE_MODE, productionGitIdentity, gitConfigBinding, validateGitConfigBinding, validateGitPlatformIdentity } from "./git-source-binding.mjs"

export const HOSTED_SCHEMA = "gridninja-hosted-build.v1"
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const canonicalConfig = value => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const marker = "GRIDNINJA_HOSTED_ATTESTATION_V1"
const require = createRequire(import.meta.url)
const { getRouteCacheKey } = require("next/dist/server/lib/route-cache-key")
const { normalizePagePath } = require("next/dist/shared/lib/page-path/normalize-page-path")

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

/** Resolve the producer's layout, not a stale legacy file left by another build.
 * Next 16.3 adapters use source-module-namespaced route-cache files. The emitted
 * config keeps adapterPath as a presence marker even when its value is omitted. */
export async function hostedPrerenderPath(route, nextDirectory = ".next") {
  const readJson = async path => JSON.parse(await readFile(join(nextDirectory, path), "utf8"))
  const [{ config }, prerender, appRoutes, pagesRoutes] = await Promise.all([
    readJson("required-server-files.json"), readJson("prerender-manifest.json"), readJson("app-path-routes-manifest.json"),
    readJson("server/pages-manifest.json").catch(error => { if (error.code === "ENOENT") return {}; throw error }),
  ])
  assert(config && config.output !== "export", "Unsupported hosted output layout")
  const entry = prerender.routes?.[route]
  const sourceRoute = entry?.srcRoute ?? route
  const sources = Object.entries(appRoutes).filter(([source, pathname]) => source.endsWith("/page") && pathname === sourceRoute).map(([source]) => source)
  const pagesSource = pagesRoutes[sourceRoute]
  if (!entry) assert(typeof pagesSource === "string" && pagesSource === `pages${normalizePagePath(route)}.html`, `Missing complete static prerender: ${route}`)
  else assert(entry.initialRevalidateSeconds === false && entry.response === "complete" && entry.routeType === "page", `Missing complete static prerender: ${route}`)
  assert.equal(sources.length + (pagesSource ? 1 : 0), 1, `Missing or ambiguous source module: ${route}`)
  const kind = pagesSource ? "PAGES" : "APP_PAGE"
  if (pagesSource && entry) assert(typeof entry.dataRoute === "string" && entry.dataRoute.endsWith(".json"), `Missing Pages static prerender data route: ${route}`)
  const filename = config.adapterPath
    ? getRouteCacheKey(route, { kind, sourceRoute: pagesSource ? sourceRoute : sources[0] })
    : `${pagesSource ? "pages" : "app"}${normalizePagePath(route)}`
  return join(nextDirectory, "server", `${filename}.html`)
}

/** Only relative emitted paths and adapter presence, never config/env values. */
export async function hostedOutputDiagnostics(nextDirectory = ".next") {
  const { config } = JSON.parse(await readFile(join(nextDirectory, "required-server-files.json"), "utf8"))
  return { adapter: Boolean(config?.adapterPath), htmlFiles: (await filesAt(join(nextDirectory, "server"))).filter(file => file.endsWith(".html")).map(file => relative(nextDirectory, file).replaceAll("\\", "/")) }
}

/** Diagnostic only: this never substitutes a canonical digest for source-byte
 * equality. Exact bytes are disclosed only for the known public repository
 * config and an independently supplied matching canonical SHA-256. */
export function hostedConfigDiagnostics(bytes, expectedCanonicalSha256) {
  const config = JSON.parse(bytes.toString("utf8"))
  assert(config && typeof config === "object" && !Array.isArray(config), "Invalid hosted project configuration")
  const canonical = canonicalConfig
  const approved = { $schema: "https://openapi.vercel.sh/vercel.json", git: { deploymentEnabled: { "codex/assessment-yield-upgrade": false } } }
  const canonicalSha256 = hash(canonical(config)), expectedMatches = sha256(expectedCanonicalSha256) && canonicalSha256 === expectedCanonicalSha256
  const knownPublicConfig = canonical(config) === canonical(approved)
  const fields = Object.entries(config).map(([key, value]) => {
    const safe = key === "$schema" && value === approved.$schema
      || key === "git" && canonical(value) === canonical(approved.git)
      || key === "version" && [1, 2].includes(value)
      || key === "framework" && [null, "nextjs"].includes(value)
    return { key, type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value, sha256: hash(canonical(value)), ...(safe ? { value } : {}) }
  })
  return { bytes: bytes.length, sha256: hash(bytes), canonicalSha256, expectedCanonicalSha256: sha256(expectedCanonicalSha256) ? expectedCanonicalSha256 : null, expectedMatches, knownPublicConfig, fields,
    ...(expectedMatches && knownPublicConfig ? { encodedBytes: bytes.toString("base64") } : {}) }
}

/** The only permitted provider source rewrite. Canonical equality pins the
 * original configuration; the built file must also match the exact serialized
 * bytes. No unknown provider fields, ordering or whitespace are normalized. */
export function expectedHostedConfig(repositoryBytes, { projectName, originalCanonicalSha256 }) {
  assert(typeof projectName === "string" && /^[a-z0-9][a-z0-9-]{0,99}$/.test(projectName), "Missing or invalid independently pinned hosted project name")
  assert(sha256(originalCanonicalSha256), "Missing independently pinned original config digest")
  const original = JSON.parse(repositoryBytes.toString("utf8"))
  assert(original && typeof original === "object" && !Array.isArray(original), "Invalid original project configuration")
  assert(!Object.hasOwn(original, "name") && !Object.hasOwn(original, "version"), "Repository config already contains provider project metadata")
  assert.equal(hash(canonicalConfig(original)), originalCanonicalSha256, "Original project configuration differs from its pin")
  const bytes = Buffer.from(`${JSON.stringify({ ...original, name: projectName, version: 2 })}\n`)
  return { bytes, transformation: { kind: "vercel-project-metadata.v1", projectName, version: 2, originalCanonicalSha256, builtConfigSha256: hash(bytes), builtConfigBytes: bytes.length } }
}

export function attestHostedConfig(builtBytes, pins) {
  const built = JSON.parse(builtBytes.toString("utf8"))
  assert(built && typeof built === "object" && !Array.isArray(built), "Invalid built project configuration")
  const { name, version, ...original } = built
  assert.equal(name, pins.projectName, "Hosted configuration project differs from its pin")
  assert.equal(version, 2, "Unexpected hosted configuration version")
  const expected = expectedHostedConfig(Buffer.from(JSON.stringify(original)), pins)
  assert(builtBytes.equals(expected.bytes), "Hosted configuration has an unapproved byte rewrite")
  return expected.transformation
}

/** The explicit CLI variant is unchanged. Automatic Git production builds bind
 * the exact raw checkout and the platform's nonsecret built-in identity. */
export function hostedSourceBinding(identity, configBytes, env = process.env) {
  assert(env.VERCEL === "1" && env.VERCEL_URL && ["preview", "production"].includes(env.VERCEL_ENV), "Hosted attestation requires the actual Vercel build environment")
  const platformIdentity = productionGitIdentity(env)
  if (platformIdentity) {
    assert(sha256(identity.sourceRevision), "Missing actual Git build source digest")
    return { repositorySourceRevision: identity.sourceRevision, hostedSourceRevision: identity.sourceRevision, configTransformation: gitConfigBinding(configBytes), platformIdentity }
  }
  assert(sha256(env.FACILITY_REPOSITORY_SOURCE_REVISION), "Hosted build requires a pinned repository source identity")
  const configTransformation = attestHostedConfig(configBytes, { projectName: env.FACILITY_HOSTED_PROJECT_NAME, originalCanonicalSha256: env.FACILITY_EXPECTED_VERCEL_CONFIG_SHA256 })
  // The repository digest is an input pin, independently recomputed by the
  // consumer. identity.sourceRevision is measured from the actual built tree.
  return { repositorySourceRevision: env.FACILITY_REPOSITORY_SOURCE_REVISION, hostedSourceRevision: identity.sourceRevision, configTransformation }
}

/** Produced inside the actual Vercel build, never synthesized from local .next. */
export async function createHostedAttestation(identity, harnessRevision, env = process.env) {
  const sourceBinding = hostedSourceBinding(identity, await readFile("vercel.json"), env)
  const origin = hostedOrigin(`https://${env.VERCEL_URL}`)
  const resources = []
  for (const route of performanceMatrix("premium-civic").routes) {
    // Demo reads searchParams and is rendered by Vercel at request time. Never
    // mislabel a locally invented HTML body as an emitted hosted build asset.
    if (route === "/demo") continue
    const publication = /^\/evidence\/assessments\/([a-z0-9-]+)\/([a-z0-9.]+)$/.exec(route)
    const file = publication ? `src/content/assessment-publications/${publication[1]}/${publication[2]}/brief.html` : await hostedPrerenderPath(route)
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
  return { schemaVersion: HOSTED_SCHEMA, recordedAt: new Date().toISOString(), origin, environment: env.VERCEL_ENV, identity, sourceBinding, harnessRevision, resources }
}

/** Small numbered lines survive private build-log line limits. Only the selected
 * nonsecret platform identity is included; no credentials, headers, arbitrary
 * environment values, source bodies or lead data enter the log. */
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

export function validateHostedAttestation(attestation, { baseURL, sourceRevision, hostedSourceRevision, configTransformation, harnessRevision, platformIdentity = null }) {
  assert.equal(attestation.schemaVersion, HOSTED_SCHEMA, "Unknown hosted attestation")
  assert.equal(hostedOrigin(baseURL), attestation.origin, "Hosted attestation origin differs from requested deployment")
  assert.equal(baseURL, attestation.origin, "Hosted base URL must be the exact origin without a trailing slash")
  assert.equal(hostedOrigin(attestation.origin), attestation.origin, "Noncanonical hosted origin")
  assert(["preview", "production"].includes(attestation.environment), "Missing hosted environment")
  assert(Number.isFinite(Date.parse(attestation.recordedAt)) && Date.parse(attestation.recordedAt) <= Date.now() + 60000, "Invalid hosted build timestamp")
  assert(sha256(sourceRevision) && sha256(hostedSourceRevision) && sha256(harnessRevision), "Missing local repository/expected hosted source/harness identity")
  if (configTransformation?.kind === GIT_SOURCE_MODE) {
    validateGitConfigBinding(configTransformation)
    validateGitPlatformIdentity(platformIdentity)
    assert.equal(sourceRevision, hostedSourceRevision, "Unmodified Git source must equal repository source")
    assert.equal(attestation.environment, "production", "Git attestation requires production environment")
    assert.equal(platformIdentity.origin, attestation.origin, "Git platform origin differs from immutable attestation")
    assert.deepEqual(attestation.sourceBinding, { repositorySourceRevision: sourceRevision, hostedSourceRevision, configTransformation, platformIdentity }, "Hosted Git source binding differs from independent platform pins")
  } else {
    assert.equal(platformIdentity, null, "CLI source must not claim a Git platform binding")
    assert(configTransformation?.kind === "vercel-project-metadata.v1" && typeof configTransformation.projectName === "string" && /^[a-z0-9][a-z0-9-]{0,99}$/.test(configTransformation.projectName)
      && configTransformation.version === 2 && sha256(configTransformation.originalCanonicalSha256) && sha256(configTransformation.builtConfigSha256) && Number.isSafeInteger(configTransformation.builtConfigBytes) && configTransformation.builtConfigBytes > 0, "Missing independently computed hosted config transformation")
    assert.deepEqual(attestation.sourceBinding, { repositorySourceRevision: sourceRevision, hostedSourceRevision, configTransformation }, "Hosted source binding differs from repository and project pins")
  }
  assert.equal(attestation.identity?.sourceRevision, hostedSourceRevision, "Hosted source differs from the exact expected built source")
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
  return { origin: attestation.origin, environment: attestation.environment, repositorySourceRevision: attestation.sourceBinding.repositorySourceRevision, hostedSourceRevision: attestation.sourceBinding.hostedSourceRevision, configTransformation: attestation.sourceBinding.configTransformation, attestationSha256: hash(JSON.stringify(attestation)) }
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
    for (const [key, value] of Object.entries(hostedBinding(attestation))) assert.deepEqual(receipt[key], value, "Mixed hosted serving identity")
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
