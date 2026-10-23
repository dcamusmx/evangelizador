# Mínimo privilegio: public.credenciales aplicado y verificado

Cambio autorizado aplicado el 23 de octubre de 2026 y verificado mediante metadatos en el proyecto exclusivo grjxcsngfnxdkkdkkujh. No se consultaron filas, ciphertexts ni valores de credenciales. El commit 2c44ea9, el cierre de recifrado y los cambios locales pendientes se conservan sin amend/rebase. No hubo cambios de aplicación ni del formato cifrado. Las pruebas funcionales posteriores de panel/lectores siguen pendientes; las secciones de propuesta y captura previa se conservan como evidencia histórica.

## Aplicación autorizada y verificación: 23 de octubre de 2026

Se ejecutaron una sola vez los archivos apply.sql y, después del COMMIT confirmado, verify.sql, con entrada local enmascarada de contraseña, Session pooler del proyecto correcto y TLSv1.3 con certificado/hostname verificados. No se ejecutó recover, no hubo reintentos ni consulta de filas de credenciales. La verificación READ ONLY terminó con ROLLBACK y la conexión se cerró.

Hora de verificación: **2026-10-23T06:21:39.423Z**. Comparación con la captura previa de 2026-10-23T06:14:12.443Z:

El propietario solicita registrar estos resultados también como **evidencia manual**. Esa confirmación se suma a la salida directa conservada de apply/verify; no se interpreta como una prueba adicional de CRUD del panel o HeadBucket, que no se ha comunicado como realizada después de este cambio.

| Comprobación | Resultado directo |
| --- | --- |
| COMMIT de apply | Confirmado por respuesta del servidor; no es resultado incierto |
| verify.sql | Todas las aserciones aprobadas |
| anon/authenticated | Sin ninguno de los ocho permisos efectivos de tabla; sin permisos efectivos de columna según las aserciones SQL |
| ACL directa | Exactamente 16 entradas previstas de postgres/service_role; sin grants de columna |
| postgres/service_role | Derechos efectivos y entradas directas, grantors y grant options iguales a la captura previa |
| Propietario/RLS | Sin cambios: owner postgres, tabla ordinaria, RLS habilitado/no forzado |
| Políticas | Sin cambios: cero antes y después |
| Lectura de valores/recover | No realizados |

Se conservaron las copias exactas del SQL ejecutado, captura de referencia, confirmación de COMMIT, verificación de catálogos y comparación, sin secretos, fuera de Git en directorio privado con ACL operador/SYSTEM:

`C:\Users\dcamu\AppData\Local\Evangelizador\credential-privileges\apply\974f5d8522bd40f1bfe5f0a63c09687d`

Archivos: apply-executed.sql, verify-executed.sql, baseline-metadata.json, commit-confirmation.json, verification-metadata.json, comparison.json y operation-result.json. El respaldo previo y el material de recuperación del recifrado permanecen protegidos y sin cambios. La clave de conexión no se guardó ni se imprimió.

**No volver a ejecutar apply:** sus precondiciones originales deben rechazar el estado ya endurecido. La ACL comprobada coincide con la base posterior que espera recover, pero una recuperación exige decisión explícita y una nueva comprobación de ausencia de deriva; no queda autorizada por esta coincidencia. No restaurar grants por una prueba funcional pendiente ni ampliar permisos sin diagnosticar.

Pendientes: validar manualmente el panel con datos ficticios bajo autorización de escritura y los lectores del servidor mediante una operación segura como HeadBucket; no se dan por probados por verify.sql. Default privileges y usuario exclusivo de n8n continúan pendientes. Sin push, despliegue ni publicación/borrado de videos.

## Captura previa a la aplicación, ejecutada el 23 de octubre de 2026

