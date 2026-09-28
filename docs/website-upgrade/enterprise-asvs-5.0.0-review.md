# Enterprise security review — OWASP ASVS 5.0.0

Review date: 24 September 2026. Reviewer: `enterprise_experience`, independent of
the operations and CSP implementations. This is a scoped engineering checklist,
not certification, a penetration test, or a claim of an ASVS assurance level.

## Standard and evidence provenance

Requirement identifiers were checked against OWASP's tagged
[ASVS 5.0.0 machine-readable release](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.flat.json),
retrieved on the review date. That file contains 345 requirements; its SHA-256 is
`8201b20eec2908c3380ac600c91c8ba746346fbb808859366abb232027532311`.
The short labels below are indexing aids; the linked standard remains authoritative.
No identifiers from another ASVS version are substituted.

This review covers application source, the current lockfile and retained RC13
dependency evidence. It does **not** combine old successful tests with the next
candidate. Final test execution must be bound to the candidate ledger and its
source/build/settings/harness identity. Follow
[the functional protocol](enterprise-functional-checks.md) and
[candidate runbook](qa-candidate-runbook.md).

Status meanings:

- **Pass — source:** the named source control was inspected and supports this
  specific check. Final execution or deployment evidence is still separately required.
- **Not run:** implementation/tests are identifiable, but this review did not execute
  the required final-candidate test.
- **Blocked:** needs actual hosting, credentials, operational ownership or an
  independent environment not available to this local review.
- **Fail / exception:** a stated requirement is not met by the current design.
  Record owner, rationale, expiration and compensating controls before acceptance.
- **Not applicable:** no such feature is present; reconsider when scope changes.

## Applicable checklist

All paths below are relative to the repository root. A referenced test is an
executable check to rerun, not a claim that it passed for this candidate.

