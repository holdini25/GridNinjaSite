# Assessment inquiry operations and controlled cutover

This is the deployment runbook for the assessment-yield upgrade based on civic commit `16bf45cc6bbe3b3e825ccea0cf2f4c7e887b1f51`. It describes the current source implementation and its activation gates. It is not a receipt for deployed services, production database inspection, production migration, configured schedules, verified accounts or messages sent. Record those separately in the release evidence, with named owners and timestamps. The public success response continues to mean durable inquiry acceptance.

The scope now includes authenticated recipient observations, operational acknowledgement and an independent monitor. The earlier decision to defer a new monitor/scheduler is superseded for this user-approved upgrade. Actual scheduler provisioning, provider verification, outbound rehearsals and production activation remain separate, unperformed external work.

## Source and migration authority

Read `src/db/schema.ts`, `src/db/observations-schema.ts`, `src/lib/contact/provider-request.ts`, `src/lib/contact/provider-attempt-query.ts`, `src/lib/contact/operations.ts`, `src/server/leads/repository.ts` and `src/server/leads/observations-repository.ts` with this runbook. Routes and tests are authoritative when operational circumstances differ from this description.

The current journal contains `0000_contact_intake`, `0001_contact_intake_v2`, and the new **`0002_delivery_safeguards`**. That migration adds snapshot/review fields, a per-lease attempt ledger, minimal provider events, append-only acknowledgements, and completed-job heartbeats. It also quarantines previously attempted unresolved work. The historical enterprise document's `0003_enterprise_contact_delivery.sql` belongs to a removed implementation and is not an instruction to apply or restore that migration.

No production baseline has been verified and no production migration has been executed for this upgrade. Before selecting an upgrade path, obtain the actual deployed Git SHA, active deployment URLs, database schema, Drizzle journal rows, applied migration checksums and the database's backing environment/account. Compare all three current migration files and their journal against those facts. Do not infer database state from a branch name, a handoff document, a successful local test or a migration filename. If the deployed schema/journal differs, stop the rollout and prepare a reviewed reconciliation migration; never edit an already-applied migration, delete journal entries or introduce historical migrations to force agreement.

On a verified `0000`/`0001` baseline, the additive `0002` change preserves accepted inquiries, existing keys and the conservative claim counter. Pending/retrying/processing rows with a previous claim, or any processing row, become `dead_letter` with `review_reason = legacy_attempt_unknown`, a durable `alert_pending:legacy_attempt_unknown` marker, and no active lease. The migration cannot reconstruct original bytes, provider account or the true first attempt, so it does not invent them. Unattempted pending work can freeze its first request normally. Historical `delivered` rows remain provider-accepted with recipient delivery unknown; no callbacks or acknowledgements are fabricated.

## Meaning of evidence

| Observation | Required evidence | Does not establish |
| --- | --- | --- |
| Durably accepted | Committed inquiry plus required email outbox transaction | Provider or recipient acceptance |
| Provider accepted | Valid provider response, or independently recorded provider evidence | Inbox arrival, reading or human handling |
| Recipient server delivered | Verified account-bound `email.delivered` event | Reading or human handling |
| Operator acknowledged | Authenticated append-only acknowledgement with a reviewed-through cutoff | Requeue, provider success or recipient delivery |

The retained transport enum `delivered`, `delivered_at` and worker return state `delivered` mean **provider acceptance**. The observation model keeps provider acceptance, recipient state and human handling distinct. Adverse observations take precedence over earlier positive recipient observations; a later `email.sent` cannot erase a bounce, complaint or failure. A missing callback is unknown, not delivery failure or success.

## Frozen requests, reservations and retry limits

The prepared request contains version, channel, idempotency key, exact UTF-8 body, its SHA-256, target URL, provider-account reference and authorized-destination reference. Channel and key are hydrated from the existing durable outbox columns; duplicate schema columns are unnecessary. Request bodies are limited to 64 KiB. Email and CRM bodies are built before the first attempt, then the transaction stores and reuses those original bytes across retries, template changes and a verified same-account key rotation.

