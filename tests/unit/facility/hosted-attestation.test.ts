import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import { assertHostedServingPair, hostedAttestationLogLines, hostedBinding, hostedOrigin, parseHostedAttestationLogs, validateHostedAttestation, verifyHostedServing } from "../../../scripts/facility/hosted-attestation.mjs"
import { createHostedAuth, hostedCookie, redactHostedSecrets } from "../../../scripts/facility/hosted-auth.mjs"
import { assertLighthouseMatrixIndex, lighthousePriorityGroups, performanceMatrix } from "../../../scripts/facility/lighthouse-matrix.mjs"
import { assertLocalMeasurementOrigin, assertSameBuild, settingsDigest } from "../../../scripts/facility/performance-contract.mjs"

const origin = "https://gridninja-build-abc.vercel.app"
const sha = (value: string) => createHash("sha256").update(value).digest("hex")
const body = "<!doctype html><h1>GridNinja</h1>"
const asset = "console.log('GridNinja')"
const fixture = () => ({
  schemaVersion: "gridninja-hosted-build.v1", recordedAt: "2026-01-01T00:00:00.000Z", origin, environment: "preview",
  identity: { sourceRevision: sha("source"), buildId: "remote-build-id", releases: [{ release: "facility-v1", manifestSha256: sha("release") }], buildSettings: { observability: true, httpsPolicy: true } },
  harnessRevision: sha("harness"),
  resources: [...performanceMatrix("premium-civic").routes.map(path => ({ path, kind: "html", sha256: sha(body), bytes: Buffer.byteLength(body) })), { path: "/_next/static/chunk.js", kind: "asset", sha256: sha(asset), bytes: Buffer.byteLength(asset) }],
})
const options = { baseURL: origin, sourceRevision: sha("source"), harnessRevision: sha("harness") }
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
  it("round-trips reordered private-log chunks and detects missing, duplicate, mixed and corrupted log data", () => {
    const record = fixture(), lines = hostedAttestationLogLines(record)
    expect(parseHostedAttestationLogs([...lines].reverse().join("\n"))).toEqual(record)
    expect(() => parseHostedAttestationLogs(lines.slice(1).join("\n"))).toThrow()
    expect(() => parseHostedAttestationLogs([...lines, lines[0]].join("\n"))).toThrow()
    expect(() => parseHostedAttestationLogs(lines.map((line, index) => index ? line : line.replace(/[A-Za-z0-9]$/, "!")).join("\n"))).toThrow()
    expect(() => parseHostedAttestationLogs("no build attestation")).toThrow()
  })
  it("requires exact source, harness, immutable origin, Vercel settings and all13 route hashes", () => {
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
    const record = fixture(); record.resources[13].path = path
    expect(() => validateHostedAttestation(record, options)).toThrow()
  })
  it("verifies decoded bytes and preserves noindex as evidence without saving secret headers", async () => {
    const fetcher = vi.fn(cleanFetch)
    const record = fixture(), before = await verifyHostedServing(record, { baseURL: origin, fetcher })
    const collectionStartedAt = new Date().toISOString(), collectionFinishedAt = new Date().toISOString()
    const after = await verifyHostedServing(record, { baseURL: origin, fetcher })
    const pair = { before, after, collectionStartedAt, collectionFinishedAt }
    expect(before.resources).toHaveLength(14)
    expect(before.resources.every(resource => resource.robots === "noindex" && resource.encoding === "br")).toBe(true)
    expect(JSON.stringify(before)).not.toContain("never-save")
    expect(fetcher.mock.calls.every(call => new URL(String(call[0])).origin === origin)).toBe(true)
    expect(() => assertHostedServingPair(pair, record)).not.toThrow()
    expect(() => assertHostedServingPair({ ...pair, collectionStartedAt: "2020-01-01" }, record)).toThrow("chronology")
    after.resources[13].sha256 = sha("changed")
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
    const original = fixture(), requiredAsset = original.resources[13].path
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
  it("priority mode selects precisely10 captures and cannot qualify the130-capture release", () => {
    const matrix = performanceMatrix("premium-civic"), groups = lighthousePriorityGroups(matrix.name)
    expect(groups).toEqual([{ profile: "mobile", route: "/" }, { profile: "mobile", route: "/contact" }])
    expect(groups.length * matrix.runs).toBe(10)
    expect(matrix.routes.length * matrix.profiles.length * matrix.runs).toBe(130)
    expect(() => lighthousePriorityGroups("core")).toThrow()
    expect(() => assertLighthouseMatrixIndex({ result: "incomplete", matrix: matrix.name, runs: [] }, matrix)).toThrow("did not complete")
  })
  it("cannot mix hosted and local provenance or two hosted deployment bindings", () => {
    expect(() => assertLocalMeasurementOrigin(origin)).toThrow("local .next")
    expect(() => assertLocalMeasurementOrigin("http://localhost:3027")).not.toThrow()
    expect(() => assertLocalMeasurementOrigin("https://secret@localhost:3027")).toThrow()
    const hosted = { schemaVersion: "facility-performance.v2", ...fixture().identity, harnessRevision: sha("harness"), browser: "155", settings: {}, settingsSha256: settingsDigest({}), hosted: hostedBinding(fixture()) }
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
