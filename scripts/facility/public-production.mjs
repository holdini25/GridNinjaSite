import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { JSDOM } from "jsdom"
import { hostedBinding, hostedOrigin, validateHostedAttestation } from "./hosted-attestation.mjs"
import { collectProductionMetadata, METADATA_REQUEST_TIMEOUT_MS, METADATA_WINDOW_MS, PRODUCTION_METADATA_SCHEMA, PRODUCTION_PROJECT, productionMetadataPaths } from "./vercel-production-metadata.mjs"
import { PUBLIC_MANIFEST, PUBLIC_SITEMAP_URLS } from "./public-infrastructure-policy.mjs"
import { CLI_SOURCE_MODE, GIT_SOURCE_MODE, validateGitConfigBinding, expectedGitPlatformIdentity } from "./git-source-binding.mjs"

export const PUBLIC_ORIGIN = "https://gridninja.ai"
export const PUBLIC_PINS_SCHEMA = "gridninja-public-production-pins.v1"
export const PUBLIC_SERVING_SCHEMA = "gridninja-public-serving.v1"
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const sha256 = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const jsonHash = value => hash(JSON.stringify(value))
const timestamp = value => {
  assert(typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)), "Missing canonical timestamp")
  assert.equal(new Date(Date.parse(value)).toISOString(), value, "Noncanonical calendar timestamp")
  return Date.parse(value)
}
const nodeVersion = value => typeof value === "string" && /^\d{2}\.x$/.test(value)
const exactKeys = (value, keys, message) => assert(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","), message)
/** @typedef {(url: string, options: RequestInit) => Promise<Response>} PublicFetcher */

/** @typedef {object} PublicProductionPins
 * @property {"gridninja-public-production-pins.v1"} schemaVersion
 * @property {"https://gridninja.ai"} origin
 * @property {string} projectId
 * @property {string} projectName
 * @property {string} scope
 * @property {string} deploymentId Independently obtained provider deployment ID.
 * @property {string} deploymentCommit Independently obtained complete Git commit.
 * @property {string} immutableOrigin Deployment URL from provider metadata.
 * @property {string} buildId Actual producer build ID, not a local .next value.
 * @property {string} sourceRevision Repository source digest.
 * @property {string} hostedSourceRevision Exact expected provider-built source digest.
 * @property {string} sourceMode Independently selected Git-unmodified or explicit CLI source mode.
 * @property {object} configTransformation Independently computed approved rewrite.
 * @property {string} harnessRevision Producer/consumer harness digest.
 * @property {object} buildSettings Independently approved exact producer settings.
 * @property {object[]} releases Independently approved release manifest identities.
 * @property {{projectNodeVersion:string,deploymentNodeVersion:string,gitConnected:boolean,protectionScope:string|null}} providerSettings
 */
