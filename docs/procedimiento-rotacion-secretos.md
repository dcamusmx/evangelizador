# Respuesta a secretos expuestos: procedimiento propuesto

Preparado inicialmente desde 3fcab4ca855e904d62707fe191164999158f7935 como propuesta documental. El recifrado se autorizó y completó posteriormente según la sección C y su cierre enlazado; las verificaciones manuales y directas se distinguen allí. Este documento no autoriza nuevas operaciones. Único proyecto permitido: grjxcsngfnxdkkdkkujh.

## Comprobación manual posterior a revocación HS256

Registro del 19 de octubre de 2026: el propietario comunica una comprobación funcional posterior a la revocación HS256. Se registra como evidencia manual del usuario; el agente no efectuó la revocación ni inspeccionó JWT Signing Keys. No se detallaron en este mensaje operaciones comprobadas, SHA/despliegue, llave revocada ni resultados de rechazo del token anterior. No atribuir a esta comprobación una prueba criptográfica de rechazo ni declarar cerrada toda la respuesta a los tres secretos. Los apartados A y de firma se conservan como procedimiento/evidencia requerida, sin afirmar que las operaciones manuales del propietario no hayan ocurrido.

## Prioridad y orden de ejecución posterior

1. Designar un operador para Vercel/Supabase y otro para n8n, fijar hora de corte y suspender nuevas operaciones de publicación durante los cortes que lo necesiten. Identificar trabajos en curso y resultados inciertos: no reenviar ni publicar para probar. Guardar respaldo cifrado y probar recuperación antes de cambiar la llave de cifrado. Revisar señales de acceso no autorizado sin copiar cuerpos ni tokens.
2. Prioridad máxima: sustituir el uso administrativo de la service_role JWT expuesta y preparar su invalidación como JWT. Desactivar las API keys heredadas solo bloquea apikey: NO revoca la JWT ni cierra el incidente. No esperar a limpiar el historial o al recifrado para preparar la retirada de confianza en su firma. Si hay abuso activo, el propietario debe decidir contención inmediata aun con interrupción controlada.
3. Rotar N8N_INTERNAL_API_KEY en ambos sentidos mediante corte coordinado. Puede prepararse en paralelo al inventario Supabase, pero cada activación debe tener responsables y validación propia.
4. Recifrar credenciales con una nueva CREDENCIALES_ENC_KEY, después de cerrar el acceso administrativo expuesto. Completar la ventana con validación y retirada de la llave anterior del entorno activo. Si pudieron extraerse ciphertexts, rotar también las credenciales subyacentes: recifrar no invalida copias robadas.
5. Revisar versiones antiguas accesibles, Preview/Development, entornos locales, respaldos y el archivo .env histórico. Registrar cierre con pruebas de rechazo de claves anteriores, sin imprimirlas. Mantener la revisión de exposición histórica aunque el archivo actual esté saneado.

Las acciones externas de este documento requieren autorización posterior. La retirada del puente y el saneamiento de ca7a7b3 y 3fcab4c ya se publicaron mediante push autorizado; esto no demuestra despliegue ni rotación efectiva.

## Inventario: evidencia local y pendientes externos

| Secreto | Consumidores comprobados en código | Vercel / workflows: pendiente |
| --- | --- | --- |
| N8N_INTERNAL_API_KEY | src/lib/n8n.server.ts: obtenerConfigN8n y obtenerWebhookPublicarManual leen la variable; postN8n envía X-N8N-API-KEY. src/routes/api/public/r2-download-url.ts: autorizado acepta ese encabezado; autoriza obtención de URL R2 firmada | Confirmar presencia y ámbitos reales en Vercel, autenticación de los webhooks de generación/publicación en n8n y todos los nodos que llaman a /api/public/r2-download-url. No se inspeccionó una definición activa ni apareció export disponible en este checkout |
| SUPABASE_SERVICE_ROLE_KEY | src/integrations/supabase/client.server.ts crea y conserva en memoria supabaseAdmin. Lo usan credenciales.functions.ts para listar/guardar/activar/borrar, credenciales.server.ts para obtener valores cifrados y r2-download-url.ts para perfil/contenido. Los helpers R2/pCloud/n8n dependen indirectamente de la lectura de credenciales | Inventariar variables de cada ámbito/despliegue, claves en integraciones n8n, CI, cron, Database Webhooks, pg_net, Edge Functions y otras aplicaciones. No hay funciones Edge locales en supabase/functions; su ausencia local no prueba ausencia remota |
| CREDENCIALES_ENC_KEY | src/lib/credenciales.server.ts: clave deriva SHA-256 del texto exacto; cifrar/descifrar usan AES-256-GCM. guardarCredencial cifra; obtenerCredencial descifra y alimenta configuraciones R2/pCloud/n8n | Confirmar qué despliegues/procesos pueden escribir credenciales, si usan la misma llave, volumen/DDL real de credenciales y recuperación disponible. No se inspeccionaron valores actuales ni ciphertexts activos |

