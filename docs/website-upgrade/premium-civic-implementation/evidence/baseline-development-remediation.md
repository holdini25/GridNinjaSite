# Development dependency follow-up

Read-only registry/advisory inspection followed by two specifically authorized compatible leaf patches, 10 October 2026. `npm update proxy-addr compression` changed two packages. No parent override, major change or downgrade was applied.

| Leaf | Before → after | Existing parent range | Result |
|---|---|---|---|
| proxy-addr | 2.0.7 → 2.0.8 | Express 4.22.3: `~2.0.7`, via LHCI | Compatible patched leaf; dependency set unchanged. [Advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) |
| compression | 1.8.1 → 1.8.2 | LHCI 0.15.1: `^1.7.4` | Compatible patched leaf; adds destroy 1.2.0. [Advisory](https://github.com/advisories/GHSA-vc2v-76pw-4v95) |

[Full audit after these patches](baseline-development-audit-leaf-patches.json): **17 findings: 3 moderate, 14 high, zero critical**. [Production audit](baseline-production-audit-leaf-patches.json): **zero findings**. Earlier receipts are preserved rather than overwritten. Audit totals include parent chains; they are not 17 independent vulnerability mechanisms.

The remaining leaf constraints are:

- **basic-ftp 5.3.1:** first patched 6.2.1; registry latest 6.2.3. Both installed get-uri parents constrain it to 5.x (`^5.0.2` and `^5.3.1`). A 6.x override would be outside those contracts and needs separate compatibility work. The current get-uri FTP path actually calls `Client.list()`, so the affected capability is present, even though the site's deployment does not ship this development dependency. [Advisory](https://github.com/advisories/GHSA-c475-qrg2-pj4r)
- **braces 3.0.3:** installed and latest; advisory reports no patched release. Micromatch 4.0.8 accepts `^3.0.3`; changing unrelated top-level tool versions cannot establish a patched leaf that does not exist. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- **sprintf-js 1.0.3:** argparse 1.0.10 constrains `~1.0.2`; latest 1.1.3 is also affected and no patched release is reported. The chain comes from LHCI utils → js-yaml 3.x → argparse 1.x. [Advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)

The registry still lists LHCI 0.15.1 as latest. `npm audit` suggested downgrading LHCI to 0.13.0 or eslint-config-next to 14.2.35 for propagated findings. Those suggestions were rejected as incompatible with the approved release toolchain. No further dependency exploration or automatic broad remediation is authorized in this work package. Final integrated build, application checks and audit must use the final candidate lockfile.
