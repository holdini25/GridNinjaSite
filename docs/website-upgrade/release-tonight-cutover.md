# Assessment upgrade: executable cutover preparation

Prepared against `481bb8d` on `codex/assessment-yield-upgrade`. This is a local instruction package, **not authorization or evidence of a production cutover**. Use the latest reviewed commit and its frozen build identity if the candidate changes. The [release record](assessment-yield-release.md), [operations contract](assessment-yield-operations.md) and existing unresolved release gates remain authoritative.

| State | Meaning tonight |
| --- | --- |
| Ready locally | Read-only inventory and offline count-reconciliation helpers; synthetic migration/backup/restore and role-fence rehearsals passed; compatible rollback requirements prepared. |
| Unperformed | Deployed build attestation, production database inspection, broker inventory, production backup/restore/migration, provider rehearsal, holds and production deployment. |
| Blocked pending evidence | Actual database/service identities and credentials; host/broker hold controls; named primary/backup and commercial owner; recipient/alert authorization and operational thresholds; existing performance/manual release gates. |

Read-only Vercel API evidence at `build/qa/release-tonight-2026-10-13/vercel-production.json` identifies production project `prj_9JSTjPiUBQEC6VTv363zVm7EA54S`, deployment `dpl_DEjFoYdrgHQHRKPohyhau6VRJrzy`, Git SHA `bbeb94bd98ee76b1aab149ad3b4ce92622e47f01`, and immutable host `gridninja-6k04milzg-holdini25s-projects.vercel.app`. Collection time is 2026-10-14 01:14 UTC (13 October locally). The project is Git-linked and currently configured for Node 24.x, but the subsequent deployment-specific receipt `vercel-deployment.json` at 01:16 UTC identifies this actual deployment as Node **22.x**, matching that commit's package. Current project settings do not retroactively identify the deployed runtime. The separate candidate project `prj_hH2kKfAMVQxoxUSRzLdVGxBptt8k` was created with Node 22.x, no Git linkage and an initially empty environment; this is not production promotion or service isolation evidence.

The recorded project configuration exposes `DATABASE_URL` for Production and Preview plus four production verification/origin keys, without values. The actual deployment receipt also lists no application QStash, Redis, Resend or alert configuration keys and no Vercel crons. The subsequent complete `vercel-historical-config.json` at 01:18 UTC confirms this absence across all **34 READY deployments**: their combined application-service names are only `DATABASE_URL` and those four verification/origin keys, with no Vercel crons. These observations narrow the configured hosting paths; they do **not** establish distinct databases, external broker emptiness, manual-caller authority or an active all-path hold. Historical source inspection at `bbeb94b` finds journal `0000`/`0001` and the old delivery/sweep/retention/alert endpoints. `vercel-deployments.json` at 01:16 UTC records the complete hosting deployment/URL inventory; use every retained old URL in the hold ledger, not only the current production alias. Actual applied migrations, broker retries and old-worker authority still require inspection. No live database query or send was performed by this package. No people are available for tonight's remaining human checks; those records remain unperformed. The public delivery profile stays unpublished; CRM stays off. Do not recruit or add research requirements through this runbook.

### Executed isolated rehearsal

At 2026-10-14 01:20:36 UTC, Node **22.23.2** and PostgreSQL/`pg_dump`/`pg_restore` **16.15** completed the explicitly assigned disposable target `127.0.0.1:55483/gridninja_cutover_rehearsal`, user `gridninja_release`. Only synthetic fixtures were used; HTTP, provider and broker actions were zero. The production credential retrieval remained blocked (`decrypted:false`); no production database was contacted. The root operator owns the cluster and cleanup; the migrated synthetic database was retained for inspection.

```sh
node build/qa/release-tonight-2026-10-13/cutover-rehearsal.mjs
```

The retained script first asserted an empty exclusive database, copied the exact `0000`/`0001` SQL bytes and first two journal entries into a temporary migration directory, and applied them through the normal Drizzle PostgreSQL migrator. It seeded eight synthetic inquiries/outboxes covering untouched pending work, previously attempted pending/retry work, processing with an expired lease, provider-accepted work, a dead letter and a redacted inquiry. It backed up the baseline, deleted **only these synthetic inquiries**, restored the dump and asserted exact equality of every restored inquiry/outbox/journal row with the pre-backup state. It then applied repository `0002` through Drizzle, executed the actual read-only inventory helper before/after, and passed all 21 offline reconciliation checks.

