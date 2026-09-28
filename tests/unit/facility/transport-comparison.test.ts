// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import http2 from "node:http2"
import { gzipSync } from "node:zlib"
import { authorizedRequest, assertPayloadParity, decodePayload, observedPath, observedRuns, proxyPayload, startProxy, temporaryCertificate } from "../../../scripts/facility/compare-transport.mjs"
import { settingsDigest } from "../../../scripts/facility/performance-contract.mjs"

describe("transport evidence and payload contract", () => {
  it("accepts only observed loopback production paths and exact GET/HEAD requests", () => {
    expect(observedPath("http://localhost:3000/demo?scenario=B")).toBe("/demo?scenario=B")
    for (const url of ["https://127.0.0.1:3000/", "http://127.0.0.1:3001/", "http://example.com:3000/", "http://user@127.0.0.1:3000/", "http://127.0.0.1:3000/#x", "http://127.0.0.1:3000//example.com", "http://127.0.0.1:3000/%2fprivate"]) expect(() => observedPath(url)).toThrow()
    const allowed = new Set(["/demo?scenario=B"])
    expect(authorizedRequest("GET", "/demo?scenario=B", allowed)).toBe(true)
    expect(authorizedRequest("HEAD", "/demo?scenario=B", allowed)).toBe(true)
    expect(authorizedRequest("POST", "/demo?scenario=B", allowed)).toBe(false)
    expect(authorizedRequest("GET", "/demo", allowed)).toBe(false)
    expect(authorizedRequest("GET", "http://127.0.0.1:3000/demo?scenario=B", allowed)).toBe(false)
  })

  it("requires five complete, matching build measurements for each route/device", () => {
    const settings = { runCount: 5 }
    const identity = { schemaVersion: "facility-performance.v2", sourceRevision: "source", buildId: "build", harnessRevision: "harness", releases: [{ release: "facility-v7", manifestSha256: "manifest" }], buildSettings: { selectedRelease: "facility-v7", mode: "auto-adaptive" }, browser: "Chrome test", settings, settingsSha256: settingsDigest(settings) }
    const results = ["/", "/demo"].flatMap(route => ["desktop", "mobile-emulation"].flatMap(profile => Array.from({ length: 5 }, (_, index) => ({ route, profile, run: index + 1, complete: true, release: "facility-v7", throughReady: true, transfer: { complete: true, issues: [], bytes: 200, requests: [{ url: `http://127.0.0.1:3000${route}`, type: "Document", terminal: "finished", status: 200, error: null }] } }))))
    const report = { provenance: identity, results }
    expect(observedRuns(report, identity)).toHaveLength(20)
    expect(() => observedRuns({ ...report, provenance: { ...identity, buildId: "old" } }, identity)).toThrow("provenance")
    expect(() => observedRuns({ ...report, results: results.slice(1) }, identity)).toThrow("twenty")
    expect(() => observedRuns({ ...report, results: [results[0], ...results.slice(0, 19)] }, identity)).toThrow("Duplicate")
    expect(() => observedRuns({ ...report, results: [{ ...results[0], complete: false }, ...results.slice(1)] }, identity)).toThrow("Incomplete")
  })

  it("Brotli transforms text and GLBs while preserving decoded bytes and image encoding", async () => {
    const decoded = Buffer.from("Neutral charcoal facility material ".repeat(400))
    const gzip = gzipSync(decoded)
    for (const [path, type] of [["/page", "text/html; charset=utf-8"], ["/facility.glb", "model/gltf-binary"]]) {
      const payload = await proxyPayload(path, { body: gzip, headers: { "content-type": type, "content-encoding": "gzip" } })
      expect(payload.encoding).toBe("br")
      expect(payload.transformed).toBe(true)
      expect(await decodePayload(payload.body, payload.encoding)).toEqual(decoded)
    }
    for (const type of ["image/webp", "image/svg+xml", "image/x-icon"]) {
      const payload = await proxyPayload("/poster", { body: gzip, headers: { "content-type": type, "content-encoding": "gzip" } })
      expect(payload.body).toBe(gzip)
      expect(payload.encoding).toBe("gzip")
      expect(payload.transformed).toBe(false)
    }
    await expect(decodePayload(gzip, "br")).rejects.toThrow()
    await expect(decodePayload(gzip, "unrecognized")).rejects.toThrow("Unsupported")
    await expect(decodePayload(Buffer.alloc(8 * 1024 * 1024 + 1))).rejects.toThrow("ceiling")
  })

  it("rejects equal-size but changed decoded responses", () => {
    const request = { path: "/page", status: 200, decodedBytes: 10, decodedSha256: "first" }
    expect(() => assertPayloadParity({ requests: [request] }, { requests: [{ ...request, decodedSha256: "second" }] })).toThrow("Decoded parity")
    expect(() => assertPayloadParity({ requests: [request] }, { requests: [request] })).not.toThrow()
  })
})

describe("temporary Node-only HTTP/2 trust and proxy boundaries", () => {
  let directory: string
  let tls: { cert: Buffer; key: Buffer }
  let proxy: { origin: string; close: () => Promise<void> }
  const observed: string[] = []
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "gridninja-transport-test-"))
    tls = await temporaryCertificate(directory)
    proxy = await startProxy({ allowlist: new Set(["/allowed"]), tls, fetchSource: async (path: string) => {
      observed.push(path)
      return { status: 200, headers: { "content-type": "text/plain" }, body: Buffer.from("Loopback test content") }
    } })
  })
  afterAll(async () => { try { await proxy?.close() } finally { if (directory) await rm(directory, { recursive: true, force: true }) } })

  async function request(path: string, method = "GET") {
    const session = http2.connect(proxy.origin, { ca: tls.cert, servername: "localhost" })
    session.on("error", () => {})
    try {
      return await new Promise<{ headers: http2.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
        const stream = session.request({ ":path": path, ":method": method })
        let headers: http2.IncomingHttpHeaders = {}
        const chunks: Buffer[] = []
        stream.on("response", value => { headers = value })
        stream.on("data", value => chunks.push(value))
        stream.on("end", () => resolve({ headers, body: Buffer.concat(chunks) }))
        stream.on("error", reject)
        stream.end()
      })
    } finally { session.destroy() }
  }

  it("negotiates trusted HTTP/2 only when the temporary CA is explicitly provided", async () => {
    const response = await request("/allowed")
    expect(response.headers[":status"]).toBe(200)
    expect(response.headers["content-encoding"]).toBe("br")
    expect((await decodePayload(response.body, "br")).toString()).toBe("Loopback test content")
    const untrusted = http2.connect(proxy.origin, { servername: "localhost" })
    try {
      const error = await new Promise<Error>((resolve, reject) => { untrusted.once("error", resolve); untrusted.once("connect", () => reject(new Error("Certificate unexpectedly globally trusted"))) })
      expect(error.message).toMatch(/self.signed|certificate/i)
    } finally { untrusted.destroy() }
  })

  it("rejects unobserved paths, query mutations and writes before contacting upstream", async () => {
    const before = observed.length
    for (const [path, method] of [["/unobserved", "GET"], ["/allowed?extra=1", "GET"], ["/allowed", "POST"]]) expect((await request(path, method)).headers[":status"]).toBe(403)
    expect(observed).toHaveLength(before)
    expect((await request("/allowed", "HEAD")).body.length).toBe(0)
  })
})
