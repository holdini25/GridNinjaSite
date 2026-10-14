// @vitest-environment node
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

import { dynamic, GET } from "@/app/manifest.webmanifest/route"

// Captured from the previous file-convention route. This locks its public byte
// contract independently of the relocated builder and new route implementation.
const previousBody = readFileSync(new URL("../../fixtures/web-app-manifest.json", import.meta.url), "utf8")

afterEach(() => vi.unstubAllEnvs())

describe("web application manifest route", () => {
  it.each(["preview", "production"])("preserves the former response bytes and headers in %s", async environment => {
    vi.stubEnv("VERCEL_ENV", environment)
    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/manifest+json")
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
    expect(response.headers.has("set-cookie")).toBe(false)
    expect(response.headers.has("location")).toBe(false)
    expect(await response.text()).toBe(previousBody)
  })

  it("opts the ordinary GET route into static generation", () => {
    expect(dynamic).toBe("force-static")
  })
})
