# Mínimo privilegio: contenido_diario y evangelios

Estado: **reducción de permisos aplicada y verificada funcionalmente de forma manual por el propietario** en `grjxcsngfnxdkkdkkujh`. Antes se completó rehearsal.sql sin excepciones y con ROLLBACK final. Base de código revisada: commit `30e0b2ceda2cbd32e538fbb87f293dfbdd63deb2`.

## Registro posterior a la aplicación

Confirmación manual registrada el 18 de octubre de 2026:

- Tras el cambio funcionan **acceso, edición, subida de videos y publicación**.
- Se marca la reducción como **aplicada y verificada**, no solo ensayada. El alcance es anon sin los ocho permisos y authenticated solo SELECT/INSERT/UPDATE en las dos tablas; se conservan RLS, políticas y permisos de postgres/service_role.
- El agente no ejecutó SQL ni verificó directamente producción. No se aportaron en este mensaje logs de aplicación, marcas temporales de cada operación ni un nuevo volcado ACL: el resultado registrado procede de la validación manual del propietario, sin inventar esas evidencias.
- No se ejecutó recover.sql como parte de este registro. No se modifica ni se crea historial de migraciones; los scripts permanecen fuera de la cadena automática.

Pendientes que siguen abiertos:

1. **Privilegios predeterminados:** revisar default privileges y su efecto en tablas futuras; no se han modificado.
2. **Usuario exclusivo de n8n:** diseñar/probar un rol de mínimo privilegio y migrar su credencial por separado. La conexión verificada continúa usando postgres mediante el pooler; este endurecimiento no crea ni activa el usuario exclusivo.

La aplicación ya realizada no debe repetirse: apply.sql exige la ACL original y abortará tras el endurecimiento. verify.sql permanece como herramienta de lectura para futuras capturas y controles.

## Registro del ensayo manual

Registro recibido el 18 de octubre de 2026, según confirmación del propietario:

- Se ejecutó `supabase/proposals/minimum-table-privileges/rehearsal.sql` completo en el SQL Editor de `grjxcsngfnxdkkdkkujh`, no en un PostgreSQL local aislado.
- Resultado comunicado: **“Success. No rows returned”**, sin errores ni excepciones.
- El script completo incluye las comprobaciones previas, revocaciones, comprobaciones posteriores, recuperación y comparación de equivalencia con las ACL originales, dentro de una sola transacción, con **ROLLBACK final**. El ensayo no deja aplicadas las revocaciones.
- Los NOTICE no fueron visibles en la interfaz. No se dispone de una salida individual capturada por fase; se registra la finalización sin excepciones comunicada, no mensajes que no se observaron.
- En el momento de ese ensayo **todavía no se había aplicado** la reducción persistentemente. El registro posterior de aplicación y pruebas funcionales aparece arriba; el ensayo por sí solo no registra una migración como aplicada.

Esta es evidencia manual aportada por el propietario; el agente no ejecutó SQL ni verificó directamente el servicio. El resultado acredita el ensayo integrado comunicado, no una ejecución separada de apply.sql/recover.sql ni pruebas funcionales de usuarios o workflows.

Los scripts están en `supabase/proposals/minimum-table-privileges/`, fuera de la cadena automática de migraciones. No añadirlos a `supabase/migrations` ni ejecutar db push/reset: no se ha reconciliado el historial existente.

## Evidencia de usos

| Consumidor | Evidencia local | Derechos necesarios |
| --- | --- | --- |
| Frontend, inicio/listado/dashboard/publicaciones | `src/routes/_authenticated/{index,listado,dashboard,publicaciones}.tsx` | SELECT contenido; UPDATE reflexión/estado en publicaciones |
| Editor general | `src/components/EditarRegistroDialog.tsx` | UPDATE contenido |
| Evangelios | `src/routes/_authenticated/evangelios.tsx`, SELECT y upsert | SELECT, INSERT, UPDATE evangelios |
| Generación mensual y CSV | `src/lib/n8n.functions.ts`, consultas, insert/update | SELECT/INSERT/UPDATE contenido y SELECT evangelios |
| Confirmación R2/pCloud | `src/lib/{r2,pcloud}.functions.ts`, consulta y upsert | SELECT/INSERT/UPDATE contenido |
| Descarga R2 de usuario | `src/lib/r2.functions.ts` | SELECT contenido |
| Endpoint para n8n | `src/routes/api/public/r2-download-url.ts` usa supabaseAdmin tras autorización | SELECT contenido mediante cliente service-role; no cambiar su ACL |
| Sesión de backend | `src/integrations/supabase/auth-middleware.ts` propaga JWT del usuario | authenticated con RLS, no asumir service-role por ejecutarse en servidor |
| Cliente privilegiado | `src/integrations/supabase/client.server.ts` | Configurado mediante variable service-role; no se leyeron valores ni se cambiaron privilegios |

