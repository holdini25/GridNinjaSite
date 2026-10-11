// @vitest-environment node

import { createRequire } from "node:module"
import { Readable } from "node:stream"
import { isValidElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { Button } from "@/components/ui/button"

// Decode with this Next installation, rather than imitating React's private lazy
// object. Async solution routes emitted this deferred-child shape in their Flight
// response while @radix-ui/react-slot 1.2.3 silently omitted the resulting link.
// Upstream fix: @radix-ui/react-slot 1.2.4 (MIT), pinned in npm overrides.
// https://github.com/radix-ui/primitives/blob/main/packages/react/slot/CHANGELOG.md
// Next's bundled decoder has no public types; revisit this fixture with Next/React
// upgrades. The route-level browser checks cover the complete framework pipeline.
const { createFromNodeStream } = createRequire(import.meta.url)(
  "next/dist/compiled/react-server-dom-webpack/client.node.js",
) as {
  createFromNodeStream: (
    stream: Readable,
    manifest: { moduleMap: object; serverModuleMap: object; moduleLoading: null },
  ) => PromiseLike<{ children: ReactNode }>
}

it("preserves a deferred server-rendered sample link through Button asChild", async () => {
  const href = "/evidence/assessments/demo-01-a/v1.0.0"
  const label = "See a sample decision brief"
  const flight = [
    '0:{"children":"$L1"}',
    `1:${JSON.stringify(["$", "a", null, {
      href,
      "data-gn-event": "hero-secondary-cta",
      children: label,
    }])}`,
    "",
  ].join("\n")
  const model = await createFromNodeStream(Readable.from([flight]), {
    moduleMap: {},
    serverModuleMap: {},
    moduleLoading: null,
  })

  expect(isValidElement(model.children)).toBe(false)
  expect(renderToStaticMarkup(model.children)).toContain(`href="${href}"`)

  const html = renderToStaticMarkup(
    <Button asChild variant="outline" size="lg" className="sample-action">
      {model.children}
    </Button>,
  )
  expect(html).toMatch(/^<a /)
  expect(html).toContain(`href="${href}"`)
  expect(html).toContain(`>${label}</a>`)
  expect(html).toContain('data-gn-event="hero-secondary-cta"')
  expect(html).toContain('data-slot="button"')
  expect(html).toContain('data-variant="outline"')
  expect(html).toContain('data-size="lg"')
  expect(html).toContain("sample-action")
})
