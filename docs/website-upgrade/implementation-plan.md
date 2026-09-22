# GridNinja assessment-first website implementation

Status: implemented locally; release approval and external validation remain pending. Prepared 22 September 2026. This document owns scope and architecture; [backlog](backlog.md) owns delivery/traceability and [validation](validation-and-release.md) owns evidence and release gates.

## Authority and evidence

The latest instruction, “implement plan,” authorizes application changes after the earlier planning-only request. The supplied website specification is the approved baseline. `GridNinja-Website-Upgrade-Implementation-Spec.md` and `Spec1.md` were byte-identical (SHA-256 `54f98b1caefffeb4616eacd45c9b03275d8bc0b97133717a68d9bad57691d5dc`); the user confirmed the version label was not incremented. The companion 27-page PDF was read, including the scenario matrix. The provided material contains O01–O09, B01–B16 and T01–T22. E01–E08, B17–B18 and T23–T32 were not present; their definitions are not invented here. Supplemental X/V identifiers are explicitly local additions.

`GridNinja-Strategic-Wargames-and-Category-Leadership.pdf` was not available. Strategy-dependent claims and credential approval remain conditional. Older AGENTS category language remains useful for future research context, but the specifically approved present offer takes precedence: one bounded, paid capacity decision assessment using authorized historical inputs. There is no basis for invented team credentials, customers, partners, price, duration, production authority or conversion effects.

## Repository baseline and reuse

Baseline main commit: `ad0dfa5`. Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5.9.3, Tailwind 4.2.2, Zod 4.3.6, npm lockfile, Node 22. Motion, ECharts and D3 already existed; assessment graphics use HTML/CSS and an accessible table without additional dependencies. Existing shadcn primitives, charcoal/amber identity, server page system, SEO manifests, Vitest, Playwright, axe and Lighthouse are reused.

The contact service already durably stores a lead and outbox entry in Neon, with QStash delivery, Resend and optional CRM. It is reused without a database migration. Provider delivery cannot be verified without staging configuration. Existing dispatch-envelope modeling remains a separate synthetic teaching artifact; its operational-looking `accepted` DTO does not supply assessment quantities.

Prior browser inspection reproduced O01/O02 contradictions: independently controlled status and waterfall output, and a direct thank-you visit suggesting receipt. The old homepage had 17 sections. Publication-gated release artifacts were accessible under `public/evidence/releases/v1.0.0`; they have been relocated outside public output, with explicit 410 responses at the prior release path.

## One coherent buying journey

Primary action: **Scope an assessment** → `/assessment`, then `/assessment#scope`. Secondary: **See a sample decision brief** → `/demo#decision-brief`. `/contact` remains usable; `/roi` redirects in one hop to `/assessment`. Evidence explains maturity, method explains the process, the sample demonstrates a decision, and platform describes conditional longer-term development.

| Homepage section | Buyer task and visual | Evidence and destination | Acceptance |
| --- | --- | --- | --- |
| Hero | Recognize the capacity commitment decision; compact headline and two actions | Current bounded offer; `/assessment`, `/demo#decision-brief` | Exact headline hypothesis; no recovery/revenue promise |
| Decision fit | Identify an AI workload or colocation commitment in two cards; cooling and bridge-power investigation links follow | Questions, not promised outcomes | Executive can identify a relevant decision |
| Worked brief | Understand B's 7.0 request versus 5.8 modeled increment | Synthetic record; sample + frozen brief | Scope, conditions and commercial question adjacent |
| Deliverables | See decision brief, assumptions, evidence gaps and review record | Delivery scope to agree before paid work | Useful negative and inconclusive outcomes included |
| Inputs and governance | Understand buyer effort and responsibilities | Authorized historical inputs, boundary, window, decision owner | No credentials or raw operational uploads in inquiry |
| People/development | Understand delivery maturity | Only verified facts; About | No fabricated credential; credibility gate pending |
| Invitation | Take a low-friction scoping step | Assessment form and data handling | Scoping distinct from paid agreement |

The assessment page explains the decision, deliverables, prerequisites, roles, exclusions, review/acceptance and next step. Report acceptance, commercial usefulness, operational acceptance and equipment authority are distinct decisions. Initial discussion establishes fit; it is not purchase or assessment completion.

## Assessment data and publication contract

`src/types/assessment.ts`, `src/schemas/assessment.schema.ts`, `src/content/assessments/fixtures.ts`, and `src/lib/assessment/{invariants,selectors,format}.ts` own semantics. All quantities are integer kW, displayed in MW, additional to a steady 20 MW reference at the fictional DEMO-01 meter in the UTC hour 2026-09-22 00:00–01:00. Comparisons require identical basis. Missingness is a tagged known/unknown/not-applicable union; zero is a known value.

| Fixture | Nominal | Modeled | Request | Revision/minimum | Screen |
| --- | ---: | ---: | ---: | --- | --- |
| A | 12.0 | 5.8 | 5.0 | unchanged | ALLOW |
| B, default | 12.0 | 5.8 | 7.0 | distinct 5.8 profile; no minimum supplied | REPAIR |
| C | 12.0 | 5.8 | 7.0 | 6.5 minimum blocks admissible revision | REJECT |
| D | 12.0 | Unknown | 5.0 | missing cooling evidence; no revision | NO-PROOF |

Every record is synthetic, economics unestimated, operationally accepted/delivered and customer report acceptance not applicable, authority none. B asks whether a reduced profile still meets service and commercial requirements; it never borrows C's minimum. Phasing, rescheduling, cooling investment and bridge power are **unassessed investigation options**, not evaluated alternatives.

