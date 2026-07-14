# SEO performance release controls

Lighthouse CI runs three samples for pull requests and uses the median result.
Set `LHCI_RELEASE_CANDIDATE=1` to collect five samples for a release candidate.
The blocking lab gates are defined in `lighthouserc.cjs`; transfer budgets live
in `budgets.json`.

Field performance remains authoritative. Review Vercel Speed Insights at p75,
separately for mobile and desktop, against these targets:

| Metric | Internal warning | Field target |
| --- | ---: | ---: |
| LCP | > 2.2 s | <= 2.5 s |
| INP | > 160 ms | <= 200 ms |
| CLS | > 0.07 | <= 0.10 |

Before enforcing the interactive-route 10% regression rule, capture and approve
a fresh Node 22 baseline from the same CI runner class. Do not manufacture a
baseline from a single local run. Retain the raw reports with the deployment URL
and commit, then compare route medians on the same device profile.

The current resource-hub budgets gate initial compressed script at 200 KiB and
image transfer at 250 KiB. Publication-gated technical leaves are intentionally
noindex and therefore are not expected to score 100 in Lighthouse SEO until
named authorship and review activate them. The global initial transfer and font
budgets are 1.5 MiB and 160 KiB. A largest-critical-image check should use the
retained Lighthouse resource report; the aggregate resource image budget is
intentionally at least as strict for the first release.
