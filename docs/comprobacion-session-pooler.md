# Preparación de conexión e inspección de solo lectura

Estado posterior: conexión e inspección completadas conforme al registro al final; simulate/apply autorizados y completados después según [cierre del recifrado](ejecucion-final-recifrado.md). Los estados pendientes y fallos iniciales que siguen se conservan como evidencia histórica. No repetir operaciones por este registro.

Session pooler es la modalidad elegida por el propietario. Esta preparación NO ejecuta la conexión al proyecto y NO autoriza recifrado, simulación con datos reales ni cambios de claves. Se conserva la documentación pendiente.

La entrada independiente es tools/credential-rekey/preflight-cli.mjs. No tiene modos apply/recover: únicamente conexión TLS e inspección dentro de BEGIN TRANSACTION READ ONLY, con timeouts y ROLLBACK. No consulta filas de credenciales, no toma LOCK EXCLUSIVE y no necesita llaves de datos o respaldo; rechaza oldKey/newKey/backupKey si se suministran.

## Datos que debe confirmar el operador

- En Connect del proyecto grjxcsngfnxdkkdkkujh, seleccionar Session pooler y comprobar host *.pooler.supabase.com, puerto 5432, base postgres y usuario postgres.grjxcsngfnxdkkdkkujh. No usar Transaction pooler/6543 ni inferir la modalidad únicamente del puerto. El CLI exige la confirmación explícita sessionPoolerConfirmed; no puede detectar automáticamente el modo. PID estable dentro de una transacción tampoco lo prueba.
- Confirmar red hacia ese host y certificado TLS válido para su nombre. El cliente fija rejectUnauthorized=true y TLS mínimo 1.2, verifica que el socket negociado esté cifrado y autorizado y registra solo el protocolo. No usar IP en lugar del host ni desactivar validación del certificado. CA adicional solo si procede y ha sido revisada.
- Custodiar la contraseña de base en el gestor seguro. No es una clave sb_secret_, una JWT ni una llave de cifrado de la aplicación. No enviarla al chat ni copiar una cadena de conexión completa. El proceso seguro que la suministre no debe escribirla en logs ni argumentos.
- Preparar dos rutas absolutas NUEVAS en un directorio protegido fuera del repositorio: schemaFile y reportFile. El CLI no sobrescribe archivos y usa 0600; revisar además ACL de Windows y evitar directorios sincronizados/enlaces simbólicos. El JSON de schema puede contener definiciones de funciones/políticas: revisión privada, no salida de consola. El reporte contiene contexto, permisos y metadatos estructurales, no filas.

La configuración es un objeto recibido por stdin desde un gestor seguro, sin leer .env ni valores de Vercel. Campos necesarios:

| Campo | Contenido esperado |
| --- | --- |
| target | grjxcsngfnxdkkdkkujh |
| readOnlyInspectionAuthorized | true solo tras autorizar explícitamente esa conexión de lectura |
| sessionPoolerConfirmed | true después de revisar la modalidad en el panel |
| connection.mode | session |
| connection.host / port / user / database | Metadatos descritos arriba; port numérico 5432 |
| connection.password | Inyectada privadamente por el gestor, nunca mostrada |
| connection.ca | Opcional, certificado CA confiable; no una clave privada |
| schemaFile / reportFile | Rutas nuevas y protegidas fuera del repositorio |

Con autorización posterior, la salida del proceso seguro se conectaría por pipe a `node tools/credential-rekey/preflight-cli.mjs`. No se facilita una orden con secretos ni se ejecuta aquí. No usar echo, argumentos con contraseña, transcripciones de shell o JSON en claro como transporte. Este programa acepta únicamente stdin y rechaza argumentos extra.

## Qué se comprueba y qué no