No se encontró DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN sobre estas tablas en los consumidores locales inspeccionados. El DELETE de credenciales afecta otra tabla y queda fuera del alcance. Los upserts conservan SELECT/INSERT/UPDATE para conflicto y retorno. No hay uso anónimo local previsto para contenido o Evangelios.

## Workflow y dependencias externas

No se encontró una exportación de workflow en los archivos disponibles del repositorio (incluidos archivos no ignorados sin seguimiento). No se buscaron directorios personales externos ni se leyeron `.env`. Por ello **no fue posible revisar directamente el workflow exportado solicitado**. El propietario confirmó desde la exportación que ambos post IDs guardan `post._id` de Zernio.

Confirmación manual posterior en la credencial Postgres de n8n:

- User: `postgres.grjxcsngfnxdkkdkkujh`.
- Database: `postgres`.
- Host: `aws-0-us-west-2.pooler.supabase.com`.
- Prueba de conexión satisfactoria.

Esta credencial conecta como postgres mediante el pooler del proyecto correcto. No se ha leído contraseña ni realizado conexión desde el agente. Se retira la incertidumbre del rol **de esta conexión**: sus permisos no se revocan en la propuesta. No implica que todos los nodos/workflows usen esa misma credencial ni acredita el inventario de sus operaciones; capturar `session_user/current_user` desde esa conexión complementaría la evidencia de ejecución.

`src/lib/n8n.server.ts` envía peticiones a webhooks: no determina qué credencial utiliza n8n para Supabase. La clave interna de ese webhook no es un rol PostgreSQL.

Para completar el inventario externo y antes de futuros cambios, revisar una exportación saneada y la configuración de cada nodo Supabase/HTTP/Postgres, **sin compartir secretos**:

- La referencia, tipo Postgres y usuario de la credencial anterior ya están confirmados. Verificar qué nodos la utilizan y sus operaciones de lectura/escritura/upsert/borrado; inventariar otras credenciales si existen.
- Si usa service_role o postgres, estos scripts no modifican sus grants; conservar validación de sus permisos efectivos antes/después. No convertirlo a otro rol como parte de este cambio.
- Si usa authenticated, SELECT/INSERT/UPDATE requieren además perfil admin/editor bajo RLS; verificar que realmente existe esa identidad.
- Si usa anon, una clave pública sin JWT de usuario o un rol personalizado que hereda anon/authenticated, el cambio puede cortar el acceso o modificar derechos heredados. Resolver la dependencia antes; no asumir que basta el nombre de la credencial.
- Verificar cualquier función SECURITY DEFINER, vista, RPC, tarea SQL directa o consumidor externo que haga DELETE/TRUNCATE u operaciones privilegiadas. No está acreditado el inventario externo completo.
- La limpieza R2 acordada todavía es un plan separado: no requiere habilitar DELETE de estas tablas ni se implementa aquí.

El propietario aportó posteriormente la captura de ACL de ambas tablas: `{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`. aclexplode confirma ocho permisos, incluido MAINTAIN (`m`), todos otorgados por postgres y sin grant option. No hay grants de tabla a PUBLIC ni ACL específicas de columna. Esta evidencia manual sustituye la baseline anterior de siete permisos; no se obtuvo mediante conexión del agente. Antes de una aplicación futura se debe revalidar que no haya deriva y completar el inventario de nodos/otras dependencias.

## Cambio aplicado y garantías de alcance

| Rol | Antes, según verificación manual del propietario | Estado declarado tras la aplicación |
| --- | --- | --- |
| anon | SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN | Ninguno de los ocho en ambas tablas |
| authenticated | Los mismos ocho | Solo SELECT/INSERT/UPDATE |
| service_role / postgres | Los ocho, grantor postgres y sin grant option en ACL | Conservar sus grants y permisos efectivos; no cambiar membresía ni atributos |

`apply.sql` revoca los ocho derechos enumerados a anon y los cinco innecesarios a authenticated, incluido MAINTAIN; conserva sus tres grants necesarios sin volver a concederlos. No usa CASCADE, no cambia PUBLIC, grants por columna, membresías, default privileges, SQL funcional, RLS ni políticas.

El preflight exige PostgreSQL 17 o posterior, current_user=postgres, ambas tablas propiedad de postgres con RLS habilitado/no forzado, ACL directa idéntica a la captura (cuatro roles por ocho privilegios, todos grantor postgres y sin grant options), ausencia de grants de columna y los ocho derechos efectivos de anon/authenticated. No valida por sí solo el proyecto: confirmar su identidad en el panel antes. Repetir después de aplicar falla por baseline distinta; no es una instalación nueva ni un script idempotente.

