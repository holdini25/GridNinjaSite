/** Local transport experiment only. This does not measure browser CPU, LCP or the page budget. */
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import http from "node:http"
import http2 from "node:http2"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { performance } from "node:perf_hooks"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import { brotliCompress, brotliDecompress, constants, gunzip, inflate } from "node:zlib"
import { assertSameBuild, provenance, verifiedBuildIdentity } from "./performance-contract.mjs"

const brotli = promisify(brotliCompress), unbrotli = promisify(brotliDecompress)
const ungzip = promisify(gunzip), undeflate = promisify(inflate), execute = promisify(execFile)
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const UPSTREAM = "http://127.0.0.1:3000"
const TIMEOUT_MS = 8_000, RUN_TIMEOUT_MS = 30_000, MAX_ENCODED = 8 * 1024 * 1024, MAX_DECODED = 16 * 1024 * 1024
const CONCURRENCY = 6, RUN_COUNT = 5
const REQUEST_HEADERS = { "accept-encoding": "gzip, deflate, br", accept: "*/*", "user-agent": "GridNinja-local-transport-diagnostic/1" }

/** Only exact paths observed on the fixed production loopback origin are admissible. */
export function observedPath(value) {
  const url = new URL(value)
  assert(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "3000", "Observed request is outside the production loopback origin")
  assert(!url.username && !url.password && !url.hash, "Observed request contains credentials or a fragment")
  assert(url.pathname.startsWith("/") && !url.pathname.startsWith("//") && !/%(?:2f|5c|00|0a|0d)/i.test(url.pathname), "Ambiguous observed request path")
  return url.pathname + url.search
}

export function authorizedRequest(method, path, allowlist) {
  return ["GET", "HEAD"].includes(method) && typeof path === "string" && allowlist.has(path)
}

export function observedRuns(report, expected) {
  assertSameBuild(report.provenance, expected)
  assert.equal(report.provenance.settings.runCount, RUN_COUNT, "Require five final page measurements per route/device")
  assert.equal(report.results?.length, 4 * RUN_COUNT, "Require exactly twenty complete route/device measurements")
  const runs = [], seen = new Set()
  for (const result of report.results) {
    assert(["/", "/demo"].includes(result.route) && ["desktop", "mobile-emulation"].includes(result.profile), "Unexpected observed route/device")
    assert(Number.isInteger(result.run) && result.run >= 1 && result.run <= RUN_COUNT, "Invalid observed run number")
    const key = `${result.route}:${result.profile}:${result.run}`
    assert(!seen.has(key), "Duplicate observed route/device run")
    seen.add(key)
    assert(result.complete && result.transfer?.complete && result.transfer.issues?.length === 0, "Incomplete page-transfer evidence")
    assert.equal(result.release, expected.buildSettings.selectedRelease, "Observed release differs from the production build")
    assert(result.transfer.requests.length > 0 && result.transfer.requests.length <= 128, "Unbounded or empty request set")
    const requests = result.transfer.requests.map(request => {
      assert(request.terminal === "finished" && request.status >= 200 && request.status < 300 && !request.error, "Failed/redirected request cannot become diagnostic evidence")
      return { path: observedPath(request.url), type: request.type, originalUrl: request.url }
    })
    assert(requests.some(request => request.path === result.route && request.type === "Document"), "Observed document is absent")
    runs.push({ route: result.route, profile: result.profile, run: result.run, observedAutomaticThroughReady: result.throughReady, observedEncodedWireBytes: result.transfer.bytes, requests })
  }
  return runs
}