Autorización del propietario limitada a ejecutar capture-before.sql y comparar metadatos. Se ejecutó exclusivamente ese archivo por Session pooler del proyecto correcto con contraseña de entrada local enmascarada, CA suministrada, certificado y hostname verificados, TLSv1.3 y PostgreSQL 17.6. La transacción READ ONLY terminó en ROLLBACK confirmado y la conexión se cerró. No se ejecutaron apply, recover, rehearsal ni SELECT de filas de credenciales; tampoco se ejecutaron las pruebas funcionales de panel/servicios.

- Hora de captura: **2026-10-23T06:14:12.443Z**; base/session_user/current_user: postgres.
- Comparación con captura de 2026-10-22T15:41:17.027Z: **sin deriva en las 12 secciones de metadatos**, excluida únicamente la hora de captura. Esto no afirma identidad de datos de negocio ni cubre metadatos no consultados.
- Tabla ordinaria y owner postgres, RLS habilitado/no forzado, cero políticas, ACL original exacta de 32 entradas: cuatro roles por ocho privilegios, grantor postgres y sin grant options. Cero grants de columna o entradas adicionales de tabla/PUBLIC. Matriz efectiva original satisfecha; sin caminos de membresía capturados de anon/authenticated hacia postgres/service_role.
- **apply.sql sigue compatible con la base capturada.** El script revalida sus condiciones y efectivos dentro de su transacción/bloqueo; ninguna captura garantiza ausencia de cambios posteriores. No queda autorizado ejecutarlo por este resultado.
- **recover.sql es fiel a los grants originales capturados**, pero **su precondición de ejecución no se cumple ahora**, como corresponde: requiere la ACL posterior exacta de 16 entradas postgres/service_role. Solo tras un apply confirmado y sin deriva podrá evaluarse esa recuperación. No probarla sobre el estado original ni interpretar su rechazo actual como incompatibilidad.

Resultados conservados fuera de Git, en directorio privado con ACL de Windows restringida al operador/SYSTEM:

`C:\Users\dcamu\AppData\Local\Evangelizador\credential-privileges\capture\b890007b72e641c9ab67d74e3406ee72`

metadata.json contiene únicamente los resultados de catálogos; comparison.json conserva la comparación y confirmaciones de TLS/ROLLBACK/cierre, sin contraseña ni valores de credenciales. El reporte previo y los respaldos/recibo de recifrado se conservan sin sobrescribir. El lanzador exclusivo de captura se comprobó sintácticamente y su comparación ACL se ensayó localmente antes de conectar; no importa ni llama modos de apply/recover.

Límite de la captura: las flags de herencia por membresía y todos los atributos de cada rol no se consultan en este SQL; no se infiere su inmutabilidad. El script de aplicación comprueba derechos efectivos tras revocar y revierte todo si persisten por herencia/propiedad/otros mecanismos. Se mantiene la validación y recuperación previstas abajo. La evaluación anterior que pedía recapturar queda satisfecha por esta captura, conservándose como historia del procedimiento.

## Consumidores y decisión de permisos

| Rol/superficie | Uso comprobado | Propuesta |
| --- | --- | --- |
| anon | No hay acceso directo legítimo del navegador a credenciales. La autenticación pública no necesita esta tabla | Ninguno de los ocho permisos de tabla, tampoco permisos de columna |
| authenticated (incluido usuario admin) | credenciales.functions.ts usa el token para autenticar y comprobar has_role(admin), pero lee/guarda/activa/borra mediante supabaseAdmin. No necesita SELECT/INSERT/UPDATE/DELETE directos sobre credenciales | Ninguno de los ocho permisos. No confundir permisos de aplicación con grants al rol Postgres authenticated |
| service_role | supabaseAdmin: listarCredenciales SELECT (resúmenes), guardarCredencial INSERT/UPDATE, cambiarEstadoCredencial UPDATE, eliminarCredencial DELETE. credenciales.server.ts obtiene SELECT para R2/pCloud/n8n | El mínimo funcional comprobado es SELECT/INSERT/UPDATE/DELETE. En este cambio se conservan sus ocho permisos actuales, grantors y grant options; reducir los otros cuatro requerirá propuesta separada e inventario de otros consumidores |
| postgres | Herramienta de recifrado necesita SELECT/UPDATE y bloqueo; propietario de tabla y conexión Postgres de n8n confirmada manualmente | Conservar permisos efectivos/propiedad y ACL. No sustituir ni restringir este rol como parte de esta propuesta; usuario exclusivo de n8n sigue pendiente |