Preparation locks the eligible lead before its outbox, verifies a current lease and retention eligibility with the database clock, and freezes a single first-provider-attempt timestamp. A unique `(outbox_id, lease_token)` ledger row reserves permission to invoke the provider. Only the insert winner receives `ready`; a duplicate preparation of the same lease returns `already_reserved` and has **no send permission**. Reservation conservatively means an invocation may have begun. A crash after reservation but before HTTP consumes the existing claim; it must not gain another send on the same lease.

The existing `attempt_count` is a **six-claim maximum**, including claims that crash before HTTP; there is no second provider-attempt budget. Automatic retries also stop at the earlier of retention expiry and **23 hours from the first provider reservation**. They do not receive a fresh window after reclaim, configuration changes or credential rotation. Invalid or future clocks, partial snapshots, changed channel/key, account drift, destination/contract drift and exhausted work stop with durable review state. Database eligibility is checked again immediately before HTTP. No database transaction holds a lock across provider I/O; an already-started network request cannot be recalled by concurrent redaction.

The provider executor validates snapshot integrity and current authorization again, sends the frozen bytes and key, forbids redirects and uses an eight-second transport deadline. Resend response reads are bounded at 64 KiB. A Resend 2xx without a usable bounded opaque message ID is an uncertain outcome, eligible only for the same guarded retry window and budget. It is not successful delivery. A qualified CRM 204 is valid acceptance and does not require or invent an email message ID.

A completed response is recorded against its existing reservation before attempting the lease-guarded outbox transition. A late response can add minimal provider evidence after lease loss or redaction; it cannot overwrite a newer authoritative outbox state, requeue work or restore the inquiry body. Completion is write-once. Deletion removes the reservation, so a later result cannot recreate it. Unknown outcomes that reach a stop require human review; never resolve uncertainty by resetting a count, first clock or idempotency key.

## Account and destination qualification

`RESEND_ACCOUNT_REF` is a stable non-secret alias for an independently verified provider account. An alias alone does not prove which account an API key belongs to. Activation also requires:

- `RESEND_ACCOUNT_BINDING_REF`: an opaque reference to a private, reviewed account/credential authorization record.
- `RESEND_APPROVED_KEY_SHA256`: SHA-256 of the exact trimmed approved `RESEND_API_KEY`. Every key change must match a newly reviewed fingerprint.
- Evidence that the key belongs to the same actual provider account, is authorized for the verified sender domain, and is approved for the designated lead recipient. Keep raw keys, recipient details and private account records out of release artifacts and logs.

For rotation, privately verify the new key against the same real account, update the approved fingerprint and evidence reference in the same controlled configuration change, and keep the frozen account alias and authorized sender/recipient identity consistent. An unapproved key rotation fails closed. The digest prevents accidental unreviewed key substitution; it is not an API-based proof of account ownership. A person who configures an incorrect alias and approval record can still misconfigure the system, so independent verification remains an activation gate.

Email destination authorization hashes the configured sender and recipient. Changing either stops outstanding snapshots; it does not silently redirect previously accepted inquiries. New inquiries may use the newly approved destination. Resolve old outstanding work explicitly with provider evidence and the inquiry owner; there is no automatic redirection or requeue endpoint.

Optional CRM delivery is **off by default**. Enable only with `LEAD_WEBHOOK_ENABLED=true` and all qualified settings: HTTPS URL without credentials/fragment, signing secret of at least 32 characters, stable account reference, immutable contract reference, and declared deduplication retention of at least 24 hours. Before enabling, obtain receiver-owner evidence for stable idempotency-key semantics, exact-body replay, concurrent duplicate handling, replay retention, signature validation, account ownership, response behavior and accepted timestamp skew. A declaration in environment variables is not proof that a generic endpoint supports those behaviors.

The CRM destination hash binds URL and contract reference. A new contract at the same URL is a destination change and stops outstanding work. Signing-secret rotation is permitted only under the receiver's verified same-account contract. Fresh timestamps/signatures wrap the frozen body on retries; the payload and stable idempotency key do not change. Without a qualified endpoint, leave CRM disabled. If a previously enabled receiver loses its authorization, existing work stops for review rather than making uncertain duplicate business effects.