The exact PostgreSQL subprocess commands were:

```sh
pg_dump -h 127.0.0.1 -p 55483 -U gridninja_release -d gridninja_cutover_rehearsal --format=custom --no-owner --no-privileges --file=build/qa/release-tonight-2026-10-13/cutover-local-rehearsal/synthetic-baseline.dump
pg_restore -h 127.0.0.1 -p 55483 -U gridninja_release -d gridninja_cutover_rehearsal --clean --if-exists --exit-on-error --single-transaction --no-owner --no-privileges build/qa/release-tonight-2026-10-13/cutover-local-rehearsal/synthetic-baseline.dump
```

`--clean` was authorized **only for this exclusive disposable synthetic database**; it is not a production recovery command. The script refuses a nonempty starting database and must not be blindly rerun against the now-migrated target. Exact script, commands, redacted inventories, reconciliation, backup and result are retained under `build/qa/release-tonight-2026-10-13/cutover-local-rehearsal/` with the script/log in its parent. The backup there is exclusively synthetic; real backups remain outside the repository.

Results: eight inquiries and eight outboxes restored; three exact legacy outbox IDs quarantined; zero live leases; zero fabricated attempts/events/acknowledgements or frozen request bodies. Separate exact comparisons confirmed preservation of outbox IDs, lead IDs, idempotency keys, claim counts, creation clocks and existing provider-acceptance clocks. Backup SHA-256: `03da33d1d5e5c89b909e33496a8f84343571b0fc97e410edc218f0f5b06c9f66`; restored full-state SHA-256: `0b3f0f1fd5bdc30d79f9fd15ef5d7a13e02d8d99584edd0bd31c7c38a7e46138`. These are local synthetic receipts, not deployed database, operational hold, retention execution, recipient delivery or rollback-build qualification.

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

## 3. Fence database claims across all URLs, then drain external executions

There is no application global maintenance flag. The concrete proposed fence is **disable every application login role, commit that change, then terminate its existing database sessions**, using a separate operator credential. It prevents new database claims only after the complete authentication inventory is verified. It does not revoke an already issued provider request or a claim already held in a function's memory. No production fence has been applied.

Vercel's [pause API](https://vercel.com/docs/rest-api/projects/pause-a-project) documents blocking the active Production Deployment. That is not evidence that all 34 READY historical deployments or their immutable URLs are blocked. Future operators may pause the approved production project through its authenticated console/API and verify the result, but must retain the old-URL inventory and the database fence below. Do not invoke delivery endpoints merely to test a hosting restriction.

### 3a. Verify every credential path and an independent operator

Before executing the template, privately map **every** production/preview/old/new deployment, direct and pooled URL, manual/CI script, console action, HTTP database gateway and broker destination to its actual PostgreSQL authentication role. Include login roles that can `SET ROLE` or inherit application grants: disabling only a NOLOGIN writer/group role is insufficient. Inventory all roles, memberships and sessions, not just currently active app sessions. Review provider-specific proxy authentication: if a gateway retains a privileged shared login, can create replacement sessions independently, or bypasses PostgreSQL LOGIN checks, this template alone is insufficient. The provider must supply and demonstrate an equivalent deny rule covering that gateway and all endpoints, or migration stays blocked.

Use the separately approved operator connection for this private, read-only inventory (no query text or password hashes):

```sql
SELECT current_database(), d.oid AS database_oid, inet_server_addr(),
       inet_server_port(), session_user, r.oid AS operator_oid
FROM pg_database d JOIN pg_roles r ON r.rolname = session_user
WHERE d.datname = current_database();
SELECT oid, rolname, rolcanlogin, rolsuper, rolcreaterole, rolbypassrls,
       has_database_privilege(oid, current_database(), 'CONNECT') AS can_connect
FROM pg_roles ORDER BY oid;
SELECT roleid, member, grantor, admin_option, inherit_option, set_option
FROM pg_auth_members ORDER BY roleid, member;
SELECT pid, datname, usesysid, usename, backend_start, state
FROM pg_stat_activity ORDER BY usesysid, pid;
SELECT owner, database, count(*) FROM pg_prepared_xacts GROUP BY owner, database;
```

