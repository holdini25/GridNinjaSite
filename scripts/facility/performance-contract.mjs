import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { readApprovedManifest, readFacilityRegistry, validateSelectedFacility } from "./build-selection.mjs"

export const TRANSFER_BUDGET = 1_572_864
export const SOURCE_PATHS = ["src", "public", "drizzle", "package.json", "package-lock.json", "next.config.ts", "vercel.json", "tsconfig.json", "postcss.config.mjs"]
const digest = bytes => createHash("sha256").update(bytes).digest("hex")
export const canonicalJson = value => JSON.stringify(value, (_, entry) => entry && !Array.isArray(entry) && typeof entry === "object" ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry)
export const settingsDigest = value => digest(canonicalJson(value))

async function filesAt(path) {
  const entry = await stat(path).catch(() => null)
  if (!entry) return []
  if (entry.isFile()) return [path]
  return (await Promise.all((await readdir(path)).sort().map(name => filesAt(join(path, name))))).flat()
}
export async function sourceRevision() {
  const hash = createHash("sha256")
  for (const path of (await Promise.all(SOURCE_PATHS.map(filesAt))).flat().sort()) hash.update(path).update("\0").update(await readFile(path)).update("\0")
  return hash.digest("hex")
}
export async function releaseIdentity() {
  const registry = await readFacilityRegistry()
  return Promise.all(registry.filter(entry => entry.status === "available").map(async entry => {
    const { manifestBytes } = await readApprovedManifest(entry)
    return { release: entry.release, manifestSha256: digest(manifestBytes) }
  }))
}
export async function currentBuildIdentity() {
  const { settings } = await validateSelectedFacility()
  const publicSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ""
  const buildSettings = {
    ...settings,
    observability: process.env.VERCEL === "1",
    csp: process.env.GRIDNINJA_CSP_MODE || "enforce",
    httpsPolicy: process.env.VERCEL === "1" || process.env.GRIDNINJA_HTTPS === "1",
    verification: !publicSiteKey ? "unconfigured" : /^[123]x0+[A-Z]{2}$/.test(publicSiteKey) ? "test" : "live",
    verificationSiteKeySha256: publicSiteKey ? digest(publicSiteKey) : null,
  }
  return { sourceRevision: await sourceRevision(), buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(), releases: await releaseIdentity(), buildSettings }
}
export async function verifiedBuildIdentity() {
  const recorded = JSON.parse(await readFile(".next/facility-build.json", "utf8"))
  const current = await currentBuildIdentity()
  assert.deepEqual(current, recorded.identity, "Source, build, or release changed after the recorded production build; rebuild before measuring")
  return current
}
export async function provenance(browser, settings) {
  const harnessFiles = await filesAt("scripts/facility")
  const hash = createHash("sha256")
  for (const path of harnessFiles.sort()) hash.update(path).update(await readFile(path))
  return { schemaVersion: "facility-performance.v2", ...await verifiedBuildIdentity(), harnessRevision: hash.digest("hex"), browser, settings, settingsSha256: settingsDigest(settings) }
}
export function assertSameBuild(actual, expected) {
  for (const key of ["schemaVersion", "sourceRevision", "buildId", "harnessRevision"]) assert.equal(actual?.[key], expected?.[key], `Missing or mixed provenance: ${key}`)
  assert.deepEqual(actual.releases, expected.releases, "Mixed release manifests")
  assert.deepEqual(actual.buildSettings, expected.buildSettings, "Mixed facility release/mode settings")
  assert.equal(actual.settingsSha256, settingsDigest(actual.settings), "Report settings digest mismatch")
  assert.equal(typeof actual.browser, "string", "Missing browser identity")
}

