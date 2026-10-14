# Assessment and Civic v2 implementation

This candidate implements the user-approved assessment upgrade on
`codex/assessment-yield-upgrade`, based on `16bf45cc6bbe3b3e825ccea0cf2f4c7e887b1f51`
from `codex/civic-hybrid-art`. The comparison baseline is merged main `25ec9de`;
the older open checkout at `b15d422` was not edited. The supplied Downloads handoff
was reference material. The explicit implementation request and
[assessment-first boundaries](implementation-plan.md) govern the change.

Status: implementation complete for A/B and the C software; final local software
verification passed. **Production promotion is held:** Contact mobile exceeds its
LCP gate and the external activation/manual gates below remain open. No production
migration, provider rehearsal, service provisioning, deployment, or promotion is
claimed. Evidence from the [earlier Civic candidate](civic-v2-release-candidate-2026-10-12.md)
remains historical and does not qualify this changed source.

## Implemented increments

| Increment | Result |
|---|---|
| A: correctness and safe delivery | Dispatch teaching data 2.0.0; shared continuous-curve interpretation; immutable provider request preparation; one reservation per lease; six conservative claims; 23-hour ceiling; retention fencing and uncertain-result ledger. |
| B: buyer journey | Requested homepage order; concise shared full offer and compact reuse; adjacent identity-bound sample actions; delegated analytics; preserved Civic imagery, anchors and publications. |
| C: observations and handling | Signed account-bound callback inbox; independent authenticated monitor; explicit observation/handling thresholds; append-only authenticated handling acknowledgement. Activation requires private owner and service evidence. |
| D: delivery identity | Optional server-rendered approved profile supported; absent by default. Publication awaits approved identity, precise experience, engagement responsibility and consent evidence. |

The public offer is a bounded paid capacity decision assessment using authorized
historical inputs. Conditional, negative and inconclusive findings can be useful.
No assessment finding conveys operating authority. Examples remain synthetic;
economics are unestimated; accepted/delivered capacity is not applicable. The
control plane, Shadow Mode and runtime assurance remain qualified development
directions. Clicks are activations, not completed downloads or conversions.

## Code contracts and review map

- `src/lib/dispatch-envelope/curves.ts` owns continuous geometry and bounded
  interpolation. `evidence.ts` evaluates all critical domains, recovery and exact
  breakpoints; authoring/export rejects inconsistent records. Wire schema remains
  `dispatch-envelope.v1`, including legacy serialized `accepted` fields.
- `AssessmentOfferSummary` is server-rendered, accepts compact/full and an explicit
  heading ID, and uses shared content. The native pricing disclosure starts closed.
  Existing form scope, verification and receipt recovery are preserved.
- `AssessmentResultActions` derives every publication identifier and URL from the
  displayed record. Static selection only changes after Apply selection. One
  action group owns the adjacent links; the delegated analytics observer owns
  click tracking. No new client runtime or analytics vendor is introduced.
- Provider preparation, reservation, authorization and completion are separate
  boundaries. The durable outbox remains authoritative; a late worker can record
  a minimal result against its existing reservation but cannot requeue work or
  restore erased PII. Template changes cannot alter previously frozen bytes.
- `observations-repository.ts` matches callbacks only by provider account and
  message identity. Conflicting replays are review incidents, not confident
  delivery evidence. Early callbacks reconcile when message identity is learned.
  Acknowledgement is human handling, not a send/replay command. A later adverse
  callback can open a fresh incident after acknowledgement.

See [the delivery operations runbook](assessment-yield-operations.md) for schema
reconciliation, configuration, rollout and recovery. The source migration is
additive relative to this repository's journal; it must not be applied blindly to
a deployed database whose schema and migration checksums have not been verified.

## Qualification record

The frozen build under final review is `JhzmJKYTL9VZvB_HCDssa`:

- Application source SHA-256: `f0297fabf4fe1f941f2297ce5dc2d967ae34c57e4ecf64212003e1be7ffafa5b`.
- Final QA harness SHA-256: `13a49b54ae820dedecf209068c866dc5cb23b0b5a3df427b7e1d24db05051336`.
- Package-lock SHA-256: `f3fb8273ac082c6e61c94df676e083f900eb2454f2a70a13c03b52a2eb60d7ac`.
- Frozen publication files SHA-256: `a8ba28005332fdde2040516e0d5ddc4962e63f85404c57bb086b42230a399ebb`.
- Node `22.23.2`, npm `10.9.8`, macOS arm64. Facility `facility-v12` /
  `auto-adaptive`; cinematic `cinematic-v1` / `auto`; Civic v2 remains registered.
  CSP is enforced. Local HTTP, test Turnstile and disabled production observability
  mean this is **not production-configured performance evidence**.

The complete identity, selected manifest hashes and individual immutable-publication
hashes are retained in [frozen-identity.json](../../build/qa/assessment-yield/frozen-identity.json).
The old checkout was not used. No public assets or frozen publications changed.

