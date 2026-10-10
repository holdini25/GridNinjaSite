// @vitest-environment node
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, describe, expect, it } from "vitest"
import { startReaderSession, validateStudyOptions } from "../../../scripts/qa/reader-session.mjs"
import { parseDurableReceipt } from "@/components/forms/contact-receipt"

const cleanup: (() => Promise<unknown>)[] = []
afterEach(async () => { for (const close of cleanup.reverse()) await close(); cleanup.length = 0 })

async function fixture(lifetimeMs = 60_000) {
  const seen: { method?: string; path?: string; cookie?: string; authorization?: string; segmentPrefetch?: string | string[] }[] = []
  const upstream = createServer((request, response) => {
    seen.push({ method: request.method, path: request.url, cookie: request.headers.cookie, authorization: request.headers.authorization, segmentPrefetch: request.headers["next-router-segment-prefetch"] })
    if (request.url === "/redirect") { response.writeHead(302, { Location: "https://example.com/" }); response.end(); return }
    const asset = request.url === "/asset.webp", publication = request.url?.startsWith("/evidence/assessments/")
    response.writeHead(200, { "Content-Type": asset ? "image/webp" : "text/html", "Cache-Control": "public, max-age=0, must-revalidate", ETag: '"fixture"', "Content-Security-Policy": publication ? "default-src 'none'" : "default-src 'self'", "Set-Cookie": "private=never-forward" })
    response.end(asset ? Buffer.from([1, 2, 3, 4]) : "<!doctype html><html><head><title>Fixture</title></head><body>Original body</body></html>")
  })
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve))
  cleanup.push(() => new Promise<void>(resolve => { upstream.closeAllConnections(); upstream.close(() => resolve()) }))
  const candidate = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`
  const proxy = await startReaderSession({ upstream: candidate, port: 0, lifetimeMs })
  cleanup.push(proxy.close)
  return { proxy, seen }
}

describe("isolated reader-session request boundary", () => {
  it("requires literal loopback upstream and explicit TLS for LAN, and closes on its finite lifetime", async () => {
    for (const upstream of ["https://gridninja.ai", "http://localhost:3101", "http://127.0.0.1:3101/private", "http://user:secret@127.0.0.1:3101", "http://127.0.0.1:3101/?x=1"]) {
      expect(() => validateStudyOptions({ upstream })).toThrow()
    }
    expect(() => validateStudyOptions({ upstream: "http://127.0.0.1:3101", host: "0.0.0.0" })).toThrow()
    expect(() => validateStudyOptions({ upstream: "http://127.0.0.1:3101", host: "192.168.1.12" })).toThrow()
    const { proxy } = await fixture(100)
    await new Promise<void>(resolve => proxy.server.once("close", () => resolve()))
    expect(proxy.server.listening).toBe(false)
  })

  it("returns only a labeled synthetic receipt and never forwards any contact, API or mutation request", async () => {
    const { proxy, seen } = await fixture()
    const post = (body: string, origin = proxy.origin) => fetch(proxy.origin + "/api/contact", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body })
    const response = await post(JSON.stringify({ email: "operator@example.test", name: "Synthetic Reader" }))
    const payload = await response.json()
    expect(response.status).toBe(202)
    expect(parseDurableReceipt(response.status, payload)?.status).toBe("queued")
    expect(payload).toMatchObject({ study: true, message: "STUDY RECEIPT ONLY. Nothing was stored or sent." })
    expect((await post(JSON.stringify({ email: "person@real.invalid" }))).status).toBe(400)
    expect((await post("{}", "https://gridninja.ai")).status).toBe(403)
    expect((await post("x".repeat(17 * 1024))).status).toBe(413)
    for (const [method, path] of [["POST", "/assessment"], ["PATCH", "/"], ["GET", "/api/contact"], ["HEAD", "/api/security/csp-report"], ["GET", "/%61pi/contact"], ["POST", "/%2561pi/contact"], ["GET", "/_vercel/insights/script.js"]]) {
      const result = await fetch(proxy.origin + path, { method })
      expect([400, 405]).toContain(result.status)
    }
    expect(seen).toEqual([])
  })

  it("transforms only marketing HTML, preserves artifact bytes/headers, strips credentials and refuses external redirects", async () => {
    const { proxy, seen } = await fixture()
    const marketing = await fetch(proxy.origin + "/assessment", { headers: { Cookie: "secret=session", Authorization: "Bearer private" } })
    expect(await marketing.text()).toContain('<script src="/__reader-study.js"></script>')
    expect(marketing.headers.get("content-security-policy")).toContain("frame-src 'none'")
    expect(marketing.headers.get("content-security-policy")).not.toContain("cloudflare")
    expect(marketing.headers.get("cache-control")).toBe("no-store")
    expect(marketing.headers.get("set-cookie")).toBeNull()
    const bootstrap = await (await fetch(proxy.origin + "/__reader-study.js")).text()
    expect(bootstrap).toContain("TEST / STUDY")
    expect(bootstrap).toContain("STUDY RECEIPT — not a real inquiry")
    const publication = await fetch(proxy.origin + "/evidence/assessments/demo-01-b/v1.0.0")
    expect(await publication.text()).toBe("<!doctype html><html><head><title>Fixture</title></head><body>Original body</body></html>")
    expect(publication.headers.get("content-security-policy")).toBe("default-src 'none'")
    expect(publication.headers.get("etag")).toBe('"fixture"')
    expect(publication.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
    const asset = await fetch(proxy.origin + "/asset.webp")
    expect([...new Uint8Array(await asset.arrayBuffer())]).toEqual([1, 2, 3, 4])
    expect(asset.headers.get("etag")).toBe('"fixture"')
    expect((await fetch(proxy.origin + "/redirect")).status).toBe(502)
    await fetch(proxy.origin + "/contact?_rsc=fixture", { headers: { RSC: "1", "Next-Router-Prefetch": "1", "Next-Router-Segment-Prefetch": "/_tree" } })
    expect(seen.at(-1)).toMatchObject({ path: "/contact?_rsc=fixture", segmentPrefetch: "/_tree" })
    expect(seen.every(request => request.method === "GET" && !request.cookie && !request.authorization)).toBe(true)
  })
})
