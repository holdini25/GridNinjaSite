import {
  getRedirectUrl,
  unstable_getResponseFromNextConfig,
} from "next/experimental/testing/server"
import { describe, expect, it } from "vitest"

import nextConfig from "../../../next.config"

describe("canonical host redirect", () => {
  it.each([
    ["https://gridninja.ai/", "https://www.gridninja.ai/"],
    [
      "https://gridninja.ai/platform/dispatch-envelope?source=canonical-test",
      "https://www.gridninja.ai/platform/dispatch-envelope?source=canonical-test",
    ],
  ])("permanently redirects %s to %s", async (source, destination) => {
    const response = await unstable_getResponseFromNextConfig({
      url: source,
      nextConfig,
    })

    expect(response.status).toBe(308)
    expect(getRedirectUrl(response)).toBe(destination)
  })

  it("does not redirect the canonical www host", async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: "https://www.gridninja.ai/platform?source=canonical-test",
      nextConfig,
    })

    expect(response.status).toBe(200)
    expect(getRedirectUrl(response)).toBeNull()
  })
})
