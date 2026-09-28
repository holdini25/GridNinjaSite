# Local release-candidate qualification

This phase prepares a polished local candidate. It does not authorize staging submissions, production deployment, real recipients, physical-device results, or research findings. Earlier release reports remain historical evidence. The most recent completed local baseline is qualification09; see `build-review-subtle-finish-2026-09-25.md` for its exact identity, passing local measurements and remaining gates. A passing earlier report never qualifies subsequent source changes.

## Check prerequisites without exposing configuration

Run `node scripts/qa/release-preflight.mjs --out build/qa/<new-attempt>/release-prerequisites.json` before preparing a new candidate. The command reads only the current process environment and the saved build-attestation file. It records variable names/presence and bounded configuration classifications; it never prints credentials, recipients or endpoint values, loads `.env.example`, contacts providers, or changes a release gate. It refuses to overwrite an evidence file. The saved attestation is explicitly unverified until `verifiedBuildIdentity()` succeeds against the intended source and settings.

The `production-configured-performance` gate now refuses a passing result unless the attested build contains observability, HTTPS policy, live verification and enforced CSP. This prerequisite is necessary, not sufficient: actual hosted delivery, downloaded production dependencies and fresh production measurements still require evidence. A local functional artifact with test verification cannot pass this gate, even if someone sets external authorization on its ledger.

## One candidate and an auditable ledger

Finish source/test/harness changes, serialize the production build, then initialize a **new** ledger:

```sh
# Local qualification uses the documented public test site key from .env.example.
# External-base-URL Playwright runs do not inject this into an existing build.
export FACILITY_ASSET_RELEASE=facility-v10 FACILITY_3D_MODE=auto-adaptive
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA \
  npm run build
node scripts/qa/candidate.mjs init --ledger build/qa/rc-01.json
node scripts/qa/candidate.mjs record --ledger build/qa/rc-01.json --gate source-quality --owner engineering --status pass --evidence build/qa/local/summary.json
node scripts/qa/candidate.mjs check --ledger build/qa/rc-01.json --scope local
```

Record `qualification-environment.json` beside the ledger with verification configured/unconfigured and local-test/live classification; do not include secret values. Attach it to production-build evidence. Browser form tests intercept the provider with isolated fixtures. The public test key does not authorize real submissions or qualify production verification. A build without the site key intentionally presents an unavailable state and cannot satisfy configured-widget recovery tests. RC07's failed configuration attempt is retained as evidence of this distinction.

Initialization requires the existing production build attestation. Identity includes source, build, facility mode/release manifests, and an additional digest of scripts, tests, workflows, and test configuration. It also records actual Node/npm versions, declared package manager, OS/platform/architecture, lockfile SHA-256, and explicit hashes and byte sizes for the frozen publication registry and files. These are recomputed at record/check time; publication approval remains a separate validation gate. A subsequent harness change invalidates qualification even if application bytes stay identical. Do not run builds during measurements or reuse a server whose `.next` files have changed.

Harness hashing excludes generated Python `__pycache__` directories and adjacent `.pyc`/`.pyo` bytecode files. Running the Blender/Python tools must not change candidate identity merely by creating interpreter caches. Python source, ordinary fixture files, scripts, workflows and test configuration remain hashed; changing them still invalidates qualification.

Keep the explicit release/mode environment for every qualification command. The enterprise candidate aligns the repository's unconfigured default with v10; v11 remains an unregistered art candidate. An environment that differs from the attested release, mode, verification, CSP or observability configuration correctly fails the identity guard. Selecting a local candidate does not change a deployment's existing rollback setting.

Every gate has an owner and one of `pass`, `fail`, `not-run`, `blocked`, or `superseded`. Each recording appends an attempt and hashes its artifacts; previous failed evidence remains required and checked. A failing/blocked gate needs `--resolution` before a passing attempt. Evidence must be immutable per attempt: save new paths instead of overwriting a prior log. A local-only ledger cannot mark external qualification passed. Local readiness and public readiness are separate outputs; a green command is not a blanket release approval.

## CPU checks and isolated database

```sh
QA_OUTPUT_DIR=build/qa/local node scripts/qa/run-local.mjs
# Add --include-build only when the integration lead has serialized build ownership.
node scripts/qa/run-isolated-database.mjs
```

The CPU runner records brand, lint, typecheck, complete unit suite, disposable database integration, and production dependency audit separately. It fails if source or harness changes during execution. It launches no browsers, sends no inquiries, and does not establish provider delivery. A build is explicit. Browser, visual, performance, native Safari, Simulator, and external gates remain separate.