1. Conexión de una única instancia pg.Client al proyecto fijado, usando el usuario esperado y verificación TLS. La comprobación del socket valida ordenador → pooler; no acredita por sí sola el cifrado pooler → PostgreSQL.
2. En transacción READ ONLY: base, usuario de sesión/efectivo, versión y PID. Comprueba existencia de tabla ordinaria, USAGE de public, SELECT y UPDATE, bypass RLS directo por rolsuper/rolbypassrls y que row_security_active sea false.
3. SELECT y bypass de RLS respaldan la capacidad de leer todas las filas sin leerlas durante este ensayo. UPDATE respalda el permiso de actualizar y de solicitar EXCLUSIVE; no se intenta escribir ni adquirir ese bloqueo en producción. Una adquisición inmediata depende además de concurrencia y timeouts.
4. Captura el JSON inspect y las consultas de capture-schema.sql: columnas, restricciones, índices, triggers, políticas y ACL/membresías. El script solo consulta catálogos; no devuelve valor_cifrado/pista de ninguna fila. Cuerpos arbitrarios no se emiten en el reporte estructural; se conserva el schema privado para revisión exacta.
5. connectionPermissionsSatisfied=true significa únicamente comprobaciones de conexión/permisos satisfechas. NO significa esquema aprobado: schemaCompatibilityEvaluated y rekeyApproved permanecen false. Todavía deben aprobarse PK(id), restricciones, índices, trigger permitido, reglas y correspondencia de schemaFile antes de planear el recifrado.

La consola solo emite indicadores booleanos. Código de salida 0: captura y comprobaciones de conexión/permisos correctas; 2: captura disponible pero permisos/requisitos no satisfechos; 1: fallo de entrada/conexión/TLS/consulta/archivo, con mensaje genérico y sin detalles de error sensibles. Si quedan archivos de una captura incompleta, no mezclarlos con otra ejecución: usar rutas nuevas y verificar su procedencia privada.

## Revisión posterior

Revisar reportFile/schemaFile privadamente y compartir únicamente metadatos necesarios, nunca cuerpos de funciones o archivos completos sin inspeccionarlos. La salida del SQL Editor corresponde a otra sesión: no sustituye la comprobación del rol efectivo de la conexión pooler. Confirmar que no existe SET ROLE inesperado.

Si el preflight falla, detenerse y corregir los datos o permisos mediante una operación revisada; no conceder privilegios ni cambiar RLS automáticamente. No aprobar recifrado por un preflight positivo: seguirán pendientes mantenimiento, respaldo independiente y coordinación con Vercel. Ninguna clave ni servicio se modifica en este paso.

