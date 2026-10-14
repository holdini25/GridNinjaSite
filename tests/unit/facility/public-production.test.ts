// @vitest-environment node
import { createHash } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { expectedHostedConfig, hostedOrigin } from "../../../scripts/facility/hosted-attestation.mjs"
import { performanceMatrix } from "../../../scripts/facility/lighthouse-matrix.mjs"
import { collectProductionMetadata, productionMetadataPaths, PRODUCTION_PROJECT } from "../../../scripts/facility/vercel-production-metadata.mjs"
import { assertPublicDocumentProof, assertPublicServingPair, assertPublicTargetPair, collectPublicTargetReceipt, publicBinding, publicDocumentProof, validatePublicAttestation, validatePublicTargetReceipt, verifyPublicServing } from "../../../scripts/facility/public-production.mjs"
import { PUBLIC_MANIFEST, PUBLIC_SITEMAP_URLS } from "../../../scripts/facility/public-infrastructure-policy.mjs"
import buildWebAppManifest from "../../../src/lib/web-app-manifest"
import { indexableSeoRoutes } from "../../../src/seo/route-manifest"
import { absoluteUrl } from "../../../src/seo/policy"

const now = Date.parse("2026-01-02T00:00:00.000Z")
const stamp = (offset = 0) => new Date(now + offset).toISOString()
const sha = (value: string) => createHash("sha256").update(value).digest("hex")
const origin = "https://gridninja.ai", immutableOrigin = "https://gridninja-actual-deployment.vercel.app"
const deploymentId = "dpl_IndependentProduction", deploymentCommit = "a".repeat(40), buildId = "actual-production-build"
const assetPath = "/_next/static/chunks/app/(marketing)/demo/page-deadbeef.js", asset = "public emitted asset"
const briefPath = "/evidence/assessments/demo-01-b/v1.0.0"
const originalConfig = Buffer.from('{"$schema":"https://openapi.vercel.sh/vercel.json"}')
const configTransformation = expectedHostedConfig(originalConfig, { projectName: "gridninja", originalCanonicalSha256: sha(originalConfig.toString()) }).transformation
const appBody = (route: string, id = buildId) => `<!doctype html><html><head><link rel="canonical" href="${new URL(route, origin).href}"></head><body><h1>Example</h1><script src="${assetPath}"></script><script>self.__next_f.push(${JSON.stringify([1, `0:${JSON.stringify({ b: id })}\n`])})</script></body></html>`
const pagesBody = (id = buildId) => `<!doctype html><html><head><link rel="canonical" href="${origin}/contact"></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ buildId: id, page: "/contact", gsp: true, isFallback: false, props: { pageProps: { observability: true } } })}</script></body></html>`
const briefBody = '<!doctype html><html><head><meta name="robots" content="noindex"></head><body>Published brief</body></html>'
const bodies = Object.fromEntries(performanceMatrix("premium-civic").routes.map(route => [route, route === "/contact" ? pagesBody() : route === briefPath ? briefBody : appBody(route)]))
const infrastructure = {
  "/robots.txt": { body: "User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /internal/\nHost: https://gridninja.ai/\nSitemap: https://gridninja.ai/sitemap.xml\n", type: "text/plain" },
  "/sitemap.xml": { body: `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${PUBLIC_SITEMAP_URLS.map(url => `<url><loc>${url}</loc></url>`).join("")}</urlset>`, type: "application/xml" },
  "/manifest.webmanifest": { body: JSON.stringify(PUBLIC_MANIFEST), type: "application/manifest+json" },
}
function fixture() {
  const buildSettings = { observability: true, httpsPolicy: true, csp: "enforce", verification: "live", verificationSiteKeySha256: sha("approved-public-site-key"), privateCandidate: null }
  const releases = [{ release: "facility-v1", manifestSha256: sha("release") }]
  const pins = {
    schemaVersion: "gridninja-public-production-pins.v1", origin, projectId: PRODUCTION_PROJECT.id, projectName: "gridninja", scope: PRODUCTION_PROJECT.scope,
    deploymentId, deploymentCommit, immutableOrigin, buildId, sourceRevision: sha("repository"), hostedSourceRevision: sha("hosted-source"), sourceMode: "vercel-project-metadata.v1", configTransformation,
    harnessRevision: sha("harness"), buildSettings, releases,
    providerSettings: { projectNodeVersion: "24.x", deploymentNodeVersion: "22.x", gitConnected: true, protectionScope: "all_except_custom_domains" },
  }
  const attestation = {
    schemaVersion: "gridninja-hosted-build.v1", recordedAt: stamp(-3600_000), origin: immutableOrigin, environment: "production",
    identity: { sourceRevision: pins.hostedSourceRevision, buildId, buildSettings, releases }, harnessRevision: pins.harnessRevision,
    sourceBinding: { repositorySourceRevision: pins.sourceRevision, hostedSourceRevision: pins.hostedSourceRevision, configTransformation },
    resources: [...performanceMatrix("premium-civic").routes.map(path => path === "/demo"
      ? { path, kind: "html", verification: "dynamic-build-id-and-asset", requiredAsset: assetPath, sha256: null, bytes: null }
      : { path, kind: "html", sha256: sha(bodies[path]), bytes: Buffer.byteLength(bodies[path]) }),
    { path: assetPath, kind: "asset", sha256: sha(asset), bytes: Buffer.byteLength(asset) }],
  }
  return { pins, attestation }
}
function providerData() {
  return [
    { id: PRODUCTION_PROJECT.id, name: "gridninja", targets: { production: { id: deploymentId } }, nodeVersion: "24.x", link: { type: "github" }, ssoProtection: { deploymentType: "all_except_custom_domains" }, env: [{ key: "SECRET", value: "must-never-be-saved" }] },
    { id: deploymentId, projectId: PRODUCTION_PROJECT.id, url: new URL(immutableOrigin).hostname, target: "production", readyState: "READY", meta: { githubCommitSha: deploymentCommit }, projectSettings: { nodeVersion: "22.x" }, env: { PRIVATE: "must-never-be-saved" } },
    { alias: "gridninja.ai", projectId: PRODUCTION_PROJECT.id, deploymentId, redirect: null },
    { alias: "www.gridninja.ai", projectId: PRODUCTION_PROJECT.id, deploymentId, redirect: "gridninja.ai" },
  ]
}
function provider(values: unknown[] = providerData()) {
  let index = 0
  return vi.fn(() => ({ status: 0, stdout: JSON.stringify(values[index++ % values.length]), stderr: "ignored-provider-detail" }))
}
function response(url: string, body: string, type: string, status = 200) {
  const result = new Response(body, { status, headers: { "content-type": type, "set-cookie": "never-retain=value" } })
  Object.defineProperty(result, "url", { value: url })
  return result
}
const publicFetch = vi.fn(async (url: string, options: RequestInit) => {
  expect(options.redirect).toBe("manual")
  expect(options.credentials).toBe("omit")
  expect(options.headers).toEqual({ "Accept-Encoding": "br, gzip" })
  const path = new URL(url).pathname
  expect(new URL(url).origin).toBe(origin)
  if (path in infrastructure) {
    const item = infrastructure[path as keyof typeof infrastructure]
    return response(url, item.body, item.type)
  }
  if (path === assetPath) return response(url, asset, "application/javascript")
  expect(Object.hasOwn(bodies, path)).toBe(true)
  return response(url, bodies[path], "text/html")
})
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); publicFetch.mockClear() })
afterEach(() => vi.useRealTimers())

