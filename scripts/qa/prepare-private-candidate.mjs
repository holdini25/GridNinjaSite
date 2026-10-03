import assert from "node:assert/strict"
import { mkdir, readFile, readdir, realpath, lstat, writeFile, symlink } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { expectedReleaseFiles, manifestSchema, registrySchema, releasePattern } from "../../src/lib/facility/manifest-schema.mjs"
import { readCinematicDirectory } from "../../src/lib/cinematic/files.mjs"
import { PRIVATE_CANDIDATE_MARKER, containedPath, inventoryDigest, privateDigest, privateSourceInventory } from "./private-candidate-contract.mjs"

async function writeNew(root, path, bytes) {
  const full = containedPath(root, path)
  await mkdir(dirname(full), { recursive: true })
  await writeFile(full, bytes, { flag: "wx" })
}

/** @param {{source?: string, out: string, facility: string, cinematic: string, dependencyRoot?: string, env?: Record<string, string | undefined>}} options */
export async function preparePrivateCandidate({ source = process.cwd(), out, facility, cinematic, dependencyRoot, env = process.env }) {
  assert(env.VERCEL !== "1", "Private candidates cannot be prepared on a hosted deployment")
  assert(out && facility && cinematic, "Required: --out, --facility, --cinematic")
  source = await realpath(resolve(source))
  // Resolve the existing parent so a symlink cannot disguise a source child.
  out = join(await realpath(dirname(resolve(out))), resolve(out).split(sep).at(-1))
  assert(out !== source && !out.startsWith(`${source}${sep}`), "Candidate must be outside its source checkout")
  assert(!(await lstat(out).catch(error => { if (error.code === "ENOENT") return null; throw error })), "Candidate destination already exists; use a new directory")
  assert.match(facility, releasePattern, "Invalid private facility release")
  const registryPath = "src/content/facility-releases/registry.json"
  const originalRegistry = await readFile(join(source, registryPath))
  const registry = registrySchema.parse(JSON.parse(originalRegistry))
  assert(!registry.some(entry => entry.release === facility), "Private facility must be unregistered in the source checkout")
  const facilityDirectory = join(source, "build/facility", facility, "release")
  const manifestBytes = await readFile(join(facilityDirectory, "manifest.json"))
  const manifest = manifestSchema.parse(JSON.parse(manifestBytes))
  assert.equal(manifest.release, facility, "Private facility manifest identity mismatch")
  const facilityNames = ["manifest.json", ...expectedReleaseFiles(manifest)].sort()
  assert.deepEqual((await readdir(facilityDirectory)).sort(), facilityNames, "Private facility contains non-allowlisted files")
  const facilityBytes = new Map()
  for (const name of facilityNames) {
    const full = join(facilityDirectory, name)
    assert((await lstat(full)).isFile() && await realpath(full) === full, "Private facility must contain regular files")
    const bytes = await readFile(full)
    if (name !== "manifest.json") {
      const entry = manifest.files.find(file => file.file === name)
      assert(bytes.length === entry.bytes && privateDigest(bytes) === entry.sha256, `Private facility integrity mismatch: ${name}`)
    } else assert.deepEqual(bytes, manifestBytes, "Private facility changed while preparing")
    facilityBytes.set(name, bytes)
  }
  const movieDirectory = join(source, "build/cinematic", cinematic, "release")
  const movie = await readCinematicDirectory(movieDirectory, cinematic)
  assert(manifest.source?.masterSha256 && manifest.source.masterSha256 === movie.manifest.source.masterSha256, "Private facility and cinematic releases must share the same editable master SHA-256")
  const sourceFiles = await privateSourceInventory(source)
  assert(sourceFiles.some(file => file.path === "package-lock.json"), "Source package lock missing")
  const dependencies = await realpath(dependencyRoot ?? join(source, "node_modules"))
  const installedLockSha256 = privateDigest(await readFile(join(dependencies, ".package-lock.json")))
  const entry = { release: facility, status: "available", manifestSha256: privateDigest(manifestBytes) }
  const derivedRegistry = Buffer.from(`${JSON.stringify(registrySchema.parse([...registry, entry]), null, 2)}\n`)
  // This is the only mutation boundary. Existing directories are never reused.
  await mkdir(out)
  for (const file of sourceFiles) {
    const bytes = await readFile(join(source, file.path))
    assert(bytes.length === file.bytes && privateDigest(bytes) === file.sha256, `Source changed while preparing: ${file.path}`)
    await writeNew(out, file.path, file.path === registryPath ? derivedRegistry : bytes)
  }
  for (const [name, bytes] of facilityBytes) await writeNew(out, `src/content/facility-releases/${facility}/${name}`, bytes)
  const extraFiles = []
  for (const [name, bytes] of [["manifest.json", movie.manifestBytes], ...movie.artifacts]) {
    const path = `build/cinematic/${cinematic}/release/${name}`
    await writeNew(out, path, bytes)
    extraFiles.push({ path, bytes: bytes.length, sha256: privateDigest(bytes) })
  }
  await symlink(dependencies, join(out, "node_modules"), "dir")
  assert.deepEqual(await privateSourceInventory(source), sourceFiles, "Source changed during preparation; incomplete snapshot must not run")
  for (const [name, bytes] of facilityBytes) assert.deepEqual(await readFile(join(facilityDirectory, name)), bytes, "Staged facility changed during preparation")
  const movieAfter = await readCinematicDirectory(movieDirectory, cinematic)
  assert.deepEqual(movieAfter.manifestBytes, movie.manifestBytes, "Staged cinematic release changed during preparation")
  assert.equal(privateDigest(await readFile(join(dependencies, ".package-lock.json"))), installedLockSha256, "Shared dependency lock changed during preparation")
  const files = await privateSourceInventory(out)
  const marker = {
    schemaVersion: "private-candidate.v1", privateOnly: true, releaseApproval: false,
    createdAt: new Date().toISOString(), sourceRoot: source, candidateRoot: out,
    sourceInventorySha256: inventoryDigest(sourceFiles), derivedInventorySha256: inventoryDigest(files),
    facility: { release: facility, manifestSha256: entry.manifestSha256, registryBeforeSha256: privateDigest(originalRegistry), registryAfterSha256: privateDigest(derivedRegistry) },
    cinematic: { release: cinematic, manifestSha256: privateDigest(movie.manifestBytes) },
    dependencies: { path: dependencies, installedLockSha256, sharedReadOnly: true },
    build: { bundler: "webpack", npmArguments: ["run", "build", "--", "--webpack"] },
    sourceFiles, files, extraFiles: extraFiles.sort((a, b) => a.path.localeCompare(b.path)),
    scope: "Private loopback visual and performance qualification only. The derived registry entry is not publication or release approval.",
  }
  await writeNew(out, PRIVATE_CANDIDATE_MARKER, `${JSON.stringify(marker, null, 2)}\n`)
  return { candidateRoot: out, privateOnly: true, releaseApproval: false, sourceInventorySha256: marker.sourceInventorySha256, derivedInventorySha256: marker.derivedInventorySha256, sourceFiles: files.length, facility: marker.facility, cinematic: marker.cinematic }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), values = {}
  const names = { "--source": "source", "--out": "out", "--facility": "facility", "--cinematic": "cinematic", "--dependency-root": "dependencyRoot" }
  for (let index = 0; index < args.length; index += 2) {
    assert(names[args[index]] && args[index + 1] && !args[index + 1].startsWith("--"), "Usage: prepare-private-candidate.mjs --out /new/path --facility facility-vN --cinematic cinematic-vN [--source /checkout] [--dependency-root /node_modules]")
    assert(values[names[args[index]]] === undefined, "Duplicate private candidate option")
    values[names[args[index]]] = args[index + 1]
  }
  console.log(JSON.stringify(await preparePrivateCandidate(values), null, 2))
}