export function validatePublicProductionPins(pins) {
  exactKeys(pins, ["schemaVersion", "origin", "projectId", "projectName", "scope", "deploymentId", "deploymentCommit", "immutableOrigin", "buildId", "sourceRevision", "hostedSourceRevision", "sourceMode", "configTransformation", "harnessRevision", "buildSettings", "releases", "providerSettings"], "Missing or unknown public production pins")
  assert.equal(pins.schemaVersion, PUBLIC_PINS_SCHEMA, "Unknown public production pins")
  assert.equal(pins.origin, PUBLIC_ORIGIN, "Public collection permits only the exact production apex")
  assert(pins.projectId === PRODUCTION_PROJECT.id && pins.projectName === PRODUCTION_PROJECT.name && pins.scope === PRODUCTION_PROJECT.scope, "Public production project/scope mismatch")
  productionMetadataPaths(pins.deploymentId)
  assert(/^[a-f0-9]{40}$/.test(pins.deploymentCommit ?? ""), "Missing independent production commit")
  assert.equal(hostedOrigin(pins.immutableOrigin), pins.immutableOrigin, "Noncanonical immutable deployment origin")
  assert(/^[A-Za-z0-9_-]+$/.test(pins.buildId ?? ""), "Missing independent production build ID")
  assert([pins.sourceRevision, pins.hostedSourceRevision, pins.harnessRevision].every(sha256), "Missing independent production source/harness pins")
  assert.equal(pins.configTransformation?.projectName, PRODUCTION_PROJECT.name, "Config transformation must name the production project")
  assert([CLI_SOURCE_MODE, GIT_SOURCE_MODE].includes(pins.sourceMode) && pins.configTransformation.kind === pins.sourceMode, "Missing or mixed independently selected source mode")
  if (pins.sourceMode === GIT_SOURCE_MODE) {
    validateGitConfigBinding(pins.configTransformation)
    assert.equal(pins.sourceRevision, pins.hostedSourceRevision, "Unmodified Git source must equal repository source")
    expectedGitPlatformIdentity(pins)
  }
  const settings = pins.buildSettings
  assert(settings && settings.observability === true && settings.httpsPolicy === true && settings.csp === "enforce" && settings.verification === "live" && sha256(settings.verificationSiteKeySha256) && settings.privateCandidate === null, "Public production requires exact approved live build settings")
  assert(Array.isArray(pins.releases) && pins.releases.length > 0, "Missing independent production release pins")
  const releaseNames = new Set()
  for (const release of pins.releases) {
    exactKeys(release, ["release", "manifestSha256"], "Invalid production release pin")
    assert(/^[a-z0-9][a-z0-9-]{1,100}$/.test(release.release) && sha256(release.manifestSha256) && !releaseNames.has(release.release), "Invalid or duplicate production release identity")
    releaseNames.add(release.release)
  }
  exactKeys(pins.providerSettings, ["projectNodeVersion", "deploymentNodeVersion", "gitConnected", "protectionScope"], "Missing exact provider settings pins")
  assert(nodeVersion(pins.providerSettings.projectNodeVersion) && nodeVersion(pins.providerSettings.deploymentNodeVersion) && typeof pins.providerSettings.gitConnected === "boolean", "Missing provider Node/Git settings pins")
  assert(pins.providerSettings.protectionScope === null || /^[a-z_]{1,80}$/.test(pins.providerSettings.protectionScope), "Invalid protection scope pin")
  if (pins.sourceMode === GIT_SOURCE_MODE) assert.equal(pins.providerSettings.gitConnected, true, "Git production requires independently verified repository connection")
  return pins
}

/** Missing producer evidence is a pending prerequisite, never permission to use
 * local .next or rewrite an immutable attestation's origin to the public apex. */
export function validatePublicAttestation(attestation, pins) {
  validatePublicProductionPins(pins)
  assert(attestation && typeof attestation === "object", "Public collection requires the actual deployment's producer attestation; local .next is not a substitute")
  validateHostedAttestation(attestation, { baseURL: pins.immutableOrigin, sourceRevision: pins.sourceRevision, hostedSourceRevision: pins.hostedSourceRevision, configTransformation: pins.configTransformation, harnessRevision: pins.harnessRevision, platformIdentity: pins.sourceMode === GIT_SOURCE_MODE ? expectedGitPlatformIdentity(pins) : null })
  assert.equal(attestation.environment, "production", "Public collection requires a production deployment attestation")
  assert.deepEqual(attestation.identity, { sourceRevision: pins.hostedSourceRevision, buildId: pins.buildId, releases: pins.releases, buildSettings: pins.buildSettings }, "Actual producer build/settings differ from independent public pins")
  return attestation
}

export function publicBinding(attestation, pins) {
  validatePublicAttestation(attestation, pins)
  return {
    schemaVersion: "gridninja-public-binding.v1", origin: PUBLIC_ORIGIN, immutableOrigin: attestation.origin,
    projectId: PRODUCTION_PROJECT.id, projectName: PRODUCTION_PROJECT.name, scope: PRODUCTION_PROJECT.scope,
    deploymentId: pins.deploymentId, deploymentCommit: pins.deploymentCommit, buildId: pins.buildId,
    repositorySourceRevision: pins.sourceRevision, hostedSourceRevision: pins.hostedSourceRevision, harnessRevision: pins.harnessRevision,
    pinsSha256: jsonHash(pins), attestationSha256: hostedBinding(attestation).attestationSha256,
  }
}