El usuario confirmó que n8n usa Postgres vía pooler con rol postgres del proyecto correcto. Esa conexión no usa esta API key de Supabase y no debe rotarse como si fuera la JWT; queda pendiente comprobar si otros nodos n8n además usan HTTP/Supabase con service_role.

No confundir n8n / API_KEY del panel con N8N_INTERNAL_API_KEY: el código actual no lee aquella entrada para estos usos. WEBHOOK_PUBLICAR_MANUAL y el flujo activo no cambian de contrato en esta preparación.

## A. Supabase: sustitución y revocación de la JWT heredada

El material observado es una JWT con rol service_role, no la llave JWT de firma. No hay evidencia de exposición del JWT secret del proyecto. El cliente actual reconoce sb_secret_ y evita enviarla como Bearer, manteniéndola en apikey; esto respalda compatibilidad en código, no una validación real del nuevo acceso.

### Acciones manuales

1. En Settings → API Keys del proyecto correcto, crear una nueva secret API key dedicada al backend y guardarla directamente en el gestor seguro. No pegarla en chats, SQL, logs ni el repositorio. Comprobar por metadatos si los clientes frontend/middleware usan claves publicables; el ejemplo antiguo las tenía, pero eso no prueba los valores de Production.
2. Sustituir el valor de SUPABASE_SERVICE_ROLE_KEY en Vercel con la nueva secret key, conservando el nombre que consume el código. No usar un prefijo VITE_. Actualizar los demás consumidores identificados y desplegar/reiniciar solo bajo autorización. El cliente se almacena en memoria: cambiar el valor del panel no actualiza instancias ya arrancadas ni despliegues antiguos.
3. Comprobar con la nueva clave operaciones de lectura administrativas mínimas y las funciones que dependen de credenciales. No publicar ni borrar videos para probar. Cualquier prueba de escritura necesita alcance y datos autorizados. No desactivar la clave heredada hasta inventariar clientes, salvo contención de emergencia decidida por el propietario.
4. Desactivar explícitamente las API keys heredadas en Settings → API Keys. El propietario confirmó el aviso del panel: este control bloquea su uso en apikey, pero permanecen válidas como JWT. Es una contención parcial, no revocación completa. Afecta a anon/service_role heredadas; migrar primero a los consumidores de ambas. Crear una nueva clave tampoco invalida la JWT anterior.
5. Validar el bloqueo como apikey en una consulta mínima, registrando solo estado y resultado booleano. La invalidación como JWT requiere la revisión y autorización de firma del apartado siguiente, seguida de una comprobación separada con la JWT vieja como Bearer y una clave publicable válida. No imprimir datos, encabezados ni token. No declarar cerrado el incidente porque falle únicamente el primer camino.
6. Comprobar que la nueva clave funciona, que login/navegación y lectura de credenciales siguen operativos y que no quedan despliegues antiguos privilegiados. Dejar constancia de fecha y componentes, nunca del valor.

