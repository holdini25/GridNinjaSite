// @vitest-environment node
import { describe, expect, it } from "vitest"
import { stagingCanaryConfig, stagingFrozenPayloadEvidence } from "../../../scripts/qa/staging-contract.mjs"
const env = { STAGING_BASE_URL: "https://preview.example.test", STAGING_CANARY_AUTHORIZED_ORIGIN: "https://preview.example.test", STAGING_CANARY_AUTHORIZED: "staging-only", STAGING_DATABASE_URL: "postgresql://test@127.0.0.1/gridninja_test", STAGING_CANARY_EMAIL: "sink@example.test", STAGING_CANARY_OPERATOR_REFERENCE: "release-operator", STAGING_CANARY_DELIVERY_EMAIL: "notification-sink@example.test", STAGING_CANARY_EXPECTED_ATTESTATION_SHA256: "a".repeat(64), STAGING_CANARY_PREFLIGHT_TOKEN: "x".repeat(32) }
describe("staging canary fails closed", () => {
  it("requires a database, recipient and explicit matching target", () => {
    for (const key of Object.keys(env)) expect(() => stagingCanaryConfig({ ...env, [key]: "" })).toThrow(/required/)
    expect(() => stagingCanaryConfig({ ...env, STAGING_CANARY_AUTHORIZED_ORIGIN: "https://other.example.test" })).toThrow(/match/)
    expect(stagingCanaryConfig(env).baseURL).toBe(env.STAGING_BASE_URL)
    expect(stagingCanaryConfig(env).operatorReference).toBe("release-operator")
    expect(() => stagingCanaryConfig({ ...env, STAGING_CANARY_OPERATOR_REFERENCE: "person@example.test" })).toThrow(/non-sensitive identifier/)
  })
  it("rejects public production targets and URL credentials", () => {
    expect(() => stagingCanaryConfig({ ...env, STAGING_BASE_URL: "https://gridninja.ai" })).toThrow(/Production/)
    expect(() => stagingCanaryConfig({ ...env, STAGING_BASE_URL: "https://www.gridninja.ai" })).toThrow(/Production/)
    expect(() => stagingCanaryConfig({ ...env, STAGING_BASE_URL: "https://user:secret@preview.example.test" })).toThrow(/clean/)
    expect(() => stagingCanaryConfig({ ...env, STAGING_BASE_URL: "https://preview.example.test/contact" })).toThrow(/clean/)
    expect(() => stagingCanaryConfig({ ...env, STAGING_BASE_URL: "http://preview.example.test" })).toThrow(/HTTPS/)
  })
  it("rejects production hostname aliases independently of spelling or port", () => {
    for (const baseURL of ["https://gridninja.ai.", "https://www.gridninja.ai.", "https://staging.gridninja.ai.",
      "https://preview.example.test.", "https://GRIDNINJA.AI:443", "https://gridninja.ai:8443",
      "https://%67ridninja.ai", "https://gridninja\u3002ai", "https://gridninja.ai\u3002"]) {
      expect(() => stagingCanaryConfig({ ...env, STAGING_BASE_URL: baseURL,
        STAGING_CANARY_AUTHORIZED_ORIGIN: new URL(baseURL).origin })).toThrow()
    }
    for (const baseURL of ["http://127.0.0.1:3000", "http://[::1]:3000", "https://preview.example.test:8443"]) {
      expect(stagingCanaryConfig({ ...env, STAGING_BASE_URL: baseURL,
        STAGING_CANARY_AUTHORIZED_ORIGIN: new URL(baseURL).origin }).baseURL).toBe(new URL(baseURL).origin)
    }
  })
  it("requires one exact delivery recipient and a qualified artifact before authorizing traffic", () => {
    for (const deliveryEmail of ["Name <sink@example.test>", "a@example.test,b@example.test", "a@example.test; b@example.test"]) {
      expect(() => stagingCanaryConfig({ ...env, STAGING_CANARY_DELIVERY_EMAIL: deliveryEmail })).toThrow(/one authorized/)
    }
    expect(() => stagingCanaryConfig({ ...env, STAGING_CANARY_EXPECTED_ATTESTATION_SHA256: "main" })).toThrow(/qualified build/)
    expect(() => stagingCanaryConfig({ ...env, STAGING_CANARY_PREFLIGHT_TOKEN: "short" })).toThrow(/long operations/)
  })
  it("rejects changed or hidden recipients and emits no message content", () => {
    const recipient = "sink@example.test"
    const body = { to: recipient, text: "private fixture", reply_to: "reply@example.test" }
    const result = stagingFrozenPayloadEvidence(JSON.stringify(body), recipient)
    expect(result.authorizedRecipient).toBe(true)
    expect(result.frozenRequestSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(result)).not.toMatch(/private|reply@|sink@/)
    for (const raw of [null, "{", "null", JSON.stringify({ ...body, to: "other@example.test" }), JSON.stringify({ ...body, to: [recipient, "other@example.test"] }), JSON.stringify({ ...body, cc: [] }), JSON.stringify({ ...body, bcc: "hidden@example.test" })]) {
      expect(stagingFrozenPayloadEvidence(raw, recipient).authorizedRecipient).toBe(false)
    }
    expect(stagingFrozenPayloadEvidence(JSON.stringify({ ...body, text: "changed" }), recipient).frozenRequestSha256).not.toBe(result.frozenRequestSha256)
  })
})
