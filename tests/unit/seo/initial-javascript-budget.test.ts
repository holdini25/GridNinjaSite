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
    const html = '<script src="/_next/static/main.js?dpl=dpl_fixture"></script><script src="/_next/static/ssr-dynamic.js"></script>'
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
