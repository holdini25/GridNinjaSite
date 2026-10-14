# Website-only release candidate — 14 October 2026

This candidate combines the completed assessment buyer journey, premium Civic v2
presentation, dispatch teaching-model corrections and founder experience. It
preserves the currently deployed backend. It does not activate the new delivery
safeguards or constitute qualification of the full operational upgrade.

## Source and ownership

- Single integration/release owner: “Build premium founder page”, local thread
  `01a137f4-f433-752f-8378-3a77511dd003`.
- Coordinating session: “Define high-yield upgrade spec”, local thread
  `01a132a5-4b70-7590-826c-43ff1fa83a57`; code frozen at
  `ca6aad450b5b1324b8347d3fa7cf9df574c9c70d`, with pushes, merges and promotions held.
- Base: `25ec9dec0aeb4e6798e9a3c18dbe59433b2dd0cc`. Its entire Git tree equals the
  deployed `bbeb94bd98ee76b1aab149ad3b4ce92622e47f01` tree
  `b412a30d8a1dc11e863348e644a5028a64cf96b8`.
- Preserved full candidate: `a1a1057ea88f22d68a7271f8fd5d7c6e984cb78d` on
  `codex/combined-website-release`. It includes assessment `ca6aad4` and founder
  commits `8af1181` / `3a35a2a` with the About conflict reconciled.
- Selected release branch: `codex/website-ui-release`. The adjacent JSON manifest
  enumerates 179 imported paths, 65 deferred paths and integration additions.
  Its final commit and subsequent validation are recorded in the PR/release evidence.

## Preserved production contract and deferred changes

The API/internal routes, database schema/client/repositories, contact and provider
logic, origin/verification/rate-limit controls, migrations, service environment
template, operational configuration, dependencies and lockfile remain identical
to the production source baseline. Contact payload, attribution and receipt
contracts are unchanged. Form changes are a data-handling link and compact
Turnstile presentation. Production lockfile SHA-256:
`03e934b636192fd7fe69d0329bc717074872c1b3abec57a3ff1e5bcfbdd770f3`.

The following full-candidate changes are deferred:

- Migration `0002` and its nine outbox columns, four new tables and quarantine of
  previously attempted unresolved deliveries. The new repository uses those
  fields during ordinary intake; shipping it without verified schema/migration
  preparation would break fresh inquiries.
- Provider-account/key approval, CRM opt-in/contract changes, attempt tracking,
  revised sweep/retention behavior and repository state transitions. These require
  coordinated operational qualification against the new schema.
- Resend observations, human acknowledgement and independent monitoring routes,
  credentials, operator references and handling thresholds. No services, schedules
  or staff coverage are provisioned by this website-only release.
- Associated backend tests, staging canary/workflow, cutover tooling and operational
  runbooks. Production versions remain where present. Historical QA repair tooling
  is not imported; the existing admission runner is preserved.

Founders are identified separately from delivery staffing. No public delivery
profile is approved by this release. Existing delivery limitations remain; the
site cannot claim the deferred safeguards. No static Contact prototype is included.
Historical Civic/founder documents describe their own source/evidence and are not
qualification records for this combined website candidate.

The sole application-config delta removes `experimental.inlineCss` for stylesheet
delivery; all headers and security settings remain unchanged. Vercel Git deployment
guards disable the assessment, full-combined and selected candidate branches,
preserving main's existing behavior and preventing automatic connected previews.
No credentials or host access controls are changed.

## Qualification scope and evidence

The release matrix intentionally adds `/about/founders`: 14 routes × two profiles
× five runs = 140 Lighthouse/full-scroll captures. Existing budgets and the
30-capture core matrix remain intact. Hosted HTML attestation follows all 14 routes;
asset coverage alone is insufficient. Two founder browser tests cover native
keyboard disclosures, contact navigation, no-JavaScript reading and reduced motion.

