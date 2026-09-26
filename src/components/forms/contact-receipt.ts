import { isPublicTopic, type PublicTopic } from "@/lib/public-topic"
import { contactSubmissionStorageKey } from "@/components/forms/contact-attribution"
import { leadIntents } from "@/lib/constants"
import { isLeadSource, type LeadSource } from "@/lib/lead"
import type { ContactLeadInput } from "@/lib/validators"
import type { LeadIntent } from "@/types/site"

export const CONTACT_TIMEOUT_MS = 20_000
export const CONTACT_REFERENCE_LIFETIME_MS = 24 * 60 * 60 * 1000
export const contactAttemptStorageKey = "gridninja.contactAttempt"

export type ContactReceipt = {
  version: 1; submissionId: string; intent: LeadIntent; receivedAt: number; expiresAt: number
}
export type ContactAttempt = {
  version: 1; clientSubmissionId: string; fingerprint: string; intent: LeadIntent;
  source: LeadSource; topic?: PublicTopic; startedAt: number; expiresAt: number
}

// Keep this small protocol validator independent of the full form schema. Its
// acceptance contract is parity-tested against the previous Zod schemas.
const uuidPattern = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/
const isUuid = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value)
const isTimestamp = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0
const isIntent = (value: unknown): value is LeadIntent => typeof value === "string" && (leadIntents as readonly string[]).includes(value)
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value))

export function parseDurableReceipt(status: number, payload: unknown) {
  if (!isObject(payload) || payload.ok !== true || !isUuid(payload.submissionId)) return null
  if (status === 202 && payload.status === "queued") return { ok: true as const, submissionId: payload.submissionId, status: "queued" as const }
  if (status === 200 && payload.status === "already_received") return { ok: true as const, submissionId: payload.submissionId, status: "already_received" as const }
  return null
}

export function parseRejectedResponse(payload: unknown): { fieldErrors?: Record<string, string>; message?: string } | null {
  if (!isObject(payload) || payload.ok !== false) return null
  if (payload.message !== undefined && (typeof payload.message !== "string" || payload.message.length > 500)) return null
  let fieldErrors: Record<string, string> | undefined
  if (payload.fieldErrors !== undefined) {
    if (!isObject(payload.fieldErrors) || Object.values(payload.fieldErrors).some(value => typeof value !== "string" || value.length > 200)) return null
    fieldErrors = Object.fromEntries(Object.entries(payload.fieldErrors)) as Record<string, string>
  }
  return { fieldErrors, message: payload.message as string | undefined }
}

export function parseStoredReceipt(value: string | null, now = Date.now()): ContactReceipt | null {
  const parsed = parseStored(value)
  if (!parsed || parsed.version !== 1 || !isUuid(parsed.submissionId) || !isIntent(parsed.intent)
    || !isTimestamp(parsed.receivedAt) || !isTimestamp(parsed.expiresAt)
    || !validLifetime(parsed.receivedAt, parsed.expiresAt, now)) return null
  return { version: 1, submissionId: parsed.submissionId, intent: parsed.intent, receivedAt: parsed.receivedAt, expiresAt: parsed.expiresAt }
}

export function parseStoredAttempt(value: string | null, now = Date.now()): ContactAttempt | null {
  const parsed = parseStored(value)
  if (!parsed || parsed.version !== 1 || !isUuid(parsed.clientSubmissionId) || !isIntent(parsed.intent)
    || typeof parsed.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(parsed.fingerprint)
    || (parsed.topic !== undefined && !isPublicTopic(parsed.topic))
    || typeof parsed.source !== "string" || !isLeadSource(parsed.source)
    || !isTimestamp(parsed.startedAt) || !isTimestamp(parsed.expiresAt)
    || !validLifetime(parsed.startedAt, parsed.expiresAt, now)) return null
  return { version: 1, clientSubmissionId: parsed.clientSubmissionId, fingerprint: parsed.fingerprint, intent: parsed.intent, source: parsed.source, ...(isPublicTopic(parsed.topic) ? { topic: parsed.topic } : {}), startedAt: parsed.startedAt, expiresAt: parsed.expiresAt }
}

function validLifetime(start: number, expires: number, now: number) {
  return start <= now && expires > now && expires > start && expires - start <= CONTACT_REFERENCE_LIFETIME_MS
}

function parseStored(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try { const parsed: unknown = JSON.parse(value); return isObject(parsed) ? parsed : null } catch { return null }
}

export function readContactStorage(key: string) {
  try { return window.sessionStorage.getItem(key) } catch { return null }
}

export function writeContactStorage(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch { return false }
}

export function clearContactAttempt() {
  try { window.sessionStorage.removeItem(contactAttemptStorageKey) } catch { /* Optional recovery storage. */ }
}

export function storeContactReceipt(submissionId: string, intent: ContactReceipt["intent"], now = Date.now()) {
  const receipt: ContactReceipt = {
    version: 1, submissionId, intent, receivedAt: now,
    expiresAt: now + CONTACT_REFERENCE_LIFETIME_MS,
  }
  writeContactStorage(contactSubmissionStorageKey, receipt)
  clearContactAttempt()
  return receipt
}

// A one-way fingerprint stays in this tab; contact contents and verification tokens
// are never persisted. Match the server's normalized delivery fields on retry.
export async function fingerprintContactCandidate(candidate: ContactLeadInput) {
  const { clientSubmissionId, turnstileToken, startedAt, website, ...fields } = candidate
  void clientSubmissionId; void turnstileToken; void startedAt; void website
  const normalized = { ...fields, email: fields.email.toLowerCase() }
  const stable = JSON.stringify(Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
  ))
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

export async function sendContactInquiry(payload: ContactLeadInput) {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), CONTACT_TIMEOUT_MS)
  try {
    const response = await fetch("/api/contact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: controller.signal,
    })
    const body: unknown = await response.json()
    return { status: response.status, body, receipt: parseDurableReceipt(response.status, body) }
  } finally { globalThis.clearTimeout(timer) }
}
