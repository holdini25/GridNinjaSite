# Enterprise release implementation and qualification

Status: implementation in progress. Public release is not qualified by this file.
The accepted plan authorizes implementation and progression toward production;
real outbound rehearsals require named, authorized staging recipients. Existing
RC13 evidence remains historical and cannot qualify new source or assets.

## Contracts and ownership

- Assessment records/selectors/publication bytes remain authoritative. The B-only
  minimum comparison is an ephemeral visitor assumption, never an assessment.
- One frame owner consumes transient reading holds. Saved motion preferences,
  graphics activation, camera/mechanical commands and story playback remain distinct.
- Delivery separates durable intake, provider acceptance, recipient mail-server
  delivery and explicit operator acknowledgement. No tracking pixels or read claim.
- Facility-v11 is staged outside public delivery and preserves earlier releases.
- Experience, contact operations and graphics have independent implementation
  owners; the integration lead owns CSP, CI, measurements and reconciliation.

## Security decision

Application CSP retains static Next output and therefore allows inline script/style
elements. It blocks inline handlers, eval, external resource origins except the
documented Turnstile script/frame origin, objects and arbitrary framing. This is
resource containment, not strict nonce-based XSS prevention or an ASVS certificate.
Frozen publications retain their stricter independent policy. The production browser
check demonstrated that Three.js fetches embedded images using local blob URLs;
`connect-src` therefore includes `blob:` as well as same-origin network access.
Blob script and worker execution remain disallowed. RC14 preserves the initial
failure; the repaired build receives a new candidate identity.

Start protected staging with `GRIDNINJA_CSP_MODE=report-only`; inspect real form,
navigation, analytics and graphics journeys, then build the final candidate with
`enforce` and rerun affected gates. `GRIDNINJA_HTTPS=1` is for an HTTPS proxy;
Vercel includes insecure-request upgrading automatically. Local HTTP intentionally
differs. Reports accept at most 16 KiB/20 entries, use distributed per-client and
global limits, and retain only bounded route/directive/resource categories. Never
store report URLs, fragments, queries, samples or source filenames.

Official references: [Next CSP](https://nextjs.org/docs/app/guides/content-security-policy),
[Turnstile CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/),
[OWASP ASVS](https://owasp.org/projects/asvs).

## Candidate and CI

Use Node22.23.2/npm10.9.8 and the existing lockfile. Record explicit
`FACILITY_ASSET_RELEASE`, `FACILITY_3D_MODE`, CSP mode, HTTPS policy, public
verification classification/digest and whether Vercel observability is included.
The source digest now covers deployment configuration and migrations. A local
build without production observability or live verification does not qualify the
production-configured performance gate.

`enterprise-qualification.yml` builds one artifact and reuses it on supported Linux
Chromium/Firefox/WebKit jobs. Retries are disabled and unexplained skips fail.
Linux software rendering is functional evidence only. Existing full browser,
integration, asset and performance jobs remain required. Actions are commit-pinned;
repository administrators must configure protected branches/environments and
independent approval for schema/publication/release changes.

## Operator requirements

The minute monitor must be registered independently of QStash, authenticated with
`CRON_SECRET`, and supplied a direct operator alert destination. Verify the hosting
plan supports the schedule. Cron failures do not automatically retry, and rollback
must reconcile schedules separately from application code.

The availability workflow issues only GET requests. GitHub's schedule is best
effort; it is not a precise uptime SLA or evidence of inquiry delivery. Configure
workflow-failure notifications plus the host's native error/usage alerts.

Internal objectives require named primary/backup owners and a measured rehearsal:
99.9% monthly site availability and eligible inquiry acceptance; 99% provider
acceptance within five minutes under normal operation; critical acknowledgement
and application rollback within30minutes; database RTO1hour/RPO5minutes. Confirm
the actual recovery plan/window before accepting those objectives. They are not
public contractual commitments.

Preserve additive schema compatibility on rollback. Restore only into a restricted
recovery branch; reconcile provider message IDs/idempotency state before enabling
workers, and reapply retention so restored records do not resurrect expired data.

## Required release evidence

One immutable candidate ledger must bind source/build/harness/settings to each
result, retaining failed and superseded attempts. Local readiness, production
configuration, human/device validation and public readiness remain distinct.

- Complete CPU/build/integrity tests, browser matrix, mechanics/lifecycle and CSP.
- Five fresh home/demo/assessment measurements per device profile, including
  full automatic transfer and actual production-only dependencies separately.
- Native Safari, compact/large phone and tablet Simulator checks on an unlocked Mac.
- Physical iPhone/Android/non-Apple GPU, sustained operation and independent
  VoiceOver/Windows screen-reader review.
- Two rounds of six representative visitors, with the approved task criteria.
- Authorized staging receipt→provider→recipient→operator proof, fault injection,
  restore/retention and poster-mode rollback rehearsal.
- Named operational/editorial/privacy owners, confirmed processors and retention.

No physical results, visitor observations, provider delivery or independent human
approval may be inferred from local automated tests. Public no-go persists until
all required evidence is passing and independently reviewed.
