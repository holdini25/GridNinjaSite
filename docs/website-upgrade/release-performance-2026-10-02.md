# Release performance follow-up — 2 October 2026

This follow-up reduces CSS transferred by every page while preserving the current
design, media, content and interaction behavior. It also records the approved
production redirect contract. The 1 October integration review is a historical
record; use the latest PR checks and source-matched evidence for release status.

## CSS source scope

Tailwind's automatic scanner included utilities from 75 retained components that
no current source entry imports. `src/app/globals.css` now explicitly excludes
those individual files. Automatic discovery remains enabled for current and new
views. No component, authored style, asset or dependency was removed.

`npm run css:validate` runs before every production build. It reads the exclusions
from the stylesheet and follows TypeScript-resolved imports from every source
file outside `src/components`, including future middleware and metadata entries.
It rejects reachable exclusions, invalid paths, unresolved local imports and
unsupported dynamic module discovery. Static imports, re-exports, literal dynamic
imports, CommonJS and type imports are covered. If an excluded component is reused,
remove its `@source not` directive before building so its utilities return. This
is a conservative source-graph check, not a general JavaScript execution analysis.

The fixture suite covers source aliases, cycles, future entry points, newly
reachable components, invalid exclusions and unsupported loaders. Browser and
visual review are still required; a passing graph check alone does not establish
rendered correctness.

## Controlled experiment

Five fresh mobile-home captures per variant used the existing locked Lighthouse
collector settings, browser version, graphics backend and media releases. All
valid runs were retained. The comparison was against application source at
`1af4dedd8de67b2e3585ead5b2d0f6c4ef183903`.

| Measurement | Baseline | CSS exclusion candidate |
| --- | ---: | ---: |
| Median simulated LCP | 2,460.637 ms | 2,410.021 ms |
| Minimum / maximum LCP | 2,448.997 / 2,488.195 ms | 2,298.208 / 2,490.397 ms |
| Global stylesheet, raw production bytes | 141,632 | 110,846 |
| Total HTTP transfer reduction | — | 4,491 bytes |

The median improved by 50.616 ms, but the ranges overlap. This experiment supports
the optimization; it does not alone establish a stable production margin. Final
source-matched Facility, general Lighthouse and browser checks remain authoritative.
The earlier CI failure at 2,560.844 ms and later 2,498.295 ms pass on unchanged
application source remain part of the evidence, not discarded outliers.

Local reports, raw traces, network logs and hashes are retained in
`build/qa/release-clearance-20261002/comparison-css-baseline-vs-css-candidate.*`
and the corresponding `css-baseline` / `css-candidate` directories. Final combined
validation is recorded separately under `build/qa/css-release-20261002/`.
These artifacts remain on the review Mac.

## Approved redirect contract

The user approved Vercel's mandatory HTTP-to-HTTPS step before host normalization.
The deployment smoke test requires exactly two permanent hops only for HTTP
`www`: HTTP `www` → HTTPS `www` → HTTPS apex. HTTP apex and HTTPS `www` each
require one permanent hop. Every location must preserve the complete path and
query; the final apex page must return 200 with no further redirect.

See [the SEO release runbook](../seo-release-runbook.md). This is an explicitly
approved contract correction, not a hosting configuration change. No production
deployment or live form submission is implied by these checks.
