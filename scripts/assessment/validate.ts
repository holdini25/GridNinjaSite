import assert from "node:assert/strict"
import registrySource from "../../src/content/assessment-publications/registry.json" with { type: "json" }
import { parsePublicationRegistry, readAssessmentPublication } from "../../src/lib/assessment/publications"
import { assessmentFixtures } from "../../src/content/assessments/fixtures"
const registry = parsePublicationRegistry(registrySource)
for (const entry of registry) {
  for (const format of ["html", "pdf", "json"]) {
    const result = await readAssessmentPublication(entry.publicationId, entry.version, format)
    assert.equal(result.status, entry.status === "available" ? 200 : entry.status === "withdrawn" ? 410 : 404)
    if (result.status === 200 && result.record.publication.version === assessmentFixtures[result.record.scenario].publication.version) assert.deepEqual(result.record, assessmentFixtures[result.record.scenario])
  }
}
assert.equal((await readAssessmentPublication("../private", "v1.0.0", "html")).status, 404)
assert.equal((await readAssessmentPublication("demo-01-b", "v9.0.0", "html")).status, 404)
console.log("Assessment publications passed: registry approvals, frozen bytes, hashes, identities, and live fixture parity.")
