// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { acquireComputeLock } from "../../../scripts/facility/compute-lock.mjs"

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
async function location() { const root = await mkdtemp(join(tmpdir(), "gridninja-compute-lock-")); directories.push(root); return join(root, "compute.lock") }

describe("shared authoring and browser measurement exclusion", () => {
  it("refuses a concurrent owner without changing their evidence and releases its own token", async () => {
    const path = await location()
    const release = await acquireComputeLock("browser-performance", { path })
    const held = await readFile(path, "utf8")
    expect(JSON.parse(held)).toMatchObject({ owner: "browser-performance", pid: process.pid })
    await expect(acquireComputeLock("editorial-render", { path })).rejects.toThrow("already held")
    expect(await readFile(path, "utf8")).toBe(held)
    await release()
    await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("never steals an existing or stale-looking lock", async () => {
    const path = await location()
    const stale = JSON.stringify({ owner: "editorial-render", pid: -1, token: "preserve" })
    await writeFile(path, stale)
    await expect(acquireComputeLock("browser-performance", { path })).rejects.toThrow("already held")
    expect(await readFile(path, "utf8")).toBe(stale)
  })

  it("does not remove a lock whose ownership changed", async () => {
    const path = await location()
    const release = await acquireComputeLock("browser-performance", { path })
    await writeFile(path, JSON.stringify({ owner: "someone-else", token: "different" }))
    await expect(release()).rejects.toThrow("ownership changed")
    expect(JSON.parse(await readFile(path, "utf8")).token).toBe("different")
  })
})
