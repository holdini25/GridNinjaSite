# GridNinja website release candidate · 9 November 2026

The candidate for [PR #7](https://github.com/holdini25/GridNinjaSite/pull/7)
retains the assessment, sample brief, Civic illustrations and founders from the
website-only release. The primary action is **Scope an assessment** and the
secondary action is **See a sample decision brief**. Keep the separate editorial
homepage comparison, experimental measurement harness and contact-backend
migration out of this release.

## Changes since October

The [October split manifest](website-ui-release-manifest-2026-10-14.json) and
[October handoff](website-ui-release-2026-10-14.md) are historical records.
The November candidate supersedes their CTA wording and the dependency freeze:

- Restore the assessment labels and corresponding accessible-name checks from
  `e49a16e9f7f5c5000eea56bafa1c7c3bf75fa1eb`. Preserve destinations and attribution.
  Remove the subtitle from the shared navigation drawers.
- Update Next.js and its ESLint preset from 16.3.8 to 16.4.6 and Zod from 4.3.6
  to 4.6.7. The npm lockfile SHA-256 is
  `a5645dc2e604f06c73e1b915b932ed881b1f1689d38f8edaa3662e1a2aea0524`.
  These two package files are the only changes allowed among the 65 deferred
  paths in the October split.
- The contact form keeps its original normalized retry payload in page memory.
  Reopening it reads the tab's reference without replacing autofilled controls
  during hydration. The API, provider configuration and migrations are unchanged.
- The 3D inspection session commits its renderer references after React
  commits and keeps a stable canvas component for each activation. Retrying a
  failed download starts a new activation. Per-frame model updates remain in
  the Three.js frame callback.
- Deliver the verified GLB bytes unchanged to Next.js. Next.js 16.4 strips
  application-supplied content-encoding headers and negotiates compression at
  the HTTP server. Precompressing the model in the route made successful HTTP
  responses unreadable to browsers. The browser delivery check verifies the
  decoded length and digest against the immutable manifest.

All frozen publications, registry entries, private evidence, backend API routes,
database and provider code retain their production bytes. Verify the exclusions
against production base `25ec9dec0aeb4e6798e9a3c18dbe59433b2dd0cc`; the new
package bytes mean older builds and performance captures cannot qualify this release.

## Release verification

Use Node 22.23.2 and npm 10.9.8. Run a clean npm install (`npm ci`), production
dependency audit, brand check, lint, typecheck, unit coverage, PostgreSQL 16
integration, and a production build including the postbuild publication and JS
budget checks. Exercise the assessment, published brief, no-script reading,
contact recovery and navigation in real browser engines. Use only the documented
public test key and mocked contact responses for local form verification.

The [environment qualification contract](environment-qualification.md) defines
three distinct results: local M5/Metal, protected staging, and public
post-deployment acceptance. The full matrix is 14 routes, 140 Lighthouse
captures, 140 full-scroll observations and 20 readiness observations per
environment. Keep failed or incomplete runs. Software CI, a protected preview
and an emulated mobile viewport are not physical phone or public results.

The candidate's raw local evidence is under `build/qa/november-release/`
and `build/facility/`. On GitHub, use the checks for the current PR revision;
individual green jobs on an older build do not qualify it. Before merging,
confirm the protected deployment matches the source, verify its live widget
on that exact hostname, and review applicable hosted and device results.
If Cloudflare rejects a hostname, confirm the account and widget before
authorizing that exact hostname; keep existing protection in place.

After those checks, cutover is a single merge of PR #7 into main. Vercel builds
the public deployment from Git. Verify its producer identity and aliases before
public acceptance. Recheck the current production deployment immediately before
cutover and retain it as the rollback target. No migration, staged promotion
or live inquiry is part of preparing this candidate.