describe("fixed read-only production metadata", () => {
  it("uses exactly four pinned CLI GETs and projects only nonsecret identity metadata", () => {
    const run = provider(), receipt = collectProductionMetadata(deploymentId, { run, now: () => now })
    expect(run).toHaveBeenCalledTimes(4)
    for (const [index, call] of run.mock.calls.entries()) {
      const [command, args, options] = call as unknown as [string, string[], { timeout: number; stdio: string[] }]
      expect(command).toBe("npm")
      expect(args).toEqual(["exec", "--yes", "--package=vercel@64.0.2", "--", "vercel", "api", productionMetadataPaths(deploymentId)[index], "--method", "GET", "--scope", PRODUCTION_PROJECT.scope, "--raw"])
      expect(options.timeout).toBe(30_000)
      expect(options.stdio).toEqual(["ignore", "pipe", "pipe"])
    }
    expect(JSON.stringify(receipt)).not.toMatch(/must-never-be-saved|SECRET|PRIVATE|ignored-provider/)
    expect(receipt.requests.map(item => item.method)).toEqual(["GET", "GET", "GET", "GET"])
  })
  it("does not follow changed project targets or conflicting aliases", () => {
    const values = providerData(); values[0].targets!.production.id = "dpl_Changed"
    const run = provider(values)
    expect(() => collectProductionMetadata(deploymentId, { run })).toThrow("Current production target")
    expect(run).toHaveBeenCalledTimes(1)
    const contradictory = providerData(); Object.assign(contradictory[2], { deployment: { id: "dpl_Other" } })
    expect(() => collectProductionMetadata(deploymentId, { run: provider(contradictory) })).toThrow("Conflicting")
  })
  it.each([
    { status: 1, stdout: "private stdout", stderr: "private stderr" },
    { status: 0, stdout: "private not JSON" },
    { status: 0, stdout: "{}", signal: "SIGTERM" },
    { status: 0, stdout: "x".repeat(2 * 1024 * 1024 + 1) },
  ])("fails closed without disclosing provider output", result => {
    expect(() => collectProductionMetadata(deploymentId, { run: () => result })).toThrow()
    try { collectProductionMetadata(deploymentId, { run: () => result }) } catch (error) { expect(String(error)).not.toMatch(/private stdout|private stderr|private not JSON/) }
  })
})

