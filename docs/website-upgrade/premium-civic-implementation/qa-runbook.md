# Candidate QA and evidence runbook

This is the execution contract for the new harness, not a record that the candidate passed. Preserve the distinction between historical/local baseline, functional CI, actual Metal qualification, browser emulation and physical devices. The baseline is recorded in [evidence/baseline-status.md](evidence/baseline-status.md).

## Coverage and remaining gates

| Gate | Required coverage / command | State at harness authoring |
|---|---|---|
| Source and typing | `npm run brand:check`, `npm run lint`, `npm run typecheck` | Targeted harness lint passes; final integrated checks pending |
| Unit contracts | `npm run test:unit` with existing coverage thresholds | Focused harness tests pass; full suite pending |
| Database integration | `TEST_DATABASE_URL=… npm run test:integration:required` using disposable PostgreSQL 16 | Pending; the optional suite cannot substitute for required DB coverage |
| Production build | `npm run build` including CSS, assessment, SEO, facility, cinematic, editorial, civic, byte/trace checks | Original baseline passed; patched candidate pending |
| Browser functionality | `CINEMATIC_E2E=1 PLAYWRIGHT_PREBUILT=1 npm run test:e2e` across all six existing projects, serial workers for measurement stability | Candidate pending; count skips separately, especially opt-in cinematic tests |
| Route acceptance | `tests/e2e/public-routes.spec.ts`: all 38 manifest documents + /roi redirect in every existing browser project | New manifest-derived test discovered; execution pending |
| Editorial HTTP delivery | `tests/e2e/editorial-delivery.spec.ts`: nine GET/hash + HEAD/header + 304 responses and unknown/private 404 probes | New test discovered; execution pending |
| Civic HTTP delivery | `tests/e2e/civic-delivery.spec.ts`: six generated-art derivatives, exact hashes, conditional/HEAD delivery and private-source boundaries; unit contracts cover unavailable, withdrawn and integrity failures | Replacement civic candidate pending |
| SEO | `PLAYWRIGHT_PREBUILT=1 npm run test:seo`; source/evidence validators; deployed `test:seo:smoke` at candidate URL | Pending; preserves noindex gates, immutable publications and link graph |
| Existing generic Lighthouse CI | `npm run lighthouse`, configured 13 routes; three runs normally, five with `LHCI_RELEASE_CANDIDATE=1` | Pending; this alone is not provenance-aware qualification |
| Final performance | Premium matrix below: 13 routes × two profiles × five valid captures | Pending; 100 reviewed-route samples + 30 additional mandatory samples = 130, never 160 |
| Production vulnerabilities | `npm run audit:prod` | Zero after minimal patch remediation; rerun on final lock |
| Manual and reader gates | Physical iPhone Safari + Android Chrome; keyboard, assistive tech, actual 200%/400% zoom, failed assets; responsive 320/390/768/1440 capture; target-reader sessions | Separate pending records; browser geometry/axe is not full conformance or participant evidence |

The route acceptance suite distinguishes 18 indexable routes, 15 gated status routes, four frozen brief documents and one receipt. It checks exact status, H1, robots policy, publication shell separation, client errors, full-scroll image decoding and overflow. The existing SEO suite owns metadata/schema/canonical/link-graph and raw-HTML/reduced-motion parity; its work is not relabeled as new coverage. Default browser project viewports do not themselves cover every manual review width.

The user-supplied civic reference reopened artwork after `fa933dc`. Preserve that candidate's receipts as historical. Recheck complete desktop and portrait civic compositions, the shared Home/About/Platform implementation, no-JavaScript and failed-media reading, and all three solution hero CTAs in actual built HTML. `premium-journeys.spec.ts` covers sample → Back → scoping → Back without submitting inquiries. Composed reviews must inspect headline/caption separation under enlarged text as well as ordinary viewport screenshots. Generated civic art and locally ray-traced editorial thumbnails have distinct source records.

The `b328aaf` clean build exposed a separate server-rendering defect: AI Cloud and Colocation included their sample link in deferred React server payloads, but Radix Slot 1.2.3 dropped that child from the actual HTML. The narrowly pinned Slot 1.2.4 override carries the upstream lazy-child fix; it does not change the button API or styling. A regression decodes a real Next Flight child and renders the site's Button, and the three solution routes additionally verify both actions with JavaScript disabled. Preserve the old-version failure and replacement-build evidence; source props alone did not detect this defect. The replacement also keeps all three static fallback subjects beside the desktop civic headline when image delivery fails.