| ASVS ID / indexing label | Applicability | Source evidence and inspection result | Qualification status / required next evidence |
| --- | --- | --- | --- |
| V1.1.2, V1.2.1 — Output encoding | Public pages, notifications | React renders ordinary text; `src/lib/contact/delivery-core.ts` HTML-escapes inquiry fields. No form content becomes an HTML template. | **Pass — source**; rerun delivery-core and hostile-text form checks. |
| V1.2.2 — URL encoding | Focus/topic/publications | Typed allowlists in `src/lib/public-topic.ts`, `src/lib/marketing-journeys.ts`, facility navigation and assessment URL readers; `URLSearchParams` builds query context. | **Pass — source**; final invalid/duplicate identity and modified-click journeys **not run** here. |
| V1.2.3 — Script encoding | Two HTML injection boundaries | JSON-LD serializer and constant header bootstrap reviewed below. | **Pass — source**; retain serializer regression and final CSP browser checks. |
| V1.2.4 — Database queries | Intake/outbox/monitor | Drizzle builders and tagged `sql` parameter interpolation; new `delivery-query.ts` binds IDs, payloads and times rather than concatenating SQL. | **Pass — source**; exact-query PostgreSQL regression evidence must join final ledger. |
| V1.2.5 — Command execution | Authoring/QA only | Application request handlers do not spawn commands. Local scripts use controlled tool arguments; they are not web endpoints. | **Not applicable** to public request handling; CI inputs and local scripts remain a separate trust boundary. |
| V1.3.2, V1.3.7 — Dynamic execution | Browser/server code | No application `eval`, `new Function`, or user-supplied template execution found. Redis `eval` uses a constant lock-release script with separate key/token arguments. | **Pass — source**; do not mistake Redis's API name for JavaScript evaluation of a visitor string. |
| V1.3.6, V13.2.4 — Outbound destinations | Email, queue, verification, CRM, alerts | Resend and Turnstile endpoints are constants; queue URLs use configured site origin. CRM/alert destinations are privileged deployment configuration, not inquiry fields. | **Pass — source** for visitor-controlled SSRF exclusion; approved host inventory and egress restrictions **blocked**. Redirect containment is resolved under V15.3.2 below. |
| V2.1.1, V2.2.1, V2.2.2 — Input rules | Public intake and internal APIs | `src/lib/validators.ts`; server validation before acceptance; bounded raw body; strict internal action schemas. Client validation is usability only. | **Pass — source**; contact-route/body/signature boundary suites **not run** by this review. |
| V2.2.3 — Context validation | Assessment/inquiry identities | Assessment invariants and atomic history/enhancement; publication digest/basis binds the B-only hypothetical overlay. It cannot produce an assessment record. | **Pass — source**; all A–D/history/perspective and stale-comparison tests required. |
| V2.3.3, V15.4.2, V15.4.3 — Atomicity | Receipt/outbox/retention | Durable lead plus outbox transaction, unique idempotency key, guarded lease mutations. Reviewed repair locks eligible lead before outbox; one retention candidate set clears payloads and active leases. | **Pass — source** after independent review of repairs. Ops reported 13 disposable-PostgreSQL checks; final ledger must reference their exact evidence. |
| V2.4.1 — Abuse limits | Intake/report endpoints | Contact IP/email/pair limits, Turnstile, honeypot; CSP per-IP/global limits; timeout results fail closed. | **Pass — source**; deployment quota and distributed behavior **blocked**. |
| V3.2.1, V4.1.1 — Response context | APIs/downloads | Typed JSON responses, exact publication MIME/attachment names, `nosniff`, script-free frozen publication policy. | **Pass — source**; route header/browser assertions **not run** here. |
| V3.2.2 — Safe DOM text | Header and inspection | Header enhancement changes attributes, focus and native disclosures; it does not turn location/query data into HTML. Facility labels remain React/HTML text. | **Pass — source**. |
| V3.4.1, V12.1.1, V12.2.1, V12.2.2 — HTTPS | Deployment boundary | Local HTTP is intentionally insufficient. Hosting must establish TLS versions/certificates and HSTS on successes and errors. | **Blocked**; inspect actual production host, subdomains and redirect behavior. |
| V3.4.2, V3.5.1 — Cross-origin requests | Intake/operations | Exact Origin allowlist for intake; strict JSON path; service routes use signatures or a separate bearer credential, not browser cookies. | **Pass — source**; real proxy/CORS/preflight checks **blocked**. |
| V3.4.3, V3.4.6, V3.4.7 — CSP | Public HTML | Global resource containment, no objects/base/framing/inline handlers/eval; bounded report sink. Frozen publication routes explicitly keep their stronger CSP. | **Fail / exception E1** for inline script elements; final enforced/report-only staging behavior **not run**. |
| V3.4.4, V3.4.5, V3.4.8 — Browser headers | All route responses | `next.config.ts`: `nosniff`, strict-origin referrer policy, COOP same-origin. | **Pass — source**; check errors/downloads/redirects on deployment. |
| V3.6.1 — External scripts | Turnstile | Dynamic Turnstile script and frames are restricted to the exact Cloudflare origin; no SRI hash is pinned to its changing loader. | **Fail / exception E2**; production loader behavior must be reviewed and tested. |
| V4.1.3, V15.3.4 — Proxy identity | Rate limiting | `getTrustedClientIp` requires `x-vercel-forwarded-for` in production; generic forwarding headers are development-only fallbacks. | **Blocked**: prove the deployed proxy overwrites attacker-supplied values; code alone cannot establish this trust. |
| V5.3.2, V5.4.1, V5.4.2 — File paths | Publications/GLBs/posters | Registry plus schema allowlists precede path construction; manifests pin file sizes/hashes. Download names contain validated publication/version/format values. | **Pass — source**; traversal, withheld, corruption and packaged-source checks required on final artifact. |
| V8.2.1, V8.3.1 — Service authorization | Internal delivery/monitor/review | QStash signature wrapper, separate CRON/operations bearer checks, signed Resend webhook. No public inquiry-read endpoint. | **Pass — source**; real key rotation and least-privilege deployment evidence **blocked**. |
| V9.1.1, V9.1.3, V9.2.1 — Queue tokens | QStash | SDK Receiver receives configured current/next keys, exact body and canonical URL. Caller-supplied key URLs are not accepted. | **Not run**: mocked wrapper tests do not establish real issuer/expiry/rotation behavior; staging must exercise it. |
| V11.2.1, V11.4.1 — Cryptography | Signatures/pseudonyms/hashes | Node crypto HMAC/SHA-256/timingSafeEqual; Web Crypto fingerprints; no bespoke cryptographic primitive. | **Pass — source**; secrets entropy, scope, custody and rotation **blocked**. |
| V13.1.1, V13.1.3 — Service inventory | Operational dependencies | `enterprise-contact-operations.md`, queue/provider/monitor implementation document timeouts, independent alerts and bounded retries. Graphics and calibration have separate bounded ownership. | **Not run**: complete hosting connection/quota inventory and failure rehearsal required. |
| V13.2.1, V13.3.4 — Service credentials | Third-party integrations | Current APIs use deployment API keys/shared secrets; webhook and queue support rotation inputs. | **Fail / exception E3**: long-lived credentials do not meet the stronger short-lived-service-identity requirement. Owner rotation/access evidence required. |
| V13.3.1, V13.3.2 — Secret custody | Build/deployment | Source reads secrets from server environment; no client-prefixed provider credentials. Prior redacted scans are retained separately. | **Blocked**: deployment vault permissions, expiration and independent current secret scan. |
| V13.4.1, V13.4.2, V13.4.5 — Production exposure | Hosting/artifacts | Candidate/Blender source excluded from tracing; public assets allowlisted; internal monitor requires authorization; diagnostics opt in through a local page flag. | **Pass — source** for intended exposure; deployed `.git`, debug, source-map, directory and internal-route probes **not run**. |
| V14.2.1, V14.2.3 — Data destinations | Inquiries/telemetry | Inquiry body uses POST. URLs contain allowlisted public context only. Analytics properties/routes are allowlisted; hypothetical values never enter them. | **Pass — source**; actual production vendor traffic/privacy-owner signoff **blocked**. |
| V14.2.4, V14.2.7 — Retention | Leads/snapshots/events | 180-day redaction includes frozen provider payload; 365-day deletion cascades matched events; unmatched callbacks expire after seven days; retention heartbeat monitored. | **Pass — source** after race repair; restored-backup retention and provider-side retention **blocked**. |
| V14.3.2, V14.3.3 — Browser data | Receipts/recovery | Intake responses use no-store. Tab storage contains bounded IDs, approved context and a one-way fingerprint, not contact fields/tokens; 24-hour protocol expiry. | **Pass — source** for content exclusion; privacy classification of linkable IDs/fingerprint must be approved. Expiration rejects use; it is not a remote erasure guarantee. |
| V15.1.1, V15.1.2, V15.2.1 — Dependencies | Runtime/build tools | npm lockfile, SBOM job and retained reachability triage below. | **Fail / exception E4**: final RC21 production audit reports zero findings; the full audit retains six propagated development entries representing two unpatched extract-zip advisories after three scoped override fixes. A named owner, finite review date and independent acceptance remain **blocked**. Earlier RC14/RC20 counts are historical; see the final evidence below. |
| V15.2.2 — Availability | Expensive operations | Async outbox, limited queue batches, provider timeout, capped graphics/staging, bounded body sizes and calibration workers. | **Pass — source** for listed controls; request concurrency/host limits and load evidence **blocked**. |
| V15.3.1, V15.3.3 — Field exposure | Public/internal JSON | Explicit receipt fields and schema-based action inputs; public APIs never return inquiry objects. CSP diagnostics retain bounded categories. | **Pass — source**; response/log redaction regression required. |
| V15.3.2 — Redirects | Backend fetch | Resend, CRM, operator-alert and Turnstile requests explicitly set `redirect: "error"`. No visitor-supplied destination was found. `tests/unit/contact/outbound-redirects.test.ts` exercises actual loopback HTTP 307 responses for all four paths; the redirect destination receives zero requests and the CRM signature remains on the original request. | **Pass — source and focused local tests**; E5 resolved. The fetch policy rejects redirects rather than maintaining a second destination allowlist. Operator-owned endpoint inventory remains a deployment gate. |
| V16.1.1, V16.4.2, V16.4.3 — Log operations | Hosting/operators | Structured app events and independent monitor exist; application code cannot prove log ACLs, integrity, retention or independent storage. | **Blocked** pending named operator and deployment evidence. |
| V16.2.5, V16.4.1, V16.5.1 — Redaction/errors | API/log boundaries | JSON encoding; generic public failures; fixed error codes; CSP query/sample/referrer exclusion; no provider response body retained. | **Pass — source**; rerun hostile provider/log inputs and inspect production configuration. |
| V16.5.2, V16.5.3 — Failure behavior | Verification/queue/graphics | Verification/rate limits fail closed; acceptance follows persistence; wake failure retains durable work; scene staging keeps current usable view. | **Pass — source**; authorized outage/recovery rehearsal **blocked**. |

