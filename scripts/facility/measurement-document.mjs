import assert from "node:assert/strict"

/** Project only the actual navigation response. Never retain cookies, arbitrary
 * response headers, or a separate fetch that could belong to another build. */
export function lighthouseDocumentResponse(result) {
  const responses = (result.artifacts?.DevtoolsLog ?? []).filter(event => event.method === "Network.responseReceived" && event.params?.type === "Document" && event.params.response?.url === result.lhr.finalUrl)
  assert.equal(responses.length, 1, "Missing unique measured document response")
  const response = responses[0].params.response
  const headers = new Map(Object.entries(response.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]))
  return { url: response.url, status: response.status, headers: { "x-robots-tag": headers.get("x-robots-tag") ?? null, "content-type": headers.get("content-type") ?? null } }
}
