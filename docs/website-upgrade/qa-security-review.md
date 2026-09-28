# Candidate security and privacy review

## Executed local work

- Production dependency audit: zero reported vulnerabilities in the current lockfile (`build/qa/production-audit.json`). This is a point-in-time dependency result, not an application security certification.
- Focused contact, publication, telemetry and candidate-ledger suites pass. Provider operations use mocks only. Tests cover stale lease completion, bounded retry and stable idempotency, alert-before-deadletter ordering, failed alert recovery, sweep/retention batch bounds, response redaction, immutable publication corruption/path rejection and telemetry allowlists.
- The internal QStash wrapper previously read an unbounded request body before checking for a signature. It now rejects a missing signature without consuming the body, bounds supplied bodies to the existing 16 KiB intake limit, validates the exact signed bytes and canonical endpoint, and returns 413 for oversized payloads before verification/parsing. Negative tests include declared size, undeclared multi-byte size, invalid signature and malformed authenticated JSON. No actual signing service is contacted by these tests.
- Four required Postgres schema integration cases passed in a newly created temporary localhost cluster. Production database/provider configuration was not used. This checks schema migration/constraints/atomicity; it does not prove the deployed end-to-end receipt chain.
- Staging canary stale labels and silent database skip have been repaired. It requires explicit staging origin and recipient configuration. No real staging submission was sent.

## Remaining local review versus external verification

| Area | Current evidence and remaining requirement |
| --- | --- |
| Intake origin/body/verification/rate limits | Source and mocked route tests are available; exercise actual reverse-proxy trusted-IP/header behavior on the deployment target before production. |
| Queue signature | Exact-body/canonical-endpoint dispatch is tested with a mock verifier; current/next real signing-key rotation remains staging-only. |
| Delivery recovery | Operation tests prove state transitions with mock sinks; real provider timeouts, duplicate delivery behavior, alert delivery and receipt recovery remain an authorized staging gate. |
| Privacy | Telemetry URL/property allowlists and redaction are covered; confirm actual processors, retention ownership and approved fallback contact channel with the company owner. Keep inquiry text and secrets out of QA reports. |
| Headers | Existing anti-framing, MIME, referrer and permissions protections exist. Inspect actual production HTTPS/HSTS/cache headers. Main-site CSP needs a compatible staging report-only design before enforcement; do not break Next inline/bootstrap code or Turnstile to obtain a scanner badge. |
| Secrets/dependencies | Current production audit passes. Release review must include secret scanning, dev/build dependency triage, build provenance, and source/candidate exclusion without printing secret values. |
| Rollback | Rollback modes exist; restore a known-good deployment while preserving accepted leads and immutable publications in an authorized rehearsal. This has not been inferred from local route tests. |

All evidence must be repeated or attached to the final candidate identity after source freeze. A locally complete security review cannot mark external operational qualification passed.

## Browser utility remediation — 25 September 2026

The current candidate replaces only Puppeteer 24.43.1's browser utility with exact
`@puppeteer/browsers@3.2.3` through a version-scoped npm override. Lighthouse
**12.6.1**, LHCI **0.15.1**, Puppeteer **24.43.1**, the collection scripts, scoring,
and throttling configuration remain unchanged. All **151** existing production
dependency lock entries are unchanged. Normal npm installation completed without
force, downgrade, or peer bypass. Both new full and production-only audits report
**zero findings**; earlier nonzero reports below remain historical evidence.