Frontend usa server functions: no modificar sus controles admin ni exponer supabaseAdmin. Los helpers de servidor necesitan descifrar activos; el panel de listado no descifra valores. No se añade una política RLS de acceso directo para compensar las revocaciones. Las operaciones CRUD del panel permanecen a través del servidor privilegiado y sus controles actuales.

## Evidencia local y límites

El reporte de metadatos privado inicial contiene exactamente 32 entradas de ACL: anon/authenticated/postgres/service_role, ocho permisos por rol incluidos MAINTAIN, grantor postgres, sin grant option y sin ACL de columna. No hay PUBLIC en esa ACL. RLS habilitado/no forzado, propietario postgres y sin políticas. La recaptura del 23 de octubre descrita arriba confirma la misma base, sin asumir vigencia indefinida.

### Revisión previa a la recaptura, tras la confirmación funcional n8n

El propietario confirmó workflow restaurado y publicación manual funcionando después de la rotación, registrado en [resultados n8n](resultados-validacion-n8n.md). Se conserva esa evidencia manual y la independencia del cambio de permisos: no se solicita otra publicación como prueba de esta propuesta ni se repite la rotación.

Se revisó únicamente el reporte privado local de catálogos ya existente, sin conectar a Supabase ni consultar filas de credenciales. Su statement_timestamp es **2026-10-22T15:41:17.027Z**; base postgres, session_user/current_user postgres. El rol ejecutor tenía BYPASSRLS, no era superusuario; USAGE de public y SELECT/UPDATE efectivos. No convertir esta hora histórica en una comprobación actual.

| Elemento de la captura conservada | Resultado | Condición antes del cambio |
| --- | --- | --- |
| Tabla/propietario | public.credenciales ordinaria, owner postgres | Deben seguir coincidiendo |
| ACL directa | 32 entradas: cuatro roles por ocho privilegios | Nueva captura debe ser exactamente esa base, no solo tener 32 filas |
| Grantor/grant option | Todas por postgres, todas is_grantable=false | Recuperación usa ese grantor y ningún WITH GRANT OPTION; no deducir flags de la capacidad implícita del propietario |
| PUBLIC y columnas | Cero grants de tabla a PUBLIC y cero ACL específicas de columna | Confirmar ausencia; si aparecen, detener y revisar alcance |
| RLS/políticas | Habilitado/no forzado; sin políticas en la inspección conservada | Comparar con captura nueva; no crear ni quitar políticas para que pasen las comprobaciones |
| Membresías y efectivos | Capturados en reporte; apply comprueba efectivos antes/después y aborta si persisten por herencia | Recapturar roles/membresías/efectivos; no revocar roles ni usar CASCADE como corrección improvisada |
| Pruebas previas de SQL | 5/5 casos aprobados en PostgreSQL 18.4 local | Prueban los scripts contra datos ficticios; no acreditan vigencia de la base activa |

**Dictamen:** la evidencia disponible es suficiente para el diseño y una recuperación exacta de los grants de la base capturada, pero **no basta por sí sola para ejecutar ahora**. Presentar y guardar una captura fresca de [capture-before.sql](../supabase/proposals/minimum-credential-privileges/capture-before.sql) del proyecto correcto, revisar sus resultados y mantener una pausa corta sin otros cambios de ACL/DDL. Este documento no ejecuta esa consulta ni apply/recover. El recifrado y la rotación de cabeceras no equivalen a una comprobación de ACL, aunque no haya evidencia de que las alteraran.

