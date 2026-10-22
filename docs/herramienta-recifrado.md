# Herramienta local de recifrado de credenciales

El [procedimiento y cierre del recifrado](ejecucion-final-recifrado.md) reúne comandos, entrada enmascarada, mantenimiento y recuperación. Actualización del 22 de octubre de 2026: simulate y apply completados con 8 filas, respaldo/recibo verificados y COMMIT confirmado en apply; conexión cerrada. El propietario confirma variable Production actualizada, despliegue Ready y prueba R2 correcta. Recover no ejecutado. Se conservan protegidos los archivos y las llaves de recuperación, fuera de Git. Las secciones de preparación y ensayos que siguen son evidencia histórica, no el estado operativo actual.

Preparación inicial del 19 de octubre de 2026. Código en tools/credential-rekey; en esa fase no hubo ejecución contra Supabase ni cambio en Vercel. Los documentos operativos pendientes se conservan. El cierre posterior no autoriza nuevas operaciones externas.

## Contrato y requisitos de esquema (preparación histórica)

El formato de src/lib/credenciales.server.ts está reproducido sin cambiar la aplicación: AES-256-GCM, llave SHA-256 del texto UTF-8 exacto, IV aleatorio de 12 bytes, tag de 16 bytes, ciphertext; concatenación codificada en base64. No se recortan claves. La prueba de interoperabilidad usa las funciones reales de la aplicación con una llave ficticia.

En la preparación inicial aún no se había inspeccionado public.credenciales; la [inspección posterior](comprobacion-session-pooler.md) confirmó los metadatos compatibles usados en el recifrado. La migración histórica describe diez columnas: id uuid PK; servicio/nombre/descripcion/valor_cifrado/pista text; activo boolean; actualizado_por uuid; created_at/updated_at timestamptz. No se afirma que dicha migración esté aplicada. La herramienta inspecciona columnas, PK/restricciones, triggers y funciones, reglas, propietario, RLS/políticas y capacidad bypass del ejecutor. Exige un snapshot revisado idéntico al vigente y la forma de tabla soportada; rechaza columnas adicionales, reglas, particiones, columnas generadas y triggers desconocidos. No aplica SQL de esquema ni modifica RLS.

Único trigger admitido, si existe: BEFORE UPDATE FOR EACH ROW que invoca set_updated_at(), PL/pgSQL, search_path public y cuerpo exclusivamente BEGIN NEW.updated_at = now(); RETURN NEW; END;. No se da por existente en credenciales por estar verificado en otras tablas. No se deshabilitan triggers. updated_at refleja la operación de recifrado/recuperación; el respaldo conserva su valor anterior, pero la recuperación no puede restaurarlo exactamente mientras el trigger lo recalcula. Los demás metadatos deben mantenerse idénticos.

Antes de usar, revisar también ACL, consumidores, índices/restricciones, volumen y cualquier mecanismo externo de auditoría. Si el esquema real difiere, detenerse y adaptar/probar la herramienta mediante revisión; no cambiar producción para ajustarla al código.

La captura de lectura preparada está en [capture-schema.sql](../tools/credential-rekey/capture-schema.sql). Incluye contexto, columnas y defaults permitidos, restricciones de entrada/salida, índices, triggers internos/no internos, RLS/políticas estructurales, ACL de tabla/columnas, permisos efectivos y membresías. Solo consulta catálogos dentro de una transacción READ ONLY que termina en ROLLBACK. No consulta filas de credenciales ni imprime expresiones/cuerpos arbitrarios: esos detalles quedan señalados para revisión privada. El identificador del proyecto no se deduce de current_database(); confirmar el panel grjxcsngfnxdkkdkkujh manualmente.

El siguiente paso elegido es [comprobar Session pooler](comprobacion-session-pooler.md), con un CLI independiente limitado a inspección READ ONLY y TLS. No ejecutar simulate/apply/recover para comprobar la conexión: esos modos acceden a las filas y pueden tomar bloqueo exclusivo. El recifrado permanece pendiente.

Resultado posterior: la conexión autorizada vía Session pooler y CA oficial proporcionada se completó en READ ONLY, con PostgreSQL 17.6, rol efectivo postgres con BYPASSRLS y permisos SELECT/UPDATE/USAGE. Los metadatos reales capturados son compatibles con las comprobaciones actuales; ver el registro de conexión enlazado y su captura privada. Esta evidencia posterior supera la limitación inicial de no haber inspeccionado el esquema, pero no aprueba recifrado ni demuestra descifrado de datos reales. Se conservan abajo los resultados y límites históricos de las pruebas locales.

