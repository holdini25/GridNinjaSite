import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import registry from "../../src/content/assessment-publications/registry.json" with { type: "json" }

const base = new URL(process.env.AVAILABILITY_ORIGIN ?? "https://gridninja.ai")
assert(base.protocol === "https:" && !base.username && !base.password && base.pathname === "/" && !base.search && !base.hash, "Availability origin must be an HTTPS origin")
const publication = registry.find(item => item.status === "available")
assert(publication, "No available publication to probe")
const paths = ["/", "/demo", "/assessment", `/evidence/assessments/${publication.publicationId}/${publication.version}`]
const results = []
for (const path of paths) {
  const started = performance.now()
  try {
    const response = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "GridNinja-Availability/1.0", "Accept": "text/html" } })
    const type = response.headers.get("content-type") ?? ""
    await response.body?.cancel()
    results.push({ path, status: response.status, ok: response.status === 200 && type.includes("text/html"), milliseconds: Math.round(performance.now() - started) })
  } catch { results.push({ path, status: null, ok: false, milliseconds: Math.round(performance.now() - started) }) }
}
const report = { schemaVersion: "gridninja-availability.v1", origin: base.origin, measuredAt: new Date().toISOString(), result: results.every(item => item.ok) ? "pass" : "fail", results, scope: "read-only HTTP reachability; not inquiry delivery or a precise availability SLA" }
await mkdir("build/qa", { recursive: true })
await writeFile("build/qa/availability.json", `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (report.result !== "pass") process.exitCode = 1