| Check | Result and retained evidence |
| --- | --- |
| `npm run lint` | Passed, including the capture and browser-test corrections; [log](../../build/qa/assessment-yield/lint-final-07.log). |
| `npm run typecheck` | Passed, including the capture and browser-test corrections; [log](../../build/qa/assessment-yield/typecheck-final-07b.log). |
| `npm run test:unit` | 1,468 tests in 147 files passed; configured coverage thresholds passed; [log](../../build/qa/assessment-yield/unit-final-07.log). |
| `npm run test:integration:required` | 32 tests passed through the disposable local PostgreSQL runner; separate real connections exercise reservation/retention contention. [Report](../../build/qa/assessment-yield/isolated-database-04.json), [log](../../build/qa/assessment-yield/isolated-database-04.log). Backend source is unchanged by the subsequent social-card spacing correction. |
| `npm run db:check` | Passed; [log](../../build/qa/assessment-yield/db-check-final-04.log). This checks repository migration consistency, not the deployed schema. |
| `npm run build`, including pre/post validators | Passed; [log](../../build/qa/assessment-yield/build-05.log). Frozen publication bytes and deployment traces passed; private/unapproved files are excluded. |
| Initial first-party JavaScript | Home 117.3, Assessment 136.7, Demo 129.7, Contact 127.8 KiB Brotli, each including shared framework chunks; all below 180 KiB. |
| `npm run audit:prod` | Zero production dependency vulnerabilities reported; [log](../../build/qa/assessment-yield/audit-final-04.log). The lockfile is unchanged since that audit. |
| Visual and enlarged-text checks | All 27 final-build states passed automated axe/geometry checks at 320/390/768/1440 px, including 200% computed text enlargement and 320 px reflow equivalence. Agent pixel review found no actionable defect. All 34 generated social cards fit their content. [Review](../../build/qa/assessment-yield/visual/review.md), [hashed captures](../../build/qa/assessment-yield/visual/review.json). Native zoom, screen-reader and human approval are unperformed. |
| `npm run test:seo` | 35 applicable checks passed across four configured profiles, with 101 explicit profile-scoped skips and no runner errors. [Report](../../build/qa/assessment-yield/seo-05.json), [skip audit](../../build/qa/assessment-yield/browser-auxiliary-audit.json). |
| Headed native visibility | All four Chrome cases passed without retries or skips: cinematic background playback, explicit deep-link activation, startup beyond the background deadline, and equipment suspension. [Report](../../build/qa/assessment-yield/headed-05.json). |
| Complete functional browser matrix | All six configured projects completed: 1,468 passed, 110 explicit skips, zero failures, retries, flaky cases or runner errors. The audit verifies all 1,578 case identities and each skip's source predicate/passing counterpart; the four headed cases above satisfy the native-visibility exclusions. [Report](../../build/qa/assessment-yield/browser-matrix-07.json), [identity and skip audit](../../build/qa/assessment-yield/browser-matrix-audit-07.json). |
| Five-run performance qualification | Home mobile passed; Contact mobile failed its 2,000 ms LCP limit with a 2,311.4 ms median. The existing stop-on-failure policy stopped collection after these two complete groups: 10 of 130 captures collected, 120 explicitly uncollected/unqualified. [Index](../../build/facility/assessment-yield-final-01/lighthouse-index.json), [log](../../build/qa/assessment-yield/lighthouse-final-01.log). |

The new build's measured medians are:

| Route / profile | LCP | FCP | TBT | CLS | Group result |
| --- | ---: | ---: | ---: | ---: | --- |
| Home / mobile | 2,311.2 ms | 1,054.9 ms | 2 ms | 0 | Passed measured Lighthouse gates |
| Contact / mobile | 2,311.4 ms | 1,053.9 ms | 3 ms | 0 | Failed LCP: maximum 2,000 ms |

Both groups recorded median performance 98 and accessibility, best practices and
SEO 100, and passed the unchanged measured transfer/category gates. Each used five
fresh browser profiles on the same attested build with verified native M5 Metal.
All ten raw reports, traces and network logs are retained. Desktop and the other
mobile route groups, through-readiness/full-scroll transfer, and sustained renderer
qualification remain uncollected. These local measurements do not substitute for
production-configured HTTPS, live verification or physical-device evidence. No
performance rewrite or threshold relaxation was introduced to bypass the failure.

Local raw evidence is under `build/qa/assessment-yield/` and is intentionally
ignored by Git. Preserve that directory with the release package; these local
links are not a claim of externally published or deployed evidence. Earlier failed
and interrupted attempts are retained, including stale metadata assertions, the
no-JavaScript matcher correction, the PostgreSQL fixture timestamp correction,
and the text-scaling harness's injected line-height warning. They do not count as
passing final qualification. Build04's partial browser run was superseded when
inspection found clipped social-card badges; build05 corrects that layout.