describe("independent public deployment binding", () => {
  it("keeps the immutable attestation unchanged and rejects missing producer proof before any request", async () => {
    const { pins, attestation } = fixture(), before = JSON.stringify(attestation), run = provider()
    expect(validatePublicAttestation(attestation, pins)).toBe(attestation)
    expect(publicBinding(attestation, pins)).toMatchObject({ origin, immutableOrigin, deploymentId, deploymentCommit, buildId })
    expect(JSON.stringify(attestation)).toBe(before)
    expect(() => hostedOrigin(origin)).toThrow("immutable")
    await expect(verifyPublicServing(null, { pins, run, fetcher: publicFetch })).rejects.toThrow("actual deployment's producer attestation")
    expect(run).not.toHaveBeenCalled(); expect(publicFetch).not.toHaveBeenCalled()
  })
  it.each(["origin", "deploymentCommit", "buildId", "sourceRevision", "hostedSourceRevision", "harnessRevision"])("rejects a changed %s pin", key => {
    const { pins, attestation } = fixture()
    const changed = { ...pins, [key]: "wrong" }
    expect(() => validatePublicAttestation(attestation, changed)).toThrow()
  })
  it("rejects protected/test/local build settings and mutated producer identities", () => {
    for (const change of [{ verification: "unconfigured" }, { verification: "test" }, { observability: false }, { httpsPolicy: false }, { csp: "report-only" }, { privateCandidate: {} }]) {
      const { pins, attestation } = fixture(); Object.assign(pins.buildSettings, change)
      expect(() => validatePublicAttestation(attestation, pins)).toThrow("approved live")
    }
    const { pins, attestation } = fixture()
    expect(() => validatePublicAttestation({ ...attestation, environment: "preview" }, pins)).toThrow("production deployment")
    expect(() => validatePublicAttestation({ ...attestation, origin }, pins)).toThrow()
    expect(() => validatePublicAttestation({ ...attestation, identity: { ...attestation.identity, buildId: "another" } }, pins)).toThrow("producer")
  })
  it("requires unique complete release manifest digests in independent pins", () => {
    const { pins, attestation } = fixture()
    expect(() => validatePublicAttestation({ ...attestation }, { ...pins, releases: [...pins.releases, ...pins.releases] })).toThrow("duplicate")
    expect(() => validatePublicAttestation(attestation, { ...pins, releases: [{ release: "facility-v1" }] })).toThrow("release pin")
  })
  it("requires fresh complete authoritative project, current deployment and both aliases", () => {
    const { pins, attestation } = fixture()
    const receipt = collectPublicTargetReceipt(attestation, pins, { run: provider(), now: () => now })
    expect(validatePublicTargetReceipt(receipt, attestation, pins)).toBe(receipt)
    for (const mutate of [
      (r: typeof receipt) => { r.current.readyState = "BUILDING" },
      (r: typeof receipt) => { r.current.target = "preview" },
      (r: typeof receipt) => { r.current.gitCommitSha = "b".repeat(40) },
      (r: typeof receipt) => { r.current.url = "other.vercel.app" },
      (r: typeof receipt) => { r.project.currentProductionDeploymentId = "dpl_Other" },
      (r: typeof receipt) => { r.current.nodeVersion = "24.x" },
      (r: typeof receipt) => { r.aliases.pop() },
      (r: typeof receipt) => { r.aliases[0].deploymentId = "dpl_Other" },
      (r: typeof receipt) => { r.aliases[1].redirect = "foreign.example" },
      (r: typeof receipt) => { r.requests.pop() },
      (r: typeof receipt) => { r.requests[1].method = "POST" },
      (r: typeof receipt) => { r.requests[2].path = "/v9/projects/other/env" },
      (r: typeof receipt) => { r.requests[3].finishedAt = stamp(1) },
      (r: typeof receipt) => { r.startedAt = stamp(-121_000) },
    ]) {
      const changed = structuredClone(receipt); mutate(changed)
      expect(() => validatePublicTargetReceipt(changed, attestation, pins)).toThrow()
    }
    expect(() => validatePublicTargetReceipt(receipt, attestation, pins, { referenceTime: now + 120_001 })).toThrow("Stale")
    expect(() => assertPublicTargetPair({ before: receipt, after: receipt, collectionStartedAt: stamp(), collectionFinishedAt: stamp(1) }, attestation, pins)).toThrow()
  })
})