No extract-zip patch exists for either the [symlink-target traversal advisory](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)
or [duplicate-entry symlink overwrite advisory](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3).
The [upstream browser utility changelog](https://github.com/puppeteer/puppeteer/blob/browsers-v3.2.3/packages/browsers/CHANGELOG.md)
records its replacement in v3.0.0. The current collector launches installed Chrome
and connects through Puppeteer; it does not invoke archive extraction. Removing
the installer dependency closes the reported package findings, without claiming
that arbitrary third-party archives or the entire application are secure.

This is a cross-major transitive override. Its ESM-only package requires Node
**22.12.0 or later**; the qualified runtime remains **22.23.2**, npm **10.9.8**.
CPU checks passed both ESM and Node22 CommonJS loading, all fourteen browser
symbols consumed by Puppeteer24, identical Puppeteer default arguments, local
Chrome resolution, and actual LHCI collection module loading. The removed
`makeProgressCallback` export is not consumed by this dependency chain. Retire or
reassess the override when LHCI adopts a compatible upstream toolchain.

Evidence, exact before files, changed dev lock entries, official sources, and
the preserved superseded harness error are in
`build/qa/premium-release-01/security-browser-override/`. Actual browser/API/LHCI
smoke validation **passed on native Chrome using Apple M5 Pro / Metal**: launch,
CommonJS connect/CDP/disconnect, Lighthouse API, and LHCI NodeRunner→CLI. Both
retained reports use Lighthouse12.6.1 with simulated throttling. This dependency
compatibility work does not replace final five-run candidate qualification or
independent release review.

## Repository secret scan — 24 September 2026

Gitleaks 8.30.1 scanned the current repository text (15.42 MB) and local Git history (35 scanned commits, 2.93 MB) with 100% output redaction and inline suppressions disabled. It reported one current finding and the same historical finding: a human-readable pseudonym-key fixture in the mocked configuration at `tests/unit/contact/contact-route.test.ts:45`. Context review confirms it is the unit-test fixture; no live credential was confirmed. The finding remains in both redacted raw reports, without adding a blanket suppression or changing the test to evade detection. No secrets were rotated.

Scope excludes vendor/build/cache directories, binary media/archives, symlink traversal and files over 25 MiB. This is a pattern scan plus contextual review, not a proof of universal secret absence. No unrelated private directories were inspected. Redacted evidence: `build/qa/secret-scan-redacted.json`, `secret-history-redacted.json`, `secret-scan-summary.json`, configuration and logs in the same directory.

## Development/build dependency triage — 24 September 2026

The preserved pre-remediation audit reported **26 vulnerable package entries: 12 high, 12 moderate, two low, zero critical**, covering **24 distinct advisory URLs**. Every affected path was marked development-only. These are dependency findings, not demonstrated application exploits. The scoped remediation below reduced the current result to **14 entries: seven high, five moderate, two low, zero critical**; the production-only audit remains zero.

| Dependency group | Observed use and exposure | Required disposition |
| --- | --- | --- |
| Vitest 4.1.10 / mocker / coverage | Current tests use `vitest run` with node/jsdom; no standalone public mocker/interceptor dev server was found. The maintainer describes a development-server file-read issue and fixes in 4.1.11. | Patched the coordinated Vitest/coverage family to 4.1.11; final candidate unit qualification is recorded separately. [Maintainer advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). |
| LHCI → Lighthouse → Puppeteer/browser downloader → extract-zip; tmp/uuid/inquirer | Current measurements use installed Chrome on a fixed local target. Archive extraction, untrusted temp names and downloaded browser archives are not part of the recorded measurement path. Broader CLI/install paths remain affected. | Review compatible upstream replacements/updates in a separate toolchain change; replay the same performance baselines after changes. Audit suggests an LHCI downgrade to 0.1.0, which is not an acceptable automatic fix. |
| Drizzle Kit → legacy esbuild loader | Current database verification invokes local PostgreSQL and Vitest, not esbuild's development server. The upstream vulnerability concerns that server's permissive request/CORS behavior. | Keep the dev server unused; evaluate a compatible Drizzle toolchain upgrade. Do not accept npm's suggested historical Drizzle downgrade without migration checks. [Maintainer advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99). |
| Undici 7.28.0 through jsdom | Test-only HTTP dependency. The reported cache disclosure issue depends on the cache interceptor; reviewed tests use mocked provider calls and do not configure shared user-response caches. | Patched the compatible transitive resolution to 7.29.1; final candidate tests remain separate evidence. [Maintainer advisory](https://github.com/nodejs/undici/security/advisories/GHSA-4cwx-7wf7-3272). |
| js-yaml, brace-expansion, browserslist, qs/Express, ip-address, humanfs | Tooling parsers, lint/copy utilities and test/browser tooling; the repo does not expose these as public website request handlers. Untrusted CI input/config/archive processing remains a relevant boundary. | Applied compatible patches, including Express/body-parser patches that permit qs 6.16.0. Prohibit production secrets in untrusted jobs and retain a clean isolated CI workspace. No blanket `npm audit fix --force`. |

Reachability statements above are scoped source/path observations, not claims that every transitive API is unreachable. The full finding list, installed versions, dev flags, advisory references and proposed npm changes are retained in `build/qa/all-dependency-audit.json` and `dependency-triage.json`. **Residual development dependency remediation remains open**; a production-clean audit does not close it. LHCI and Drizzle dependency families require a separately qualified toolchain change or a bounded, accountable exception before this dimension is accepted for public release.


### Compatible remediation and retained toolchain boundaries

The applied npm commands updated existing dependency ranges only, without overrides:

```sh
npm update @humanfs/node brace-expansion browserslist ip-address js-yaml qs undici vitest @vitest/coverage-v8 express body-parser --ignore-scripts
npm install --save-dev 'vitest@^4.1.11' '@vitest/coverage-v8@^4.1.11' --ignore-scripts
```

The Vitest install initially encountered an npm Arborist optional-peer resolution exception (both bundled npm 10.9.8 and project-declared 10.9.2). A one-time `--legacy-peer-deps` resolution was followed by **normal** `npm install --ignore-scripts --package-lock-only`, `npm install --ignore-scripts`, and `npm ls --all`. These completed successfully without a retained peer bypass or npm configuration change. Failed attempts remain in `build/qa/vitest-update*.log`. The pre-change package files are preserved under `build/qa/dependency-remediation-before/`.

Reviewed results: humanfs 0.16.8, brace-expansion 1.1.21/5.0.12, browserslist 4.29.1, ip-address 10.7.2, js-yaml 3.15.2/4.3.2, qs 6.16.0, Express 4.22.3, body-parser 1.20.8, Undici 7.29.1, and the Vitest/coverage family 4.1.11. Supporting data/type packages changed within their existing ranges; the exact package-level diff is retained in `build/qa/dependency-remediation-diff.json`. `caniuse-lite` browser data is shared with the production build, so final browser/build/performance results must qualify the updated lockfile rather than borrow earlier measurements.

Next 16.3.6, React 19.2.4, Three/types 0.186.0, R3F 9.8.0, Lighthouse 12.6.1 and LHCI 0.15.1 remain unchanged. No browser binary, Drizzle major version, legacy esbuild major version, or audit-proposed historical downgrade was installed.

Residual findings are limited to LHCI/Lighthouse's browser/archive/temp/legacy prompt dependency chain and Drizzle Kit's legacy esbuild loader. Current local measurements use an installed browser against localhost and do not extract untrusted browser archives; the database fixture path does not start an esbuild server. Keep these tools local, avoid untrusted archives/temp path parameters and public dev servers, and do not treat these scoped mitigations as a clean full audit. Machine-readable post-remediation evidence is `production-audit-remediated.json` (zero) and `all-dependency-audit-remediated.json` / `dependency-triage-remediated.json` (14), under `build/qa/`.
