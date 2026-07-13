# Temporary PostCSS GHSA-qx2v-qp2m-jg93 exception

| Field | Value |
|---|---|
| Advisory | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) / CVE-2026-41305 |
| Severity | Moderate |
| Affected transitive package | PostCSS before 8.5.10, pinned through the current stable Next.js toolchain |
| Owner | GridNinja website maintainers |
| Accepted | July 12, 2026 |
| Review deadline | August 12, 2026 |

## Rationale and controls

The advisory concerns unescaped `</style>` sequences when attacker-controlled CSS is parsed, stringified, and embedded in an HTML style element. This website does not accept, process, or re-emit untrusted CSS. Application styles and Tailwind inputs are repository-controlled build inputs, and content fields do not enter a PostCSS pipeline.

Production auditing remains fail-on-high through `npm run audit:prod`. This bounded exception applies only to the current moderate transitive finding; it does not waive high or critical advisories and must not be extended to any feature that accepts untrusted CSS.

## Remediation trigger

Upgrade to a stable Next.js release that resolves its dependency to PostCSS 8.5.10 or newer, then remove this exception after the normal lint, typecheck, unit, integration, build, and browser gates pass. Do not force an npm audit fix, downgrade Next.js, or override Next.js's pinned PostCSS dependency to close the report prematurely.