export function validatePublicTargetReceipt(receipt, attestation, pins, { referenceTime = Date.now() } = {}) {
  validatePublicAttestation(attestation, pins)
  assert(Number.isFinite(referenceTime), "Invalid target receipt reference time")
  exactKeys(receipt, ["schemaVersion", "provider", "cliVersion", "scope", "startedAt", "finishedAt", "requests", "project", "current", "aliases"], "Unknown production metadata receipt fields")
  assert(receipt?.schemaVersion === PRODUCTION_METADATA_SCHEMA && receipt.provider === "vercel-cli" && receipt.cliVersion === "64.0.2" && receipt.scope === PRODUCTION_PROJECT.scope, "Missing authoritative production metadata receipt")
  const start = timestamp(receipt.startedAt), end = timestamp(receipt.finishedAt)
  assert(start >= timestamp(attestation.recordedAt) && end >= start && end - start <= METADATA_WINDOW_MS && end <= referenceTime && referenceTime - end <= METADATA_WINDOW_MS, "Stale, future or invalid production metadata snapshot")
  assert.deepEqual(receipt.project, { id: PRODUCTION_PROJECT.id, name: PRODUCTION_PROJECT.name, currentProductionDeploymentId: pins.deploymentId, nodeVersion: pins.providerSettings.projectNodeVersion, gitConnected: pins.providerSettings.gitConnected, protectionScope: pins.providerSettings.protectionScope }, "Authoritative project/current target/settings mismatch")
  assert.deepEqual(receipt.current, { id: pins.deploymentId, projectId: PRODUCTION_PROJECT.id, url: new URL(pins.immutableOrigin).hostname, target: "production", readyState: "READY", gitCommitSha: pins.deploymentCommit, nodeVersion: pins.providerSettings.deploymentNodeVersion }, "Authoritative production deployment/build identity mismatch")
  assert.deepEqual(receipt.aliases, [
    { alias: "gridninja.ai", projectId: PRODUCTION_PROJECT.id, deploymentId: pins.deploymentId, redirect: null },
    { alias: "www.gridninja.ai", projectId: PRODUCTION_PROJECT.id, deploymentId: pins.deploymentId, redirect: "gridninja.ai" },
  ], "Authoritative apex/www target or approved redirect mismatch")
  const paths = productionMetadataPaths(pins.deploymentId)
  assert(Array.isArray(receipt.requests) && receipt.requests.length === paths.length, "Incomplete authoritative metadata request coverage")
  let previous = start
  for (const [index, request] of receipt.requests.entries()) {
    exactKeys(request, ["method", "path", "startedAt", "finishedAt"], "Unknown metadata request receipt fields")
    assert(request.method === "GET" && request.path === paths[index], "Unexpected metadata method/endpoint or request order")
    const requestStart = timestamp(request.startedAt), requestEnd = timestamp(request.finishedAt)
    assert(requestStart >= previous && requestEnd >= requestStart && requestEnd - requestStart <= METADATA_REQUEST_TIMEOUT_MS && requestEnd <= end, "Invalid metadata request chronology")
    previous = requestEnd
  }
  return receipt
}

/** @param {object} attestation
 * @param {object} pins
 * @param {{run?: import("./vercel-production-metadata.mjs").MetadataRunner, now?: () => number}} options */
export function collectPublicTargetReceipt(attestation, pins, { run, now = Date.now } = {}) {
  validatePublicAttestation(attestation, pins) // Before any provider request.
  const receipt = collectProductionMetadata(pins.deploymentId, { run, now })
  return validatePublicTargetReceipt(receipt, attestation, pins, { referenceTime: now() })
}

export function assertPublicTargetPair(pair, attestation, pins) {
  const start = timestamp(pair?.collectionStartedAt), end = timestamp(pair?.collectionFinishedAt)
  assert(end >= start && end <= Date.now(), "Invalid public collection window")
  validatePublicTargetReceipt(pair.before, attestation, pins, { referenceTime: start })
  validatePublicTargetReceipt(pair.after, attestation, pins, { referenceTime: timestamp(pair.after?.finishedAt) })
  assert(timestamp(pair.before.finishedAt) <= start && timestamp(pair.after.startedAt) >= end && timestamp(pair.after.startedAt) - end <= METADATA_WINDOW_MS, "Production targets do not freshly bracket collection")
  assert(timestamp(pair.after.finishedAt) <= Date.now(), "Future production metadata receipt")
}

function publicPage(url, attestation) {
  const parsed = new URL(url)
  assert(parsed.origin === PUBLIC_ORIGIN && !parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.href === url, "Document must belong to the exact public apex route without a query")
  const resource = attestation.resources.find(item => item.kind === "html" && item.path === parsed.pathname)
  assert(resource, "Document is outside the attested public route coverage")
  return resource
}

