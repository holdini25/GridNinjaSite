-- Operator-only psql template. Never called by application/build/migration code.
-- Read release-tonight-cutover.md; an approved private plan is executable SQL.
-- Required: -v plan_file=/private/plan.sql -v operation=fence|verify-held|restore
--           -v receipt_file=/private/new-receipt.json
\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on
\if :{?plan_file}
\else
  DO $$ BEGIN RAISE EXCEPTION 'Missing private plan_file'; END $$;
\endif
\if :{?operation}
\else
  DO $$ BEGIN RAISE EXCEPTION 'Missing operation'; END $$;
\endif
\if :{?receipt_file}
\else
  DO $$ BEGIN RAISE EXCEPTION 'Missing private receipt_file'; END $$;
\endif

SET statement_timeout = '30s';
SET lock_timeout = '2s';
SET idle_in_transaction_session_timeout = '30s';
BEGIN;
CREATE TEMP TABLE cutover_target (
  database_name text NOT NULL, database_oid oid NOT NULL,
  server_address inet NOT NULL, server_port integer NOT NULL,
  operator_name text NOT NULL, operator_oid oid NOT NULL
);
CREATE TEMP TABLE cutover_roles (
  role_oid oid PRIMARY KEY, role_name text UNIQUE NOT NULL,
  original_login boolean NOT NULL
);
CREATE TEMP TABLE cutover_operation AS SELECT :'operation'::text AS name;
\i :plan_file

DO $$
DECLARE target record;
BEGIN
  IF (SELECT count(*) FROM cutover_target) <> 1
     OR NOT EXISTS (SELECT 1 FROM cutover_roles)
     OR (SELECT name FROM cutover_operation) NOT IN ('fence', 'verify-held', 'restore') THEN
    RAISE EXCEPTION 'Invalid fence plan or operation';
  END IF;
  SELECT * INTO STRICT target FROM cutover_target;
  IF current_database() <> target.database_name
     OR (SELECT oid FROM pg_database WHERE datname = current_database()) <> target.database_oid
     OR inet_server_addr() IS DISTINCT FROM target.server_address
     OR inet_server_port() IS DISTINCT FROM target.server_port
     OR session_user <> target.operator_name OR current_user <> target.operator_name
     OR (SELECT oid FROM pg_roles WHERE rolname = session_user) <> target.operator_oid THEN
    RAISE EXCEPTION 'Database or independent operator identity mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cutover_roles p LEFT JOIN pg_roles r ON r.oid = p.role_oid
    WHERE r.oid IS NULL OR r.rolname <> p.role_name OR r.oid = target.operator_oid
      OR (r.rolcanlogin IS DISTINCT FROM CASE
        WHEN (SELECT name FROM cutover_operation) = 'fence' THEN p.original_login
        ELSE false END)
  ) THEN
    RAISE EXCEPTION 'Role identity/login drift or operator included in fence';
  END IF;
END $$;

-- Persist original states before any ALTER. Protect this file and private plan.
-- This records intent, not a successful hold; retain the separate exit/log result.
SELECT jsonb_pretty(jsonb_build_object(
  'status', 'validated-intent-not-completion', 'operation', (SELECT name FROM cutover_operation),
  'capturedAt', clock_timestamp(), 'target', (SELECT to_jsonb(t) FROM cutover_target t),
  'originalRoles', (SELECT jsonb_agg(to_jsonb(r) ORDER BY role_oid) FROM cutover_roles r)
)) \g :receipt_file

DO $$
DECLARE item record;
BEGIN
  IF (SELECT name FROM cutover_operation) = 'verify-held' THEN
    RETURN;
  END IF;
  FOR item IN SELECT * FROM cutover_roles ORDER BY role_oid LOOP
    EXECUTE format('ALTER ROLE %I %s', item.role_name, CASE
      WHEN (SELECT name FROM cutover_operation) = 'restore' AND item.original_login
      THEN 'LOGIN' ELSE 'NOLOGIN' END);
  END LOOP;
END $$;
COMMIT;

SELECT name <> 'restore' AS applying_fence FROM cutover_operation \gset
\if :applying_fence
  -- NOLOGIN is committed first. A later failure leaves logins disabled.
  -- Role attributes are cluster-wide: terminate these roles across ALL databases.
  DO $$
  DECLARE backend record;
  BEGIN
    FOR backend IN SELECT pid FROM pg_stat_activity
      WHERE usesysid IN (SELECT role_oid FROM cutover_roles) AND pid <> pg_backend_pid()
    LOOP
      IF NOT pg_terminate_backend(backend.pid, 5000) THEN
        RAISE EXCEPTION 'Session termination unconfirmed; fence stays closed';
      END IF;
    END LOOP;
  END $$;
  SELECT pg_stat_clear_snapshot();
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE oid IN (SELECT role_oid FROM cutover_roles) AND rolcanlogin)
       OR EXISTS (SELECT 1 FROM pg_stat_activity WHERE usesysid IN (SELECT role_oid FROM cutover_roles))
       OR EXISTS (SELECT 1 FROM pg_prepared_xacts WHERE owner IN (SELECT role_name FROM cutover_roles)) THEN
      RAISE EXCEPTION 'Fence verification incomplete; leave logins disabled and investigate';
    END IF;
  END $$;
  SELECT 'database-role-fence-observed; external execution drain and endpoint probes still required';
\else
  SELECT 'original-login-states-restored; old credentials and workers must remain inaccessible';
\endif