## Explicit exclusions

There is no public account/password/MFA recovery flow, browser authentication
session, OAuth/OIDC integration, GraphQL endpoint, WebSocket or WebRTC service,
public upload endpoint, XML processor, LDAP/JNDI integration, or user-authored
template editor in this release. Requirements for those absent features are
**not applicable**, rather than implicitly passed. In particular, absence of user
accounts does not exclude the service authorization, queue-token or secret-custody
checks above. Public GLB/publication delivery remains in scope despite no uploads.
No customer portal or authentication platform is added to satisfy unrelated rows.

## Intentional HTML and execution boundaries

### JSON-LD

`src/components/seo/json-ld.tsx` invokes the only JSON serialization-to-script sink.
`serializeJsonLd` in `src/seo/schema.ts` applies `JSON.stringify` and escapes `<`,
`>`, `&`, U+2028 and U+2029 before the value enters `dangerouslySetInnerHTML`.
The reviewed test in `tests/unit/seo/schema.test.ts` includes `</script>` followed
by another script and verifies both safe serialization and round-trip data.
The component uses `type="application/ld+json"`; changing callers cannot bypass
the serializer through its public `data` prop. No additional HTML string sink was
found in application source during the search.

### Native header bootstrap

`src/components/layout/site-header.tsx` embeds a source-controlled constant. The
template contains no `${...}` interpolation of request, CMS, URL, navigation or
form values. `location.pathname` is only compared with authored links; it is not
rendered as HTML or executed. Dynamic import targets the fixed same-origin
`/header-controls.mjs`. That module manipulates attributes/focus/native controls;
it does not use HTML string sinks. Modified-click handling and native fallback
remain available independently of the enhancement. Future interpolation must
trigger a fresh security review, not inherit this conclusion.