/** Keeps each redirect hop; all HTTP origins and partial failures are included. */
export class TransferLedger {
  hops = []
  current = new Map()
  changedAt = Date.now()
  request(event) {
    this.changedAt = Date.now()
    const previous = this.current.get(event.requestId)
    if (event.redirectResponse && previous) {
      previous.status = event.redirectResponse.status
      previous.bytes = Math.max(previous.headerBytes + previous.dataBytes, event.redirectResponse.encodedDataLength ?? 0)
      previous.terminal = "redirect"
    }
    if (!/^https?:\/\//.test(event.request.url)) { this.current.delete(event.requestId); return }
    const hop = { requestId: event.requestId, hop: (previous?.hop ?? -1) + 1, url: event.request.url, type: event.type, status: null, encoding: "identity", headerBytes: 0, dataBytes: 0, bytes: null, terminal: null, error: null }
    this.hops.push(hop)
    this.current.set(event.requestId, hop)
  }
  response(event) {
    const hop = this.current.get(event.requestId)
    if (!hop) return
    this.changedAt = Date.now()
    hop.status = event.response.status
    hop.headerBytes = Math.max(0, event.response.encodedDataLength ?? 0)
    hop.encoding = event.response.headers?.["Content-Encoding"] ?? event.response.headers?.["content-encoding"] ?? "identity"
  }
  data(event) {
    const hop = this.current.get(event.requestId)
    if (!hop) return
    this.changedAt = Date.now()
    hop.dataBytes += Math.max(0, event.encodedDataLength ?? 0)
  }
  finished(event) {
    const hop = this.current.get(event.requestId)
    if (!hop) return
    this.changedAt = Date.now()
    hop.bytes = Number.isFinite(event.encodedDataLength) ? event.encodedDataLength : null
    hop.terminal = "finished"
  }
  failed(event) {
    const hop = this.current.get(event.requestId)
    if (!hop) return
    this.changedAt = Date.now()
    hop.bytes = hop.headerBytes + hop.dataBytes
    hop.terminal = "failed"
    hop.error = event.errorText ?? "request failed"
  }
  snapshot() {
    const requests = this.hops.map(hop => ({ ...hop, bytes: hop.bytes ?? hop.headerBytes + hop.dataBytes }))
    const issues = this.hops.filter(hop => !hop.terminal || hop.terminal === "failed" || hop.bytes === null || (hop.status !== null && hop.status >= 400)).map(hop => `${hop.url}: ${hop.error ?? hop.terminal ?? "pending"}${hop.status ? ` (${hop.status})` : ""}`)
    return { requests, bytes: requests.reduce((sum, hop) => sum + hop.bytes, 0), complete: issues.length === 0, issues }
  }
  pending() { return this.hops.some(hop => !hop.terminal) }
}
export async function collectTransfers(cdp) {
  const ledger = new TransferLedger()
  await cdp.send("Network.enable")
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
  for (const [event, method] of [["requestWillBeSent", "request"], ["responseReceived", "response"], ["dataReceived", "data"], ["loadingFinished", "finished"], ["loadingFailed", "failed"]]) cdp.on(`Network.${event}`, value => ledger[method](value))
  return ledger
}
export async function settleTransfers(ledger, { timeout = 15_000, quiet = 750 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (!ledger.pending() && Date.now() - ledger.changedAt >= quiet) {
      const snapshot = ledger.snapshot()
      assert(snapshot.complete, `Incomplete transfer measurement: ${snapshot.issues.join("; ")}`)
      return snapshot
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`Network did not settle before the bounded deadline: ${ledger.snapshot().issues.join("; ")}`)
}
export function assertFrameBudget(snapshot, limit) {
  assert(snapshot && Number.isFinite(snapshot.frameP95) && snapshot.frameP95 > 0 && snapshot.sampleCount >= 120, "Missing complete frame measurement")
  assert(snapshot.frameP95 <= limit, `Frame p95 ${snapshot.frameP95}ms exceeds ${limit}ms`)
}
export function assertRendererBudget(snapshot, animated = true) {
  assert(snapshot && ["drawCalls", "triangles", "materials", "estimatedBytes", "peakEstimatedBytes", "environmentBytes"].every(key => Number.isFinite(snapshot[key]) && snapshot[key] >= 0), "Missing complete renderer allocation evidence")
  assert(snapshot.drawCalls > 0 && snapshot.drawCalls <= (animated ? 60 : 40), "Renderer draw-call ceiling exceeded")
  assert(snapshot.triangles > 0 && snapshot.triangles <= 80_000, "Renderer triangle ceiling exceeded")
  assert(snapshot.materials > 0 && snapshot.materials <= 10, "Renderer material ceiling exceeded")
  assert(snapshot.estimatedBytes > 0 && snapshot.peakEstimatedBytes >= snapshot.estimatedBytes && snapshot.environmentBytes <= snapshot.estimatedBytes, "Invalid renderer allocation accounting")
  assert(snapshot.peakEstimatedBytes <= 32 * 1024 * 1024, "Renderer peak allocation ceiling exceeded")
  if (snapshot.ecosystem && snapshot.sceneKind === "overview") {
    assert(snapshot.drawCalls <= 39, "Ecosystem overview draw-call ceiling exceeded")
    assert(snapshot.triangles <= 40_000, "Ecosystem overview triangle target exceeded")
  }
}
export function assertCompleteTransfer(snapshot) {
  assert(snapshot.complete && snapshot.issues.length === 0, "Transfer evidence is incomplete")
  assert(Number.isFinite(snapshot.bytes) && snapshot.bytes > 0, "Missing transfer bytes")
  assert(snapshot.bytes <= TRANSFER_BUDGET, `Total automatic transfer ${snapshot.bytes} exceeds ${TRANSFER_BUDGET}`)
}

/** Still describes an inactive policy tier, never a successful user Pause or a
 * successful active cadence. Capability and active cadence are checked separately. */
export function assertSettlementEvidence(evidence, settings) {
  const { mode, settle, observationMs, controls, before, after } = evidence ?? {}
  assert(["explicit-pause", "adaptive-still"].includes(mode), "Unknown settlement evidence mode")
  assert(Number.isFinite(settle?.elapsedMs) && settle.elapsedMs >= settings.pauseIdleQuietMs && settle.elapsedMs <= settings.pauseSettleTimeoutMs, "Settlement did not satisfy its unchanged quiet interval")
  assert(Number.isFinite(observationMs) && observationMs >= settings.pauseObservationMs, "Insufficient still observation")
  for (const snapshot of [before, after]) {
    assert(snapshot && Number.isFinite(snapshot.frames) && snapshot.frames > 0, "Missing settled frame evidence")
    assert(Array.isArray(snapshot.equipment?.fans) && snapshot.equipment.fans.length > 0 && Array.isArray(snapshot.equipment?.ledColors) && snapshot.equipment.ledColors.length > 0, "Missing settled equipment evidence")
    assert.equal(snapshot.schedulerPending, 0, "Settlement left a scheduled callback")
    assert.equal(snapshot.transitionRemaining, 0, "Settlement left a transition")
  }
  assert.equal(after.frames, before.frames, "Settlement left continuing frames")
  assert.deepEqual(after.equipment, before.equipment, "Settlement changed equipment")
  if (mode === "adaptive-still") {
    assert.equal(before.quality, "still"); assert.equal(after.quality, "still")
    assert.deepEqual(controls, { quality: "still", label: "Still for performance", pauseCount: 0, paused: false })
  } else {
    assert.equal(controls?.paused, true, "Explicit Pause was not applied")
    assert.equal(controls.pauseCount, 1, "Explicit Pause control is missing")
    assert.equal(controls.label, "Paused", "Explicit Pause label is incorrect")
  }
  assertRendererBudget(after, false)
}
export function assertLighthouseProfile(report, profile) {
  const recorded = report.facilityEvidence?.provenance?.settings
  assert.equal(recorded?.profile, profile, "Lighthouse evidence uses the wrong device profile")
  assert.equal(report.configSettings?.formFactor, profile, "Lighthouse actual form factor differs from its profile")
  assert.equal(canonicalJson(report.configSettings), canonicalJson(recorded.settings), "Actual Lighthouse settings differ from recorded settings")
  for (const audit of ["heading-order", "color-contrast"]) assert.equal(report.audits?.[audit]?.score, 1, `Required ${audit} audit did not pass`)
}

/** Deliberate 30 fps activity is assessed against requested slots, separately from capability. */
export function assertCadenceBudget(snapshot) {
  assert(snapshot && [30, 60].includes(snapshot.targetFps) && snapshot.sampleCount >= 120, "Missing requested-cadence measurement")
  assert(Number.isFinite(snapshot.missedRatio) && snapshot.missedRatio >= 0 && snapshot.missedRatio <= .1, "Sustained cadence missed more than 10% of requested slots")
  assert(Number.isFinite(snapshot.cpuP95) && snapshot.cpuP95 >= 0, "Missing CPU update/submission measurement")
}
