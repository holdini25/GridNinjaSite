# Enterprise inquiry operations — implementation and rehearsal

## Meaning of each state

The public success response means an inquiry and its required outbox entry were durably accepted. It does not mean that an email reached a person.

| Observation | Evidence |
| --- | --- |
| Durably accepted | Committed inquiry and outbox transaction |
| Provider accepted | Successful provider response or authenticated provider event |
| Recipient mail server delivered | Authenticated `email.delivered` event |
| Operator acknowledged | Explicit authenticated operational acknowledgement |

The existing `delivered` enum and `delivered_at` column remain for compatibility and mean **provider acceptance**. Historical recipient delivery remains unknown. A late `email.sent` event cannot erase a delivery failure, and a bounce/complaint remains visible alongside earlier delivery observations. An acknowledgement records human handling; it neither claims the recipient read the message nor restarts a stopped delivery.

## Additive migration and deployment order

`drizzle/0003_enterprise_contact_delivery.sql` adds request snapshots, the first provider-attempt timestamp, review and acknowledgement metadata, a minimal provider-event inbox, and sweep/retention heartbeats. It does not rename the transport enums or rewrite historical delivery as recipient delivery.

1. Independently review the migration and record a recovery point.
2. Establish and verify the all-trigger delivery hold below, then allow running workers to finish before migration. Pausing scheduled sweeps alone is insufficient.
3. Apply the migration to an isolated staging database first. Previously attempted unresolved deliveries are quarantined as `dead_letter` with `review_required_at` and `needs_review_legacy_attempt_unknown`; their original request bytes and first-attempt time cannot safely be reconstructed.
4. Deploy the new worker, webhook receiver and independent monitor. Configure the dedicated staging email provider account/domain and recipient before any authorized outbound rehearsal.
5. Configure the Resend callback, independent minute cron, and QStash sweep/retention schedules. Resume workers only after signatures, configuration, receipts and alerts are verified.
6. Reconcile quarantined items through provider records and the durable inquiry; do not clear the attempt count, first-attempt timestamp, or key to make a test pass.
7. Prepare the poster/manual rollback using this same inquiry implementation. Rolling back to a pre-enterprise worker can remove the new retry safeguards; do not use it while notifications are in flight.

No production migration or external message has been sent by implementing these files.

### All-trigger cutover hold and drain

This is an **unresolved hosted rehearsal gate**, not an implemented application maintenance flag. The deployment owner must record and demonstrate the host/provider controls used for the hold before migrating live data. If those controls cannot be established, do not perform an in-place live cutover.

1. Inventory the old and new deployment URLs, canonical delivery/sweep/retention endpoints, QStash account and schedule IDs, queued message destinations, retry policy, manual replay access, active worker leases and durable outbox counts. Save configuration references and counts without copying inquiry bodies or secrets into release evidence.
2. Pause delivery-producing schedules and retention during the migration window. Suspend manual replay, manual sweep invocation and provider-send operations. Apply an ingress hold to **every old worker and sweep endpoint**, including deployment-specific URLs still present in queued messages. Cover intake-triggered one-shot publishes, their retries, scheduled sweeps and manual invocations. A schedule pause does not pause messages already published by `POST /api/contact`.
3. Do not delete queued messages, schedules, jobs or accepted inquiries to create an empty queue. A blocked delivery must not return success as though work completed. Preserve retriable failures and account for messages whose broker retries expire; the durable outbox and later verified sweep remain the recovery authority.
4. Keep intake open only if its committed inquiry/outbox transaction remains available and every resulting wakeup is held before any old provider attempt. Never acknowledge acceptance before durable persistence. If this cannot be guaranteed, use an explicitly communicated temporary intake failure/maintenance response that preserves the visitor's entered data and retry reference; do not claim receipt. No such maintenance capability is assumed to exist without deployment evidence.
5. Wait for existing provider attempts to finish and reconcile their responses. Verify that no old worker is processing a lease or starting a provider request. Record the drain time and before-migration counts. A late or uncertain provider response requires reconciliation, not cancellation or a new idempotency key.
6. Apply the additive migration and deploy the new implementation while the hold remains effective. Confirm quarantine counts, request-snapshot/first-attempt columns, signatures, canonical destinations and independent alerts. Prove the protected worker on isolated authorized staging first. Old deployment URLs must remain unable to restart provider work after the canonical cutover.
7. Release the hold only to the verified new worker; resume schedules and inspect outstanding durable work, retained broker retries and incident state. Reconcile after-migration counts with accepted inquiries. Preserve existing keys, first-attempt times and attempt counts. The migration's one-time quarantine is not protection against an old worker that starts after it.

Record the responsible operator, exact controls, timestamps, evidence and rollback trigger for each step. Missing hold/drain evidence blocks migration even when local schema and worker tests pass.

### Staging infrastructure isolation and configuration inventory

