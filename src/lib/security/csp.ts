export const PUBLICATION_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"

/** Resource containment for the current static Next output. Inline elements are
 * a documented residual; inline handlers and eval are never permitted. */
export function contentSecurityPolicy({ https = false }: { https?: boolean } = {}) {
  return [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // Three ImageBitmapLoader fetches in-memory blobs for hash-validated GLB images.
    // No remote origin is added; blob scripts and workers remain forbidden.
    "connect-src 'self' blob:",
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'none'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
    "report-uri /api/security/csp-report",
  ].join("; ")
}

export function cspMode(value: string | undefined) {
  if (value === undefined || value === "") return "enforce"
  if (value !== "enforce" && value !== "report-only") throw new Error("GRIDNINJA_CSP_MODE must be enforce or report-only")
  return value
}

const routeCategories = new Set(["/", "/demo", "/assessment", "/contact", "/contact/thanks", "/evidence", "/methodology", "/data-handling"])
const directives = new Set(["default-src", "script-src", "script-src-elem", "script-src-attr", "style-src", "style-src-elem", "style-src-attr", "img-src", "font-src", "connect-src", "frame-src", "worker-src", "media-src", "object-src", "base-uri", "form-action", "frame-ancestors"])
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null

/** Never retain a reported URL, query, source file, referrer, sample or arbitrary
 * directive. Reports are untrusted diagnostics, not proof of an attack. */
export function sanitizeCspReports(input: unknown, origin: string) {
  const entries = Array.isArray(input) ? input : [input]
  if (entries.length > 20) throw new Error("too_many_reports")
  return entries.flatMap(entry => {
    const envelope = object(entry)
    const report = object(envelope?.["csp-report"] ?? (envelope?.type === "csp-violation" ? envelope.body : null))
    if (!report) return []
    const directive = report["effective-directive"] ?? report.effectiveDirective
    if (typeof directive !== "string" || !directives.has(directive)) return []
    const document = report["document-uri"] ?? report.documentURL
    let route = "/other"
    try {
      const url = new URL(String(document))
      if (url.origin === origin) route = routeCategories.has(url.pathname) ? url.pathname : url.pathname.startsWith("/solutions/") ? "/solutions/:topic" : /^\/evidence\/assessments\/[^/]+\/[^/]+$/.test(url.pathname) ? "/evidence/assessments/:publication/:version" : "/other"
    } catch { /* Unknown stays a bounded category. */ }
    const blocked = report["blocked-uri"] ?? report.blockedURL
    let resource = "other"
    if (blocked === "inline" || blocked === "eval") resource = blocked
    else try {
      const url = new URL(String(blocked))
      resource = url.origin === origin ? "self" : url.origin === "https://challenges.cloudflare.com" ? "turnstile" : "external"
    } catch { /* Drop unknown scheme/value. */ }
    return [{ route, directive, resource, disposition: report.disposition === "report" ? "report" : "enforce" }]
  })
}
