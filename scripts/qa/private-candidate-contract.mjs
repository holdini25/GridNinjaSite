import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, readFile, readdir, realpath } from "node:fs/promises"
import { isAbsolute, join, relative, resolve, sep } from "node:path"

export const PRIVATE_CANDIDATE_MARKER = ".gridninja-private-candidate.json"
export const PRIVATE_SOURCE_DIRECTORIES = ["src", "public", "drizzle", "scripts", "tests", ".github", "assets-source", "assets", "docs", "evidence-candidates", "lighthouse"]
export const PRIVATE_SOURCE_FILES = ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "vercel.json", "README.md", "AGENTS.md", "CLAUDE.md", ".nvmrc", ".gitignore", ".env.example", "drizzle.config.ts", "components.json", "eslint.config.mjs", "vitest.config.ts", "vitest.integration.config.ts", "playwright.config.ts", "playwright.staging.config.ts", "playwright.seo.config.ts", "playwright.seo-smoke.config.ts", "lighthouserc.cjs"]
export const privateDigest = bytes => createHash("sha256").update(bytes).digest("hex")
export const inventoryDigest = files => privateDigest(JSON.stringify(files))
const ignored = path => path.split("/").some(part => ["__pycache__", ".DS_Store"].includes(part)) || /\.(?:pyc|pyo|blend[1-9][0-9]*)$/.test(path) || path.startsWith("assets-source/facility/previews/")

export function containedPath(root, path) {
  assert(typeof path === "string" && path.length && !isAbsolute(path), "Inventory paths must be relative")
  const full = resolve(root, path)
  assert(full.startsWith(`${resolve(root)}${sep}`), "Inventory path escapes candidate")
  return full
}

/** An explicit source inventory, including dirty/untracked source. Runtime
 * outputs, credentials, Git internals and dependency trees are never copied. */
export async function privateSourceInventory(root) {
  const files = []
  const walk = async path => {
    if (ignored(path)) return
    const full = containedPath(root, path)
    const info = await lstat(full).catch(error => { if (error.code === "ENOENT") return null; throw error })
    if (!info) return
    assert(!info.isSymbolicLink(), `Source symlink is not allowed: ${path}`)
    if (info.isDirectory()) {
      for (const name of (await readdir(full)).sort()) await walk(`${path}/${name}`)
    } else {
      assert(info.isFile(), `Source must contain regular files: ${path}`)
      const bytes = await readFile(full)
      files.push({ path, bytes: bytes.length, sha256: privateDigest(bytes) })
    }
  }
  for (const path of [...PRIVATE_SOURCE_DIRECTORIES, ...PRIVATE_SOURCE_FILES]) await walk(path)
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

export async function privateCandidateIdentity(root = process.cwd()) {
  const bytes = await readFile(join(root, PRIVATE_CANDIDATE_MARKER)).catch(error => { if (error.code === "ENOENT") return null; throw error })
  if (!bytes) return null
  const marker = JSON.parse(bytes)
  assert(marker.schemaVersion === "private-candidate.v1" && marker.privateOnly === true && marker.releaseApproval === false, "Invalid private candidate marker")
  assert(marker.build?.bundler === "webpack", "Private candidate requires the recorded webpack build")
  return { schemaVersion: marker.schemaVersion, privateOnly: true, releaseApproval: false, bundler: marker.build.bundler, markerSha256: privateDigest(bytes), sourceInventorySha256: marker.sourceInventorySha256, derivedInventorySha256: marker.derivedInventorySha256 }
}

export async function verifyPrivateCandidate(root) {
  root = await realpath(root)
  const marker = JSON.parse(await readFile(join(root, PRIVATE_CANDIDATE_MARKER), "utf8"))
  await privateCandidateIdentity(root)
  assert(!(await readdir(root)).some(name => /^\.env(?:\.|$)/.test(name) && name !== ".env.example"), "Private candidate cannot load local environment files")
  assert.equal(root, marker.candidateRoot, "Private candidate was moved; prepare a new snapshot")
  assert.deepEqual(await privateSourceInventory(root), marker.files, "Private candidate source changed after preparation")
  assert.equal(inventoryDigest(marker.files), marker.derivedInventorySha256, "Derived inventory digest mismatch")
  assert.equal(inventoryDigest(marker.sourceFiles), marker.sourceInventorySha256, "Source inventory digest mismatch")
  const dependencies = await realpath(join(root, "node_modules"))
  assert.equal(dependencies, marker.dependencies.path, "Private dependency link changed")
  assert.equal(privateDigest(await readFile(join(dependencies, ".package-lock.json"))), marker.dependencies.installedLockSha256, "Shared dependency lock changed; prepare a new candidate")
  for (const item of marker.extraFiles) {
    const full = containedPath(root, item.path)
    assert((await lstat(full)).isFile() && await realpath(full) === full, "Private media must be regular files")
    const bytes = await readFile(full)
    assert.equal(bytes.length, item.bytes, `Private media length changed: ${item.path}`)
    assert.equal(privateDigest(bytes), item.sha256, `Private media changed: ${item.path}`)
  }
  const mediaRoot = join(root, "build/cinematic", marker.cinematic.release, "release")
  assert.deepEqual((await readdir(mediaRoot)).sort(), marker.extraFiles.map(item => relative(mediaRoot, join(root, item.path))).sort(), "Private media inventory changed")
  return marker
}

/** No inherited provider/database credentials, .env files or hosted flags.
 * @param {{facility: {release: string}, cinematic: {release: string}}} marker
 * @param {Record<string, string | undefined>} env
 * @param {"build" | "serve"} action */
export function privateCandidateEnvironment(marker, env = process.env, action = "serve") {
  assert(env.VERCEL !== "1", "Private candidates cannot run on a hosted deployment")
  assert(["build", "serve"].includes(action), "Invalid private environment action")
  const allowed = ["PATH", "HOME", "SHELL", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "TERM"]
  return {
    ...Object.fromEntries(allowed.filter(key => env[key] !== undefined).map(key => [key, env[key]])),
    // Next build establishes production mode itself. Its npm prebuild lifecycle
    // also runs Vitest, which must retain the test runner's own environment.
    ...(action === "serve" ? { NODE_ENV: "production" } : {}),
    NEXT_TELEMETRY_DISABLED: "1", GRIDNINJA_CSP_MODE: "enforce",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    FACILITY_ASSET_RELEASE: marker.facility.release, FACILITY_3D_MODE: "auto-adaptive",
    CINEMATIC_ASSET_RELEASE: marker.cinematic.release, CINEMATIC_PREVIEW: "1", CINEMATIC_MODE: "auto",
  }
}