La secuencia de crear, sustituir y desactivar procede de [API keys: leaked or compromised key](https://supabase.com/docs/guides/getting-started/api-keys#rotate-a-leaked-or-compromised-key). La desactivación de claves heredadas es independiente de crear nuevas claves y está documentada para ambas claves en [Management API](https://supabase.com/docs/reference/api/v1-update-project-legacy-api-keys); se propone el panel, no ejecutar esa API aquí.

### JWT de firma, sesiones y revocación completa

**Corrección del 19 de octubre de 2026:** la advertencia del panel comunicada por el propietario confirma que desactivar las claves heredadas NO invalida la service_role JWT expuesta como JWT. No se ha comprobado que esa desactivación ya se haya ejecutado. La revisión de JWT Signing Keys es obligatoria para preparar la invalidación completa; no depende de descubrir además una filtración del secreto de firma.

Mecanismo propuesto, aún sin ejecutar: identificar la llave que valida la JWT heredada, dejar de emitir tokens con ella y retirar explícitamente la confianza en esa llave. No hay en este repositorio un mecanismo acreditado de revocación individual de la service_role JWT. Crear una secret API key, cambiar la variable, cerrar sesiones de usuario o pulsar Rotate no sustituyen la revocación de firma correspondiente.

### Captura previa de JWT Signing Keys, solo metadatos

El propietario debe revisar el proyecto grjxcsngfnxdkkdkkujh y aportar, sin claves ni tokens:

| Comprobación | Decisión que permite |
| --- | --- |
| Sistema Legacy o Signing Keys; algoritmos y estados Current/In use, Standby, Previously used, Revoked | Determinar si falta migrar el legado, preparar standby o solo retirar confianza previa |
| Correspondencia entre la firma heredada y su entrada en el panel | Evitar revocar una llave distinta; resolver con soporte si la identificación es ambigua |
| TTL real de access tokens, última emisión con la llave antigua y política de refresco | Acordar ventana de transición frente a revocación urgente; no esperar la expiración de la service_role de larga duración |
| API keys heredadas activadas/desactivadas y consumidores migrados | Confirmar el bloqueo apikey como control separado |
| Edge Functions, validadores propios, cachés JWT/JWKS y consumidores Storage/Realtime | Preparar compatibilidad y propagación del cambio sin eliminar autorización |

La lista no acredita el estado actual del proyecto: no se abrió su panel ni se inspeccionó su configuración.

### Secuencia a autorizar posteriormente

1. Completar la migración de consumidores a publishable/secret y preparar pruebas aisladas de autorización. El nuevo secreto debe funcionar en backend antes del corte de firma.
2. Si el proyecto aún usa Legacy, preparar la migración a Signing Keys. Si ya usa ese sistema, inspeccionar los estados existentes y no repetir rotaciones innecesarias. Preparar una llave asimétrica alternativa si hace falta.
3. Tras autorización específica, activar la nueva llave para emitir tokens; comprobar login y refresco con el nuevo emisor. Durante coexistencia la JWT expuesta sigue siendo válida. El plazo entre activación y revocación debe ser explícito y lo más breve que permita la respuesta al incidente.
4. Con las API keys heredadas desactivadas y tras otra confirmación operativa del alcance, revocar en JWT Signing Keys la llave heredada que valida el token expuesto. Si ya está en Previously used, no se necesita rotar otra vez para volver a ese estado. Comprobar la revocación efectiva, no solo que haya otra llave Current.
5. Validar rechazo de la JWT expuesta como Bearer junto con una apikey publicable válida, además del rechazo como apikey; usar consulta de lectura mínima sin devolver datos al informe. Un 401 por un apikey erróneo, un 403 por permisos o un fallo de red no demuestran rechazo criptográfico de la JWT: distinguir causas y disponer de un control positivo equivalente con autorización nueva válida. Revisar los servicios realmente utilizados y cachés de validadores externos.
6. Comprobar acceso y refresco legítimos, backend administrativo, consultas con RLS y consumidores externos. No enviar publicaciones ni borrar objetos para probar. Registrar evidencia de ambos rechazos y de aceptación de los reemplazos sin valores sensibles.

La documentación distingue activación de nueva firma y revocación de confianza anterior; véase [JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys). Ninguna de estas acciones se ejecuta en esta preparación.

Efectos a planificar: los access tokens firmados por la llave revocada dejan de validarse; probar refresco y prever nueva autenticación si falla. Esto no equivale por sí solo a eliminar usuarios ni todas las sesiones/refresh tokens. La coexistencia reduce interrupciones, pero mantiene la exposición. Evaluar URLs firmadas de Supabase Storage y validadores externos con caché; R2 usa firma independiente.

Consumidores locales que deben probarse: auth-middleware.ts verifica tokens de usuario mediante getClaims; auth-attacher.ts adjunta el access_token de sesión; client.ts mantiene y refresca la sesión; r2-download-url.ts usa getUser para Bearer de usuario. client.server.ts usa una API key, no decodifica esa JWT, pero todos sus procesos deben haber recibido la nueva configuración. La conexión Postgres/pooler confirmada de n8n no se autentica mediante estas JWT; revisar aparte nodos HTTP/Supabase, funciones Edge y otros validadores que no están disponibles localmente.

No desactivar verify_jwt ni otras comprobaciones sin un reemplazo de autorización revisado. Preparar compatibilidad, cachés, avisos de reautenticación y recuperación antes del corte; TTL y topología activos siguen pendientes.

La recomendación actual evita prometer una regeneración independiente de service_role heredada: [guía de legacy secrets](https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd). La coexistencia y Revoke se describen en [JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys). Si el panel difiere, detenerse y consultar soporte del proyecto antes de operar.

Recuperación: corregir hacia delante con una nueva clave válida y configuración compatible. Rehabilitar claves heredadas restablecería acceso al material comprometido; no hacerlo automáticamente para resolver un error. No restaurar una credencial expuesta como solución permanente.

## B. N8N_INTERNAL_API_KEY: ambos sentidos

La preparación concreta y la matriz de pruebas sin efectos están en [el plan de corte n8n](rotacion-n8n-internal-api-key.md). El código solo consulta la variable de entorno para esta clave; cambiar n8n / API_KEY en el panel no rota su uso actual.

Sentido aplicación → n8n: generación de mes y publicación manual envían la clave en X-N8N-API-KEY. Sentido n8n → aplicación: el endpoint /api/public/r2-download-url la compara contra la variable para autorizar la descarga firmada. El nombre del encabezado no acredita que los webhooks n8n realmente la comprueben: revisar su configuración.

El código actual admite una sola clave. Sin cambios funcionales no hay solapamiento de claves ni garantía de corte sin interrupciones. Procedimiento mínimo propuesto:

1. Inventariar en n8n validadores de los dos webhooks y emisores de la cabecera de descarga; incluir workflows programados y ejecuciones en espera. Guardar configuración previa en el gestor seguro y preparar una clave aleatoria independiente sin mostrarla.
2. Abrir ventana de mantenimiento: bloquear temporalmente nuevas solicitudes de generación/publicación y detener disparadores que usen esa clave. Dejar terminar o registrar ejecuciones en curso; pausar no equivale a cancelar trabajos ni permite repetir los ya aceptados.
3. Actualizar las credenciales que validan entrada y las que envían salida en n8n. Actualizar N8N_INTERNAL_API_KEY en Vercel y promover un despliegue con ese entorno. Mientras no estén coordinados, mantener suspendidos los emisores; no resolver 401 aceptando cualquier clave ni omitiendo autenticación.
4. Comprobar nueva clave aceptada y anterior rechazada en ambos sentidos. Para descarga usar POST sin fecha, sin Authorization y sin cuerpo sensible: nueva debe pasar autenticación y devolver 400 por falta de fecha antes de consultar Supabase/R2; anterior y ausente deben devolver 401. Para n8n preparar un endpoint/ensayo de autenticación sin acciones de publicación; el webhook activo podría ejecutar efectos y no debe usarse como simple ping. Si hace falta adaptar una prueba sin efectos, prepararla y autorizarla por separado. El plan enlazado incorpora Header Auth account 2, también usada por generación mensual inactiva, y separa filtrado de propagación de persistencia del historial.
5. Reanudar disparadores, observar ejecuciones naturales y reconciliar fallos por autenticación antes de reintentar. Retirar referencias antiguas de credenciales, ejecuciones reutilizables y despliegues anteriores. Guardar solo estados y metadatos de validación.

Si se exige continuidad sin ventana, hace falta un cambio posterior de compatibilidad temporal en ambos verificadores, con fecha límite y retirada explícita; no está implementado ni es seguro inferirlo del código actual. Recuperación preferente: mantener pausado y completar el corte; no volver a la clave publicada.

## C. CREDENCIALES_ENC_KEY: respaldo y recifrado

Actualización del 22 de octubre de 2026: [recifrado cerrado](ejecucion-final-recifrado.md). La herramienta completó simulate y apply con 8 filas reales; verificó esquema, datos, mismas llaves, respaldo y recibo cifrados, COMMIT confirmado y conexión cerrada. El propietario confirma actualización de CREDENCIALES_ENC_KEY en Production, despliegue Ready y prueba R2 correcta. Recover no ejecutado. Mantener respaldos, recibo y llaves de recuperación protegidos fuera de Git; no interpretar el cierre como autorización para eliminarlos o repetir operaciones. La propuesta y las pruebas históricas siguientes conservan su valor como procedimiento de referencia.

Formato local comprobado: base64 de IV de 12 bytes + tag GCM de 16 bytes + ciphertext; llave AES derivada con SHA-256 del texto exacto. No hay identificador de versión de llave en este formato. Se propone una ventana sin escrituras/consumidores durante el corte, no introducir un formato nuevo sin implementación y pruebas.

### Preparación protegida

1. Revisar DDL real y todos los escritores de credenciales; no aplicar migraciones históricas. Con autorización operativa, bloquear guardados/activaciones/borrados y detener consumidores durante el cambio, incluyendo instancias viejas que puedan seguir escribiendo con la llave anterior. Registrar y drenar trabajos; no mezclar dos generaciones de ciphertext.
2. Generar respaldo consistente de las filas y metadatos originales de public.credenciales, incluidos ciphertexts, y cifrarlo adicionalmente con una llave independiente del incidente antes de almacenarlo. No crear archivos temporales en claro. Incluir credenciales inactivas, que podrían reactivarse. No respaldar valores descifrados ni pistas en un informe. Guardar número de filas y comprobación de integridad del respaldo en un registro privado, con acceso mínimo, caducidad y responsable.
3. Conservar la llave vieja únicamente en custodia protegida separada del respaldo durante la recuperación. Generar una llave nueva en el gestor seguro. No confundirla con N8N_INTERNAL_API_KEY ni reutilizar ninguna de ellas. Ensayar con datos sintéticos el proceso y una restauración aislada del respaldo cifrado.

### Mecanismo a implementar y revisar antes de ejecutar

Un ejecutor administrativo de una sola ejecución, fuera del navegador, recibe ambas llaves y conexión mediante inyección segura, sin argumentos de línea de comandos ni trazas de SQL con parámetros. Conexión TLS y cuenta con permisos mínimos para leer/actualizar las filas necesarias; no reutilizar la service_role comprometida.

Secuencia transaccional propuesta, no SQL ejecutado:

1. BEGIN, lock_timeout y statement_timeout; bloquear escrituras de la tabla y leer todas las filas del snapshot. Verificar cardinalidad y estructura; abortar si alguna no se descifra con la llave anterior. No omitir filas corruptas o inactivas.
2. Por fila: descifrar en memoria, cifrar con la nueva llave e IV aleatorio nuevo; volver a descifrar el resultado con la nueva llave y comparar bytes. Emitir solo contadores, nunca contenido, ciphertexts, pistas, llaves ni errores completos del driver.
3. Actualizar únicamente valor_cifrado, condicionado a la identidad y al valor original; exigir una fila por actualización. Mantener servicio, nombre, activo y permisos. Capturar/restaurar metadatos que pueda cambiar un trigger para recuperación; no deshabilitar triggers sin una decisión separada. Validar todas las filas persistidas dentro de la transacción con la nueva llave y comprobar que no se perdió ni añadió ninguna.
4. Ante error: ROLLBACK; no cambiar la variable activa. Solo COMMIT si todas las comprobaciones pasan y el despliegue configurado con la nueva llave está listo para promoverse. No mantener la transacción abierta esperando operaciones manuales lentas.
5. Mantener la ventana de mantenimiento entre COMMIT y promoción del despliegue con CREDENCIALES_ENC_KEY nueva. Después comprobar lectura/descifrado de todas las filas con resultados booleanos y una prueba aislada de escritura/lectura autorizada antes de reabrir el panel. Confirmar que no quedan instancias viejas consumidoras/escritoras.

No existe atomicidad entre PostgreSQL y el cambio de entorno Vercel: la ventana y la recuperación compensan esa separación. Se ensayaron corrupción, rollback, pérdida de acuse COMMIT, recuperación y concurrencia/timeout con dos sesiones nativas locales. Falta validar esquema/permisos activos, transporte y promoción Vercel. Revisar límites de volumen/tiempo antes de operar; no improvisar lotes incompatibles con una sola llave.

### Recuperación y retiro

Antes de COMMIT: ROLLBACK y conservar el entorno anterior durante el mantenimiento. Después de COMMIT, antes de reabrir escrituras: preferir corregir/promover la nueva configuración; si no es posible, restaurar exactamente el snapshot cifrado anterior y su llave bajo autorización y bloqueo. Si ya hubo nuevas escrituras, no restaurar masivamente el snapshot: reconciliar el delta o recifrar esas filas con un procedimiento revisado, para no perder cambios.

Tras aceptar la validación, retirar la llave vieja de entornos activos y despliegues antiguos. Mantenerla, si el plazo de recuperación lo requiere, solo en custodia separada y restringida; al vencer el plazo y validar un respaldo nuevo restaurable, destruir esa copia y expirar respaldos anteriores según retención acordada. La copia publicada en Git no puede considerarse destruida. Para que deje de permitir acceso a proveedores, rotar también los secretos subyacentes potencialmente expuestos; su alcance depende del inventario real de credenciales, aún pendiente.

## Revisión del historial sin valores

Barrido local de líneas añadidas de los 104 commits alcanzables por las referencias locales, mediante patrones de asignaciones sensibles, JWT, tokens de proveedores y claves privadas. Sin fetch, sin impresión de matches, sin hashes de secretos ni comprobación contra servicios. Se excluyeron contenidos .env y variantes salvo .env.example, archivos de lock y formatos no adecuados para este barrido. No cubre objetos inaccesibles/reflogs, GitHub logs/artifacts, variables externas ni secretos que no coincidan con los patrones. Es revisión indicativa, no certificación de ausencia.

| Nombre / estado | Archivo | Commits identificados |
| --- | --- | --- |
| SUPABASE_SERVICE_ROLE_KEY | .env.example | Incorporado en 39611f77416ca7bed844c5ed7b7b62a50680f6e1; presencia además confirmada en 3f5d816 y ca7a7b3; sustituido en 3fcab4c |
| CREDENCIALES_ENC_KEY | .env.example | Incorporado en 39611f77416ca7bed844c5ed7b7b62a50680f6e1; presencia además confirmada en 3f5d816 y ca7a7b3; sustituido en 3fcab4c |
| N8N_INTERNAL_API_KEY | .env.example | Incorporado en 39611f77416ca7bed844c5ed7b7b62a50680f6e1; presencia además confirmada en 3f5d816 y ca7a7b3; sustituido en 3fcab4c |
| Variables no inspeccionadas; revisión privada pendiente | .env | Archivo incorporado en 4e4cb573c489113e19ee00ed87e2fd3cf83d71bd; ausente del árbol actual de origin/main local. No se inspeccionaron sus valores ni se descarta exposición adicional |

El candidato storage_key en src/routes/_authenticated/publicaciones.tsx, commit 2cb0337b27d6c3b0b8b047a447a9bbf004dd7e79, se descartó: es una referencia a registro.storage_key, no una clave literal. No se confirmaron otros secretos en el material cubierto. Las claves publicables/anon no se clasificaron como secretos. No se reescribe el historial; su limpieza eventual tampoco sustituiría revocación.

## Cierre y evidencia requerida

El operador registrará solo fecha, despliegue, ámbito, componentes actualizados, rechazo de material antiguo, aceptación del nuevo, integridad de recifrado, recuperación ensayada y pendientes. Nada de valores, cuerpos o credenciales descifradas. Antes de declarar cerrado: comprobar por separado bloqueo de la clave heredada en apikey e invalidación de su JWT en Authorization con apikey válida, retirada de confianza en la firma correspondiente, clave n8n vieja rechazada en ambos sentidos y ciphertexts actuales utilizables solo con la nueva llave activa. La desactivación de API keys por sí sola nunca satisface este cierre.

Esta preparación solo valida documentación y git diff --check. No ejecuta las pruebas operativas descritas, no crea commit ni hace push/despliegue.