The database runner requires local PostgreSQL (`QA_POSTGRES_BIN` can select it), creates a random temporary cluster listening only on localhost, strips provider and database credentials from child environment, runs the required schema suite, stops its cluster, and deletes only that temporary directory. It never accepts an existing `TEST_DATABASE_URL`. Do not start Homebrew's default service for this check. PostgreSQL16 was installed during local preparation; the temporary-cluster run passed four existing migration/atomicity/idempotency/topic cases. Evidence is `build/qa/isolated-database.json`, with raw output at `build/qa-database.log`; repeat on the frozen candidate.

## Browser and skip evidence

Run the production browser matrix after source freeze. Save JSON as well as traces. Run native headed background visibility separately from emulated contexts; Linux WebKit is not native Safari.

```sh
PLAYWRIGHT_JSON_OUTPUT_FILE=build/qa/browser.json npx playwright test --reporter=list,json
node scripts/qa/candidate.mjs skips --report build/qa/browser.json --policy build/qa/reviewed-skip-policy.json --out build/qa/skip-audit.json
```

Policy shape is `{ "allowedSkips": [{ "title": "exact title", "project": "exact project", "reason": "exact reviewed reason" }], "requiredTitles": [{ "title": "exact title", "project": "exact project" }] }`. An absent policy allows no skips. Empty reports, missing required execution, unexpected skips, runner errors, and failed attempts hidden by retry all fail. Platform-specific inapplicability needs explicit review; absence of a feature promised by the selected release is a failure. The mechanical suite now requires actual rack controls/diagnostics irrespective of release name and exercises mobile intermediate joints, interlocks, delayed callbacks, and suspension longer than the eight-second asset deadline. It must not silently pass on static endpoints when continuous movement is under test.

## Deterministic visual candidates and approval

```sh
QA_BASE_URL=http://127.0.0.1:3000 node scripts/qa/visual-baselines.mjs --out build/qa/visual-rc01
QA_BASE_URL=http://127.0.0.1:3000 node scripts/qa/visual-baselines.mjs --out build/qa/visual-regression --baseline path/to/approved/manifest.json
```

Capture only while the integration lead has assigned browser/GPU ownership. The 53-state matrix covers four pages at five widths, plus overview/four selections/six assembly poses at desktop DPR1/1.5 and mobile DPR1. It uses the frozen profile seed/camera, reduced motion, decoded application readiness, settled scheduler, pinned fonts/locale/zone, and Save-Data for static pages. Browser screenshots remain candidates with `status: unreviewed`; successful capture is never approval.

The reviewer inspects composition, text, focus/controls, seams, grille depth, highlights, labels, poster/live correspondence and all poses, then archives the reviewed files and hashes with `approvedBy`, `approvedAt`, `status: approved`. The comparison refuses unapproved or modified baselines and a different browser/OS/DPR/settings matrix. Difference tolerances (channel delta12; changed pixels≤0.1% pages/0.5% stages) absorb minor raster noise; human review remains required for intended design changes and cross-GPU differences. Do not auto-update goldens merely to make tests pass.

## Performance and operational boundaries

Use the existing five-run full performance protocol with unchanged metric settings and thresholds. Preserve 180KiB initial Brotli JS, 1.5MiB through-ready transfer, LCP≤2.5s, TBT≤200ms, CLS≤0.1 and renderer/asset budgets. Measure explicit specimen transfer separately; count every automatic request. Keep raw failures and traces. M5 mobile-size runs are not phone GPU evidence.

For this M5 Pro qualification, explicitly select `FACILITY_ANGLE=metal` for the Lighthouse collector, and `FACILITY_HEADED=1 FACILITY_ANGLE=metal` for graphics measurement and poster capture. Verify the actual Apple M5 Pro/Metal backend in the report. The Lighthouse addition preserves its simulated throttling, viewports, five-run counts and budget thresholds; backend diagnostics are collected after each audit without adding a canvas or request to the measured document. A missing or wrong requested backend fails qualification while retaining the completed report and traces. Record these launch settings when comparing historical runs that used a default backend. Native WebKit and Simulator evidence use their platform backend and identify diagnostic APIs that are unavailable.

The contact staging workflow now requires explicit matching origin authorization, a database and test recipient; missing configuration fails instead of skipping. Current field labels are used and artifacts retained. **It was not executed in local preparation.** Real delivery, actual processor/retention configuration, signing-key rotation, deployment rollback, physical phones, manual assistive technology, and representative visitors remain external gates. Native local Safari and Simulator have their own local ledger entries and cannot be inferred from Chrome screenshots.
