# Rotación preparada de N8N_INTERNAL_API_KEY

Preparación del 19 de octubre de 2026. Sin generación de secretos, cambios de código/configuración externa, workflows, publicaciones o borrados. La comprobación funcional manual tras revocación HS256 está registrada en [el procedimiento general](procedimiento-rotacion-secretos.md). La clave interna n8n es independiente de las claves Supabase.

## Ubicaciones y evidencia

| Ubicación a revisar | Qué está comprobado y qué falta |
| --- | --- |
| Vercel → proyecto asociado a evangelizador.vercel.app → Settings → Environment Variables → N8N_INTERNAL_API_KEY | Nombre requerido por código. Confirmar existencia, ámbitos Production/Preview/Development, posibles restricciones por rama y procesos/despliegues que la utilizan. No se inspeccionó el panel. La operación futura requiere nuevo despliegue con ese entorno; los anteriores pueden conservar el secreto viejo |
| Aplicación → Ajustes → Credenciales, servicio n8n, nombre API_KEY | Entrada ofrecida por el catálogo. Los helpers actuales NO la leen para esta autenticación: no cambiarla a ciegas ni asumir que coincide con la variable de Vercel. Confirmar consumidores externos antes de decidir si necesita rotación separada |
| Panel, n8n / WEBHOOK_GENERAR_MES y n8n / WEBHOOK_PUBLICAR_MANUAL | Determinan los destinos de salida según credencial activa; el código usa sus respaldos de entorno si faltan. Conservar destinos, nombres y flujo activo. El segundo nombre es consumido por el helper aunque no aparece entre las opciones predefinidas n8n del catálogo |
| n8n → workflows de generación de mes y publicación manual → nodo Webhook de producción | Identificarlos por las rutas configuradas, sin divulgar URLs sensibles. Revisar Authentication y la credencial Header Auth seleccionada, o validación propia en nodos IF/Code/proxy. Confirmar que valida X-N8N-API-KEY y que un rechazo ocurre antes de cualquier efecto. No se conoce el nombre real de los nodos/credenciales: no hay export disponible en este checkout |
| n8n → nodos HTTP Request hacia /api/public/r2-download-url | Revisar credencial Header Auth o campo de encabezados, expresiones, variables y secretos externos que alimenten X-N8N-API-KEY. Buscar también subworkflows, nodos Code y ejecuciones en espera/reintento que hayan capturado el valor. No imprimir expresiones resueltas ni exportar valores |
| Aplicación, src/routes/api/public/r2-download-url.ts | autorizado compara X-N8N-API-KEY contra process.env.N8N_INTERNAL_API_KEY. Como alternativa acepta Bearer de usuario admin/editor; las pruebas de clave deben omitir ese Bearer para no enmascarar el rechazo |

En src/lib/n8n.server.ts, obtenerConfigN8n y obtenerWebhookPublicarManual leen la misma variable; postN8n la envía en X-N8N-API-KEY. Este es el sentido **aplicación → n8n**. En el sentido **n8n → aplicación/R2**, n8n presenta la clave al endpoint que emite la URL firmada; la clave interna no es una credencial de Cloudflare R2.

El emisor omite la cabecera si no hay variable y el verificador admite una sola clave. No existe mecanismo de doble clave ni un modo de ensayo de publicación acreditado. El estado real de autenticación n8n debe revisarse antes de elegir el corte.

## Orden operativo propuesto, pendiente de autorización