Esta captura estructural no sustituye el JSON exacto requerido por inspect: comparar ambos y revisar privadamente las definiciones omitidas antes de aprobar schemaFile. No considerar la captura del fixture local evidencia del esquema Supabase activo.

## Dependencias y modos

Subproyecto npm aislado, sin modificar package.json ni lockfiles de la aplicación. Runtime: pg 8.16.3. Pruebas: PGlite 0.3.14 (PostgreSQL embebido en memoria). Se requieren dependencias raíz instaladas para la prueba contra TypeScript de la aplicación. Node usado en validación: 24.18.0.

Instalación/pruebas locales, sin servicios:

```powershell
npm.cmd ci --prefix tools/credential-rekey --ignore-scripts
npm.cmd test --prefix tools/credential-rekey
```

Ensayo nativo opcional: definir REKEY_TEST_PG_BIN con una ruta absoluta a binarios PostgreSQL locales confiables y ejecutar npm.cmd run test:native --prefix tools/credential-rekey. No contiene claves. El ensayo crea su propio cluster temporal y dos conexiones con PIDs distintos en 127.0.0.1, sin heredar destinos PGHOST/PGDATABASE ni leer .env. No instala un servicio. Al terminar detiene y elimina únicamente el cluster de prueba. Los binarios usados en esta revisión se descargaron solo a TEMP desde @embedded-postgres/windows-x64@18.4.0-beta.17; postgres --version informa 18.4. No se añadió ese paquete a las dependencias del proyecto ni de la herramienta.

El CLI acepta únicamente un modo no secreto: inspect, simulate (predeterminado), apply o recover. Las entradas completas llegan como un único JSON por stdin desde un gestor de secretos/proceso seguro; rechaza argumentos adicionales. No carga .env ni lee variables de Vercel. No usar echo, argumentos, historial de terminal o archivos JSON en claro para pasar secretos. No incluir la salida del gestor en transcripciones ni en logs de CI. Si no existe ese canal de entrada seguro, no operar.

Campos de entrada (solo nombres, sin valores reales):

| Campo | Uso |
| --- | --- |
| target | Debe ser grjxcsngfnxdkkdkkujh |
| operatorAuthorized | true únicamente tras autorización operacional explícita; no es autorización otorgada por la herramienta |
| connection | host, port, user, database, password y ca opcional. database postgres; host directo del proyecto o pooler Supabase con usuario postgres.PROJECT_REF del proyecto fijado. TLS con verificación de certificado obligatoria |
| schemaFile | Ruta absoluta de metadatos protegidos fuera del repositorio, creada por inspect y revisada por el operador |
| oldKey / newKey | Texto exacto de llaves. La nueva requiere al menos 32 bytes y generación aleatoria segura fuera de la herramienta |
| backupKey | Llave aleatoria independiente, al menos 32 bytes; debe ser distinta de ambas llaves de datos y estar bajo custodia separada |
| backupFile | Archivo nuevo de respaldo, absoluto y fuera del repositorio; también requerido en simulate y recover |
| receiptFile | Archivo nuevo de recuperación para apply; archivo existente de recibo para recover |
| maintenanceConfirmed | true para apply/recover, solo después de verificar la pausa y drenaje reales |

Tras autorización, el proceso seguro que entrega ese JSON se conecta por pipe a node tools/credential-rekey/cli.mjs MODE. Este documento no proporciona una orden con credenciales ni ejecuta ese pipe. inspect solo captura metadatos en schemaFile y no necesita llaves de cifrado. La captura puede incluir definiciones de funciones: revisarla de forma privada, no pegarla en chats.

El CLI fija el proyecto por host/usuario, no descubre proyectos ni permite otro proyecto. La biblioteca sí se prueba con un adaptador de base aislada. Usar conexión directa o pooler de sesión autorizado, nunca REST/PostgREST ni distribuir consultas entre clientes. El rol debe ver todas las filas con bypass RLS; el CLI admite el usuario postgres del proyecto. No se crean usuarios ni grants aquí. Acordar privilegios y custodia antes de operar.

## Respaldo y garantías

