import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

// This experimental toolchain is separate from application/runtime dependencies.
// Missing packages are an error: never fall back to the root Lighthouse install.
export const QUALIFICATION_VERSIONS = Object.freeze({
  node: "22.23.2", lighthouse: "13.5.0", puppeteerCore: "25.13.0",
  chromeLauncher: "1.2.2", chrome: "155.0.8059.79",
})
export const QUALIFICATION_CATEGORIES = Object.freeze(["performance", "accessibility", "best-practices", "seo"])
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../tools/qualification")
export const qualificationRequire = createRequire(join(packageDirectory, "package.json"))
const packageKeys = { lighthouse: "lighthouse", "puppeteer-core": "puppeteerCore", "chrome-launcher": "chromeLauncher" }
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex")

export function assertQualificationToolchainIdentity(actual, expected = actual) {
  for (const identity of [actual, expected]) {
    assert.equal(identity?.schemaVersion, "gridninja-qualification-toolchain.v1", "Missing qualification toolchain identity")
    assert.deepEqual(identity.versions, QUALIFICATION_VERSIONS, "Changed qualification package/browser versions")
    assert.equal(identity.actualNode, QUALIFICATION_VERSIONS.node, "Unexpected qualification Node runtime")
    for (const key of ["manifestSha256", "lockSha256"]) assert(/^[a-f0-9]{64}$/.test(identity[key] ?? ""), `Missing qualification ${key}`)
    assert.deepEqual(Object.keys(identity.resolvedPackages ?? {}).sort(), Object.keys(packageKeys).sort(), "Incomplete isolated package resolutions")
    for (const [name, path] of Object.entries(identity.resolvedPackages)) assert.equal(path, `node_modules/${name}/package.json`, "Qualification dependency escaped its isolated root")
  }
  assert.deepEqual(actual, expected, "Mixed qualification toolchains")
}

export async function qualificationToolchainIdentity() {
  assert.equal(process.versions.node, QUALIFICATION_VERSIONS.node, "Qualification requires the fixed Node runtime")
  const manifestBytes = await readFile(join(packageDirectory, "package.json"))
  const lockBytes = await readFile(join(packageDirectory, "package-lock.json"))
  const manifest = JSON.parse(manifestBytes), lock = JSON.parse(lockBytes)
  assert.equal(lock.lockfileVersion, 3, "Qualification requires a reviewed npm lockfile")
  const expectedDependencies = Object.fromEntries(Object.entries(packageKeys).map(([name, key]) => [name, QUALIFICATION_VERSIONS[key]]))
  assert.deepEqual(manifest.dependencies, expectedDependencies, "Changed qualification direct dependencies")
  assert.deepEqual(lock.packages?.[""].dependencies, expectedDependencies, "Qualification lock does not match its manifest")
  const root = await realpath(packageDirectory)
  const resolvedPackages = {}, resolvedPaths = {}
  for (const [name, key] of Object.entries(packageKeys)) {
    const path = await realpath(qualificationRequire.resolve(`${name}/package.json`))
    const local = relative(root, path).split(sep).join("/")
    assert.equal(local, `node_modules/${name}/package.json`, `Nonisolated ${name} resolution`)
    const pkg = JSON.parse(await readFile(path, "utf8"))
    assert.equal(pkg.version, QUALIFICATION_VERSIONS[key], `Unexpected installed ${name}`)
    const locked = lock.packages[`node_modules/${name}`]
    assert.equal(locked?.version, pkg.version, `Installed ${name} differs from lock`)
    assert(locked.resolved?.startsWith("https://registry.npmjs.org/") && /^sha512-/.test(locked.integrity ?? ""), `Missing official registry integrity for ${name}`)
    resolvedPackages[name] = local
    resolvedPaths[name] = path
  }
  const lighthouseRequire = createRequire(resolvedPaths.lighthouse)
  for (const name of ["puppeteer-core", "chrome-launcher"]) assert.equal(await realpath(lighthouseRequire.resolve(`${name}/package.json`)), resolvedPaths[name], `Lighthouse uses another ${name}`)
  const identity = { schemaVersion: "gridninja-qualification-toolchain.v1", versions: QUALIFICATION_VERSIONS, actualNode: process.versions.node, manifestSha256: sha256(manifestBytes), lockSha256: sha256(lockBytes), resolvedPackages }
  assertQualificationToolchainIdentity(identity)
  return identity
}

export async function loadQualificationToolchain() {
  const identity = await qualificationToolchainIdentity()
  const [lighthouse, launcher, puppeteer, config, traceProcessor] = await Promise.all([
    import(pathToFileURL(qualificationRequire.resolve("lighthouse")).href),
    import(pathToFileURL(qualificationRequire.resolve("chrome-launcher")).href),
    import(pathToFileURL(qualificationRequire.resolve("puppeteer-core")).href),
    import(pathToFileURL(qualificationRequire.resolve("lighthouse/core/config/default-config.js")).href),
    import(pathToFileURL(qualificationRequire.resolve("lighthouse/core/lib/lh-trace-processor.js")).href),
  ])
  return { lighthouse: lighthouse.default, desktopConfig: lighthouse.desktopConfig, launch: launcher.launch, puppeteerCore: puppeteer.default, defaultConfig: config.default, traceProcessor: traceProcessor.default, versions: QUALIFICATION_VERSIONS, identity }
}
