-- READ ONLY. Prepared, not executed against Supabase.
-- Select project grjxcsngfnxdkkdkkujh in the dashboard before running.
-- Catalogs only: never SELECT rows, valor_cifrado, pista or decrypted values.
-- Definitions with arbitrary literals/bodies are deliberately not emitted.
-- If any block fails, issue ROLLBACK before attempting further queries.
BEGIN TRANSACTION READ ONLY;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT current_database() AS database_name, session_user, current_user,
       current_setting('server_version') AS server_version,
       statement_timestamp() AS captured_at;

SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
       c.relacl::text AS table_acl,
       c.relacl IS NULL AS uses_default_acl,
       r.rolsuper, r.rolbypassrls, r.rolinherit
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname='public' AND c.relname='credenciales' AND r.rolname=current_user;

SELECT a.attnum AS position, a.attname AS column_name,
       format_type(a.atttypid,a.atttypmod) AS data_type,
       a.attnotnull AS not_null, a.attidentity AS identity_kind,
       a.attgenerated AS generated_kind, d.oid IS NOT NULL AS has_default,
       CASE WHEN d.oid IS NULL THEN NULL
            WHEN pg_get_expr(d.adbin,d.adrelid) IN ('now()', 'gen_random_uuid()', 'true', 'false')
              THEN pg_get_expr(d.adbin,d.adrelid)
            ELSE '[expression withheld: review privately]' END AS default_summary,
       a.attacl::text AS column_acl
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE n.nspname='public' AND c.relname='credenciales'
  AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum;

-- Includes outbound and inbound FKs; check expressions are not printed.
SELECT con.conname, con.contype, con.conrelid::regclass AS source_table,
       CASE WHEN con.confrelid=0 THEN NULL ELSE con.confrelid::regclass END AS referenced_table,
       con.conkey AS source_attribute_numbers, con.confkey AS referenced_attribute_numbers,
       con.condeferrable, con.condeferred, con.convalidated,
       con.confupdtype, con.confdeltype, con.confmatchtype
FROM pg_constraint con
WHERE con.conrelid=to_regclass('public.credenciales')
   OR con.confrelid=to_regclass('public.credenciales')
ORDER BY con.conname;

SELECT ci.relname AS index_name, am.amname AS access_method,
       i.indisprimary, i.indisunique, i.indisvalid, i.indisready,
       i.indnkeyatts, i.indnatts,
       (SELECT jsonb_agg(coalesce(a.attname,'[expression]') ORDER BY k.ord)
        FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum,ord)
        LEFT JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum) AS keys,
       i.indexprs IS NOT NULL AS has_expressions, i.indpred IS NOT NULL AS has_predicate
FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid
JOIN pg_am am ON am.oid=ci.relam
WHERE i.indrelid=to_regclass('public.credenciales') ORDER BY ci.relname;

SELECT t.tgname, t.tgisinternal, t.tgenabled,
       (t.tgtype & 1)<>0 AS for_each_row,
       (t.tgtype & 2)<>0 AS before_trigger,
       (t.tgtype & 4)<>0 AS on_insert, (t.tgtype & 8)<>0 AS on_delete,
       (t.tgtype & 16)<>0 AS on_update, (t.tgtype & 32)<>0 AS on_truncate,
       t.tgattr::text AS update_attribute_numbers,
       t.tgqual IS NOT NULL AS has_when_expression, t.tgnargs AS argument_count,
       pn.nspname AS function_schema, p.proname AS function_name,
       l.lanname AS language, p.prosecdef AS security_definer,
       p.provolatile AS volatility, pg_get_userbyid(p.proowner) AS function_owner,
       p.proacl::text AS function_acl,
       p.proconfig @> ARRAY['search_path=public']::text[] AS search_path_exactly_public,
       regexp_replace(p.prosrc,'\s','','g')='BEGINNEW.updated_at=now();RETURNNEW;END;'
         AS body_is_known_timestamp_function
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
JOIN pg_namespace pn ON pn.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
WHERE t.tgrelid=to_regclass('public.credenciales') ORDER BY t.tgname;

-- Policy structure only: qual/with_check literals are not emitted.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual IS NOT NULL AS has_using_expression,
       with_check IS NOT NULL AS has_check_expression
FROM pg_policies WHERE schemaname='public' AND tablename='credenciales'
ORDER BY policyname;

SELECT pg_get_userbyid(x.grantor) AS grantor,
       CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
       x.privilege_type, x.is_grantable
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
WHERE n.nspname='public' AND c.relname='credenciales'
ORDER BY grantee, x.privilege_type;

SELECT a.attname AS column_name, pg_get_userbyid(x.grantor) AS grantor,
       CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END AS grantee,
       x.privilege_type, x.is_grantable
FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
WHERE a.attrelid=to_regclass('public.credenciales') AND a.attnum>0 AND NOT a.attisdropped
ORDER BY a.attnum, grantee, x.privilege_type;

-- MAINTAIN included only where supported (PostgreSQL 17+).
SELECT r.rolname, p.privilege,
       has_table_privilege(r.oid,'public.credenciales',p.privilege) AS effective
FROM pg_roles r CROSS JOIN LATERAL unnest(
  ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']::text[] ||
  CASE WHEN current_setting('server_version_num')::int>=170000 THEN ARRAY['MAINTAIN']::text[] ELSE ARRAY[]::text[] END
) p(privilege)
WHERE r.rolname IN (current_user,'postgres','service_role','authenticated','anon')
ORDER BY r.rolname,p.privilege;

SELECT pg_get_userbyid(member) AS member, pg_get_userbyid(roleid) AS granted_role,
       admin_option FROM pg_auth_members ORDER BY member,granted_role;

SELECT rulename, ev_type, is_instead
FROM pg_rewrite WHERE ev_class=to_regclass('public.credenciales') ORDER BY rulename;

ROLLBACK;