export async function decodePayload(encoded, encoding = "identity") {
  assert(encoded.length <= MAX_ENCODED, "Encoded response exceeds the diagnostic ceiling")
  const options = { maxOutputLength: MAX_DECODED }
  const normalized = String(encoding).toLowerCase().trim()
  const decoded = normalized === "br" ? await unbrotli(encoded, options)
    : normalized === "gzip" ? await ungzip(encoded, options)
      : normalized === "deflate" ? await undeflate(encoded, options)
        : normalized === "identity" || normalized === "" ? encoded : null
  assert(decoded, `Unsupported content encoding: ${normalized}`)
  assert(decoded.length <= MAX_DECODED, "Decoded response exceeds the diagnostic ceiling")
  return decoded
}

export async function proxyPayload(path, source) {
  const type = String(source.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase()
  const isText = type.startsWith("text/") || /^(?:application\/(?:javascript|json|xml|wasm|x-javascript)|image\/svg\+xml)$/.test(type)
  // Encoded raster/vector images are retained byte-for-byte. GLBs are compressed as one binary payload.
  const compress = !type.startsWith("image/") && (isText || new URL(path, UPSTREAM).pathname.endsWith(".glb"))
  if (!compress || source.body.length === 0) return { body: source.body, encoding: source.headers["content-encoding"] ?? "identity", transformed: false }
  const decoded = await decodePayload(source.body, source.headers["content-encoding"])
  const body = await brotli(decoded, { params: { [constants.BROTLI_PARAM_QUALITY]: 5, [constants.BROTLI_PARAM_MODE]: isText ? constants.BROTLI_MODE_TEXT : constants.BROTLI_MODE_GENERIC } })
  return { body, encoding: "br", transformed: true }
}

async function collectBody(stream) {
  const chunks = []
  let size = 0
  for await (const chunk of stream) {
    size += chunk.length
    assert(size <= MAX_ENCODED, "Response exceeds the diagnostic ceiling")
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size)
}

function sourceRequest(path, { method = "GET", agent, pending } = {}) {
  return new Promise((resolveRequest, reject) => {
    const request = http.request({ hostname: "127.0.0.1", port: 3000, path, method, agent, headers: REQUEST_HEADERS }, async response => {
      try {
        assert(response.statusCode >= 200 && response.statusCode < 300, `Upstream ${response.statusCode}: ${path}`)
        resolveRequest({ status: response.statusCode, headers: response.headers, body: await collectBody(response) })
      } catch (error) { response.destroy(); reject(error) }
    })
    pending?.add(request)
    const deadline = setTimeout(() => request.destroy(new Error(`Upstream deadline: ${path}`)), TIMEOUT_MS)
    request.once("close", () => { clearTimeout(deadline); pending?.delete(request) })
    request.once("error", reject)
    request.end()
  })
}

/** Ephemeral certificate. Trust is confined to the caller's Node TLS connection. */
export async function temporaryCertificate(directory) {
  const config = join(directory, "certificate.cnf")
  await writeFile(config, "[req]\nprompt=no\ndistinguished_name=subject\nx509_extensions=extensions\n[subject]\nCN=localhost\n[extensions]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n", { mode: 0o600 })
  await execute("/usr/bin/openssl", ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-days", "1", "-config", config, "-keyout", join(directory, "key.pem"), "-out", join(directory, "certificate.pem")], { timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 })
  return { key: await readFile(join(directory, "key.pem")), cert: await readFile(join(directory, "certificate.pem")) }
}

export async function startProxy({ allowlist, tls, fetchSource = sourceRequest }) {
  const sessions = new Set(), pending = new Set()
  let agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY })
  const server = http2.createSecureServer({ ...tls, allowHTTP1: false, maxSessionMemory: 8, settings: { maxConcurrentStreams: CONCURRENCY, enablePush: false } })
  server.maxConnections = 2
  server.on("session", session => { sessions.add(session); session.on("error", () => {}); session.once("close", () => sessions.delete(session)) })
  server.on("stream", (stream, headers) => {
    stream.on("error", () => {})
    const method = headers[":method"], path = headers[":path"]
    if (!authorizedRequest(method, path, allowlist)) { stream.respond({ ":status": 403 }); stream.end(); return }
    const deadline = setTimeout(() => stream.close(http2.constants.NGHTTP2_CANCEL), TIMEOUT_MS)
    stream.once("close", () => clearTimeout(deadline))
    void (async () => {
      const source = await fetchSource(path, { method, agent, pending })
      const payload = await proxyPayload(path, source)
      if (stream.destroyed || stream.closed) return
      stream.respond({ ":status": source.status, "content-type": source.headers["content-type"] ?? "application/octet-stream", "content-encoding": payload.encoding, ...(method === "GET" ? { "content-length": payload.body.length } : {}), "cache-control": "no-store" })
      stream.end(method === "HEAD" ? undefined : payload.body)
    })().catch(() => { if (!stream.destroyed && !stream.closed) { if (!stream.headersSent) stream.respond({ ":status": 502 }); stream.end() } })
  })
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListen) })
  return { origin: `https://127.0.0.1:${server.address().port}`, resetConnections() {
    assert.equal(pending.size, 0, "Cannot reset upstream connections during a request")
    agent.destroy()
    agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY })
  }, async close() {
    for (const request of pending) request.destroy()
    agent.destroy()
    for (const session of sessions) session.destroy()
    await new Promise(resolveClose => server.close(resolveClose))
  } }
}

