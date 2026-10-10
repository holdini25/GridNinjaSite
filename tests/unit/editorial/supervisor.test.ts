// @vitest-environment node
import { execFileSync } from "node:child_process"
import { expect, it } from "vitest"

it("enforces the durable fallback chain and lock ownership without launching Blender", () => {
  const result = execFileSync("python3", ["tests/unit/editorial/supervisor_checks.py"], { cwd: process.cwd(), encoding: "utf8", stdio: "pipe", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } })
  expect(result).toBe("")
})