The constant inline bootstrap and Next's inline output explain E1, but do not
make arbitrary inline code safe. `script-src-attr 'none'` prevents inline event
attributes, while permitted script elements remain a real residual XSS surface.
Strict nonce/hash deployment would need a separately measured rendering design.

## Exceptions and ownership requirements

| Exception | Existing containment | Required disposition before public approval |
| --- | --- | --- |
| E1: inline script/style elements | Contextual serialization, constant bootstrap, no eval/handlers, limited resource origins, no framing/objects/base changes | Security/release owner must accept the static-rendering tradeoff, review report-only staging, verify enforced production behavior and schedule reconsideration. It is not strict XSS prevention. |
| E2: dynamic external verifier | Exact Cloudflare origin, server-side verification, form recovery | Approve this specific dependency; record its processor/availability role and test blocked/failed script behavior. |
| E3: service credentials | Server-only environment, separate operation secrets, signature checks and rotation inputs | Name owners; document entropy, least privileges, access review, emergency rotation and intended lifetime. Hosting controls are not proven by environment-variable presence. |
| E4: vulnerable development chains | Local-only controlled inputs, no public tooling server, isolated jobs without production credentials | Inventory exact advisories and owners, set risk-based remediation deadlines, and either qualify compatible updates or approve bounded exceptions. A clean runtime audit does not clear this row. |
| E5: backend redirects — resolved | Explicit Fetch `redirect: "error"` on provider, CRM, alert and verification requests | Four real loopback HTTP 307 regressions pass, with zero requests to redirected destinations. The original deficiency is closed; no redirect exception is requested. Deployed endpoint ownership remains subject to the outbound inventory review. |

