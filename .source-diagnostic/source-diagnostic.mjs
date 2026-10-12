// One-off Preview diagnostic. No application imports, Git, network or writes.
import { createHash } from "node:crypto"
import { lstat, readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const SOURCE_PATHS = ["src", "public", "drizzle", "package.json", "package-lock.json", "next.config.ts", "vercel.json", "tsconfig.json", "postcss.config.mjs"]
const REFERENCE_SHA256 = "14526a40c103a27b5519dadc895d47f2c512ae87c968280047162e9d3a463501"
const EXPECTED_SOURCE = "a6ad735644421207d4600df59a0947181db19b42425271f648151086d9a6f0d8"
const LIMIT = { files: 2048, entries: 4096, depth: 32, perFile: 32 * 1024 * 1024, total: 256 * 1024 * 1024, differences: 100, pathLength: 256, milliseconds: 20_000 }
const digest = bytes => createHash("sha256").update(bytes).digest("hex")
const emit = value => console.log(JSON.stringify({ sourceInputDiagnostic: "one-off-preview-v1", ...value }))
const invariant = condition => { if (!condition) throw new Error("diagnostic-unavailable") }

export async function diagnosePreviewSource(attestedSourceRevision) {
  // Explicit call is required; importing this file has no diagnostic side effects.
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "preview") return
  const root = process.cwd(), deadline = Date.now() + LIMIT.milliseconds
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LIMIT.milliseconds)
  let stage = "reference-unavailable", entries = 0, total = 0
  const check = () => invariant(!controller.signal.aborted && Date.now() <= deadline)
  const regularBytes = async (path, maximum) => {
    check()
    const before = await lstat(path)
    invariant(before.isFile() && !before.isSymbolicLink() && before.size <= maximum)
    const bytes = await readFile(path, { signal: controller.signal })
    const after = await lstat(path)
    invariant(after.isFile() && !after.isSymbolicLink() && before.ino === after.ino && before.dev === after.dev && before.size === after.size && before.mtimeMs === after.mtimeMs && bytes.length === after.size && bytes.length <= maximum)
    check()
    return bytes
  }
  try {
    invariant(/^[a-f0-9]{64}$/.test(attestedSourceRevision ?? ""))
    const referenceBytes = await regularBytes(new URL("./source-reference.json", import.meta.url), 256 * 1024)
    invariant(digest(referenceBytes) === REFERENCE_SHA256)
    const reference = JSON.parse(referenceBytes.toString("utf8"))
    invariant(reference.schemaVersion === "gridninja-source-reference.v1" && reference.sourceRevision === EXPECTED_SOURCE && reference.fileCount === 550 && reference.totalBytes === 42334935 && reference.files.length === 550 && JSON.stringify(reference.sourcePaths) === JSON.stringify(SOURCE_PATHS))
    const expected = new Map(reference.files.map(file => [file.path, file]))
    invariant(expected.size === 550)
    const paths = []
    stage = "current-inventory-unavailable-or-out-of-bounds"
    const walk = async (path, depth = 0) => {
      check()
      // Match canonical sourceRevision exclusions; refuse unsafe file types.
      if (path.split("/").includes("__pycache__") || /\.(?:pyc|pyo)$/.test(path)) return
      invariant(++entries <= LIMIT.entries && depth <= LIMIT.depth && path.length <= LIMIT.pathLength)
      const absolute = resolve(root, path)
      invariant(absolute.startsWith(root + "/"))
      let item
      try { item = await lstat(absolute) } catch (error) {
        if (error?.code === "ENOENT") return
        throw error
      }
      invariant(!item.isSymbolicLink())
      if (item.isDirectory()) {
        for (const name of (await readdir(absolute)).sort()) await walk(`${path}/${name}`, depth + 1)
      } else {
        invariant(item.isFile() && paths.length < LIMIT.files && item.size <= LIMIT.perFile)
        paths.push(path)
      }
    }
    for (const path of SOURCE_PATHS) await walk(path)
    const aggregate = createHash("sha256"), current = new Map()
    for (const path of paths.sort()) {
      const bytes = await regularBytes(resolve(root, path), LIMIT.perFile)
      total += bytes.length
      invariant(total <= LIMIT.total)
      aggregate.update(path).update("\0").update(bytes).update("\0")
      current.set(path, { path, bytes: bytes.length, sha256: digest(bytes) })
    }
    check()
    const sourceRevision = aggregate.digest("hex")
    const differences = [...new Set([...expected.keys(), ...current.keys()])].sort().flatMap(path => {
      const before = expected.get(path), after = current.get(path)
      if (before?.sha256 === after?.sha256) return []
      return [{ path, status: !before ? "added" : !after ? "missing" : "changed", referenceSha256: before?.sha256 ?? null, observedSha256: after?.sha256 ?? null }]
    })
    emit({ status: "compared", referenceInventorySha256: REFERENCE_SHA256, referenceSourceSha256: EXPECTED_SOURCE, observedSourceSha256: sourceRevision, attestedSourceSha256: attestedSourceRevision, matchesAttestation: sourceRevision === attestedSourceRevision, referenceFileCount: 550, observedFileCount: current.size, differenceCount: differences.length, emittedDifferenceCount: Math.min(differences.length, LIMIT.differences), truncated: differences.length > LIMIT.differences })
    for (const difference of differences.slice(0, LIMIT.differences)) emit({ status: "difference", ...difference })
  } catch {
    // Never print raw errors, file contents, environment values or credentials.
    emit({ status: "unavailable", reason: controller.signal.aborted || Date.now() > deadline ? "deadline-exceeded" : stage })
  } finally { clearTimeout(timer) }
}
