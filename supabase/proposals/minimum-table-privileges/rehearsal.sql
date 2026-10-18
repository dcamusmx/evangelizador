-- ENSAYO TRANSACCIONAL. PostgreSQL 17+, current_user = postgres.
-- Ejecutar completo en UNA sesion dedicada, sin una transaccion ya abierta.
-- Confirmar el proyecto/entorno seleccionado; el SQL no verifica el Project ID.
-- Si ocurre CUALQUIER error: ejecutar ROLLBACK; antes de continuar.
-- No capturar/ignorar excepciones ni ejecutar solo fragmentos.
-- Los NOTICE son resultados de cada fase; el comando final devuelve ROLLBACK.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $rehearsal$
DECLARE
  tables_to_check text[] := ARRAY['public.contenido_diario', 'public.evangelios'];
  roles_to_check text[] := ARRAY['anon', 'authenticated', 'service_role', 'postgres'];
  privileges_to_check text[] := ARRAY[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'
  ];
  target_table text;
  target_role text;
  privilege_name text;
  relation_id oid;
  expected boolean;
  original_acl jsonb;
  hardened_acl jsonb;
  actual_acl jsonb;
  snapshot_before jsonb;
  snapshot_after jsonb;
BEGIN
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'Se requiere PostgreSQL 17+. Ejecutar ROLLBACK antes de continuar.';
  END IF;
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Se requiere current_user=postgres. Ejecutar ROLLBACK antes de continuar.';
  END IF;

  SELECT jsonb_agg(jsonb_build_array(r, 'postgres', p, false) ORDER BY r, p)
  INTO original_acl
  FROM unnest(roles_to_check) r CROSS JOIN unnest(privileges_to_check) p;

  SELECT jsonb_agg(jsonb_build_array(r, 'postgres', p, false) ORDER BY r, p)
  INTO hardened_acl
  FROM unnest(roles_to_check) r CROSS JOIN unnest(privileges_to_check) p
  WHERE r IN ('service_role', 'postgres')
     OR (r = 'authenticated' AND p IN ('SELECT', 'INSERT', 'UPDATE'));

  -- FASE 1: mismas precondiciones de apply, incluida la ACL directa completa.
  FOREACH target_table IN ARRAY tables_to_check LOOP
    relation_id := to_regclass(target_table);
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = relation_id
      AND relkind = 'r' AND relowner = 'postgres'::regrole
      AND relrowsecurity AND NOT relforcerowsecurity) THEN
      RAISE EXCEPTION 'Tabla/propietario/RLS inesperados: %. Ejecutar ROLLBACK.', target_table;
    END IF;
    SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantee),
      pg_get_userbyid(x.grantor), x.privilege_type, x.is_grantable)
      ORDER BY pg_get_userbyid(x.grantee), x.privilege_type)
    INTO actual_acl
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE c.oid = relation_id;
    IF actual_acl IS DISTINCT FROM original_acl THEN
      RAISE EXCEPTION 'ACL original distinta en %. Ejecutar ROLLBACK.', target_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
      WHERE a.attrelid = relation_id AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION 'Grants de columna inesperados en %. Ejecutar ROLLBACK.', target_table;
    END IF;
    FOREACH target_role IN ARRAY roles_to_check LOOP
      FOREACH privilege_name IN ARRAY privileges_to_check LOOP
        IF NOT has_table_privilege(target_role, relation_id, privilege_name) THEN
          RAISE EXCEPTION 'Permiso original ausente: % % %. Ejecutar ROLLBACK.',
            target_role, privilege_name, target_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Captura en memoria: ACL canonica, propietarios, RLS, columnas y politicas.
  SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'owner', c.relowner,
    'rls', c.relrowsecurity, 'forced', c.relforcerowsecurity,
    'acl', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.grantee, x.grantor, x.privilege_type)
            FROM aclexplode(c.relacl) x),
    'columns', (SELECT jsonb_agg(jsonb_build_array(a.attnum, a.attacl::text) ORDER BY a.attnum)
                FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
    'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname)
                 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)
  ) ORDER BY c.relname) INTO snapshot_before
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('contenido_diario', 'evangelios');
  RAISE NOTICE 'FASE 1 OK: dos tablas, ACL originales de 32 entradas y ocho permisos por rol verificados.';

  -- FASE 2: solo las revocaciones de apply, sin cascada ni cambios de datos.
  REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
    ON TABLE public.contenido_diario, public.evangelios FROM anon RESTRICT;
  REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
    ON TABLE public.contenido_diario, public.evangelios FROM authenticated RESTRICT;

  FOREACH target_table IN ARRAY tables_to_check LOOP
    relation_id := to_regclass(target_table);
    SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantee),
      pg_get_userbyid(x.grantor), x.privilege_type, x.is_grantable)
      ORDER BY pg_get_userbyid(x.grantee), x.privilege_type)
    INTO actual_acl
    FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE c.oid = relation_id;
    IF actual_acl IS DISTINCT FROM hardened_acl THEN
      RAISE EXCEPTION 'ACL posterior inesperada en %. Ejecutar ROLLBACK.', target_table;
    END IF;
    FOREACH target_role IN ARRAY roles_to_check LOOP
      FOREACH privilege_name IN ARRAY privileges_to_check LOOP
        expected := target_role IN ('postgres', 'service_role')
          OR (target_role = 'authenticated' AND privilege_name IN ('SELECT', 'INSERT', 'UPDATE'));
        IF has_table_privilege(target_role, relation_id, privilege_name) IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'Permiso efectivo posterior inesperado: % % %. Ejecutar ROLLBACK.',
            target_role, privilege_name, target_table;
        END IF;
      END LOOP;
      FOREACH privilege_name IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'] LOOP
        expected := target_role IN ('postgres', 'service_role')
          OR (target_role = 'authenticated' AND privilege_name <> 'REFERENCES');
        IF has_any_column_privilege(target_role, relation_id, privilege_name) IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'Permiso efectivo de columna inesperado: % % %. Ejecutar ROLLBACK.',
            target_role, privilege_name, target_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'FASE 2 OK: anon sin permisos; authenticated solo SELECT/INSERT/UPDATE; postgres y service_role conservan los ocho.';

  -- FASE 3: recuperar exclusivamente lo retirado, grantor postgres, sin grant option.
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
    ON TABLE public.contenido_diario, public.evangelios TO anon;
  GRANT DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
    ON TABLE public.contenido_diario, public.evangelios TO authenticated;

  FOREACH target_table IN ARRAY tables_to_check LOOP
    FOREACH target_role IN ARRAY roles_to_check LOOP
      FOREACH privilege_name IN ARRAY privileges_to_check LOOP
        IF NOT has_table_privilege(target_role, target_table, privilege_name) THEN
          RAISE EXCEPTION 'Permiso no recuperado: % % %. Ejecutar ROLLBACK.',
            target_role, privilege_name, target_table;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'owner', c.relowner,
    'rls', c.relrowsecurity, 'forced', c.relforcerowsecurity,
    'acl', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.grantee, x.grantor, x.privilege_type)
            FROM aclexplode(c.relacl) x),
    'columns', (SELECT jsonb_agg(jsonb_build_array(a.attnum, a.attacl::text) ORDER BY a.attnum)
                FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
    'policies', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname)
                 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)
  ) ORDER BY c.relname) INTO snapshot_after
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('contenido_diario', 'evangelios');
  IF snapshot_before IS DISTINCT FROM snapshot_after THEN
    RAISE EXCEPTION 'ACL/propietarios/RLS/columnas/politicas no equivalentes al original. Ejecutar ROLLBACK.';
  END IF;
  RAISE NOTICE 'FASE 3 OK: ACL originales equivalentes, incluidos grantors/grant options; propietarios, RLS y politicas conservados.';
  RAISE NOTICE 'ENSAYO OK dentro de la transaccion. Ejecutar ahora el ROLLBACK final; nada debe persistir.';
END;
$rehearsal$;

-- Debe ejecutarse tambien manualmente si cualquier instruccion anterior falla.
ROLLBACK;
