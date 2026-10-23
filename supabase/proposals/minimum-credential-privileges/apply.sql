-- CONTROLLED CHANGE: applied with confirmed COMMIT on 2026-10-23; verify.sql passed.
-- Evidence and pending functional checks: docs/minimo-privilegio-credenciales.md.
-- Do not rerun: the original ACL preflight must fail on the hardened database.
-- Target: Supabase grjxcsngfnxdkkdkkujh, existing database only.
-- Intentionally outside supabase/migrations: no migration history is asserted.
-- Execute as table owner/authorized administrator, never as an application role.
-- Requires PostgreSQL 17+ (MAINTAIN) and current_user = postgres.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE public.credenciales IN ACCESS EXCLUSIVE MODE;

DO $minimum_privileges$
DECLARE
  target_table text;
  target_role text;
  privilege_name text;
  relation_id oid;
  expected boolean;
  protected_before jsonb;
  protected_after jsonb;
  original_acl jsonb;
  actual_acl jsonb;
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'PostgreSQL 17+ required for MAINTAIN.';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run with current_user = postgres to preserve the verified grantor.';
  END IF;
  SELECT jsonb_agg(jsonb_build_array(r.role_name, 'postgres', p.privilege_name, false)
    ORDER BY r.role_name, p.privilege_name)
  INTO original_acl
  FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')) r(role_name)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                     ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(privilege_name);

  SELECT jsonb_agg(jsonb_build_array(r.role_name, t.table_name, p.privilege_name,
    has_table_privilege(r.role_name, t.table_name, p.privilege_name),
    CASE WHEN p.privilege_name IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
      THEN has_any_column_privilege(r.role_name, t.table_name, p.privilege_name)
      ELSE NULL END) ORDER BY r.role_name, t.table_name, p.privilege_name)
  INTO protected_before
  FROM (VALUES ('service_role'), ('postgres')) r(role_name)
  CROSS JOIN (VALUES ('public.credenciales')) t(table_name)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                     ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(privilege_name);

  FOREACH target_table IN ARRAY ARRAY['public.credenciales'] LOOP
    relation_id := to_regclass(target_table);
    IF relation_id IS NULL THEN
      RAISE EXCEPTION 'Missing table: %', target_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE oid = relation_id AND relkind = 'r'
        AND relrowsecurity AND NOT relforcerowsecurity
        AND relowner = 'postgres'::regrole
    ) THEN
      RAISE EXCEPTION 'Unexpected table/RLS baseline: %', target_table;
    END IF;

    SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantee),
      pg_get_userbyid(x.grantor), x.privilege_type, x.is_grantable)
      ORDER BY pg_get_userbyid(x.grantee), x.privilege_type)
    INTO actual_acl
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE c.oid = relation_id;
    IF actual_acl IS DISTINCT FROM original_acl THEN
      RAISE EXCEPTION 'Direct ACL differs from verified eight-privilege baseline: %', target_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE a.attrelid = relation_id AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      RAISE EXCEPTION 'Unexpected column ACL: %', target_table;
    END IF;

    -- Original eight effective permissions and direct ACL verified by the owner.
    -- A second application after success fails this baseline check deliberately.
    FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
      ] LOOP
        IF NOT has_table_privilege(target_role, relation_id, privilege_name) THEN
          RAISE EXCEPTION 'Baseline changed: % % on %', target_role, privilege_name, target_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
-- RESTRICT is explicit: do not cascade into grants of service_role/postgres/others.
-- Table-level grants only. Abort on PUBLIC/column/inherited baseline drift; never cascade.
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.credenciales FROM anon RESTRICT;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.credenciales FROM authenticated RESTRICT;
-- Both application roles have no direct table privileges; backend uses service_role.

  FOREACH target_table IN ARRAY ARRAY['public.credenciales'] LOOP
    relation_id := to_regclass(target_table);
    FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
      ] LOOP
        expected := false;
        IF has_table_privilege(target_role, relation_id, privilege_name) IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'Effective privilege mismatch: % % on %. Inspect PUBLIC/inheritance/ownership.',
            target_role, privilege_name, target_table;
        END IF;
      END LOOP;
      -- Column grants can survive a table REVOKE. Fail rather than silently widen scope.
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        expected := false;
        IF has_any_column_privilege(target_role, relation_id, privilege_name) IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'Effective column privilege mismatch: % % on %. Inspect column ACLs.',
            target_role, privilege_name, target_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  -- Abort also if inheritance caused an effective change to protected roles.
  SELECT jsonb_agg(jsonb_build_array(r.role_name, t.table_name, p.privilege_name,
    has_table_privilege(r.role_name, t.table_name, p.privilege_name),
    CASE WHEN p.privilege_name IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
      THEN has_any_column_privilege(r.role_name, t.table_name, p.privilege_name)
      ELSE NULL END) ORDER BY r.role_name, t.table_name, p.privilege_name)
  INTO protected_after
  FROM (VALUES ('service_role'), ('postgres')) r(role_name)
  CROSS JOIN (VALUES ('public.credenciales')) t(table_name)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                     ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(privilege_name);
  IF protected_before IS DISTINCT FROM protected_after THEN
    RAISE EXCEPTION 'Protected role effective privileges changed; entire change aborted.';
  END IF;
END;
$minimum_privileges$;

-- No ALTER TABLE/POLICY/ROLE/DEFAULT PRIVILEGES; no grant/revoke to service_role/postgres.
-- If any assertion fails the transaction is aborted: ROLLBACK, inspect, and replan.
COMMIT;