describe("captured public main-document identity", () => {
  function proofFor(route: string, overrides = {}) {
    const { attestation, pins } = fixture()
    const input = { url: new URL(route, origin).href, status: 200, body: bodies[route], observedAt: stamp(), headers: { "content-type": "text/html" }, ...overrides }
    return { attestation, pins, input, proof: () => publicDocumentProof(input, attestation, pins) }
  }
  it.each(["/", "/contact", "/demo", briefPath])("verifies recorded %s body without a new request", route => {
    const { proof, attestation, pins } = proofFor(route), value = proof()
    expect(value.schemaVersion).toBe("gridninja-public-document.v1")
    expect(() => assertPublicDocumentProof(value, attestation, pins, { route, after: stamp(-1), before: stamp() })).not.toThrow()
    expect(publicFetch).not.toHaveBeenCalled()
    expect(() => assertPublicDocumentProof({ ...value, documentSha256: "invalid" }, attestation, pins, { route, after: stamp(-1), before: stamp() })).toThrow()
    if (route !== "/demo") expect(() => assertPublicDocumentProof({ ...value, documentSha256: sha("different") }, attestation, pins, { route, after: stamp(-1), before: stamp() })).toThrow()
  })
  it("rejects changed static bytes, duplicate Pages bootstrap and spoofed dynamic build text", () => {
    expect(proofFor("/", { body: appBody("/", "other") }).proof).toThrow("producer bytes")
    const { attestation, pins } = fixture()
    const wrongPages = pagesBody() + '<div id="__NEXT_DATA__"></div>'
    const contact = attestation.resources.find(item => item.path === "/contact")!
    contact.sha256 = sha(wrongPages); contact.bytes = Buffer.byteLength(wrongPages)
    expect(() => publicDocumentProof({ url: origin + "/contact", status: 200, body: wrongPages, observedAt: stamp(), headers: { "content-type": "text/html" } }, attestation, pins)).toThrow("unique Pages")
    expect(proofFor("/demo", { body: appBody("/demo", "wrong") + buildId }).proof).toThrow("Flight root")
    expect(proofFor("/demo", { body: appBody("/demo").replace(assetPath, "wrong.js") }).proof).toThrow("page asset")
  })
  it.each([
    { url: "https://foreign.example/demo" },
    { url: origin + "/demo?interactive=1" },
    { url: origin + "/api/contact" },
    { status: 302 },
    { headers: { "content-type": "text/html", "x-robots-tag": "noindex" } },
    { body: appBody("/demo").replace('href="https://gridninja.ai/demo"', 'href="https://foreign.example/demo"') },
    { body: appBody("/demo").replace("</head>", '<meta name="Googlebot" content="noindex"></head>') },
  ])("rejects public identity/indexing drift", change => expect(proofFor("/demo", change).proof).toThrow())
  it("revalidates captured route, binding, marker and collection window", () => {
    const { attestation, pins, proof } = proofFor("/demo"), value = proof(), options = { route: "/demo", after: stamp(-1), before: stamp() }
    for (const change of [{ schemaVersion: "old" }, { deploymentId: "dpl_Other" }, { path: "/contact" }, { observedAt: stamp(-100) }, { buildMarker: { kind: "app-flight-root", value: "wrong" } }, { requiredAsset: "/_next/static/other.js" }, { robotsMeta: "noindex" }]) expect(() => assertPublicDocumentProof({ ...value, ...change }, attestation, pins, options)).toThrow()
  })
})