Las comprobaciones posteriores usan permisos **efectivos**, incluyendo herencia/PUBLIC y privilegios por columna. Si persisten derechos prohibidos por alguna de esas vías, se aborta toda la transacción. No se amplía la revocación automáticamente a otros roles. Una revocación dependiente que requiera CASCADE también falla por RESTRICT. Tras un fallo, hacer ROLLBACK y volver al análisis; no ejecutar recuperación sobre una transacción abortada.

No se dirige GRANT/REVOKE/ALTER a service_role/postgres ni se afectan grants por cascada. Además el bloque compara internamente sus derechos efectivos de tabla y existencia de derechos por columna antes/después, y aborta si cambian por herencia. La verificación externa incluye también la comparación columna por columna y ACL completas. Tampoco se modifican grants de schema ni EXECUTE de funciones: esto limita estas tablas, no certifica aislamiento de toda la API.

## Procedimiento conservado para referencia y recuperación

La aplicación y validación funcional ya están registradas arriba. Esta secuencia describe el procedimiento de revisión, no una instrucción para volver a aplicar el script.

1. Seleccionar el proyecto confirmado y completar el inventario de nodos/operaciones de n8n; su credencial Postgres ya fue verificada. Obtener respaldo de configuración/ACL sin secretos.
2. Ejecutar posteriormente, con autorización, los bloques SELECT de `verify.sql` antes del cambio y conservar resultados: matriz efectiva, grant options, ACL de tabla/columna, propietarios, RLS/políticas, membresías y defaults. Confirmar procedencia de grants, ausencia de dependencias que exijan cascada y comparación con originales reportados.
3. El ensayo integrado `rehearsal.sql` ya fue completado manualmente con ROLLBACK en el proyecto objetivo, según el registro anterior. La ejecución separada de apply/verify/recover en aislamiento y las pruebas funcionales con roles siguen sin acreditarse. No probar DELETE/TRUNCATE en producción. SELECT en SQL Editor como postgres no demuestra el comportamiento del frontend.
4. Solo con autorización posterior, ejecutar la transacción completa como propietario/administrador autorizado. El ejecutor puede ser postgres; no se cambian sus permisos.
5. Repetir `verify.sql`: anon sin derechos, authenticated con los tres previstos, y permisos efectivos de service_role/postgres, propietarios, RLS/políticas y ACL no objetivo idénticos a la captura. Validar flujos n8n y aplicación sin publicaciones reales de prueba.
6. Si hay fallo antes de COMMIT, ROLLBACK. Si después del commit se detecta incompatibilidad, aplicar la recuperación autorizada y repetir verificaciones. Conservar evidencia y detener el despliegue de cambios dependientes.

## Recuperación separada y límites

`recover.sql` restituye **solo lo retirado**: ocho permisos a anon y DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN a authenticated. No vuelve a conceder los tres permisos conservados. Requiere current_user=postgres y tablas propiedad de postgres para conservar el grantor confirmado; no utiliza WITH GRANT OPTION ni ALL ni modifica grants de service_role/postgres, PUBLIC o políticas.

La captura permite preparar la restauración de la ACL directa original, incluidos grantor y grant options. El script comprueba antes la ACL exacta esperada tras apply (19 entradas: postgres/service_role con ocho y authenticated con tres) y ausencia de ACL de columna; si hay cambios posteriores, aborta sin sobrescribirlos. Después exige las 32 entradas originales por tabla, con grantor postgres y sin grant options, y verifica los ocho permisos efectivos de los cuatro roles. La recuperación y comparación con las ACL originales se incluyeron en el ensayo integrado completado sin excepciones; no se afirma una ejecución separada de recover.sql.

Antes de aplicar, conservar/revalidar resultados de verify, propietarios y membresías, y ensayar la recuperación. No confundir grant options efectivos del propietario (implícitos por propiedad) con `is_grantable` de aclexplode: la captura directa confirma false y la recuperación no añade WITH GRANT OPTION. No escribir catálogos ni cambiar PUBLIC/membresías. La recuperación vuelve a habilitar TRUNCATE y MAINTAIN a anon/authenticated, solo para restablecer la situación anterior.

Validación local previa: no se encontraron psql/postgres/initdb/pg_ctl, Docker o Podman en PATH ni instalaciones en las rutas habituales comprobadas; tampoco PGlite instalado en node_modules. El agente realizó revisión estática, sin instalar servicios ni conectar a producción. Posteriormente el propietario comunicó el ensayo manual sin excepciones y con ROLLBACK, y después la aplicación con pruebas funcionales satisfactorias. El cierre local incluye revisión de secretos/alcance, whitespace y commit del bloque, sin modificar código funcional, ejecutar SQL, hacer push ni desplegar.