1. **Inventariar.** Registrar, sin valores, cada workflow/nodo/credencial, ámbito Vercel, subworkflow, disparador y consumidor del panel. Comprobar HTTPS de los destinos vigentes antes de transmitir la clave nueva; si hay transporte HTTP, resolverlo mediante una operación separada antes de activar la rotación. No restablecer el puente links retirado.
2. **Preparar validación y custodia.** Generar posteriormente una clave aleatoria independiente en un gestor seguro y asociar las credenciales por metadatos. No usar argumentos de terminal, URLs, chats, .env.example ni logs. Preparar pruebas locales con valores ficticios y un ensayo n8n sin efectos que compruebe la misma autenticación. Revisar retención de ejecuciones y captura de headers antes de usar un secreto real.
3. **Abrir ventana de corte.** Suspender Schedule/Cron/Webhook emisores pertinentes y ejecuciones manuales de generación/publicación, con un responsable que impida también llamadas desde la aplicación. Desactivar un disparador no cancela ejecuciones activas: drenar o registrar las pendientes y no repetir una publicación ya aceptada. El proyecto no tiene un interruptor de mantenimiento verificado; acordar el control real antes de comenzar. No pausar workflows ajenos.
4. **Actualizar n8n bajo pausa.** Cambiar las credenciales de los validadores de entrada de generación/publicación y los emisores de salida hacia R2. Si comparten una credencial, revisar todos los nodos vinculados; si tienen copias independientes, actualizar cada una. No confundir esta clave de integración con la API key de administración de n8n.
5. **Actualizar aplicación.** Cambiar únicamente N8N_INTERNAL_API_KEY en los ámbitos aprobados de Vercel y desplegar/promover una versión con ese entorno. Mantener los emisores pausados hasta que la aplicación nueva y todos los consumidores n8n estén coordinados. No tocar los destinos WEBHOOK_PUBLICAR_MANUAL, su respaldo de entorno ni API_KEY del panel como sustituto de este paso.
6. **Ejecutar las comprobaciones siguientes.** Aceptación nueva y rechazo antiguo en ambos sentidos, sin disparar tareas de publicación, generación, lectura de video ni eliminación. Si falta una vía de prueba segura para n8n, el corte queda pendiente de preparar y autorizarla; no enviar un ping al workflow activo suponiendo que será inocuo.
7. **Reanudar controladamente.** Retomar disparadores, observar ejecuciones naturales por metadatos y conciliar resultados inciertos antes de permitir reintentos. Retirar referencias antiguas y restringir despliegues históricos capaces de usar/verificar la clave vieja. No restaurar automáticamente el secreto publicado ante errores; mantener la pausa y corregir hacia delante.

## Pruebas y evidencia de rechazo

| Sentido | Prueba segura propuesta | Resultado requerido |
| --- | --- | --- |
| n8n → aplicación | POST a /api/public/r2-download-url, sin query, sin cuerpo de fecha y sin Authorization; primero clave nueva | 400 por falta de fecha después de pasar autenticación. El código revisado no consulta Supabase ni R2 en esa rama; no emite URL firmada |
| n8n → aplicación | Misma petición con clave anterior y, por separado, sin clave | 401 en ambos casos. Registrar solo nombre de prueba, fecha, despliegue y resultado; no headers, claves o respuesta completa |
| aplicación → n8n | Ensayo aislado de autenticación para cada validador de entrada, sin nodos de publicación/generación/borrado | Nueva aceptada y anterior/ausente rechazadas antes de cualquier efecto. Una copia demuestra compatibilidad de la credencial, no acredita por sí sola que el workflow productivo esté actualizado |
| aplicación → n8n, producción | Inspección de que cada Webhook productivo referencia el validador/credencial actualizado y comprobación negativa con clave anterior solo si se demuestra rechazo previo a efectos | 401/403 de autenticación, no de ruta inexistente. Si no hay garantía de rechazo previo, no enviar la petición al workflow activo |
| aplicación → n8n, aceptación sin efectos | Utilizar una rama de validación sin efectos ya existente y comprobada, o preparar bajo autorización separada un terminador temporal después de autenticación | Aceptación nueva en el destino real sin ejecutar acciones. No asumir que existe dry-run; restaurar/verificar el grafo y sus disparadores antes de reanudar |

No usar clave vieja junto con un Bearer válido en la prueba R2: pasaría por la autorización alternativa. No interpretar OPTIONS, 404 o un error de red como evidencia de rechazo de la clave. No aceptar como suficiente que el workflow esté inactivo: puede ocultar un validador incorrecto. No generar una publicación ni borrar un objeto para demostrar éxito.

Las pruebas R2 se definen a partir del orden actual del handler; comprobar que la versión desplegada conserva esa rama antes de ejecutarlas. No se ejecutaron solicitudes en esta preparación.

## Recuperación y cierre

Si aparece 401 inesperado, conservar la pausa, identificar por metadatos el componente con configuración antigua y corregirlo. No dejar aceptadas ambas claves indefinidamente ni desactivar autenticación. Registrar ejecuciones que hayan fallado a mitad del corte y reconciliar antes de repetirlas.

Cierre: nueva aceptada y vieja rechazada en ambos sentidos; ausencia de credenciales viejas en consumidores activos y de despliegues antiguos accesibles que todavía la acepten; destinos y flujo activo preservados. Si la prueba de aceptación n8n sin efectos sigue sin estar disponible, declararla pendiente, no aprobada. Las evidencias no incluyen secretos ni cuerpos.

Se preservan los documentos pendientes y el procedimiento de recifrado de CREDENCIALES_ENC_KEY. Esta preparación no equivale a rotación ni modifica ninguna variable o servicio.
