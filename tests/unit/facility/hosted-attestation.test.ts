import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { assertHostedServingPair, attestHostedConfig, expectedHostedConfig, hostedAttestationLogLines, hostedBinding, hostedConfigDiagnostics, hostedOrigin, hostedOutputDiagnostics, hostedPrerenderPath, parseHostedAttestationLogs, validateHostedAttestation, verifyHostedServing } from "../../../scripts/facility/hosted-attestation.mjs"
import { createHostedAuth, hostedCookie, redactHostedSecrets } from "../../../scripts/facility/hosted-auth.mjs"
import { assertLighthouseMatrixIndex, lighthousePriorityGroups, performanceMatrix } from "../../../scripts/facility/lighthouse-matrix.mjs"
import { assertLocalMeasurementOrigin, assertSameBuild, expectedHostedSource, settingsDigest, sourceSnapshot } from "../../../scripts/facility/performance-contract.mjs"

const origin = "https://gridninja-build-abc.vercel.app"
const sha = (value: string) => createHash("sha256").update(value).digest("hex")
const body = "<!doctype html><h1>GridNinja</h1>"
const asset = "console.log('GridNinja')"
const originalConfig = { $schema: "https://openapi.vercel.sh/vercel.json", git: { deploymentEnabled: { "codex/assessment-yield-upgrade": false } } }
const repositoryConfig = Buffer.from(`${JSON.stringify(originalConfig, null, 2)}\n`)
const configPins = { projectName: "synthetic-isolated-project", originalCanonicalSha256: sha(JSON.stringify(originalConfig)) }
const configTransformation = expectedHostedConfig(repositoryConfig, configPins).transformation
const fixture = () => ({
  schemaVersion: "gridninja-hosted-build.v1", recordedAt: "2026-01-01T00:00:00.000Z", origin, environment: "preview",
  identity: { sourceRevision: sha("source"), buildId: "remote-build-id", releases: [{ release: "facility-v1", manifestSha256: sha("release") }], buildSettings: { observability: true, httpsPolicy: true } },
  harnessRevision: sha("harness"),
  sourceBinding: { repositorySourceRevision: sha("repository-source"), hostedSourceRevision: sha("source"), configTransformation: { ...configTransformation } },
  resources: [...performanceMatrix("premium-civic").routes.map(path => ({ path, kind: "html", sha256: sha(body), bytes: Buffer.byteLength(body) })), { path: "/_next/static/chunk.js", kind: "asset", sha256: sha(asset), bytes: Buffer.byteLength(asset) }],
})
const options = { baseURL: origin, sourceRevision: sha("repository-source"), hostedSourceRevision: sha("source"), configTransformation, harnessRevision: sha("harness") }
const response = (url: string, text: string, headers: Record<string, string> = {}, status = 200) => {
  const result = new Response(text, { status, headers })
  Object.defineProperty(result, "url", { value: url })
  return result
}
const cleanFetch = async (url: string | URL | Request) => {
  const path = new URL(String(url)).pathname
  return response(String(url), path.endsWith(".js") ? asset : body, { "content-type": path.endsWith(".js") ? "application/javascript" : "text/html", "content-encoding": "br", "x-robots-tag": "noindex", "set-cookie": "private=never-save" })
}