The original failing Linux test is `enterprise-experience.spec.ts` (“a hypothetical minimum…”), not the no-JS assessment test. Keep normal pointer activation, assertions and real browser outcome; do not force-click, remove WebKit, increase retries, or count a skipped case as passed. CI Ubuntu WebKit on the final SHA is a release gate.

## Unchanged performance ceilings

General LCP ≤2500 ms, FCP ≤1800 ms, TBT ≤200 ms, CLS ≤0.1; contact LCP ≤2000 ms and CLS ≤0.05. Performance ≥90, accessibility ≥95, best practices ≥95, and indexable routes SEO=100; the intentionally noindex frozen brief has no SEO-score requirement. Heading order and color contrast remain explicit checks. The 2200 ms LCP aim is reported separately and cannot turn a hard failure into a pass.

Ordinary automatic transfer ≤1,572,864 bytes. Cinematic-home automatic transfer ≤4,194,304 desktop / 2,097,152 mobile. Largest image ≤256,000 bytes; fonts ≤163,840 bytes; insight-article scripts ≤204,800 bytes. Core-journey initial JS remains ≤180 KiB Brotli in the build validator; transferred JavaScript over local HTTP is not an equivalent Brotli metric. Facility allocation, cadence, adaptive-Still and cinematic motion limits remain in the existing validators unchanged.

The new full-scroll ledger enforces total, per-image, font and applicable article-script ceilings after visiting lazy sections. Each observation begins before initial loading and uses one cumulative ledger. `fullPageBytes` already includes `initialBytes`: never add them, and never count these observations as extra Lighthouse/LCP samples.

Full-scroll collection visits each viewport until that same ledger settles before advancing. The protocol records its 750ms network-quiet requirement, 15s settlement deadline and 100-step bound; document height is re-read after settlement to follow lazy content growth. This collects the complete assets encountered during settled visits, not a rapid-fling cancellation trace. No failed request is exempted. The failed earlier rapid-scroll observations remain preserved in the [a3e399c disposition](evidence/a3e399c-qualification.md).

## Serialized final performance collection

Freeze site source, dependency lock, build environment and harness for the whole collection. Close competing render/encoding/CPU-heavy jobs and browser capture work. Both collectors acquire `build/qa/compute.lock`, shared with the editorial supervisor. A stale-looking lock is never stolen: coordinate with its owner and verify the recorded PID before deliberate recovery. Keep failed report sets; choose a new directory after a correction rather than replacing a poor valid result.

