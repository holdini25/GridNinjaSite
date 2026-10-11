import { createHash } from "node:crypto"
import { expect, test } from "@playwright/test"
import manifest from "../../src/content/editorial-releases/editorial-v1/manifest.json"

test("the editorial delivery route serves only the registered immutable representations", async ({ request }) => {
  for (const file of manifest.files) {
    const path = `/assets/editorial/${manifest.release}/${file.file}`
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(response.headers()["content-type"]).toBe("image/webp")
    expect(response.headers()["x-robots-tag"]).toBe("noindex")
    expect(response.headers()["x-content-type-options"]).toBe("nosniff")
    expect(response.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate")
    const bytes = await response.body()
    expect(bytes.length).toBe(file.bytes)
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256)
    const head = await request.head(path)
    expect(head.status()).toBe(200)
    for (const field of ["content-type", "content-length", "etag", "cache-control", "x-robots-tag"]) expect(head.headers()[field], `${path}: ${field}`).toBe(response.headers()[field])
    expect((await head.body()).length).toBe(0)
    const conditional = await request.get(path, { headers: { "If-None-Match": response.headers().etag } })
    expect(conditional.status()).toBe(304)
    expect((await conditional.body()).length).toBe(0)
  }
  for (const path of ["/assets/editorial/editorial-v99/ai-workload-800.webp", "/assets/editorial/editorial-v1/manifest.json", "/assets/editorial/editorial-v1/master.blend", "/assets/editorial/editorial-v1/ai-workload-1600.png"]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    expect(response.headers()["cache-control"]).toBe("no-store")
    const head = await request.head(path)
    expect(head.status()).toBe(404)
    expect((await head.body()).length).toBe(0)
  }
})