Aplicación solo si las entradas originales siguen siendo exactamente (rol, postgres, cada uno de los ocho privilegios, sin grant option), no hay grants adicionales y owner/RLS/roles son compatibles. El script vuelve a verificar la base bajo bloqueo y revierte toda la transacción si falla. Recuperación solo si la ACL posterior sigue siendo exactamente las 16 entradas de postgres/service_role, sin grants de columna ni deriva. Restore devuelve las 16 entradas retiradas y verifica las 32 originales por grantee/grantor/privilegio/grant option; el orden textual de relacl no define equivalencia. Si una nueva captura difiere, no aplicar ni usar recover como plantilla genérica.

La captura completa preparada consulta **solo catálogos**, comienza READ ONLY, mantiene timeouts y termina ROLLBACK. Incluye contexto, ACL raw, grants expandidos, columnas/índices/restricciones/triggers/reglas, RLS/políticas estructurales, derechos efectivos y membresías; no selecciona valor_cifrado, pista ni filas de public.credenciales. Conservar los resultados privados fuera de Git. La captura previa no debe sustituirse por verify.sql, cuyas aserciones esperan ya el estado endurecido.

Los ocho permisos son SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER y MAINTAIN (PostgreSQL 17+). RLS no protege TRUNCATE. No se acredita aquí una vía de TRUNCATE desde la API pública; retirar el permiso reduce capacidad innecesaria. El export anterior de publicación ya se recibió/revisó y el propietario confirmó funcionamiento tras la rotación; el export final sigue pendiente. n8n usa postgres según evidencia manual y ese rol no cambia en esta propuesta: la revisión final del grafo es una tarea distinta y no demuestra ni sustituye una captura de ACL. No se tocan políticas, roles, membresías, grants de PUBLIC, default privileges ni tablas editoriales.

### Validación funcional prevista después de una aplicación autorizada

| Comprobación | Evidencia requerida, sin valores reales |
| --- | --- |
| Permisos | verify.sql: anon/authenticated sin los ocho efectivos ni permisos de columna; ACL directa posterior exactamente 16 entradas protegidas, owner/RLS/políticas y efectivos de service_role/postgres iguales a la captura previa |
| Panel admin | Autenticación y has_role(admin) siguen vigentes. Abrir listado de resúmenes y, bajo autorización de escritura separada/incluida en la ventana, crear una entrada ficticia de prueba, actualizarla, alternar activo y eliminarla mediante el panel. No modificar credenciales operativas ni mostrar pistas/valores en el informe |
| Lectores del servidor | Probar R2 mediante HeadBucket desde probarCredencialR2, sin cargar, descargar, publicar ni borrar videos. Verificar que usa una credencial activa almacenada, no un fallback de entorno, para acreditar lectura/descifrado real de credenciales. Registrar solo éxito/error no sensible |
| Otros helpers | R2, pCloud y n8n leen por obtenerCredencial con supabaseAdmin. El código confirma que no necesitan grants directos authenticated. No probar n8n con una publicación ni asumir que un 400 sin fecha del endpoint prueba lectura de la tabla: esa respuesta ocurre antes de consultarla. No ejecutar el helper heredado pCloud si no está en uso; declarar límites |
| Fallos | Detener reanudación ante 42501 o consumidor inesperado; comprobar rol/ruta de acceso y captura. Recuperar grants solo con decisión explícita y ACL posterior sin deriva. Si COMMIT es incierto, reconciliar mediante metadatos antes de cualquier repetición |

La prueba de edición del panel sí escribe datos ficticios y HeadBucket sí llama un servicio: **ninguna se ejecuta en esta revisión**. El éxito manual de publicación anterior y las pruebas locales de CRUD no sustituyen estas comprobaciones posteriores al cambio.

