// @vitest-environment node
import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { qualificationPlaywrightOptions } from "../../../scripts/facility/qualification-playwright.mjs"

let directory: string, binary: string
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "gn-pw-options-")); binary = join(directory, "chrome"); await writeFile(binary, "fixture, never executed"); binary = await realpath(binary) })
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })
const env = (): NodeJS.ProcessEnv => ({ NODE_ENV: "test", FACILITY_EXPECTED_CHROME_VERSION: "155.0.8059.79", FACILITY_CHROME_EXECUTABLE_PATH: binary, CHROME_PATH: binary })

describe("explicit Playwright qualification executable", () => {
  it("requires Chromium sandboxing with the fixed executable", async () => {
    expect(await qualificationPlaywrightOptions({ headless: true, angle: undefined, env: env(), platform: "linux" })).toEqual({ headless: true, executablePath: binary, chromiumSandbox: true })
  })
  it("keeps the existing Metal options limited to macOS", async () => {
    expect(await qualificationPlaywrightOptions({ headless: false, angle: "metal", env: env(), platform: "darwin" })).toEqual({ headless: false, executablePath: binary, chromiumSandbox: true, args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] })
    await expect(qualificationPlaywrightOptions({ headless: true, angle: "metal", env: env(), platform: "linux" })).rejects.toThrow("macOS")
  })
  it("rejects missing pins and conflicting channel selection", async () => {
    await expect(qualificationPlaywrightOptions({ headless: true, angle: undefined, env: { NODE_ENV: "test" } })).rejects.toThrow("version")
    await expect(qualificationPlaywrightOptions({ headless: true, angle: undefined, env: { ...env(), FACILITY_CHROME_CHANNEL: "chrome" } })).rejects.toThrow("channel")
    await expect(qualificationPlaywrightOptions({ headless: true, angle: undefined, env: { ...env(), FACILITY_CHROME_EXECUTABLE_PATH: "chrome" } })).rejects.toThrow("absolute")
  })
  it("accepts a canonical alias but rejects another executable", async () => {
    const alias = join(directory, "alias"), other = join(directory, "other")
    await symlink(binary, alias); await writeFile(other, "another fixture")
    expect((await qualificationPlaywrightOptions({ headless: true, angle: undefined, env: { ...env(), CHROME_PATH: alias } })).executablePath).toBe(binary)
    await expect(qualificationPlaywrightOptions({ headless: true, angle: undefined, env: { ...env(), CHROME_PATH: other } })).rejects.toThrow("Conflicting")
  })
})
