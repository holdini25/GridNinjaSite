# Civic v2 and release preparation — 12 October 2026

Status: implemented and available in a protected Vercel preview through
[draft PR 5](https://github.com/holdini25/GridNinjaSite/pull/5). Qualification is
incomplete; production promotion is not approved. Raw failed attempts remain in
the evidence directories.

## Selected artwork

The user selected the best built-in generated finish with a maximum desktop
display width of 1600 CSS pixels, retaining the native 4K scene for future
production. The finished PNGs are 1672×941 landscape and 1145×1374 portrait; they
are not 4K generated masters. No delivery derivative is enlarged.

Homepage uses `civic-v2`; About and Platform retain `civic-v1`. Native HTML picture
selection supplies AVIF with WebP fallback, lazy loading, reserved aspect ratios
and the existing SVG/HTML failure presentation. The component adds no client
runtime. Four landscape widths and three portrait widths produce fourteen files,
each below 200 KiB. The display cap intentionally limits detail on high-density
screens at the maximum desktop size.

The editable scene and original PNG/EXR renders are preserved under
`assets-source/civic/hybrid-v2/native/final-03`. The native landscape is
3840×2160; the paired portrait is 1360×1632. The archive receipt maps retained
bytes to the original render paths and hashes. Private source files, prompts and
render receipts are not HTTP assets or deployment-trace inputs.

The [hybrid source README](../../assets-source/civic/hybrid-v2/README.md) owns
the v2 production and packaging instructions. `scripts/civic/README.md` explicitly
describes the older generated-v1 packager and its six WebP files.

## Local candidate identities

- Candidate: `candidate-11` (canonical visual harness updated for the current Home).
- Build: `RWkRSqEzFV3owz6bkQHVy`.
- Application source: `a6ad735644421207d4600df59a0947181db19b42425271f648151086d9a6f0d8`.
- QA harness: `74a462af4fadff5251305425d739c929ea829ec258c46ae47901ecb5fbd05c76`.
- Node 22.23.2, npm 10.9.8, existing package lock.
- Facility `facility-v12`, `auto-adaptive`; cinematic `cinematic-v1`, `auto`.
- Local HTTP, enforced CSP, public test verification key, no production
  observability. These settings cannot qualify hosted production performance.

Evidence root: `build/qa/release-level-20261012/candidate-11/`. The candidate
ledger binds evidence to source, build, harness, toolchain and immutable published
brief hashes. Build artifacts remain local; this document does not embed them in
the deployed site.

The subsequent candidate12 changes only a test assertion. Linux Firefox measured
the 140px verification reservation as 139.9998779296875px. The correction verifies
the exact `min-height: 140px` CSS and applies the existing 0.01px geometric
tolerance; widget dimensions, containment and layout-shift assertions remain.
All six affected local project cases pass without retries, and targeted ESLint
and typecheck pass. Application/build identity is unchanged; the new QA hash is
`fe9640e81fe26199cdcdc8698343ba889001b23f8af94de0a3bcae19d4f2d222`.
Candidate11 receipts retain their original identity and outcomes. The original
Linux Firefox failure is not relabeled by the corrected local checks.

## Completed checks and retained failures

After local commit `c713a94`, the canonical native Chrome observation completed
on the unchanged candidate11 application, build and harness. All 181 samples
cover 900.004 seconds of visible, active operation on the actual Apple M5 Pro
Metal renderer. Cadence-compliant intervals total 890.003 seconds, exceeding the
required 95%; two intervals around a quality-tier transition lack a full rolling
window and receive no cadence credit. No browser errors, visibility/context
events or retained geometry/texture growth occurred. Normal background policies
remained enabled; owned browser cleanup and compute-lock release are verified.
Independent raw-sample and start/end pixel reviews pass. This closes the bounded
local assets/mechanics/lifecycle gate when combined with the explicitly reviewed
historical checks below. It does not qualify other browsers, physical devices,
hosted performance or public release. Evidence is under
`candidate-11/native-chrome-sustained-01/`, `native-sustained-execution-01/` and
`native-sustained-audit-01/`; `native-lifecycle-qualification-01.json` binds them.

Native Safari 27 also completed a partial current-build inspection: Home/Civic
rendering and caption, Pause, sample navigation, rack door/tray/service inspection,
and focus return. The Mac locked during attempted tray retraction, whose outcome
is unverified. Remaining Safari checks and all three Simulator profiles remain
blocked; no Simulator was booted. The partial action, accessibility-tree and
image evidence is preserved under `candidate-11/native-ui-01/`. Its session
completion records identity verification and lock cleanup, not a Safari pass.

The second native session (`candidate-11/native-ui-02/`) verifies scenario
navigation, Assessment scoping, keyboard focus, unsent synthetic form retention
through data-handling and Contact navigation, About/Platform visuals, and actual
200% Safari zoom. A fresh 3D activation and one retry both entered the readable
fallback. Mechanical closure, background/resume and 400% remain unqualified.
Simulator.app is absent despite the installed device inventory; no Simulator was
booted and all eleven available devices remained shut down. The Mac locked during
tab cleanup, so tab closure is unknown. The helper's before/after identity and
compute-lock cleanup pass; all seventeen original JPEG captures fully decode.

Candidate11 changes only `scripts/qa/visual-baselines.mjs`: Home now waits for
its decoded cinematic poster and Civic v2 still, while Demo retains the existing
facility readiness checks. The fixture comment now documents compact geometry.
All 53 named captures, viewport/DPR settings and outbound/submission guards remain.
Substituting the preserved prior script reconstructs candidate10's entire harness
hash. Application source, build, settings, dependencies and published briefs match
exactly. The input review explicitly retains unchanged candidate10 unit, database,
build, publication and security results, together with its failed performance
result; none is represented as newly executed candidate11 evidence.

Candidate11's additional affected browser run passes all **96 cases**, with no
skips, retries or runner errors. Exact full-key reconciliation covers **1554
cases: 1450 passing outcomes and 104 reviewed project-specific skips**. Provenance
is 96 fresh candidate11 cases, 78 candidate10 cases on the identical current
application/build, and 1380 historical cases retained after explicit source,
dependency and emitted-delivery review. This is not a claim of 1554 fresh runs.
The complete four-project SEO suite is freshly collected: **35 passes and 101
source-defined project-inapplicability skips**, with no retries or missing cases.
Both phases verify the served build and local source/harness before and after.
An independent audit rechecks the browser reconciliation, retained input scopes
and complete raw SEO report without finding a blocking evidence issue.

The corrected canonical visual script passes syntax and uncached targeted ESLint.
Its fresh **53-state capture** completes with no page errors, forbidden outbound
requests or form submissions, and unchanged local/served identity. Agent pixel
review covers every original exactly once: twenty full pages across five widths
and thirty-three facility states across three viewport/DPR settings. Long pages
were inspected using lossless native-sized bands in addition to page context.
No material clipping, overlap, missing artwork or legibility issue was found.
The compact verification footprint and separated Assessment footer links remain
visible at every captured width. The manifest remains `unreviewed`: agent review
does not provide human golden-baseline approval or live-provider appearance checks.

The separate headed visibility and renderer/resource results remain explicitly
reviewed historical evidence. Home static HTML and Home/Demo application chunks
support the bounded source/delivery review; Demo is dynamic and has no static HTML
snapshot. These retained results are not fresh candidate11 executions. The new
900-second native observation above supplies the previously missing sustained
evidence; its application allocation/JavaScript heap data is not GPU residency.

Candidate10 passes brand validation, lint, typecheck, the complete 1327-test unit
suite (including all 57 form tests), twelve disposable PostgreSQL integration
tests, and the production build with its source, asset and publication validators.
The fresh production dependency audit reports zero vulnerabilities. The complete
CPU phase is recorded under `candidate-10/cpu-complete-01/`; source, harness and
build identity remained unchanged. The
first typecheck attempt identified archived QA source copies under `build/`
being included by TypeScript's broad input glob. The generated-output directory
is now excluded; application, test and script sources and Next generated types
remain checked. The original failing log and passing continuation are preserved.

Candidate09 fixed the Assessment footer's touching links by placing the second
link on its own content-width row with an 8px gap and a 44px target. Its 18 scoped
browser checks passed. A stricter visual check then found that the standard
300px verification widget extended 17px beyond the 320px viewport, hidden by the
page's overflow clipping. Candidate10 requests the provider's supported compact
150×140 widget and reserves its full height before loading. It uses the same
size at every width, preserving callbacks and token lifecycle without resize
remounts. Local fixtures now honor the requested size; the new regression checks
both form routes at 320px and 390px. These are local provider fixtures, not live
verification or delivery evidence. The original failed visual check remains.

The source and harness transition review reconstructs candidate09's complete
hashes by substituting only the explicitly changed inputs. Earlier broad-suite
results below remain historical; they are not newly executed candidate10 tests.

Candidate10's fresh browser scope passes **78 of 78 cases** across six projects,
with no skips, retries or runner errors. This covers both form suites and both
form-route smoke checks. All 24 narrow geometry payloads place the compact widget
within its container, form and viewport; twelve supported CLS measurements pass
0.05, while twelve Firefox/WebKit measurements remain explicitly unavailable.
Five fresh Assessment captures at 320, 390, 768, 1366 and 1920px pass strict bounds
and spacing assertions. Independent pixel review finds no material issue in the
verification/footer crops or their page context. This is agent review of a blank
local widget footprint, not live-provider usability or human baseline approval.

The emitted-file comparison finds 76 of 81 static files unchanged. Two manifests
relocate unchanged; the remaining changes are the compact option and reservation
in the form chunk, the corresponding two-byte CSS rule-size change, and equivalent
Webpack numeric-key ordering. All 35 HTML outputs match after exact reference
substitutions except the intended form reservation on Contact and Assessment.

Fresh candidate10 performance preserves the release hold. Five mobile Home runs
have median LCP **2461.84 ms**, within 2500 ms; five mobile Contact runs have
**2310.33 ms**, above 2000 ms. Both groups have median CLS 0. The unchanged
collector stops at this decisive failure with ten of 130 required captures.
Reports, traces and network logs remain under
`build/facility/release-level-20261012-candidate-10/`. No full performance pass or
hosted production qualification is claimed. Independent audit verifies the raw
artifacts, recorded M5 Metal backend and exact local build identity. Lighthouse
has no separately saved served-HTML receipt for this phase; its success-path
final identity assertion is bypassed by the group failure, so the audit records
a separate post-collection local identity check instead.

An explicitly reviewed continuation completes exactly the 120 previously unrun
captures, retaining the original ten without repeating them. The reconciled
130-capture matrix covers thirteen routes, two profiles and five runs per group.
Twenty-five of twenty-six groups pass; Contact mobile remains the sole local
budget failure at 2310.33ms against 2000ms. Collection takes 770.046 seconds;
before/after application, build, harness, served identity and original budget
hashes remain unchanged, and owned processes and the compute lock are cleaned
up. Reports and traces are under
`build/facility/release-level-20261012-candidate-11-completion-01/`; the immutable
reconciliation and receipt are under
`candidate-11/performance-completion-execution-01/`. Complete capture coverage
does not waive the failed budget or qualify hosted performance.

Two independent read-only investigations of the current reports confirm that
the LCP element is the server-rendered introduction paragraph. All five saved
results reproduce exactly from their original traces. The local observed paint
is 44–73ms; the configured simulation ends on framework delivery/evaluation.
The two React/Next framework chunks transfer 131,332 bytes, versus 13,142 bytes
for the form. There are no font or verification-provider requests. Earlier
counterfactuals and the failed global CSS-inlining trial provide no evidence for
a small source change that recovers the required 310ms while preserving behavior.
These observations do not waive the failed budget or establish that every possible
optimization is exhausted. The next supported investigation is delivery of this
exact candidate through its intended hosting configuration, with actual transport,
compression, HTTPS, observability and live verification measured separately.

The fresh prerequisite inventory confirms that this workspace has no linked
Vercel project or configured staging/provider environment. A Vercel integration
was discovered and suggested but is not confirmed installed or connected. Native
Safari access was also retried and still reports the Mac locked. The exact
current `qualification-environment.json` is attached to the build gate; it was
generated from verified current identity rather than copying a prior candidate.

A later read-only hosting check identifies the existing Vercel project as
`holdini25s-projects/gridninja`. GitHub reports a successful Vercel status for
current `main` at `25ec9dec0aeb4e6798e9a3c18dbe59433b2dd0cc`; the
[PR4 deployment record](https://github.com/holdini25/GridNinjaSite/pull/4#issuecomment-6101871137)
also identifies its historical preview. That preview responds over HTTPS/HTTP2
and serves Brotli-compressed HTML and framework scripts. One framework resource
matches this candidate's decoded bytes, while the other differs; the historical
Contact document is also a different build. These observations establish a hosting
reference, not current-candidate performance, production configuration or rollback
qualification. No scripts were executed, provider endpoints contacted or forms
submitted during the HTTP reads. Evidence is under
`candidate-11/hosting-reference-01/`. Native access was locked at this point;
the later partial Safari session is recorded above.

Historical candidate08 brand validation, lint, typecheck, 1327 unit tests, twelve disposable PostgreSQL
integration tests, production dependency audit and production build pass. No
production dependency vulnerabilities were reported. Public source/asset and
immutable-publication checks pass in the build.

Candidate08's browser reconciliation covers all 1548 original cases exactly
once: 1444 passes and 104 reviewed project-specific skips, with no failed,
missing or retried cases. Of these, 600 are fresh current-build cases (569
passes and 31 skips); 948 are explicitly retained historical cases after source,
dependency and delivered-file review. The changed shared Webpack runtime is not
claimed byte-equivalent. Fresh startup/navigation checks across all six browser
configurations supplement the unchanged route, HTML, CSS and application inputs.
This is a reviewed reconciliation, not 1548 newly executed tests.

The separate headed visibility result combines two fresh facility checks and
one retained cinematic check. SEO combines one fresh demo check with 135
reviewed historical entries: 35 executed passes and 101 project-inapplicability
skips in total. The first targeted SEO collection selected zero tests because
its test-list entry omitted the describe suite; its exit code is not counted
as success. A corrected one-case selection passes both an exact inventory
preflight and the actual unretried execution. The invalid report is preserved.

The preceding candidate03 compiled CSS review covers eighteen route/viewport combinations, six navigation
journeys, three stylesheet arrival-order checks, Contact inputs and the 1920px
viewport showing the 1600px artwork cap. Agent visual inspection found no layout
defect. It is not human approval, assistive-technology conformance or a newly
approved visual baseline.

Candidate03's initial six-project browser run retained 496 passes and twenty project-
specific skips across Chrome Stable and Chromium Desktop. Firefox failed before
site navigation at its 180-second launch timeout, reporting a sandbox-extension
error and a SWGL framebuffer failure. The remaining 1031 cases did not run in
that attempt. Its separate continuation stopped with 167 passes, eight justified
skips, one failed WebKit footer navigation and 598 cases not run. A diagnostic
reproduced native footer reflow between pointer-down and pointer-up. Rendering
the footer eagerly fixes the missed link activation; the existing twelve
desktop/mobile WebKit style-and-navigation tests pass against candidate04 with
their original assertions.

Firefox's unchanged bundled binary passed a separate launch-only probe with
fresh temporary `MOZ_APP_DATA` and `MOZ_LOCAL_APP_DATA` directories. The full
matrix uses this isolated state; the original launch failure remains retained.
No sandbox, macOS permission, browser binary or package-lock change was made.

Candidate04's new matrix stopped after 570 passes, 22 approved skips and a
Firefox no-JavaScript test timeout; 955 cases did not run. The image itself
returned successfully and rendered. A controlled probe found that Firefox
suppresses promise callbacks when scripting is disabled, including
`Promise.resolve()` and the test's awaited image `decode()`; this matches
[Mozilla's documented behavior](https://bugzilla.mozilla.org/show_bug.cgi?id=1942990#c3).
The helper now verifies native decoded pixels synchronously in no-JavaScript
contexts and keeps the decoding promise for ordinary contexts. The first
candidate05 readback was too early for WebKit's WebP decoder. A separate probe
recorded transparent pixels at 273ms and decoded pixels at 363ms. Candidate06
polls that same readback using the existing assertion deadline. Neither fix
changes website code, browser coverage, timeouts or release thresholds.

The historical candidate06 Civic suite passes across all six projects: **126
executed checks and 36 project-specific skips**, with zero retries. These results
are retained under the candidate08 input review, not rerun wholesale. It covers both compositions,
the 1600px cap, no-JavaScript delivery, WebP selection, failed images and existing
v1 placements. The other four projects' 924-case run stopped after 775 passes,
38 approved skips and one WebKit-mobile guided-demo failure; 110 cases did not
run. Source and trace review found that this test navigated before the intended
two-frame focus/scroll restoration completed. Candidate07 adds an assertion
awaiting the restored button's focus before scenario navigation, as the earlier
guided test already does. Application behavior, helper deadlines and hit-testing
remain unchanged. All 24 guided cases subsequently passed across the six
projects. The next WebKit-mobile run found a separate runtime defect: scrolling
the stage back into view cleared the keyboard preview despite retained focus.
A passive live-stage diagnostic recorded the focused preview, the viewport
transition and its removal without blur or selection. Candidate08 preserves
keyboard preview across stage intersection changes while retaining clearing on
blur, selection and hidden documents. The new regression failed before this
change and passes after it. The original twelve material tests pass across all
six projects; the broader 480-case affected run passes 458 checks with 22
approved skips. The remaining mobile and startup phases also pass. Original failed
reports and diagnostic controls are preserved. One diagnostic attached its
observer before the streamed stage was replaced; its intersection data is
inapplicable. A separate native-Tab control did not reach its target and is
inconclusive. Neither is counted as a product pass or failure.

Candidate06's five-run local mobile Lighthouse groups on the preceding
application build measured Home median LCP **2459.52 ms** (passes 2500 ms) and
Contact **2309.61 ms** (fails 2000 ms). Actual Apple M5 Pro Metal rendering is
recorded. The collector stopped
after ten of the required 130 captures. This is not a complete performance pass.
Contact's LCP is the server-rendered introduction; offline replay found no small
CSS, markup, image or form change that credibly resolves the deficit. Original
reports and counterfactual diagnostics are retained, not substituted with a
passing score or a relaxed budget. Candidate07's performance review verifies the
same application, build and performance-collector inputs; it reattests these
measurements without claiming new captures. These older results do not qualify
candidate08's rebuilt delivery.

Fresh candidate08 measurements retain the performance hold: five Home mobile
runs produce a median LCP of **2460.37 ms**, passing the 2500 ms budget; five
Contact mobile runs produce **2310.51 ms**, failing its 2000 ms budget. Both
groups have zero median layout shift. The collector stops after this decisive
failure with ten of 130 required captures, preserving the reports, traces and
network logs. This is neither complete performance qualification nor hosted
production evidence. Thresholds and measurement settings remain unchanged.

Candidate07 full-scroll Home measurements pass five desktop and five
mobile runs: 1,313,673 and 976,612 cumulative bytes respectively in every run.
Candidate08 repeats all ten checks successfully: 1,313,671 desktop bytes and
976,610 mobile bytes in every run, within the existing 4 MiB and 2 MiB limits.
The preceding candidate07 390, 768, 1440 and 1920px captures confirm separate portrait/landscape
composition, the 680px portrait and 1600px desktop caps, and no horizontal
overflow. Agent inspection found no material visual issue. These are scoped
artwork reviews, not human baseline approval or a full-site visual qualification.

Candidate08 captured all 53 states in the existing page-and-model matrix:
four pages at five widths and eleven model states at each of three viewport/DPR
settings. The ignored capture adapter updates only Home readiness to the current
decoded cinematic poster and Civic v2 composition. Original capture states,
reduced-motion/Save-Data conditions and form submission blocks remain intact.
The before/after served-build and local identity checks pass. Separate agent
pixel reviews cover all 53 originals: 20 pages, 22 desktop model states and 11
mobile model states. They found the Assessment link-spacing issue fixed in
candidate09. The capture manifest retains its original `unreviewed` state;
separate reviews do not imply human approval or a new golden baseline.

Earlier native Safari attempts could not start while the Mac was locked. The
two later candidate11 sessions made the partial progress recorded above before
access was lost again. Simulator devices remain untested because their GUI app
is missing; no physical-device result is claimed. Remaining Safari investigation
requires an unlocked Mac and a diagnosis of the observed 3D fallback.

The older artwork-only results in the hybrid README and `build/civic/` describe
the prior CSS/source state. They remain useful provenance and comparison history,
not qualification of this candidate.

## Other fixes included in this candidate

CSS ownership and unused styles were cleaned up while preserving retained
declarations and navigation appearance. Shared root CSS decoded size fell from
111378 to 85620 bytes; Home retains two CSS requests. Navigation now links to the
published research section and keeps one canonical active-page marker. Contact
provides the data-handling link without discarding an unsent form and documents
existing tab recovery and sanitized observability behavior.

Contact delivery now persists terminal state before alert publication, prevents
alert retries from sending the provider request again, and retires claimable
outbox work when retention redacts the lead. Isolated concurrency and retry tests
cover these changes. No migration or new monitoring service was introduced.
Provider acceptance is distinct from recipient delivery and operator acknowledgment;
local tests do not establish live provider behavior.

## Release boundary

Assessment-first copy, synthetic examples, unestimated economics and immutable
published briefs remain unchanged. New monitoring and its scheduler remain
deferred. Physical devices, manual accessibility, reader judgments, live delivery
and operational recovery remain separate gates. No real inquiry, provider
rehearsal, credential change, migration, merge or production promotion occurred.

The user resumed the authorized preview and completed Vercel sign-in. Target
verification confirmed production on `main`, Preview for all unassigned branches,
no custom environments or Preview domains, and the root Next.js build with its
normal prebuild/postbuild validation. Standard Protection was enabled and its
saved state verified. This protects preview deployments while leaving production
custom domains outside that authentication setting.

Commit `c713a94` was pushed and draft PR5 opened. Its
[protected preview](https://gridninja-fo763p78r-holdini25s-projects.vercel.app/#shared-infrastructure)
is Ready in the Preview environment, build `vNyHcPGf9-A149UlRN5uC`. Desktop and
mobile Civic imagery decode and pass agent visual inspection; Home → fixture B
sample → Assessment navigation works. The Assessment document declares
`noindex, nofollow, noarchive`; an unauthenticated HEAD redirects to Vercel
authentication and carries `X-Robots-Tag: noindex`. This is a read-only smoke,
not a deployed performance or intake-delivery qualification.

The hosted assessment reports unavailable security verification. Current Preview
metadata lists only `DATABASE_URL`, scoped to both Production and Preview, and
no inherited shared variables. Values were not revealed. A public verification
site key is absent; database isolation, provider settings and approved test
recipients must be established before any staging inquiry canary.

The Vercel build logs attest source prefix `29baaa77955c`, which differs from the
frozen local hash. All 550 Git source-input files at `c713a94` reproduce the local
hash exactly; Linux CI logs the matching `a6ad73564442` prefix. Vercel logs confirm Node22,
Next16.3.8, a restored cache, two changed installed packages and Vercel config hooks;
these observations do not identify which input bytes changed. Hosted postbuild
source equivalence remains unresolved. A paths-and-hashes diagnostic proposal is
preserved locally and has not been applied.

The first remote CI run passes build, quality, unit, integration, audit, SEO,
general Lighthouse, Chromium and WebKit jobs. Firefox's sole test failure is the
fractional reservation described above. The Chrome installer failed before tests
with an HTTP/2 download error; its one targeted retry passed installation, build
and browser functionality. The original installation failure remains recorded.
The separate facility job completes its 30 captures but fails mobile Home LCP at
2500.8936ms against 2500ms; this valid result is retained. Hardware qualification
is skipped and is not a pass. Remote CI and the local matrix describe different
builds and settings and are not substituted for one another.
