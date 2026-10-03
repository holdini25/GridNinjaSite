import assert from "node:assert/strict"
import { readFile, writeFile } from "node:fs/promises"
import { assertSoftwareAcquisition } from "./measurement-scope.mjs"
import { assertCinematicMotion } from "../cinematic/motion-evidence.mjs"
import { assertCompleteTransfer, assertRendererBudget, assertSettlementEvidence, assertSameBuild, provenance } from "./performance-contract.mjs"

const report = JSON.parse(await readFile("build/facility/ci-functional-measurements.json", "utf8"))
const summary = { scope: "ci-functional", result: "incomplete", hardwareQualification: "not-performed", failures: [], groups: [] }
try {
  assert.equal(report.provenance?.settings?.measurementScope, "ci-functional")
  assert.equal(report.hardwareQualification, "not-performed")
  assert.equal(report.result, "pass", report.failure ?? "Incomplete functional measurements")
  assert.equal(report.provenance.settings.runCount, 5)
  assert.equal(report.results.length, 20, "Expected five fresh runs per route/profile")
  const expected = await provenance(report.provenance.browser, report.provenance.settings)
  assertSameBuild(report.provenance, expected)
  summary.provenance = expected
  for (const route of ["/", "/demo"]) for (const profile of ["desktop", "mobile-emulation"]) {
    const rows = report.results.filter(r => r.route === route && r.profile === profile)
    assert.deepEqual(rows.map(r => r.run).sort(), [1,2,3,4,5], "Missing or duplicated functional run")
    for (const row of rows) {
      assert.equal(row.complete, true); assert.equal(row.freshContext, true)
      assert.equal(row.failure, undefined); assert.deepEqual(row.pageErrors, []); assert.deepEqual(row.budgetFailures, [])
      assertCompleteTransfer(row.transfer, { route, profile, buildSettings: report.provenance.buildSettings })
      if (row.cinematic) {
        assert.equal(route, "/")
        assert.equal(row.cinematic.status, "active")
        assertCinematicMotion(row.cinematic.motion)
        assert(row.cinematic.pause.before.paused && row.cinematic.pause.after.paused)
        assert(Math.abs(row.cinematic.pause.after.time-row.cinematic.pause.before.time) < .001)
      } else {
        if (row.automaticAcquisition?.reason === "software") {
          assertSoftwareAcquisition(row)
          assertCompleteTransfer(row.automaticTransfer)
        } else assert.equal(row.throughReady, true, "Missing automatic model readiness")
        assert.equal(row.capability, null); assert.equal(row.frameBudgetMet, null)
        assert.equal(row.capabilityEvidence?.status, "not-measured")
        assertRendererBudget(row.renderer)
        assertSettlementEvidence(row.settlement, report.provenance.settings)
        assertRendererBudget(row.settlement.after, false)
      }
    }
    summary.groups.push({ route, profile, runs: 5, maximumTransferBytes: Math.max(...rows.map(r => r.transfer.bytes)), renderingClasses: [...new Set(rows.map(r => r.renderingClass ?? "native-video"))], settlements: [...new Set(rows.map(r => r.settlement?.mode ?? "native-video-controls"))] })
  }
  summary.result = "pass"
} catch (error) {
  summary.result = "fail"; summary.failures.push(String(error)); process.exitCode = 1
}
await writeFile("build/facility/ci-functional-summary.json", `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
