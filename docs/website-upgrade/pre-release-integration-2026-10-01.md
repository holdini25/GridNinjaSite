# GridNinja final candidate review — 1 October 2026

**Local implementation and authorized validation are complete; ready for an authorized push and exact-revision CI review. Production release is not yet fully qualified.** The remaining gates below are explicit. Current results belong to application commit `119153e` plus the test-only correction `76f5f13`; earlier-build evidence is not reused as current qualification.

## Candidate and scope

- Repository: `holdini25/GridNinjaSite`; isolated candidate branch `codex/release-readiness-20260930`; intended local release branch `codex/cinematic-release`, originally based on `b06fa6a4e99a6461e5f0d3ded4bf262aa598b062`.
- Current application/editorial commit: **`119153ef567fa3edee527adf2b9c4f1fc5962652`**. It includes readiness implementation `e0320a2` and test corrections `0e73a36` / `38f17b2`. The contact-expectation correction is test-only commit **`76f5f13`**; application/build identity is unchanged.
- Fresh production build ID: **`4qVA00AhlpCxDQkPgpkil`**; attested application source digest prefix **`fbcba3104171`** ([validation log](../../build/qa/pre-release-coherence-20261001/validate.log)). Local test target: `http://127.0.0.1:3000`; Node 22.23.2 / npm 10.9.8.
- The user authorized full local implementation and integration. Push, remote merge, upload, deployment and live form submission are outside this authorization. Production contact configuration and the current backend remain unchanged.
- The offer is a bounded, paid assessment using authorized historical inputs. Public examples are synthetic; economics remain unestimated; accepted/delivered capacity is not applicable. No customer outcome or live control is implied.

## Implementation and editorial coherence

The cumulative candidate includes three readiness fixes: [hidden-tab activation](../../src/components/facility/facility-inspection.tsx) preserves an explicit deep-link request until the document becomes visible without changing the eight-second deadline; the [staging canary](../../tests/staging/contact-canary.spec.ts) and [authorization guard](../../scripts/qa/staging-contract.mjs) require complete staging configuration, an explicit recipient and matching authorized origin, reject production/redirects and disable write retries; the [review capture helper](../../scripts/facility/review-page-capture.mjs) paints deferred sections for screenshots while restoring styles/scroll and excluding those overrides from performance evidence.

The approved enhancements in `e0320a2` made the offer and next step concrete:

- [Home offer](../../src/content/copy/cinematic-home.ts): “Review your next AI workload or tenant commitment against declared facility limits. GridNinja offers a paid, bounded assessment of authorized historical inputs, with a decision brief, supporting model record and unresolved questions for review.”
- [Homepage proof](<../../src/app/(marketing)/page.tsx>) leads with the synthetic sample, ahead of future platform direction. [Card typography](../../src/components/marketing/cinematic-home.css) uses sentence-case 13 px status labels, 14 px links and 14 px base body text (13 px on small screens).
- [Assessment](<../../src/app/(marketing)/assessment/page.tsx>) presents deliverables and a sample link before the form in both semantic and mobile layout order; `#scope` is preserved. Assessment-bound CTAs consistently say “Scope an assessment.”
- [3D story entry](../../src/components/facility/facility-ecosystem-story.tsx) makes “Follow one workload” easier to find and explains the illustrative power/cooling paths. The existing inspection destination, interaction and scope caveats remain; the versioned assessment carries the result and limits.

The editorial pass in `119153e` changed 15 files / 38 lines in each direction. [Coherence review](../../build/qa/pre-release-coherence-20261001/coherence-review.md) records the specific before/after findings and source map:

