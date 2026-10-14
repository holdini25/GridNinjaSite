# Assessment upgrade: executable cutover preparation

Prepared against `481bb8d` on `codex/assessment-yield-upgrade`. This is a local instruction package, **not authorization or evidence of a production cutover**. Use the latest reviewed commit and its frozen build identity if the candidate changes. The [release record](assessment-yield-release.md), [operations contract](assessment-yield-operations.md) and existing unresolved release gates remain authoritative.

| State | Meaning tonight |
| --- | --- |
| Ready locally | Read-only inventory and offline count-reconciliation helpers; rehearsal sequence; compatible rollback requirements. |
| Unperformed | Actual deployed build/runtime verification, database inspection, broker inventory, backup/restore, migration, provider rehearsal, holds and production deployment. |
| Blocked pending evidence | Actual database/service identities and credentials; host/broker hold controls; named primary/backup and commercial owner; recipient/alert authorization and operational thresholds; existing performance/manual release gates. |

Read-only Vercel API evidence at `build/qa/release-tonight-2026-10-13/vercel-production.json` identifies production project `prj_9JSTjPiUBQEC6VTv363zVm7EA54S`, deployment `dpl_DEjFoYdrgHQHRKPohyhau6VRJrzy`, Git SHA `bbeb94bd98ee76b1aab149ad3b4ce92622e47f01`, and immutable host `gridninja-6k04milzg-holdini25s-projects.vercel.app`. Collection time is 2026-10-14 01:14 UTC (13 October locally). The project is Git-linked and currently configured for Node 24.x, but the subsequent deployment-specific receipt `vercel-deployment.json` at 01:16 UTC identifies this actual deployment as Node **22.x**, matching that commit's package. Current project settings do not retroactively identify the deployed runtime. The separate candidate project `prj_hH2kKfAMVQxoxUSRzLdVGxBptt8k` was created with Node 22.x, no Git linkage and an initially empty environment; this is not production promotion or service isolation evidence.

The recorded project configuration exposes `DATABASE_URL` for Production and Preview plus four production verification/origin keys, without values. The actual deployment receipt also lists no application QStash, Redis, Resend or alert configuration keys and no Vercel crons. These observations do **not** establish distinct databases, broker emptiness, all-path holds, or configuration of every old deployment. Historical source inspection at `bbeb94b` finds journal `0000`/`0001` and the old delivery/sweep/retention/alert endpoints. `vercel-deployments.json` at 01:16 UTC records the complete hosting deployment/URL inventory; use every retained old URL in the hold ledger, not only the current production alias. Actual applied migrations, broker retries and old-worker authority still require inspection. No live database query or send was performed by this package. No people are available for tonight's remaining human checks; those records remain unperformed. The public delivery profile stays unpublished; CRM stays off. Do not recruit or add research requirements through this runbook.

## 1. Establish the private inventory before connecting

The release operator records evidence in an access-controlled ledger, outside Git, public artifacts and chat. Use opaque references in the shareable disposition. Do not paste environment values, connection strings, tokens, recipient addresses, inquiry records or provider payloads into terminal logs.

| Inventory | Read-only source and required facts |
| --- | --- |
| Deployments | Hosting project/account; production and every preview/old deployment ID; Git SHA; actual build/attestation; canonical aliases and deployment-specific origins; environment scope and service ownership. A Git branch label alone is insufficient. |
| Database | Hosting integration plus database console: provider account/project/branch/database, region, role and endpoint. Determine whether Production and Preview share a target. Verify TLS and a dedicated SELECT/catalog role. Record approved target digest privately. |
| Schema | Actual tables/enums/defaults/constraints/indexes/triggers/ownership, migration journal schema/table, each applied timestamp and SQL checksum. Compare current `0000`, `0001`, `0002`; do not introduce the historical removed `0003`. |
| Send paths | Each QStash schedule, pending message, delayed retry, dead-letter/replay entry and destination; direct/internal/manual delivery and sweep calls; intake wakeups; worker deployments; old URLs; provider in-flight attempts. Inventory message metadata only, without payload export. |
| Other stateful services | Redis/account/namespace, provider sender/account/credential binding, callback URL/key-account bindings, monitor scheduler, alert destination and external watchdog. A successful HTTP status is not proof of health or delivery. |

Use authenticated provider/hosting/broker consoles or their **read-only list/inspect** operations; retain screenshots/exports privately after checking for secrets. Do not run `contact:qstash:configure`, replay messages, alter schedules or call worker endpoints during discovery. The helper below does not inspect hosting or broker state and cannot infer omitted old URLs.

## 2. Run the bounded read-only inventory

Use repository Node 22 and npm. A private shell/secret manager supplies environment values; commands below intentionally contain no credentials. Disable shell tracing, use a protected output directory and `umask 077`. Do not load an unknown `.env` or fall back to the application's `DATABASE_URL`.

```sh
node scripts/qa/cutover-inventory.mjs --offline
```

This reads only repository files and prints the exact migration hashes and column-snapshot hashes. It opens no database connection. `ready-local-package` means the helper is prepared, not that the application or deployment is qualified.