La herramienta abre una sesión dedicada y una transacción; aplica lock_timeout 5s, statement_timeout 30s, idle_in_transaction_session_timeout 60s y LOCK TABLE public.credenciales IN EXCLUSIVE MODE antes de leer filas/esquema. El bloqueo impide escrituras y otros bloqueos incompatibles mientras dura la transacción, pero permite lecturas ordinarias. No sustituye el mantenimiento después del commit. Usa parámetros SQL, no interpola secretos. Exige entre 1 y 10000 filas para evitar una operación ilimitada en memoria; revisar límites en un ensayo representativo.

Primero valida descifrado de TODAS las filas, incluidas inactivas, y realiza cifrado/descifrado con la llave nueva y comparación byte a byte en memoria. Ninguna escritura SQL ocurre hasta terminar esa pasada y guardar/verificar el respaldo independiente. Plaintexts no salen a disco, SQL ni logs; los buffers se borran al terminar, con la limitación de que V8 no garantiza borrado completo de strings/copias de memoria. Usar host protegido, evitar dumps y depuración, y terminar el proceso después del corte.

El respaldo previo contiene filas completas y ciphertexts, no valores descifrados, y queda cifrado adicionalmente con AES-GCM bajo backupKey. El contenido del sobre también protege los metadatos y pistas. Los archivos se crean con wx (sin sobrescribir), modo 0600, fsync y lectura/descifrado de verificación antes de continuar. Usar un directorio local protegido sobre volumen cifrado, sin sincronización pública ni enlaces simbólicos, y custodiar backupKey aparte. En Windows 0600 no reemplaza ACL: validar explícitamente los permisos del directorio y del archivo. No confiar en permisos POSIX como única protección.

simulate hace la validación y respaldo con datos reales solo cuando se autorice, pero nunca actualiza filas y termina en ROLLBACK. Es una operación con lectura de secretos y bloqueo, no una consulta inocua a ejecutar sin coordinación. En este trabajo solo se simularon datos ficticios.

apply actualiza valor_cifrado con condición de igualdad del snapshot completo de cada fila y exige una fila afectada. No cambia pistas, servicio, nombre o activo. Relee TODO, exige ciphertext exacto al plan, metadatos invariantes salvo updated_at y descifrado con la nueva llave. Guarda además un recibo cifrado con snapshot previo y posterior exacto antes de COMMIT. Un fallo antes de commit revierte todas las escrituras; no hay actualización parcial.

Si se pierde conexión al enviar COMMIT, el resultado es incierto: el CLI solo emite un mensaje genérico. No reintentar apply automáticamente. El recibo puede existir aunque el commit no se haya completado; su presencia no demuestra éxito. Reconectar bajo mantenimiento y reconciliar el estado antes de decidir. Si falta o se corrompe el recibo, conservar respaldo y pausar para recuperación revisada; no improvisar restauración.

## Recuperación

recover exige recibo autenticado del mismo proyecto/esquema, llaves vieja/nueva/backup y otro archivo nuevo de respaldo. Bloquea la tabla y compara TODAS las filas actuales, incluidos timestamps, con el snapshot exacto posterior. Si hubo cualquier cambio posterior, falla para evitar pérdida de datos; no borra filas ni sobrescribe ediciones nuevas.

Antes de escribir comprueba que los ciphertexts previos y posteriores descifran al mismo contenido con sus respectivas llaves. Respalda el estado actual con protección independiente, restaura ciphertexts anteriores transaccionalmente y verifica con la llave anterior. updated_at puede cambiar por el trigger activo; los demás metadatos y ciphertexts deben coincidir. El mismo recibo no es reutilizable después de recuperar. Mantener la aplicación pausada hasta promover una configuración compatible con el estado recuperado.

Si hubo escrituras después de reabrir, no usar restore masivo: preparar una reconciliación adicional bajo autorización. La herramienta se niega a hacerlo automáticamente. El respaldo previo por sí solo conserva información, pero no sustituye el recibo exacto exigido por recover; su restauración manual requiere un procedimiento nuevo revisado.

## Coordinación con Vercel

