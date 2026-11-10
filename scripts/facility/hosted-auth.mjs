import assert from "node:assert/strict"
import { hostedOrigin } from "./hosted-attestation.mjs"

const sensitive = new Set()
let session

/** Vercel documents x-vercel-set-bypass-cookie as the browser automation path.
 * The bootstrap is the ONLY request carrying the bypass secret. Redirects are
 * never followed. Browser cookies are host-only, never a *.vercel.app cookie. */
export async function createHostedAuth(origin, secret, fetcher = fetch) {
  hostedOrigin(origin)
  if (!secret) return null
  assert(typeof secret === "string" && /^[\x21-\x7e]{1,4096}$/.test(secret), "Invalid automation credential")
  sensitive.add(secret)
  let response
  try {
    response = await fetcher(`${origin}/`, { redirect: "manual", signal: AbortSignal.timeout(20000), headers: { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" } })
  } catch { throw new Error("Hosted authentication bootstrap failed") }
  assert.equal(response.url, `${origin}/`, "Authentication bootstrap changed origin")
  assert(response.status === 200 || [301, 302, 303, 307, 308].includes(response.status), "Hosted authentication was refused")
  const location = response.headers.get("location")
  if (location) assert.equal(new URL(location, origin).origin, origin, "Authentication bootstrap redirects outside deployment")
  const cookies = response.headers.getSetCookie().filter(value => value.startsWith("_vercel_jwt="))
  assert.equal(cookies.length, 1, "No unique Vercel automation cookie; protection remains enabled")
  const [assignment, ...attributes] = cookies[0].split(";").map(value => value.trim())
  const value = assignment.slice("_vercel_jwt=".length)
  assert(/^[A-Za-z0-9._~-]{1,8192}$/.test(value), "Invalid Vercel automation cookie")
  sensitive.add(value)
  const attrs = new Map(attributes.map(attribute => { const separator = attribute.indexOf("="); return separator < 0 ? [attribute.toLowerCase(), ""] : [attribute.slice(0, separator).toLowerCase(), attribute.slice(separator + 1)] }))
  assert(attrs.has("secure") && attrs.has("httponly") && attrs.get("path") === "/", "Unsafe automation cookie attributes")
  assert(!attrs.has("domain") || attrs.get("domain") === new URL(origin).hostname, "Automation cookie has an unsafe domain")
  await response.body?.cancel().catch(() => undefined)
  return { origin, name: "_vercel_jwt", value }
}

export async function hostedAuth(origin) {
  if (!process.env.VERCEL_AUTOMATION_BYPASS_SECRET) return null
  if (!session) session = createHostedAuth(origin, process.env.VERCEL_AUTOMATION_BYPASS_SECRET)
  const auth = await session
  assert.equal(auth.origin, origin, "Automation cookie cannot be reused across deployment origins")
  return auth
}

export function hostedCookie(auth) {
  return { name: auth.name, value: auth.value, url: `${auth.origin}/`, secure: true, httpOnly: true, sameSite: "Lax" }
}

export async function authorizeHostedContext(context, origin) {
  const auth = await hostedAuth(origin)
  if (auth) await context.addCookies([hostedCookie(auth)])
}

export async function authorizeHostedChrome(endpoint, origin) {
  const auth = await hostedAuth(origin)
  if (!auth) return
  await new Promise((accept, reject) => {
    const socket = new WebSocket(endpoint)
    let settled = false
    const finish = error => { if (settled) return; settled = true; clearTimeout(deadline); socket.close(); if (error) reject(error); else accept(undefined) }
    const deadline = setTimeout(() => finish(new Error("Hosted cookie installation timed out")), 5000)
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method: "Storage.setCookies", params: { cookies: [hostedCookie(auth)] } })))
    socket.addEventListener("error", () => finish(new Error("Hosted cookie installation failed")), { once: true })
    socket.addEventListener("message", event => { try { const message = JSON.parse(event.data); if (message.id === 1) finish(message.error ? new Error("Hosted cookie installation refused") : null) } catch { finish(new Error("Invalid hosted cookie response")) } })
  })
}

/** Recursively redact known credentials everywhere (including trace strings),
 * and remove credential-bearing header fields even if values are unfamiliar. */
export function redactHostedSecrets(value) {
  if (typeof value === "string") {
    let result = value
    for (const secret of sensitive) result = result.replaceAll(secret, "[REDACTED]")
    return result
  }
  if (Array.isArray(value)) return value.map(redactHostedSecrets)
  if (value && typeof value === "object") {
    const credentialHeader = /^(cookie|set-cookie|authorization|proxy-authorization|x-vercel-protection-bypass)$/i
    const namedHeader = typeof value.name === "string" && credentialHeader.test(value.name)
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, credentialHeader.test(key) || /^(?:request|response)?headersText$/i.test(key) || namedHeader && key === "value" ? "[REDACTED]" : redactHostedSecrets(entry)]))
  }
  return value
}

export async function hostedFetch(url, options) {
  const origin = new URL(url).origin, auth = await hostedAuth(origin)
  assert(options.redirect === "manual", "Authenticated hosted fetch cannot follow redirects")
  return fetch(url, { ...options, headers: { ...options.headers, ...(auth ? { Cookie: `${auth.name}=${auth.value}` } : {}) } })
}
