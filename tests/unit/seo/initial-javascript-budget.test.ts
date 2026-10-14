// @vitest-environment node
import { describe, expect, it } from "vitest"
import { collectInitialJavaScriptChunks, collectPagesInitialJavaScriptChunks } from "../../../scripts/validate-contact-build.mjs"

describe("complete initial JavaScript budget graph", () => {
  it("includes shared framework absent from client references without charging duplicate chunks twice", () => {
    expect(collectInitialJavaScriptChunks(
      { rootMainFiles: ["static/react.js", "static/runtime.js"] },
      { clientModules: { form: { chunks: ["static/runtime.js", "static/form.js"] }, nav: { chunks: ["static/nav.js", "static/nav.css", "static/form.js"] } } },
    )).toEqual(["static/react.js", "static/runtime.js", "static/form.js", "static/nav.js"])
  })

  it("charges the Pages framework, shared app, route, low-priority and HTML-only dynamic chunks", () => {
    const manifest = {
      rootMainFiles: ["static/app-router-only.js"],
      pages: {
        "/_app": ["static/webpack.js", "static/framework.js", "static/main.js", "static/app.js", "static/shared.css"],
        "/contact": ["static/webpack.js", "static/framework.js", "static/main.js", "static/contact.js"],
      },
      lowPriorityFiles: ["static/build/_buildManifest.js", "static/build/_ssgManifest.js"],
    }
    const html = '<script src="/_next/static/main.js?dpl=dpl_fixture"></script><script src="/_next/static/ssr-dynamic.js"></script><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"observability":false}}}</script>'
    expect(collectPagesInitialJavaScriptChunks(manifest, "/contact", html)).toEqual([
      "static/webpack.js", "static/framework.js", "static/main.js", "static/app.js", "static/contact.js",
      "static/build/_buildManifest.js", "static/build/_ssgManifest.js", "static/ssr-dynamic.js",
    ])
    for (const missing of [
      { ...manifest, pages: { "/contact": manifest.pages["/contact"] } },
      { ...manifest, pages: { "/_app": manifest.pages["/_app"] } },
      { ...manifest, lowPriorityFiles: undefined },
    ]) expect(() => collectPagesInitialJavaScriptChunks(missing, "/contact", html)).toThrow(/missing/)
    expect(() => collectPagesInitialJavaScriptChunks(manifest, "/contact", "<h1>Contact</h1>")).toThrow(/no initial JavaScript/)
    expect(() => collectPagesInitialJavaScriptChunks(manifest, "/contact", '<script src="https://other.test/app.js"></script>')).toThrow(/unsupported initial script/)
    expect(() => collectPagesInitialJavaScriptChunks(manifest, "/contact", '<script src="/_next/static/main.js?other=unreviewed"></script>')).toThrow(/unsupported initial script/)
  })
})

describe("Pages initial client-only observability budget", () => {
  const key = "pages/_app.tsx -> @/components/analytics/vercel-observability"
  const manifest = { pages: { "/_app": ["static/shared.js", "static/app.js"], "/contact": ["static/shared.js", "static/contact.js"] }, lowPriorityFiles: ["static/build/_buildManifest.js"] }
  const html = (observability: unknown) => `<script src="/_next/static/shared.js"></script><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { observability } } })}</script>`
  const base = ["static/shared.js", "static/app.js", "static/contact.js", "static/build/_buildManifest.js"]

  it("charges every enabled loadable JavaScript file once, including shared and duplicate entries", () => {
    expect(collectPagesInitialJavaScriptChunks(manifest, "/contact", html(true), {
      [key]: { files: ["static/observability-vendor.js", "static/shared.js", "static/observability.js", "static/observability.js", "static/style.css"] },
    })).toEqual([...base, "static/observability-vendor.js", "static/observability.js"])
  })

  it("does not require or charge the optional entry when the built page disables observability", () => {
    expect(collectPagesInitialJavaScriptChunks(manifest, "/contact", html(false))).toEqual(base)
    expect(collectPagesInitialJavaScriptChunks(manifest, "/contact", html(false), { [key]: { files: ["static/observability.js"] } })).toEqual(base)
    expect(collectPagesInitialJavaScriptChunks(manifest, "/contact", html(false), { [key]: { files: [] } })).toEqual(base)
  })

  it.each([undefined, null, {}, { files: [] }, { files: "static/observability.js" }, { files: [null] }, { files: ["static/../../outside.js"] }, { files: ["https://other.test/script.js"] }, { files: ["static/style.css"] }])("fails closed for an enabled but invalid loadable entry: %j", entry => {
    expect(() => collectPagesInitialJavaScriptChunks(manifest, "/contact", html(true), { [key]: entry })).toThrow(/required Pages observability/)
  })

  it.each([undefined, null, "true", 1])("rejects an ambiguous build-time setting: %j", setting => {
    expect(() => collectPagesInitialJavaScriptChunks(manifest, "/contact", html(setting))).toThrow(/explicit boolean/)
  })

  it("rejects absent, duplicate or malformed build data instead of assuming observability is disabled", () => {
    const script = '<script src="/_next/static/shared.js"></script>'
    for (const data of ["", '<script id="__NEXT_DATA__" type="application/json">not json</script>', html(false) + html(false)]) {
      expect(() => collectPagesInitialJavaScriptChunks(manifest, "/contact", script + data)).toThrow(/Pages __NEXT_DATA__/)
    }
  })
})
