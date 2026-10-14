# Independently admitted repair profile

This is one new, explicitly scoped local repair allowance. It neither extends nor resets the original 26-entry ledger or the 6-entry correction ledger. Their exact bytes, counts and deadlines are checked before and after each command. The fixed window is **2026-10-11 02:06:13–04:06:13 UTC**, including preparation time. Starting late does not extend it.

The reviewed scope is in `docs/website-upgrade/premium-civic-implementation/evidence/performance-repair-authorization.json`. This file authorizes preparation, not execution admission. No actual admission file is supplied with this patch. The independent coordinator must first inspect the complete candidate and send an actual admission message. The lead then records that received message verbatim in an ignored evidence file and verifies its provenance through the supported thread reader. A hash pins recorded evidence; it is not a cryptographic signature proving the speaker's identity.

Admission JSON must have exactly this meaning (placeholder values are not usable):

```json
{
  "schemaVersion": "gridninja-repair-admission.v1",
  "decision": "admit",
  "coordinatorThreadId": "01a128b5-bd1a-708d-80fb-60a39bbba025",
  "authorizationSha256": "SHA256 of the reviewed authorization file",
  "admittedAt": "Actual coordinator admission time within the fixed window",
  "reviewMessage": {
    "id": "Actual received coordinator admission message ID",
    "text": "Actual received message, verbatim",
    "sha256": "SHA256 of the exact UTF-8 text above"
  },
  "candidate": {
    "head": "Full clean frozen commit SHA",
    "sourceRevision": "Actual sourceRevision SHA256",
    "qaHarnessRevision": "Actual qaHarnessRevision SHA256"
  }
}
```

The same authorization and admission paths and hashes are mandatory on **every** command. The runner rejects any commit, source, harness, record or historical-ledger change. It derives the sole ledger location under Git's common directory: `gridninja-qa/premium-civic-upgrade/repairs/premium-civic-repair-01/budget.json`. There is no CLI option for another state directory, candidate replacement, reset, retry or deadline extension.

```sh
node scripts/qa/bounded-command.mjs PHASE --timeout-ms FINITE_INTEGER \
  --repair-authorization docs/website-upgrade/premium-civic-implementation/evidence/performance-repair-authorization.json \
  --authorization-sha256 ACTUAL_AUTHORIZATION_HASH \
  --repair-admission build/qa/premium-civic-repair-01/admission.json \
  --admission-sha256 ACTUAL_ADMISSION_HASH \
  -- npm run SCRIPT
```

Use the repository's Node 22/npm 10 toolchain. Twelve total commands are allowed, in this exact order, one attempt each. All previous phases must have passed. A failure, timeout, interruption, missing output, unresolved running entry or identity change stops qualification; it does not authorize a substitute invocation. No phase may run after the fixed deadline, and each child timeout is clipped to the remaining time with an absolute maximum of one hour. Cleanup may take the existing bounded termination/drain grace; it does not extend qualification.

| # | Phase | Command after `--` |
|---|---|---|
| 1 | unit | `npm run test:unit` |
| 2 | quality | `npm run validate` |
| 3 | browser-webkit-mobile | `npm run test:e2e -- --project=webkit-mobile --workers=1 --retries=0 --reporter=list,json` |
| 4 | browser-webkit | `npm run test:e2e -- --project=webkit-desktop --workers=1 --retries=0 --reporter=list,json` |
| 5 | browser-chrome | `npm run test:e2e -- --project=chrome-stable --workers=1 --retries=0 --reporter=list,json` |
| 6 | browser-chromium | `npm run test:e2e -- --project=chromium-desktop --workers=1 --retries=0 --reporter=list,json` |
| 7 | browser-firefox | `npm run test:e2e -- --project=firefox-desktop --workers=1 --retries=0 --reporter=list,json` |
| 8 | browser-chromium-mobile | `npm run test:e2e -- --project=chromium-mobile --workers=1 --retries=0 --reporter=list,json` |
| 9 | page-performance | `npm run facility:measure` |
| 10 | lighthouse | `npm run facility:lighthouse` |
| 11 | performance-summary | `npm run facility:performance:validate` |
| 12 | headed-visibility | `npm run test:e2e -- tests/e2e/cinematic-visibility.spec.ts tests/e2e/facility-visibility.spec.ts --project=chrome-stable --headed --workers=1 --retries=0 --reporter=list,json` |

Quality means the existing brand check, lint, typecheck and **one** production build. Build lifecycle includes the existing CSS/assessment/SEO/facility/cinematic/editorial/civic validators, the existing SEO unit subset, output tracing and build recording. These nested checks are disclosed parts of one quality command; they do not authorize an additional build or unit rerun.