## Routes, credentials and scheduling

| Route | Method and authorization | Role |
| --- | --- | --- |
| `/api/contact` | POST; existing intake validation, anti-abuse and Turnstile controls | Commit accepted inquiry and eligible outboxes; best-effort wakeup |
| `/api/internal/lead-delivery` | POST; verified QStash signature | Claim, reserve and deliver eligible work |
| `/api/internal/lead-sweep` | POST; verified QStash signature | Recover due work and record completed sweep heartbeat |
| `/api/internal/lead-retention` | POST; verified QStash signature | Redact/delete due work, prune unmatched events, then record completion |
| `/api/internal/lead-alert` | POST; verified QStash signature | Existing queued operator alerts |
| `/api/webhooks/resend` | POST; verified Svix signature over exact raw body | Store minimal authenticated provider events |
| `/api/internal/lead-monitor` | GET; exact bearer `LEAD_MONITOR_SECRET` | Independent direct monitoring and alerts |
| `/api/internal/lead-acknowledgement` | POST; exact bearer `LEAD_OPERATIONS_SECRET` | Append an authorized human acknowledgement |

Do not interchange QStash signing keys, callback secrets, monitor bearer, operations bearer or alert-sink bearer. Secrets belong in the deployment's secret manager. Confirm canonical origin, deployment-specific URLs and the credentials of each environment independently. A preview must never inherit a production outbound account, recipient, CRM or alert destination merely to pass readiness.

The intended sweep schedule is every minute and retention daily. Existing `contact:qstash:configure` provisions QStash only when an authorized operator deliberately runs it; it is not a local validation command. It does not provision the independent monitor. No independent scheduler is installed by this source change or `vercel.json`.

Provision the monitor through an independently authenticated scheduler that can set its dedicated bearer, ideally every minute, outside the QStash delivery path. Do not assume a native scheduler that only supplies `CRON_SECRET` satisfies this route. The monitor calls the HTTPS alert receiver directly with `LEAD_ALERT_WEBHOOK_TOKEN`; it does not enqueue its alerts through QStash. Qualify receiver-side idempotency on stable incident event IDs and bounded fallback IDs. Use a distinct `LEAD_MONITOR_NAMESPACE` per environment. Redis overlap protection and incident state deduplicate normal incidents and send one recovery; loss of incident state can repeat a bounded fallback notification and is degraded, never healthy.

The monitor flags missing/invalid sweep completion after 180 seconds, eligible due work older than 300 seconds, dead letters/review stops, adverse recipient outcomes, callbacks unmatched for more than five minutes, conflicting provider events, missing expected recipient observations, unhandled inquiries and retention completion older than 26 hours. Unknown database state cannot resolve earlier incidents. An HTTP 200 with `healthy:false` still describes active incidents; status alone is not a healthy verdict. Configuration, incident-store or sink failure is degraded and may return 503.

Configure **both** `LEAD_RECIPIENT_OBSERVATION_SECONDS` and `LEAD_HANDLING_SECONDS` using documented owner-selected thresholds; there are no invented business defaults. Values must be positive integer seconds, at most 365 days. Record why the chosen thresholds fit the actual mailbox/receiver process and staffing coverage.

A separate external missing-heartbeat check must supervise monitor execution and direct alert delivery. Otherwise a stopped scheduler cannot alert about itself. Define the expected authenticated successful-run cadence and the external missed-run/error threshold, prove failure notification reaches a staffed fallback path, and record escalation ownership. This external watchdog is an activation gate; it is not implemented or provisioned here. `LEAD_OPERATOR_REFERENCES` must name at least two distinct allowed opaque references. Maintain the private mapping to a named primary owner and backup, coverage, response expectations and escalation path.

## Provider callbacks and acknowledgements

Register the Resend webhook only after verifying its real account, canonical HTTPS URL and subscribed event types. The receiver requires `RESEND_WEBHOOK_SECRET` and associates it with `RESEND_ACCOUNT_REF`. For a deliberate overlap during signing-key rotation, `RESEND_WEBHOOK_SECRET_PREVIOUS` must have its own explicit `RESEND_WEBHOOK_PREVIOUS_ACCOUNT_REF`. Do not assume the previous key belongs to the current account. Remove the old binding after its authorized retry/rotation overlap ends.