| Area | Concrete improvement |
| --- | --- |
| Purpose connected to work | [Home copy](../../src/content/copy/cinematic-home.ts) now connects stewardship to one capacity commitment, stated power/cooling/reserve conditions and visible evidence gaps. Community benefit remains an ambition requiring its own evidence. |
| Sample → inquiry journey | [Demo](<../../src/app/(marketing)/demo/page.tsx>) replaces an introductory fragment with an instruction to compare the synthetic request and modeled result. “What decision is your team facing?” invites the reader's actual question, with fit/readiness before an agreed paid scope, price and schedule. |
| Plain contact language | [Contact copy](../../src/content/copy/contact.ts), [contact page](<../../src/app/(marketing)/contact/page.tsx>) and [form helper](../../src/components/forms/contact-form.tsx) replace internal shorthand with review the inquiry → confirm inputs/permissions → agree the scope. The helper works for assessment and other inquiries. |
| Consistent terminology | [Dispatch CTA](<../../src/app/(marketing)/platform/dispatch-envelope/page.tsx>) says “Scope an assessment”; `/proof` is labeled “Review proof before autonomy.” [Intent labels](../../src/lib/constants.ts) distinguish an assessment inquiry from a Shadow Mode discussion. “Capacity aperture” becomes [“How the model limits a proposed action”](../../src/content/copy/dispatch-envelope.ts). |
| Accurate maturity | [Hub navigation](../../src/content/nav.ts), [metadata](../../src/seo/route-manifest.ts), [Insights](<../../src/app/(marketing)/insights/page.tsx>), [Methodology](<../../src/app/(marketing)/methodology/page.tsx>) and [Evidence](<../../src/app/(marketing)/evidence/page.tsx>) distinguish published synthetic records from planned articles/methods. Platform direction is “In development”; the comparison link identifies a policy-status page. |
| Privacy and retention | The form continues to exclude sensitive operational data. [Data-handling copy](../../src/content/copy/decision-pages.ts) describes assigned redaction/deletion dates at 180/365 days, supported by [repository logic](../../src/server/leads/repository.ts); it does not promise execution or deletion across every processor. Receipt text still distinguishes intake from email delivery, engagement fit, purchase and operating permission. |

The approved hero **“Understand your capacity. Know the limits.”**, offer paragraph, assessment deliverable introduction, visual system, media and dependencies are preserved. The [assessment page](<../../src/app/(marketing)/assessment/page.tsx>) retains the deliverable introduction before the form and the `#scope` destination. About/Proof retain the current-offer/future-capability and community-evidence boundaries. Immutable [AssessmentSummary](../../src/components/assessment/assessment-summary.tsx), [AssessmentDecisionBrief](../../src/components/assessment/assessment-decision-brief.tsx), published records and artifact versions were not changed by this editorial pass.

## Fresh completed validation

| Check | Current result | Evidence |
| --- | --- | --- |
| Brand, lint, types, build and pre/post contracts | Pass; 13 deterministic derivatives and two approved binary exports; publication identity/hash checks; 11 available facility releases | [Validation](../../build/qa/pre-release-coherence-20261001/validate.log) |
| Unit suite | **113 files; 1,086 passed** | [Unit log](../../build/qa/pre-release-coherence-20261001/unit.log) |
| Required database integration | **3 passed**, temporary local cluster; external traffic false; cluster stopped | [Result](../../build/qa/pre-release-coherence-20261001/isolated-database.json), [log](../../build/qa/pre-release-coherence-20261001/isolated-database.log) |
| Production dependency audit | **0 vulnerabilities** at audit time | [Audit](../../build/qa/pre-release-coherence-20261001/audit.log) |
| SEO four-profile suite | **35 passed, 101 intentional profile skips, 0 unexpected failures, 0 flaky** | [Report](../../build/qa/pre-release-coherence-20261001/seo.json) |
| SEO capture | **18 pages** all HTTP 200/apex canonical; **84 contextual edges**, **74 internal links**; **0 broken links / graph violations** | [Metadata](../../build/qa/pre-release-coherence-20261001/seo-evidence/route-canonical-metadata-schema.json), [graph](../../build/qa/pre-release-coherence-20261001/seo-evidence/internal-link-graph.json), [log](../../build/qa/pre-release-coherence-20261001/seo.capture.log) |
| Real headed Chrome visibility | **3 passed, 0 skips/failures/flaky**: cinematic background behavior, explicit hidden deep link and facility pause/resume | [Report](../../build/qa/pre-release-coherence-20261001/native-chrome.json) |

The five available browser profiles reconcile to **893 unique passing cases and 57 deliberate skips**, with **0 unresolved failures**. The original matrix: **888 passes, 57 skips, 5 failures, 0 flaky**; each failure was the same stale contact-hero copy assertion, including its retry. Test-only `76f5f13` corrected the expectation. The complete contact-layout file then passed **10/10 with retries disabled**: five resolve the failures and five repeat existing passes, so they are not all added to the unique total. Original reports remain intact.

