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
`gridninja-6k04milzg-holdini25s-projects.vercel.app`, Git `bbeb94bd`. Before promotion,
recheck alias/deployment identity and retain this unchanged-backend version as the
rollback target. No migration is part of this release.

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