async function openSession(origin, cert) {
  const session = http2.connect(origin, { ca: cert, servername: "localhost" })
  session.on("error", () => {})
  await new Promise((resolveConnect, reject) => {
    const deadline = setTimeout(() => { session.destroy(); reject(new Error("HTTP/2 connection deadline")) }, TIMEOUT_MS)
    session.once("connect", () => { clearTimeout(deadline); resolveConnect() })
    session.once("error", error => { clearTimeout(deadline); reject(error) })
  })
  assert.equal(session.alpnProtocol, "h2", "TLS did not negotiate HTTP/2")
  return session
}

function h2Request(session, path) {
  return new Promise((resolveRequest, reject) => {
    const stream = session.request({ ":method": "GET", ":path": path, ...REQUEST_HEADERS })
    const deadline = setTimeout(() => stream.destroy(new Error(`HTTP/2 deadline: ${path}`)), TIMEOUT_MS)
    stream.once("close", () => clearTimeout(deadline))
    stream.once("error", reject)
    stream.once("response", async headers => {
      try {
        assert(headers[":status"] >= 200 && headers[":status"] < 300, `HTTP/2 ${headers[":status"]}: ${path}`)
        resolveRequest({ status: headers[":status"], headers, body: await collectBody(stream) })
      } catch (error) { stream.destroy(); reject(error) }
    })
    stream.end()
  })
}

async function replay(mode, paths, proxy, cert, buildId) {
  const started = performance.now()
  const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY }), pending = new Set()
  let session, cursor = 0, expired = false
  const deadline = setTimeout(() => {
    expired = true
    for (const request of pending) request.destroy(new Error("Replay deadline"))
    session?.destroy(new Error("Replay deadline"))
  }, RUN_TIMEOUT_MS)
  const results = new Array(paths.length)
  try {
    if (mode === "http2-brotli") { proxy.resetConnections(); session = await openSession(proxy.origin, cert) }
    const workers = Array.from({ length: Math.min(CONCURRENCY, paths.length) }, async () => {
      while (cursor < paths.length) {
        assert(!expired, "Replay deadline")
        const index = cursor++, entry = paths[index], before = performance.now()
        const response = session ? await h2Request(session, entry.path) : await sourceRequest(entry.path, { agent, pending })
        const receivedAt = performance.now()
        const decoded = await decodePayload(response.body, response.headers["content-encoding"])
        if (entry.type === "Document") assert(decoded.includes(Buffer.from(buildId)), "Served document does not identify the verified production build")
        results[index] = { path: entry.path, type: entry.type, status: response.status, encoding: response.headers["content-encoding"] ?? "identity", encodedPayloadBytes: response.body.length, decodedBytes: decoded.length, decodedSha256: hash(decoded), responseElapsedMs: receivedAt - before, receivedAtMs: receivedAt - started }
      }
    })
    const finished = await Promise.allSettled(workers)
    const failure = finished.find(result => result.status === "rejected")
    if (failure) throw failure.reason
    assert(!expired, "Replay deadline")
    const encodedPayloadBytes = results.reduce((sum, result) => sum + result.encodedPayloadBytes, 0)
    assert(encodedPayloadBytes <= 32 * 1024 * 1024, "Run exceeds the transport diagnostic ceiling")
    return { mode, transportElapsedMs: Math.max(...results.map(result => result.receivedAtMs)), totalElapsedIncludingDecodeMs: performance.now() - started, encodedPayloadBytes, decodedBytes: results.reduce((sum, result) => sum + result.decodedBytes, 0), requests: results }
  } finally { clearTimeout(deadline); for (const request of pending) request.destroy(); agent.destroy(); session?.destroy() }
}

