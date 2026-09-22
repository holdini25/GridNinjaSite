# Validation and release record

Scope and authoritative architecture: [implementation plan](implementation-plan.md). Ticket ownership: [backlog](backlog.md). This is local implementation evidence, not approval to deploy or a claim of customer readiness.

## Executed checks (22 September 2026)

- Node 22.23.2/npm 10 environment; `npm ci` completed with the existing lockfile.
- `npm run lint`, `npm run typecheck`, `npm run brand:check` passed. Approved brand binaries were preserved. The derivative validator tolerates only sparse platform raster rounding (maximum one channel level in 0.02% of channels); source/approved export hashes remain exact.
- `npm run test:unit`: 321 tests across 30 files passed in the final run. Existing coverage gate passed (94.13% statements/86.11% branches for its explicitly scoped dispatch modules); this is not whole-repository coverage.
- `npm run build` passed on Next.js 16.3.6, including source SEO contracts, publication validation, 53 SEO unit tests, initial JavaScript budgets and deployment artifact trace checks. Approved publication files are included; candidates and unlisted publication files are excluded. Final restored local build ID: `jkFa4LzFnHH1yK00w_Z2s`.
- All four frozen publications passed byte hashes, manifest identity, snapshot equivalence and format checks. PDFs were extracted with pypdf and rendered with Poppler; all four are one US Letter page with legible, unclipped content and matching synthetic semantics. Accessible HTML is the primary reading alternative; tagged PDF output is not a PDF/UA certification.
- Final Playwright run covered Chromium and WebKit, desktop and mobile: 321 passed, 28 intentional project-specific skips, and three macOS WebKit keyboard-test failures. All three passed after adapting the tests to the platform's link-navigation keystroke; product behavior was unchanged. This accounts for all 324 eligible cases. Coverage includes scenario transitions, matching downloads, history/reset, no-JavaScript navigation, form retry/receipt/privacy, retained dispatch diagrams, routing, responsive layouts and automated accessibility.
- Form checks used local API and Turnstile stubs. No production form was submitted. The consumed-token regression preserves the original request ID and business payload while requiring a refreshed verification token.
- Final SEO browser suite: 35 passed with 101 intentional project-specific skips across rendered Chromium, raw HTML, Googlebot smartphone and reduced-motion projects.
- The local Firefox run stalled in the browser runtime and was stopped; it is not a pass. Chrome Stable was not run locally. Both remain in the Linux CI browser matrix. Manual assistive technology, buyer research, staging delivery and rollback remain separate gates.
- `npm run test:integration`: three database cases skipped because no disposable TEST_DATABASE_URL was configured. A read-only runtime check found no local PostgreSQL or container runtime from which to create an isolated test database. This is **not** an integration pass. CI retains its required PostgreSQL service job.

