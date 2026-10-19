# Retirada del puente Zernio heredado

La propuesta de endurecimiento y el plan preliminar quedan sustituidos por esta retirada local autorizada. Se conserva el nombre del documento para mantener su referencia.

## Motivo y evidencia

El propietario confirmó manualmente:

- No existe el receptor /webhook/links en n8n.
- No existe una suscripción a https://evangelizador.vercel.app/zerniolinks en Zernio.
- El flujo actual de publicación no utiliza esta integración.

Estas son comprobaciones comunicadas por el usuario, no inspecciones directas del agente en los servicios. La comprobación previa de producción 3f5d816 (Vercel Ready; acceso, navegación y edición correctos) se conserva en [el registro de seguridad](npm-audit-restante.md).

En código, src/routes/zerniolinks.ts era el único consumidor funcional encontrado de ZERNIO_WEBHOOK_SECRET y N8N_WEBHOOK_LINKS_URL. Leía únicamente process.env, sin consultar el panel. Incluía DESTINO_DEFAULT con la antigua IP 3.144.148.129 y un destino HTTP fijo. No se implementó el endurecimiento ni la nueva consulta de credenciales propuestos.

## Cambios locales

- Eliminado src/routes/zerniolinks.ts.
- Regenerado src/routeTree.gen.ts mediante el plugin TanStack que ejecuta npm run build con la configuración Vite del proyecto; sin edición manual del árbol.
- Retiradas N8N_WEBHOOK_LINKS_URL y ZERNIO_WEBHOOK_SECRET de .env.example y sus comentarios específicos.
- Conservada como evidencia histórica la referencia al archivo eliminado en docs/validaciones-locales.md; no representa un consumidor vigente.

El flujo activo permanece intacto: publicarManual → obtenerWebhookPublicarManual → postN8n. Se conservan WEBHOOK_PUBLICAR_MANUAL, N8N_WEBHOOK_PUBLICAR_MANUAL, API_KEY, N8N_INTERNAL_API_KEY y WEBHOOK_GENERAR_MES, junto con los helpers compartidos de credenciales, cifrado, Supabase y n8n.

El catálogo ofrece n8n / API_KEY, mientras que el helper de publicación obtiene la cabecera X-N8N-API-KEY de N8N_INTERNAL_API_KEY. Esta diferencia existente no se modifica. Tampoco se inventa el servicio/nombre de una posible entrada heredada del panel para eliminarla.

## Configuración externa pendiente

**Pendiente retirar ZERNIO_WEBHOOK_SECRET de Vercel**, donde el usuario informó su existencia, después de publicar y verificar la retirada de la ruta. Confirmar ámbitos y consumidores externos antes de hacerlo. No se ha cambiado ninguna variable remota.

Revisar por metadatos si existe N8N_WEBHOOK_LINKS_URL en Vercel o en el panel y desactivar únicamente la entrada heredada identificada. No retirar API_KEY ni credenciales compartidas. El receptor nunca consultó el panel: su código no acredita la identidad exacta de esa entrada.

La retirada aún no está desplegada: producción y despliegues anteriores pueden conservar ruta y variables. Quedan como comprobaciones complementarias los logs, aliases, dominios alternativos, despliegues históricos y eventuales entregas pendientes. No se han inspeccionado ni se consideran resultados verificados.

No se leyeron ni modificaron valores de .env. El build se realizó en una copia temporal sin archivos .env, reutilizando las dependencias temporales previamente validadas; solo se copió de vuelta el árbol generado. Los artefactos permanecen fuera del repositorio.

## Validación y recuperación

Resultados de la revisión final:

- TypeScript (tsc --noEmit): salida 0.
- Las 37 pruebas de confirmación: 37 aprobadas, cero fallos u omisiones.
- npm run build: salida 0, con los avisos previos de inputValidator obsoleto y resolución nativa de paths disponible; sin despliegue.
- git diff --check: satisfactorio.
- Sin referencias funcionales en src/tests a zerniolinks, las dos variables retiradas, DESTINO_DEFAULT o la antigua IP. Las referencias documentales son históricas o describen esta retirada.
- Comparación contra HEAD: helpers n8n/credenciales, funciones de publicación y panel intactos. En .env.example se preservan las demás asignaciones, comprobadas sin imprimir sus valores.

Hallazgo posterior resuelto en un lote separado: se sustituyeron por placeholders los valores del ejemplo, incluidos tres secretos de servidor potencialmente expuestos. Vigencia y rotación siguen pendientes; ver [la clasificación y recuperación](credenciales-en-ejemplo.md). El lote de retirada no los modificó. Los valores de .env permanecieron sin leer ni modificar.

Tras un despliegue futuro autorizado, comprobar que la ruta retirada no reenvía solicitudes ni redirige al flujo activo. No publicar contenido ni eliminar videos para validar.

Recuperación: un commit nuevo puede revertir la retirada ante una dependencia no identificada, previa revisión y autorización; ello reintroduciría los riesgos del receptor antiguo. No reactivar automáticamente suscripciones ni reenviar eventos inciertos. La configuración externa se gestiona por separado y no se recupera mediante Git.

Sin cambios de SQL, workflows ni servicios; sin push ni despliegue en esta tarea.
