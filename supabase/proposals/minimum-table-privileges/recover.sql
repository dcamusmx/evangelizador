-- RECOVERY PROPOSAL ONLY. Do not run unless an applied change needs recovery.
-- Restore only the privileges removed by apply.sql, with grantor postgres.
-- Verified original ACL: four roles, eight privileges each, no grant options.
-- Requires PostgreSQL 17+ and current_user = postgres; no later ACL drift allowed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $recovery_check$
DECLARE
  target_table text;
  target_role text;
  privilege_name text;
  relation_id oid;
  original_acl jsonb;
  hardened_acl jsonb;
  actual_acl jsonb;
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'PostgreSQL 17+ required for MAINTAIN.';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run with current_user = postgres to restore the verified grantor.';
  END IF;
  SELECT jsonb_agg(jsonb_build_array(r.role_name, 'postgres', p.privilege_name, false)
    ORDER BY r.role_name, p.privilege_name)
  INTO original_acl
  FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')) r(role_name)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                     ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(privilege_name);

  SELECT jsonb_agg(jsonb_build_array(r.role_name, 'postgres', p.privilege_name, false)
    ORDER BY r.role_name, p.privilege_name)
  INTO hardened_acl
  FROM (VALUES ('authenticated'), ('service_role'), ('postgres')) r(role_name)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                     ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(privilege_name)
  WHERE r.role_name IN ('service_role', 'postgres')
     OR p.privilege_name IN ('SELECT', 'INSERT', 'UPDATE');

  FOREACH target_table IN ARRAY ARRAY['public.contenido_diario', 'public.evangelios'] LOOP
    relation_id := to_regclass(target_table);
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = relation_id
      AND relkind = 'r' AND relowner = 'postgres'::regrole
      AND relrowsecurity AND NOT relforcerowsecurity) THEN
      RAISE EXCEPTION 'Unexpected owner/table/RLS state: %', target_table;
    END IF;
    SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantee),
      pg_get_userbyid(x.grantor), x.privilege_type, x.is_grantable)
      ORDER BY pg_get_userbyid(x.grantee), x.privilege_type)
    INTO actual_acl
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE c.oid = relation_id;
    IF actual_acl IS DISTINCT FROM hardened_acl THEN
      RAISE EXCEPTION 'ACL drift: recovery requires the exact post-apply ACL on %', target_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE a.attrelid = relation_id AND a.attnum > 0 AND NOT a.attisdropped
    ) THEN
      RAISE EXCEPTION 'Unexpected column ACL: %', target_table;
    END IF;
  END LOOP;

  -- Only removed privileges; no ALL, WITH GRANT OPTION or grants to protected roles.
  -- Owner and current_user are postgres, so postgres is the recorded grantor.
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
    ON TABLE public.contenido_diario, public.evangelios TO anon;
  GRANT DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
    ON TABLE public.contenido_diario, public.evangelios TO authenticated;

  FOREACH target_table IN ARRAY ARRAY['public.contenido_diario', 'public.evangelios'] LOOP
    relation_id := to_regclass(target_table);
    SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantee),
      pg_get_userbyid(x.grantor), x.privilege_type, x.is_grantable)
      ORDER BY pg_get_userbyid(x.grantee), x.privilege_type)
    INTO actual_acl
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE c.oid = relation_id;
    IF actual_acl IS DISTINCT FROM original_acl THEN
      RAISE EXCEPTION 'Recovery did not restore the verified ACL on %', target_table;
    END IF;
    FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'postgres'] LOOP
      FOREACH privilege_name IN ARRAY ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
      ] LOOP
        IF NOT has_table_privilege(target_role, target_table, privilege_name) THEN
          RAISE EXCEPTION 'Recovery privilege missing: % % on %',
            target_role, privilege_name, target_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$recovery_check$;

-- RLS/policies, PUBLIC, column ACLs, service_role and postgres are untouched.
COMMIT;
