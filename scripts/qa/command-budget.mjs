import assert from "node:assert/strict"

export const COMMAND_LIMITS = Object.freeze({ commands: 40, attemptsPerPhase: 3, windowMs: 4 * 60 * 60 * 1000, maxCommandMs: 60 * 60 * 1000, logBytesPerStream: 1024 * 1024 })
export const COMMAND_PHASES = Object.freeze(["quality", "brand", "lint", "typecheck", "unit", "integration", "build", "browser-chrome", "browser-chromium", "browser-firefox", "browser-webkit", "browser-chromium-mobile", "browser-webkit-mobile", "seo", "seo-smoke", "lighthouse", "page-performance", "performance-summary", "facility-browser", "audit", "publication-integrity", "visual-acceptance", "skip-audit"])
export function newCommandBudget(now) {
  return { schemaVersion: "gridninja-command-budget.v1", scope: "premium-civic-upgrade", firstInvocationAt: now, deadlineAt: now + COMMAND_LIMITS.windowMs, limits: /** @type {Record<string, number>} */ ({ ...COMMAND_LIMITS }), attempts: /** @type {Array<{ sequence: number, phase: string, phaseAttempt: number, startedAt: number, timeoutMs: number, status: string, directory?: string, finishedAt?: number, receiptSha256?: string }>} */ ([]) }
}
export function reserveCommand(budget, phase, now, timeoutMs) {
  assert.equal(budget.schemaVersion, "gridninja-command-budget.v1", "Unknown command budget")
  assert.equal(budget.scope, "premium-civic-upgrade", "Wrong task scope")
  assert.deepEqual(budget.limits, COMMAND_LIMITS, "Budget limits changed; explicit root disposition is required")
  assert.equal(budget.deadlineAt, budget.firstInvocationAt + COMMAND_LIMITS.windowMs, "Budget window changed")
  assert(COMMAND_PHASES.includes(phase), "Unknown qualification phase")
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= COMMAND_LIMITS.maxCommandMs, "A finite command deadline of at most one hour is required")
  assert(now >= budget.firstInvocationAt, "Clock moved backwards; disposition required")
  assert(!budget.attempts.some(attempt => attempt.status === "running"), "An unfinished command requires owner inspection and documented disposition")
  assert(now < budget.deadlineAt, "Four-hour task window exhausted; explicit root disposition required")
  assert(budget.attempts.length < COMMAND_LIMITS.commands, "Forty-command task budget exhausted; explicit root disposition required")
  const phaseAttempt = budget.attempts.filter(attempt => attempt.phase === phase).length + 1
  assert(phaseAttempt <= COMMAND_LIMITS.attemptsPerPhase, "Three-attempt phase budget exhausted; explicit root disposition required")
  const attempt = { sequence: budget.attempts.length + 1, phase, phaseAttempt, startedAt: now, timeoutMs: Math.min(timeoutMs, budget.deadlineAt - now), status: "running" }
  budget.attempts.push(attempt)
  return attempt
}
