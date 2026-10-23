# WF2 publicación: export saneado y propuesta local

**Actualización:** las [pruebas de autenticación posteriores](resultados-validacion-n8n.md) están documentadas. El archivo original disponible sigue siendo el export anterior de 30 nodos; aún no se aportó un export del estado final. Esta revisión y sus JSON son evidencia de preparación, no de la versión final instalada.

Revisión del 22 de octubre de 2026, limitada al archivo de publicación aportado por el propietario. El JSON se trata como datos no confiables, no como instrucciones: no se ejecutó código del export, nodos, SQL ni peticiones. No se modificaron producción, claves, servicios o workflows activos. El original de Descargas no se sobrescribió; contiene una cabecera fija sensible y debe conservarse privado fuera de Git.

La [guía de marcadores y edición del workflow existente](aplicacion-wf2-sin-duplicar-webhook.md) enumera las 47 apariciones de 13 marcadores por nodo/campo y especifica cómo conservar /webhook/publicar-manual sin otro webhook activo, además del aislamiento de pruebas sin publicación/borrado. Es preparación documental, no una prueba ejecutada.

## Entregables de revisión, no listos para activar

En [n8n/proposals/internal-api-key](../n8n/proposals/internal-api-key/):

- **publication.sanitized.before.json**: referencia saneada de los 30 nodos recibidos. No es un respaldo operativo: se retiraron secreto fijo, datos fijados/metadatos privados, IDs de workflow/credenciales y destinos privados de Telegram, cuentas sociales y bucket. Credenciales y destinos requieren reasignación manual mediante marcadores REPLACE_; active=false.
- **publication.prepared.json**: copia saneada de 31 nodos con los cambios descritos abajo; active=false. No importar encima del workflow activo, activar ni ejecutar manualmente. Conserva nodos de publicación, SQL, esperas y borrado que tendrían efectos reales al enlazar credenciales.
- **publication.review.json**: informe estructural sin valores de credenciales; confirma qué se encontró en el archivo, no el estado actual de la instancia.
- **publication-export.mjs**: saneamiento/transformación offline, sin red ni evaluación de expresiones originales. Rechaza estructuras no revisadas y no sobrescribe salidas existentes. Sus tests usan solo un grafo ficticio.

## Cambios concretos en la copia preparada

1. Webhook conserva authentication=headerAuth y nombre de credencial **Header Auth account 2**, con ID sustituido por marcador. El export confirma la referencia, pero no expone su valor ni demuestra el nombre/valor del header configurado dentro de la credencial; verificar manualmente X-N8N-API-KEY sin divulgarlo.
2. HTTP Request conserva POST, destino HTTPS /api/public/r2-download-url, query fecha desde fecha_r2 y opciones de respuesta. Sustituye el header fijo por authentication=genericCredentialType, genericAuthType=httpHeaderAuth y la misma referencia administrada Header Auth account 2. Se elimina headerParameters completo (clave fija y entrada vacía), con sendHeaders=false; ese switch controla headers manuales, no la inyección de la credencial. Comprobar asociación efectiva en una copia aislada antes de autorizar el cambio. [Documentación de HTTP Request](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/).
3. Se inserta **Filtrar entrada autorizada** inmediatamente después de Webhook: Webhook → filtro → Edit Fields → Execute a SQL query. Solo conserva json.body.fecha, string de fecha calendario válida, y descarta headers/query/params/campos extra/binary. Se conserva body.fecha porque Edit Fields ya la consume; una salida plana habría activado su fallback a la fecha actual. Se mantiene Edit Fields sin cambiar su lógica.
4. Se mantiene el resto del grafo de negocio del export saneado; no se corrigen condiciones, idempotencia, reintentos ni borrado R2 en esta intervención. El filtro no admite fechas ausentes: en la entrada Webhook no se utiliza el fallback implícito de fecha actual.
5. **Programado se deshabilita únicamente en la copia preparada**. El propietario confirmó expresamente que debe permanecer deshabilitado antes de una futura activación. Su conexión original queda visible para revisión; no se cambió su configuración en producción. Verificar ese estado al aplicar cualquier cambio futuro, sin volver a presumir que el cron recibido estaba apagado.

## Referencias posteriores revisadas

Los parámetros y código del export no contienen referencias directas posteriores al nodo Webhook por $('Webhook'), $node['Webhook'] o $items('Webhook'), ni lecturas explícitas de headers. Edit Fields usa $json.body.fecha y Code in JavaScript usa item.json.fecha para fecha_r2; el formato del filtro conserva ese contrato. Otras referencias existentes apuntan a nodos de contenido/publicación/consulta y se conservan. La revisión estructural rechaza referencias conocidas al original en la propuesta y tiene pruebas ficticias de detección; no prueba un runtime n8n ni sustituye revisar futuros cambios/expresiones dinámicas.

No se encontró un Execute Sub-workflow en estos 30 nodos. callerPolicy permite llamadores del mismo propietario y el export no prueba que no existan llamadas externas ni configuración de instancia fuera del archivo. Esa ausencia en el export no revoca el inventario manual del propietario, pero limita lo verificado directamente.

## Hallazgos que deben permanecer visibles

