// @vitest-environment node
import { createHash } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ContactRuntimeConfig } from "@/lib/contact/config"
import { assertStagingPreflightBoundary, inspectStagingPreflight } from "@/lib/contact/staging-preflight"
import { stagingDatabaseTargetSha256 } from "@/lib/contact/staging-database-target.mjs"

const origin = "https://staging.gridninja.ai"
const config: ContactRuntimeConfig = {
  databaseUrl: "postgres://secret:password@private-db.test/db", publicBaseUrl: origin,
  allowedOrigins: new Set([origin]), allowedTurnstileHostnames: new Set(["staging.gridninja.ai"]),
  turnstileSecretKey: "verification-private-key", pseudonymSecret: "private-pseudonym", redisUrl: "https://redis.test",
  redisToken: "private-redis-token", qstashToken: "private-queue-token", qstashCurrentSigningKey: "current-private",
  qstashNextSigningKey: "next-private", resendApiKey: "private-provider-key",
  emailFrom: "GridNinja <approved-sender@example.test>", emailTo: "approved-recipient@example.test",
}
const record = { recordedAt: "2026-09-25T12:00:00Z", identity: { buildId: "fixture-build", sourceRevision: "a".repeat(64),
  releases: [{ release: "facility-v10", manifestSha256: "b".repeat(64) }], buildSettings: { selectedRelease: "facility-v10", mode: "auto-adaptive" } } }
const attestation = Buffer.from(JSON.stringify(record) + "\n")
const inspect = (replacement: Partial<ContactRuntimeConfig> = {}) => inspectStagingPreflight({ origin,
  config: { ...config, ...replacement }, attestation, packagedBuildId: "fixture-build\n" })

describe("staging preflight identity and recipient guard", () => {
  it("requires explicit origin authorization, while allowing dedicated-project production cron deployments", () => {
    const env = { LEAD_STAGING_PREFLIGHT_ENABLED: "staging-only", LEAD_STAGING_PREFLIGHT_ORIGIN: origin, VERCEL_ENV: "production" }
    expect(assertStagingPreflightBoundary(`${origin}/api/internal/lead-staging-preflight`, env)).toBe(origin)
    expect(() => assertStagingPreflightBoundary(`${origin}/api/internal/lead-staging-preflight`, {})).toThrow("staging_disabled")
    for (const unsafe of ["https://gridninja.ai", "https://www.gridninja.ai", "https://api.gridninja.ai", "http://staging.gridninja.ai", `${origin}/path`, `${origin}?q=1`, "https://user:pass@staging.gridninja.ai"]) {
      expect(() => assertStagingPreflightBoundary(`${unsafe}/api/internal/lead-staging-preflight`, { ...env, LEAD_STAGING_PREFLIGHT_ORIGIN: unsafe })).toThrow()
    }
    expect(() => assertStagingPreflightBoundary("https://other.test/api/internal/lead-staging-preflight", env)).toThrow("origin_not_authorized")
    expect(() => assertStagingPreflightBoundary(`${origin}/api/internal/lead-staging-preflight?secret=anything`, env)).toThrow()
  })

  it("permits an explicitly configured loopback fixture only", () => {
    expect(assertStagingPreflightBoundary("http://127.0.0.1:3000/api/internal/lead-staging-preflight", {
      LEAD_STAGING_PREFLIGHT_ENABLED: "staging-only", LEAD_STAGING_PREFLIGHT_ORIGIN: "http://127.0.0.1:3000",
    })).toBe("http://127.0.0.1:3000")
  })

  it("blocks equivalent production hostname spellings and trailing-dot staging aliases", () => {
    for (const source of ["https://gridninja.ai.", "https://www.gridninja.ai.", "https://staging.gridninja.ai.",
      "https://preview.example.test.", "https://GRIDNINJA.AI:443", "https://gridninja.ai:8443",
      "https://%67ridninja.ai", "https://gridninja\u3002ai", "https://gridninja.ai\u3002"]) {
      const value = new URL(source).origin
      expect(() => assertStagingPreflightBoundary(`${value}/api/internal/lead-staging-preflight`, {
        LEAD_STAGING_PREFLIGHT_ENABLED: "staging-only", LEAD_STAGING_PREFLIGHT_ORIGIN: value,
      })).toThrow("origin_not_authorized")
    }
    for (const value of ["http://127.0.0.1:3000", "http://[::1]:3000", "https://preview.example.test:8443"]) {
      expect(assertStagingPreflightBoundary(`${value}/api/internal/lead-staging-preflight`, {
        LEAD_STAGING_PREFLIGHT_ENABLED: "staging-only", LEAD_STAGING_PREFLIGHT_ORIGIN: value,
      })).toBe(value)
    }
  })

  it("returns exact artifact and trimmed recipient digests without addresses or secrets", () => {
    const value = inspect({ emailTo: ` ${config.emailTo} ` })
    expect(value.recipientSha256).toBe(createHash("sha256").update(config.emailTo).digest("hex"))
    expect(value.attestationSha256).toBe(createHash("sha256").update(attestation).digest("hex"))
    expect(value.databaseTargetSha256).toBe(stagingDatabaseTargetSha256(config.databaseUrl))
    expect(value.crmEnabled).toBe(false)
    expect(JSON.stringify(value)).not.toMatch(/@|password|private-|postgres:|redis.test/)
    expect(inspect({ resendApiKey: "rotated-private-key" }).configurationSha256).toBe(value.configurationSha256)
    expect(inspect({ emailFrom: "Another <approved-sender@example.test>" }).configurationSha256).not.toBe(value.configurationSha256)
  })

  it("refuses additional destinations and malformed recipient values", () => {
    for (const emailTo of ["A <one@example.test>", "one@example.test,two@example.test", "one@example.test\r\nBcc: other@example.test", "", "one;two@example.test"]) {
      expect(() => inspect({ emailTo })).toThrow("unsafe_recipient")
    }
    expect(() => inspect({ crmWebhookUrl: "https://crm.test/inquiry" })).toThrow("crm_not_authorized")
    expect(() => inspect({ crmWebhookSigningSecret: "secret" })).toThrow("crm_not_authorized")
    expect(() => inspect({ allowedOrigins: new Set(["https://other.test"]) })).toThrow("origin_not_authorized")
    expect(() => inspect({ publicBaseUrl: "https://gridninja.ai", allowedOrigins: new Set([origin, "https://gridninja.ai"]) })).toThrow("origin_not_authorized")
    expect(() => inspect({ databaseUrl: `${config.databaseUrl}?options=branch%3Dproduction` })).toThrow("database_target_unavailable")
  })

  it("fails closed on stale, absent, malformed or mismatched build artifacts", () => {
    for (const value of [Buffer.from("{}"), Buffer.from("invalid"), Buffer.alloc(65537), Buffer.from(JSON.stringify({ ...record, identity: { ...record.identity, releases: [] } }))]) {
      expect(() => inspectStagingPreflight({ origin, config, attestation: value, packagedBuildId: "fixture-build" })).toThrow("attestation_unavailable")
    }
    expect(() => inspectStagingPreflight({ origin, config, attestation, packagedBuildId: "different-build" })).toThrow("attestation_unavailable")
  })
})