## Archivos fuera de migraciones

En [supabase/proposals/minimum-credential-privileges](../supabase/proposals/minimum-credential-privileges/):

1. **capture-before.sql**: lectura de catálogos en BEGIN READ ONLY/ROLLBACK. Guardar resultados protegidos de contexto, propietario, ACL raw y aclexplode (grantor/grantee/grant option), ACL de columna, RLS/políticas estructurales, índices, restricciones, triggers, reglas y membresías. No consulta filas de credenciales ni devuelve ciphertexts. Confirmar en el panel proyecto correcto y current_user=postgres; no adjuntar el reporte privado a Git.
2. **apply.sql**: transacción con lock_timeout=5s, statement_timeout=30s y ACCESS EXCLUSIVE sobre esta tabla para impedir DDL/operaciones concurrentes durante la revisión corta de grants. Exige PostgreSQL 17+, current_user/owner postgres, tabla ordinaria, RLS habilitado/no forzado, ACL original exacta (32 entradas), sin ACL de columna. Revoca los ocho a anon y authenticated con RESTRICT. Verifica ausencia de permisos efectivos de tabla/columna y conserva matriz efectiva de service_role/postgres. Fallo de precondición/inherencia/grants aborta todo: ROLLBACK; nunca usar CASCADE ni forzar.
3. **verify.sql**: captura de metadatos y aserciones READ ONLY/ROLLBACK del estado posterior (solo 16 entradas directas de postgres/service_role). Verifica cero derechos efectivos de anon/authenticated y ningún grant de columna; comparar propietario, RLS/políticas y roles protegidos con captura previa. No da por probadas funciones del panel sin comprobación posterior autorizada.
4. **recover.sql**: solo si se decide recuperar una aplicación confirmada y la ACL posterior exacta sigue sin deriva. Restaura únicamente los ocho permisos retirados a anon/authenticated, como postgres, sin WITH GRANT OPTION. Compara la ACL expandida final con las 32 entradas originales y comprueba los ocho efectivos por rol. No concede a postgres/service_role ni cambia RLS/políticas. No revierte cambios posteriores ni restaura indiscriminadamente ALL.

La recuperación es fiel a esa base **comprobada y condicionada**, no genérica: si la captura nueva encuentra otro grantor, grant option, PUBLIC, columnas o roles adicionales, detenerse y adaptar ambos scripts con pruebas. No registrar versiones de migración ni ejecutar scripts históricos. El orden del array textual relacl puede variar al otorgar; equivalencia se verifica por grantee/grantor/privilegio/is_grantable, no por orden de impresión.

## Secuencia manual futura, separada de la rotación n8n

1. Revisar export y dependencias; autorizar explícitamente cambio de permisos. Pausa proporcional del propietario único, sin otras escrituras/DDL. Guardar captura previa y preparar recuperación. Confirmar que la ACL actual coincide con la base anterior; una 42501 u otra diferencia no se resuelve ampliando permisos a ciegas.
2. Ejecutar apply una sola vez; guardar resultado de COMMIT. Si falla, ROLLBACK antes de continuar. Si la conexión hace incierto el COMMIT, mantener pausa y ejecutar solo captura/verificación de lectura: comparar ACL original o endurecida; no repetir apply ni recover a ciegas. Un estado distinto bloquea y necesita reconciliación.
3. Ejecutar verify y comparar captura. Validar manualmente, bajo autorización, listado/guardado/activación/borrado de una credencial ficticia de prueba y lectura segura R2 sin publicaciones o borrados de videos. Esa prueba del panel escribe una fila ficticia, por lo que no se ejecuta en esta preparación ni se confunde con solo lectura. Evitar valores reales y no alterar las entradas operativas.
4. Si falla funcionamiento, identificar el consumidor que dependía de grants directos antes de conceder nada; preferir corregir el uso legítimo. Si se decide recuperación y no hubo deriva de ACL, recover y nueva captura; reabrir solo tras verificar panel/servidor compatibles. La recuperación deliberadamente vuelve a conceder permisos amplios anteriores y es contingencia, no solución permanente.
5. Conservar evidencia y default privileges como pendiente: futuras tablas/recreaciones pueden heredar grants amplios. Mantener pendiente usuario dedicado de n8n. No mezclar estas decisiones con la rotación de la cabecera interna.

