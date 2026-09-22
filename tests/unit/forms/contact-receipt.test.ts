import { z } from "zod"
import fc from "fast-check"
import { leadIntents } from "@/lib/constants"
import { leadSources } from "@/lib/lead"
import { webcrypto } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  CONTACT_REFERENCE_LIFETIME_MS, CONTACT_TIMEOUT_MS, fingerprintContactCandidate,
  parseDurableReceipt, parseRejectedResponse, parseStoredAttempt, parseStoredReceipt, sendContactInquiry,
  storeContactReceipt, writeContactStorage,
} from "@/components/forms/contact-receipt"
import { contactLeadSchema, legacyContactLeadSchema } from "@/lib/validators"

const now = 1_790_000_000_000
const id = "cc31ccda-1148-4e89-8e66-87a145624c34"
const candidate = {
  schemaVersion: 2 as const, formType: "contact" as const,
  clientSubmissionId: id, turnstileToken: "verification-token", startedAt: now,
  name: "Alex Operator", company: "Example Compute", email: "Alex@example.com",
  intent: "capacity-audit" as const, source: "contact-page", constraints: [],
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.sessionStorage.clear() })

describe("contact receipt and recovery contracts", () => {
  it.each([undefined, "", "  \n "])("accepts omitted/blank v2 message %j", message => {
    const result = contactLeadSchema.parse({ ...candidate, message })
    expect(result.message).toBeUndefined()
  })
  it("keeps supplied message validation and v1 message requirements", () => {
    expect(contactLeadSchema.safeParse({ ...candidate, message: "Short" }).success).toBe(false)
    expect(contactLeadSchema.safeParse({ ...candidate, message: "x".repeat(2001) }).success).toBe(false)
    const legacy = { ...candidate, schemaVersion: 1, role: "Operator", buyerType: "AI cloud operator", siteType: "AI training campus", timeline: "Immediate (0-3 months)", constraints: ["SLA protection"] }
    expect(legacyContactLeadSchema.safeParse(legacy).success).toBe(false)
    expect(legacyContactLeadSchema.safeParse({ ...legacy, message: "Review this capacity decision." }).success).toBe(true)
  })
  it("requires a durable UUID, receipt status and matching HTTP status", () => {
    const receipt = { ok: true, submissionId: id, status: "queued" }
    expect(parseDurableReceipt(202, receipt)?.submissionId).toBe(id)
    expect(parseDurableReceipt(200, { ...receipt, status: "already_received" })?.submissionId).toBe(id)
    for (const [status, body] of [[200, receipt], [202, { ...receipt, status: "already_received" }], [202, { ...receipt, status: undefined }], [202, { ...receipt, submissionId: "arbitrary" }], [503, receipt]] as const) {
      expect(parseDurableReceipt(status, body)).toBeNull()
    }
  })
  it("expires receipt and attempt references without treating expiry as nonreceipt", () => {
    const receipt = { version: 1, submissionId: id, intent: "capacity-audit", receivedAt: now, expiresAt: now + CONTACT_REFERENCE_LIFETIME_MS }
    expect(parseStoredReceipt(JSON.stringify(receipt), now)).toEqual(receipt)
    expect(parseStoredReceipt(JSON.stringify(receipt), receipt.expiresAt)).toBeNull()
    expect(parseStoredReceipt(JSON.stringify({ ...receipt, expiresAt: receipt.expiresAt + 1 }), now)).toBeNull()
    expect(parseStoredReceipt("bad json", now)).toBeNull()
    expect(parseStoredReceipt(JSON.stringify({ submissionId: id, intent: "capacity-audit" }), now)).toBeNull()
    const attempt = { version: 1, clientSubmissionId: id, fingerprint: "a".repeat(64), intent: "capacity-audit", source: "contact-page", startedAt: now, expiresAt: now + CONTACT_REFERENCE_LIFETIME_MS }
    expect(parseStoredAttempt(JSON.stringify(attempt), now)).toEqual(attempt)
    expect(parseStoredAttempt(JSON.stringify(attempt), attempt.expiresAt)).toBeNull()
  })
  it("fingerprints normalized delivery content but not tokens, security or attempt references", async () => {
    vi.stubGlobal("crypto", webcrypto)
    const fingerprint = await fingerprintContactCandidate(candidate)
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(await fingerprintContactCandidate({ ...candidate, email: "alex@example.com", turnstileToken: "new-token", clientSubmissionId: "6b6fe67f-0674-49cf-a55f-ae2eeb75e176", startedAt: now + 1 })).toBe(fingerprint)
    expect(await fingerprintContactCandidate({ ...candidate, company: "Changed company" })).not.toBe(fingerprint)
    expect(fingerprint).not.toContain("Alex")
  })
  it("confirms intake even when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    expect(writeContactStorage("test", {})).toBe(false)
    expect(storeContactReceipt(id, "capacity-audit", now).submissionId).toBe(id)
  })
  it("aborts an unresolved request at 20 seconds", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")))
    }))
    vi.stubGlobal("fetch", fetchMock)
    const promise = sendContactInquiry(candidate)
    const rejection = expect(promise).rejects.toThrow("Timeout")
    await vi.advanceTimersByTimeAsync(CONTACT_TIMEOUT_MS - 1)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejection
  })
  it("keeps durable and rejected response parsing equivalent to the former schemas", () => {
    const formerReceipt = z.object({ ok: z.literal(true), submissionId: z.uuid(), status: z.enum(["queued", "already_received"]) })
    const formerError = z.object({ ok: z.literal(false), fieldErrors: z.record(z.string(), z.string().max(200)).optional(), message: z.string().max(500).optional() })
    const validReceipt = { ok: true, submissionId: id, status: "queued" }
    fc.assert(fc.property(fc.constantFrom(200, 202, 400, 503), fc.oneof(fc.jsonValue(), fc.record({ ok: fc.constantFrom(true, false), submissionId: fc.oneof(fc.constant(id), fc.uuid(), fc.string()), status: fc.constantFrom("queued", "already_received", "sent") })), (status, body) => {
      const parsed = formerReceipt.safeParse(body)
      const expected = parsed.success && ((status === 202 && parsed.data.status === "queued") || (status === 200 && parsed.data.status === "already_received")) ? parsed.data : null
      expect(parseDurableReceipt(status, body)).toEqual(expected)
    }), { numRuns: 200 })
    for (const body of [validReceipt, { ok: false }, { ok: false, message: "No receipt" }, { ok: false, fieldErrors: { email: "Invalid" } }, { ok: false, message: "x".repeat(501) }, { ok: false, fieldErrors: [] }, { ok: false, fieldErrors: { email: 42 } }, null]) {
      const parsed = formerError.safeParse(body)
      expect(parseRejectedResponse(body)).toEqual(parsed.success ? { fieldErrors: parsed.data.fieldErrors, message: parsed.data.message } : null)
    }
  })

  it("keeps local recovery parsers equivalent for malformed fields, timestamps and unknown values", () => {
    const formerReceipt = z.object({ version: z.literal(1), submissionId: z.uuid(), intent: z.enum(leadIntents), receivedAt: z.number().int().positive(), expiresAt: z.number().int().positive() })
    const formerAttempt = z.object({ version: z.literal(1), clientSubmissionId: z.uuid(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), intent: z.enum(leadIntents), source: z.enum(leadSources), startedAt: z.number().int().positive(), expiresAt: z.number().int().positive() })
    const receipt = { version: 1, submissionId: id, intent: "capacity-audit", receivedAt: now, expiresAt: now + CONTACT_REFERENCE_LIFETIME_MS }
    const attempt = { version: 1, clientSubmissionId: id, fingerprint: "a".repeat(64), intent: "capacity-audit", source: "contact-page", startedAt: now, expiresAt: now + CONTACT_REFERENCE_LIFETIME_MS }
    const lifetime = (start: number, end: number) => start <= now && end > now && end > start && end - start <= CONTACT_REFERENCE_LIFETIME_MS
    fc.assert(fc.property(fc.constantFrom(...Object.keys(receipt), "extra"), fc.jsonValue(), (key, value) => {
      const body = { ...receipt, [key]: value }, parsed = formerReceipt.safeParse(body)
      expect(parseStoredReceipt(JSON.stringify(body), now)).toEqual(parsed.success && lifetime(parsed.data.receivedAt, parsed.data.expiresAt) ? parsed.data : null)
    }), { numRuns: 200 })
    fc.assert(fc.property(fc.constantFrom(...Object.keys(attempt), "extra"), fc.jsonValue(), (key, value) => {
      const body = { ...attempt, [key]: value }, parsed = formerAttempt.safeParse(body)
      expect(parseStoredAttempt(JSON.stringify(body), now)).toEqual(parsed.success && lifetime(parsed.data.startedAt, parsed.data.expiresAt) ? parsed.data : null)
    }), { numRuns: 200 })
  })

})
