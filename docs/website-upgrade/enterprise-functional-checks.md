# Enterprise functional qualification

This protocol executes the checked-in assessment, navigation, enterprise experience,
and CSP journeys against **one production build**. It is a software-browser
functional gate. It does not establish physical GPU performance, native Safari
behavior, visual approval, production delivery, or production release readiness.

## Preconditions and fixed settings

- Freeze application, assets, scripts, tests, lockfile, and workflow changes before
  creating the candidate ledger. Any change requires new evidence; keep prior attempts.
- Use Node 22.23.2 and npm 10.9.8. On 27 September the same pinned versions were
  restored under `build/tools/node-v22.23.2-darwin-arm64/bin`; the former temporary
  installation is unavailable. Confirm actual versions before executing.
- Use the exact registered candidate release, **auto-adaptive**, enforced CSP, and
  the test Turnstile key. Reading-hold journeys require automatic desktop/mobile
  activation. Poster/manual/desktop-only configurations need separate rollback
  smoke checks and cannot substitute for this suite.
- Keep `VERCEL` unset for these local functional checks. The resulting artifact
  records observability disabled, test verification, and HTTP. Actual production
  Analytics/Speed Insights, live verification, HTTPS and CSP performance remain a
  separate required gate.
- Finish CPU checks first. Reserve browser/GPU time: stop Blender and other browser
  measurement jobs; run one project and one worker at a time. Do not start a second
  build while any suite is consuming `.next`.
- Each Playwright test receives a fresh context. The release's authored activity
  seed, fixed scenario entry points, viewport/device profiles and bounded
  state-based assertions are retained. Do not freeze the browser clock in motion
  tests; they must exercise real scheduling and interruption.

## Build and identify once

Run in a fresh shell after confirming no development/preview server occupies port
3000. Do not reuse an unrelated running server. Pick a new evidence directory for
each attempt. These commands are instructions, not evidence that they were run.

```sh
export PATH="$PWD/build/tools/node-v22.23.2-darwin-arm64/bin:$PATH"
export FACILITY_ASSET_RELEASE=facility-v10
export FACILITY_3D_MODE=auto-adaptive
export GRIDNINJA_CSP_MODE=enforce
export NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
unset VERCEL GRIDNINJA_HTTPS
export QA_FUNCTIONAL_DIR=build/qa/enterprise-functional-attempt-01
mkdir -p "$QA_FUNCTIONAL_DIR"
npm run build > "$QA_FUNCTIONAL_DIR/build.log" 2>&1
node scripts/qa/candidate.mjs init --ledger "$QA_FUNCTIONAL_DIR/candidate.json"
node --input-type=module -e 'import { verifiedBuildIdentity } from "./scripts/facility/performance-contract.mjs"; console.log(JSON.stringify(await verifiedBuildIdentity(), null, 2))' > "$QA_FUNCTIONAL_DIR/build-identity.json"
```

Stop on a nonzero command. `candidate init` refuses to overwrite an existing
ledger. The identity binds source, build, release/manifests, feature settings,
lockfile, runtime and publication hashes; its separate harness fingerprint also
invalidates results when tests/scripts change.

The current registered candidate is v10. The staged v11 art candidate must not
be substituted until its visual review passes and registration is approved.
Successful software qualification of v10 does not close the v11 craft gate.

Install the matching Playwright browsers before the exclusive measurement window.
Linux CI uses `npx playwright install --with-deps chromium firefox webkit`.
On this Mac, use the matching installed browsers. If Firefox is blocked by local
security, retain that attempt and use the pinned Linux functional workflow; do not
bypass local security or count Chromium as Firefox.

## Execute and audit every project

Start the exact production build in a separate terminal using the same environment:

```sh
npm run start -- --hostname 127.0.0.1 --port 3000
```

Confirm the server reports ready. In the prepared test shell, run the following
block with each of `chromium-desktop`, `chromium-mobile`, `firefox-desktop`,
`webkit-desktop`, and `webkit-mobile`. Preserve per-project reports and outputs.
The audit executes even when Playwright fails.

```sh
export QA_BROWSER_PROJECT=chromium-desktop
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
export PLAYWRIGHT_JSON_OUTPUT_FILE="$QA_FUNCTIONAL_DIR/browser-$QA_BROWSER_PROJECT.json"
node --input-type=module -e 'import { verifiedBuildIdentity } from "./scripts/facility/performance-contract.mjs"; await verifiedBuildIdentity()'
node scripts/qa/enterprise-functional-policy.mjs "$QA_BROWSER_PROJECT" "$QA_FUNCTIONAL_DIR/policy-$QA_BROWSER_PROJECT.json"
qa_browser_status=0
npx playwright test tests/e2e/assessment.spec.ts tests/e2e/navigation.spec.ts tests/e2e/facility-navigation-v7.spec.ts tests/e2e/enterprise-experience.spec.ts tests/e2e/enterprise-security.spec.ts --project="$QA_BROWSER_PROJECT" --workers=1 --retries=0 --reporter=list,json --output="$QA_FUNCTIONAL_DIR/artifacts-$QA_BROWSER_PROJECT" > "$QA_FUNCTIONAL_DIR/browser-$QA_BROWSER_PROJECT.log" 2>&1 || qa_browser_status=$?
qa_skip_status=0
node scripts/qa/candidate.mjs skips --report "$PLAYWRIGHT_JSON_OUTPUT_FILE" --policy "$QA_FUNCTIONAL_DIR/policy-$QA_BROWSER_PROJECT.json" --out "$QA_FUNCTIONAL_DIR/skips-$QA_BROWSER_PROJECT.json" || qa_skip_status=$?
test "$qa_browser_status" -eq 0 && test "$qa_skip_status" -eq 0
```

The policy names required titles and precise navigation capability exceptions.
Missing reports, missing titles, new skips, runner errors and failed attempts fail
qualification. Do not generate an allowlist from observed skips or change it merely
to make a report green. A browser unavailable locally is **blocked**, not passed.

## Record and interpret evidence

- Retain the build log, identity, all browser JSON/logs, skip policies/results,
  screenshots, videos and traces. Keep failures alongside subsequent attempts.
- Inspect each failure before rerunning. Fixes that change source/build/harness
  require a new candidate and fresh complete suite.
- Record aggregate browser and skip evidence in the ledger only after all required
  projects execute successfully. `candidate record` needs an accountable owner,
  an explicit status and a hashed evidence artifact; a previous failure also needs
  `--resolution`. A subset does not pass the complete browser gate.
- `node scripts/qa/candidate.mjs check --ledger "$QA_FUNCTIONAL_DIR/candidate.json"`
  should continue to fail while unrelated required gates are outstanding. Never
  reinterpret a green functional workflow as a public go/no-go.
- Run production-configured HTTPS, native Chrome/Safari, Simulator, physical
  devices, accessibility review, delivery/recovery and performance separately,
  using their actual capabilities and explicit evidence statuses.

The matching CI entry point is
`.github/workflows/enterprise-qualification.yml`; it builds once, distributes that
artifact to matching Linux browser jobs, audits skips, and labels its limited
functional scope in the workflow summary.