Browser commands require `PLAYWRIGHT_PREBUILT=1`, an explicit loopback `PLAYWRIGHT_BASE_URL`, and a fresh `PLAYWRIGHT_JSON_OUTPUT_NAME` beneath `build/qa/premium-civic-repair-01/`. This prevents Playwright from silently building. Reports are copied into command receipts and reject retries or failed/missing results. Deliberate platform skips remain explicit outstanding or separately covered scope; passing commands do not turn skips into executions. The headed invocation permits only the two named spec files and requires all three exact approved native-visibility titles to execute and pass, without skips.

All three performance phases require the same `FACILITY_BASE_URL` loopback origin, `FACILITY_PERFORMANCE_MATRIX=premium-civic`, `FACILITY_MEASUREMENT_SCOPE=qualification`, `FACILITY_RUNS=5`, `FACILITY_LIGHTHOUSE_STOP_ON_FAILURE=1`, and fresh `FACILITY_PERFORMANCE_DIR` under `build/facility/`. Keep any `FACILITY_REPORT_DIR` equal to that directory. Diagnostic mode is prohibited. Other selected facility renderer settings are preserved in the receipt and must match across phases. The existing page collector writes `build/facility/page-measurements.json`; archive prior evidence before qualification and preserve this candidate's completed output before any later activity.

## Required served-build and evidence-retention protocol

The wrapper pins the admitted Git/source/harness identity. **It does not attest the running HTTP server.** The existing facility collectors verify the local recorded production build; that alone does not prove the server on the chosen port serves that build. The lead owns these explicit read-only preflight records and must stop on any mismatch, before launching the corresponding counted phase:

1. After the sole quality/build phase, retain `.next/BUILD_ID` and `.next/facility-build.json` with their byte hashes. Compare `facility-build.identity` with `verifiedBuildIdentity()` and its source revision with the admitted candidate. Keep the original test-key/settings environment; this remains local test-verification evidence, not production-configured performance.
2. Before **each** of the six browser phases, page-performance, Lighthouse, summary and headed invocation, verify the same local build again. Read only the explicit loopback server's HTML, with a finite timeout and no redirects to external origins. Save HTTP status, response SHA256, timestamp, origin, all observed RSC build IDs, the expected local BUILD_ID, facility-build SHA256, admitted HEAD/source/harness and admission hash under `build/qa/premium-civic-repair-01/served-build/PHASE.json`. The existing `scripts/qa/native-sustained.mjs` build-ID extraction illustrates the escaped RSC `b` field. Require HTTP200 and a matching actual RSC build ID; absence, mixed IDs, a changed build/settings record or different source is a stop, not a reason to rebuild or retry. Link the record and its hash in the phase handoff. These GET/file reads are provenance checks, not additional browser or performance collections.
3. Before phase9, preserve any existing `build/facility/page-measurements.json` byte-for-byte under a fresh `build/qa/premium-civic-repair-01/performance-prior/` path using exclusive creation; record source/destination SHA256 and bytes. If absent, explicitly record absence. Do not overwrite an existing archive.
4. Immediately when phase9 finishes, including on failure/interruption, copy the resulting global page-measurements file to a fresh candidate-specific evidence path and record SHA256, bytes, result and provenance. If no output exists, record that failure. Preserve every partial/failed result. A failed phase stops qualification; archival does not authorize phase10.
5. Before the read-only summary phase, verify that the global page-measurements file still exactly matches the archived candidate output and that its source/build/settings match the admitted build and Lighthouse index. Preserve the 130 nominal Lighthouse samples, any invalid capture attempts, index, failed-group record and summary with hashes. The summary must not substitute historical output or launch new captures.

These protocols are explicit lead responsibilities rather than claims of automatic wrapper enforcement. A missing or mismatched attestation/retention record prevents advancing qualification. Starting or stopping the one prebuilt local server is environment support only and cannot contain a build, source edit or extra measurement.

One Lighthouse invocation means **130 nominal samples**, not one measurement. The unchanged collector policy permits one additional fresh capture only for `NO_NAVSTART` with no finite LCP: at most 260 actual capture attempts, preserving every invalid attempt and never rerunning a valid poor sample. Completed five-sample groups use unchanged gates and stop collection on a decisive failure. A failed/incomplete collection stops this allowance before the summary or headed phase. The summary reads the existing page/full-scroll and Lighthouse outputs and launches no measurements.

This allowance meters only these instrumented local qualification commands. Read-only review and preparation are separate, consume elapsed window time, and provide no qualification pass. No push, remote CI, deployment, provider changes, form submissions, downloads, benchmarks or model runs are authorized by this profile. Physical devices, representative readers and other unresolved release gates remain unresolved even if all twelve phases pass.
