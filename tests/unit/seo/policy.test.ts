import { describe, expect, it } from "vitest"

import {
  PRODUCTION_ORIGIN,
  absoluteUrl,
  isPreviewDeployment,
} from "@/seo/policy"

describe("SEO identity policy", () => {
  it("locks every search-facing URL to the immutable apex origin", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://gridninja.ai")
    expect(absoluteUrl("/")).toBe("https://gridninja.ai/")
    expect(absoluteUrl("/proof/proof-pack")).toBe(
      "https://gridninja.ai/proof/proof-pack"
    )
  })

  it("does not infer preview state from a public runtime URL", () => {
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
    const originalVercelEnvironment = process.env.VERCEL_ENV

    process.env.NEXT_PUBLIC_SITE_URL = "https://example-preview.vercel.app"
    delete process.env.VERCEL_ENV

    expect(isPreviewDeployment()).toBe(false)

    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    }
    if (originalVercelEnvironment === undefined) {
      delete process.env.VERCEL_ENV
    } else {
      process.env.VERCEL_ENV = originalVercelEnvironment
    }
  })
})
