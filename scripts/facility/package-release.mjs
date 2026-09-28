import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, writeFile, mkdir, copyFile, access, open, rename, rm } from "node:fs/promises"
import { join } from "node:path"
import { expectedReleaseFiles, hash, manifestSchema, registrySchema, releasePattern, validateFacilityDirectory } from "./validate-release.mjs"
import { assetByteCeiling } from "../../src/lib/facility/manifest-schema.mjs"

const args = process.argv.slice(2)
let release, freeze = false
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--release" && !release) release = args[++i]
  else if (args[i] === "--freeze" && !freeze) freeze = true
  else throw new Error("Usage: package-release.mjs --release facility-vN [--freeze]")
}
assert(typeof release === "string" && releasePattern.test(release), "An explicit valid --release facility-vN is required")
const root = process.cwd()
const candidate = join(root, "build/facility", release)
const destination = join(candidate, "release")
const source = join(root, "assets-source/facility")
const lockPath = join(source, "generation.lock")
const lease = await open(lockPath, "wx").catch(error => { throw new Error(`Facility writer lease unavailable: ${error.code}. Inspect the active Blender/capture/package process before removing a stale lock.`) })
const temporary = []
const exists = async path => { try { await access(path); return true } catch (error) { if (error.code === "ENOENT") return false; throw error } }
const currentSource = async (modules, masters) => {
  if (modules !== undefined) {
    assert(modules && typeof modules === "object" && !Array.isArray(modules), "Invalid source module hashes")
    assert(Object.keys(modules).length > 0 && Object.keys(modules).length <= 16, "Invalid source module count")
    for (const [file, digest] of Object.entries(modules)) {
      assert(/^[a-z][a-z0-9_-]*\.(?:py|json)$/.test(file) && /^[a-f0-9]{64}$/.test(digest), "Invalid source module identity")
    }
    assert("generate.py" in modules && "export.py" in modules && "scene.json" in modules, "Source modules must cover generation, export, and scene inputs")
  }
  if (masters) {
    assert(Object.keys(masters).length <= 3 && Object.keys(masters).every(name => /^[a-z][a-z0-9_-]*\.blend$/.test(name)), "Invalid source master names")
  }
  return {
    blender: "5.2.2 LTS",
    masterSha256: hash(await readFile(join(source, "facility-master.blend"))),
    generatorSha256: hash(await readFile(join(source, "generate.py"))),
    ...(modules ? { modules: Object.fromEntries(await Promise.all(Object.keys(modules).sort().map(async file => [file, hash(await readFile(join(source, file)))]))) } : {}),
    ...(masters ? { masters: Object.fromEntries(await Promise.all(Object.keys(masters).sort().map(async file => [file, hash(await readFile(join(source, file)))]))) } : {}),
  }
}
const atomicFile = async (path, bytes) => {
  const pathTemporary = `${path}.${randomUUID()}.tmp`
  temporary.push(pathTemporary)
  const file = await open(pathTemporary, "wx")
  try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
  await rename(pathTemporary, path)
}

