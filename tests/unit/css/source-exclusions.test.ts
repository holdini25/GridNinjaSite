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
  it("accepts automatic scanning of the entire application source tree", () => {
    const root = fixture({
      "src/app/page.tsx": 'import "./globals.css"; export default function Page() { return null }',
    }, '@import "tailwindcss" source("../"); @source not "../components/orphan.tsx";')
    expect(validateCssSources(root).excluded).toEqual(["src/components/orphan.tsx"])
  })

  it.each(["./", "../components", "../../"])("rejects a narrowed or broadened automatic source scope: %s", scope => {
    const root = fixture({
      "src/app/page.tsx": 'import "./globals.css"; export default function Page() { return null }',
    }, `@import "tailwindcss" source("${scope}");`)
    expect(() => validateCssSources(root)).toThrow(/automatic source scope must cover the entire src/)
  })

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

describe("route-owned visual styles", () => {
  const visualFiles = {
    "src/components/visual.tsx": 'export const Visual = () => <div className="scene" />',
    "src/components/visual.css": '.scene { display: grid; }',
    "scripts/css/style-boundaries.json": JSON.stringify([
      { component: "src/components/visual.tsx", stylesheet: "src/components/visual.css" },
    ]),
  }

  it("accepts a grouped stylesheet imported by the page without leaking it into other routes", () => {
    const result = validateCssSources(fixture({
      ...visualFiles,
      "src/app/page.tsx": 'import "../components/visual"; import "./home.css"; export {}',
      "src/app/home.css": '@import "../components/visual.css"; .home { margin: 0; }',
      "src/app/contact/page.tsx": 'export default function Page() { return null }',
    }))
    expect(result.routeStyles["src/app/page.tsx"]).toContain("src/components/visual.css")
    expect(result.routeStyles["src/app/contact/page.tsx"]).not.toContain("src/components/visual.css")
  })

  it("accepts an owning component import and ancestor layout styles", () => {
    const root = fixture({
      ...visualFiles,
      "src/components/owner.tsx": 'import "./visual"; export const Owner = () => null',
      "src/app/nested/page.tsx": 'import "../../components/owner"; export {}',
      "src/app/layout.tsx": 'import "../components/visual.css"; export {}',
    })
    expect(validateCssSources(root).routeStyles["src/app/nested/page.tsx"]).toContain("src/components/visual.css")
    writeFileSync(join(root, "src/app/layout.tsx"), 'export {}')
    writeFileSync(join(root, "src/components/owner.tsx"), 'import "./visual"; import "./visual.css"; export const Owner = () => null')
    expect(validateCssSources(root).routeStyles["src/app/nested/page.tsx"]).toContain("src/components/visual.css")
  })

  it.each(["_app", "_document"])("includes Pages %s ownership on direct route visits", owner => {
    const result = validateCssSources(fixture({
      ...visualFiles,
      "src/pages/contact.tsx": 'import "../components/visual"; export default function Contact() { return null }',
      [`src/pages/${owner}.tsx`]: 'import "../components/visual.css"; export default function Owner() { return null }',
    }))
    expect(result.routeStyles["src/pages/contact.tsx"]).toContain("src/components/visual.css")
    expect(result.routeStyles["src/app/page.tsx"]).not.toContain("src/components/visual.css")
  })

  it("does not borrow App layout or sibling page styles for a Pages direct visit", () => {
    expect(() => validateCssSources(fixture({
      ...visualFiles,
      "src/pages/contact.tsx": 'import "../components/visual"; export default function Contact() { return null }',
      "src/pages/other.tsx": 'import "../components/visual.css"; export default function Other() { return null }',
      "src/app/layout.tsx": 'import "../components/visual.css"; export default function Layout() { return null }',
    }))).toThrow(/src\/pages\/contact.tsx reaches .*visual.tsx without .*visual.css/)
  })

  it.each(["contact", "_app", "_document"])("preserves excluded component reachability from Pages %s", entry => {
    expect(() => validateCssSources(fixture({
      [`src/pages/${entry}.tsx`]: 'import "../components/orphan"; export default function Page() { return null }',
    }))).toThrow(/orphan\.tsx is reachable/)
  })

  it("rejects a direct visit that only receives styles after another route was visited", () => {
    expect(() => validateCssSources(fixture({
      ...visualFiles,
      "src/app/page.tsx": 'import "../components/visual"; export {}',
      "src/app/other/page.tsx": 'import "../../components/visual.css"; export {}',
    }))).toThrow(/src\/app\/page.tsx reaches .*visual.tsx without .*visual.css/)
  })

  it("rejects missing and conditional local CSS imports instead of assuming they load", () => {
    for (const css of ['@import "../components/missing.css";', '@import "../components/visual.css" screen and (min-width: 800px);']) {
      expect(() => validateCssSources(fixture({
        ...visualFiles,
        "src/app/page.tsx": 'import "../components/visual"; import "./home.css"; export {}',
        "src/app/home.css": css,
      }))).toThrow(/invalid local CSS import|unsupported CSS import/)
    }
  })
})
