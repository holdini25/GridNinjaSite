# GridNinja public evidence release 1.0.0

Status: **publication-gated candidate**

This release contains synthetic, sanitized artifacts for reviewing the proposed
GridNinja proof contract. It is not a customer, pilot, production,
certification, or independent-validation result.

The release intentionally contains no customer topology, raw telemetry,
identifiers, setpoints, protective thresholds, credentials, network paths,
vulnerabilities, commercial terms, or proprietary solver internals.

## Contents

- `virtual-capacity-proof-test.json`: negative-case-first protocol fixtures.
- `synthetic-virtual-capacity-benchmark.json`: synthetic benchmark cases.
- `proof-pack.schema.json`: public proof-pack JSON Schema candidate.
- `proof-pack.example.json`: sanitized synthetic example.
- `load-passport.schema.json`: workload contract schema candidate.
- `dispatch-envelope.schema.json`: decision-envelope schema candidate.
- `capacity-waterfall-methodology.json`: capacity accounting steps and limits.
- `validate-proof-pack.mjs`: dependency-free structure and digest validator.
- `manifest.json`: release inventory and SHA-256 digests.
- `CHANGELOG.md`: append-only release notes.

## Verify

Use Node 22:

```text
node validate-proof-pack.mjs .
```

The validator checks file digests and the minimum cross-artifact contract. It
does not certify the correctness, safety, or completeness of the underlying
methods.

## Signing boundary

The manifest is deliberately marked unsigned. A signed public release requires
an approved signing identity, protected key custody, named technical ownership,
and independent review. No placeholder signature is supplied.
