# Actualización manual del contrato Supabase

Esta actualización local no fue regenerada desde Supabase: el acceso al proyecto correcto `grjxcsngfnxdkkdkkujh` fue rechazado previamente y no hay un conector habilitado. No se consultó otro proyecto ni se leyeron valores de `.env`.

Fuente: metadatos verificados manualmente por el propietario, registrados en [la línea base](estado-verificado.md). Se actualizan `src/integrations/supabase/types.ts` (contrato usado por los clientes) y `src/types/database.ts` (modelo de aplicación), sin modificar SQL ni el esquema activo.

## Alcance y precisión

- Evangelios: se incorporan `fecha`, `santo_tiempo`, `evangelio`, `fuente`, `created_at`, `updated_at`, sin añadir `titulo` o columnas de las migraciones antiguas.
- La representación cliente usa strings para fecha/textos/timestamps. Salvo la clave `fecha`, se admite null conservadoramente porque no se dispone aquí de la captura íntegra de nulabilidad. La opcionalidad de INSERT representa el contrato de las llamadas existentes, no acredita defaults de todas las columnas.
- El default informado de fuente es `usccb`; la actualización de tipos no cambia el guardado ni la semántica de fuente/título.
- Metadatos de producción confirmados posteriormente por el propietario: `youtubepostid` y `facebookpostid` son `text`, nullable, sin default. Se representan como `string | null` en Row y en el modelo de aplicación, y como propiedades opcionales `string | null` en Insert/Update. Se retira el tipo provisional unknown. Estos cambios no agregan escritores de IDs.
- Según el workflow exportado, tal como confirma el propietario, ambos campos guardan `post._id` de Zernio para la publicación correspondiente. **No son IDs nativos de YouTube o Facebook**; los nombres históricos no cambian esa semántica. No asumir que sus valores sean distintos ni que constituyan confirmación final por plataforma. El agente no ha inspeccionado aquí una exportación del workflow; se registra la procedencia manual de esta confirmación, sin incluir el workflow ni sus credenciales.
- La lista Relationships vacía no acredita ausencia de relaciones: faltan los metadatos completos para regenerar fielmente el contrato. Las otras tablas y la versión PostgREST conservan su definición anterior, sin afirmar nueva verificación.

Pendiente: completar tipos SQL/nulabilidad/defaults/relaciones del resto del esquema y regenerar con acceso al proyecto correcto. Los tipos, nulabilidad, ausencia de default y origen `post._id` de Zernio de ambos IDs ya están confirmados. Queda por capturar el contrato completo de eventos y confirmaciones independientes por plataforma. Comparar el resultado regenerado con esta adaptación antes de sustituirla. No declarar aplicado ningún archivo de migración por actualizar tipos.

## Correcciones de tipado asociadas

Validación explícita de número para mes; omisión de propiedades opcionales cuando no existen; predicado de IDs que conserva el filtrado previo de null/cadena vacía; omisión de body vacío en RequestInit manteniendo el reenvío existente. No cambian permisos, firma, destinos del webhook ni workflows.
