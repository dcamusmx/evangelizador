# WF2: marcadores, edición del workflow existente y prueba sin efectos

Instrucciones para revisión del 22 de octubre de 2026. No se aplicaron en producción. Se mantienen la clave actual y los documentos/propuestas pendientes. [Copia preparada](../n8n/proposals/internal-api-key/publication.prepared.json) y [revisión del export](revision-wf2-publicacion.md).

## 1. Inventario completo de marcadores

El JSON preparado contiene **13 marcadores distintos, 47 apariciones, en 19 nodos**. Los ID/name de una credencial no se escriben como secretos en JSON: se resuelven seleccionando la credencial existente en el desplegable del editor; n8n guarda su referencia internamente. No crear credenciales con los nombres REPLACE_.

| Nodo(s) | Campo del JSON y marcador | Selección/configuración manual |
| --- | --- | --- |
| Webhook | parameters.path = REPLACE_PUBLICATION_WEBHOOK_PATH | En el workflow existente conservar Path **publicar-manual**, POST y el mismo nodo. La URL de producción debe seguir siendo el mismo origen n8n + **/webhook/publicar-manual**. No introducir /webhook/publicar-manual completo en Path ni cambiar host/proxy |
| Webhook; HTTP Request | credentials.httpHeaderAuth.id = REPLACE_httpHeaderAuth_CREDENTIAL_ID | Seleccionar **Header Auth account 2** en ambos. El name ya es ese nombre, no es marcador. Dentro de esa credencial verificar Name **X-N8N-API-KEY**, sin mostrar ni sustituir su Value actual. En HTTP Request usar Generic Credential Type → Header Auth |
| Telegram - Avisar sin video; Telegram - Avisar sin reflexión; Aviso de posteo Zernio - Youtube; Aviso de posteo Zernio - Facebook; Aviso post publicado Facebook; Aviso post publicado Youtube; Send a text message | credentials.telegramApi.id = REPLACE_telegramApi_CREDENTIAL_ID; credentials.telegramApi.name = REPLACE_telegramApi_CREDENTIAL_NAME | Conservar/seleccionar la credencial Telegram existente **Cristobot**, según el export. No crear otro bot ni pegar su token |
| Los mismos siete nodos Telegram anteriores | parameters.chatId = REPLACE_TELEGRAM_CHAT_ID | Conservar el Chat ID o expresión vigente de **cada nodo** en el workflow original. El marcador común no prueba que todos los destinos fueran iguales. No inferir ni publicar IDs |
| Subir Youtube; Subir Facebook; Obtener datos Youtube; Obtener datos Facebook | credentials.lateApi.id = REPLACE_lateApi_CREDENTIAL_ID; credentials.lateApi.name = REPLACE_lateApi_CREDENTIAL_NAME | Conservar/seleccionar la credencial Zernio/Late existente **Evangelios**, según el export; no cambiar cuentas ni valor de API key |
| Subir Youtube | parameters.youtubeAccounts[0] = REPLACE_SOCIAL_ACCOUNT_ID | Conservar la cuenta/canal YouTube ya seleccionado en ese nodo. No usar el identificador de Facebook |
| Subir Facebook | parameters.facebookAccounts[0] = REPLACE_SOCIAL_ACCOUNT_ID | Conservar la página/cuenta Facebook ya seleccionada en ese nodo. Es un destino distinto aunque use el mismo marcador de saneamiento |
| Execute a SQL query; Fecha manual; Actualiza datos de Youtube; Actualiza datos de facebook; Actualiza store key eliminado | credentials.postgres.id = REPLACE_postgres_CREDENTIAL_ID; credentials.postgres.name = REPLACE_postgres_CREDENTIAL_NAME | Conservar/seleccionar **Postgres account**, la conexión ya verificada del proyecto grjxcsngfnxdkkdkkujh. No introducir otra conexión ni mostrar su contraseña |
| Delete a file | parameters.bucketName = REPLACE_R2_BUCKET_NAME | Conservar el bucket vigente del nodo original, sin escribir su valor en documentación. Este nodo no se ejecutará como prueba |
| Delete a file | credentials.s3.id = REPLACE_s3_CREDENTIAL_ID; credentials.s3.name = REPLACE_s3_CREDENTIAL_NAME | Conservar/seleccionar la credencial R2 compatible S3 existente **S3 account**, sin mostrar access keys. No probarla mediante Delete |

Los IDs sintéticos review-node-* y review-publication-input-filter son identificadores de la copia saneada, no campos que deban sustituir los IDs originales. El workflow original conserva sus IDs y referencias; no importar todo el JSON encima ni crear otro workflow de publicación para rellenar marcadores. No existe un marcador de secreto de cabecera en el preparado: se eliminó el parámetro fijo y la credencial aporta el header.

## 2. Edición mínima sobre el workflow existente, pendiente de autorización