| Profile | Original pass / skip / fail | Reconciled unique pass / skip |
| --- | --- | --- |
| Chrome stable | 178 / 11 / 1 | 179 / 11 |
| Chromium desktop | 182 / 7 / 1 | 183 / 7 |
| Chromium mobile | 175 / 14 / 1 | 176 / 14 |
| WebKit desktop | 178 / 11 / 1 | 179 / 11 |
| WebKit mobile | 175 / 14 / 1 | 176 / 14 |

[Reconciliation](../../build/qa/pre-release-coherence-20261001/validation-reconciliation.json) explains project-specific skips and unchanged application identity; [contact rerun](../../build/qa/pre-release-coherence-20261001/contact-layout-rerun.json), [focused ESLint](../../build/qa/pre-release-coherence-20261001/contact-expectation-eslint.log) and [full types](../../build/qa/pre-release-coherence-20261001/contact-expectation-types.log) pass. This is combined evidence, not one uninterrupted green matrix. The six-profile inventory is **1,140 = 893 pass + 57 skip + 190 Firefox not run**. Separate SEO/native tests are not added to that inventory.

Fresh build transfer checks remain under the 180 KiB Brotli initial-JavaScript budget, including shared framework: home **117.3**, assessment **136.4**, demo **129.5**, contact **134.9 KiB**. These build-transfer checks are separate from the Lighthouse and hardware qualification below. Setup attempts blocked by sandbox permissions or the initial SEO server configuration are preserved separately; counts above use the completed correctly configured runs.

## Rendered and editorial evidence

Current [headed Chrome review](../../build/qa/pre-release-coherence-20261001/rendered-review.json) records 1366/390 px viewports, reduced motion and data saving, no page errors, and the story available without a canvas. Representative current screenshots: [mobile stewardship](../../build/qa/pre-release-coherence-20261001/screenshots/stewardship-390.png), [demo introduction](../../build/qa/pre-release-coherence-20261001/screenshots/demo-intro-390.png), [demo next step](../../build/qa/pre-release-coherence-20261001/screenshots/demo-next-step-390.png), [assessment offer before form](../../build/qa/pre-release-coherence-20261001/screenshots/assessment-offer-before-form-390.png), [contact next steps](../../build/qa/pre-release-coherence-20261001/screenshots/contact-next-steps-390.png), [evidence](../../build/qa/pre-release-coherence-20261001/screenshots/evidence-intro-390.png), [About](../../build/qa/pre-release-coherence-20261001/screenshots/about-390.png), [Proof](../../build/qa/pre-release-coherence-20261001/screenshots/proof-community-390.png).

The coherence assessment is agent source/editorial review, not independent human approval or evidence of audience comprehension. Review screenshots are not performance measurements.

## Final performance and hardware evidence

All six [performance commands](../../build/qa/pre-release-coherence-20261001/performance-checks.json) and all three [hardware commands](../../build/qa/pre-release-coherence-20261001/hardware-qualification/checks.json) completed with exit 0. The [archived build identity](../../build/qa/pre-release-coherence-20261001/build-identity.json) matches the full source digest `fbcba310417102a3d86cc9183a4e5cffb8bdebdc8fa953f43637b2ab775c58ba`. No application source changed after the build; the Contact expectation and this report are outside the application identity inputs.

| Gate | Current result |
| --- | --- |
| Facility functional/transfer | **20 measurements, pass**: five per Home/Demo × desktop/mobile-emulation; [summary](../../build/qa/pre-release-coherence-20261001/facility-evidence/ci-functional-summary.json) |
| Facility Lighthouse | **30 fresh-profile reports, pass**: five per Home/Demo/Assessment × desktop/mobile; [index](../../build/qa/pre-release-coherence-20261001/facility-evidence/lighthouse-index.json), [budget summary](../../build/qa/pre-release-coherence-20261001/facility-evidence/ci-performance-summary.json) |
| General Lighthouse | **24 fresh reports, pass**: three per eight desktop routes; [inventory](../../build/qa/pre-release-coherence-20261001/general-lighthouse-inventory.json), [assertions](../../build/qa/pre-release-coherence-20261001/general-lighthouse/assertion-results.json), [exact current-report resource budget](../../build/qa/pre-release-coherence-20261001/lighthouse-current-budget.log) |
| Local hardware qualification | **20 measurements, pass** on Apple M5 Pro/Metal, Chrome 154.0.8037.59; [measurements](../../build/qa/pre-release-coherence-20261001/facility-evidence/page-measurements.json), [summary](../../build/qa/pre-release-coherence-20261001/facility-evidence/performance-summary.json) |
| Viewer lifecycle | **Pass**, ten reopen and ten assembly cycles, no errors or budget failures; [record](../../build/qa/pre-release-coherence-20261001/facility-evidence/facility-v12/browser-validation.json) |