export function assertPayloadParity(first, second) {
  assert.equal(first.requests.length, second.requests.length, "Response count mismatch")
  first.requests.forEach((entry, index) => {
    const paired = second.requests[index]
    for (const field of ["path", "status", "decodedBytes", "decodedSha256"]) assert.equal(entry[field], paired[field], `Decoded parity failed for ${entry.path}: ${field}`)
  })
}

async function main() {
  assert.equal(process.argv.length, 2, "Usage: node scripts/facility/compare-transport.mjs (fixed loopback upstream; no CLI overrides)")
  const identity = await verifiedBuildIdentity()
  const release = identity.buildSettings.selectedRelease
  assert(/^facility-v[1-9][0-9]*$/.test(release), "Invalid release output directory")
  const directory = `build/facility/${release}`
  await mkdir(directory, { recursive: true })
  const settings = { upstream: UPSTREAM, runCount: RUN_COUNT, concurrency: CONCURRENCY, perRequestTimeoutMs: TIMEOUT_MS, perReplayTimeoutMs: RUN_TIMEOUT_MS, brotliQuality: 5, cache: "fresh client and upstream connections per replay; no proxy response cache; production server and OS cache uncontrolled", requestOrder: "observed ledger order, bounded work queue; alternate HTTP1/HTTP2 order per pair", certificateTrust: "temporary certificate provided only as Node HTTP/2 client ca", payloadOnly: true }
  const report = { schemaVersion: "facility-transport-comparison.v1", measuredAt: new Date().toISOString(), provenance: await provenance(`Node ${process.version}`, settings), result: "incomplete", limitations: ["Transport-only loopback replay, not a browser navigation: no browser parsing, JS, rendering, LCP, CLS, TBT, GPU or device throttling.", "Encoded payload excludes HTTP headers, TLS overhead and HTTP/2 framing. This is not the whole-page transfer budget and does not replace the unchanged Lighthouse gate.", "Device labels identify observed request sets only. Requests use an identical Node user agent and bounded queue, not browser dependency discovery or scheduling.", "HTTP/2 measurement includes TLS connection establishment, an extra local proxy hop and dynamic Brotli compression at quality 5. HTTP/1 uses actual production response encodings.", "Raster/vector image responses retain upstream encoded bytes. Each pair must have identical decoded response sizes and SHA-256 hashes.", "No response cache in the proxy; upstream Next.js and operating-system caches remain uncontrolled. Pair ordering alternates to reduce ordering bias."], comparisons: [] }
  let temporary, proxy, interrupted
  const interrupt = signal => { interrupted = new Error(`Interrupted by ${signal}`); void proxy?.close().catch(() => {}) }
  const onInterrupt = () => interrupt("SIGINT"), onTerminate = () => interrupt("SIGTERM")
  process.on("SIGINT", onInterrupt)
  process.on("SIGTERM", onTerminate)
  try {
    const observedBytes = await readFile("build/facility/page-measurements.json")
    const observed = JSON.parse(observedBytes)
    report.observedMeasurements = { path: "build/facility/page-measurements.json", sha256: hash(observedBytes), measuredAt: observed.measuredAt }
    const runs = observedRuns(observed, report.provenance)
    const allowlist = new Set(runs.flatMap(run => run.requests.map(request => request.path)))
    report.allowedPaths = [...allowlist].sort()
    temporary = await mkdtemp(join(tmpdir(), "gridninja-transport-"))
    const tls = await temporaryCertificate(temporary)
    if (interrupted) throw interrupted
    proxy = await startProxy({ allowlist, tls })
    for (const run of runs) {
      if (interrupted) throw interrupted
      const order = run.run % 2 ? ["http1-production", "http2-brotli"] : ["http2-brotli", "http1-production"]
      const comparison = { route: run.route, profile: run.profile, run: run.run, observedAutomaticThroughReady: run.observedAutomaticThroughReady, observedEncodedWireBytes: run.observedEncodedWireBytes, order, samples: [], decodedParity: false }
      report.comparisons.push(comparison)
      for (const mode of order) comparison.samples.push(await replay(mode, run.requests, proxy, tls.cert, identity.buildId))
      assertPayloadParity(comparison.samples[0], comparison.samples[1])
      comparison.decodedParity = true
      const h1 = comparison.samples.find(sample => sample.mode === "http1-production"), h2 = comparison.samples.find(sample => sample.mode === "http2-brotli")
      comparison.encodedPayloadSavingsBytes = h1.encodedPayloadBytes - h2.encodedPayloadBytes
      comparison.transportElapsedDifferenceMs = h2.transportElapsedMs - h1.transportElapsedMs
      console.log(`${run.route} ${run.profile} ${run.run}/5: H1 ${h1.encodedPayloadBytes}B, H2+br ${h2.encodedPayloadBytes}B; decoded hashes match`)
    }
    assert.deepEqual(await verifiedBuildIdentity(), identity, "Production build changed during transport diagnostic")
    const finalProvenance = await provenance(`Node ${process.version}`, settings)
    assertSameBuild(finalProvenance, report.provenance)
    assert.equal(hash(await readFile("build/facility/page-measurements.json")), report.observedMeasurements.sha256, "Observed request evidence changed during diagnostic")
    if (interrupted) throw interrupted
    const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
    report.summary = ["/", "/demo"].flatMap(route => ["desktop", "mobile-emulation"].map(profile => {
      const pairs = report.comparisons.filter(pair => pair.route === route && pair.profile === profile)
      return { route, profile, pairedRuns: pairs.length, allDecodedHashesMatch: pairs.every(pair => pair.decodedParity), modes: ["http1-production", "http2-brotli"].map(mode => {
        const samples = pairs.map(pair => pair.samples.find(sample => sample.mode === mode))
        return { mode, medianEncodedPayloadBytes: median(samples.map(sample => sample.encodedPayloadBytes)), medianTransportElapsedMs: median(samples.map(sample => sample.transportElapsedMs)), minTransportElapsedMs: Math.min(...samples.map(sample => sample.transportElapsedMs)), maxTransportElapsedMs: Math.max(...samples.map(sample => sample.transportElapsedMs)) }
      }) }
    }))
    report.result = "pass"
  } catch (error) { report.result = "failed"; report.error = String(error); process.exitCode = 1 }
  finally {
    process.removeListener("SIGINT", onInterrupt)
    process.removeListener("SIGTERM", onTerminate)
    try { await proxy?.close() } finally { if (temporary) await rm(temporary, { recursive: true, force: true }) }
    await writeFile(`${directory}/transport-comparison.json`, `${JSON.stringify(report, null, 2)}\n`)
  }
  console.log(`${directory}/transport-comparison.json: ${report.result}${report.error ? ` (${report.error})` : ""}`)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main()
