# SEO, AI visibility, and public evidence release runbook

The repository enforces the search-facing contract. Vercel, DNS, webmaster
tools, CRM, and licensed observation providers remain external control planes
and require named owners.

## Canonical host and deployment controls

The only production identity is `https://gridninja.ai`. In Vercel, set the apex
domain as the production primary and configure each variant as one permanent
path-and-query-preserving hop:

- `http://gridninja.ai/*` to `https://gridninja.ai/*`
- `http://www.gridninja.ai/*` to `https://gridninja.ai/*`
- `https://www.gridninja.ai/*` to `https://gridninja.ai/*`

Do not rely on a two-hop HTTP-to-www-to-apex chain. The application adds an
apex redirect defense for the `www` host, but the Vercel domain configuration
must be corrected before release. Run the deployment SEO smoke workflow against
the apex after the domain change.

Keep preview deployment protection enabled. Every preview response must expose
`X-Robots-Tag: noindex, nofollow, noarchive`; custom preview domains need the
same explicit policy. The production `vercel.app` alias must remain noindex or
permanently redirect to the apex.

## Search and index controls

1. Verify the Search Console domain property for `gridninja.ai`.
2. Submit only `https://gridninja.ai/sitemap.xml`.
3. Verify Bing Webmaster Tools and configure IndexNow credentials outside the
   repository. Submit only substantively changed, indexable manifest URLs.
4. Confirm that raw evidence release files remain outside the sitemap and return
   their canonical `Link` and `X-Robots-Tag` headers.
5. Do not add `llms.txt`, meta keywords, crawler-only copy, or unsupported FAQ,
   product, rating, customer, award, certification, or Dataset markup.

## Evidence publication gate

A technical resource stays `noindex` until all of the following are real and
approved: named author, named reviewer, affiliations, disclosures, technical
owner, next review date, and publication approval. Update the author registry,
resource record, route manifest, and TechArticle graph in the same change.

Before publishing a release:

1. Sanitize every artifact for customer topology, telemetry, identifiers,
   setpoints, thresholds, credentials, network paths, vulnerabilities,
   proprietary solver internals, commercial terms, and unapproved pilot data.
2. Run `npm run seo:validate` under Node 22.
3. Verify every artifact hash in the release manifest.
4. Add an approved signing identity and signature only after key custody and
   review ownership exist. Never manufacture a signature or reviewer.
5. Preserve correction and retraction entries; do not silently erase a prior
   public claim.

## Measurement contract

Vercel Web Analytics receives only the allowlisted successful-outcome events in
`src/lib/analytics.ts`; Vercel Speed Insights is the field CWV source. Query
strings and fragments are stripped from page URLs. Never send form content,
email, facility data, topology, submission IDs, or other PII.

Lighthouse CI uses its desktop lab preset for stable, repeatable release gates
and evaluates three median samples in pull requests or five for release
candidates. Mobile and desktop p75 LCP, INP, and CLS remain separate field
gates in Vercel Speed Insights; the desktop lab profile does not replace the
mobile field target.

Use Search Console for canonical page-level impressions. The source-controlled
question registry is the observation portfolio, not a guarantee of generative
placement. Use a compliant licensed provider for source-panel observations;
never scrape Google directly. Manually verify at least 10 percent of samples and
record factual accuracy, source position, landing page, competing domains,
screenshot, country, device, and timestamp. An inaccurate citation is a failed
observation even when prominent.

Establish a four-week baseline, release coherent content packages, and observe
for 8 to 12 weeks. Annotate releases, core updates, backlinks, and press. CRM is
the authority for qualified leads and opportunities. Do not define a guaranteed
AI Overview placement KPI.

## Release evidence and waivers

Retain route/canonical matrices, metadata and schema extracts, sitemap diffs,
broken-link reports, JUnit output, Playwright traces and screenshots, Lighthouse
reports, deployment URL, and commit. The CI workflows retain these artifacts.

No waiver is permitted for homepage `noindex`, robots blocking, a foreign
canonical, a broken sitemap, or corrupted Organization/WebSite identity. Any
other waiver requires a named owner, risk statement, remediation issue, and an
expiry no later than seven days after approval.
