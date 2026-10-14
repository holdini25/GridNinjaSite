import assert from "node:assert/strict"
import { assertCinematicMotion } from "../cinematic/motion-evidence.mjs"
import { assertQualificationScope, measurementScope } from "./measurement-scope.mjs"
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { assertReadinessRunCount, evaluateLighthouseGroup } from "./lighthouse-group-budget.mjs"
import { assertCompleteTransfer, assertCadenceBudget, assertFrameBudget, assertRendererBudget, assertSettlementEvidence, assertLighthouseProfile, assertSameBuild, canonicalJson, provenance, recordedBuild, hostedBuildAttestation, verifyMeasurementServing } from "./performance-contract.mjs"
import { assertHostedServingPair } from "./hosted-attestation.mjs"
import { assertScrolledTransfer } from "./scrolled-transfer.mjs"
import { performanceMatrix, assertLighthouseMatrixIndex } from "./lighthouse-matrix.mjs"

const scope = measurementScope(process.env.FACILITY_MEASUREMENT_SCOPE)
const matrix = performanceMatrix(process.env.FACILITY_PERFORMANCE_MATRIX)
const outputRoot = process.env.FACILITY_PERFORMANCE_DIR ?? "build/facility"
const summary = { scope: scope.name, matrix: matrix.name, hardwareQualification: scope.hardwareQualification, measuredAt: new Date().toISOString(), result: "incomplete", profiles: [], failures: [], mobileEvidence: "Browser device emulation; physical mobile validation remains separate" }
try {
  const pages = JSON.parse(await readFile(scope.output, "utf8"))
  if (scope.functional) {
    assert.equal(pages.provenance?.settings?.measurementScope, "ci-functional")
    assert.equal(pages.hardwareQualification, "not-performed")
    const functional = JSON.parse(await readFile("build/facility/ci-functional-summary.json", "utf8"))
    assert.equal(functional.result, "pass", "Functional evidence must pass its full contract")
    assert.deepEqual(functional.provenance, pages.provenance, "Functional validation belongs to another measurement")
  } else assertQualificationScope(pages.provenance?.settings)
  const expected = await provenance(pages.provenance?.browser, pages.provenance?.settings)
  assertSameBuild(pages.provenance, expected)
  if(pages.result!=="pass")summary.failures.push(`Page measurements failed: ${pages.failure ?? "incomplete measurement"}`)
  assert.equal(pages.provenance.settings.runCount, 5, "Release validation requires five fresh profiles")
  assert.equal(pages.provenance.settings.performanceMatrix ?? "core", matrix.name, "Page and Lighthouse measurement matrices differ")
  if (matrix.name === "premium-civic") {
    assertLighthouseMatrixIndex({ matrix: matrix.name, result: pages.result, runs: pages.scrolledTransfers ?? [] }, matrix)
    for (const result of pages.scrolledTransfers) {
      assert(result.freshContext && result.scroll?.complete, "Full-scroll evidence is incomplete or reused")
      for (const transfer of [result.initialTransfer, result.fullPageTransfer]) assertScrolledTransfer(transfer, { route: result.route, profile: result.profile, buildSettings: pages.provenance.buildSettings })
      assert(result.fullPageTransfer.bytes >= result.initialTransfer.bytes, "Full-scroll transfer omitted initial bytes")
    }
    summary.scrolledTransfers = pages.scrolledTransfers.map(({ route, profile, run, initialTransfer, fullPageTransfer }) => ({ route, profile, run, initialBytes: initialTransfer.bytes, fullPageBytes: fullPageTransfer.bytes, cumulativeNotAdditive: true }))
  }
  summary.provenance = expected
  const build = await recordedBuild()
  const fresh = timestamp => {
    assert(Number.isFinite(Date.parse(timestamp)) && Date.parse(timestamp) >= Date.parse(build.recordedAt) && Date.parse(timestamp) <= Date.now() + 60_000, "Report predates this build or has an invalid measurement time")
  }
  fresh(pages.measuredAt)
  const index = JSON.parse(await readFile(`${outputRoot}/lighthouse-index.json`, "utf8"))
  if (process.env.FACILITY_HOSTED_ATTESTATION_FILE) {
    const attestation = await hostedBuildAttestation()
    assertHostedServingPair(pages.hostedServing, attestation)
    assertHostedServingPair(index.hostedServing, attestation)
    summary.hostedServing = await verifyMeasurementServing()
  } else assert(!pages.hostedServing && !index.hostedServing, "Hosted receipts require explicit hosted attestation")
  assertLighthouseMatrixIndex(index, matrix)
  assert(!index.diagnostic, "A diagnostic collection cannot qualify a release matrix")
  for (const profile of ["desktop", "mobile"]) {
    const directory = `${outputRoot}/lighthouse-${profile}`
    const reports = []
    for (const file of await readdir(directory)) if (file.endsWith(".json")) reports.push(JSON.parse(await readFile(`${directory}/${file}`, "utf8")))
    assert.equal(reports.length, matrix.routes.length * matrix.runs, `${profile}: incomplete Lighthouse route matrix`)
    for (const route of matrix.routes) {
      const group = reports.filter(report => new URL(report.finalUrl).pathname === route)
      assert.equal(group.length, 5, `${profile} ${route}: expected five runs`)
      assert.deepEqual(group.map(report => report.facilityEvidence?.run).sort(), [1, 2, 3, 4, 5], "Duplicated or missing Lighthouse run IDs")
      const profileSettings = canonicalJson(group[0].facilityEvidence?.provenance.settings)
      for (const report of group) {
        const evidence = report.facilityEvidence
        assertLighthouseProfile(report, profile)
        assert(evidence?.complete && evidence.route === route, "Missing complete Lighthouse evidence")
        if (expected.hosted) {
          assert.equal(new URL(report.finalUrl).origin, expected.hosted.origin, "Lighthouse measured another deployment origin")
          assert.equal(new URL(report.requestedUrl).origin, expected.hosted.origin, "Lighthouse requested another deployment origin")
          assert(Date.parse(evidence.measuredAt) >= Date.parse(index.hostedServing.collectionStartedAt) && Date.parse(evidence.measuredAt) <= Date.parse(index.hostedServing.collectionFinishedAt), "Lighthouse sample lies outside hosted serving verification window")
        }
        assertSameBuild(evidence.provenance, expected)
        assert.equal(evidence.provenance.browser, pages.provenance.browser, "Mixed Chrome versions between transfer and Lighthouse evidence")
        assert.equal(canonicalJson(evidence.provenance.settings), profileSettings, "Mixed Lighthouse settings within a profile")
        assert(evidence.provenance.settings.freshBrowserProfile, "Lighthouse profile was reused")
        fresh(evidence.measuredAt)
      }
      const { samples, medians, policy, failures } = evaluateLighthouseGroup(group, { route, profile, buildSettings: pages.provenance.buildSettings })
      summary.failures.push(...failures)
      const pageProfile = profile === "mobile" ? "mobile-emulation" : "desktop"
      const transfers = pages.results.filter(result => result.route === route && result.profile === pageProfile)
      if (route === "/" || route === "/demo") {
        assertReadinessRunCount(transfers)
      }
      for (const result of transfers) {
        try {
        assert(result.complete && result.freshContext, "Incomplete or reused page measurement")
        if (route === "/" && pages.provenance.buildSettings.cinematic?.selectedRelease) {
          const movie = result.cinematic
          assert(movie?.kind === "cinematic" && movie.throughReady && movie.release === pages.provenance.buildSettings.cinematic.selectedRelease, "Missing cinematic readiness/identity")
          assertCompleteTransfer(result.transfer, { route, profile, buildSettings: pages.provenance.buildSettings })
          if (pages.provenance.buildSettings.cinematic.mode === "poster") assert(movie.status === "fallback" && movie.reason === "configured-poster", "Poster qualification incorrectly claims motion")
          else {
            assert(movie.status === "active", "No active cinematic loop")
            assertCinematicMotion(movie.motion)
            assert(movie.pause?.after?.paused && Math.abs(movie.pause.after.time - movie.pause.before.time) < .001, "Missing cinematic pause evidence")
          }
          continue
        }
        assert((scope.functional && result.automaticAcquisition?.reason === "software" && result.manualThroughReady) || (profile !== "desktop" && pages.provenance.buildSettings.mode !== "auto-adaptive") || result.throughReady, "Automatic transfer stopped before 3D readiness without verified software fallback/manual coverage")
        assertCompleteTransfer(result.transfer)
        assertRendererBudget(result.renderer)
        if (result.settlement) {
          assertSettlementEvidence(result.settlement, pages.provenance.settings)
          if (result.settlement.mode === "adaptive-still") assert.equal(pages.provenance.buildSettings.mode, "auto-adaptive")
        } else assertRendererBudget(result.pausedRenderer, false) // Historical explicit-pause reports.
        if (scope.functional) {
          assert.equal(result.capability, null, "Functional CI must not imply device cadence")
          assert.equal(result.frameBudgetMet, null)
          assert.equal(result.capabilityEvidence?.status, "not-measured")
          continue
        }
        assert(Number.isFinite(result.capability?.frameP95 ?? result.renderer?.frameP95) && (result.capability?.sampleCount ?? result.renderer?.sampleCount) >= 120, "Missing fixed-cadence capability evidence")
        assert.equal(result.renderingClass, "hardware", "Device performance qualification requires actual hardware rendering")
        if (result.renderingClass === "hardware") {
          if(pages.provenance.buildSettings.mode === "auto-adaptive") {
            for (const sample of result.ambientDiagnostics ?? []) if (sample.quality !== "still" && sample.sampleCount >= 120) assertCadenceBudget(sample)
            if (result.renderer.quality === "still") {
              assert.equal(result.ambientCadence?.status, "not-applicable", "Still must explicitly classify absent ambient cadence")
              assert.equal(result.settlement?.mode, "adaptive-still", "Still requires actual static-settlement evidence")
            } else assertCadenceBudget(result.renderer)
          }
          assertFrameBudget(result.capability ?? result.renderer, profile === "desktop" ? 20 : 34)
        }
        }catch(error){summary.failures.push(`${profile} ${route} run ${result.run}: ${error instanceof Error?error.message:String(error)}`)}
      }
      summary.profiles.push({ profile, route, lighthouseVersion: group[0].lighthouseVersion, settings: group[0].configSettings, medians, samples, improvementAim: { lcp: policy.lcpAim, met: medians.lcp <= policy.lcpAim, releaseGate: false }, throughReadyTransfers: transfers.map(result => ({ bytes: result.transfer?.bytes, automaticBytes: result.automaticTransfer?.bytes, automaticAcquisition: result.automaticAcquisition, manualThroughReady: result.manualThroughReady, cinematic: result.cinematic, renderingClass: result.renderingClass, frameP95: result.renderer?.frameP95, capabilityP95:result.capability?.frameP95, complete:result.complete, ambientCadence:result.ambientCadence, settlementMode:result.settlement?.mode ?? "legacy-explicit-pause", budgetFailures:result.budgetFailures })) })
    }
  }
  summary.result = summary.failures.length ? "fail" : "pass"
} catch (error) {
  summary.result = "fail"
  summary.failures.push(error instanceof Error ? error.message : String(error))
}
await mkdir(outputRoot, { recursive: true })
await writeFile(`${outputRoot}/${scope.functional ? "ci-performance-summary" : "performance-summary"}.json`, `${JSON.stringify(summary, null, 2)}\n`)
const activeRelease = summary.provenance?.buildSettings?.selectedRelease ?? "facility-v3"
const evidenceDirectory = process.env.FACILITY_REPORT_DIR ?? (matrix.name === "premium-civic" ? outputRoot : scope.functional ? "build/facility/ci-evidence" : `docs/website-upgrade/facility-validation-${activeRelease.replace(/^facility-/, "")}`)
await mkdir(evidenceDirectory, { recursive: true })
await writeFile(`${evidenceDirectory}/lighthouse.json`, `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify({ result: summary.result, profiles: summary.profiles.map(({ profile, route, medians }) => ({ profile, route, medians })), failures: summary.failures }, null, 2))
if (summary.result !== "pass") process.exitCode = 1
