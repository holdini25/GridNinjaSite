# GridNinja enterprise RC26 — evidence and handoff

**Decision: NO-GO. Local preview is available; neither local release qualification
nor public deployment is approved.** Implementation is preserved, with failures
and unavailable checks explicitly recorded. No live migration, outbound rehearsal,
production deployment or hosting purchase occurred.

## Candidate

- Source: `88cb14c2add46cec7e8600a8019547a80bde3886d1a23b672fe783753d3f84b5`
- Build: `9Tf0xt7EnAjjAV-75K2bp`
- Harness: `bce9c8830e55f61d47e43024858ecc67c0b298946c4018c413d447f7fbeeb718`
- Node `22.23.2`, npm `10.9.8`, existing package lock.
- Immutable `facility-v10`, `auto-adaptive`, enforced local CSP, HTTP,
  test verification, production observability disabled.
- V11 authoring work is **unregistered**. Earlier release/publication bytes remain
  immutable. The retained production build was not rebuilt for the one-string
  RC26 test correction.

[Local home](http://127.0.0.1:3000/) · [Local demo](http://127.0.0.1:3000/demo)

## Implemented

- Factual request/revision/minimum comparison and B-only, ephemeral hypothetical
  minimum; strict integer-kW parsing, identity binding and no record/download/
  analytics propagation.
- Connected equipment, conditions, evidence and inquiry journeys; published
  resource eligibility; scheduler reading holds with explicit playback resumption.
- Contact Us navigation labels, neutral-black borderless presentation and compact
  accessible graphics controls.
- Durable provider payload/attempt handling, 23-hour uncertainty cutoff, signed
  replay-safe delivery events, independent monitoring/heartbeats and recovery
  runbooks. These have local tests; recipient delivery remains unproved.
- CSP/resource containment, privacy/ASVS review, pinned tooling/CI, immutable
  candidate identities and explicit test/exclusion evidence.

## Current results

| Status | Evidence | Scope |
| --- | --- | --- |
| Pass | [CPU checks](../../build/qa/enterprise-rc26/local/summary.json) | Lint, types, brand, 825 unit / 95 files, 13 isolated database tests; fresh production audit clear. |
| Pass | [Exact build proof](../../build/qa/enterprise-rc26/production-artifact-revalidation.json) | Retained normal build and served manifest bytes; same application/source/settings. |
| Pass | [Assessment integrity](../../build/qa/enterprise-rc26/assessment-integrity-evidence.json) | 40 domain assertions across four profiles; immutable publications and hypothetical isolation. |
| **Fail** | [Browser matrix](../../build/qa/enterprise-rc26/browser-evidence.json) | 601/602 required passes; one unresolved WebKit mobile load timeout; 38 predeclared exclusions. |
| Pass | [Graphics sequence](../../build/qa/enterprise-rc26/graphics-execution.json) | Supplemental no-JS/reduced-motion, poster rollback, performance, lifecycle, query entry and captures. Does not waive browser failure. |
| Pass | [Performance](../../build/qa/enterprise-rc26/performance/lighthouse.json) | 30 Lighthouse + 20 through-readiness runs on actual M5 Metal; local configuration only. |
| Pass | [Archived raw evidence](../../build/qa/enterprise-rc26/qualified-collector-evidence/index.json) | 98 hashed files: reports, traces, lifecycle output and motion clip. |
| Pass | [Explicit transfers](../../build/qa/enterprise-rc26/specimen-transfers/attempt01/results.json) | Rack 247,666 bytes; cooling 212,467 bytes; no automatic specimen request; same canvas/context. |
| Captured; **craft fails** | [Visual review](../../build/qa/enterprise-rc26/visual-review-experience/review.md) | 53 verified Metal captures; observed categories 2/3, required core 3/3 unmet. |
| Blocked | [Security review](../../build/qa/enterprise-rc26/security-evidence.json) | Dated full-audit/SBOM/scan evidence reused explicitly; development advisories/owner exceptions unresolved. |
| Blocked | [External/native constraints](../../build/qa/enterprise-rc26/external-gates.json) | Native/Simulator, devices, manual accessibility, visitors, staging, actual production config and operational ownership. |

Mobile-emulated median LCP: **2,445.1 ms home / 2,444.5 ms demo / 2,444.5 ms
assessment**. Median mobile CLS/TBT are zero. Complete automatic transfer:
**951,112–1,010,087 bytes**. Initial JavaScript: **127.3 / 128.3 / 134.7 KiB Brotli**.
The roughly 55 ms mobile LCP headroom is narrow; this does not qualify deployed
analytics, live verification, HTTPS or real-user p75 Core Web Vitals.

Ten open/close and ten assembly cycles pass; peak staged allocation estimate is
12,093,451 bytes. Four fans, bounded LED activity, and paused/offscreen/reduced-motion
frame settlement pass. These are headless M5 Metal observations, not sustained
native or physical-phone results.

## Preserved failures

1. [RC25 no-JS failure and correction](../../build/qa/enterprise-rc25/seo-assertion-correction/review.json):
   old copy expectation corrected to the exact approved paragraph. Product bytes
   unchanged. RC26 preflight and final no-JS test pass.
2. [RC26 power correlation](../../build/qa/enterprise-rc26/power-interruption/correlation.json):
   nine initial WebKit mobile failures overlapped system sleep. Entire affected
   profile repeated unchanged under a temporary bounded system assertion.
3. [Remaining WebKit review](../../build/qa/enterprise-rc26/webkit-deeplink-diagnostic/independent-review.md):
   one full-profile timeout remains. Later HTTP 200 and isolated test pass are
   diagnostics, not a retroactive passing matrix.
4. [V11 art review](./facility-v11-art-review.md) and
   [current asset notes](../../assets-source/facility/V11-CURRENT.md): rejected
   lighting/cover experiments and current unregistered source hashes. Do not
   promote older captures with different candidate bytes.

The [candidate ledger](../../build/qa/enterprise-rc26/candidate.json) and
[local gate check](../../build/qa/enterprise-rc26/qualification-check-local.json)
are authoritative. Historical attempts are not combined into an unexplained green
release. Reviewer identities here refer to implementation/QA agents; independent
human/device sign-off remains outstanding.

## Required next work

1. Resolve the intermittent WebKit full-profile timeout in a stable supported
   browser environment; execute the prepared Linux Firefox coverage.
2. Raise surface readability, row separation and mobile service clarity to the
   agreed 3/3 bar, review v11 independently, then freeze matching assets/posters.
3. Complete unlocked native Safari/Simulator and the physical-device, sustained,
   assistive-technology and representative-visitor protocols.
4. Obtain named primary/backup operators and authorized staging resources/recipients.
   Independently review additive migration `0003`, backup and old/new worker hold/drain.
   Prove durable receipt → provider acceptance → signed recipient delivery → operator
   acknowledgement, then recovery/retention/rollback. Never reset an uncertain
   send's first-attempt clock, frozen payload or idempotency key to force a resend.
5. Resolve security/privacy/editorial exceptions, verify actual hosting schedules,
   and measure production-configured HTTPS/observability/verification before go/no-go.

[Delivery and recovery runbook](./enterprise-contact-operations.md) ·
[Rehearsal instructions](./qualification-handoff-and-rehearsal.md) ·
[Defect register](./enterprise-defect-register.md) ·
[Detailed qualification report](./enterprise-release-qualification-2026-09-24.md)

## Reproducibility and compute

The existing preview runs on port 3000. To restart the **retained artifact** after
stopping that server, from the repository root:

```sh
source build/qa/enterprise-rc26/env.sh
npm run start -- --hostname 127.0.0.1 --port 3000
```

A new `npm ci` / build produces a new artifact and requires its own identity and
qualification; it does not inherit this evidence. The tested poster rollback
artifact is retained at `/private/tmp/gridninja-rollback-rc25-workspace` with build
`G2fgzHszZOdxzIKtO3wXS`; the [rollback evidence](../../build/qa/enterprise-rc26/rollback-poster/browser-verification.json)
records its source/settings and fresh browser checks. This is not a hosted rollback.

CPU handled construction/export, compilation, validation, tests, hashing and
compression. The actual M5 Pro Metal GPU handled browser rendering/captures.
Blender's small bake benchmark and documented CPU fallback are separate from
successful GPU evidence. GPU-sensitive qualification was serialized with test
workers stopped. A bounded `caffeinate -is` assertion prevented background system
sleep during final collection without waking/unlocking the display or changing
global power settings. No global Blender preferences were changed.