Website-only evidence is retained under
`build/qa/website-ui-release-20261014/`. The initial unit run's two import failures
are retained in `unit.log`; the corrected run uses `unit-corrected.log`. The corrected unit suite passed 1,414 tests in 142 files. Lint,
typecheck and production build passed (build `Mh2-fczS4AGXEuhdeAWfi`). Final source identities and
remote CI outcomes must be bound to the selected candidate, not borrowed from the
full candidate's 1,550 passing tests.

An isolated protected hosted preview's noindex/SSO failures are configuration limits,
not evidence of public SEO regression. They remain failed diagnostic observations.
Production-equivalent page serving, contact presentation, SEO, accessibility and
performance require their own qualification. Browser security admission, credentials,
CSP, deployment protection and thresholds must remain intact. No real form
submission or production database operation is authorized by this evidence record.

At preparation time production is unchanged. The latest coordinating-session
read-only hosting record identifies `dpl_DEjFoYdrgHQHRKPohyhau6VRJrzy`, immutable
`gridninja-6k04milzg-holdini25s-projects.vercel.app`, Git `bbeb94bd`. Before cutover,
recheck alias/deployment identity and retain this unchanged-backend version as the
rollback target. No migration is part of this release.

The sole cutover path is merging the qualified website PR into `main`, followed by
the existing automatic deployment. Do not separately promote any staged deployment.

## Fresh CI correction

Selected `755116e` failed the contextual SEO graph in both browser/search profiles:
`/about/founders` lacked the required related-resources section. The route now uses
the existing server-rendered `RelatedSeoLinks` component. The failed job and staged
deployment `dpl_9KxyDSVt6VryzDUSDmhyMeMWeFVm` remain historical evidence; neither
qualifies the corrected source. No deployment was promoted.

An additional read-only `Website route qualification` workflow runs the existing
collector's full 14-route matrix (140 Lighthouse captures and 140 full-scroll
observations, plus existing readiness checks) under explicit software-functional
scope. It preserves all budgets and existing CI workflows and is not presented as
physical-device qualification. Its 90-minute limit bounds the expanded collection.
Protected hosting authentication/noindex remains a distinct environment limitation.

Corrected local build `guaagM2DXAUKNNhF9A8dD` passed; source prefix `323c8d8a5867`.
SEO source validation passed 66 tests in 12 files; lint/typecheck passed.

## Contact performance correction

The completed expanded run for `a51cf350519870982979ba5476201c311b224060`
retained all 140 Lighthouse captures, 140 full-scroll observations and 20 readiness
observations. Its only hard failure was Contact mobile median LCP: 2,396.796 ms
against the unchanged 2,000 ms limit. Standard CI passed, but did not supersede
that failure. The associated staged deployment remains unpromoted.

Local CSS consolidation and below-fold rendering trials did not close the gap and
were reverted. Trace/model replay identified framework transfer as the critical
path; the simulated delay was not evidence of comparable layout/paint CPU work.

The bounded correction keeps Next.js and the existing Contact form, moving only
`/contact` into supported Pages Router static generation. Original content, native
header/footer, form attribution, validation, verification, receipts and recovery
remain. Metadata and schema use the existing registries at build time. The App
Router receipt route remains in place. Shared static primitive defaults now live
below utility classes in CSS, and footer text no longer brings the SEO registry
into the browser. The form itself gains only a lint explanation for its existing
native link. This is not the earlier static Contact prototype.

Build and validation remain strict: initial JavaScript accounting includes Pages
shared runtime, page code, low-priority files and actual emitted scripts; hosted
attestation resolves the exact static producer; CSS validation includes Pages
entry/layout roots. The 180 KiB JavaScript cap, 2,000 ms Contact LCP gate and full
14-route release matrix are unchanged.

