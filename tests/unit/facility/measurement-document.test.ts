// @vitest-environment node
import { describe, expect, it } from "vitest"
import { lighthouseDocumentResponse } from "../../../scripts/facility/measurement-document.mjs"

const finalUrl = "https://gridninja-build-abc.vercel.app/contact"
function documentResponse(headers: Record<string, string> = {}) {
  return { method: "Network.responseReceived", params: { requestId: "navigation", frameId: "main", type: "Document", response: { url: finalUrl, status: 200, headers } } }
}
function result(events: unknown[]) {
  return { lhr: { finalUrl }, artifacts: { DevtoolsLog: events } }
}

describe("measured navigation response projection", () => {
  it("selects the actual Document response and ignores redirects, extra headers, resources and foreign iframes", () => {
    const actual = documentResponse({ "X-Robots-Tag": "noindex", "Content-Type": "text/html; charset=utf-8" })
    const events = [
      { method: "Network.requestWillBeSent", params: { type: "Document", redirectResponse: { url: finalUrl, status: 302, headers: { "x-robots-tag": "index" } } } },
      { method: "Network.responseReceivedExtraInfo", params: { requestId: "navigation", statusCode: 200, headers: { "x-robots-tag": "index" } } },
      { ...actual, params: { ...actual.params, type: "Fetch", response: { ...actual.params.response, headers: { "x-robots-tag": "index" } } } },
      { ...actual, params: { ...actual.params, frameId: "foreign", response: { ...actual.params.response, url: "https://third-party.example/frame", status: 403 } } },
      actual,
    ]
    expect(lighthouseDocumentResponse(result(events))).toEqual({ url: finalUrl, status: 200, headers: { "x-robots-tag": "noindex", "content-type": "text/html; charset=utf-8" } })
  })

  it("fails when there is no unique exact Document response instead of guessing or using a subframe", () => {
    const actual = documentResponse()
    const foreign = { ...actual, params: { ...actual.params, frameId: "foreign", response: { ...actual.params.response, url: "https://third-party.example/frame" } } }
    for (const input of [
      { lhr: { finalUrl } },
      { lhr: { finalUrl }, artifacts: {} },
      result([]),
      result([foreign]),
      result([{ ...actual, params: { ...actual.params, type: "Fetch" } }]),
      result([actual, { ...actual, params: { ...actual.params, requestId: "other-navigation" } }]),
    ]) expect(() => lighthouseDocumentResponse(input)).toThrow("Missing unique measured document response")
  })

  it("preserves actual status and missing safe headers without inventing successful or noindex evidence", () => {
    const actual = documentResponse()
    actual.params.response.status = 403
    expect(lighthouseDocumentResponse(result([actual]))).toEqual({ url: finalUrl, status: 403, headers: { "x-robots-tag": null, "content-type": null } })
    const withoutHeaders = { ...actual, params: { ...actual.params, response: { url: finalUrl, status: 200 } } }
    expect(lighthouseDocumentResponse(result([withoutHeaders])).headers).toEqual({ "x-robots-tag": null, "content-type": null })
  })

  it("retains only the two allowed response headers and no credential values or arbitrary response fields", () => {
    const secret = "credential-sentinel-never-retain"
    const actual = documentResponse({
      "x-RoBoTs-TaG": "noindex", "CONTENT-TYPE": "text/html",
      Cookie: secret, "Set-Cookie": secret, Authorization: secret, "X-Vercel-Protection-Bypass": secret,
      Location: `https://third-party.example/?token=${secret}`, "X-Custom": secret,
    })
    const response = { ...actual.params.response, requestHeaders: { Authorization: secret }, headersText: secret, securityDetails: { secret } }
    const projected = lighthouseDocumentResponse(result([{ ...actual, params: { ...actual.params, response } }]))
    expect(projected).toEqual({ url: finalUrl, status: 200, headers: { "x-robots-tag": "noindex", "content-type": "text/html" } })
    expect(JSON.stringify(projected)).not.toContain(secret)
    expect(actual.params.response.headers.Cookie).toBe(secret)
  })
})