Browser run05 was interrupted after installed macOS Chrome helpers retained
worker stdout/stderr pipes and caused shutdown errors. Its log, JSON and artifacts
remain available. The final run uses the same Chrome binary, arguments and CDP
descriptors, with diagnostics redirected to retained per-browser files through a
temporary executable shim. The complete six-project configuration and assertions
are preserved; [orchestration evidence](../../build/qa/assessment-yield/chrome-stdio-orchestration.json)
records the shim/config/binary hashes and the observed process ownership.

That run also found a legacy test relying on the old download-row position to
scroll the facility preview into view and trigger enhancement. With the approved
adjacent actions, a download can correctly remain static. The test now explicitly
requests enhancement while JavaScript is gated, retaining every native pointer,
focus and immutable-download assertion. Its targeted Chromium run passed. This
changed only the QA harness; application source and build identity are unchanged.
Earlier integration, SEO, visual and headed results retain their original
per-run harness provenance; none of their exercised application source or
assertions changed.

The complete run06 retained 1,461 passes, 110 justified skips and seven failures.
Six used a stale locator for the removed downloads group; the corrected stable
action-group selector passed the actual WebGL loss/retry case in all six projects.
The seventh exposed the capture helper's incorrect ceiling assumption at DPR
2.75: Chromium natively rasterizes a 1,471 CSS-pixel clip to 4,045 rows. The helper
now uses contiguous integer native-pixel boundaries with exact size assertions,
without resizing or tolerance relaxation. Its regression checks the entire
stitched image byte-for-byte, including tile joins and the final row. All twelve
capture unit cases and the affected mobile browser case passed. Original failure
reports, the initial inefficient unit assertion timeout, the type-projection
correction and the interrupted Firefox launch without isolated application-data
directories remain retained. These are QA changes; the application build is
unchanged. No failed run is relabelled as passing.

Adversarial review additionally found callback reconciliation starvation behind
1,000 unrelated unmatched events. The query now limits uniquely matchable work;
the new PostgreSQL regression preserves the unrelated events and verifies the
later matching event is reconciled immediately and idempotently.

The [verification record](assessment-yield-verification.json) records the application source hash, build ID, settings,
toolchain, immutable-publication hashes, commands, failed attempts and explicit
skips. Its generator reverified source/build/settings, QA harness, lockfile,
publications and report bytes before and after reading the evidence, and recomputed
the five-run medians from raw reports. Tests exercise the application and real disposable PostgreSQL rather
than rely on handoff predicates. No existing performance threshold is relaxed.

Required performance is five runs per route/profile on one frozen identity:
initial first-party JS at most 180 KiB Brotli; median LCP at most 2,500 ms (Contact 2,000 ms),
CLS at most 0.1 (Contact 0.05), TBT at most 200 ms, and FCP at most 1,800 ms. Existing
category/resource budgets also apply. A decisive failure may stop collection,
but uncollected routes remain unqualified and all failed samples are retained.

Browser validation includes static/enhanced samples, history/reset, unapplied
selection, focused/pressed links, delayed enhancement, invalid versions, form
recovery and no-JavaScript behavior. Check 320/390/768/1440 widths, keyboard/focus,
200% text, 400% reflow, reduced motion, failed media and reading order. Automated
checks cannot establish a human screen-reader review or physical-device approval.

## External gates that remain explicit

No approved delivery profile or named primary/backup operators and commercial
owner were supplied. No identities, credential claims, operator assignments or
commercial ownership have been inferred. The optional profile remains unpublished
and operational/commercial activation remains gated.

1. Reconcile the actual deployed SHA, schema, journal/checksums and service
   ownership. Rehearse migration, restore, retention and uncertainty recovery in
   isolated infrastructure. Hold all old and new sending paths during cutover.
2. Configure verified provider account/credential binding, callback signatures,
   a qualified CRM contract if enabled, direct alert delivery and independent
   scheduling. Name primary and backup operators; set the two operational
   thresholds. External missing-monitor-heartbeat supervision is mandatory.
3. Use synthetic staging inquiries, isolated services and designated recipients
   to demonstrate durable receipt, provider acceptance, recipient observation,
   human acknowledgement and adverse-event escalation separately.
4. Complete manual accessibility, physical-device and visual approval, plus the
   [formative six-person comprehension check](assessment-comprehension-check.md). At least five relevant evaluators
   must explain the offer, inputs, deliverables, paid-work boundary and next step
   within 60 seconds. Record raw responses and failures; do not infer this from
   automated text assertions.
5. Confirm a commercial owner and activate the existing private opportunity ledger
   under the [existing measurement protocol](validation-and-release.md). A
   qualified opportunity needs a named decision, bounded scope, decision owner
   and agreed next step. Keep deduplication, evidenced attribution and the
   existing 90-day paid-conversion cohort rules. Unknown follow-up remains unknown;
   no private opportunity data belongs in this public repository.
6. Publish the optional delivery profile only with approved text and private
   consent/credential evidence. A delivery lead is not automatically an author or
   independent reviewer. Existing unpublished-credentials wording changes with
   the approved profile, not in advance of it.

Promotion requires all applicable gates. Rollback must retain the sending
safeguards; a visual rollback must never restore an unsafe legacy worker.