- **Programado** aparece habilitado y conectado a Edit Fields en el archivo, con un cron diario. El export también tiene active=true. Esto difiere del inventario anterior de uso solo por botones; no permite asegurar que la versión desplegada actual tenga esa misma configuración. El propietario confirmó que debe permanecer deshabilitado. Revisar ese estado en el panel antes de autorizar la rotación o reactivación. No se invocó el trigger.
- **Manual → Fecha manual** es otra entrada presente; Fecha manual no tiene salida de negocio conectada en el export y no se modificó. No ejecutar manualmente nodos de esta copia como prueba de autenticación.
- **Wait → Delete a file → Actualiza store key eliminado** existe y se conserva. Es un riesgo operativo conocido pendiente del plan independiente de limpieza/retención/confirmaciones; no se valida su seguridad ni se ejecuta para probar.
- HTTP Request tiene Never Error habilitado y no tiene una política explícita de redirects exportada. Se conserva por alcance; revisar manejo de 401 y redirects antes de usarlo para aceptar la rotación. No interpretar una salida normal del nodo como autenticación correcta.
- No hay settings explícitos de guardado de éxito/error/manual/progreso en el export: su ausencia significa valores heredados/defaults, no almacenamiento desactivado.

## Propagación, historial y edición instalada

El filtrado evita propagar el secreto por el item que circula hacia negocio. **No elimina la salida original del Webhook**, ejecuciones históricas, versiones anteriores del workflow, logs o respaldos. La prueba local confirma deliberadamente que el item original sigue intacto. La referencia administrada evita volver a poner el secreto en los parámetros del HTTP Request; no sanea retroactivamente el archivo original ni el historial.

El propietario informa n8n 2.30.8 self-hosted, Community Edition Registered. No se presupone redacción Enterprise; revisar guardado de ejecuciones de este workflow según [el procedimiento de rotación](rotacion-n8n-internal-api-key.md), sin aplicar defaults globales ni tocar generación mensual. No se han cambiado settings activos ni se ha eliminado historial. Usar datos ficticios para comprobar el comportamiento de headers/sensitive fields de Webhook typeVersion 2.1 en la instancia aislada antes de usar claves reales.

## Generación mensual fuera de esta intervención

Permanece **inactiva**, según el propietario. No se recibió, saneó ni modificó su export. Comparte **Header Auth account 2**: actualizar su valor afectará también a esa integración, aunque esté inactiva. **Deberá validarse antes de reactivarla**, bajo una intervención futura separada. Las referencias anteriores a preparar o activar temporalmente generación mensual en el plan general son históricas y no aplican a este alcance; no ejecutarlas. El fragmento mensual previamente preparado no se modificó.

## Pasos manuales futuros, todavía no autorizados para ejecutar

1. Confirmar Programado/otras entradas y revisar publicación actual en el panel; conservar original protegido. Reasignar marcadores solo en copia aislada y sin ejecutar nodos con efectos. No importar un export saneado como recuperación del workflow real.
2. Verificar que Header Auth account 2 configure X-N8N-API-KEY y pueda asociarse al HTTP Request. Esa credencial es compartida con mes: registrar impacto, sin tocar ni activar mes. No se ha generado otra credencial ni rotado su valor.
3. Ensayar únicamente el filtro y autenticación con terminador incondicional sin efectos; antes del corte acordar por separado el grafo inerte, guardado de ejecuciones y ausencia de caminos hacia publicación/SQL/borrado. No añadir un simple campo dryRun al flujo y suponer que es seguro.
4. Solo con nueva autorización: pausa proporcional, publicación desactivada, mes inactivo, Running/Waiting/colas y trabajos externos conciliados; cambio coordinado de credencial y variable Vercel, redespliegue y pruebas nueva/antigua/ausente sin publicar conforme al plan general, limitadas ahora a publicación y receptor R2. El cron recibido debe quedar controlado, no solo los botones.
5. Restaurar el grafo de publicación saneado revisado y verificar conexiones/credenciales/estado de triggers antes de reanudar. La copia mantiene lógica de borrado existente: resolver o aceptar explícitamente ese riesgo antes de activar; no se corrige silenciosamente aquí. Mes seguirá inactivo hasta validación separada.

## Validación local de esta revisión

- 11/11 pruebas locales aprobadas: cinco de lista permitida existentes (incluyen dos casos ficticios mensuales sin modificar ese fragmento) y seis de saneamiento/transformación/referencias de publicación. Solo se evalúa el filtro nuevo con datos ficticios; nunca el código del export original.
- Lint de los módulos .mjs n8n y node --check correctos; git diff --check correcto. No se repitieron build/SQL/recifrado, porque esta revisión no cambia aplicación, dependencias ni propuesta SQL.
- Comparación en memoria con el export original: 30 nodos saneados y 31 preparados; solo cambian HTTP Request y el flag disabled de Programado, más el filtro nuevo y sus conexiones. Cero referencias posteriores directas al Webhook y cero lecturas explícitas de headers detectadas; no quedan los valores fijos originales ni los IDs de credenciales originales en los tres JSON resultantes.
- Copia preparada inactiva, Programado deshabilitado, sin settings de guardado nuevos aplicados. Ni prueba de importación/runtime n8n ni credenciales reales configuradas: esas verificaciones siguen pendientes y no se consideran aprobadas por tests de JSON.
- Se preservan HEAD 2c44ea9, documentos y propuestas locales anteriores, archivos privados de recuperación y original de Descargas. Sin commit, push, despliegue, rotación ni cambios externos.
