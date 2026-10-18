-- READ ONLY. Run blocks separately before and after apply/recovery; save results.
-- Verify project selection in dashboard: grjxcsngfnxdkkdkkujh.
-- PostgreSQL 17+ required: table rights include MAINTAIN (ACL letter m).

-- 0. Capture context and raw ACL, including NULL vs an explicitly empty array.
-- Context can also be run through the already verified n8n Postgres connection.
SELECT current_database() AS database_name, session_user AS session_role,
       current_user AS effective_role, current_setting('server_version') AS server_version,
       statement_timestamp() AS captured_at;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS raw_table_acl,
       c.relacl IS NULL AS uses_default_acl,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       (SELECT jsonb_agg(jsonb_build_object(
          'column', a.attname, 'raw_acl', a.attacl::text,
          'acl_is_null', a.attacl IS NULL) ORDER BY a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS column_acls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('contenido_diario', 'evangelios')
ORDER BY c.relname;

-- 1. Effective table rights. For migration: anon all false; authenticated only
-- SELECT/INSERT/UPDATE true. service_role/postgres must equal pre-change snapshot.
-- Effective owner grant options may be true despite is_grantable=false in ACL.
-- Use aclexplode below to recover the recorded grant options, not this matrix.
SELECT r.role_name, t.table_name, p.privilege_name,
       has_table_privilege(r.role_name, t.table_name, p.privilege_name) AS effective,
       has_table_privilege(r.role_name, t.table_name,
                          p.privilege_name || ' WITH GRANT OPTION') AS grant_option
FROM (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')) r(role_name)
CROSS JOIN (VALUES ('public.contenido_diario'), ('public.evangelios')) t(table_name)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                   ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) p(privilege_name)
ORDER BY t.table_name, r.role_name, p.privilege_name;

-- 2. Effective column rights, including inherited grants and table-level rights.
SELECT c.relname AS table_name, a.attname AS column_name, r.role_name,
       p.privilege_name,
       has_column_privilege(r.role_name, c.oid, a.attnum, p.privilege_name) AS effective
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role'), ('postgres')) r(role_name)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) p(privilege_name)
WHERE n.nspname = 'public' AND c.relname IN ('contenido_diario', 'evangelios')
ORDER BY c.relname, a.attnum, r.role_name, p.privilege_name;

-- 3. Direct ACL evidence (including PUBLIC=grantee 0), grantors and grant options.
SELECT c.relname AS table_name, pg_get_userbyid(c.relowner) AS owner,
       pg_get_userbyid(x.grantor) AS grantor,
       CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
       x.privilege_type, x.is_grantable
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
WHERE n.nspname = 'public' AND c.relname IN ('contenido_diario', 'evangelios')
ORDER BY c.relname, grantee, grantor, x.privilege_type;

SELECT c.relname AS table_name, a.attname AS column_name,
       pg_get_userbyid(x.grantor) AS grantor,
       CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
       x.privilege_type, x.is_grantable
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
CROSS JOIN LATERAL aclexplode(a.attacl) x
WHERE n.nspname = 'public' AND c.relname IN ('contenido_diario', 'evangelios')
ORDER BY c.relname, a.attnum, grantee, grantor, x.privilege_type;

-- 4. RLS, owners and policies: must be identical before/after, including PUBLIC.
SELECT c.relname AS table_name, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('contenido_diario', 'evangelios')
ORDER BY c.relname;

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('contenido_diario', 'evangelios')
ORDER BY tablename, policyname;

-- 5. Membership/role attributes: inspect inherited paths, never modify them here.
SELECT pg_get_userbyid(m.member) AS member,
       pg_get_userbyid(m.roleid) AS granted_role, m.admin_option
FROM pg_auth_members m
ORDER BY member, granted_role;

SELECT rolname, rolsuper, rolinherit, rolbypassrls
FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres');

-- 6. Defaults: future tables may regain broad grants. Out of scope to alter them.
SELECT pg_get_userbyid(d.defaclrole) AS owner,
       n.nspname AS schema_name, d.defaclobjtype,
       CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
       x.privilege_type, x.is_grantable
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) x
WHERE d.defaclnamespace = 0 OR n.nspname = 'public'
ORDER BY owner, schema_name, d.defaclobjtype, grantee, x.privilege_type;