Set **`CUTOVER_DATABASE_URL`** to the separately verified target in the private process environment. The connection must name PostgreSQL, an explicit user/database and a literal loopback address or approved remote host. Remote URLs require `sslmode=require` or `sslmode=verify-full`; both use certificate verification. `channel_binding=require` is supported. Routing overrides, other query options, duplicate options and trailing-dot aliases are rejected. Unsupported provider configurations require review, not weaker TLS.

```sh
node scripts/qa/cutover-inventory.mjs --target-digest
```

This prints only a SHA-256 of normalized host/port/database and local repository metadata; it does not connect. A digest computed from the same URL is **not independent authorization**. Compare it to the target already verified through the owning console and record approval before supplying `CUTOVER_EXPECTED_TARGET_SHA256`. The digest is a correlation aid, not proof of provider ownership or physical cluster identity.

For a separately authorized remote target, supply `CUTOVER_AUTHORIZATION=authorized-target-read-only` and the approved digest. For a disposable literal `127.0.0.1` or `::1` target, supply `CUTOVER_AUTHORIZATION=local-read-only`. `localhost` is deliberately not treated as literal loopback. No remote inventory is authorized merely by reading this document.

```sh
node scripts/qa/cutover-inventory.mjs --database > "$CUTOVER_PRIVATE_DIR/inventory-before.json"
```

The helper uses one repeatable-read/read-only transaction, five-second statement and connection deadlines, one-second lock timeout, and rollback. It prints hashes and fixed aggregate counts only, preserving large counts as decimal strings. Unknown tables, row-level security, failed connections and missing access stay unavailable; failure exits 2. It does not write application rows, apply migrations, take locks for update, send messages or change queues. Use it off peak if table scans could matter. A connection failure's raw driver text is suppressed because it may contain target details.

Review the output rather than its exit status alone. `observed-not-qualified` is an observation, including possible journal mismatch. A matching `0001` prefix and column snapshot are necessary for this rehearsal, **not sufficient**: independently review the complete schema and migration effects. Constraint/index fingerprints permit comparison but do not prove expected semantics. Catalog identity hashes can change under role, proxy or server changes; record the owning-console identity separately. The helper deliberately cannot prove all-path holds or that zero live leases means no provider call remains in flight.

## 3. Prove the hold, then drain

Before any live claim/migration, the operator must establish a hold with actual **host and broker controls**. There is no application global maintenance flag in this implementation. Write the exact control and verification for every inventory row; a paused schedule alone fails this gate.

1. Block every old/new worker and sweep entry point at all deployment-specific URLs, including queued retries and manual callers. Suspend schedules and replay access; prevent already queued broker deliveries from bypassing the host restriction. Keep callback observation available where it can safely persist evidence.
2. Hold intake-triggered delivery wakes. Keep durable intake open only if every old send path is demonstrably held; otherwise use an honest temporary failure that does not claim receipt. Disable production intake in study/restore environments. Pause retention during the schema cutover.
3. Drain old function executions and started provider requests. Observe hosting/broker/provider evidence for outstanding executions, acknowledged or unknown attempts and delayed retries; do not estimate drain solely from database lease expiry. Record start/end times, reviewers and late outcomes. Reconcile uncertain sends without new keys or reset counters/clocks.
4. Take read-only inventory snapshots after the controls are effective and draining has completed. Verify no old URL can acquire send authority, including after deployment/alias changes. If a hold or drain cannot be demonstrated, stop: **no in-place migration**.

This package supplies no automatic pause/cancel command because the actual hosting and broker resources are still unknown. Do not describe proposed controls as active controls. A failed hold means sends remain held by a verified alternative or rollout remains blocked, never “probably drained.”

## 4. Back up and restore into isolated infrastructure

After the source identity and hold are verified, use the database owner's supported consistent backup/export procedure. Record the recovery point, journal/schema identity, backup checksum, encrypted storage reference and retention/access owner. Backups can contain PII; they do not belong under the repository's ignored `build/` directory or in shared logs. A backup file existing is not a successful restore.

For a PostgreSQL custom-format export, the following are **future operator instructions**, not actions executed by this package. Private libpq service entries must already point to independently approved targets; service names are opaque, with credentials in protected files. Use a PostgreSQL client version compatible with the server.

```sh
pg_dump --format=custom --no-owner --no-privileges --file="$CUTOVER_PRIVATE_DIR/baseline.dump" --dbname="service=$CUTOVER_SOURCE_SERVICE"
```

Provision a new disposable local cluster or independently verified isolated database, with no production outbound credentials, no schedulers and blocked provider/CRM/alert egress. A different database name or Preview label alone does not prove isolation. Record its distinct owning-console identity and exact connection target. Do not restore over any serving database.

```sh
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="service=$CUTOVER_RESTORE_SERVICE" "$CUTOVER_PRIVATE_DIR/baseline.dump"
```

Before that restore command, independently match the restore service to the approved empty isolated target. Restore is a mutation requiring its own target verification; the read-only inventory authorization is not restore authorization. Check restore exit status and complete logs privately. Verify row counts, journal/checksums, schema semantics, critical identity/key/counter preservation and application read access against the recovery point. Counts alone cannot prove restored bytes. Any post-recovery-point acceptance/provider activity needs a separate reconciliation ledger; do not overwrite it during recovery.