Isolated local evidence is retained in the Contact runtime trial worktree under
`build/qa/contact-runtime-trial/` and `build/facility/pages-contact-trial-{01,02}/`.
The first Pages trial failed at 2,103.815 ms. The second passed the ten-capture
priority preflight: Contact median 1,954.082 ms, Home 2,311.218 ms; Contact
accessibility/best-practices/SEO 100, CLS 0 and TBT 0. Its build is
`g9sSxonz4-iM8xu_THxFU`, with source prefix `24886516e852`, test verification key
and observability disabled. One Contact sample remained above 2,000 ms; policy
uses the five-run median. These ten captures are not full release qualification.

Focused unit checks passed 223 tests after retaining an earlier sandbox loopback
failure and updating static-brand class assertions. The first browser run passed
28 of 30; two new no-JavaScript navigation-helper failures are retained. Diagnosis
confirmed that animation-frame callbacks do not run with JavaScript disabled;
normal, non-forced browser clicks navigate correctly. The corrected tests use
native actionability for those no-JavaScript link actions. All 20 new parity
checks passed across Chrome stable, Chromium desktop/mobile and WebKit
desktop/mobile. Local Firefox startup stalled and its run was interrupted; its
independent CI result remains required. Checks cover cross-router attribution,
Back/Forward/refresh, raw/hydrated metadata, disabled no-JavaScript intake, mocked
submission and computed primitive geometry at narrow/wide viewports.

The source review reconciled all 197 changed paths (179 original imports plus 18
integration additions), all 65 exclusions, sole Contact route ownership and
preserved production contracts. Full corrected browser/CI/performance and hosted
production-settings qualification remain pending. Production release remains
held until those gates are bound to the final selected source.

## Retained frozen-source results and next correction

Frozen `f3bf9d99d828b6a46ab63bd9bf368b45748f9738` closes the initial Pages
observability accounting omission: enabled builds charge the exact required
dynamic module and all emitted JavaScript files once. Missing or malformed page
data, loadable entries or chunk bytes fail. This correction received two independent
read-only source reviews; their approval did not qualify runtime behavior.

Its expanded CI run `38511535813` passed all 140 Lighthouse captures, 140 full-scroll
observations and 20 readiness observations, under software-functional scope with
hardware qualification explicitly not performed. Mobile medians were Home
2,073.740 ms, Contact 1,969.160 ms and Founders 2,435.067 ms. All three had
accessibility, best practices and SEO scores of 100. The artifact SHA-256 is
`44663d83412e102a047ed4f42eb971612e7ae8bbfbbe2df58b588c62b7b437db`.
These passing results coexist with the separate core Facility run `38511535816`,
whose Home median failed at 2,501.889 ms against 2,500 ms. Neither run overwrites
the other. Standard CI `38511535811` passed 12 of 14 jobs; both WebKit profiles
retained failures. Unit CI passed 1,438 tests, integration passed three, and SEO
browser checks passed 36 with 104 audited skips.

The protected isolated deployment `dpl_7fbDPxDXDRKaEYjZQMbrvBDnFqt4`, build
`4xxSpJ-VvLp7667zNel_W`, verified all 100 resources before and after its ten-capture
priority diagnostic. Mobile Home LCP was 1,981.596 ms and Contact 1,526.509 ms.
Both groups failed best practices (93) and SEO (69): explicit noindex, the protected
manifest redirect toward SSO blocked by CSP, and real CSP-report 503 responses
were retained. The isolated project has no application service configuration;
the reports do not uniquely establish the reason for every 503. No unrelated
React or Pages hydration failures appeared in the scored audits. Ten of 140
captures remain incomplete qualification, and protected hosting is not public SEO
equivalence. No full hosted collection or production promotion followed.

The next source correction is deliberately narrow:

- Tailwind scans the entire application source tree and the native header runtime,
  eliminating documentation/test-only selectors while preserving all component
  exclusions and required animation styles. The validator rejects narrower or
  broader explicit Tailwind scopes.