Median mobile LCP: **Home 2,449.793 ms; Demo 2,300.915 ms; Assessment 2,301.018 ms**, each below the unchanged 2,500 ms limit. Home has only **50.2 ms** of median headroom; retain this as a monitoring/physical-device concern. Desktop medians are 585.083/615.474/534.999 ms respectively. No valid slow measurements were discarded or limits relaxed.

All 30 Lighthouse GPU records identify Apple M5 Pro/Metal. The local qualification uses the default headless Chrome backend, not the separate forced-Metal workflow. Demo capability p95 is about 16.7 ms in page measurements; the lifecycle probe is 16.8 ms. Mobile is emulated. Hardware results do not establish physical-mobile performance, display output or field reliability.

The filesystem Lighthouse export retained historical records; the fresh 24-report archive was separately checked, and all current records match that export. Current source-matched facility evidence is copied into this QA folder so later runs cannot overwrite this record.

## Local integration and artifact custody

The guarded [local integration record](../../build/qa/pre-release-coherence-20261001/local-integration.json) is the authority for the final documentation-inclusive Git revision and clean working-tree checks. The procedure accepts only the clean `codex/cinematic-release` checkout at base `b06fa6a`, fetches from this isolated local candidate, and fast-forwards without a remote push. It also verifies that the separate main checkout remains clean at `b15d42234618fbb8acc95230aee6e2babf4d101d`. An integration failure is not permission to force or overwrite unrelated work.

The release checkout is `/Users/holdenchung/.codex/worktrees/cinematic-release/GridNinjaSite`. Detailed logs, screenshots and reports remain on this Mac at `/Users/holdenchung/Documents/Codex/2026-09-30/task/GridNinjaSite/build/qa/pre-release-coherence-20261001/`. Evidence links resolve from the isolated candidate; QA artifacts are not committed or uploaded.

## Explicit remaining gates and limits

1. **Firefox / exact-revision CI:** Firefox launch is blocked by this Mac's browser runtime before automation connects ([current preflight](../../build/qa/pre-release-coherence-20261001/browser/firefox-desktop-preflight.log)). **190 inventory cases were not run.** It is not a passed profile. Run the full suite on a compatible runner and all required CI against the final revision; obtain a successful preview for that revision. The old PR head's green checks are baseline evidence only.
2. **Native Safari:** remote automation was disabled in the recorded Mac attempt. Obtain permission for automation or perform an explicit manual review; Playwright WebKit does not qualify native Safari.
3. **Human/device reviews:** physical-mobile, screen-reader and independent human craft/usability reviews remain unperformed. Complete them or explicitly record accepted release-scope limitations; do not turn omissions into passes.
4. **Hosted contact:** no live canary or form submission is authorized or performed. Provider acceptance and recipient inbox receipt require separate evidence. With the production backend retained, deferred new monitoring/rehearsal is not a mandatory backend-migration gate; any desired hosted rehearsal needs an authorized staging target and recipient.

A remote push, merge or deployment still needs authorization. No upload, remote branch mutation, production deployment or live form submission occurred in this task.

## Highest-yield follow-up after this bounded pass

1. **Home → sample → assessment:** test comprehension with intended buyers: what is being sold, what the sample proves, what the inquiry starts. This is the highest-value story check; agent review cannot supply buyer evidence.
2. **Proof/About:** replace qualified future/synthetic material with approved real engagement evidence when it exists. Keep stewardship tied to measured operating and community outcomes; do not add benefit claims before that evidence.
3. **Mobile Home:** profile real devices before further visual additions. The current look is preserved, but the roughly 50 ms lab LCP margin makes performance headroom more valuable than new effects.

These are bounded research/evidence priorities, not additional unimplemented features in the approved pass.