One selection owns scenario/version/perspective. Pure selectors supply summary, chart, table, evidence and export links. Native selects provide keyboard semantics; changes announce a concise result; reset restores B/business and closes disclosure state. Browser back/forward restores explicit selection. Invalid versions fail visibly; no silent default substitution. Authored records are schema- and invariant-validated on the server before reaching the client selector; selection is synchronous and never fetches model data, so no remote response race exists. A–D remain available as server-rendered links without JavaScript.

Frozen artifacts live in `src/content/assessment-publications/<id>/v<version>/`: snapshot, narrative, HTML, PDF and integrity manifest. An explicit registry resolves a unique publication ID/version and pins its manifest digest. Every available artifact is integrity-checked before any format is served; hashes establish byte identity, not model validity or permission. HTML is the exact PDF input; neither old URL nor downloads render through a new template. Generation refuses to overwrite an existing version. Changes after first publication require a new version, preserved old bytes, reviewed registry update, and optional explicit withdrawal. Unknown or withheld IDs/versions and unrecognized formats return 404; withdrawn registry entries and prior gated release URLs return 410. Missing or corrupt registered artifacts return a generic 503 without substituting another version. Only available registered artifacts are included in deployment traces; the postbuild guard excludes candidates and unlisted publication files. No candidates live under `public/`.

## Inquiry reliability and privacy

The shared form uses persistent labels and requires name, work email and company; conversation type defaults to Capacity assessment and supplies a validated intent. Optional v2 message is blank→undefined→null, or 12–2000 characters if supplied. Legacy v1 input remains supported. The server's durable idempotent transaction remains authoritative. Success requires either 202/queued or 200/already_received, plus a valid receipt UUID. Timeout is uncertain, not failed: retain the original normalized business payload and submission ID for retry, while allowing Turnstile verification to refresh after expiry or rejection. A new inquiry is an explicit action. Validation/provider errors preserve input. No JavaScript means no unsafe native submit; essential instructions remain visible.

Tab storage holds the submission ID, one-way payload digest, validated intent/source, recovery timestamps and receipt metadata; it never holds contact fields or Turnstile tokens. The original payload remains only in page memory. After reload, a retry requires re-entering the original details and matching the stored digest. Recovery expires after 24 hours; expiry does not prove nonreceipt, and starting another inquiry can create a duplicate. A storage error cannot erase an inline confirmed receipt. Direct `/contact/thanks` is neutral without a valid recent receipt. No response-time or email fallback is invented. Production provider/delivery and an approved fallback channel remain release gates.

## Measurement and claim governance

Primary outcome: qualified **website-sourced assessment opportunities**, distinct from inquiry count and website-assisted/other-known/unknown sources. A private commercial owner must confirm all four facts: named decision, bounded scope, decision owner, agreed next step. One opportunity can contain many contacts/inquiries; merge explicitly and retain earliest qualification. Use a private ledger or existing CRM, not the public site; never upload it to repository or analytics.

Downstream paid conversion uses an executed, non-voided paid assessment agreement at or before each opportunity's own qualification timestamp + 90 UTC days. Monthly cohort rates wait for all endpoints and complete outcome coverage. Unknown follow-up stays in the denominator and prevents a point rate; empty denominator is null. Late conversion is reported separately. Source is evidence-backed, never inferred from executive-like browsing. `src/lib/measurement/opportunity-cohorts.ts` validates these rules. Weekly qualification review and monthly mature-cohort review require a named commercial owner before activation.

General telemetry uses exact enum properties; arbitrary strings, PII, CRM IDs and arbitrary URL queries/fragments are discarded. Both Vercel providers scrub URLs. Optional sample-to-inquiry or completion ratios are not implemented: 30-minute same-tab continuity, deduplication and coverage require a separately approved implementation. Event counts alone must not be used to infer those ratios. Durable receipt events are not equivalent to email delivery or qualification. The private cohort utility and reporting rules are implemented, but commercial review, a reconciled private ledger, baseline collection and formative buyer research remain operational work. There is no baseline and no numerical uplift target.

The claim registry owns evidence, caveats, surfaces and review state. Unsupported candidates are withheld; synthetic examples are visibly labeled. A release reviewer must review ordinary executive copy and frozen publications alongside machine-checked claims. Source review dates must describe actual review, not assumed validation.

## Delivery boundaries

Release A is the smallest complete journey: truthful home/assessment, static B sample and brief, reliable inquiry, route/claim cleanup and essential checks. Release B adds synchronized four-scenario exploration, perspectives, exact exports, supporting content and measurement safeguards. A/B software is implemented together locally; buyer research, named delivery and commercial owners, credential/content approval, operational measurement and provider validation remain pending. Neither release bypasses those external gates. Release C defers measured customer cases, validated economics/ROI, portals/auth, live connections and autonomous controls.

First implementation dependency was validated domain semantics and offer boundaries; both were sufficiently specified. Critical path: approved meaning → fixture/schema → brief + homepage/assessment → receipt reliability → integrated validation → external review → release. Content/credential approval and provider access are external waits, not engineering hours. Reuse-based forecast remains A 128–203 focused hours and B 78–128, total 206–331 (engineering 127–202; content/review 79–129). These are planning ranges, not a claim of hours spent or work completed; see backlog for allocations. At 75% availability, divide each role's hours by its staffed daily capacity independently; do not add parallel role calendars.

Implementation review also identified a pre-existing dependency audit failure and an undercounted first-load script budget. Targeted dependency patches, explicit framework-chunk accounting, disabled speculative prefetch and server/lazy validation boundaries are part of B15 quality work. Final versions and measured results are recorded in the validation document; the baseline above remains historical.
