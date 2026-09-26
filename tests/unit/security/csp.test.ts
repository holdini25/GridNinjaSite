import { describe, expect, it } from "vitest"
import { contentSecurityPolicy, cspMode, sanitizeCspReports } from "@/lib/security/csp"

describe("static application CSP and private diagnostics", () => {
  it("contains resources without authorizing inline handlers or eval", () => {
    const policy = contentSecurityPolicy({ https: true })
    expect(policy).toContain("script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com")
    expect(policy).toContain("script-src-attr 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("connect-src 'self' blob:")
    expect(policy.split("; ").filter(value => value.startsWith("script-src")).join(" ")).not.toContain("blob:")
    expect(policy).toContain("worker-src 'none'")
    expect(policy).toContain("upgrade-insecure-requests")
    expect(policy).not.toContain("unsafe-eval")
    expect(contentSecurityPolicy()).not.toContain("upgrade-insecure-requests")
    expect(cspMode(undefined)).toBe("enforce")
    expect(() => cspMode("off")).toThrow()
  })
  it("never logs inquiry URLs, samples, filenames or arbitrary strings", () => {
    const result = sanitizeCspReports({ "csp-report": { "document-uri": "https://gridninja.ai/demo?minimum=6.5&email=private@example.com#secret", "blocked-uri": "https://attacker.example/private", "effective-directive": "script-src-elem", "script-sample": "private message", "source-file": "https://gridninja.ai/private", disposition: "report" } }, "https://gridninja.ai")
    expect(result).toEqual([{ route: "/demo", directive: "script-src-elem", resource: "external", disposition: "report" }])
    expect(JSON.stringify(result)).not.toMatch(/private|6\.5|example|secret/)
  })
  it("supports both browser envelopes with a bounded vocabulary and batch", () => {
    expect(sanitizeCspReports([{ type: "csp-violation", body: { documentURL: "https://gridninja.ai/solutions/ai-cloud", effectiveDirective: "frame-src", blockedURL: "https://challenges.cloudflare.com/secret", disposition: "enforce" } }], "https://gridninja.ai")).toEqual([{ route: "/solutions/:topic", directive: "frame-src", resource: "turnstile", disposition: "enforce" }])
    expect(sanitizeCspReports({ "csp-report": { "effective-directive": "private arbitrary text" } }, "https://gridninja.ai")).toEqual([])
    expect(() => sanitizeCspReports(Array(21).fill({}), "https://gridninja.ai")).toThrow("too_many_reports")
  })
})