## Validación local de la preparación previa

Suite: `npm.cmd run test:privileges` en tools/credential-rekey con REKEY_TEST_PG_BIN apuntando únicamente a binarios locales. Crea cluster desechable loopback sin leer .env; prueba captura, apply/verify/recover, CRUD del backend privilegiado, conservación RLS/políticas/ACL protegidas y rechazo ante grant options, herencia, ACL de columna y cambios posteriores.

Resultados de esta preparación: **5/5 pruebas SQL aprobadas en PostgreSQL 18.4 local**, sin omisiones; el caso de herencia confirma que un SELECT heredado que sobrevive al REVOKE aborta y revierte la transacción completa. **5/5 pruebas** de los fragmentos n8n con datos ficticios y **19/19 pruebas** de recifrado/preflight existentes aprobadas. TypeScript, lint de los módulos de herramienta y test n8n, git diff --check y revisión de secretos/artefactos de los 12 archivos cambiados correctos. No se repitió build porque no cambia la aplicación ni sus dependencias. No equivalen a ejecución en Supabase, importación del workflow ni prueba del panel real.

La preparación partió de 2c44ea9 y se conservó pendiente hasta la revisión y commit local autorizados posteriormente. Las ejecuciones reales de captura/apply/verify se documentan por separado arriba; no deben confundirse con los ensayos ficticios. Los archivos privados de la rotación y de sus comprobaciones no se incorporan al repositorio.

## Revisión final para el commit local, 23 de octubre de 2026

El propietario ratifica los resultados de permisos como evidencia manual, sin aportar una comprobación funcional adicional del panel. Se revisa el bloque pendiente completo de rotación n8n y mínimo privilegio; las confirmaciones manuales se distinguen de las verificaciones SQL/HTTP directas. No se ejecutan nuevas operaciones externas en esta revisión.

- **19/19** pruebas de recifrado/preflight, **11/11** de saneamiento/filtros n8n, **37/37** regresiones de confirmación de cargas y **5/5** pruebas SQL en PostgreSQL local desechable aprobadas: **72 pruebas**, sin fallos ni omisiones.
- TypeScript sin errores; ESLint aislado de todos los módulos .mjs de la herramienta y n8n correcto. JSON saneados comparados con la transformación del export original y revisión de whitespace/git diff --check correctos.
- Revisión de los **20 archivos candidatos**: sin secretos detectados por patrones ni coincidencias con los tres secretos históricos o la cabecera fija del export original, comparados solo en memoria sin imprimirlos. Solo código/propuestas, tests, manifiesto y documentación; no se incluyen .env, exports originales, respaldos, recibos, capturas de metadatos privadas, contraseñas, temporales, node_modules o artefactos de build. Los JSON n8n incluidos están saneados y marcados como revisión, no como estado final de producción.
- No se repite build ni lint global de la aplicación: no hay cambios en src ni en sus dependencias/configuración. La deuda de lint previa de aplicación queda fuera del bloque. El fragmento mensual histórico se conserva como material no instalado; no se revisó ni modificó el workflow mensual inactivo.
- Se conservan como pendientes la comprobación funcional del panel/lectores después de los grants, el export final n8n, default privileges, usuario exclusivo de n8n y las mejoras independientes de publicación/limpieza R2. No se declara cierre de esos puntos por crear este commit.

El commit es únicamente local y sucede a 2c44ea9, sin amend ni rebase. Sin push, despliegue ni cambios adicionales en producción durante estas validaciones.