No exception has been independently approved merely by inclusion in this document.

## Dependency reachability: retained evidence, not fresh qualification

The retained `build/qa/production-audit-remediated.json` reports **zero production
advisories**. `build/qa/rc-13/all-dependency-audit.json` reports **14 development
entries: seven high, five moderate, two low**. These are package-entry counts,
not fourteen independent exploits. The RC13 report records six advisories across
four leaf packages. Those bytes were inspected; this review did not contact npm
or rerun an audit against the emerging candidate.

Fresh RC14 dependency evidence is recorded in `build/qa/enterprise-rc14/dependency-evidence.json`, bound to source `27f8b26a0401b35872fd9c708c9b837e5c08b5c7ed4696b3eebd8ef8489cc4c8` and Node 22.23.2. The production-only audit reports **zero findings**. The full audit retains **14 package entries: seven high, five moderate, two low**, representing six advisories across esbuild, extract-zip, tmp and uuid. `all-dependency-audit.json` preserves the nonzero audit exit; `production-sbom.json` contains 131 CycloneDX components. These new dependency artifacts do not qualify unrelated checks from a run whose harness changed. E4 remains open until an owner approves a bounded disposition or remediation.

`docs/website-upgrade/qa-security-review.md` and
`build/qa/dependency-triage-remediated.json` retain the specific advisories,
installed versions, affected chains and earlier failed/remediated attempts.

- **Runtime:** Next/React, Three/R3F and contact SDKs participate in public request
  or browser execution. The runtime audit is a useful input, but cannot establish
  safe configuration, private-data boundaries or absence of undisclosed defects.
- **LHCI/Lighthouse:** the remaining downloader/archive/temp/prompt chain is used
  by development/performance tooling. Recorded measurements use installed Chrome
  and a fixed localhost target; they do not extract visitor-supplied browser
  archives. Installer/CLI paths still exist and remain security-relevant.
- **Drizzle Kit/esbuild:** migration tooling includes the legacy loader chain.
  Disposable PostgreSQL tests do not start its development server. Keep that
  server unexposed and qualify a compatible update separately.
- **CI:** use npm ci, pinned actions and read-only default permissions; verify
  deployment environment protection independently. Do not provide production
  secrets to untrusted pull-request jobs or mistake an artifact upload for
  independent release approval.

Do not run forced major downgrades solely to clear a scanner. Produce a fresh
runtime audit, full audit, SBOM, dependency reachability disposition and redacted
secret scan for the final candidate. A reviewer must explicitly accept remaining
development risk, with a finite remediation date.

## Independent findings and closure

1. A worker could previously restore a frozen inquiry payload after retention.
   The operations author added lead eligibility locking, lease invalidation and
   shared atomic retention candidates. Independent source review confirms that
   the reported claim → retention → begin sequence is now rejected. The author
   reports direct PostgreSQL interleaving tests, including a blocked concurrent
   attempt; retain their exact report in the final candidate.
2. Removing optional CRM configuration could previously throw before durable
   failure handling. A typed preparation error now records a terminal
   configuration state before best-effort alerting. Independent source review
   confirms the failure no longer remains an endlessly claimed request.
3. The global CSP could override the stricter frozen-publication CSP. Explicit
   later publication-route policies are now present in `next.config.ts`; final
   browser response evidence is still required.

No new high-severity injection finding was identified in the two intentional HTML
boundaries. That limited result does not close the blocked deployment checks,
documented exceptions, production-configured browser tests or operational rehearsal.


## Subsequent dependency remediation — RC21 preparation

Three scoped development overrides were independently reviewed and installed with normal npm lifecycle scripts: tmp 0.2.7, LHCI uuid 11.1.1, and legacy-loader esbuild 0.25.12. All 175 non-development lock entries remain unchanged. Integrated API, Drizzle schema, LHCI configuration and dependency-tree checks pass; evidence is in `build/qa/enterprise-rc21/dependency-integration/summary.json`. This is prequalification, not a final candidate pass.