describe("hosted build attestation", () => {
  it("permits only the explicitly pinned project metadata and exact provider serialization", () => {
    const expected = expectedHostedConfig(repositoryConfig, configPins)
    expect(expected.bytes.toString()).toBe(`${JSON.stringify({ ...originalConfig, name: configPins.projectName, version: 2 })}\n`)
    expect(attestHostedConfig(expected.bytes, configPins)).toEqual(expected.transformation)
    expect(expected.transformation.builtConfigSha256).toBe(sha(expected.bytes.toString()))
    for (const pins of [{ ...configPins, projectName: undefined }, { ...configPins, projectName: "wrong-project" }, { ...configPins, originalCanonicalSha256: undefined }, { ...configPins, originalCanonicalSha256: sha("wrong") }]) {
      expect(() => attestHostedConfig(expected.bytes, pins)).toThrow()
    }
    for (const rewrite of [
      expected.bytes.toString().trimEnd(),
      `${expected.bytes.toString()}\n`,
      `${JSON.stringify({ ...originalConfig, name: configPins.projectName, version: 2 }, null, 2)}\n`,
      `${JSON.stringify({ name: configPins.projectName, ...originalConfig, version: 2 })}\n`,
      `${JSON.stringify({ ...originalConfig, name: configPins.projectName, version: 1 })}\n`,
      `${JSON.stringify({ ...originalConfig, name: configPins.projectName, version: 2, framework: "nextjs" })}\n`,
      `${JSON.stringify({ ...originalConfig, git: {}, name: configPins.projectName, version: 2 })}\n`,
    ]) expect(() => attestHostedConfig(Buffer.from(rewrite), configPins)).toThrow()
    for (const metadata of [{ name: configPins.projectName }, { version: 2 }]) expect(() => expectedHostedConfig(Buffer.from(JSON.stringify({ ...originalConfig, ...metadata })), configPins)).toThrow("already contains")
    expect(() => expectedHostedConfig(Buffer.from(JSON.stringify({ ...originalConfig, git: {} })), configPins)).toThrow("differs from its pin")
  })
  it("hashes every source byte while replacing only vercel.json and preserves both identities in receipts", async () => {
    const root = await mkdtemp(join(tmpdir(), "gridninja-hosted-transformation-"))
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", FACILITY_HOSTED_PROJECT_NAME: configPins.projectName, FACILITY_EXPECTED_VERCEL_CONFIG_SHA256: configPins.originalCanonicalSha256 }
    const paths = ["src", "package.json", "vercel.json"]
    try {
      await mkdir(join(root, "src"))
      await writeFile(join(root, "src/page.ts"), "application source")
      await writeFile(join(root, "package.json"), "{}")
      await writeFile(join(root, "vercel.json"), repositoryConfig)
      const local = await sourceSnapshot(paths, root), expected = await expectedHostedSource(env, root, paths)
      expect(expected.sourceRevision).toBe(local.sourceRevision)
      expect(expected.hostedSourceRevision).not.toBe(local.sourceRevision)
      await writeFile(join(root, "vercel.json"), expectedHostedConfig(repositoryConfig, configPins).bytes)
      expect((await sourceSnapshot(paths, root)).sourceRevision).toBe(expected.hostedSourceRevision)
      await writeFile(join(root, "vercel.json"), repositoryConfig)
      const record = fixture()
      record.identity.sourceRevision = expected.hostedSourceRevision!
      record.sourceBinding = { repositorySourceRevision: expected.sourceRevision, hostedSourceRevision: expected.hostedSourceRevision!, configTransformation: expected.configTransformation }
      expect(validateHostedAttestation(record, { ...options, ...expected })).toBe(record)
      expect(hostedBinding(record)).toMatchObject(record.sourceBinding)
      const receipt = JSON.parse(JSON.stringify(await verifyHostedServing(record, { baseURL: origin, fetcher: cleanFetch })))
      expect(receipt.repositorySourceRevision).toBe(local.sourceRevision)
      expect(receipt.hostedSourceRevision).toBe(expected.hostedSourceRevision)
      for (const [file, value] of [["src/page.ts", "changed application source"], ["package.json", '{"changed":true}'], ["src/new.ts", "new unexpected source"]]) {
        await writeFile(join(root, file), value)
        const changed = await expectedHostedSource(env, root, paths)
        expect(changed.hostedSourceRevision).not.toBe(expected.hostedSourceRevision)
        expect(() => validateHostedAttestation(record, { ...options, ...changed })).toThrow("source")
      }
      await expect(expectedHostedSource({ NODE_ENV: "test" }, root, paths)).rejects.toThrow("pinned hosted project")
      await expect(expectedHostedSource({ ...env, FACILITY_HOSTED_PROJECT_NAME: "other-project" }, root, paths).then(changed => validateHostedAttestation(record, { ...options, ...changed }))).rejects.toThrow("source")
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it("rejects forged or missing transformation and repository identities even with matching built source", () => {
    for (const mutation of [
      { projectName: "other-project" }, { originalCanonicalSha256: sha("other") }, { builtConfigSha256: sha("other") }, { builtConfigBytes: 1 }, { version: 1 },
    ]) {
      const record = fixture()
      Object.assign(record.sourceBinding.configTransformation, mutation)
      expect(() => validateHostedAttestation(record, options)).toThrow("source binding")
    }
    const otherRepository = fixture(); otherRepository.sourceBinding.repositorySourceRevision = sha("other")
    expect(() => validateHostedAttestation(otherRepository, options)).toThrow("source binding")
    expect(() => validateHostedAttestation(fixture(), { ...options, hostedSourceRevision: sha("changed-built-file") })).toThrow("source binding")
    expect(() => validateHostedAttestation({ ...fixture(), sourceBinding: undefined }, options)).toThrow("source binding")
    expect(() => validateHostedAttestation(fixture(), { ...options, configTransformation: undefined })).toThrow("independently computed")
    // The producer can recover canonical contents after provider metadata is
    // added, but only the consumer has the repository's original key order.
    // Equal canonical JSON never excuses different built bytes at that boundary.
    const reordered = Buffer.from(`${JSON.stringify({ git: originalConfig.git, $schema: originalConfig.$schema, name: configPins.projectName, version: 2 })}\n`)
    const record = fixture()
    record.sourceBinding.configTransformation = attestHostedConfig(reordered, configPins)
    expect(record.sourceBinding.configTransformation.originalCanonicalSha256).toBe(configTransformation.originalCanonicalSha256)
    expect(record.sourceBinding.configTransformation.builtConfigSha256).not.toBe(configTransformation.builtConfigSha256)
    expect(() => validateHostedAttestation(record, options)).toThrow("source binding")
  })
  it("discloses exact config bytes only for the approved public shape and matching expected canonical digest", () => {
    const approved = { $schema: "https://openapi.vercel.sh/vercel.json", git: { deploymentEnabled: { "codex/assessment-yield-upgrade": false } } }
    const bytes = Buffer.from(`${JSON.stringify(approved, null, 4)}\n`), canonicalHash = sha(JSON.stringify(approved))
    const result = hostedConfigDiagnostics(bytes, canonicalHash)
    expect(result.expectedMatches).toBe(true)
    expect(result.encodedBytes).toBe(bytes.toString("base64"))
    expect(result.sha256).toBe(createHash("sha256").update(bytes).digest("hex"))
    expect(hostedConfigDiagnostics(bytes, sha("wrong"))).not.toHaveProperty("encodedBytes")
    expect(hostedConfigDiagnostics(bytes, undefined)).not.toHaveProperty("encodedBytes")
    const unknown = Buffer.from(JSON.stringify({ ...approved, env: { KEY: "synthetic-private-value" }, buildCommand: "synthetic-secret-command", version: 2, framework: "nextjs" }))
    const unknownCanonicalHash = hostedConfigDiagnostics(unknown, undefined).canonicalSha256
    const diagnostic = hostedConfigDiagnostics(unknown, unknownCanonicalHash)
    expect(diagnostic.expectedMatches).toBe(true)
    expect(diagnostic.knownPublicConfig).toBe(false)
    expect(diagnostic).not.toHaveProperty("encodedBytes")
    expect(JSON.stringify(diagnostic)).not.toMatch(/synthetic-private-value|synthetic-secret-command/)
    expect(diagnostic.fields.find(field => field.key === "env")).toEqual({ key: "env", type: "object", sha256: sha('{"KEY":"synthetic-private-value"}') })
    expect(diagnostic.fields.find(field => field.key === "version")?.value).toBe(2)
    expect(diagnostic.fields.find(field => field.key === "framework")?.value).toBe("nextjs")
  })
  it("selects the emitted adapter cache identity even when a stale legacy HTML file also exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "gridninja-hosted-output-"))
    const save = async (path: string, value: string) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), value) }
    const source = "/(marketing)/page", cache = `server/route-cache/APP_PAGE/${sha(source)}/$/index.html`
    try {
      await save("required-server-files.json", JSON.stringify({ config: { adapterPath: "<omitted but set>", env: { PRIVATE: "must-not-be-logged" } } }))
      await save("app-path-routes-manifest.json", JSON.stringify({ [source]: "/" }))
      await save("prerender-manifest.json", JSON.stringify({ routes: { "/": { srcRoute: "/", response: "complete", routeType: "page", initialRevalidateSeconds: false } } }))
      await save(cache, "actual-adapter-build")
      await save("server/app/index.html", "stale-other-build")
      expect(await hostedPrerenderPath("/", root)).toBe(join(root, cache))
      expect(await readFile(await hostedPrerenderPath("/", root), "utf8")).toBe("actual-adapter-build")
      expect(await hostedOutputDiagnostics(root)).toEqual({ adapter: true, htmlFiles: ["server/app/index.html", cache] })
      await rm(join(root, cache))
      await expect(readFile(await hostedPrerenderPath("/", root))).rejects.toThrow(/ENOENT/)
      await save("required-server-files.json", JSON.stringify({ config: {} }))
      expect(await hostedPrerenderPath("/", root)).toBe(join(root, "server/app/index.html"))
      await save("app-path-routes-manifest.json", JSON.stringify({ [source]: "/", "/(other)/page": "/" }))
      await expect(hostedPrerenderPath("/", root)).rejects.toThrow(/ambiguous/)
      await expect(hostedPrerenderPath("/missing", root)).rejects.toThrow(/static prerender/)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it("resolves nested adapter routes by the complete source module and rejects incomplete/dynamic output", async () => {
    const root = await mkdtemp(join(tmpdir(), "gridninja-hosted-routes-"))
    const entry = { srcRoute: "/platform/dispatch-envelope", response: "complete", routeType: "page", initialRevalidateSeconds: false }
    try {
      await writeFile(join(root, "required-server-files.json"), JSON.stringify({ config: { adapterPath: "adapter" } }))
      await writeFile(join(root, "app-path-routes-manifest.json"), JSON.stringify({ "/(marketing)/platform/dispatch-envelope/page": "/platform/dispatch-envelope" }))
      const manifest = async (value: object) => writeFile(join(root, "prerender-manifest.json"), JSON.stringify({ routes: { "/platform/dispatch-envelope": value } }))
      await manifest(entry)
      expect(await hostedPrerenderPath("/platform/dispatch-envelope", root)).toBe(join(root, `server/route-cache/APP_PAGE/${sha("/(marketing)/platform/dispatch-envelope/page")}/$/platform/dispatch-envelope.html`))
      for (const mutation of [{ response: "partial" }, { initialRevalidateSeconds: 60 }, { routeType: "route" }]) {
        await manifest({ ...entry, ...mutation })
        await expect(hostedPrerenderPath("/platform/dispatch-envelope", root)).rejects.toThrow(/static prerender/)
      }
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it("hashes the exact Pages static producer and never falls back to stale App or legacy HTML", async () => {
    const root = await mkdtemp(join(tmpdir(), "gridninja-hosted-pages-"))
    const save = async (path: string, value: string) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), value) }
    const cache = `server/route-cache/PAGES/${sha("/contact")}/$/contact.html`
    const entry = { srcRoute: null, response: "complete", routeType: "page", initialRevalidateSeconds: false, dataRoute: "/_next/data/build/contact.json" }
    try {
      await save("required-server-files.json", JSON.stringify({ config: { adapterPath: "adapter" } }))
      await save("app-path-routes-manifest.json", "{}")
      await save("server/pages-manifest.json", JSON.stringify({ "/contact": "pages/contact.js" }))
      await save("prerender-manifest.json", JSON.stringify({ routes: { "/contact": entry } }))
      await save(cache, "actual-pages-adapter-build")
      await save("server/pages/contact.html", "stale-pages-build")
      await save("server/app/contact.html", "stale-app-build")
      expect(await hostedPrerenderPath("/contact", root)).toBe(join(root, cache))
      expect(sha(await readFile(await hostedPrerenderPath("/contact", root), "utf8"))).toBe(sha("actual-pages-adapter-build"))
      await rm(join(root, cache))
      await expect(readFile(await hostedPrerenderPath("/contact", root))).rejects.toThrow(/ENOENT/)
      for (const mutation of [{ response: "partial" }, { initialRevalidateSeconds: 60 }, { dataRoute: "/contact.rsc" }]) {
        await save("prerender-manifest.json", JSON.stringify({ routes: { "/contact": { ...entry, ...mutation } } }))
        await expect(hostedPrerenderPath("/contact", root)).rejects.toThrow(/static prerender/)
      }
      await save("prerender-manifest.json", JSON.stringify({ routes: { "/contact": entry } }))
      await save("app-path-routes-manifest.json", JSON.stringify({ "/(marketing)/contact/page": "/contact" }))
      await expect(hostedPrerenderPath("/contact", root)).rejects.toThrow(/ambiguous/)
      await save("app-path-routes-manifest.json", "{}")
      await save("required-server-files.json", JSON.stringify({ config: {} }))
      expect(await hostedPrerenderPath("/contact", root)).toBe(join(root, "server/pages/contact.html"))
      // Automatic static optimization is represented by a .html pages manifest
      // owner, whereas getServerSideProps remains .js and must fail closed.
      await save("prerender-manifest.json", JSON.stringify({ routes: {} }))
      await expect(hostedPrerenderPath("/contact", root)).rejects.toThrow(/static prerender/)
      await save("server/pages-manifest.json", JSON.stringify({ "/contact": "pages/contact.html" }))
      expect(await hostedPrerenderPath("/contact", root)).toBe(join(root, "server/pages/contact.html"))
      await save("required-server-files.json", JSON.stringify({ config: { adapterPath: "adapter" } }))
      expect(await hostedPrerenderPath("/contact", root)).toBe(join(root, cache))
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it("reports exact source file hashes without changing the existing path-and-byte source digest", async () => {
    const root = await mkdtemp(join(tmpdir(), "gridninja-hosted-source-"))
    try {
      await mkdir(join(root, "src"))
      await writeFile(join(root, "src/page.ts"), "export const value = 1")
      await writeFile(join(root, "package.json"), "{}")
      const snapshot = await sourceSnapshot(["src", "package.json"], root)
      const previousAlgorithm = createHash("sha256").update("package.json\0").update("{}").update("\0").update("src/page.ts\0").update("export const value = 1").update("\0").digest("hex")
      expect(snapshot.sourceRevision).toBe(previousAlgorithm)
      expect(snapshot.files).toEqual([{ path: "package.json", sha256: sha("{}"), bytes: 2 }, { path: "src/page.ts", sha256: sha("export const value = 1"), bytes: 22 }])
      await writeFile(join(root, "src/page.ts"), "export const value = 2")
      const changed = await sourceSnapshot(["src", "package.json"], root)
      expect(changed.sourceRevision).not.toBe(snapshot.sourceRevision)
      expect(changed.files[0]).toEqual(snapshot.files[0])
      expect(changed.files[1].sha256).not.toBe(snapshot.files[1].sha256)
      expect(JSON.stringify(snapshot)).not.toContain("export const")
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it("round-trips reordered private-log chunks and detects missing, duplicate, mixed and corrupted log data", () => {
    const record = fixture(), lines = hostedAttestationLogLines(record)
    expect(parseHostedAttestationLogs([...lines].reverse().join("\n"))).toEqual(record)
    expect(() => parseHostedAttestationLogs(lines.slice(1).join("\n"))).toThrow()
    expect(() => parseHostedAttestationLogs([...lines, lines[0]].join("\n"))).toThrow()
    expect(() => parseHostedAttestationLogs(lines.map((line, index) => index ? line : line.replace(/[A-Za-z0-9]$/, "!")).join("\n"))).toThrow()
    expect(() => parseHostedAttestationLogs("no build attestation")).toThrow()
  })
  it("requires exact source, harness, immutable origin, Vercel settings and all14 route hashes", () => {
    expect(validateHostedAttestation(fixture(), options).identity.buildId).toBe("remote-build-id")
    for (const replacement of [{ sourceRevision: sha("other") }, { harnessRevision: sha("other") }, { baseURL: "https://wrong.vercel.app" }]) expect(() => validateHostedAttestation(fixture(), { ...options, ...replacement })).toThrow()
    const local = fixture(); local.identity.buildSettings.observability = false
    expect(() => validateHostedAttestation(local, options)).toThrow("Vercel")
    const missing = fixture(); missing.resources.shift()
    expect(() => validateHostedAttestation(missing, options)).toThrow()
    const duplicate = fixture(); duplicate.resources.push(duplicate.resources[0])
    expect(() => validateHostedAttestation(duplicate, options)).toThrow("Duplicate")
  })
  it.each(["http://candidate.vercel.app", `${origin}/contact`, `${origin}?token=secret`, "https://user:password@candidate.vercel.app", "https://gridninja.ai", "https://candidate.vercel.app:444"])("rejects unsafe origin %s", value => {
    expect(() => hostedOrigin(value)).toThrow()
  })
  it.each(["//elsewhere.vercel.app/asset.js", "/_next/static/../asset.js", "/_next/static/x.js?token=secret", "/_next/static/%2e%2e/asset.js"])("rejects unsafe resource path %s", path => {
    const record = fixture(); record.resources.find(resource => resource.kind === "asset")!.path = path
    expect(() => validateHostedAttestation(record, options)).toThrow()
  })
  it("verifies decoded bytes and preserves noindex as evidence without saving secret headers", async () => {
    const fetcher = vi.fn(cleanFetch)
    const record = fixture(), before = await verifyHostedServing(record, { baseURL: origin, fetcher })
    const collectionStartedAt = new Date().toISOString(), collectionFinishedAt = new Date().toISOString()
    const after = await verifyHostedServing(record, { baseURL: origin, fetcher })
    const pair = { before, after, collectionStartedAt, collectionFinishedAt }
    expect(before.resources).toHaveLength(record.resources.length)
    expect(before.resources.every(resource => resource.robots === "noindex" && resource.encoding === "br")).toBe(true)
    expect(JSON.stringify(before)).not.toContain("never-save")
    expect(fetcher.mock.calls.every(call => new URL(String(call[0])).origin === origin)).toBe(true)
    expect(() => assertHostedServingPair(pair, record)).not.toThrow()
    expect(() => assertHostedServingPair({ ...pair, collectionStartedAt: "2020-01-01" }, record)).toThrow("chronology")
    after.resources.find(resource => resource.path === "/_next/static/chunk.js")!.sha256 = sha("changed")
    expect(() => assertHostedServingPair(pair, record)).toThrow("coverage")
    expect(() => assertHostedServingPair({ before }, record)).toThrow("after")
  })
  it("rejects protected HTML, changed decoded assets, HTTP failures, redirects and oversized bodies", async () => {
    const record = fixture()
    for (const fetcher of [
      async (url: string | URL | Request) => response(String(url), "<!doctype html>Vercel Authentication", { "content-type": "text/html" }),
      async (url: string | URL | Request) => response(String(url), body, { "content-type": "text/html" }, 401),
      async () => response(`${origin}/login`, body, { "content-type": "text/html" }),
      async (url: string | URL | Request) => response(String(url), "x".repeat(1000), { "content-type": "text/html" }),
      async (url: string | URL | Request) => String(url).endsWith(".js") ? response(String(url), "x".repeat(asset.length), { "content-type": "application/javascript" }) : cleanFetch(url),
    ]) await expect(verifyHostedServing(record, { baseURL: origin, fetcher })).rejects.toThrow()
    await expect(verifyHostedServing(record, { baseURL: "https://wrong.vercel.app", fetcher: cleanFetch })).rejects.toThrow("origin")
  })
  it("attests SSR Demo by emitted build and asset, then requires exact serving stability", async () => {
    const original = fixture(), requiredAsset = original.resources.find(resource => resource.kind === "asset")!.path
    const record = { ...original, resources: original.resources.map(resource => resource.path === "/demo" ? { ...resource, sha256: null, bytes: null, verification: "dynamic-build-id-and-asset", requiredAsset } : resource) }
    expect(validateHostedAttestation(record, options)).toBe(record)
    const dynamicHtml = `${body}<script src="${requiredAsset}"></script><i>${record.identity.buildId}</i>`
    const fetcher = async (url: string | URL | Request) => new URL(String(url)).pathname === "/demo" ? response(String(url), dynamicHtml, { "content-type": "text/html" }) : cleanFetch(url)
    const before = await verifyHostedServing(record, { baseURL: origin, fetcher })
    const collectionStartedAt = new Date().toISOString(), collectionFinishedAt = new Date().toISOString()
    const after = await verifyHostedServing(record, { baseURL: origin, fetcher })
    expect(() => assertHostedServingPair({ before, after, collectionStartedAt, collectionFinishedAt }, record)).not.toThrow()
    await expect(verifyHostedServing(record, { baseURL: origin, fetcher: cleanFetch })).rejects.toThrow("build ID")
    after.resources.find(resource => resource.path === "/demo")!.sha256 = sha("different SSR response")
    expect(() => assertHostedServingPair({ before, after, collectionStartedAt, collectionFinishedAt }, record)).toThrow("changed during")
  })
  it("priority mode selects precisely10 captures and cannot qualify the140-capture release", () => {
    const matrix = performanceMatrix("premium-civic"), groups = lighthousePriorityGroups(matrix.name)
    expect(groups).toEqual([{ profile: "mobile", route: "/" }, { profile: "mobile", route: "/contact" }])
    expect(groups.length * matrix.runs).toBe(10)
    expect(matrix.routes.length * matrix.profiles.length * matrix.runs).toBe(140)
    expect(() => lighthousePriorityGroups("core")).toThrow()
    expect(() => assertLighthouseMatrixIndex({ result: "incomplete", matrix: matrix.name, runs: [] }, matrix)).toThrow("did not complete")
  })
  it("cannot mix hosted and local provenance or two hosted deployment bindings", () => {
    expect(() => assertLocalMeasurementOrigin(origin)).toThrow("local .next")
    expect(() => assertLocalMeasurementOrigin("http://localhost:3027")).not.toThrow()
    expect(() => assertLocalMeasurementOrigin("https://secret@localhost:3027")).toThrow()
    const hosted = { schemaVersion: "facility-performance.v2", ...fixture().identity, harnessRevision: sha("harness"), browser: "155", settings: {}, settingsSha256: settingsDigest({}), hosted: hostedBinding(fixture()), qualificationEnvironment: { schemaVersion: "facility-qualification-environment.v1", name: "protected-staging", measurementOrigin: origin } }
    expect(() => assertSameBuild(hosted, hosted)).not.toThrow()
    expect(() => assertSameBuild({ ...hosted, hosted: undefined }, hosted)).toThrow("hosted")
    expect(() => assertSameBuild({ ...hosted, hosted: { ...hosted.hosted, origin: "https://other.vercel.app" } }, hosted)).toThrow("hosted")
  })
})

describe("origin-scoped hosted authentication", () => {
  const secret = "test-automation-secret-unique", token = "jwt.test-cookie-unique.signature"
  const cookie = `_vercel_jwt=${token}; Path=/; Secure; HttpOnly; SameSite=Lax`
  it("bootstraps once without redirects and produces a host-only cookie, never global headers", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => response(String(url), "", { "set-cookie": cookie }))
    const auth = await createHostedAuth(origin, secret, fetcher)
    expect(fetcher).toHaveBeenCalledWith(`${origin}/`, expect.objectContaining({ redirect: "manual", headers: { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" } }))
    expect(auth).not.toBeNull()
    const browserCookie = hostedCookie(auth!)
    expect(browserCookie).toEqual({ name: "_vercel_jwt", value: token, url: `${origin}/`, secure: true, httpOnly: true, sameSite: "Lax" })
    expect(browserCookie).not.toHaveProperty("domain")
    expect(JSON.stringify(redactHostedSecrets({ headers: { Cookie: token, "Set-Cookie": cookie }, list: [{ name: "Authorization", value: "unknown-secret" }], trace: `trace:${token};${secret}` }))).not.toMatch(/test-cookie-unique|automation-secret-unique|unknown-secret/)
    expect(redactHostedSecrets({ headersText: "HTTP/2 200\r\nSet-Cookie: _vercel_jwt=unknown-rotated-token", requestHeadersText: "GET /\r\nAuthorization: Bearer unknown-token", responseHeadersText: "Set-Cookie: unknown=another-token" })).toEqual({ headersText: "[REDACTED]", requestHeadersText: "[REDACTED]", responseHeadersText: "[REDACTED]" })
  })
  it("rejects credential forwarding, unsafe cookie domains, missing protection cookies, and refusal", async () => {
    for (const [headers, status] of [
      [{ "set-cookie": `${cookie}; Domain=.vercel.app` }, 200],
      [{ "set-cookie": `_vercel_jwt=${token}; Path=/; HttpOnly` }, 200],
      [{ "set-cookie": cookie, location: "https://attacker.invalid/" }, 302],
      [{}, 200],
      [{ "set-cookie": cookie }, 401],
    ] as const) await expect(createHostedAuth(origin, secret, async url => response(String(url), "", headers, status))).rejects.toThrow()
  })
  it("does not request or invent an authentication cookie without an explicit secret", async () => {
    const fetcher = vi.fn()
    expect(await createHostedAuth(origin, undefined, fetcher)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