The receiver verifies the exact raw body, caps it at 16 KiB with a five-second read deadline, and uses the Svix verifier's signature/timestamp checks. It accepts only the minimal supported sent/delivered/delayed/bounced/failed/complained/suppressed observations; open/click activity is not retained. The database stores only opaque event/message/account IDs, event type, provider occurrence time, local receipt time and conflict/match metadata. Recipient addresses and raw payloads are discarded.

Deduplication uses `(provider_account_ref, provider_event_id)`. A repeated ID with incompatible immutable event facts becomes a conflict, not an overwrite. Account plus provider message ID must match exactly one outbox, including message identities recorded in late attempt evidence. Events arriving before the worker's acceptance commit remain unmatched and are reconciled later. Matching does not guess from recipient, payload tags or arbitrary outbox IDs. Ambiguous/conflicting observations cannot establish delivery.

An acknowledgement body is the strict JSON object `{ "outboxId": "<UUID>", "operatorReference": "<configured-reference>", "reviewedThrough": "<ISO timestamp>" }`, limited to 1 KiB. The authenticated owner reviews the inquiry, provider evidence and incident state through that cutoff before recording it. The cutoff must be within the outbox lifetime and no later than the database clock. This is an append-only operational fact; duplicate identical acknowledgements are harmless. It does not mutate transport status, send another message or provide a general replay capability.

A new adverse event received after `reviewedThrough` raises an incident even if its provider occurrence time is earlier. A prior acknowledgement does not silently suppress a later bounce, complaint, event conflict or newly-required review. Preserve the private operational record of what was reviewed; public logs contain only opaque references.

## Retention and lifecycle races

The existing deadlines are **180 days to redaction and 365 days to deletion from acceptance**. Verify those configured processor policies and the database deadlines in staging; do not infer provider-side deletion from local deletion. Redaction and retirement of sendable work are one database operation. It clears inquiry PII and every stored request body, URL, body hash and destination reference, including snapshots on accepted outboxes. It keeps minimal transport/review/account/clock evidence and outstanding terminal-alert state. If retirement fails, the redaction transaction rolls back instead of leaving sendable work with missing context.

Claims and reservations lock lead before outbox to avoid reversing retention's order. Expired/redacted work cannot obtain a new send reservation; final send eligibility rechecks retention. Redaction cannot undo HTTP already issued before the deadline. A returning response stores bounded metadata only, cannot restore cleared snapshots, and cannot authorize another send. No raw response body, email, inquiry text or secret is stored in the attempt ledger or operational event tables.

Matched provider events and acknowledgements follow the outbox's 365-day cascading deletion. Unmatched events are reconciled before pruning and removed in bounded batches when their local receipt is older than seven days. An event arriving after its inquiry/outbox was deleted cannot recreate it; it stays unmatched until its own seven-day expiry. This can cause a temporary unmatched-event incident and must not cause replay. Daily retention completes its heartbeat only after its work and event prune complete; bounded batches may need subsequent successful runs to clear a large backlog.

## All-trigger hold, rehearsal and cutover