/** Consume CDP Network.getResponseBody output already captured for the measured
 * document. Does not fetch, execute script, derive expected identity or mutate it. */
export function publicDocumentProof({ url, status, body, base64Encoded = false, observedAt, headers = {} }, attestation, pins) {
  validatePublicAttestation(attestation, pins)
  const expected = publicPage(url, attestation)
  assert(status === 200 && typeof body === "string" && typeof base64Encoded === "boolean", "Missing successful captured document body")
  const observed = timestamp(observedAt)
  assert(observed >= timestamp(attestation.recordedAt) && observed <= Date.now(), "Invalid captured document time")
  if (base64Encoded) assert(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body), "Invalid captured base64 body")
  const bytes = Buffer.from(body, base64Encoded ? "base64" : "utf8")
  assert(bytes.length > 0 && bytes.length <= 32 * 1024 * 1024, "Captured document exceeds its bound")
  const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]))
  assert(/text\/html/i.test(normalizedHeaders["content-type"] ?? ""), "Captured document is not HTML")
  const document = new JSDOM(bytes.toString("utf8")).window.document
  const robots = [...document.querySelectorAll('meta[name="robots" i],meta[name="googlebot" i]')].map(node => node.getAttribute("content")).join(",")
  const publication = expected.path.startsWith("/evidence/assessments/")
  let router, canonical = null, buildMarker = null, requiredAsset = null
  if (expected.verification !== "dynamic-build-id-and-asset") assert(hash(bytes) === expected.sha256 && bytes.length === expected.bytes, "Captured document differs from actual producer bytes")
  else {
    assert(bytes.includes(Buffer.from(expected.requiredAsset)), "Captured dynamic document lacks the attested page asset")
    requiredAsset = expected.requiredAsset
  }
  if (publication) {
    assert(hash(bytes) === expected.sha256 && bytes.length === expected.bytes, "Captured published brief differs from producer bytes")
    assert(/noindex/i.test(`${normalizedHeaders["x-robots-tag"] ?? ""},${robots}`), "Published brief must remain noindex")
    router = "publication"
  } else {
    assert(!/noindex|none/i.test(`${normalizedHeaders["x-robots-tag"] ?? ""},${robots}`), "Public document is unexpectedly noindex")
    const canonicals = [...document.querySelectorAll('link[rel="canonical"]')].map(node => node.getAttribute("href"))
    assert.deepEqual(canonicals, [new URL(expected.path, PUBLIC_ORIGIN).href], "Public document canonical differs from its route")
    canonical = canonicals[0]
    const bootstrap = [...document.querySelectorAll('[id="__NEXT_DATA__"]')]
    if (expected.path === "/contact") {
      assert(bootstrap.length === 1 && bootstrap[0].tagName === "SCRIPT" && bootstrap[0].getAttribute("type") === "application/json", "Missing unique Pages bootstrap")
      const data = JSON.parse(bootstrap[0].textContent)
      assert(data.buildId === pins.buildId && data.page === "/contact" && data.gsp === true && data.isFallback === false && data.props?.pageProps?.observability === true, "Captured Pages document build/static identity mismatch")
      router = "pages"
      buildMarker = { kind: "pages-bootstrap", value: data.buildId, page: data.page, gsp: data.gsp, isFallback: data.isFallback, observability: data.props.pageProps.observability }
    } else {
      assert.equal(bootstrap.length, 0, "Unexpected Pages bootstrap on App route")
      let flight = ""
      for (const script of document.querySelectorAll("script:not([src])")) {
        const match = /^self\.__next_f\.push\((\[.*\])\);?$/.exec(script.textContent.trim().replaceAll("\n", ""))
        if (!match) continue
        const chunk = JSON.parse(match[1])
        if (Array.isArray(chunk) && chunk[0] === 1 && typeof chunk[1] === "string") flight += chunk[1]
      }
      const roots = flight.split("\n").filter(line => line.startsWith("0:"))
      assert(roots.length === 1 && JSON.parse(roots[0].slice(2)).b === pins.buildId, "Captured App Flight root build identity mismatch")
      router = "app"
      buildMarker = { kind: "app-flight-root", value: JSON.parse(roots[0].slice(2)).b }
    }
  }
  return { ...publicBinding(attestation, pins), schemaVersion: "gridninja-public-document.v1", url, path: expected.path, observedAt, router, documentSha256: hash(bytes), bytes: bytes.length, status, contentType: normalizedHeaders["content-type"], canonical, robotsMeta: robots, robotsHeader: normalizedHeaders["x-robots-tag"] ?? "", buildMarker, requiredAsset }
}

