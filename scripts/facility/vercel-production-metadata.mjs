import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"

export const PRODUCTION_PROJECT = Object.freeze({ id: "prj_9JSTjPiUBQEC6VTv363zVm7EA54S", name: "gridninja", scope: "holdini25s-projects" })
export const PRODUCTION_METADATA_SCHEMA = "gridninja-production-targets.v1"
export const METADATA_REQUEST_TIMEOUT_MS = 30_000
export const METADATA_WINDOW_MS = 120_000
const maximumBytes = 2 * 1024 * 1024
const deploymentIdPattern = /^dpl_[A-Za-z0-9]+$/

/** @typedef {(command: string, args: string[], options: import("node:child_process").SpawnSyncOptionsWithStringEncoding) => {status: number|null, stdout: string|null, signal?: string|null, error?: Error}} MetadataRunner */

export function productionMetadataPaths(deploymentId) {
  assert(deploymentIdPattern.test(deploymentId ?? ""), "Missing independently pinned production deployment ID")
  return [
    `/v9/projects/${PRODUCTION_PROJECT.id}`,
    `/v13/deployments/${deploymentId}`,
    `/v4/aliases/gridninja.ai?projectId=${PRODUCTION_PROJECT.id}`,
    `/v4/aliases/www.gridninja.ai?projectId=${PRODUCTION_PROJECT.id}`,
  ]
}

/** Four explicit GETs, never a general CLI runner. No list pagination is needed:
 * project.targets.production and BOTH individual aliases are always inspected.
 * No credential/env endpoints, curl/bootstrap, prompts, mutations or raw output.
 * `run`/`now` exist for offline mock tests; defaults make no calls until invoked.
 * @param {string} deploymentId
 * @param {{run?: MetadataRunner, now?: () => number}} options
 */
export function collectProductionMetadata(deploymentId, { run = spawnSync, now = Date.now } = {}) {
  const paths = productionMetadataPaths(deploymentId), requests = []
  const stamp = () => new Date(now()).toISOString()
  const startedAt = stamp()
  function get(path) {
    assert(paths.includes(path), "Unapproved production metadata endpoint")
    const requestStartedAt = stamp()
    let result
    try {
      result = run("npm", ["exec", "--yes", "--package=vercel@64.0.2", "--", "vercel", "api", path, "--method", "GET", "--scope", PRODUCTION_PROJECT.scope, "--raw"], {
        encoding: "utf8", maxBuffer: maximumBytes, timeout: METADATA_REQUEST_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" },
      })
    } catch { throw new Error("Production metadata GET failed; provider output suppressed") }
    const finishedAt = stamp()
    assert(result && result.status === 0 && !result.error && !result.signal, "Production metadata GET failed; provider output suppressed")
    assert(typeof result.stdout === "string" && Buffer.byteLength(result.stdout) <= maximumBytes, "Production metadata response exceeded its bound")
    assert(Date.parse(finishedAt) >= Date.parse(requestStartedAt) && Date.parse(finishedAt) - Date.parse(requestStartedAt) <= METADATA_REQUEST_TIMEOUT_MS, "Production metadata GET exceeded its time bound")
    let value
    try { value = JSON.parse(result.stdout) } catch { throw new Error("Invalid production metadata JSON; provider output suppressed") }
    assert(value && typeof value === "object" && !Array.isArray(value), "Invalid production metadata object")
    requests.push({ method: "GET", path, startedAt: requestStartedAt, finishedAt })
    return value
  }
  const project = get(paths[0])
  assert(project.id === PRODUCTION_PROJECT.id && project.name === PRODUCTION_PROJECT.name, "Production project identity mismatch")
  assert(project.targets?.production?.id === deploymentId, "Current production target differs from independent pin")
  const deployment = get(paths[1])
  assert(deployment.id === deploymentId && deployment.projectId === PRODUCTION_PROJECT.id, "Production deployment identity mismatch")
  const aliases = ["gridninja.ai", "www.gridninja.ai"].map((alias, index) => {
    const raw = get(paths[index + 2])
    assert(raw.alias === alias && raw.projectId === PRODUCTION_PROJECT.id, "Individual production alias identity mismatch")
    assert(!raw.deploymentId || !raw.deployment?.id || raw.deploymentId === raw.deployment.id, "Conflicting individual alias targets")
    return { alias, projectId: raw.projectId, deploymentId: raw.deploymentId ?? raw.deployment?.id ?? null, redirect: raw.redirect ?? null }
  })
  const finishedAt = stamp()
  assert(Date.parse(finishedAt) - Date.parse(startedAt) <= METADATA_WINDOW_MS, "Production metadata snapshot exceeded its time bound")
  // Deliberately do not inspect or persist project/deployment env fields, headers,
  // tokens, configuration values, logs, recipient data or provider error bodies.
  return {
    schemaVersion: PRODUCTION_METADATA_SCHEMA, provider: "vercel-cli", cliVersion: "64.0.2", scope: PRODUCTION_PROJECT.scope,
    startedAt, finishedAt, requests,
    project: { id: project.id, name: project.name, currentProductionDeploymentId: project.targets.production.id, nodeVersion: project.nodeVersion ?? null, gitConnected: Boolean(project.link), protectionScope: project.ssoProtection?.deploymentType ?? null },
    current: { id: deployment.id, projectId: deployment.projectId, url: deployment.url ?? null, target: deployment.target ?? null, readyState: deployment.readyState ?? null, gitCommitSha: deployment.meta?.githubCommitSha ?? null, nodeVersion: deployment.projectSettings?.nodeVersion ?? null },
    aliases,
  }
}
