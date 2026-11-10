# Environment-specific website qualification

This contract separates an intentionally protected candidate from the public
website. It does not waive performance, accessibility, Best Practices, transfer,
runtime, source-identity or complete-matrix gates. Raw reports and prior failed
runs remain evidence. In particular, the incomplete `108f4f5` hosted run, its
Contact interstitial, two null diagnostic placeholders and failed after-serving
receipt remain failed; the transport cause is unknown.

## Evidence and outcomes

Set `FACILITY_QUALIFICATION_ENVIRONMENT` before collection. The default is
`local`, restricted to a canonical loopback origin. Both hosted environments
require actual producer attestation and the independently computed source,
harness and build/configuration pins. Their builds require HTTPS, observability,
enforced CSP, live verification configuration and no private-candidate identity.
These settings alone do not establish successful live widget operation.

The environment is recorded in capture provenance, collection index, page and
full-scroll observations, and summary. Missing or mixed environments fail;
changing a summarizer flag cannot relabel historical evidence. Fresh directories
are required, and the fixed page-measurement output must be preserved before
another collection. Local/CI evidence remains separate from hosted acceptance.

| Environment | Additional checks | Successful summary | Public acceptance |
| --- | --- | --- | --- |
| `local` | Existing local build and software/hardware scope checks | `pass` | Pending |
| `protected-staging` | Exact immutable Vercel origin; complete before/after serving; positive noindex on measured documents and serving HTML; all other applicable weighted SEO audits pass | `protected-pass` | Pending |
| `public-production` | Exact `https://gridninja.ai`; no preview authentication; authoritative target/alias receipts; producer-bound document and resource proof; public canonical, robots, sitemap and manifest checks; unchanged public SEO floor | `public-pass` | Pass only when the complete contract passes |

The Lighthouse index's `result: pass` means collection completed, not release
approval. Priority collections remain diagnostic and incomplete. Hosted
acceptance requires the full 14-route matrix: 140 Lighthouse captures, 140
full-scroll observations and 20 readiness observations, with the required
hardware scope. Founders is included. Physical mobile validation remains
separate from browser device emulation.

Protected SEO retains the raw score and its failure against the public floor of
100. Its alternate crawlability check is narrowly pinned to Lighthouse 12.6.1:
the actual main response must prove noindex, crawlability must report blocking,
and every other applicable weighted audit must pass. Complete audit references
and legitimate Lighthouse not-applicable states are validated. The published
assessment brief retains its existing SEO exception. Best Practices 93 and real
CSP-report 503s remain failures; no CSP, protection or service change is implied.

## Public identity and cutover

Public collection keeps the original immutable attestation unchanged. A separate
pins file binds its build, source, harness, settings and release manifests to the
production deployment and Git commit. The GET-only Vercel adapter uses pinned CLI
64.0.2 and exactly four metadata endpoints for the fixed production project:
project/current target, pinned deployment, apex alias and www alias. It never
reads credential values or changes provider configuration. Fresh receipts must
bracket both serving verification and the measured collection. Each actual
captured document also proves its build; mutable apex identity is not inferred
from before/after aliases alone.

Use `FACILITY_PUBLIC_PRODUCTION_PINS_FILE` for these independent pins. Public
collection rejects automation bypass environment variables and uses fresh
unauthenticated browser contexts. It does not reuse a protected project's cookie.
Missing actual producer attestation is a blocking prerequisite. Independent
pins explicitly select `git-unmodified.v1` for the automatic main-branch Git
build or `vercel-project-metadata.v1` for the existing CLI source-deployment path.
The automatic producer activates only for the exact production project and valid
repository, main branch, full commit, deployment ID and immutable origin from
Vercel's built-in nonsecret metadata. Missing or malformed identity fails closed.
It preserves every raw `vercel.json` byte and emits the existing private build-log
attestation plus `.next/hosted-build-attestation.json`; it adds no public endpoint.
The consumer requires matching checkout HEAD, raw source/configuration/harness
hashes and the independently pinned provider identity. Explicit CLI behavior
remains unchanged. Actual metadata availability and producer output still need
verification on the authorized Git deployment. Local `.next`, an earlier
deployment or a GET smoke check cannot substitute for that producer evidence.

Merge remains pending. The authorized cutover is PR 7 merge to main followed by
the existing automatic deployment; there is no separate staged promotion. Before
cutover, the corrected source needs its applicable CI, full protected-host
qualification, live widget evidence and a concrete rollback/public acceptance
procedure. After the automatic deployment, public acceptance must bind the new
actual production build and aliases. Protected noindex is not a reason to create
an indexable duplicate site. These tools do not perform a merge or deployment.

## Manifest correction

The App root and Pages Contact document each emit exactly one relative manifest
link with `crossorigin="use-credentials"`. The explicit static route preserves
the prior 714-byte manifest, content type and cache header. This lets a browser
send an existing host-only protection cookie for the manifest request. It does
not create a credential, change CSP or protection, or establish that an old
interstitial was caused by manifest fetching. Actual authenticated hosted
behavior still needs fresh candidate-bound validation.

## Minimum Turnstile handoff

An existing approved widget may already suffice. First obtain read-only
confirmation of the Cloudflare account, widget identity and authorized hostnames.
Those facts cannot be inferred from the Vercel user or a public site key. The
current production configuration contains a live public site key; it is not yet
proven insufficient.

The old candidate hostname
`gridninja-release-20261013-6ii00t6s2-holdini25s-projects.vercel.app` belongs to
`108f4f5`, not this correction. Do not add it preemptively. The final corrected
immutable hostname remains pending a separately authorized build. The isolated
Vercel target is account `holdini25`, scope `holdini25s-projects`, project
`gridninja-release-20261013` (`prj_hH2kKfAMVQxoxUSRzLdVGxBptt8k`). Cloudflare
account/widget ownership remains unknown.

If the final exact hostname is already authorized, reuse the approved public key
without changing Cloudflare. Otherwise the minimum provider action is adding
that one exact FQDN to the verified existing widget's Hostname Management. It
requires specific approval; do not enable Any Hostname or authorize shared
`vercel.app`. An isolated build also needs that approved public
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, preferably deployment-scoped after approval.
No private Turnstile secret, backend hostname allowlist, database, queue or email
setting is needed for read-only client rendering/performance checks. Client
success does not establish server-side Siteverify or inquiry delivery.

Protected-host access is separate: use an existing authorized session or the
correct project's existing approved private bypass. Never create a new bypass
or reuse the isolated project's secret on production. No widget, credential,
security setting or public staging domain was created for this implementation.

References: [Cloudflare hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/),
[widget setup](https://developers.cloudflare.com/turnstile/get-started/),
[server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