/** Revalidate persisted per-capture evidence; old boolean flags cannot qualify. */
export function assertPublicDocumentProof(proof, attestation, pins, { route, after, before }) {
  const binding = publicBinding(attestation, pins)
  assert(proof?.schemaVersion === "gridninja-public-document.v1", "Missing public captured-document proof")
  for (const [key, value] of Object.entries(binding)) if (key !== "schemaVersion") assert.deepEqual(proof[key], value, "Mixed public captured-document identity")
  const expected = publicPage(proof.url, attestation)
  assert(expected.path === route && proof.path === route, "Captured document differs from measured route")
  const observed = timestamp(proof.observedAt)
  assert(observed >= timestamp(after) && observed <= timestamp(before) && observed <= Date.now(), "Captured document lies outside collection window")
  assert(proof.status === 200 && /text\/html/i.test(proof.contentType) && sha256(proof.documentSha256) && Number.isSafeInteger(proof.bytes) && proof.bytes > 0 && proof.bytes <= 32 * 1024 * 1024, "Incomplete captured-document identity")
  assert(typeof proof.robotsMeta === "string" && typeof proof.robotsHeader === "string", "Missing captured robots evidence")
  if (expected.verification !== "dynamic-build-id-and-asset") {
    assert(proof.documentSha256 === expected.sha256 && proof.bytes === expected.bytes && proof.requiredAsset === null, "Captured static document differs from attestation")
  } else assert(proof.requiredAsset === expected.requiredAsset, "Captured dynamic page asset mismatch")
  if (expected.path.startsWith("/evidence/assessments/")) {
    assert(proof.router === "publication" && proof.buildMarker === null && proof.canonical === null && /noindex/i.test(`${proof.robotsMeta},${proof.robotsHeader}`), "Invalid published-brief proof")
  } else {
    assert(proof.canonical === new URL(route, PUBLIC_ORIGIN).href && !/noindex|none/i.test(`${proof.robotsMeta},${proof.robotsHeader}`), "Invalid public indexing proof")
    if (route === "/contact") {
      assert.equal(proof.router, "pages", "Contact requires captured Pages identity")
      assert.deepEqual(proof.buildMarker, { kind: "pages-bootstrap", value: pins.buildId, page: "/contact", gsp: true, isFallback: false, observability: true }, "Captured Pages identity mismatch")
    } else {
      assert.equal(proof.router, "app", "Route requires captured App identity")
      assert.deepEqual(proof.buildMarker, { kind: "app-flight-root", value: pins.buildId }, "Captured App identity mismatch")
    }
  }
}

const infrastructurePaths = ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]
function validateInfrastructure(resources) {
  assert.deepEqual(resources?.map(item => item.path), infrastructurePaths, "Incomplete public infrastructure coverage")
  for (const resource of resources) {
    assert(typeof resource.body === "string" && resource.bytes > 0 && resource.bytes <= 256 * 1024 && Buffer.byteLength(resource.body) === resource.bytes && hash(resource.body) === resource.sha256, "Invalid public infrastructure bytes")
    if (resource.path === "/robots.txt") {
      assert(/^text\/plain(?:\s*;|$)/i.test(resource.contentType), "Invalid public robots content type")
      const lines = resource.body.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(line => line && !line.startsWith("#")).sort()
      assert.deepEqual(lines, ["user-agent: *", "allow: /", "disallow: /api/", "disallow: /internal/", "host: https://gridninja.ai/", "sitemap: https://gridninja.ai/sitemap.xml"].sort(), "Public robots does not preserve indexability and private-path exclusions")
    } else if (resource.path === "/sitemap.xml") {
      assert(/^(?:application|text)\/xml(?:\s*;|$)/i.test(resource.contentType), "Invalid public sitemap content type")
      const document = new JSDOM(resource.body, { contentType: "application/xml" }).window.document
      assert(document.documentElement.localName === "urlset" && document.documentElement.namespaceURI === "http://www.sitemaps.org/schemas/sitemap/0.9", "Invalid public sitemap root")
      const entries = [...document.documentElement.children]
      assert(entries.length > 0 && entries.every(node => node.localName === "url" && [...node.children].filter(child => child.localName === "loc").length === 1), "Empty or malformed public sitemap")
      const urls = entries.map(node => [...node.children].find(child => child.localName === "loc").textContent.trim())
      assert(new Set(urls).size === urls.length && urls.every(value => { const url = new URL(value); return url.origin === PUBLIC_ORIGIN && !url.username && !url.password && !url.search && !url.hash && url.href === value && !/^\/(api|internal)(\/|$)/.test(url.pathname) }), "Public sitemap has noncanonical/foreign or private URLs")
      assert.deepEqual(urls.sort(), [...PUBLIC_SITEMAP_URLS].sort(), "Public sitemap differs from the complete source-bound URL set")
    } else {
      assert(/^application\/manifest\+json(?:\s*;|$)/i.test(resource.contentType), "Invalid public manifest content type")
      const manifest = JSON.parse(resource.body)
      assert.deepEqual(manifest, PUBLIC_MANIFEST, "Public manifest differs from the complete source-bound contract")
    }
  }
}

