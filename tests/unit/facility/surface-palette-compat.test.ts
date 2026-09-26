// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { authoredSurfacePalette, validateMaterialPalette } from "../../../assets-source/facility/validate-surfaces.mjs"

const root = resolve("src/content/facility-releases")
const scratch = mkdtempSync(join(tmpdir(), "gridninja-palette-"))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
function asset(release: number, name = "facility.glb") {
  const path = join(root, `facility-v${release}`, name)
  const bytes = readFileSync(path)
  const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
  return { path, bytes, data }
}

describe("immutable surface palette revisions", () => {
  it.each([5, 6, 7])("validates all v%s assets against their own approved palette", release => {
    for (const name of ["facility.glb", "rack.glb", "cooling.glb"]) {
      const { path, bytes, data } = asset(release, name)
      expect(() => validateMaterialPalette(data.materials, authoredSurfacePalette(path, bytes))).not.toThrow()
    }
  })

  it.each([5, 6, 7])("still rejects changed material factors in v%s", release => {
    const { path, bytes, data } = asset(release)
    const material = data.materials.find((item: { name: string }) => item.name === "Graphite")
    material.pbrMetallicRoughness.baseColorFactor[0] += .001
    expect(() => validateMaterialPalette(data.materials, authoredSurfacePalette(path, bytes))).toThrow("Authored linear palette factor lost: Graphite")
  })

  it("does not accept a new palette merely because it is valid for another release", () => {
    const legacy = asset(6), current = asset(7)
    expect(() => validateMaterialPalette(current.data.materials, authoredSurfacePalette(legacy.path, legacy.bytes))).toThrow("Authored linear palette factor lost")
    expect(() => validateMaterialPalette(legacy.data.materials, authoredSurfacePalette(current.path, current.bytes))).toThrow("Authored linear palette factor lost")
  })

  it("requires the actual bytes to match the manifest used to choose a historical revision", () => {
    const { path, bytes } = asset(5)
    const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1
    expect(() => authoredSurfacePalette(path, changed)).toThrow("Surface palette manifest asset mismatch")
  })

  it("rejects unknown palette revisions instead of silently applying the latest palette", () => {
    const { bytes } = asset(7)
    const manifest = JSON.parse(readFileSync(join(root, "facility-v7/manifest.json"), "utf8"))
    manifest.profile.lighting.environment.preset = "unknown-future-palette"
    writeFileSync(join(scratch, "manifest.json"), JSON.stringify(manifest))
    expect(() => authoredSurfacePalette(join(scratch, "facility.glb"), bytes)).toThrow("Unsupported authored surface palette revision")
  })
})
