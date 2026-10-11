import { createServer as httpServer, request as httpRequest } from "node:http"
import { createServer as httpsServer, request as httpsRequest } from "node:https"
import { readFile } from "node:fs/promises"
import { networkInterfaces } from "node:os"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const BODY_LIMIT = 16 * 1024
const RECEIPT = "00000000-0000-4000-8000-000000000001"
const STUDY_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:; media-src 'self'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
const bootstrap = `(()=>{
  const widgets=new Map();let sequence=0;
  window.turnstile={render(container,options){const id='study-'+(++sequence);widgets.set(id,options);container.textContent='STUDY: verification is simulated.';queueMicrotask(()=>options.callback('reader-study-token'));return id;},reset(id){const options=widgets.get(id);if(options)queueMicrotask(()=>options.callback('reader-study-token'));},remove(id){widgets.delete(id);}};
  const mount=()=>{
    const banner=document.createElement('aside');banner.id='reader-study-banner';banner.setAttribute('aria-label','Study environment');banner.textContent='TEST / STUDY — synthetic details only. Nothing is sent to GridNinja.';
    Object.assign(banner.style,{position:'fixed',bottom:'0',left:'0',right:'0',zIndex:'2147483647',padding:'10px 16px',background:'#ffcf70',color:'#161616',font:'600 14px/1.5 system-ui',borderTop:'2px solid #161616'});document.body.append(banner);
    const labelReceipts=()=>{for(const heading of document.querySelectorAll('h2'))if(heading.textContent==='Inquiry received'){heading.textContent='STUDY RECEIPT — not a real inquiry';const paragraph=heading.parentElement?.querySelector('p');if(paragraph)paragraph.textContent='Synthetic study receipt only. No inquiry was stored, no email was sent, and no engagement was created.';}};
    new MutationObserver(labelReceipts).observe(document.body,{subtree:true,childList:true});labelReceipts();
    new ResizeObserver(()=>{document.body.style.paddingBottom=banner.offsetHeight+'px';}).observe(banner);
    document.addEventListener('click',event=>{const link=event.target instanceof Element?event.target.closest('a[href]'):null;if(link&&new URL(link.href,location.href).origin!==location.origin){event.preventDefault();banner.textContent='STUDY: external navigation is disabled. Use the local study website.';}},true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
})();`

/** @param {{upstream: string, host?: string, port?: number, lifetimeMs?: number, tls?: {key: string|Buffer, cert: string|Buffer}}} options */
export function validateStudyOptions(options) {
  const upstream = new URL(options.upstream)
  if (!["http:", "https:"].includes(upstream.protocol) || !["127.0.0.1", "[::1]"].includes(upstream.hostname)
    || upstream.username || upstream.password || upstream.pathname !== "/" || upstream.search || upstream.hash || !upstream.port) throw new Error("An explicit loopback candidate origin and port are required")
  const host = options.host ?? "127.0.0.1", port = options.port ?? 3102, lifetimeMs = options.lifetimeMs ?? 45 * 60_000
  if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isInteger(lifetimeMs) || lifetimeMs < 100 || lifetimeMs > 120 * 60_000) throw new Error("Invalid bounded study listener settings")
  if (!["127.0.0.1", "::1"].includes(host)) {
    const privateAddress = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    const localAddress = Object.values(networkInterfaces()).flat().some(item => item?.address === host)
    if (!privateAddress || !localAddress || !options.tls) throw new Error("LAN mode requires an explicit local private IPv4 address and supplied TLS certificate/key")
  }
  if (port && Number(upstream.port) === port) throw new Error("Study listener and upstream ports must differ")
  return { ...options, upstream, host, port, lifetimeMs }
}

function requestPath(raw) {
  if (!raw?.startsWith("/") || raw.startsWith("//") || /[\\\x00-\x20]|%(?:2f|5c|25)/i.test(raw)) return null
  try { const url = new URL(raw, "http://study.invalid"); return { url, decoded: decodeURIComponent(url.pathname) } } catch { return null }
}
const frozenPublication = path => path.startsWith("/evidence/assessments/") || path.startsWith("/downloads/") || path.startsWith("/evidence/releases/")
const blockedApi = path => path === "/api" || path.startsWith("/api/") || path.startsWith("/_vercel/")

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Reader-Study": "mock-only", "X-Robots-Tag": "noindex, nofollow", "Connection": "close" })
  response.end(JSON.stringify(body))
}

function limitedBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = []; let size = 0, settled = false
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); request.removeListener("data", data); request.removeListener("end", end); request.removeListener("error", failed); request.resume(); if (error) reject(error); else resolveBody(value) }
    const data = chunk => { size += chunk.length; if (size > BODY_LIMIT) finish(new Error("size")); else chunks.push(chunk) }
    const end = () => finish(null, Buffer.concat(chunks).toString("utf8"))
    const failed = () => finish(new Error("body"))
    const timer = setTimeout(() => finish(new Error("timeout")), 5000)
    request.on("data", data); request.once("end", end); request.once("error", failed)
  })
}

/** QA-only local listener. Never starts or stops the candidate server. */
export async function startReaderSession(options) {
  const config = validateStudyOptions(options), inFlight = new Set()
  const handler = async (request, response) => {
    const path = requestPath(request.url)
    if (!path) return json(response, 400, { ok: false, message: "Invalid study path." })
    const authority = `${config.host.includes(":") ? `[${config.host}]` : config.host}:${server.address().port}`
    const origin = `${config.tls ? "https" : "http"}://${authority}`
    if (request.headers.host !== authority) return json(response, 421, { ok: false, message: "Use the exact local study address." })
    if (request.method === "POST" && path.decoded === "/api/contact" && path.url.pathname === "/api/contact" && !path.url.search) {
      if (request.headers.origin !== origin) return json(response, 403, { ok: false, message: "Study origin required." })
      if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) return json(response, 415, { ok: false, message: "Study submission requires JSON." })
      if (Number(request.headers["content-length"]) > BODY_LIMIT) return json(response, 413, { ok: false, message: "Study payload too large." })
      try {
        const body = JSON.parse(await limitedBody(request))
        if (!body || typeof body !== "object" || !/^[^@\s]+@example\.(com|org|net|test)$/i.test(body.email ?? "")) return json(response, 400, { ok: false, fieldErrors: { email: "Use the supplied study address at example.test or example.com." }, message: "Synthetic study details only." })
        return json(response, 202, { ok: true, requestId: "reader-study-mock", submissionId: RECEIPT, status: "queued", study: true, message: "STUDY RECEIPT ONLY. Nothing was stored or sent." })
      } catch (error) { return json(response, error.message === "size" ? 413 : error.message === "timeout" ? 408 : 400, { ok: false, message: "Study submission could not be read." }) }
    }
    if (!["GET", "HEAD"].includes(request.method) || blockedApi(path.decoded)) return json(response, 405, { ok: false, message: "Study proxy blocks this request. No upstream mutation is permitted." })
    if (path.decoded === "/__reader-study.js") {
      response.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }); return response.end(request.method === "HEAD" ? undefined : bootstrap)
    }
    const target = new URL(path.url.pathname + path.url.search, config.upstream)
    const headers = { "accept-encoding": "identity" }
    // Do not forward cookies, authorization, bodies, client identities or Next actions.
    for (const field of ["accept", "range", "if-range", "if-none-match", "if-modified-since", "rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url"]) if (request.headers[field]) headers[field] = request.headers[field]
    const upstream = (target.protocol === "https:" ? httpsRequest : httpRequest)(target, { method: request.method, headers }, incoming => {
      const outgoingHeaders = { ...incoming.headers }
      delete outgoingHeaders["set-cookie"]; delete outgoingHeaders.connection; delete outgoingHeaders["keep-alive"]
      if (incoming.headers.location) {
        const location = new URL(incoming.headers.location, target)
        if (location.origin !== config.upstream.origin) { incoming.resume(); return json(response, 502, { ok: false, message: "External study redirect blocked." }) }
        outgoingHeaders.location = location.pathname + location.search + location.hash
      }
      const html = String(incoming.headers["content-type"]).includes("text/html") && !frozenPublication(path.decoded)
      if (!html || request.method === "HEAD") { response.writeHead(incoming.statusCode, outgoingHeaders); incoming.pipe(response); return }
      const chunks = []; let size = 0
      incoming.on("data", chunk => { size += chunk.length; if (size > 4 * 1024 * 1024) { upstream.destroy(); if (!response.headersSent) json(response, 502, { ok: false, message: "Study document too large." }) } else chunks.push(chunk) })
      incoming.on("end", () => {
        if (response.writableEnded) return
        if (incoming.headers["content-encoding"] && incoming.headers["content-encoding"] !== "identity") return json(response, 502, { ok: false, message: "Study HTML must use identity encoding." })
        const html = Buffer.concat(chunks).toString("utf8").replace(/<head([^>]*)>/i, '<head$1><script src="/__reader-study.js"></script>')
        for (const field of ["content-length", "etag", "content-security-policy-report-only", "content-encoding", "transfer-encoding"]) delete outgoingHeaders[field]
        Object.assign(outgoingHeaders, { "content-security-policy": STUDY_CSP, "cache-control": "no-store", "x-reader-study": "transformed-marketing-html", "x-robots-tag": "noindex, nofollow", "content-length": Buffer.byteLength(html) })
        response.writeHead(incoming.statusCode, outgoingHeaders); response.end(html)
      })
    })
    inFlight.add(upstream); upstream.once("close", () => inFlight.delete(upstream))
    upstream.setTimeout(15_000, () => upstream.destroy())
    upstream.on("error", () => { if (!response.headersSent) json(response, 502, { ok: false, message: "Local study candidate unavailable." }); else response.destroy() })
    response.on("close", () => upstream.destroy()); upstream.end()
  }
  const server = config.tls ? httpsServer(config.tls, handler) : httpServer(handler)
  server.requestTimeout = 20_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 1000; server.maxConnections = 32
  await new Promise((ready, reject) => { server.once("error", reject); server.listen(config.port, config.host, ready) })
  let closing
  const close = () => closing ??= new Promise(resolveClose => {
    clearTimeout(lifetime)
    for (const request of inFlight) request.destroy()
    const grace = setTimeout(() => server.closeAllConnections(), 1000)
    server.close(() => { clearTimeout(grace); resolveClose() })
    server.closeIdleConnections()
  })
  const lifetime = setTimeout(() => void close(), config.lifetimeMs)
  const address = server.address(), origin = `${config.tls ? "https" : "http"}://${config.host.includes(":") ? `[${config.host}]` : config.host}:${address.port}`
  return { server, origin, close }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), values = new Map()
    for (let i = 0; i < args.length; i += 2) { if (!["--upstream", "--port", "--minutes", "--lan-host", "--tls-cert", "--tls-key"].includes(args[i]) || !args[i + 1] || values.has(args[i])) throw new Error("Invalid study arguments"); values.set(args[i], args[i + 1]) }
    if (!values.has("--upstream") || values.has("--tls-cert") !== values.has("--tls-key")) throw new Error("Supply --upstream and either both TLS paths or neither")
    const tls = values.has("--tls-cert") ? { cert: await readFile(values.get("--tls-cert")), key: await readFile(values.get("--tls-key")) } : undefined
    const minutes = Number(values.get("--minutes") ?? 45)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) throw new Error("Study lifetime must be 1–120 minutes")
    const study = await startReaderSession({ upstream: values.get("--upstream"), host: values.get("--lan-host"), port: Number(values.get("--port") ?? 3102), lifetimeMs: minutes * 60_000, tls })
    console.log(`TEST / STUDY at ${study.origin}; synthetic mock intake only; closes after ${minutes} minutes. Candidate remains independently owned.`)
    const stop = () => { void study.close() }; process.once("SIGINT", stop); process.once("SIGTERM", stop)
    study.server.once("close", () => { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop) })
  } catch { console.error("Reader study failed. Check explicit loopback upstream, local listener, lifetime and supplied TLS paths. No form contents are logged."); process.exitCode = 1 }
}
