# Validación de autenticación n8n y receptor R2

## Confirmación manual posterior: workflow restaurado

El 22 de octubre de 2026 el propietario confirma: **workflow restaurado y publicación manual funcionando tras la rotación**. Se registra como evidencia manual de funcionamiento real, adicional a las pruebas HTTP siguientes. El agente no efectuó esa publicación ni inspeccionó su ejecución, resultados por plataforma o el grafo final; no se infieren esos detalles ni nuevas autorizaciones de publicación. La revisión estructural del export final sigue pendiente de aportación y no invalida esta confirmación funcional.

Resultados registrados el 22 de octubre de 2026. No se guardaron ni imprimieron claves, cuerpos inesperados o headers sensibles. Las claves se introdujeron mediante diálogos locales enmascarados y se usaron únicamente en memoria; sin archivos de entrada, argumentos con secretos ni .env. No se hicieron cambios de credenciales, Vercel o workflows por el agente durante estas pruebas.

## Alcance y evidencia

- n8n: exclusivamente HTTPS /webhook-test/publicar-manual del host indicado por el propietario. Nunca se llamó a /webhook/publicar-manual. Escucha de prueba coordinada antes de cada intento de la matriz; negocio desconectado confirmado por el propietario. No se inspeccionó directamente el historial de ejecución ni el grafo activo mediante una conexión administrativa.
- Aplicación: POST exclusivamente a https://evangelizador.vercel.app/api/public/r2-download-url, sin query, sin fecha y sin Authorization; body vacío de campos (`{}`). Según el orden del handler revisado, la nueva clave alcanza la comprobación de fecha y devuelve 400 antes de consultar Supabase/R2; las otras se rechazan antes.
- Sin cookies, credenciales predeterminadas o seguimiento de redirecciones; sin reintentos automáticos. No se solicitaron URLs firmadas ni se invocaron botones de publicación o nodos de negocio por estas herramientas.
- Los términos nueva y antigua identifican las entradas suministradas por el propietario; no se leen sus valores de configuraciones remotas ni se conservan identificadores derivados de las claves.

## Último resultado comprobado por caso

| Destino y caso | HTTP | Validación adicional |
| --- | --- | --- |
| n8n prueba, clave nueva | 200 | Última petición: Content-Type application/json; charset=utf-8, cuerpo no vacío, JSON válido y exactamente el objeto esperado `{"ok":true,"prueba":"autenticacion"}` |
| n8n prueba, clave antigua | 403 | Rechazo HTTP observado durante la matriz coordinada |
| n8n prueba, sin cabecera | 403 | Rechazo HTTP observado durante la matriz coordinada |
| Aplicación sin fecha, clave nueva | 400 | JSON del error de falta de fecha comprobado en memoria: success=false y error esperado. No se imprimió el cuerpo |
| Aplicación sin fecha, clave antigua | 401 | Rechazo HTTP observado, sin Authorization alternativo |
| Aplicación sin fecha, sin cabecera | 401 | Rechazo HTTP observado |

Los casos no constituyen una transacción ni una captura simultánea de una versión: no se registraron deployment ID/SHA de Vercel ni versión publicada de n8n. El resultado positivo de n8n se volvió a comprobar después de la matriz para resolver la discrepancia de respuesta. No se repitieron los negativos ni la aplicación en esa última petición.

## Incidencias conservadas y resolución

1. Un primer intento al test webhook devolvió 404; el propietario informó que Listen se había desactivado. Ese resultado no se cuenta como rechazo de autenticación.
2. Hubo respuestas 200 que no coincidían con el objeto estático usado para compararlas. No se imprimieron ni guardaron sus cuerpos; no se puede reconstruir si estaban vacíos o qué propiedades tenían. No atribuirles una causa no comprobada.
3. La comparación se revisó con siete casos ficticios locales: usa ConvertFrom-Json y valida propiedades/tipos/valores, no igualdad literal del texto. Acepta espacios y orden distintos; rechaza propiedades adicionales o tipos incorrectos.
4. Con nueva confirmación de escucha, se hizo una sola petición con clave nueva: HTTP 200, application/json; charset=utf-8, cuerpo no vacío ni solo espacios, JSON válido y coincidencia exacta con ok booleano true y prueba string autenticacion, sin propiedades adicionales. Es el positivo vigente de la tabla.

Los estados 403 por sí solos no prueban que filtro/Respond no se ejecutaran. La desconexión de negocio durante las pruebas procede de la confirmación operativa del propietario; falta contrastar nodos ejecutados e identidad de la versión en el panel/export final. El propietario confirmó después la publicación manual funcionando, según el registro inicial; no es una publicación realizada/verificada directamente por el agente ni una validación de seguridad de la rama de borrado.

## Export final: pendiente de aportar y revisar

El único archivo aportado disponible en Descargas se volvió a inspeccionar localmente, solo por estructura: sigue teniendo 30 nodos, active=true, un Webhook, cabecera manual fija en HTTP Request, sin autenticación administrada saliente, sin Filtrar entrada autorizada ni Respond, y Programado habilitado. Es evidencia del export anterior, **no del estado final probado**. No se sobrescribió ni se volvió a ejecutar su contenido.

La copia publication.prepared.json es una propuesta saneada previa, no un export posterior de la instancia. No renombrarla como estado final ni dar por restauradas sus conexiones. Para completar la revisión se requiere un nuevo export del mismo workflow con sus nodes/connections/settings/typeVersion y referencias de credenciales saneadas, sin valores, pinData, staticData sensible ni historial de ejecuciones. No adjuntar credenciales descifradas. Puede aportarse una ruta local para sanearlo sin mostrar su contenido.

Revisar en ese archivo: mismo workflow/Webhook y POST /webhook/publicar-manual, Header Auth account 2 en ambos sentidos, ausencia de cabecera fija y referencias directas al Webhook, filtro body.fecha, Programado deshabilitado, estado de Respond/aristas temporales y restauración intencional del grafo de negocio, además de settings de guardado. La identidad y estado actuales del panel no se deducen de un JSON saneado con IDs sustituidos; distinguir confirmación del propietario y evidencia estructural.

Generación mensual permanece inactiva y fuera del alcance; comparte Header Auth account 2 y requiere validación separada antes de reactivarse. Las pruebas del test webhook no verifican la autenticación en la ruta productiva de n8n ni la retirada de acceso por despliegues históricos. El cierre del recifrado de CREDENCIALES_ENC_KEY es independiente y se conserva.

No se han hecho nuevas solicitudes para esta documentación. No se repiten pruebas hasta nueva autorización y coordinación de escucha. Se mantienen los archivos privados de respaldo/recibo/recuperación fuera de Git y el commit 2c44ea9 intacto.