try {
  await lease.writeFile(JSON.stringify({ pid: process.pid, operation: freeze ? "freeze" : "stage", release }) + "\n")
  await mkdir(candidate, { recursive: true })
  const registryPath = join(root, "src/content/facility-releases/registry.json")
  const originalRegistryBytes = await readFile(registryPath)
  const registry = registrySchema.parse(JSON.parse(originalRegistryBytes))
  assert(!registry.some(entry => entry.release === release), "This release is already registered. Preserve its bytes and choose a new release ID.")
  if (!freeze) {
    const tmp = join(candidate, `.stage-${randomUUID()}`)
    temporary.push(tmp)
    await mkdir(tmp)
    const descriptorsPath = join(candidate, "specimen-descriptors.json")
    const specimens = await exists(descriptorsPath) ? JSON.parse(await readFile(descriptorsPath, "utf8")) : undefined
    const files = []
    for (const file of expectedReleaseFiles({ specimens })) {
      const bytes = await readFile(join(candidate, file))
      assert(bytes.length <= assetByteCeiling(file), `${file} exceeds its budget`)
      await writeFile(join(tmp, file), bytes, { flag: "wx" })
      files.push({ file, bytes: bytes.length, sha256: hash(bytes) })
    }
    const exportReport = JSON.parse(await readFile(join(candidate, "asset-report.json"), "utf8"))
    const specimenReports = await Promise.all(Object.keys(specimens ?? {}).map(async kind => JSON.parse(await readFile(join(candidate, `${kind}-asset-report.json`), "utf8"))))
    const masters = specimenReports.length ? Object.fromEntries(specimenReports.map(report => {
      const file = report.source?.split("/").at(-1)
      assert(file && /^[a-z][a-z0-9_-]*\.blend$/.test(file), "Missing specimen source master")
      return [file, report.sourceSha256]
    })) : undefined
    const sourceState = await currentSource(exportReport.sourceModules, masters)
    assert.equal(exportReport.sha256, files.find(file => file.file === "facility.glb").sha256, "Model differs from generator export report")
    assert.equal(exportReport.sourceSha256, sourceState.masterSha256, "Master changed after export; regenerate the candidate")
    assert.equal(exportReport.generatorSha256, sourceState.generatorSha256, "Generator changed after export; regenerate the candidate")
    if (sourceState.modules) assert.deepEqual(exportReport.sourceModules, sourceState.modules, "Source module changed after export; regenerate the candidate")
    for (const [index, kind] of Object.keys(specimens ?? {}).entries()) {
      const report = specimenReports[index]
      assert.equal(report.sha256, files.find(file => file.file === `${kind}.glb`).sha256, "Specimen differs from export report")
      assert.equal(report.sourceSha256, sourceState.masters[report.source.split("/").at(-1)], "Specimen master changed after export")
      if (report.sourceModules) for (const [file, digest] of Object.entries(report.sourceModules)) assert.equal(digest, hash(await readFile(join(source, file))), "Specimen source changed after export")
    }
    const profile = JSON.parse(await readFile(join(source, "render-profile.json"), "utf8"))
    const indexPath = join(candidate, "equipment-index.json")
    const equipmentIndex = await exists(indexPath) ? JSON.parse(await readFile(indexPath, "utf8")) : undefined
    const manifest = manifestSchema.parse({
      schemaVersion: "facility.v1", release, environment: "synthetic", profile,
      ...(equipmentIndex ? { equipmentIndex } : {}),
      systems: Object.fromEntries(["power", "cooling", "storage", "workloads"].map(id => [id, { root: `GN_${id.toUpperCase()}`, accent: `GN_ACCENT_${id.toUpperCase()}`, pick: `GN_PICK_${id.toUpperCase()}` }])),
      equipment: {
        rotors: Array.from({ length: 4 }, (_, i) => ({ id: `GN_FAN_ROTOR_0${i}`, axis: [0, 1, 0] })),
        leds: Array.from({ length: 48 }, (_, i) => `GN_LED_${String(i).padStart(2, "0")}`),
      }, ...(specimens ? { specimens } : {}), files, source: sourceState,
    })
    await writeFile(join(tmp, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" })
    await validateFacilityDirectory(tmp, release, { reportPath: join(candidate, "validation.json") })
    const previous = `${destination}.previous-${randomUUID()}`
    let oldMoved = false
    if (await exists(destination)) { await rename(destination, previous); temporary.push(previous); oldMoved = true }
    try { await rename(tmp, destination) } catch (error) { if (oldMoved) await rename(previous, destination); throw error }
    console.log(`Staged complete ${release} at build/facility/${release}/release. Preview with FACILITY_PREVIEW=1 FACILITY_ASSET_RELEASE=${release}.`)
    console.log(JSON.stringify({ files, profile: manifest.profile.background }, null, 2))
  } else {
    // Freeze the already reviewed staged bytes. Never silently restage changed input.
    const { manifest, manifestBytes } = await validateFacilityDirectory(destination, release, { reportPath: join(candidate, "validation.json") })
    assert.deepEqual(manifest.source, await currentSource(manifest.source.modules, manifest.source.masters), "Source changed after staging; stage and review again")
    assert.deepEqual(manifest.profile, JSON.parse(await readFile(join(source, "render-profile.json"), "utf8")), "Render profile changed after staging; recapture and review")
    const capture = JSON.parse(await readFile(join(candidate, "capture-profile.json"), "utf8"))
    assert.equal(capture.release, release, "Capture release mismatch")
    assert.equal(capture.modelSha256, manifest.files.find(file => file.file === "facility.glb").sha256, "Posters were captured from a different model")
    assert.equal(capture.profileSha256, hash(Buffer.from(JSON.stringify(manifest.profile))), "Posters were captured under a different render profile")
    if (manifest.specimens) {
      assert.deepEqual(manifest.specimens, JSON.parse(await readFile(join(candidate, "specimen-descriptors.json"), "utf8")), "Specimen descriptors changed after staging")
      for (const [kind, specimen] of Object.entries(manifest.specimens)) {
        assert.equal(capture.specimens?.[kind]?.modelSha256, manifest.files.find(file => file.file === `${kind}.glb`).sha256, "Specimen capture model mismatch")
        assert.equal(capture.specimens?.[kind]?.profileSha256, hash(Buffer.from(JSON.stringify(specimen.profile))), "Specimen capture profile mismatch")
      }
    }
    for (const file of manifest.files.filter(file => file.file.endsWith(".webp"))) assert.equal(capture.posters?.[file.file], file.sha256, "Staged poster differs from its browser capture")
    const target = join(root, "src/content/facility-releases", release)
    let createdTarget = false
    let committed = false
    try {
      if (await exists(target)) {
        // Recover only an identical complete unregistered bundle after a crash.
        await validateFacilityDirectory(target, release, { manifestDigest: hash(manifestBytes), reportPath: join(candidate, "validation-recovery.json") })
      } else {
        const tmp = join(root, "src/content/facility-releases", `.freeze-${randomUUID()}`)
        temporary.push(tmp)
        await mkdir(tmp)
        for (const file of [...expectedReleaseFiles(manifest), "manifest.json"]) await copyFile(join(destination, file), join(tmp, file))
        await validateFacilityDirectory(tmp, release, { manifestDigest: hash(manifestBytes), reportPath: join(candidate, "validation-freeze.json") })
        await rename(tmp, target)
        createdTarget = true
      }
      assert.equal(hash(await readFile(registryPath)), hash(originalRegistryBytes), "Registry changed during packaging")
      registry.push({ release, status: "available", manifestSha256: hash(manifestBytes) })
      // Atomic registry replacement is the visibility point for a complete bundle.
      await atomicFile(registryPath, JSON.stringify(registry, null, 2) + "\n")
      committed = true
      console.log(`Frozen ${release} without modifying earlier releases. Public website deployment remains separate.`)
    } finally {
      if (createdTarget && !committed) await rm(target, { recursive: true, force: true })
    }
  }
} finally {
  try {
    for (const path of temporary) await rm(path, { recursive: true, force: true })
  } finally {
    try { await lease.close() } finally { await rm(lockPath, { force: true }) }
  }
}