- Native header icons render the same SVG geometry on the server without a Lucide
  client wrapper. The local build removes one initial JavaScript request and saves
  742 gzip bytes of JavaScript, 266 of CSS and 41 of HTML. This artifact comparison
  is not a measured performance improvement. Image priorities and budgets remain
  unchanged.
- The shared resource-hub assessment CTA disables optional prefetch, consistent
  with existing CTA behavior. Retained WebKit traces show outgoing assessment
  prefetch/CSS cancellation during Evidence-to-Contact navigation; the exact
  rejected plain assessment request is absent from the network capture, so its
  precise promise remains uncertain. The unchanged style test must validate this
  product correction.
- The Contact parity fixture focuses the assessment link and waits for its mocked
  verification callback before native navigation. This prevents the fixture from
  cancelling its own script; it tests settled verification, not cancellation
  timing. Runtime-health guards, no-JavaScript behavior and real form contracts
  remain unchanged.

Local corrected build `YXy0gs9DiLrbE_I3aiMf4` passed all build validators, lint and
typecheck. Its runtime source digest is
`e895f091796cd260acb230a548c014288859ae9ae54e41115de46f494d4cf4ea`.
The unit run retained sandbox loopback/process failures in four fixture files;
all 21 tests in those files passed with the required local permissions. Combined
results from the unchanged run and those four suites account for all 1,442 tests;
this is not a single clean full-suite run. Focused WebKit desktop/mobile checks
passed 24 of 24 without retries: eight Contact parity, 12 initial-style and four
header-parser checks. All 24 traces retained zero runtime errors, failed scripts
or styles, and assessment prefetches. The two API posts and four verification
script requests were locally fulfilled test fixtures; no unmocked API request
occurred. Fresh full CI, performance and hosting qualification for the corrected
source remains required before cutover.

The corrected local ten-capture preflight passed unchanged gates: Home mobile
median LCP 2,309.519 ms and Contact 1,953.482 ms; both groups scored 100 for
accessibility, best practices and SEO, with zero TBT and CLS. All samples used
the same corrected build and M5 Metal. The first invocation was rejected before
capture because the collector lacked the build's public test verification setting;
that failure log is retained. The correctly pinned run is
`build/facility/pages-contact-trial-03/`, still explicitly 10/140 and incomplete
release qualification. No valid unfavorable sample was discarded or replaced.

## Completed 108 evidence and environment correction

Frozen `108f4f50b3c5a98f0d25dfb70e9edc09b4a1a5d3` subsequently passed standard CI
`38515385710` (all 14 jobs): 1,442 unit tests, three PostgreSQL integration tests,
and 1,509 browser passes with 110 skips and one retained Firefox first-attempt
failure that passed its configured retry. SEO checks passed 36 with 104 audited
skips. The separate core Facility run `38515385731` passed 30 software captures;
hardware was skipped. Expanded run `38515385794` passed 140 Lighthouse captures,
140 full-scroll observations and 20 readiness observations under software scope.
Its mobile LCP medians were Home 2,419.953 ms, Contact 1,949.756 ms and Founders
2,292.556 ms. Independent local M5 Metal coverage also passed that full matrix,
with medians 2,306.735 ms, 1,953.909 ms and 2,307.966 ms respectively. These remain
evidence for their exact source and settings, not the next correction.

Protected isolated deployment `dpl_8BW7nubz6BdjYFAYmhFJRTb4C6d5`, build
`tGepTu8QCtuu3ykKHkaq3`, passed initial verification of all 100 resources. Its
priority collection retained eight valid captures, followed by an invalid fourth
Contact run (`CHROME_INTERSTITIAL_ERROR`) and an unattempted fifth run. The invalid
trace and network files contain literal null placeholders. Final serving failed
with a generic root fetch error. No DNS, TLS, outage or protection cause is
established. The entire collection remains failed, despite a later separate
GET-only 100-resource verification passing. The eight valid reports retained
Best Practices 93 and SEO 69, including noindex, the protected manifest's SSO/CSP
failure and actual CSP-report 503 responses. No failure was waived or replaced.

