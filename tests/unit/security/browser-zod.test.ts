// @vitest-environment node
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => vi.restoreAllMocks())

describe("client schema parsing under no-eval CSP", () => {
  it.each(["contact", "assessment", "dispatch"] as const)("cold-loads %s first and validates without even probing Function", async (entry) => {
    // Each entry starts a fresh graph: one schema's global configuration must
    // not mask a missing initialization dependency in another schema.
    vi.resetModules()
    const generate = vi.spyOn(globalThis, "Function").mockImplementation(() => { throw new EvalError("CSP forbids generated code") })
    if (entry === "contact") {
      const { contactLeadSchema } = await import("@/lib/validators")
      const contact = { schemaVersion: 2, formType: "contact", clientSubmissionId: "0191f7d6-9f48-7be7-9d17-f6ea958a70c2", turnstileToken: "fixture-token", name: "Avery Operator", company: "Fixture Compute", email: "fixture@example.test", intent: "other", source: "contact", startedAt: 1_725_000_000_000 }
      expect(contactLeadSchema.safeParse(contact).success).toBe(true)
      expect(contactLeadSchema.safeParse({ ...contact, name: "" }).success).toBe(false)
    } else if (entry === "assessment") {
      const { assessmentRecordSchema } = await import("@/schemas/assessment.schema")
      const assessment = JSON.parse(readFileSync("src/content/assessment-publications/demo-01-b/v1.0.0/snapshot.json", "utf8"))
      expect(assessmentRecordSchema.parse(assessment).screeningOutcome).toBe("REPAIR")
      expect(assessmentRecordSchema.safeParse({ ...assessment, operationalAuthority: "granted" }).success).toBe(false)
    } else {
      const { DispatchEnvelopeSpecSchema } = await import("@/schemas/dispatch-envelope.schema")
      const envelope = { startMinute: 0, rampUpMwPerMin: 1, maxMw: 1, holdMinutes: 5, rampDownMwPerMin: 1, recoveryMinutes: 1, reboundLimitMw: 0 }
      expect(DispatchEnvelopeSpecSchema.safeParse(envelope).success).toBe(true)
      expect(DispatchEnvelopeSpecSchema.safeParse({ ...envelope, rampUpMwPerMin: 0 }).success).toBe(false)
    }
    expect(generate).not.toHaveBeenCalled()
  })
})
