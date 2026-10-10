import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { homepageArtwork } from "@/content/editorial-artwork"
import { EditorialThumbnail } from "@/components/marketing/editorial-thumbnail"
import { AuthorityComposition } from "@/components/marketing/authority-composition"
import { CivicComposition } from "@/components/marketing/civic-composition"

describe("homepage artwork boundaries", () => {
  it("assigns five distinct subjects without reusing an architectural slot", () => {
    expect(Object.keys(homepageArtwork)).toEqual(["ai-cloud", "colocation", "brief", "proof", "platform"])
    const subjects = [homepageArtwork["ai-cloud"].subject, homepageArtwork.colocation.subject, homepageArtwork.platform.subject]
    expect(new Set(subjects).size).toBe(3)
    expect(homepageArtwork.brief).toMatchObject({ publicationId: "demo-01-b", version: "1.0.0" })
  })

  it("keeps the card context when the editorial release is unavailable, without substituting another subject", () => {
    const html = renderToStaticMarkup(<EditorialThumbnail slot="colocation" release={null} />)
    expect(html).toContain("Illustration unavailable")
    expect(html).toContain("Illustrative tenant-capacity hall")
    expect(html).not.toContain("<img")
    expect(html).not.toContain("cinematic-v1")
  })

  it("renders civic context once for assistive technology with visible current-offer limits", () => {
    const html = renderToStaticMarkup(<CivicComposition />)
    expect(html.match(/Conceptual shared infrastructure:/g)).toHaveLength(1)
    expect(html).toContain("does not add services or establish community benefits")
    expect(html).toContain("separate evidence and review")
    expect(html).not.toMatch(/<script|<canvas|<iframe/)
  })

  it("retains the gate and permission boundary in both diagram presentations", () => {
    const full = renderToStaticMarkup(<AuthorityComposition />)
    const thumbnail = renderToStaticMarkup(<AuthorityComposition thumbnail />)
    expect(full).toContain("Separate authorization gate")
    expect(full).toContain("does not open the operating gate")
    expect(thumbnail).toContain("operating permission")
    expect(thumbnail).toContain("gn-authority-gate-line")
    expect(full + thumbnail).not.toMatch(/<script|<canvas|onClick/)
  })
})
