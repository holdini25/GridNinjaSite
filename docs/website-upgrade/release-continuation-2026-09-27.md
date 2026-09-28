# Release continuation — 27 September 2026

Status: implementation and prerequisite checks in progress. No new build is qualified, no visual release is registered by this workstream, and no hosted operation has been performed.

## Baseline and concrete QA correction

Qualification09 remains the completed local baseline. Its private v11 artifact used enforced CSP, adaptive graphics, local HTTP, test verification and no production observability. Its nine passing gates, eleven blocked gates and failed premium craft gate must remain separate from this continuation. Existing v1–v10 assets and assessment publications remain immutable.

The evidence recorder previously allowed `production-configured-performance` to pass against that local configuration once external authorization was enabled. It now rejects a passing record unless the artifact attests all four production prerequisites: observability enabled, HTTPS policy enabled, live verification and enforced CSP. Checking a saved ledger applies the same guard. Hosted measurements, authorization and hashed evidence remain additionally required; the settings guard does not establish execution.

Fifteen focused prerequisite/ledger tests pass in `build/qa/gpu-release-20260927/release-preflight-tests01.json`. These are targeted development checks, not final qualification. The full candidate must be rebuilt and tested after integration because this change updates the QA harness fingerprint.

A subsequent harness correction excludes generated Python bytecode/cache directories from the QA digest, while retaining Python source and ordinary fixture changes. This prevents Blender/Python execution from invalidating a frozen candidate through machine-specific caches. Sixteen focused tests pass in `release-preflight-tests02.json`, including source-change and cache-generation regressions; the first attempt is retained separately.

## Observed local capabilities

The values-redacted inventory is `build/qa/gpu-release-20260927/release-prerequisites01.json`. Only `.env.example` exists; `.vercel/project.json` is absent. None of the required production inquiry, monitoring or staffed-staging variables is present in the inspected process. The saved `.next` attestation exists but has not been validated against the changing source. No credentials or recipient addresses were read into the report.

Node 22.23.2 and npm 10.9.8 were restored to `build/tools/node-v22.23.2-darwin-arm64/bin`. The required Simulator profiles are installed and shutdown. Native Safari, Chrome, Xcode and Simulator availability is recorded separately in `build/qa/gpu-release-20260927/platform-prerequisites01.json`; inventory is not journey evidence. The integration lead can perform native foreground checks after the final build. This workstream booted no Simulator or browser.

The Linux Firefox workflow exists and installs matching Playwright dependencies with one artifact, no retries and an explicit skip audit. Execution remains unrecorded. It requires a registered release; current canonical registration stops at v10. Do not silently test v10 and label the result v11, bypass private-release checks, or treat Linux rendering as M5 Metal evidence.

## Next-candidate sequence

1. Finish bounded material, lighting, asset and harness work; archive failed comparisons. Obtain an independent browser craft review, preserving the subtler 0.45 paint starting finish.
2. Serialize approved asset packaging and registration. Preserve old bytes; keep unapproved candidates outside delivery. The new release selection must be explicit throughout build and tests.
3. Stop changing source, tests and capture tools. Build once in the pinned environment, initialize a new ledger, and archive source/build/lockfile/runtime, release/profile/publication hashes and feature settings. Never relabel qualification09.
4. Run CPU and isolated-database checks, then one browser/GPU worker at a time. Complete required browser cases and skip audit, mechanics/lifecycle, browser visuals, native Safari/Chrome and the three Simulator journeys. Preserve failure attempts and explanations.
5. Run five fresh production measurements for home/demo/assessment × desktop/mobile with unchanged gates; separately measure all automatic requests through readiness and explicit specimen downloads. Actual hosted HTTPS/observability/live-verification must have a separately attested production artifact. No local result substitutes for it.
6. Complete independent device, accessibility, visitor and operational evidence. A final independent go/no-go requires every required gate to pass; unresolved resources stay blocked.

## External prerequisites and rollback checklist

No actual staging URL, dedicated mailbox or named operators is configured. A recommended role or mailbox name is not an existing account. Before any real rehearsal, record the authorized staging origin, controlled form and delivery recipients, named primary/backup and independent approver, separate SQL/QStash/Redis/provider resources, actual scheduler capability, and a recovery point. Do not put credentials in this document or evidence.

Follow `enterprise-contact-operations.md` for the exact all-trigger hold/drain and additive migration sequence. Verify old deployment endpoints, queued retries, intake-triggered publishes and manual sweeps cannot start an old provider send. Pausing a schedule alone does not establish this hold. Account-isolation, hold/drain and observed scheduler behavior remain blocked until demonstrated.

The authorized rehearsal must observe durable receipt → provider acceptance → signed recipient delivery → authenticated operator acknowledgement, followed by outage, uncertain-response, 23-hour cutoff, restore/retention and alert/recovery checks. Preserve stable request bytes and idempotency keys. Reconcile uncertain historical sends; never reset clocks to force success.

Before rollout, identify a tested poster-mode deployment that retains the enterprise inquiry worker safeguards, plus manual/desktop/adaptive configurations. Record environment and Vercel/QStash schedules before and after rollback. Keep additive schema and receipts; never use a pre-enterprise worker with in-flight notifications. Verify immutable publication links and the offer → decision → evidence → inquiry journey after each configuration change.

Physical phone/non-Apple GPU, fifteen-minute sustained behavior, independent screen readers, participant research, recipient delivery and privacy/editorial/operations ownership are not established by this continuation. No live migration, outbound inquiry, deployment, purchase or final accessibility claim has occurred.