## 5. Rehearse additive `0002` on the isolated restore

Proceed only when the restored schema and complete journal match reviewed `0000`/`0001`. An already migrated or divergent database needs its own reviewed path; do not edit applied migration files, journal rows or historical state to force a match. All workers, schedules and outbound traffic remain disabled throughout this rehearsal.

1. Bind `CUTOVER_DATABASE_URL` to a read-only role on the isolated restore; record `inventory-before.json` there. Record a separate migration credential for **that same target**. Inspect `0002_delivery_safeguards.sql`, including quarantine DML, before executing anything.
2. Run the normal migration command against only the verified isolated target. The operator supplies `CUTOVER_REHEARSAL_MIGRATION_DATABASE_URL` privately and verifies its host/port/database digest independently before this command. No deployment is launched by it.

```sh
DATABASE_URL="$CUTOVER_REHEARSAL_MIGRATION_DATABASE_URL" npm run db:migrate
node scripts/qa/cutover-inventory.mjs --database > "$CUTOVER_PRIVATE_DIR/inventory-after.json"
node scripts/qa/cutover-reconcile.mjs "$CUTOVER_PRIVATE_DIR/inventory-before.json" "$CUTOVER_PRIVATE_DIR/inventory-after.json"
```

3. Require a matching `0002` journal and column snapshot plus independent schema review. Reconcile unchanged submission/outbox totals, redacted totals, accepted transport states and unattempted pending work. Previously attempted pending/retrying work and all processing rows must become `dead_letter` with `legacy_attempt_unknown`; leases clear. Compare exact quarantine and per-state counts. No request body, account, first-send clock, callback, provider attempt or human acknowledgement may be invented for historical work. Verify preserved IDs, idempotency keys, attempt counts and original timestamps privately; the count helper cannot establish these.
4. The offline comparator reports `counts-match-not-qualified` only for a matching same-target `0001` → `0002` observation with the prescribed transitions. Missing counts, active leases, unexpected changes or different targets block it. Its unsigned inputs are not independently authenticated evidence. Empty restored tables cannot exercise quarantine cases; retain the separate synthetic regression evidence below.
5. Rehearse retention and uncertainty on **synthetic fixtures in a separate disposable database**, never by editing a real inquiry's deadlines. The existing required integration runner creates and removes its own local cluster and covers legacy quarantine, reservation/retention contention, late acceptance, callback reconciliation, replay/conflict and deletion. Run when coordinated with the release owner:

```sh
node scripts/qa/run-isolated-database.mjs
```

Record the exact commit, migration hashes, runner report and failures. Check 180-day redaction clears PII and snapshots while retiring sendable work; 365-day deletion cascades; seven-day unmatched callback expiry does not reset on replay. Unknown in-flight outcomes stay review-required and never gain a new send window. This isolated suite is not deployed retention, restore or provider-delivery proof.

## 6. Compatible rollback and eventual release

Prepare the rollback artifact from this same reviewed branch with **the current delivery safeguards retained**. If a visual fallback is selected, choose `FACILITY_3D_MODE=poster` or `manual`, rebuild and qualify that exact source/settings/build through the existing gates before it is needed. The fallback is not built by this package. No old pre-safeguard worker is an acceptable rollback against migrated work; changing visual modes does not repair inquiry defects or qualify an unmeasured build.

For server rollback, first re-establish the all-path hold and drain. Deploy only the reviewed compatible artifact or keep sends held while preparing a forward fix. Preserve the additive schema, receipts, frozen bodies/identity, reservations, quarantine, counters/clocks, callbacks, acknowledgements and retention semantics. Do not drop tables, erase incidents, reset keys, or restore an old database snapshot over later acceptances as a routine rollback.

In an authorized isolated rehearsal, verify both the candidate and rollback artifact can read the migrated database; inspect Home/Demo/static posters, selection and frozen downloads, inquiry receipt recovery, and authenticated endpoint behavior. Record recovery time and exact hashes. A database restore has a separate recovery-point reconciliation for every subsequent acceptance and external provider action.

Only after all applicable release gates and operational evidence are complete may the release owner authorize live mutation. Deploy compatible code while holds remain, validate configuration and authenticated endpoints, then run designated-recipient synthetic staging rehearsal. Distinguish durable receipt, provider acceptance, signed recipient observation and real operator acknowledgement. Prove late adverse-event escalation, independent monitor execution and external missing-heartbeat supervision. Keep CRM off and public profile absent. Name primary/backup operators and owner-selected thresholds before activation; no public SLA is inferred.

The final private ledger records: candidate/rollback identities, actual deployment/schema/service identities, all-path hold/drain evidence, backup/restoration receipts, pre/post inventory, migration and synthetic regression receipts, provider/account binding, designated recipients, monitor/watchdog proof, operator/commercial responsibility, remaining gate dispositions and the release owner's timestamp. Open gates stay unperformed or blocked. No command in this document is evidence that the step occurred.
