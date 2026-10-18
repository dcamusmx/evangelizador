# Línea base de Evangelizador

Documentada el 18 de octubre de 2026. Base inspeccionada: `526784a2c8d6f0bdf3b03a2225b9f15ede49473e`, rama `main`.

## Fuentes y límites

- Local: código, tipos, seis migraciones y Git. Árbol limpio antes de esta edición documental.
- Manual: resultados comunicados por el propietario tras revisar Vercel/Supabase; sin volcado DDL íntegro conservado aquí.
- Acceso externo del agente: consulta de esquema del proyecto rechazada por falta de privilegios. No se inspeccionó directamente su base.
- El propietario confirma que Lovable corresponde al repositorio original `evangeliodiario`, no a `evangelizador`.

Vercel, según verificación manual: `evangelizador.vercel.app`, Production / Current, Ready, `main`, commit abreviado `526784a`, coincidente con HEAD local. Pendiente conservar deployment ID, SHA completo, fecha y equipo/proyecto como evidencia fechada. No representa una verificación permanente de despliegues futuros.

## Esquema activo informado

Proyecto confirmado: `grjxcsngfnxdkkdkkujh`.

| Objeto | Verificado manualmente | Pendiente |
| --- | --- | --- |
| `evangelios` | `fecha`, `santo_tiempo`, `evangelio`, `fuente` (default `usccb`), `created_at`, `updated_at`; no tiene `titulo` | Tipos, nulabilidad y restantes defaults exactos |
| `contenido_diario` | Campos editoriales, pCloud, R2, `link_youtube`, `link_facebook`; `youtubepostid` y `facebookpostid` confirmados como text, nullable, sin default | Inventario íntegro y tipos/defaults/nulabilidad del resto de columnas |
| Restricciones de ambas | PRIMARY KEY (`fecha`); no aparecen otras en `pg_constraint` | Índices completos; NOT NULL debe comprobarse en columnas, no deducirse de ese resultado |
| Triggers de ambas | Los únicos no internos llaman a `set_updated_at()` BEFORE UPDATE FOR EACH ROW y están habilitados | Nombres/DDL literal para la captura reproducible |
| `set_updated_at()` | Verificación manual posterior: función trigger PL/pgSQL, search_path=public; cuerpo `BEGIN NEW.updated_at = now(); RETURN NEW; END;` | Propietario, ACL y atributos restantes |
| RLS | Habilitado, no forzado, en ambas y `profiles` | Propietarios y captura literal de políticas |
| Políticas contenido | SELECT/INSERT/UPDATE para authenticated mediante `is_staff(auth.uid())` | Nombres y expresiones literales |
| Políticas evangelios | SELECT/INSERT/UPDATE para PUBLIC con comprobación de perfil admin/editor | Expresiones literales; no asumir que usan `is_staff` |
| DELETE | Sin políticas DELETE en ambas | Consumidores privilegiados externos |
| `profiles` | Lectura propia; lectura general y UPDATE para admin | DDL, relaciones y alta automática desde Auth |
| `is_staff`, `has_role` | STABLE, SECURITY DEFINER, search_path=public, consulta explícita a `public.profiles`; anon sin EXECUTE, authenticated/service_role con EXECUTE | Captura literal de firmas, cuerpos, propietarios y ACL |
| Grants de ambas | ACL anterior capturada: cuatro roles con ocho permisos, incluido MAINTAIN, grantor postgres y sin grant option; sin PUBLIC ni grants de columna. Reducción posterior declarada aplicada/verificada manualmente: anon sin los ocho, authenticated solo SELECT/INSERT/UPDATE; postgres/service_role conservados | Privilegios predeterminados y usuario exclusivo de n8n; conservar futuras capturas ACL |
| Historial | `to_regclass('supabase_migrations.schema_migrations')` devuelve NULL | Procedencia de cambios; no hay historial acreditado en esa ubicación |