1. Verificar primero que el acceso Supabase comprometido esté invalidado y las credenciales de operación sean seguras; no reutilizar la JWT expuesta. Revisar DDL activo y aprobar la captura inspect. Ensayar en aislamiento con escala y esquema representativos.
2. Preparar nueva llave y despliegue compatible sin dirigir tráfico ni tareas a él. No promover una versión con llave nueva mientras los datos estén con la antigua. Inventariar todos los escritores/consumidores, instancias viejas, Preview y disparadores n8n; registrar trabajos en curso sin repetir publicaciones.
3. Activar mantenimiento real y drenar escritores, también los que puedan quedar bloqueados esperando la transacción: no deben ejecutar escrituras antiguas al liberarse el lock. La aplicación no tiene aquí un interruptor implementado; definirlo y autorizarlo por separado. Mantener también lectores fuera del intervalo de incompatibilidad.
4. Ejecutar simulate bajo mantenimiento y revisar resultado y restaurabilidad del respaldo. Revalidar schema antes de apply; usar archivos NUEVOS en cada ejecución. Ejecutar apply solo tras autorización y con la promoción preparada.
5. Después del COMMIT confirmado, mantener mantenimiento mientras se actualiza CREDENCIALES_ENC_KEY y se promueve/reinicia el despliegue. PostgreSQL y Vercel no comparten transacción: ese intervalo requiere pausa operativa. Validar lectura/descifrado y luego una escritura aislada autorizada antes de reabrir; comprobar que no quedan procesos con la llave antigua.
6. Ante fallo, preferir corregir hacia delante con la llave nueva. Si se decide recover antes de reabrir escrituras, ejecutar bajo mantenimiento y promover la configuración antigua solo cuando los datos hayan sido restaurados y verificados. No cambiar solo una de las dos partes.
7. Retirar llave antigua de entornos y despliegues accesibles; conservarla únicamente en custodia de recuperación durante un plazo definido. Validar un respaldo nuevo restaurable antes de expirar el anterior y su custodia. La copia publicada en Git sigue expuesta: si alguien obtuvo ciphertexts, recifrar no revoca las credenciales de proveedores que pudo descifrar; evaluar rotación independiente de esos secretos.

### Secuencia exacta de mantenimiento y fallo de promoción

| Fase | Datos / procesos y condición de avance |
| --- | --- |
| Preparación | Aprobar esquema real y permisos; probar recuperación y ACL del directorio protegido; custodiar ambas llaves de datos y backupKey por separado. Identificar el despliegue de retorno y su configuración, sin publicar ni imprimir secretos |
| Pausa | Bloquear acceso de usuarios que pueda leer/escribir credenciales, guardados, altas/bajas y otros consumidores; pausar disparadores n8n/cron y ejecuciones manuales pertinentes. Drenar también tareas en espera y procesos antiguos. Ningún escritor antiguo debe poder quedar en cola para ejecutarse tras COMMIT |
| Ensayo | simulate con los datos pausados y archivos nuevos; comprobar respaldo y aprobación sin modificar datos. Revalidar schema antes de apply |
| Corte de datos | apply con confirmación de mantenimiento: bloqueo, respaldo previo, recifrado, recibo posterior y COMMIT. No cambiar la variable activa durante esta transacción |
| Corte de aplicación | Mantener TODOS los consumidores pausados. Sustituir CREDENCIALES_ENC_KEY en el ámbito autorizado, construir/desplegar con la nueva configuración y promover solo una versión lista que la contenga. Cambiar la variable no actualiza despliegues viejos |
| Validación | Comprobar descifrado de todas las filas por proceso seguro sin valores en salida; probar lectura desde la nueva aplicación y escritura aislada autorizada. Aislar despliegues con llave vieja antes de reabrir. La herramienta no cambia Vercel ni acredita estas pruebas |
| Reapertura | Reanudar consumidores y disparadores de forma controlada, observando errores y reconciliando trabajos inciertos. No repetir una publicación ni eliminar un video para validar |

Si el despliegue/promoción falla ANTES de COMMIT, detener apply o confirmar ROLLBACK y comprobar que los datos siguen bajo la llave vieja; no promover la configuración nueva. Si el resultado del COMMIT es incierto, mantener pausa y reconciliar con snapshots autenticados: nunca reintentar a ciegas.

Si falla DESPUÉS de COMMIT, la versión previa con llave vieja es incompatible con los datos nuevos: no devolverle tráfico. Mantener mantenimiento. Opción preferida: resolver la promoción usando la llave nueva. Alternativa, con autorización de recuperación y sin escrituras posteriores: ejecutar recover con recibo y respaldo nuevos; verificar ciphertexts recuperados/descifrado con llave vieja, devolver CREDENCIALES_ENC_KEY a la llave vieja en el ámbito afectado y desplegar/promover una versión que use esa configuración. Confirmar datos y aplicación compatibles antes de reabrir. Restaurar solo Git, solo la variable o solo los datos no basta.