Referencias de configuración: [Supabase: conexiones](https://supabase.com/docs/guides/database/connecting-to-postgres) y [node-postgres: TLS](https://node-postgres.com/features/ssl).

Validación local de esta preparación: 19/19 pruebas unitarias/PGlite/CLI y 7/7 pruebas nativas PostgreSQL 18.4. La prueba nueva confirma READ ONLY, ROLLBACK, permisos y metadatos, sin consulta de filas ni bloqueo exclusivo y sin cambios de datos. Lint, sintaxis y git diff --check correctos. La validación de TLS usa sockets ficticios; no se ha certificado el transporte real del pooler. Sin commit, push, despliegue ni cambios externos.

## Intento autorizado de conexión

El propietario autorizó conectar a aws-0-us-west-2.pooler.supabase.com:5432, base postgres, usuario postgres.grjxcsngfnxdkkdkkujh mediante Session pooler. Se abrió un diálogo local enmascarado y se envió la contraseña únicamente por un pipe UTF-8 en memoria, sin archivos ni argumentos. Se corrigió una incompatibilidad del envío con Windows PowerShell y se validó el pipe localmente con entrada ficticia. El CLI ahora informa solo etapa y códigos de error permitidos, sin objetos de error ni valores.

El intento diagnosticado se detuvo en connection con SELF_SIGNED_CERT_IN_CHAIN, antes de autenticar o consultar permisos/metadatos. Un handshake separado sin usuario ni contraseña y con --use-system-ca también rechazó la cadena. No se desactivó rejectUnauthorized ni se aceptó un certificado obtenido de la conexión sin validar. No hay inspección remota completada ni se verificó la contraseña; no se ejecutó recifrado.

Pendiente: obtener la CA oficial desde Database Settings → SSL Configuration del proyecto correcto, comprobar su procedencia y suministrarla en connection.ca. Solo se necesita su archivo público, no claves privadas ni contraseñas en el chat. Véase [Supabase: verificación SSL](https://supabase.com/docs/guides/platform/ssl-enforcement). Luego podrá repetirse el handshake sin contraseña y, si valida, solicitar nuevamente la contraseña en el diálogo local, pues no fue conservada. No cambiar SSL enforcement ni otras opciones del servicio para resolver este fallo.

### Reintento con CA suministrada por el propietario

Se utilizó el archivo público C:\Repositorio\certificado_evangelio_supabase\prod-ca-2021.crt indicado por el usuario. El handshake sin contraseña validó cadena y hostname con rejectUnauthorized=true, verificación de nombre y TLSv1.3. No se cambió el almacén global de confianza ni configuración de Supabase.

Después se solicitó nuevamente la contraseña mediante diálogo local enmascarado y se suministró por stdin en memoria junto con la CA. La conexión recibió código PostgreSQL 28P01 en la fase connection: autenticación rechazada. No se conservaron credenciales ni se completó la inspección de permisos/metadatos. El éxito TLS no acredita autenticación ni permisos. Pendiente confirmar privadamente la contraseña de base y repetir bajo el mismo alcance de lectura, sin publicarla en el chat ni rotarla automáticamente. No se ejecutó recifrado ni se cambiaron claves de Vercel.

### Reintento posterior completado: evidencia directa

Tras nueva autorización del propietario se repitió el diálogo enmascarado. La conexión autenticó y el preflight terminó con salida 0: readOnly=true, tlsVerified=true, connectionPermissionsSatisfied=true, inspectionCaptured=true y rekeyExecuted=false. La contraseña se suministró solo en memoria por stdin; no se guardó en los archivos de captura ni se imprimió. No se cambiaron claves.

Contexto observado: base postgres, session_user=postgres, current_user=postgres, PostgreSQL 17.6 y transaction_read_only=on. TLSv1.3 con certificado autorizado usando la CA proporcionada. Session pooler es la modalidad confirmada por el propietario; no se infiere automáticamente de un PID estable.

public.credenciales es tabla ordinaria, propietaria postgres, RLS habilitado/no forzado y sin políticas. El rol efectivo no es superusuario, pero tiene rolbypassrls=true; row_security_active=false, USAGE de public=true, SELECT=true y UPDATE=true. Esto acredita permisos de lectura completa sin filtrado RLS y de actualización; UPDATE permite solicitar EXCLUSIVE, pero no se intentó ese bloqueo ni se escribieron datos.

Compatibilidad contrastada con checkSchema local: diez columnas con los tipos esperados y sin identity/generated; PRIMARY KEY(id), UNIQUE(servicio,nombre), cero reglas; ambos índices btree válidos/listos, sin expresiones ni predicados. El único trigger capturado está habilitado y cumple la definición BEFORE UPDATE por fila, función PL/pgSQL, search_path public y cuerpo conocido admitidos por la herramienta. No se encontraron incompatibilidades en los metadatos revisados. El JSON schema exacto queda pendiente de aprobación del operador; esto no autoriza simulate/apply/recover.

Captura privada fuera del repositorio: C:\Users\dcamu\AppData\Local\Evangelizador\preflight\cd5f858a42a845e4a141514ed3ff9bc1\schema.json y report.json. Contienen metadatos, no filas ni contraseñas. No se copia aquí el cuerpo completo de funciones/políticas. La transacción de inspección terminó en ROLLBACK y se cerró la conexión.

Siguen pendientes la aprobación operacional del esquema, la ventana de mantenimiento y las comprobaciones de recifrado/respaldo sobre datos reales bajo autorización separada. No se validó descifrado de filas ni se produjo un respaldo de credenciales en esta inspección.