/** Unauthenticated public GETs only. The immutable producer attestation is used
 * as-is; neither its origin nor its resource digests are rewritten.
 * @param {object|null|undefined} attestation
 * @param {{pins?: object, fetcher?: PublicFetcher, run?: import("./vercel-production-metadata.mjs").MetadataRunner, now?: () => number}} options */
export async function verifyPublicServing(attestation, { pins, fetcher = fetch, run, now = Date.now } = {}) {
  const binding = publicBinding(attestation, pins), stamp = () => new Date(now()).toISOString()
  const startedAt = stamp(), targetBefore = collectPublicTargetReceipt(attestation, pins, { run, now })
  const resourcesStartedAt = stamp(), resources = [], infrastructure = []
  for (const expected of attestation.resources) {
    assert(expected.kind === "html" || expected.path.startsWith("/_next/static/"), "Unsafe public resource")
    const url = new URL(expected.path, PUBLIC_ORIGIN).href
    let response
    try { response = await fetcher(url, { redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(20000), headers: { "Accept-Encoding": "br, gzip" } }) }
    catch { throw new Error(`Public resource fetch failed: ${expected.path}`) }
    assert(response.status === 200 && response.url === url, `Public resource unavailable, protected or redirected: ${expected.path}`)
    const type = response.headers.get("content-type") ?? ""
    assert(expected.kind === "html" ? /text\/html/i.test(type) : !/text\/html/i.test(type), `Unexpected public content type: ${expected.path}`)
    const reader = response.body?.getReader(), chunks = []
    assert(reader, "Missing public response body")
    let size = 0
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break
        size += part.value.length
        assert(size <= (expected.bytes ?? 8 * 1024 * 1024), `Public resource size changed: ${expected.path}`)
        chunks.push(part.value)
      }
    } finally { await reader.cancel().catch(() => undefined) }
    const bytes = Buffer.concat(chunks), digest = hash(bytes)
    if (expected.verification === "dynamic-build-id-and-asset") assert(bytes.includes(Buffer.from(expected.requiredAsset)), "Dynamic public HTML lacks the attested page asset")
    else assert(size === expected.bytes && digest === expected.sha256, `Public resource differs from actual producer bytes: ${expected.path}`)
    const documentProof = expected.kind === "html" ? publicDocumentProof({ url, status: response.status, body: bytes.toString("utf8"), observedAt: stamp(), headers: { "content-type": type, "x-robots-tag": response.headers.get("x-robots-tag") ?? "" } }, attestation, pins) : null
    resources.push({ path: expected.path, sha256: digest, bytes: size, contentType: type, encoding: response.headers.get("content-encoding") ?? "identity", robots: response.headers.get("x-robots-tag") ?? null, documentProof })
  }
  for (const path of infrastructurePaths) {
    const url = new URL(path, PUBLIC_ORIGIN).href
    let response
    try { response = await fetcher(url, { redirect: "manual", credentials: "omit", signal: AbortSignal.timeout(20000), headers: { "Accept-Encoding": "br, gzip" } }) }
    catch { throw new Error(`Public infrastructure fetch failed: ${path}`) }
    assert(response.status === 200 && response.url === url, `Public infrastructure unavailable, protected or redirected: ${path}`)
    const chunks = [], reader = response.body?.getReader(); let size = 0
    assert(reader, "Missing public infrastructure response body")
    try {
      while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; assert(size <= 256 * 1024, "Public infrastructure exceeds its bound"); chunks.push(next.value) }
    } finally { await reader.cancel().catch(() => undefined) }
    const bytes = Buffer.concat(chunks)
    infrastructure.push({ path, bytes: size, sha256: hash(bytes), body: bytes.toString("utf8"), contentType: response.headers.get("content-type") ?? "", robots: response.headers.get("x-robots-tag") ?? null })
  }
  validateInfrastructure(infrastructure)
  const resourcesFinishedAt = stamp(), targetAfter = collectPublicTargetReceipt(attestation, pins, { run, now }), finishedAt = stamp()
  assertPublicTargetPair({ before: targetBefore, after: targetAfter, collectionStartedAt: resourcesStartedAt, collectionFinishedAt: resourcesFinishedAt }, attestation, pins)
  return { ...binding, schemaVersion: PUBLIC_SERVING_SCHEMA, result: "pass", startedAt, finishedAt, resourcesStartedAt, resourcesFinishedAt, targetBefore, targetAfter, resources, infrastructure }
}

