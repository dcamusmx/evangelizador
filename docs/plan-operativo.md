# Plan por etapas y eliminación segura R2

Solo está autorizada la preparación documental de etapas 0 y 1. Las operaciones siguientes requieren implementación revisada y autorización. Ver [línea base](estado-verificado.md) y [reconciliación](esquema-y-reconciliacion.md).

| Etapa | Entregable | Validación | Recuperación |
| --- | --- | --- | --- |
| 0. Evidencia | DDL/ACL/funciones, despliegue, contratos y respaldos | Inventario completo y restauración aislada ensayada | Sin cambios productivos; conservar capturas |
| 1. Reproducibilidad | Baseline propuesta, matriz de diferencias y reconciliación | Instalación aislada, comparación de metadatos/roles y tipos | Descartar solo entorno de prueba; deltas específicos para existente |
| 2A. Seguridad/integridad | Grants mínimos, webhook firmado/HTTPS, estados conservados, cargas vinculadas, último admin, errores y título/fuente | Permisos, firma, guardado y programado/publicado | ACL originales, configuración previa segura, commit de reversión y datos preservados |
| 2B. Confirmaciones y R2 | Resultados independientes, reserva/idempotencia y workflow diario de limpieza separado; retención/activación/pausa desde panel, configuración en Supabase, simulación inicial | Concurrencia, fallo parcial, eventos repetidos/desordenados, retención y pausa; cero borrados indebidos | Pausar limpieza; conservar claves/registro/IDs y reconciliar con proveedor |
| 3. Configuración y redes | Panel conectar/reconectar/seleccionar YouTube y Facebook; destinos n8n configurables | Expiración, reconexión, permisos y destinos de prueba | Configuración versionada; trabajos aceptados conservan destino |
| 4. Entrega | Cuenta Zernio exclusiva para el proyecto, titularidad/facturación/accesos y manual para el padre Edilberto | Recorrido completo por plataforma, recuperación y autonomía | Transición gradual sin envíos duplicados; retirar accesos anteriores tras validar |

La eliminación segura R2 queda entre las primeras correcciones operativas, coordinada con confirmaciones independientes. Primer entregable: simulación y control de elegibilidad, con borrado real deshabilitado. No adelantar DELETE antes de cumplir sus condiciones.

## Acuerdo de limpieza R2

Requisitos acordados, pendientes de implementación; no describen un workflow ya verificado o modificado:

- Workflow independiente con ejecución diaria. El workflow de publicación no ejecutará borrados cuando se active el reemplazo.
- Retención configurable desde el panel y persistida en Supabase. Valor inicial: **7 días desde la última confirmación requerida**, no desde la carga, el envío ni una aceptación intermedia.
- Para los destinos requeridos del trabajo, esperar confirmación final independiente de todos; el instante de referencia es el más reciente de esas confirmaciones. No usar la fecha de recepción de un evento duplicado para reiniciar el plazo.
- Activación y pausa administrables desde el proyecto, con autorización de administrador y configuración persistida. El workflow comprobará la pausa al comenzar y antes de cada borrado irreversible; documentar el tratamiento de una petición ya enviada.
- No eliminar mientras existan trabajos pendientes, reintentos, resultados inciertos o referencias que necesiten el objeto, aunque se haya cumplido la retención.
- Verificar la identidad del objeto exacto y conservar su clave junto al registro de eliminación: fecha, identidad comprobada, motivo/evidencia de elegibilidad y resultado. No borrar ese rastro al limpiar el archivo.
- Activación coordinada: validar en simulación, preparar pausa/retorno seguro, retirar o deshabilitar el borrado del workflow de publicación y confirmar que solo el reemplazo puede borrar. Después habilitar la limpieza diaria. No dejar dos rutas de borrado activas ni reactivar automáticamente el borrado anterior durante recuperación.

Validación de aceptación: con todas las confirmaciones requeridas, no es elegible antes de 7 días completos con la configuración inicial; la siguiente ejecución diaria podrá procesarlo después del plazo. Falta de confirmación, incertidumbre o pausa lo bloquean. Probar cambios de retención, eventos duplicados, recuperación de fallos y transición sin doble borrado.