The full audit now reports six propagated development entries representing two unpatched extract-zip advisories. The public application excludes this dependency chain. Current measurement jobs launch installed Chrome and do not extract Puppeteer browser archives, but that installation path remains executable. E4 remains open: controlled browser provisioning, no arbitrary archives/mirrors, and no production credentials bound the present use; a named owner, finite review date and independent exception acceptance are still required. The earlier RC14/RC20 counts above remain historical evidence.

### Final RC21 local evidence — 25 September 2026

Fresh collection in `build/qa/enterprise-rc21/security-collection.json` binds build
`elogEvaz9SZIpTDoCfNkV`, source `22b04fd1226dced5d2b5471a7fcf5b393e90aa8edaf26b67fbb1f63e9e26ecbd`,
harness `2d238fa13c5c50b5a950eea0cdc7b6a92917e648bdd9e33ecfe3f1d3c23eb275`,
and the integrated lockfile. Production audit remains zero; the full audit
preserves its nonzero exit and six high development entries / two extract-zip
advisories. Current-source and retained-history secret scans each report only the
same reviewed synthetic unit-test fixture, with all values redacted. This scoped
scan does not establish absence of every credential or remote deployment exposure.

The final local suite passes 825 unit tests and 13 isolated PostgreSQL tests, plus
brand, lint, typecheck and production audit. These checks confirm local regressions;
they do not complete live delivery, credential custody, hosting, physical-device,
independent accessibility or exception-owner obligations. The separate structured
`security-evidence.json` remains **review-required**. No ASVS certification or
blanket security approval is claimed.

## Premium candidate dependency disposition — 25 September 2026

This section supersedes the **current-state** E4 advisory disposition above for
package-lock SHA-256
`d6ecce3a1106ff4263d6ea7d0bd5e9adc263caf811a357b08f7a88a8b2b005ed`.
The RC21 findings and failed attempts remain historical evidence; they are not
removed or reclassified as having passed at the time.

The scoped `puppeteer-core@24.43.1` override now selects
`@puppeteer/browsers@3.2.3`, removing the vulnerable extract-zip dependency chain.
Saved full and production audits both report **zero vulnerabilities**. The 151
preexisting production lock entries, Lighthouse 12.6.1, LHCI 0.15.1, Puppeteer-core
24.43.1 and the measurement method remain unchanged. E4 is therefore **remediated
locally for this lockfile**, rather than a current unresolved extract-zip
exception. Audits are point-in-time evidence, not a security certification.

Evidence is in `build/qa/premium-release-01/security-browser-override/`:

- `review.md`, `lock-diff.json`, `audit-all.json`, `audit-production.json`.
- `cpu-api.json`: consumed ESM/CommonJS API compatibility.
- `browser-smoke.json`: actual M5 Pro/Metal Chrome launch, Puppeteer connection,
  Lighthouse API and LHCI NodeRunner compatibility.

The cross-major transitive override requires the qualified Node 22.23.2 runtime
(the new browser utility requires at least Node 22.12). Controlled browser
provisioning and keeping production secrets out of untrusted tooling jobs remain
required. Reassess the override when an upstream compatible dependency becomes
available. The compatibility smoke does not establish the five-run performance
or production-configuration gates.

`software-checks-attempt04/summary.json` records 841 unit tests, 13 isolated
database tests, brand, lint, types and a clean production audit for source
`49b30e917067602434c69c1a295f908a73265b631672fafa1ab7a275f4699f37`
and harness `9db1e51961bb02a76a62de4bf153fe5c820f57a464ab9640e83b344e4038c76f`.
Subsequent visual-runtime edits require a fresh final source/build qualification;
these results must not be relabeled as a pass for the future v11 artifact.

E1 (inline Next output), E2 (dynamic verification loader), E3 (long-lived service
credentials), actual production HTTPS/CSP/telemetry behavior, hosted signature and
secret-custody controls, and recovery/retention operations remain subject to their
explicit review and deployment gates. This dependency correction closes none of
those obligations and grants no release approval.
