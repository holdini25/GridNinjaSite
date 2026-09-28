import { createHash } from "node:crypto"

/** Deliberate staging traffic requires an explicit target and disposable test recipient. */
export function stagingCanaryConfig(env) {
  const required = name => { const value = env[name]?.trim(); if (!value) throw new Error(`${name} is required; the staging canary must not skip.`); return value }
  const baseURL = required("STAGING_BASE_URL")
  const url = new URL(baseURL)
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("STAGING_BASE_URL must be a clean HTTP(S) origin")
  // DNS treats a final dot as an equivalent fully qualified hostname. Keep one
  // spelling of an explicitly authorized staging target; never bypass the
  // production guard through that alias.
  if (url.hostname.endsWith(".")) throw new Error("Staging hostnames must not use a trailing-dot alias")
  if (url.protocol !== "https:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Remote staging must use HTTPS")
  if (url.hostname === "gridninja.ai" || url.hostname.endsWith(".gridninja.ai") && url.hostname !== "staging.gridninja.ai") throw new Error("Production host is not an authorized staging target")
  if (required("STAGING_CANARY_AUTHORIZED_ORIGIN") !== url.origin) throw new Error("The staging origin must match explicit canary authorization")
  if (required("STAGING_CANARY_AUTHORIZED") !== "staging-only") throw new Error("Explicit staging-only canary authorization is required")
  const databaseUrl = required("STAGING_DATABASE_URL")
  const database = new URL(databaseUrl)
  if (!["postgres:", "postgresql:"].includes(database.protocol)) throw new Error("STAGING_DATABASE_URL must name PostgreSQL")
  const email = required("STAGING_CANARY_EMAIL")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("STAGING_CANARY_EMAIL must name an approved test recipient")
  const operatorReference = required("STAGING_CANARY_OPERATOR_REFERENCE")
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(operatorReference)) throw new Error("STAGING_CANARY_OPERATOR_REFERENCE must name the assigned operator using a non-sensitive identifier")
  const deliveryEmail = required("STAGING_CANARY_DELIVERY_EMAIL")
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(deliveryEmail)) throw new Error("STAGING_CANARY_DELIVERY_EMAIL must name one authorized internal recipient")
  const expectedAttestationSha256 = required("STAGING_CANARY_EXPECTED_ATTESTATION_SHA256")
  if (!/^[a-f0-9]{64}$/.test(expectedAttestationSha256)) throw new Error("STAGING_CANARY_EXPECTED_ATTESTATION_SHA256 must identify the qualified build artifact")
  const preflightToken = required("STAGING_CANARY_PREFLIGHT_TOKEN")
  if (preflightToken.length < 32) throw new Error("STAGING_CANARY_PREFLIGHT_TOKEN must be a long operations credential")
  return { baseURL: url.origin, databaseUrl, email, operatorReference, deliveryEmail, expectedAttestationSha256, preflightToken }
}

/** Return evidence, never message contents, for the exact frozen provider request. */
export function stagingFrozenPayloadEvidence(raw, recipient) {
  const frozenRequestSha256 = typeof raw === "string" ? createHash("sha256").update(raw).digest("hex") : null
  let authorizedRecipient = false
  try {
    const value = JSON.parse(raw)
    authorizedRecipient = value?.to === recipient && !Object.hasOwn(value, "cc") && !Object.hasOwn(value, "bcc")
  } catch { /* An absent/malformed snapshot cannot qualify. */ }
  return { authorizedRecipient, frozenRequestSha256 }
}