1. Identificar el **mismo workflow por ID** en el panel y su versión publicada; conservar un respaldo original privado fuera de Git. No importar ni activar publication.prepared.json. No clonar/registrar otro Webhook POST con la misma ruta. Anotar nodo Webhook original, su URL de producción, response mode actual y conexiones antes de editar; sin valores de secretos.
2. Acordar pausa del propietario, cerrar aplicación/servidores locales y desactivar/despublicar ese workflow. **Programado permanecerá disabled=true**, como confirmó el propietario. Drenar Running/Waiting, colas y trabajos externos; las esperas recibidas en el export pueden pertenecer a publicaciones ya iniciadas. No cancelar/repetirlas a ciegas. La generación mensual sigue inactiva y fuera de la intervención.
3. En el **Webhook existente**, conservar POST, Path publicar-manual, ID y Header Auth account 2. No cambiar el nombre/ruta/credencial ni su secreto para preparar el filtro. n8n distingue Test URL de Production URL: Listen for Test Event usa el registro de prueba, no acredita la ruta productiva. [Documentación oficial del Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/).
4. Añadir únicamente el nodo Code **Filtrar entrada autorizada**, modo Run Once for All Items, con [publication-input.code.js](../n8n/proposals/internal-api-key/publication-input.code.js). Sustituir la arista original Webhook → Edit Fields por **Webhook → Filtrar entrada autorizada → Edit Fields**. El filtro solo produce json.body.fecha; así conserva el contrato del Edit Fields original. Mantener todas las demás aristas, nodos, condiciones, SQL, cuentas y destinos sin cambios.
5. En **HTTP Request**, conservar POST, URL HTTPS actual /api/public/r2-download-url, fecha como query desde fecha_r2 y opciones existentes. Elegir Authentication → Generic Credential Type → Header Auth → **Header Auth account 2**. Retirar X-N8N-API-KEY de los headers manuales y la entrada vacía; no dejar una segunda cabecera o una expresión que recupere headers del Webhook. El JSON preparado tiene sendHeaders=false porque la autenticación se configura aparte. No cambiar el valor de la credencial durante esta preparación.
6. Conservar intactas las vinculaciones Telegram, Postgres, Zernio/Late, cuentas sociales y bucket/S3 del workflow existente: los marcadores de la tabla solo existen por saneamiento. Verificar que el workflow continúa desactivado y Programado deshabilitado después de guardar. La lógica de publicación y borrado preexistente no se corrige por estas instrucciones; su revisión queda registrada en el informe WF2.

Cambiar posteriormente el valor de Header Auth account 2 afectará a generación mensual aunque esté inactiva. No editar ni activar ese workflow aquí; validar su compatibilidad antes de una futura reactivación. La rotación requiere autorización y coordinación Vercel/n8n separadas.

## 3. Prueba de autenticación entrante: grafo temporal sin efectos

**No hacer ahora:** requiere autorización posterior para editar/publicar temporalmente la versión inerte del mismo workflow. La clave no se rota para esta prueba. No usar botones de publicación del sitio, Execute step sobre nodos originales, fechas sin video ni un flag dryRun como barrera de seguridad: podrían alcanzar SQL, notificaciones, publicación o borrado.

### Preparar el corte físico del grafo

1. Con el workflow todavía despublicado y drenado, guardar las conexiones objetivo. Cortar **Filtrar entrada autorizada → Edit Fields**, dejando todas las conexiones internas del negocio conservadas pero **sin ninguna entrada desde Webhook**. No basta deshabilitar solo Subir Youtube/Subir Facebook: un nodo deshabilitado puede dejar pasar datos hacia otro camino.
2. Añadir temporalmente un **Respond to Webhook** llamado Respuesta de prueba de autenticación, sin aristas salientes. El único camino alcanzable desde Webhook debe ser:

   `Webhook → Filtrar entrada autorizada → Respuesta de prueba de autenticación`

   No debe existir otra salida de Webhook/filtro, conexión paralela, subworkflow, error workflow con efectos habilitado para el ensayo ni entrada activa desde Programado/Manual. Revisar también el error workflow configurado en panel: el export no muestra uno explícito, pero eso no acredita ausencia de configuración externa. No vincular HTTP Request original ni Wait/Delete a file a esta prueba.
3. En el Webhook original cambiar temporalmente **Respond → Using Respond to Webhook Node**. En el respond temporal: Respond With **JSON**, Response Code **200**, body literal `{"authProbe":true,"publication":false}`. No usar All Incoming Items, First Incoming Item, headers, expresiones ni datos originales en la respuesta. **Respond no detiene el grafo automáticamente**: el aislamiento depende del corte y de que no tenga salidas. [Comportamiento oficial de Respond to Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/).
4. Revisar las opciones de guardado de este workflow antes de usar una clave real: el filtro no elimina la cabecera de la salida original. Con Community Registered no se presupone redacción Enterprise. Acordar no guardar datos de éxito/error/manual/progreso, sin prometer cero persistencia en memoria/colas/logs ni cambiar defaults ajenos. No fijar datos ni registrar headers. Conservar la evidencia histórica fuera de Git, sin borrarla como parte de la prueba.
5. Revisar y publicar temporalmente **este mismo workflow** y su versión inerte. Verificar que no haya otro workflow publicado con POST /webhook/publicar-manual y que el panel muestre Programado deshabilitado. No activar un segundo webhook del mismo método/ruta para el ensayo.