The next correction makes the manifest credential request explicit and adds an
environment-specific qualification contract. It preserves the manifest payload,
all numeric thresholds, production backend exclusions, provider/security settings
and the existing intentional published-brief SEO exception. Protected noindex is
positively verified; raw public SEO failures remain visible and public acceptance
stays pending. The public adapter separately binds authoritative production
aliases and every measured document to the actual producer build. It cannot
qualify absent producer evidence, earlier samples, a priority subset or software
CI as public hardware acceptance.

See [environment qualification](environment-qualification.md) for exact modes,
remaining producer/live-widget prerequisites, the minimum Turnstile handoff and
cutover sequence. No new indexable staging site, widget, bypass credential or
backend service configuration is required merely to complete the code work.
Merge and deployment remain held pending fresh applicable qualification.

The environment/manifest correction passed the production build and all build
validators, ESLint and typecheck. The final full unit run passed 1,531 tests in
149 files. Earlier failures from stale generated Contact types, new fixture
typing and missing environment fields remain in the local evidence directory;
they were corrected without lowering assertions. Focused browser validation
passed 62 tests with no retries or flakes; four WebKit cases explicitly skip the
Chromium-only native manifest protocol. Both Chrome native manifest requests
(About and Contact) sent the synthetic local HttpOnly host-only cookie, with
unchanged manifest bytes and successful responses. Form interactions used local
fixtures, not real submissions.

Local build `IfMi2o-vV6d--IitA8qBH` has runtime source
`1e52d18d508947f3a24238721a819af6f32ac076e40f822ba240697ff9529bfd`.
The fresh Chrome `155.0.8059.40` M5 Metal priority diagnostic passed both unchanged
five-run median groups: Home LCP 2,312.957 ms and Contact 1,953.919 ms, with
accessibility/Best Practices/SEO all 100 and CLS 0. Two individual Contact samples
exceeded 2,000 ms and remain recorded. The index stays `incomplete`, diagnostic
and 10/140; this does not establish full local, protected or public qualification.
Its harness digest is
`8b784344605635aab2ec0be50059181204b4c8d17d78be7c73596d5905cb8cf2`.

Evidence is under `build/qa/manifest-auth-20261014/` and
`build/facility/manifest-auth-priority-01/`. The complete split manifest accounts
for 222 changed paths (179 original imports and 43 integration additions), while
all 65 exclusions remain intact: 30 production-identical files and 35 absent
deferred files. No dependency, production backend, credential or security-setting
change accompanies this correction. Fresh full CI, complete hosted coverage,
live verification and public production acceptance remain pending.


## Completed Git attestation correction

The automatic production Git build now emits its own attestation using existing
nonsecret platform metadata for the exact GridNinja project, repository and main
branch. Independent consumer pins explicitly select the Git mode, bind checkout
HEAD, and require matching raw source/configuration/harness and deployment
identity. The existing CLI transformation remains a distinct supported mode.
There is no new environment setting, credential read or public attestation route.
Two independent read-only reviews found no concrete blocker in this extension;
actual platform metadata and emitted output still require verification on the
future authorized Git deployment.

The final combined unit suite passed 1,575 tests in 151 files. A subsequent
fixture-only lint cleanup passed its six focused entrypoint tests. The fresh
production build `Uk4xqpPoQNYAKunogtGR4` passed compilation, TypeScript and all
postbuild validators, with the same runtime source digest as the preceding
manifest build. Its new harness is distinct from the earlier 10-capture priority
diagnostic above. The earlier 62 browser passes remain product validation for
unchanged manifest/runtime source; they are not a new hosted or full performance
claim. Fresh candidate qualification remains required. All previous failed logs,
raw reports and incomplete runs remain retained.