export function assertPublicServingPair(pair, attestation, pins) {
  const binding = publicBinding(attestation, pins)
  for (const phase of ["before", "after"]) {
    const receipt = pair?.[phase]
    assert(receipt?.schemaVersion === PUBLIC_SERVING_SCHEMA && receipt.result === "pass", `Missing public ${phase} serving receipt`)
    for (const [key, value] of Object.entries(binding)) if (key !== "schemaVersion") assert.deepEqual(receipt[key], value, "Mixed public serving identity")
    assert(timestamp(receipt.startedAt) <= timestamp(receipt.targetBefore.startedAt) && timestamp(receipt.targetAfter.finishedAt) <= timestamp(receipt.finishedAt), "Invalid public serving chronology")
    assertPublicTargetPair({ before: receipt.targetBefore, after: receipt.targetAfter, collectionStartedAt: receipt.resourcesStartedAt, collectionFinishedAt: receipt.resourcesFinishedAt }, attestation, pins)
    validateInfrastructure(receipt.infrastructure)
    assert.deepEqual(receipt.resources?.map(item => item.path), attestation.resources.map(item => item.path), "Incomplete public resource coverage")
    for (const [index, expected] of attestation.resources.entries()) {
      const resource = receipt.resources[index]
      assert(sha256(resource.sha256) && Number.isSafeInteger(resource.bytes) && resource.bytes > 0, "Missing public resource identity")
      assert(expected.kind === "html" ? /text\/html/i.test(resource.contentType) : !/text\/html/i.test(resource.contentType), "Invalid public resource content type")
      if (expected.verification !== "dynamic-build-id-and-asset") assert(resource.sha256 === expected.sha256 && resource.bytes === expected.bytes, "Public resource identity changed")
      if (expected.kind === "html") {
        assertPublicDocumentProof(resource.documentProof, attestation, pins, { route: expected.path, after: receipt.resourcesStartedAt, before: receipt.resourcesFinishedAt })
        assert(resource.documentProof.documentSha256 === resource.sha256 && resource.documentProof.bytes === resource.bytes && resource.documentProof.contentType === resource.contentType && resource.documentProof.robotsHeader === (resource.robots ?? ""), "Public serving and document proof disagree")
      } else assert(resource.documentProof === null, "Asset has unexpected document proof")
    }
  }
  assert(timestamp(pair.collectionStartedAt) >= timestamp(pair.before.finishedAt) && timestamp(pair.after.startedAt) >= timestamp(pair.collectionFinishedAt), "Public serving does not bracket measured collection")
  assertPublicTargetPair({ before: pair.before.targetAfter, after: pair.after.targetBefore, collectionStartedAt: pair.collectionStartedAt, collectionFinishedAt: pair.collectionFinishedAt }, attestation, pins)
  assert.deepEqual(pair.before.resources.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })), pair.after.resources.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })), "Public decoded HTML/assets changed during collection")
  assert.deepEqual(pair.before.infrastructure, pair.after.infrastructure, "Public robots/sitemap/manifest changed during collection")
}
