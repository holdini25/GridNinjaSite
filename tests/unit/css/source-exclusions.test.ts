// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { validateCssSources } from "../../../scripts/css/validate-sources.mjs"

const fixtures: string[] = []
function fixture(files: Record<string, string> = {}, directives = '@source not "../components/orphan.tsx";') {
  const root = mkdtempSync(join(tmpdir(), "gridninja-css-source-"))
  fixtures.push(root)
  const initial = {
    "tsconfig.json": JSON.stringify({ compilerOptions: { module: "esnext", moduleResolution: "bundler", allowJs: true, resolveJsonModule: true, baseUrl: ".", paths: { "@/*": ["src/*"] } }, include: ["src/**/*"] }),
    "src/app/globals.css": directives,
    "src/app/page.tsx": "export default function Page() { return null }",
    "src/components/orphan.tsx": "export const Orphan = () => null",
    ...files,
  }
  for (const [file, content] of Object.entries(initial)) {
    const path = join(root, file)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  return root
}
afterEach(() => { for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe("Tailwind component-source exclusions", () => {
  it("keeps unused components while following cycles, CSS and JSON leaves", () => {
    const root = fixture({
      "src/app/page.tsx": 'import "../components/a"; import "@/app/globals.css"; import "../content.json"; export {}',
      "src/components/a.ts": 'export * from "./b"',
      "src/components/b.ts": 'export * from "./a"',
      "src/content.json": '{}',
    })
    const result = validateCssSources(root)
    expect(result.excluded).toEqual(["src/components/orphan.tsx"])
    expect(result.reachable).toContain("src/components/a.ts")
    expect(result.reachable).toContain("src/components/b.ts")
  })

  it.each([
    'import { Orphan } from "@/components/orphan"',
    'export * from "@/components/orphan"',
    'export { Orphan } from "@/components/orphan"',
    'const load = () => import("@/components/orphan")',
    'const load = () => import(`@/components/orphan`)',
    'const load = require("@/components/orphan")',
    'const load = module.require("@/components/orphan")',
    'import type { Orphan } from "@/components/orphan"',
    'type Component = typeof import("@/components/orphan")',
    'import Component = require("@/components/orphan")',
  ])("rejects a newly reachable excluded component through %s", statement => {
    expect(() => validateCssSources(fixture({ "src/app/page.tsx": statement }))).toThrow(/orphan\.tsx is reachable/)
  })

  it.each(["middleware.ts", "instrumentation.mts", "proxy.js", "future-entry.cjs", "content/entry.cts", "feature.jsx"])("treats src/%s as an entry even outside App Router", file => {
    expect(() => validateCssSources(fixture({ [`src/${file}`]: 'import "@/components/orphan"' }))).toThrow(/orphan\.tsx is reachable/)
  })

  it.each([
    '@source not "../components/*.tsx";',
    '@source not "../components/missing.tsx";',
    '@source not "./page.tsx";',
    '@source not "../components";',
    '@source not inline("hidden");',
    '@source not "../components/orphan.tsx"; @source not "../components/orphan.tsx";',
  ])("rejects an invalid exclusion: %s", directives => {
    expect(() => validateCssSources(fixture({}, directives))).toThrow(/CSS source validation/)
  })

  it.each([
    'import "./missing"',
    'import "@/components/missing"',
    'import "./missing.css"',
    'const load = (name: string) => import(name)',
    'const load = (name: string) => require(name)',
    'require.context("../components")',
    'import.meta.glob("../components/*.tsx")',
    'const load = require; load("@/components/orphan")',
    'const load = module.require; load("@/components/orphan")',
    'require.unknown("@/components/orphan")',
    'require["context"]("../components")',
    'import.meta["glob"]("../components/*.tsx")',
    'import { createRequire } from "node:module"',
  ])("fails closed when a loader cannot establish reachability: %s", statement => {
    expect(() => validateCssSources(fixture({ "src/app/page.tsx": statement }))).toThrow(/unresolved local import|nonliteral module loader|unsupported/)
  })
})
