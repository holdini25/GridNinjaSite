import assert from "node:assert/strict"
import { realpath, stat } from "node:fs/promises"
import { isAbsolute } from "node:path"
import { QUALIFICATION_CHROME_VERSION } from "./qualification-browser.mjs"

// The scoped runner trial requires Chromium sandboxing for every browser.
// Opt in explicitly: Playwright otherwise adds --no-sandbox by default.
// Lighthouse's separate launch flags are not applied to Playwright.
export async function qualificationPlaywrightOptions({ headless, angle, env = process.env, platform = process.platform }) {
  assert.equal(env.FACILITY_EXPECTED_CHROME_VERSION, QUALIFICATION_CHROME_VERSION, "Missing fixed Playwright browser version")
  assert(!env.FACILITY_CHROME_CHANNEL, "A channel cannot override the fixed Playwright executable")
  assert(typeof headless === "boolean", "Explicit headless setting required")
  assert(!angle || angle === "metal" && platform === "darwin", "Only the existing macOS Metal override is permitted")
  assert(isAbsolute(env.FACILITY_CHROME_EXECUTABLE_PATH ?? ""), "Missing absolute qualification Chrome path")
  const executablePath = await realpath(env.FACILITY_CHROME_EXECUTABLE_PATH)
  assert((await stat(executablePath)).isFile(), "Qualification Chrome must be a file")
  if (env.CHROME_PATH) assert.equal(await realpath(env.CHROME_PATH), executablePath, "Conflicting Chrome paths")
  return { headless, executablePath, chromiumSandbox: true, ...(angle ? { args: ["--use-angle=metal", "--use-gl=angle"], ignoreDefaultArgs: ["--use-angle=swiftshader", "--disable-gpu"] } : {}) }
}