Reconcile the full list against the owning-console database/branch identity and every credential source. Record an explicit disposition for each login role, including provider administration roles. **Before changing LOGIN, stop connection initiators and retries**: suspend broker schedules/replays/manual triggers and use host/proxy controls to prevent old/new functions or gateway pools from beginning more connections. Freeze concurrent credential creation/rotation, role grants, automated provisioning and operator changes during the hold. Unknown or excluded roles capable of application writes invalidate an all-path claim. Role changes are cluster-wide; verify and authorize effects on every database using a selected role. Shared unrelated workloads need a separately reviewed fence.

The fence/migration operator must be a distinct login unavailable to every app, old deployment, broker and manual sender. Verify it can alter the selected roles and terminate their sessions while remaining connected; a managed provider may not grant these capabilities. PostgreSQL [role alteration](https://www.postgresql.org/docs/16/sql-alterrole.html) has role-administration restrictions. [Session termination](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL) with a positive timeout waits for termination; insufficient privileges or a timeout must leave the fence closed. Do not give the new operator credential to workers to get around the fence.

### 3b. Execute the reviewed role fence

Copy the independently verified values into a **new private plan**, preserving original LOGIN states and role OIDs. For example, the following illustrates the required SQL shape; the sample names/OIDs are not production values:

```sql
INSERT INTO cutover_target VALUES
  ('reviewed_database', 42000, '127.0.0.1', 5432, 'independent_operator', 42001);
INSERT INTO cutover_roles VALUES
  (42002, 'reviewed_application_login', true),
  (42003, 'reviewed_manual_login', true),
  (42004, 'reviewed_already_disabled_role', false);
```

The plan is executable SQL, so it must be reviewed, owner-controlled and contain only the two INSERTs. Store it and receipts outside the repository with `umask 077`; preserve its checksum. The protected libpq service below must resolve to the independently verified target/operator using certificate-verified TLS. A matching server address is an additional check, not provider identity proof.

```sh
psql -X -w --dbname="service=$CUTOVER_OPERATOR_SERVICE" \
  -v plan_file="$CUTOVER_PRIVATE_DIR/role-plan.sql" \
  -v operation=fence \
  -v receipt_file="$CUTOVER_PRIVATE_DIR/role-fence-intent.json" \
  -f scripts/qa/cutover-role-fence.sql \
  > "$CUTOVER_PRIVATE_DIR/role-fence.log" 2>&1
```

The template rejects database/operator mismatch, missing/renamed roles, changed original login state and a plan containing its own operator. It writes a private original-state receipt **before** altering roles. A receipt records validated intent, not completion. It changes only LOGIN, commits NOLOGIN before termination, terminates sessions authenticated under the selected role OIDs across all databases, and rejects remaining sessions or prepared transactions. Later failure never automatically reopens logins; inspect the exit code and log and keep the fence closed. Missing receipt storage aborts before mutation. Use unique receipt paths and never overwrite the original fence record.

Afterward, use private credentials to attempt fresh harmless `SELECT 1` connections through **each direct, pooled and HTTP database access path**. Each app identity must fail before a query executes, while the independent operator remains usable. A connection whose startup overlapped the role change may appear after the first scan. Read the actual server `SHOW authentication_timeout`, but do not use it alone as the drain bound: [PostgreSQL 16 startup code](https://raw.githubusercontent.com/postgres/postgres/REL_16_STABLE/src/backend/utils/init/postinit.c) disables it before later startup work and activity registration, so post-authentication startup/locks need separate coverage. Obtain provider-specific bounds covering **post-authentication startup and locks**, gateway queues and pool retries; account for the full combined maximum after initiators stopped. An unknown or unbounded path blocks completion and requires a provider-level connection drain with evidence. After that bounded drain, repeat termination and verification with the original private plan and a new receipt:

```sh
psql -X -w --dbname="service=$CUTOVER_OPERATOR_SERVICE" \
  -v plan_file="$CUTOVER_PRIVATE_DIR/role-plan.sql" \
  -v operation=verify-held \
  -v receipt_file="$CUTOVER_PRIVATE_DIR/role-fence-delayed-check.json" \
  -f scripts/qa/cutover-role-fence.sql \
  > "$CUTOVER_PRIVATE_DIR/role-fence-delayed-check.log" 2>&1
```

`verify-held` requires all selected roles still NOLOGIN; it performs no role alteration, repeats termination, clears the statistics snapshot and checks zero sessions/prepared transactions. Repeat this check after the controlled denied retries and retain timing evidence. Reconcile every path in the inventory. One zero-session snapshot or one refused direct connection is insufficient; the local template cannot attest remote gateway behavior or inventory completeness.

### 3c. Drain old work and preserve observations

Keep the previously established broker, retry, manual-trigger and host holds active. Keep intake closed with an honest temporary failure while its database role is fenced. Pause retention. Callback requests sharing fenced roles cannot persist observations: arrange a provider-supported retry/retention window and reconcile the signed event history afterward, or establish a separately reviewed observation-only identity with no claim/send authority. Do not silently drop callbacks or claim observations were retained.

Drain **all already running old/new/manual sender executions**, including a process paused between its successful claim and its HTTP call. Inspect host execution and provider/broker evidence; wait for verified execution completion or terminate it and reconcile uncertainty. A lease expiring, terminating its DB session or pausing future wakes does not stop an external HTTP request. If execution drain cannot be proved, keep claims fenced and use an independently approved provider-key/egress revocation that covers those callers; provider acceptance already in flight still needs reconciliation. No backup/migration until the all-path claim fence and external-execution drain are both evidenced.

### 3d. Reopen only qualified identities

Keep the fence throughout backup, restore rehearsal and migration. Before reopening a role, qualify the safeguard-compatible worker and ensure old deployments/manual callers can no longer authenticate under it. Rotate/retire every credential exposed to an old worker, including pooled/API variants, and provide replacements only to the approved worker. Otherwise restoring LOGIN would reopen historical URLs. Roles still used by unsafe callers remain NOLOGIN. Keep broker/host holds during this transition.

Use the preserved original receipt to make a reviewed restore plan for only the approved subset, with unchanged role OIDs and original LOGIN booleans; retain the original complete plan separately. Never infer original state from the now-fenced catalog. For the same verified database/operator, run:

```sh
psql -X -w --dbname="service=$CUTOVER_OPERATOR_SERVICE" \
  -v plan_file="$CUTOVER_PRIVATE_DIR/approved-role-restore-plan.sql" \
  -v operation=restore \
  -v receipt_file="$CUTOVER_PRIVATE_DIR/role-restore-intent.json" \
  -f scripts/qa/cutover-role-fence.sql \
  > "$CUTOVER_PRIVATE_DIR/role-restore.log" 2>&1
```

Restore rejects identity drift and any selected role already reenabled; it restores only the original LOGIN boolean, retaining NOLOGIN for originally disabled roles. Verify old credentials still fail, approved credentials reach only the qualified workers, and unchanged counters/keys and callback reconciliation remain sound before resuming schedules. This is a future authorized operation, not a hold or restoration already performed.

### Executed synthetic role-fence verification

At 2026-10-14 01:29:05 UTC the final SQL template passed eight checks on the assigned local disposable database, using four unique synthetic application roles and a separate non-superuser operator. Wrong target and unwritable receipt aborted without role changes; existing direct and `SET ROLE` sessions terminated; an uncommitted synthetic claim rolled back; all four new connections failed with SQLSTATE `28000`; repeated `verify-held` retained NOLOGIN; the operator stayed usable; restore exactly preserved the two originally disabled roles. The isolated probe schema and every temporary role were removed, with zero existing application-fixture changes or other-database queries. No HTTP/provider/broker action occurred. Script and final receipts: `build/qa/release-tonight-2026-10-13/cutover-role-rehearsal.mjs` and `cutover-role-rehearsal-2/report.json`; the earlier seven-check attempt remains preserved separately. This validates native PostgreSQL mechanics, not a delayed-startup race, an uninspected production proxy or completed all-path hold.

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