Use Node22/npm10 and the exact candidate deployment-relevant environment for build and every collector. Do not copy production secrets into a report. A local HTTP/unconfigured-verification run is diagnostic unless explicitly paired with and bounded against the intended production configuration.

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3101
```

In another shell with that same build environment, first select a **new, nonexistent** report directory. The Lighthouse collector creates it and refuses reuse.

```sh
export FACILITY_BASE_URL=http://127.0.0.1:3101
export FACILITY_PERFORMANCE_MATRIX=premium-civic
export FACILITY_PERFORMANCE_DIR=build/facility/premium-civic-rc01
export FACILITY_RUNS=5
export FACILITY_ANGLE=metal
npm run facility:measure
npm run facility:lighthouse
npm run facility:performance:validate
npm run facility:verify-browser
```

Archive `build/facility/page-measurements.json` alongside that collection immediately after the run; it remains the existing canonical input for the summarizer. Retain `.next/facility-build.json`, server log, raw Lighthouse reports/traces/network artifacts and report hashes. A diagnostic throttled collection cannot qualify the release. The full matrix rejects missing, duplicate, incomplete, extra or differently scoped captures. Existing retry policy allows one retry only for a missing/invalid navigation report, preserving the invalid capture; a valid poor performance result remains in the five-sample set.

For Ubuntu software-functional CI, keep `FACILITY_MEASUREMENT_SCOPE=ci-functional`, omit Metal, and run `node scripts/facility/validate-ci-functional.mjs` after `facility:measure`. Software evidence must retain `hardwareQualification: not-performed`. The existing facility workflow remains the original 30-capture core gate by default; final premium qualification is the separate expanded matrix. The optional self-hosted hardware job likewise needs the explicit premium matrix variables for the expanded release check.

Any source, lock, build-setting or harness change invalidates the corresponding candidate collection; rebuild and recollect the affected qualification matrix. No CI-only or emulated result closes physical-device or reader gates. The user's implementation instruction already authorizes the release sequence after its required gates are evidenced. This runbook cannot supply missing reader, device or editorial judgments, and its command successes do not themselves authorize promotion.

## Bounded final-check wrapper

Use `scripts/qa/bounded-command.mjs` for finite application checks after the lead declares the candidate ready. Do not start the real task budget merely to test the wrapper; its unit suite uses isolated temporary ledgers and harmless child processes.

```sh
node scripts/qa/bounded-command.mjs build --timeout-ms 900000 -- npm run build
node scripts/qa/bounded-command.mjs browser-webkit --timeout-ms 1800000 -- npm run test:e2e -- --project=webkit-desktop --workers=1
```

This budget measures **only commands launched through this wrapper**. Earlier work, other-agent activity, server lifetime and commands run outside it are unmetered/unknown; the receipt is not a reconstruction of total task time or total compute. The clock starts with the first instrumented qualification invocation, not the beginning of the conversation.

The wrapper persists one fixed task ledger at the Git common directory's `gridninja-qa/premium-civic-upgrade/budget.json`. Using the Git common directory retains counters across candidate commits/worktrees without dirtying the source. The instrumented qualification ceilings are 40 launched commands, three attempts per enumerated phase, and a conservative four-hour wall window beginning with the first valid invocation. Gaps count toward that window. Each command also has an explicit finite timeout, at most one hour, capped by the remaining task window; cleanup receives only its bounded shutdown grace. There is no reset or automatic retry flag.

Every reserved attempt counts, including spawn errors, failed commands and interrupted runs. A stale running entry blocks further execution until the owner inspects it. Exhaustion requires an explicit, documented root disposition; neither changing a candidate SHA nor choosing a new working tree resets the budget. An alternate phase name must not be used to evade a phase ceiling. The exact phase list is exported as `COMMAND_PHASES` in `scripts/qa/command-budget.mjs`.

Each attempt gets a new receipt directory with bounded stdout/stderr (1 MiB each), full byte counts, truncation flags and saved-log hashes. Receipts capture HEAD, dirty paths, source revision and QA-harness revision before/after; source, HEAD or harness mutation makes the command fail qualification. A successful dirty checkout remains explicitly provisional. Only the separate exact-candidate release ledger can approve the entire release; a successful wrapper command is one check.

The POSIX wrapper launches without shell expansion in an owned process group. Timeout/interruption cleanup sends TERM then KILL only to that group and currently verified descendants, matching PID/start-time evidence. A process-table inspection failure still terminates the known owned group and fails cleanup qualification. It never kills by process name. The receipt explicitly limits the cleanup scope: a child that detaches and reparents after its parent exits cannot be reliably attributed by this mechanism, so complete detached-tree cleanup is **not established**.

Qualification therefore accepts only the reviewed finite phase→npm command allowlist in `scripts/qa/command-contract.mjs`. Arbitrary commands, `node -e`, shells, servers, daemon launchers and phases without an approved command fail closed before launch. The reviewed nested supervisors must close their own children before successful completion; this wrapper is not a substitute for that lifecycle contract. Browser commands accept only the matching project, `--workers=1`, optional `--retries=0` and `--reporter=list,json`. Facility collection settings remain environment variables, not extra command arguments. A future visual-acceptance command needs an explicit source review and allowlist addition; the existing phase name alone does not authorize it. The daemon-launching isolated-PostgreSQL supervisor is outside this allowlist; the required integration suite can use a separately owned temporary cluster. Start and stop test servers separately under explicit ownership. A cleanup or log-drain failure cannot qualify a command. Windows is rejected until an equivalent verified cleanup implementation exists.

Keep the app environment stable between the command wrapper and child check. Supply environment variables through the process environment, not secret command arguments; environment contents are not copied to receipts. Final performance collection remains forbidden until the lead freezes source and opens the qualification window.
