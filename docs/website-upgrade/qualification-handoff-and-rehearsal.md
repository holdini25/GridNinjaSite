# Qualification handoff and operational rehearsal

Status: prepared locally; external rehearsals have not run. Qualification09 in `build-review-subtle-finish-2026-09-25.md` is historical. The current private qualification10 build and evidence are indexed in `gpu-assisted-release-2026-09-27.md`; its native, craft, hosted and external gates remain open. Never infer delivery, accessibility conformance, or physical-device stability from local automation.

## Go/no-go record

The release owner records a dated decision against one immutable candidate:

| Required entry | Record |
| --- | --- |
| Candidate identity | Source, build, lockfile, harness, facility release/mode, publication hashes |
| Gate dispositions | Pass, fail, not run, blocked, or superseded; exact evidence and accountable reviewer |
| Defects | Severity, observable consequence, reproduction, correction, independent retest |
| Visual review | Each rubric score; no average concealing a category below 2 |
| External validation | Named devices/access methods, participant round, delivery and rollback evidence |
| Operational responsibility | Inquiry queue/receipt owner, incident contact, privacy/editorial sign-off |
| Decision | Go or no-go; explicitly accepted residuals, rollback triggers, owner and timestamp |

Incorrect evidence, lost inquiries, a critical access barrier, or repeated graphics crashes require no-go or rollback. Poster/manual modes mitigate graphics defects; they do not resolve an assessment or inquiry defect.

## Authorized staging delivery rehearsal

Before running the staging workflow, obtain scoped authorization for the exact staging origin and dedicated test recipients. Confirm the database belongs to that environment. Do not substitute production credentials or use a customer's address.

1. Record the deployed candidate identity, rollback deployment, verification configuration, recipient authorization and responsible operator.
2. Run the staging canary with `STAGING_BASE_URL`, `STAGING_DATABASE_URL`, `STAGING_CANARY_AUTHORIZED_ORIGIN`, `STAGING_CANARY_AUTHORIZED=staging-only`, `STAGING_CANARY_EMAIL`, `STAGING_CANARY_DELIVERY_EMAIL`, `STAGING_CANARY_EXPECTED_ATTESTATION_SHA256`, `STAGING_CANARY_PREFLIGHT_TOKEN`, and `STAGING_CANARY_OPERATOR_REFERENCE`. Missing configuration must fail. The operator reference must match the assigned person's opaque roster ID, never an email address.
3. Submit synthetic input through the actual UI and verification flow. Record a redacted receipt identifier; do not put inquiry text, tokens or credentials in URLs or analytics.
4. Confirm the durable receipt and outbox rows, provider acceptance, delivery to the approved sink, and the operator's acknowledgement. A UI success or provider acceptance alone does not establish end-to-end delivery.
5. Exercise duplicate retry with the original idempotency key, lost response recovery, verification rejection, queue retry and signed delivery handling. Confirm one logical inquiry, retained input, and no accidental duplicate notification.
6. Rehearse worker/provider interruption and recovery using the staging environment's documented controls. Verify alerts, retry ceilings, ownership and recovery without discarding queued inquiries.
7. Archive sanitized evidence and remove only the explicitly identified test fixtures under the environment's retention policy.

Local mocks and disposable PostgreSQL tests establish isolated state invariants only. Real sender/provider outages, signing-key rotation and trusted-proxy behavior remain staging checks.

### Recommended recipient and staffing

Use a dedicated GridNinja-controlled staging mailbox with no prospect data and a
dedicated provider sender/account. Route the actual internal notification only to
that authorized destination. The canary form email is also a dedicated test
identity; setting it alone does not change `LEAD_EMAIL_TO` or any CRM destination.

Before visiting the inquiry form, the canary calls the authenticated, read-only
staging preflight. Enable it only with `LEAD_STAGING_PREFLIGHT_ENABLED=staging-only`
and the exact `LEAD_STAGING_PREFLIGHT_ORIGIN`; its bearer is the existing restricted
operations credential. The test compares the deployed build attestation hash with
the separately qualified artifact and the actual internal-recipient digest with
`STAGING_CANARY_DELIVERY_EMAIL`. This bounded email rehearsal requires CRM delivery
to be disabled. The deployed worker origin must equal the staging origin, and its
database target digest must match the isolated database inspected by the test.
Database routing options are rejected rather than ignored. These checks do not
replace the separate QStash, Redis and provider account-isolation inventory.
It rejects remote HTTP and redirects, and blocks cross-origin
contact POSTs. Credentials stay in Node's preflight request, outside browser traces.

Use the expected attestation hash supplied by qualification, not a value copied
from the same endpoint just before testing. Archive it with the approved candidate.
The post-send database check also validates the frozen payload's exact recipient,
absence of CC/BCC, request digest, stable key and first-attempt timestamp without
retaining message contents. This normal-delivery canary does not by itself prove
the separate lost-response, retry, restoration or queue-outage scenarios.

Assign the inquiry-handling owner as primary operator and the hosting/database
owner as backup. Keep the release approver independent of the person executing
the rehearsal. These are proposed responsibilities; named people and working
mailboxes have not been supplied or provisioned.

Reserve a staffed seven-minute window. The test waits up to 60 seconds for durable
provider acceptance, 120 seconds for a stored signature-verified delivery event,
and 180 seconds for the assigned operator to inspect the evidence and acknowledge
it through the authenticated operational endpoint. It prints only the outbox and
provider identifiers, roster reference and review cutoff needed for that step.
The test reads the database; it never fabricates a delivery event or writes its
own acknowledgement. A missing, stale, wrong-operator or negative delivery state
fails the rehearsal. Use the existing access-controlled operator procedure for
the acknowledgement secret; do not paste it into test logs or chat.

## Rollback rehearsal

Record the baseline asset/publication hashes and named previous deployment before changing anything. Rehearse the repository's existing deployment process in authorized staging.

- For a graphics incident, set `FACILITY_3D_MODE=poster`, `manual`, or `auto-desktop` as appropriate and rebuild/redeploy. Verify both home and demo, cache behavior, static poster, selection evidence, inquiry and publication links. Do not assume an environment change updates a statically built route without a new build.
- For an assessment/inquiry regression, restore the last reviewed application deployment. Keep durable receipts/outbox state and frozen publications; do not roll back a database destructively as a UI mitigation.
- Confirm the active build/release/mode from actual page behavior and attestation, then repeat the critical offer → decision → evidence → inquiry journey.
- Record detection-to-mitigation time, remaining user impact and recovery owner. Re-enable adaptive graphics only after the corrected candidate is qualified.

## Independent device and access review

Use compact iPhone/Safari, midrange Android/Chrome and non-Apple integrated-GPU hardware. Record model, OS/browser, power mode, connection and motion preferences. Run 15 minutes of visible activity, periodic interactions, background/resume and specimen changes; record cadence/adaptation, input response, crashes, observable memory behavior and available thermal/energy information. Missing diagnostic APIs are unavailable, not zero.

An independent reviewer checks native VoiceOver/Safari and a Windows screen reader, keyboard order/recovery, dialogs, linked form errors, chapter announcements, touch scrolling, 200% text and 400% reflow, forced colors, visible/obscured focus and motion alternatives. Automated axe and Playwright WebKit results remain separate.

Use the existing two-round, six-participant-per-round protocol in `experience-v8-usability-protocol.md`. For round two require at least five of six unassisted completions on each task and no critical misunderstanding. These are internal formative acceptance rules, not conversion estimates.
