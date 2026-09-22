// @vitest-environment node
import { describe, expect, it } from "vitest"
import { collectInitialJavaScriptChunks } from "../../../scripts/validate-contact-build.mjs"

describe("complete initial JavaScript budget graph", () => {
  it("includes shared framework absent from client references without charging duplicate chunks twice", () => {
    expect(collectInitialJavaScriptChunks(
      { rootMainFiles: ["static/react.js", "static/runtime.js"] },
      { clientModules: { form: { chunks: ["static/runtime.js", "static/form.js"] }, nav: { chunks: ["static/nav.js", "static/nav.css", "static/form.js"] } } },
    )).toEqual(["static/react.js", "static/runtime.js", "static/form.js", "static/nav.js"])
  })
})