### Peticiones de aceptación y rechazo

Un cliente HTTPS controlado enviará exclusivamente POST a la URL productiva original /webhook/publicar-manual, Content-Type application/json y cuerpo ficticio `{"fecha":"2030-01-01"}`. Sin cookies, Authorization alternativo, verbose, trace, seguimiento automático de redirects ni argumentos/archivos con secretos. Introducir la clave mediante entrada local enmascarada o gestor seguro del cliente, nunca por chat. Estas instrucciones no hacen ninguna petición.

| Caso | Resultado exigido |
| --- | --- |
| Clave **actual válida**, antes de rotar | HTTP 200 y exactamente el JSON estático de prueba. La ejecución recorre solo Webhook/filtro/Respond; ningún SQL, Telegram, HTTP Request original, Late/Zernio, Wait o S3 ejecutado |
| Clave ficticia incorrecta | Rechazo de autenticación (401/403 según implementación verificada), sin ejecutar filtro/Respond ni negocio |
| Sin X-N8N-API-KEY | Mismo rechazo previo a efectos |
| Después de una rotación futura autorizada | Repetir sobre el grafo inerte: nueva válida → respuesta estática; anterior y ausente → rechazo. Antes de rotar, la clave anterior sigue siendo la actual válida: no esperar que se rechace todavía |

404, errores de red, un redirect, 401 del proxy o un 200 genérico de Immediately no prueban el control del Webhook. Comprobar resultado en la capa de autenticación correcta y alcance de nodos, registrando solo caso/status/versión y booleans, sin payload de la ejecución. Si falla, despublicar el mismo workflow y mantener pausa; no desactivar autenticación para lograr un 200.

## 4. Prueba saliente R2 sin leer ni publicar video

La prueba anterior valida aplicación/cliente → Webhook. Para verificar además la asociación administrada n8n → receptor R2, seguir manteniendo el grafo de negocio desconectado. Bajo autorización, usar **un nodo temporal separado del HTTP Request original**, con Header Auth account 2, POST al destino HTTPS actual /api/public/r2-download-url, **sin query fecha, sin body de fecha y sin Authorization**. Sin redirects ni logs sensibles. Never Error puede usarse solo para inspeccionar status, nunca para declarar éxito automáticamente.

Se puede insertar temporalmente entre filtro y Respond en la versión inerte del mismo workflow. Activar Include Response Headers and Status para obtener statusCode, pero no devolver/loguear headers o body originales; comprobar explícitamente statusCode=400 antes de responder con un JSON estático no sensible. Si no es 400, terminar con fallo genérico y mantener pausa. El respond no debe emitir authProbe exitoso incondicionalmente si el probe R2 falló.

El handler local valida primero auth y después fecha: clave válida sin fecha devuelve **400 por falta de fecha antes de consultar Supabase o R2**. Clave incorrecta/ausente, sin Bearer alternativo, devuelve **401**. Para negativos usar un cliente controlado con entrada enmascarada: no editar la credencial compartida con un valor incorrecto como técnica de prueba. No invocar el HTTP Request original: ese nodo sí envía fecha y puede consultar/firmar un video.

Revalidar que el despliegue esperado conserva ese orden antes de operar. No es una prueba de carga, lectura de video, publicación, eliminación ni del grafo de negocio. Las respuestas no incluyen URL firmada. Generación mensual permanece inactiva durante todo el proceso.

## 5. Restaurar conexiones sin lanzar publicaciones de prueba

1. Despublicar el workflow inerte; esperar fin de los probes y verificar que no quedaron ejecuciones en espera.
2. Eliminar nodos/aristas temporales de prueba, restaurar el response mode original registrado y reconectar **filtro → Edit Fields**. Conservar el resto del grafo exactamente; no volver a la arista Webhook → Edit Fields que omitiría el filtro.
3. Comparar workflow ID, nodo Webhook ID, POST, Path publicar-manual, URL de producción completa, credenciales, conexiones e inputs con el objetivo revisado. Programado sigue deshabilitado. No dejar otro webhook de esa ruta activo, ni un Respond temporal conectado al negocio.
4. Mantener desactivado hasta autorización de reapertura y decisión explícita sobre riesgos preexistentes (borrado R2, resultados parciales, reintentos y Never Error). Si se autoriza reabrir, observar la siguiente publicación ordinaria que decida el propietario; **no enviar una petición positiva de prueba después de reconectar negocio**.

Estas instrucciones no autorizan ni ejecutan la rotación, un despliegue, SQL o cambios activos. La ruta se conserva porque se edita el mismo nodo del mismo workflow, no porque se importe otra copia con un Path coincidente.