1. Record the verified deployed SHA/schema/journal/checksums and active provider accounts, canonical and historical deployment URLs, queue/schedule IDs, queued destinations, retry horizons, durable status/claim counts, active leases, retention backlog and unresolved incidents. Store counts and opaque references, not inquiry bodies or secrets.
2. Review `0002_delivery_safeguards.sql`, including the quarantine DML, and rehearse backup restoration on a disposable isolated database. Record recovery point, tested restore result and rollback owner. A backup's existence alone is not a restore rehearsal.
3. Establish an effective hold on **all** provider-send entry points before migration: intake-generated wakeups, queued/retrying QStash messages, schedules, manual replays/sweeps and every old deployment-specific delivery/sweep URL. Pause retention for the schema cutover. Schedule pause alone is insufficient. No application maintenance switch is assumed to exist; demonstrate the real host/broker controls. If old workers cannot be reliably blocked, do not perform an in-place live migration.
4. Keep intake open only if durable persistence remains available and every wakeup is held before an old provider attempt. Otherwise provide an explicitly truthful temporary-unavailable flow that preserves visitor input; do not claim receipt. Do not delete accepted inquiries or broker work to manufacture an empty queue. Account for broker retries that expire while held; the durable outbox remains the recovery authority.
5. Drain in-flight old workers and provider calls, and reconcile late/unknown outcomes. Prove no old worker retains send permission or can wake from an old URL after cutover. Save bounded pre-migration counts and timing. Do not cancel uncertainty by giving it a new idempotency key.
6. On isolated staging first, apply the current migration chain to the verified baseline, exercise the quarantine regression and compare expected/actual row counts. Prove one reservation winner under concurrency, original bytes/key on retries, stale lease handling, the exact 23-hour boundary, six-claim ceiling, configuration/credential drift stops, redaction races, write-once late evidence and no resurrection after deletion. Database tests require a dedicated disposable `TEST_DATABASE_URL`; schema tests are destructive to that test database.
7. Deploy the new sender, callback, acknowledgement and monitor code while the hold remains. Validate schemas/checksums, sender/account/credential approval, callback account binding, receiver contract if CRM enabled, exact endpoint authentication and rate/body limits. Configure schedules and independent supervision only after the responsible operator authorizes real infrastructure changes.
8. Run a separately authorized synthetic outbound staging rehearsal through a dedicated test recipient/account. Observe durable acceptance, valid provider identity, verified callback, operator handling, account-approved key/signing-key rotation, duplicate callback conflict, outage/recovery, missed sweep/retention, monitor scheduler loss, direct sink failure and rollback. Synthetic HTTP mocks and local database tests do not prove external delivery or staffing. Retain sanitized evidence and raw test failures; no production form submissions are part of local preparation.
9. Release send permission only to the verified new deployment. Restore schedules deliberately, account for held/expired broker retries, confirm fresh sweep/retention completion and monitor supervision, and reconcile accepted inquiries against outboxes/attempts/quarantine. Review unknown legacy rows using private provider records before any separately approved action; there is no safe generic automatic replay.

## Safe rollback and release evidence

A visual rollback may select the prior poster/manual presentation while retaining this delivery implementation and schema. Do not roll back to a pre-safeguard worker against migrated in-flight work. Its old behavior can resend uncertain inquiries or bypass account/window/retention checks. Retain the additive schema and operational records; do not drop tables, restore old snapshots over new acceptance, reset keys/counts/clocks, or delete events to silence an incident.

If server rollback is needed, first re-establish the all-trigger hold and drain. Deploy a reviewed compatible build preserving reservations, frozen identity, retry ceiling, quarantine and retention semantics, or keep sends held while a forward fix is prepared. A database restore requires the rehearsed recovery procedure and explicit reconciliation of every acceptance/provider action after the recovery point. It is not a routine migration undo command.

The activation ledger must distinguish source validation, isolated database evidence, authorized external rehearsal and production evidence. Attach the actual tested commit/hash, Node/npm version, lockfile and migration checksums, migration fixture results, account-binding evidence reference, contract qualification, primary/backup ownership, selected thresholds, schedule destinations, external watchdog proof, backup/restore proof and rollback result. Mark missing evidence **unperformed**. Do not substitute a passing build, a handoff's historical assertions or an unexecuted checklist for production readiness.

## Provider references

Resend documents a [24-hour idempotency-key retention window](https://resend.com/docs/dashboard/emails/idempotency-keys). This implementation's 23-hour ceiling is a conservative engineering margin, not an exactly-once guarantee. The [Resend event definitions](https://resend.com/docs/webhooks/event-types) distinguish sending from recipient-server delivery and adverse outcomes. Signature verification follows the [Svix raw-payload verification guidance](https://docs.svix.com/receiving/verifying-payloads/how). These references were checked on 12 October 2026; recheck the provider contract during activation and later provider changes.