describe("public serving before/after verification", () => {
  it("binds exact infrastructure expectations to the checked-in source builders", () => {
    expect(PUBLIC_MANIFEST).toEqual(buildWebAppManifest())
    expect([...PUBLIC_SITEMAP_URLS].sort()).toEqual(indexableSeoRoutes.map(route => absoluteUrl(route.path)).sort())
  })
  it("checks all attested resources plus infrastructure and freshly brackets the collection", async () => {
    const { attestation, pins } = fixture(), run = provider()
    const before = await verifyPublicServing(attestation, { pins, run, fetcher: publicFetch, now: () => now })
    const after = await verifyPublicServing(attestation, { pins, run, fetcher: publicFetch, now: () => now })
    const pair = { before, after, collectionStartedAt: stamp(), collectionFinishedAt: stamp() }
    expect(() => assertPublicServingPair(pair, attestation, pins)).not.toThrow()
    expect(before.resources).toHaveLength(attestation.resources.length)
    expect(before.infrastructure.map(item => item.path)).toEqual(Object.keys(infrastructure))
    expect(run).toHaveBeenCalledTimes(16)
    expect(publicFetch).toHaveBeenCalledTimes((attestation.resources.length + 3) * 2)
    expect(JSON.stringify(before)).not.toMatch(/never-retain|must-never-be-saved/)
    for (const mutate of [
      (r: typeof after) => { r.resources.pop() },
      (r: typeof after) => { r.resources[0].sha256 = sha("changed") },
      (r: typeof after) => { r.targetBefore.aliases[0].deploymentId = "dpl_Other" },
      (r: typeof after) => { r.infrastructure.pop() },
      (r: typeof after) => { r.infrastructure[0].body = "User-Agent: *\nDisallow: /" },
      (r: typeof after) => { r.resources.find(item => item.path === "/demo")!.documentProof = null },
    ]) {
      const changed = structuredClone(after); mutate(changed)
      expect(() => assertPublicServingPair({ ...pair, after: changed }, attestation, pins)).toThrow()
    }
  })
  it.each(["redirect", "asset-change", "manifest-auth", "robots-block", "foreign-sitemap", "empty-sitemap", "missing-founder", "extra-sitemap-route", "bad-manifest", "missing-icon", "extra-manifest-field"])("rejects actual public %s serving failure", async mode => {
    const { attestation, pins } = fixture()
    const fetcher = async (url: string, options: RequestInit) => {
      const path = new URL(url).pathname
      if (mode === "redirect" && path === "/") return response(url, "redirect", "text/html", 302)
      if (mode === "asset-change" && path === assetPath) return response(url, "changed", "application/javascript")
      if (mode === "manifest-auth" && path === "/manifest.webmanifest") return response(url, "login", "text/html", 401)
      if (mode === "robots-block" && path === "/robots.txt") return response(url, "User-agent: *\nDisallow: /", "text/plain")
      if (mode === "foreign-sitemap" && path === "/sitemap.xml") return response(url, infrastructure[path].body.replaceAll(origin, "https://foreign.example"), "application/xml")
      if (mode === "empty-sitemap" && path === "/sitemap.xml") return response(url, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', "application/xml")
      if (mode === "missing-founder" && path === "/sitemap.xml") return response(url, infrastructure[path].body.replace("<url><loc>https://gridninja.ai/about/founders</loc></url>", ""), "application/xml")
      if (mode === "extra-sitemap-route" && path === "/sitemap.xml") return response(url, infrastructure[path].body.replace("</urlset>", "<url><loc>https://gridninja.ai/extra</loc></url></urlset>"), "application/xml")
      if (mode === "bad-manifest" && path === "/manifest.webmanifest") return response(url, "{}", "application/manifest+json")
      if (mode === "missing-icon" && path === "/manifest.webmanifest") return response(url, JSON.stringify({ ...PUBLIC_MANIFEST, icons: PUBLIC_MANIFEST.icons.slice(1) }), "application/manifest+json")
      if (mode === "extra-manifest-field" && path === "/manifest.webmanifest") return response(url, JSON.stringify({ ...PUBLIC_MANIFEST, extra: true }), "application/manifest+json")
      return publicFetch(url, options)
    }
    await expect(verifyPublicServing(attestation, { pins, run: provider(), fetcher, now: () => now })).rejects.toThrow()
  })
})