Enums confirmados: `app_role` = admin/editor/pendiente; `estado_contenido` = pendiente_reflexion/pendiente_video/listo_para_publicar/programado/publicado/error.

PUBLIC en políticas no equivale a acceso anónimo sin condiciones: se exige perfil admin/editor. RLS no forzado no es por sí solo un fallo; revisar propietarios y bypass. TRUNCATE no está protegido por RLS; no se ha demostrado una vía de ejecución desde la API pública.

## Diferencias con migraciones y tipos

Nota posterior: la tabla siguiente conserva la comparación inicial. El contrato local ya se adaptó manualmente para incluir Evangelios e IDs de publicación, sin regeneración remota. Ambos IDs están confirmados como text, nullable, sin default; su tipo local es string | null. Ver [la procedencia y limitaciones](contrato-supabase-manual.md). Las migraciones históricas no se modificaron y continúan discrepando de la base.

| Elemento | Repositorio | Base activa / diagnóstico |
| --- | --- | --- |
| Evangelios | Migración `20260822000100` declara `santo_o_tiempo_liturgico`, `cita_evangelio`, `titulo`, `descripcion_base` | Usa `santo_tiempo`, `evangelio`, `fuente`. Consultas del código compatibles con estas columnas: no hay fallo demostrado |
| Tipos generados | `src/integrations/supabase/types.ts` omite `evangelios` | Contrato tipado incompleto |
| IDs de publicaciones | Inicialmente ausentes en migraciones y tipos; incorporados después manualmente en tipos Supabase y `ContenidoDiario` | `youtubepostid` y `facebookpostid`: text, nullable, sin default. Guardan `post._id` de Zernio según confirmación del propietario basada en el workflow exportado; no IDs nativos de las redes. Migraciones sin modificar |
| Políticas Evangelios | Migración: authenticated mediante `is_staff` | Activa: PUBLIC con comprobación de perfil; comparar semántica antes de normalizar |
| Grants | Migraciones históricas sin reconciliar; scripts controlados en supabase/proposals/minimum-table-privileges | Reducción aplicada y verificada manualmente por el propietario: acceso, edición, subida y publicación funcionan. Pendientes default privileges y usuario exclusivo n8n |
| Historial | Seis archivos versionados | No se acredita su ejecución en la base |

Migraciones históricas, **sin declarar ninguna aplicada**:

| Versión | Contenido local |
| --- | --- |
| 20260809061451 | Enums, perfiles, contenido, permisos, funciones y triggers |
| 20260809061508 | Restricciones de ejecución de funciones |
| 20260810221522 | Credenciales |
| 20260811034319 | Metadatos R2 |
| 20260813071041 | Enlace Facebook |
| 20260822000100 | Evangelios con definición distinta de la activa |

## Defectos comprobados en código

- `src/routes/_authenticated/evangelios.tsx`: título editable solo en estado React; el upsert no lo envía a ninguna tabla. La tarjeta calcula título desde fecha.
- `src/lib/n8n.functions.ts`: genera `contenido_diario.titulo` desde fecha, sin usar lo editado en Evangelios.
- `fuente` se reutiliza como descripción y puede recibir texto generado al guardarse vacía. Su default activo indica procedencia; no mezclar contratos.
- Cambiar fecha en el formulario hace upsert de una nueva clave, sin eliminar la original.
- Corregido localmente, pendiente de despliegue: R2 y pCloud consultan `reflexion, estado`, conservan programado/publicado y abortan la escritura si falla esa lectura. Las pruebas simulan los handlers y comprueban que no escriben enlaces ni IDs de publicación. No resuelve cambios concurrentes entre lectura y upsert.

No se inspeccionaron workflows activos, contratos Zernio, CORS/permisos R2, respaldos, DDL real de credenciales ni alta de perfiles. La auditoría inicial no ejecutó build/lint/pruebas; la corrección local añade pruebas en `tests/upload-confirmation.test.mjs`, ejecutables con `node --test tests/upload-confirmation.test.mjs`. No existe todavía una baseline ejecutable aprobada.