Pendientes de diseño: nombres/tipos de configuración en Supabase, rango permitido, zona horaria y hora diaria, fuente temporal fiable de confirmaciones, efecto de cambios de retención sobre candidatos existentes y recuperación de un objeto eliminado. No generar SQL ni alterar workflows hasta resolverlos y autorizar su implementación.

## Contrato propuesto de publicación/limpieza

- Separar estado editorial, aceptación de Zernio y resultado final por plataforma. Ni una URL, ni aceptación del envío, ni `publicado` global bastan para borrar.
- Capturar destinos requeridos e identidad exacta del video al crear trabajo. Cambios de configuración no modifican silenciosamente trabajos iniciados.
- Reserva atómica e idempotencia por contenido/plataforma/intento lógico. Persistir IDs; reconciliar timeouts inciertos antes de reenviar. No repetir YouTube cuando solo falla Facebook.
- Los campos históricos `youtubepostid` y `facebookpostid` guardan `post._id` de Zernio según el workflow exportado confirmado por el propietario, no IDs nativos de cada red. Correlacionar cada resultado con su plataforma y destino; no usar la mera presencia de estos campos como confirmación final ni elegibilidad de borrado.
- Verificar firma/correlación con proyecto, cuenta, trabajo y plataforma. Deduplicar y evitar retrocesos por eventos tardíos; precedencia según contrato real pendiente de inspección.
- Clasificar errores transitorios/permanentes, reintentos limitados con espera progresiva, registro y alerta/intervención al agotarse.
- Exigir éxito final de todos los destinos requeridos, retención cumplida y ausencia de referencias o trabajos pendientes/inciertos/con reintento. Excluir una plataforma fallida exige decisión explícita auditable; no convertirla en éxito.
- Verificar bucket/key y versión cuando exista, referencias compartidas y reemplazos. Proponer claves inmutables y control de concurrencia. HEAD seguido de DELETE no asegura identidad si se reemplaza el objeto entre llamadas; no asumir borrado condicional soportado sin verificar R2.
- Flujo: candidato → simulación/elegibilidad → retención → reserva y nueva comprobación → borrado exacto → confirmación/auditoría. Modelo físico y estados aún pendientes de diseño.
- Borrado idempotente: tratar objeto ausente según identidad esperada, conservar IDs/metadatos para auditoría, confirmar antes de marcar completado y alertar ante resultado incierto.

## Pruebas antes de habilitar borrado

1. Ambas plataformas confirmadas: candidato solo tras retención y sin referencias pendientes.
2. Una plataforma fallida, pendiente o incierta: conservar video y recuperar solo esa plataforma.
3. Eventos duplicados, tardíos, de otra cuenta o con firma inválida: sin efectos adicionales.
4. Objeto reemplazado/compartido o trabajo concurrente: no borrar objeto nuevo ni requerido.
5. Error R2, interrupción entre DELETE y registro u objeto ausente: recuperación idempotente/auditable.
6. Cuenta de limpieza restringida al bucket/prefijo previsto, sin probar sobre originales.

Revisar candidatos en simulación; después habilitar alcance controlado autorizado con activación/pausa desde el proyecto. Retención inicial acordada: 7 días desde la última confirmación requerida, configurable y guardada en Supabase. Acordar copia recuperable si se exige recuperar videos. Un DELETE definitivo no se revierte con rollback de código.

## Controles y entrega

Cuando se implemente: tipos, lint/build y pruebas específicas de permisos, estados, concurrencia, confirmaciones y eliminación. No usar workflows productivos como prueba ni reescribir historia publicada.

Panel de redes: mostrar canal/página/cuenta, selección, estado y reconexión; administración autorizada y secretos en servidor. Destinos n8n desde configuración del proyecto, sin IDs/URLs de respaldo fijos; snapshots para trabajos en curso. Cuenta Zernio exclusiva en la entrega, sin dependencias de cuentas personales del desarrollador.