Staging requires an isolated SQL database, **separate QStash account and separate Redis database**, dedicated provider account/domain and authorized recipients. Do not reuse production credentials or point a staging worker at production state. Provisioning or purchasing services is a separate authorized operational action; this runbook does not imply it has occurred.

The schedule configuration script uses fixed IDs, `gridninja-lead-sweep-v1` and `gridninja-lead-retention-v1`. Creating an existing QStash schedule ID replaces its configuration, so using another token for the same account can still retarget production schedules. Monitor locks and incident keys are also fixed within their Redis database. An isolated SQL database alone is insufficient. Shared QStash/Redis infrastructure would require an explicitly reviewed namespace change and fresh qualification. [Upstash schedule behavior](https://upstash.com/docs/qstash/features/schedules)

Before activation, record non-secret account/database/project identifiers, canonical origins, schedule IDs/destinations, provider webhook destinations and signing-key references for both environments. Compare the inventory before and after staging configuration and verify production destinations/state remain unchanged. Keep secrets and personal inquiry content out of the inventory. The deployment owner must approve this evidence before running `npm run contact:qstash:configure` with staging credentials.

## Provider request ownership and retries

Before an external request, the worker durably freezes the exact JSON body, target URL and first attempt time under its current lease. The provider key already persisted with the outbox is retained. Retries use the frozen bytes even after template or recipient configuration changes. A changed CRM destination is stopped for review instead of sending old inquiry data to a new destination. Removing optional CRM configuration after intake produces a durable configuration stop, including before its first prepared request; it cannot create an infinite claim/throw loop.

Provider, CRM, operator-alert and Turnstile requests explicitly reject HTTP redirects. A configured endpoint cannot silently forward inquiry data, verification credentials or signed payloads to another destination. A redirect is handled as a failed request under the existing bounded retry/recovery policy. The four loopback HTTP 307 regressions confirm that the original request is sent, a CRM signature remains on that original request, and the redirected destination receives no request. Provider credentials and CRM/alert endpoints remain privileged deployment configuration.

The internal email worker stops automatic resend at **23 hours** from the first provider attempt. The stop is persisted before attempting an alert, so a queue outage cannot reopen it. Resend documents a 24-hour idempotency window; the one-hour margin avoids relying on a key after expiry. This is bounded retry protection, not an exactly-once claim. A credential migration into a different provider account requires reconciliation; a key is not assumed to span accounts.

Frozen request bodies contain the same inquiry PII as the lead. The 180-day retention transaction clears the snapshots and lead PII together, invalidates actionable leases and retires unsent work. Request preparation locks and checks the same lead row before writing; stale workers cannot restore a snapshot after retention. Expired/redacted leads are excluded from claims. The 365-day lead deletion cascades matched provider events. Unmatched minimal callback events expire after seven days in bounded batches. Restore procedures must reapply retention before resuming delivery.

## Endpoints and configuration

| Endpoint | Authentication and purpose |
| --- | --- |
| `POST /api/webhooks/resend` | Exact raw-body Svix HMAC signature, five-minute attempt timestamp tolerance, current/previous signing secret |
| `GET /api/internal/lead-monitor` | Exact long `CRON_SECRET` bearer; independent of QStash |
| `POST /api/internal/lead-acknowledgement` | Separate long `LEAD_OPERATIONS_SECRET` bearer; explicit human acknowledgement |

Every shared request-body reader has a five-second deadline in addition to its byte limit. Intake, signed queue messages, acknowledgement, provider callbacks and CSP reports return HTTP 408 with `Cache-Control: no-store` when a body stalls. Timed-out intake never reaches verification or persistence; timed-out queue and acknowledgement requests never invoke their handlers.

New environment variables:

- `RESEND_WEBHOOK_SECRET`: endpoint-specific `whsec_...` secret.
- `RESEND_WEBHOOK_SECRET_PREVIOUS`: optional rotation overlap; remove after confirmed rotation.
- `CRON_SECRET`: at least 32 random characters, configured for the independent Vercel cron.
- `LEAD_OPERATIONS_SECRET`: separate secret of at least 32 random characters, restricted to authorized operators.

Retain `LEAD_ALERT_WEBHOOK_URL`, optional bearer token, existing Redis, database and provider settings. The direct alert sink must accept `monitor_incident`/`monitor_recovery` and honor `Idempotency-Key`.

Subscribe only to `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`, `email.complained`, and `email.suppressed`. Open and click callbacks are discarded. The receiver persists only event ID, provider message ID, matched outbox ID, event type and timestamps, never the provider payload, recipient, subject or body. Configure a dedicated sending application/account when possible.

An early callback is retained before the worker knows its provider message ID. Both callback processing and the independent monitor reconcile that race. Event IDs deduplicate retries. Unmatched callbacks older than five minutes require reconciliation; do not associate them using an email address or free text.

Acknowledgement request body:

```json
{"outboxId":"<outbox UUID>","operatorReference":"primary-operator","reviewedThrough":"2026-09-24T12:00:00.000Z"}
```

Set `reviewedThrough` to the timestamp through which the operator actually inspected the durable evidence. Retries keep that same cutoff. Events arriving later remain alertable; a late bounce cannot be hidden by an earlier acknowledgement. Use an assigned opaque operator identifier, not an email address. Keep its identity mapping in the access-controlled operational roster. Acknowledgement is idempotent and never changes the transport status or clears a retry review stop. Acknowledged terminal issues stop paging; the operator remains responsible for reconciliation and documenting resolution.

## Independent monitoring

The minute cron reads indexed queue/event data and persistent sweep/retention heartbeats. It does not publish to QStash. The existing Redis stores bounded incident identities and an overlap lease; the existing HTTPS operator webhook receives alerts directly.

Alert conditions:

- Sweep heartbeat absent or older than three minutes.
- Oldest due notification more than five minutes overdue.
- Unacknowledged terminal delivery, review stop, provider-recipient failure or configuration failure.
- Unmatched provider events older than five minutes.
- Retention heartbeat absent or older than 26 hours.
- Database unavailable or monitor deduplication/sink unavailable.

An active incident sends once and then one recovery. Pending alerts retain their identity across an uncertain sink response. When Redis is unavailable, direct bounded attempts use stable five-minute fallback IDs; the sink must deduplicate these. This failure mode can repeat an alert and is reported as degraded, never healthy. Unknown database state does not resolve existing queue incidents.

Configure an **external** availability monitor and host-native failure alerts as well: a cron cannot detect that its own host never invoked it. Verify the purchased hosting plan supports minute schedules. Vercel cron does not automatically retry failed invocations; inventory and reconcile schedules during rollback.

### Scheduler host, staging and rollback evidence

Native Vercel cron targets the project's **production deployment URL**. A normal protected Preview deployment does not establish that the minute monitor will run there. For native staging cron, use a separate staging project whose production deployment is the protected staging site; alternatively use an authenticated external scheduler independent of QStash. Record the chosen project/origin and how scheduler authentication passes deployment protection without exposing the rest of staging. A successful manual request is not proof of periodic invocation. [Vercel cron execution](https://vercel.com/docs/cron-jobs)

The configured minute interval requires Vercel **Pro or Enterprise** capability; Hobby allows daily cron and rejects more frequent schedules at deployment. Confirm the actual purchased plan and function limits before activation. Do not treat this requirement as authorization to purchase a plan. The scheduler must call the canonical route directly because Vercel cron does not follow redirects or automatically retry failures. Capture scheduled invocations, failures, alert/recovery delivery and external-monitor behavior. [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [cron operations](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

Pin an eligible fallback deployment that retains the enterprise worker safeguards and record its configuration compatibility. Current Vercel pages disagree on whether Instant Rollback restores cron schedules: the rollback page describes reverting them, while cron operations says active schedules remain unchanged. Reconcile the actual Vercel and QStash inventories explicitly before and after the rehearsal; do not assume either is restored by a frontend rollback. Environment configuration can also be stale in the fallback deployment. Keep the additive database schema and prohibit an older unprotected worker from accessing in-flight notifications. [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback), [cron rollback behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

Infrastructure isolation, all-trigger hold/drain, paid-host capability and observed scheduler/rollback behavior remain **external unresolved release gates** until their evidence is attached. Documentation and local tests do not satisfy them.

## Required staging rehearsal

Use an explicitly authorized origin, isolated durable database, dedicated recipients and actual verification settings. Missing settings fail qualification. Do not use real prospect inquiries as fixtures.

1. Observe browser acceptance, durable lead/outbox, frozen request/key/time, provider acceptance, signed recipient-delivery event and explicit operator acknowledgement.
2. Inject provider 429/500, timeout and successful-send/lost-response outcomes; verify exact bytes and stable keys.
3. Delay callbacks until before and after worker persistence; replay and reorder them; test signature rotation, modified raw bytes, stale/future timestamps and oversized input.
4. Simulate a stale worker lease, queue outage, DB outage, Redis outage, alert-sink outage and expired first-attempt window. Verify independent alerts and no late resend.
5. Verify dead-letter/review acknowledgement stops paging but does not requeue. Requeue only after checking provider records and recording an approved reconciliation procedure; never reset the safety clock automatically.
6. Restore to a separate restricted recovery branch; compare inquiry/outbox identities, reconcile provider outcomes, reapply retention, and only then resume workers. Do not replay restored outboxes indiscriminately.
7. Verify the poster-mode deployment retains the same inquiry safeguards and that its cron inventory remains correct.

Production go/no-go requires recorded real recipient delivery, alert acknowledgement, recovery timing, hosting capability and primary/backup owner assignments. Local unit/schema tests establish none of those external facts.

## Sources

- [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests) and [Svix manual signature verification](https://docs.svix.com/receiving/verifying-payloads/how-manual).
- [Resend delivery event meanings](https://resend.com/docs/webhooks/event-types) and [24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys).
- [Vercel cron operations](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