describe("database target fingerprint", () => {
  it("normalizes protocol and default port without retaining credentials or TLS option differences", () => {
    const first = stagingDatabaseTargetSha256("postgres://first:secret@database.test/example?sslmode=require")
    expect(stagingDatabaseTargetSha256("postgresql://second:different@database.test:5432/example?sslmode=verify-full&channel_binding=require")).toBe(first)
    expect(stagingDatabaseTargetSha256("postgresql://second:different@database.test/example_two")).not.toBe(first)
    expect(stagingDatabaseTargetSha256("postgresql://second:different@database-pooler.test/example")).not.toBe(first)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it("rejects hidden routing controls, ambiguous options and unnamed database targets", () => {
    for (const value of ["postgres://user:pass@database.test/", "postgres://user:pass@database.test/db?options=branch%3Dprod",
      "postgres://user:pass@database.test/db?search_path=private", "postgres://user:pass@database.test/db?host=other.test",
      "postgres://user:pass@database.test/db?sslmode=require&sslmode=disable", "postgres://user:pass@database.test/db?sslmode=unknown",
      "https://database.test/db", "postgres://user:pass@database.test/db#secret", "postgres://user:pass@database.test/%00private"]) {
      expect(() => stagingDatabaseTargetSha256(value)).toThrow("Invalid staging database target")
    }
  })
})

const mocks = vi.hoisted(() => ({ read: vi.fn(), config: vi.fn() }))
vi.mock("@/lib/contact/config", () => ({ getContactRuntimeConfig: mocks.config }))
vi.mock("@/lib/contact/staging-preflight", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/contact/staging-preflight")>(), readPackagedStagingAttestation: mocks.read,
}))
import { GET } from "@/app/api/internal/lead-staging-preflight/route"

describe("authenticated read-only preflight endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.unstubAllEnvs()
    vi.stubEnv("LEAD_OPERATIONS_SECRET", "o".repeat(32))
    vi.stubEnv("LEAD_STAGING_PREFLIGHT_ENABLED", "staging-only")
    vi.stubEnv("LEAD_STAGING_PREFLIGHT_ORIGIN", origin)
    mocks.config.mockReturnValue(config); mocks.read.mockResolvedValue({ attestation, packagedBuildId: "fixture-build" })
  })
  const request = (signed = true) => new Request(`${origin}/api/internal/lead-staging-preflight`, { headers: signed ? { authorization: `Bearer ${"o".repeat(32)}` } : {} })

  it("never reads configuration or artifacts for an unauthenticated caller", async () => {
    const result = await GET(request(false))
    expect(result.status).toBe(401); expect(result.headers.get("cache-control")).toBe("no-store")
    expect(mocks.config).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled()
  })

  it("returns a successful no-send preflight only with complete boundary and identity evidence", async () => {
    const result = await GET(request())
    expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ ok: true, crmEnabled: false })
    expect(result.headers.get("x-robots-tag")).toContain("noindex")
  })

  it("does not leak configuration exceptions or silently accept missing traced artifacts", async () => {
    mocks.read.mockRejectedValueOnce(new Error("secret deployment filesystem path"))
    const result = await GET(request())
    expect(result.status).toBe(503); expect(await result.text()).not.toContain("secret")
    vi.stubEnv("LEAD_STAGING_PREFLIGHT_ENABLED", "")
    mocks.config.mockClear(); mocks.read.mockClear()
    expect((await GET(request())).status).toBe(503)
    expect(mocks.config).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled()
  })
})
