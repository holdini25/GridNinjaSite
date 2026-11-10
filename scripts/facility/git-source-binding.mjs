import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { PRODUCTION_PROJECT } from "./vercel-production-metadata.mjs"

export const GIT_SOURCE_MODE = "git-unmodified.v1"
export const CLI_SOURCE_MODE = "vercel-project-metadata.v1"
const hash = bytes => createHash("sha256").update(bytes).digest("hex")
const exactKeys = (value, keys, message) => assert(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","), message)

export function validateGitPlatformIdentity(value) {
  exactKeys(value, ["projectId", "deploymentId", "deploymentCommit", "repositoryOwner", "repositoryName", "gitRef", "origin"], "Missing exact Git production platform identity")
  assert(value.projectId === PRODUCTION_PROJECT.id && value.repositoryOwner === "holdini25" && value.repositoryName === "GridNinjaSite" && value.gitRef === "main", "Git production target/repository/ref mismatch")
  assert(/^dpl_[A-Za-z0-9]+$/.test(value.deploymentId ?? ""), "Missing Git production deployment ID")
  assert(/^[a-f0-9]{40}$/.test(value.deploymentCommit ?? ""), "Missing full Git production commit")
  const url = new URL(value.origin)
  assert(url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === "/" && url.hostname.endsWith(".vercel.app") && url.origin === value.origin, "Missing immutable Git production origin")
  return value
}

/** Built-in, nonsecret provider metadata only. Explicit CLI mode retains its
 * original path. A flag of 0 cannot suppress the automatic production path. */
export function productionGitIdentity(env = process.env) {
  if (env.FACILITY_HOSTED_ATTESTATION === "1" || env.VERCEL !== "1" || env.VERCEL_ENV !== "production") return null
  assert(typeof env.VERCEL_PROJECT_ID === "string" && env.VERCEL_PROJECT_ID.length > 0, "Missing Vercel production project identity")
  if (env.VERCEL_PROJECT_ID !== PRODUCTION_PROJECT.id) return null
  return validateGitPlatformIdentity({
    projectId: env.VERCEL_PROJECT_ID, deploymentId: env.VERCEL_DEPLOYMENT_ID, deploymentCommit: env.VERCEL_GIT_COMMIT_SHA,
    repositoryOwner: env.VERCEL_GIT_REPO_OWNER, repositoryName: env.VERCEL_GIT_REPO_SLUG, gitRef: env.VERCEL_GIT_COMMIT_REF,
    origin: typeof env.VERCEL_URL === "string" && env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
  })
}

/** No parse/serialize roundtrip: whitespace, key order and every raw config byte
 * participate in the binding. A changed config is a different Git source. */
export function gitConfigBinding(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length > 0, "Missing raw Git project configuration")
  const config = JSON.parse(bytes.toString("utf8"))
  assert(config && typeof config === "object" && !Array.isArray(config), "Invalid Git project configuration")
  return { kind: GIT_SOURCE_MODE, projectName: PRODUCTION_PROJECT.name, builtConfigSha256: hash(bytes), builtConfigBytes: bytes.length }
}

export function validateGitConfigBinding(value) {
  exactKeys(value, ["kind", "projectName", "builtConfigSha256", "builtConfigBytes"], "Missing exact unmodified Git config binding")
  assert(value.kind === GIT_SOURCE_MODE && value.projectName === PRODUCTION_PROJECT.name && /^[a-f0-9]{64}$/.test(value.builtConfigSha256 ?? "") && Number.isSafeInteger(value.builtConfigBytes) && value.builtConfigBytes > 0, "Invalid unmodified Git config binding")
  return value
}

export function expectedGitPlatformIdentity(pins) {
  return validateGitPlatformIdentity({ projectId: pins.projectId, deploymentId: pins.deploymentId, deploymentCommit: pins.deploymentCommit, repositoryOwner: "holdini25", repositoryName: "GridNinjaSite", gitRef: "main", origin: pins.immutableOrigin })
}

/** @typedef {(command:string,args:string[],options:import("node:child_process").SpawnSyncOptionsWithStringEncoding) => {status:number|null,stdout:string|null,error?:Error,signal?:string|null}} GitRunner */
/** Read-only HEAD lookup; no provider/credential access or source mutation.
 * @param {string} directory
 * @param {string} expectedCommit
 * @param {GitRunner} run
 */
export function assertGitCheckoutCommit(directory, expectedCommit, run = spawnSync) {
  assert(/^[a-f0-9]{40}$/.test(expectedCommit ?? ""), "Missing independently pinned Git checkout commit")
  let result
  try { result = run("git", ["rev-parse", "--verify", "HEAD"], { cwd: directory, encoding: "utf8", timeout: 10000, maxBuffer: 4096, stdio: ["ignore", "pipe", "pipe"] }) }
  catch { throw new Error("Could not verify Git checkout HEAD") }
  assert(result.status === 0 && !result.error && !result.signal && typeof result.stdout === "string", "Could not verify Git checkout HEAD")
  assert.equal(result.stdout.trim(), expectedCommit, "Git checkout HEAD differs from independently pinned deployment commit")
}