The keyboard tests now use Option-Tab for macOS WebKit, matching [Safari's documented default link navigation](https://support.apple.com/en-kg/guide/safari/cpsh003/mac); other browsers retain Tab. No host accessibility preference was changed. In deliberately JavaScript-disabled Chromium contexts, the browser-health helper ignores only the expected CSP-blocked Next.js script preloads, while retaining all other error checks.

No commits, pushes, deployments, production submissions or external messages were made.

## Performance outcome

Five cold simulated-mobile Lighthouse runs per route returned core-route median performance scores of 97, accessibility/best-practices/SEO scores of 100 and CLS of zero. Median LCP remains 2.605 s on home, 2.606 s on assessment/demo and 2.533 s on contact. These do not clear the existing LCP limits; field performance is also unverified. The one-page HTML brief has median LCP 0.615 s and no JavaScript. Initial JavaScript and resource-transfer budgets pass. Local contact/assessment pages load Turnstile only after form interaction; the configured challenge's verification latency still needs staging validation.

A bounded CSS-inlining experiment increased transfer and worsened mobile LCP, so it was reverted and the original configuration rebuilt. Full samples, units, limitations and next investigations are preserved in [performance validation](performance-validation.md) and [machine-readable samples](performance-samples.json). No performance threshold was weakened. This is an implementation handoff, not an all-gates-green release record.

## Source verification IDs preserved

| ID | Meaning / implementation evidence | Release |
| --- | --- | --- |
| T01 | Fixtures plus malformed-record rejection; schema/invariant unit tests | A/B |
| T02 | A → D removes prior favorable modeled result; explorer/browser checks | B |
| T03 | C rejects proposed commitment while preserving scoped modeled envelope | A/B |
| T04 | B requested/revised identity, no implied acceptance/execution | A |
| T05 | All16 ordered transitions agree across views/export | B |
| T06 | Known zero, unknown, not applicable remain distinct in formatting/JSON | A/B |
| T07 | Wrong scope, unit, interval rejected before comparison | A/B |
| T08 | Integer attribution conserves endpoints; illustration caveat remains | A/B |
| T09 | Reset restores B/business/disclosures/links; no asynchronous fixture loader exists | B |
| T10 | Downloaded JSON is selected record, includingD unknown | A/B |
| T11 | Registry whitelist, private candidate exclusion, integrity validation; HTTP 404/410 | A/B |
| T12 | Existing public routes, context/intent, one-hopROI redirect | A/B |
| T13 | Validation,20-second timeout, same payload/request ID with fresh verification, duplicate handling | A |
| T14 | Verification/delivery failure cannot create false receipt; staging still pending | A |
| T15 | Dummy personal strings absent from allowlisted telemetry and recovery storage | A/B |
| T16 | SSR explanation/navigation/brief; disabled no-JS form with useful guidance | A |
| T17 | Keyboard/native controls/live announcements and axe; manual AT pending | A/B |
| T18 | Browser/reflow checks320,390,768,1440; constrained table can scroll locally | A/B |
| T19 | Reducedmotion retains essential content; new sample has no playback | A/B |
| T20 | Exact version/provenance/MIME/filename; legacy Markdown pointer retained | A/B |
| T21 | Metadata/canonical/sitemap/routegraph; standalone archives explicitly classified | A/B |
| T22 | Restore known-good deployment and smoke journey; **not executed** | A/B |

Supplemental checks (not fabricated source T23–T32):

| ID | Additional required evidence |
| --- | --- |
| V01 | Economic buyer/operational reviewer tasks and brief-only handoff; pending research |
| V02 | Business interpretation, profile meaning, separate acceptance/authority decisions |
| V03 | Frozen snapshot + narrative + template + HTML + PDF identity and no current-template substitution |
| V04 | Strict scenario/version/perspective URLs; browser history and reset |
| V05 | Neutral direct thank-you,24-hour expiry, blocked storage, strict receipts, safe no-JS POST |
| V06 | Four qualification facts, explicit opportunity merges, earliest qualification, source categories |
| V07 | Individual90day endpoints, maturity, late/voided/unpaid contracts, missing outcomes, empty denominator |
| V08 | Exact enum events; arbitrary values and URL query/fragment/private payload scrubbed |
| V09 | Core-route asset budgets, local mobile Lighthouse, interaction/reflow; field CWV pending |
| V10 | Unknown/retracted/expired/surface-mismatched claims withheld; candidates absent from deployable public output |

## Buyer research before commercial release

Run two small formative rounds with unfamiliar economic buyers and operational reviewers. Do not infer executive status from analytics. First ask participants to explain the offer and identify a relevant commitment, inspect B, state what 5.8 means and what it does not permit, identify the remaining commercial question, describe inputs/effort and find scoping. Then hand only the one-page brief to a new reviewer and ask for the decision, conditions, uncertainty and next step. Use think-aloud and observed task errors, not preference voting or claimed conversion uplift.

Advance when participants consistently recover the decision, conditions and lack of operating authority without facilitator repair; revise if they confuse modeled capacity with accepted/delivered capacity, treat synthetic evidence as customer results, miss effort or cannot find scoping; stop a claim or artifact if its meaning cannot be communicated truthfully. Record participant role/context, task failures and revisions. No numerical conversion-effect estimate is supported. The supplied research rationale supports hierarchy/progressive disclosure and cautious transfer, not proof of a GridNinja conversion gain.

## Required external release gates

| Gate | Owner role to assign | Evidence needed |
| --- | --- | --- |
| Offer and strategy | Commercial/product | Resolve missing strategy PDF; confirm delivery capability and exclusions |
| People/credentials | Company/content | Approved names, roles, attributable experience and publication consent |
| Data handling | Company/contact owner | Confirm actual processors, retention, scope-specific handling and fallback contact channel |
| Contact delivery | Engineering/contact ops | Authorized staging canary confirms durable lead/outbox, delivery retry, Resend, optional CRM, alert/sweep/retention configuration |
| Database integration | Engineering | Required disposable Postgres integration job green |
| Accessibility | Reviewer | Keyboard + NVDA/VoiceOver interpretation, zoom/reflow and print review |
| Buyer comprehension | Commercial/research | Two rounds including brief-only handoff, resolved material misunderstandings |
| Performance | Engineering | Representative lab budgets plus field LCP≤2.5s, INP≤200ms, CLS≤0.1 at p75 when traffic supports it |
| Measurement | Commercial owner | Private ledger/source evidence/merge policy, weekly qualification review, monthly mature cohort reporting; approve diagnostics only with measured coverage |
| Release/rollback | Deployment owner | Identify current known-good deployment, preserve routing/artifacts/env, perform staging rollback smoke checks |

## Release and rollback procedure

1. Record commit/build identity, approved synthetic publication IDs/versions and manifest hashes, checks, unresolved waivers, accountable release/contact/content owners and deployment target. Keep personal ledgers and secrets out of this record.
2. Review ordinary copy as well as registry-controlled claims. Verify candidate assets are absent from both public output and traced function files. Verify `/roi` 308, exact B HTML/PDF/JSON, D unknown, unknown 404, withdrawn 410 and legacy Markdown continuity.
3. Run required CI and authorized staging canary. Confirm inquiry success means durable receipt, not downstream email delivery. Verify worker alerts/recovery ownership without sending test traffic to production recipients.
4. Obtain the required external evidence above. User authorization to implement is not authorization to deploy. No deployment was performed here.
5. On an authorized release, smoke home→sample→assessment with read-only checks and approved staging/test traffic only. Preserve prior immutable artifact bytes across deployments.
6. If publication identity, unsupported claims, intake or routing regresses, restore the recorded known-good deployment and its environment contract; preserve accepted leads/outbox records. If the old deployment would re-expose withdrawn candidates or unsupported claims, use a prepared truthful static fallback or hotfix instead of restoring those unsafe surfaces. Retain exact old publication URLs or explicit withdrawal responses.
7. Verify the same primary journey and receipt recovery after rollback; record recovery time and owner. T22 remains pending until exercised.

## Local commands

```sh
npm ci
npm run assessment:validate
npm run brand:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration:required # requires disposable TEST_DATABASE_URL
npm run build
npm run test:e2e
npm run test:seo
npm run lighthouse
```

Generation is an authoring command, not part of deploy: `npm run assessment:generate` requires Chromium and refuses existing-version edits. First local drafts were finalized before any publication; thereafter preserve bytes and increment versions. No need to install a new PDF runtime dependency in production.

## Final review additions

Publication registry entries pin each complete manifest digest. Duplicate identities fail validation; missing or altered bundles return 503 without an alternate result. Withheld entries return 404 and withdrawn entries 410 without reading files. The deployment trace guard requires exact available registry artifacts and rejects candidates or unlisted publication files. Narrative checks bind the complete v1 business question, governing conditions, economics and limitations to the snapshot without applying a later HTML template to old URLs.

Both telemetry providers now reject non-HTTP(S) URL schemes, including opaque data:/mailto: payloads. Opportunity reporting validates actual calendar dates, exact qualification facts and reconciled merge outcomes. Public timed-dispatch labels say model-screened; internal legacy DTO keys remain unchanged and separate from assessment quantities.

Build-graph Brotli sizes and Lighthouse network transfer are different measurements. Automatic link prefetch was observed pulling additional route code into the homepage; core journey links now avoid speculative prefetch. The build guard includes the shared framework chunks exactly once as well as route chunks. Initial compressed JavaScript is 149.1 KiB on `/`, 157.4 KiB on `/assessment`, 153.1 KiB on `/demo`, and 157.4 KiB on `/contact`, each below the 180 KiB hard limit. The form loads its complete Zod validator after interaction, and assessment validation remains on the server. Lighthouse's actual gzip transfer is reported separately; it is not compared directly with a Brotli limit. Field Core Web Vitals remain unverified.

A retry regression also covers a consumed verification token: original business fields, request ID and start time remain fixed, while retries require the current refreshed Turnstile token. An empty or expired widget token cannot resend the cached consumed token.

## Dependency remediation

The existing production dependency audit failed during verification. Targeted updates retain the same stack: Next.js and eslint-config-next 16.3.6, Sharp 0.35.4, and patched transitive PostCSS 8.5.23, nanoid 3.3.19 and baseline-browser-mapping 2.11.25. Production audit now reports zero vulnerabilities; the all-dependency audit still has development-only findings outside the configured production gate. No blanket forced audit update was used and approved brand binaries remain unchanged. Sources: [Next release](https://github.com/vercel/next.js/releases/tag/v16.3.6), [Sharp release](https://sharp.pixelplumbing.com/changelog/v0.35.4/), [baseline browser mapping fix](https://github.com/web-platform-dx/baseline-browser-mapping/releases/tag/v2.11.0), [nanoid fix](https://github.com/ai/nanoid/releases/tag/3.3.18).

## Private commercial operating record

Before measurement goes live, assign a commercial owner and keep the following in an authorized private ledger or existing CRM: stable opportunity ID, earliest qualifiedAt, evidence for the four qualification facts, decision owner, bounded scope, agreed next step, source category and source evidence, explicit merge/survivor links, executed agreement evidence/date, paid scope flag, void/cancellation state, and outcomeKnownThrough. Record reviewer and review date in that private operating system. Do not place this ledger in Git or pass its IDs to general analytics.

The primary report calls `summarizeOpportunityCohort(records, { month, asOf, source: "website-sourced" })`. Report website-assisted, other-known and unknown separately; an omitted source filter intentionally describes all qualified opportunities and must not be labeled website-sourced. Monthly qualification counts can be reported immediately; paid conversion percentages require every member's own 90-day endpoint and sufficient follow-up. The input is a truthful as-of snapshot: future qualification, agreements or follow-up dates fail validation rather than creating retrospective knowledge.
