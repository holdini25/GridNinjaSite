// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { authorLouverTiles, deriveGlb, readGlb } from "../../../scripts/facility/derive-surface-candidate.mjs"

const recipe = JSON.parse(readFileSync("assets-source/facility/browser-v12-recipe.json", "utf8"))
const inTile = (x: number, y: number, tile: number[]) => x >= tile[0] && x < tile[0] + tile[2] && 511 - y >= tile[1] && 511 - y < tile[1] + tile[3]

describe("private cinematic surface derivative", () => {
  it("restricts formed vent normals to the two existing metric tiles and preserves every AO/alpha texel", () => {
    const normal = Buffer.alloc(512 * 512 * 4), orm = Buffer.alloc(normal.length)
    for (let index = 0; index < normal.length; index += 4) { normal.set([128, 128, 255, 255], index); orm.set([213, 140, 0, 255], index) }
    authorLouverTiles(normal, orm, recipe)
    let changed = 0, outOfTile = 0, invalidLength = 0, changedAo = 0
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const index = (y * 512 + x) * 4
      if (orm[index] !== 213 || orm[index + 3] !== 255 || normal[index + 3] !== 255) changedAo++
      if (normal[index] !== 128 || normal[index + 1] !== 128 || normal[index + 2] !== 255) {
        changed++
        if (!recipe.louvers.some((item: { tile: number[] }) => inTile(x, y, item.tile))) outOfTile++
        if (Math.abs(Math.hypot(...[0, 1, 2].map(channel => normal[index + channel] / 127.5 - 1)) - 1) > .007) invalidLength++
      }
    }
    expect(changed).toBeGreaterThan(512)
    expect([outOfTile, invalidLength, changedAo]).toEqual([0, 0, 0])
  })

  it.each(["facility.glb", "rack.glb", "cooling.glb"])("retains topology, joints, routes, UVs and all geometry bytes in %s", async filename => {
    const original = readFileSync(`src/content/facility-releases/facility-v10/${filename}`)
    const result = await deriveGlb(original, recipe)
    const before = readGlb(original).document, after = readGlb(result.bytes).document
    for (const field of ["nodes", "meshes", "accessors", "scenes", "animations", "textures", "images", "samplers"]) expect(after[field]).toEqual(before[field])
    expect(result.preservation.unchangedBuffers).toBe(before.bufferViews.length - 2)
    expect(result.preservation.aoPreserved).toBe(true)
    expect(result.preservation.colorAtlasPreserved).toBe(true)
    expect(after.materials.map((item: { extras: unknown }) => item.extras)).toEqual(before.materials.map((item: { extras: unknown }) => item.extras))
    expect(result.bytes.equals(original)).toBe(false)
  })
})
