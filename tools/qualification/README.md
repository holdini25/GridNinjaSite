# Prespecified compatibility evaluation

This experimental branch evaluates Lighthouse 13.5.0, Puppeteer Core 25.13.0,
chrome-launcher 1.2.2, Chrome for Testing 155.0.8059.79 and Node 22.23.2.
The application manifest and lockfile stay unchanged. Puppeteer documents Chrome
155.0.8059.39; the selected stable patch is in that build family, not an exactly
certified pairing or a proven correction for missing navigation markers.

Status: **installed and reviewed; one frozen Linux CI evaluation pending**.
On 15 October 2026 the supported reviewed network-permission path installed the
exact manifest with lifecycle scripts disabled. The earlier default-sandbox
DNS failures and original 37-file draft remain preserved. The application
manifest and lockfile are unchanged. The isolated lock SHA-256 is
`943db15ea59d556679ed31d0c5fa770c346a610f87e6af5993a8f4ec50cf5925`.
All 114 installed versions and cached registry tarball integrities match it.

The 168 focused tests passed, including 38 installed Lighthouse schema checks;
five unrelated transport tests were unselected. Independent offline review
verified native trace selection, rejection of retained NO_NAVSTART traces and
synthesized UKM fallback, package resolution, and launcher API/flag construction.
These checks do not establish browser/runtime qualification. Freeze the exact
source and harness before its sole branch push, which starts the one CI run.

The separate npm manifest uses exact versions and disables installation lifecycle
scripts. The loader requires isolated resolution, exact Node/package versions,
the reviewed lockfile and official-registry integrity entries. It never falls back
to the root Lighthouse 12.6.1. Manifest, lock, adapters and evaluation workflow join
the harness identity; installed dependency trees do not.

The fixed run comprises 140 Lighthouse captures, 140 full-scroll observations and
20 readiness observations, with the original capture replacement policy and every
failed attempt retained. Existing budgets and security guards remain unchanged.
The four original categories are selected explicitly; Lighthouse 13's agentic
category and additional endpoint fetching are outside scope. New-version scoring
is identified as such, not treated as numerically equivalent to the old version.

The Chrome adapter preserves reviewed platform-specific arguments, verifies the
actual spawned argv, and awaits confirmed process closure before deleting a
profile. It does not adopt RenderDocument disabling. Native navigation markers
remain required. Selected LCP events must exist in the same raw trace graph; the
new synthesized UKM fallback cannot qualify. Installed-package verification of
this pinned internal trace API passed offline against preserved raw traces.
The old failures still reject; parsing them never constitutes new qualification.
Actual spawned argv and confirmed shutdown remain runtime obligations.

Installed trace-category review retains every original category in the same
order and admits only the upstream additive `blink.webdx_feature_usage` category
for Baseline feature detection. Its collection overhead belongs to this new
harness; no old measurement is numerically relabelled or transferred. No native
navigation/frame/timing category is removed or patched.

Only the fixed measurement/summary path is being migrated. Legacy startup,
transport, lifecycle, sustain, query and civic diagnostic entrypoints are
explicitly unavailable on this experimental branch, so they cannot emit the new
toolchain identity while using old libraries. Their original implementations and
evidence remain in frozen commit e49a16e9f7f5c5000eea56bafa1c7c3bf75fa1eb. This
branch is not a drop-in release candidate or an approval to skip those release
checks.

The single CI evaluation is software evidence only. Failure or incomplete
coverage remains failure; no opportunistic version changes or unchanged reruns
are permitted. Hosted, public, hardware and live verification gates remain
separate. Vercel uploads/deployments remain paused, and this branch is disabled in
vercel.json. No credential, network-security, provider or production change is
part of this evaluation.

Primary references: [Lighthouse release](https://github.com/GoogleChrome/lighthouse/releases/tag/v13.5.0),
[Puppeteer supported browsers](https://pptr.dev/supported-browsers),
[launcher source](https://github.com/GoogleChrome/chrome-launcher/blob/v1.2.2/src/chrome-launcher.ts),
[LCP fallback change](https://github.com/GoogleChrome/lighthouse/commit/72ac057f7afbce720e11e249b89ad9c0bb635205).
