import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import registry from "../../src/content/civic-releases/registry.json"
import { manifestSchema } from "../../src/lib/civic/manifest-schema.mjs"

test("the civic delivery route serves the complete registered responsive art package", async ({ request }) => {
  const entry = registry.find(entry => entry.release === "civic-v1" && entry.status === "available") as { manifestSha256?: string } | undefined
  expect(entry, "The civic upgrade requires a reviewed available package").toBeDefined()
  const raw = await readFile("src/content/civic-releases/civic-v1/manifest.json")
  expect(createHash("sha256").update(raw).digest("hex")).toBe(entry?.manifestSha256)
  const manifest = manifestSchema.parse(JSON.parse(raw.toString("utf8")))
  for (const file of manifest.files) {
    const path = `/assets/civic/${manifest.release}/${file.file}`
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
  for (const path of ["/assets/civic/civic-v99/landscape-960.webp", "/assets/civic/civic-v1/manifest.json", "/assets/civic/civic-v1/master.blend", "/assets/civic/civic-v1/landscape-1920.png", "/assets/civic/civic-v1/portrait-1280.webp"]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    expect(response.headers()["cache-control"]).toBe("no-store")
    const head = await request.head(path)
    expect(head.status()).toBe(404)
    expect((await head.body()).length).toBe(0)
  }
})