Si recover detecta cambios posteriores, detener la recuperación y preparar reconciliación revisada; no forzarla. Para la restauración exacta de un respaldo en una base vacía se recuperan filas y timestamps originales mediante INSERT, como se ensayó localmente. Sobre la base existente, recover conserva ciphertexts y otros metadatos, pero el trigger recalcula updated_at; esa diferencia está prevista y no se oculta.

## Estado de validación y límites

Las pruebas PGlite con esquema/datos ficticios cubren formato real, inactivas, simulación, apply/recover, rollback de escrituras/timestamps, corrupción, cambio de esquema, triggers con efectos ajenos, archivos existentes, fallo de recibo, edición posterior y pérdida de acuse COMMIT. Se completaron además pruebas con PostgreSQL nativo local y dos sesiones independientes; los resultados se detallan abajo. No acreditan TLS del proyecto, pooler, permisos ni esquema reales, ni el corte operacional en Vercel.

No hay código funcional de aplicación modificado, configuración externa tocada, claves reales utilizadas ni ejecución contra producción. Las instrucciones previas de recifrado eran una propuesta; esta herramienta la implementa dentro de los límites indicados.

Resultados locales: 16/16 pruebas nuevas aprobadas; 37/37 pruebas de confirmación existentes; TypeScript sin errores; lint aislado de los tres archivos de herramienta y comprobación sintáctica satisfactorios; git diff --check y revisión de whitespace de archivos nuevos correctos. La instalación aislada informó cero vulnerabilidades. No se repitió build de la aplicación porque no cambian su código, configuración ni dependencias.

La revisión de valores históricamente expuestos no encontró coincidencias en los nuevos archivos de herramienta/documentación. No se imprimieron valores ni se cargó .env. La aprobación del esquema activo, permisos, transporte/pooler y ventana de mantenimiento sigue pendiente antes de operar.

### Evidencia nativa local

El primer intento bajo sandbox falló por el token restringido de Windows. Tras autorizar el ensayo fuera del sandbox se ajustó una opción de arranque Windows y el servidor quedó limitado a loopback. Ningún fallo se interpretó como validación satisfactoria. El servidor de prueba se detuvo y su directorio de datos se eliminó al finalizar.

Se comprobaron metadatos con capture-schema.sql sobre el fixture, dentro de READ ONLY y sin cambios de filas. Con dos pg.Client y pg_backend_pid distintos se verificaron espera de locks mediante pg_stat_activity/pg_blocking_pids, timeout de INSERT/UPDATE/DELETE, SELECT no bloqueado, escritor liberado tras ROLLBACK y ausencia de recifrado parcial. También un escritor liberado tras COMMIT modifica el snapshot y recover lo rechaza sin perder esa edición.

Se abrió el respaldo previo únicamente con backupKey y se restauró el snapshot exacto en otra base vacía del mismo cluster aislado. Las llaves vieja/nueva no abren ese sobre. Para descifrar los ciphertexts restaurados hace falta además oldKey: backupKey es protección independiente del archivo, no reemplazo de la llave de datos. Se verificó igualdad de plaintexts solo en memoria, sin imprimirlos. El recover transaccional también devolvió los ciphertexts originales, con updated_at recalculado por su trigger.

Resultado final de esta ampliación: **6/6 pruebas nativas y 16/16 pruebas PGlite/CLI**, sin fallos ni omisiones; lint de los cuatro módulos y comprobación sintáctica correctos; git diff --check y whitespace de archivos nuevos correctos. El sexto caso confirma que un escritor previo provoca lock_timeout de la propia herramienta antes del respaldo o de cualquier escritura de recifrado, sin alteración de datos después de ambos ROLLBACK. Las consultas de captura se validaron sobre PostgreSQL 18.4 ficticio; no se afirma equivalencia con la versión o configuración de Supabase activa.

No se hizo commit, push, despliegue, rotación ni modificación externa. Se conservaron los documentos locales pendientes. El servidor portátil, el cluster y las conexiones fueron exclusivamente locales; no se leyó .env ni se usaron claves reales.
