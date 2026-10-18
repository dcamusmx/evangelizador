# Propuesta de esquema y reconciliación

Propuesta documental de etapas 0 y 1. No contiene SQL ejecutable ni acredita versiones aplicadas. Ver [evidencia](estado-verificado.md).

## Contrato canónico propuesto

1. Mantener nombres activos de Evangelios: `fecha`, `santo_tiempo`, `evangelio`, `fuente`, `created_at`, `updated_at`. Preservar fuente como procedencia con default informado `usccb`. Tipos/nulabilidad finales pendientes de DDL.
2. Mantener título editorial en `contenido_diario`; en Evangelios mostrar título calculado sin edición engañosa. No agregar `evangelios.titulo` solo para acomodar el formulario.
3. Preservar campos editoriales, pCloud y R2 existentes. Ambos IDs de publicaciones están confirmados como text, nullable, sin default e incorporados al contrato manual como string | null. Guardan `post._id` de Zernio según el workflow exportado confirmado por el propietario; no son IDs nativos de cada red ni demuestran éxito final por plataforma.
4. Mantener enums y PK confirmados. No añadir checks sobre datos históricos sin evaluar incompatibilidades.
5. Mantener autorización admin/editor. Proponer sin grants a anon y SELECT/INSERT/UPDATE para authenticated; backend con permisos explícitos necesarios. Verificar herencia y consumidores antes de revocar.
6. Reproducir timestamps con la definición manualmente verificada de `set_updated_at()`: trigger PL/pgSQL, search_path=public, `BEGIN NEW.updated_at = now(); RETURN NEW; END;`; triggers de ambas tablas habilitados. Capturar propietario/ACL y DDL literal restante. Las altas de perfiles y su trigger Auth siguen pendientes; no darlos por activos por existir localmente.
7. Separar estado editorial y resultados por plataforma. Modelo físico de trabajos, intentos, confirmaciones y limpieza pendiente de contratos n8n/Zernio; no presentarlo como existente.

Estas decisiones son propuestas para revisión, no autorizaciones para cambiar servicios.

## Instalaciones nuevas

Objetivo: una base Supabase vacía y aislada debe reproducir el contrato acordado sin datos ni secretos de producción.

1. Completar DDL: schemas/extensiones, enums, tablas, índices, funciones, triggers, owners, grants y políticas. Incluir `profiles`, `credenciales` y dependencia de Auth; las dos tablas auditadas no bastan para instalar la aplicación.
2. Preparar matriz por objeto: activo / histórico / canónico / conversión / validación / recuperación. Explicar diferencias deliberadas como grants mínimos.
3. Preparar baseline **solo para base vacía**, ordenada: enums/tablas → funciones → triggers → RLS/políticas → grants y default privileges revisados. No generar DDL mientras falten definiciones.
4. Decidir un flujo que separe esa baseline de las seis migraciones históricas. No ejecutar ambas cadenas recreando objetos o reintroduciendo la antigua tabla Evangelios. Conservar historia como evidencia; cualquier cambio del mecanismo de ejecución requiere revisión.
5. Documentar configuración externa por nombres, sin valores: Auth/redirects, Vercel, cifrado, R2/CORS y contratos n8n/Zernio. Alta administrativa mediante procedimiento seguro separado, sin cuentas personales incrustadas.
6. Ensayar posteriormente en proyecto desechable autorizado, comparar metadatos normalizados y generar tipos desde el esquema aprobado. Deben incluir Evangelios e IDs con tipos reales.
7. Validar anónimo/pendiente/editor/admin/backend, alta de perfil, timestamps, generación/edición, carga y descarga; destinos de prueba, sin publicar ni borrar originales.

Salida: instalación aislada repetible sin diferencias inexplicadas. Recuperación: descartar únicamente el entorno desechable identificado; producción permanece intacta.

## Reconciliar la base existente

1. Capturar proyecto exacto, fecha, SHA y deployment ID; DDL/ACL/políticas/funciones/triggers/índices y workflows sin secretos. Verificar respaldos y restauración aislada.
2. Inventariar consumidores y roles de conexión: frontend, backend, n8n, Zernio y limpieza. Capturar contrato de columnas leídas/escritas sin credenciales.
3. Clasificar diferencias por objeto; revisar incompatibilidades con futuras restricciones mediante agregados sin divulgar contenido.
4. Acordar estrategia de historial honesta. No crear historial ni ejecutar reparación para declarar aplicados los seis archivos. Un eventual registro de baseline debe representar el estado capturado y validado, no afirmar ejecución histórica inexistente.
5. Preparar deltas mínimos, separados para estructura, permisos, datos y aplicación. Preferir cambios aditivos compatibles; no renombrar/borrar columnas activas para ajustarlas al SQL antiguo.
6. Ensayar en copia aislada: diff previsto, permisos por rol, contratos de escritura/lectura, bloqueos y volumen. Probar recuperación considerando escrituras nuevas.
7. Aplicación futura con autorización separada: revalidar deriva desde la captura, un delta por vez y evidencia posterior. Si producción cambió, recalcular; no forzar el plan anterior.

Salida: diferencias explicadas/resueltas e historial futuro veraz. Recuperación por delta: inverso específico cuando sea seguro, ACL capturadas para permisos, commit nuevo para revertir aplicación y reparación selectiva de datos. Restauración completa requiere coordinar escrituras posteriores; no es rollback automático.

## Información y decisiones pendientes

| Falta | Bloquea |
| --- | --- |
| Tipos, defaults, nulabilidad e inventario íntegro de columnas restantes; contrato de eventos (ambos IDs ya confirmados text, nullable, sin default y con origen post._id de Zernio) | DDL y tipos canónicos |
| Índices, owners, ACL, grants por columna, herencia y default privileges | Reproducción y reducción segura de permisos |
| Definiciones literales de políticas/is_staff/has_role; propietario/ACL y atributos restantes de set_updated_at (cuerpo/lenguaje/search_path ya verificados) | Reproducción exacta de seguridad y timestamps |
| DDL de profiles/credenciales, relaciones y triggers de auth.users | Instalación completa y administrador inicial |
| Procedencia de cambios y mecanismo actual de actualización de base | Baseline e historial honesto |
| Vercel deployment ID/fecha/SHA completo y configuración no secreta | Evidencia de despliegue y reproducción |
| Respaldos, retención, ensayo de restauración y tolerancia a pérdida/parada | Recuperación concreta |
| Workflows sin secretos, contratos/eventos y roles utilizados | Idempotencia y compatibilidad |
| Cuentas, IDs y confirmación final por plataforma | Publicación sin duplicados y limpieza |
| Configuración Supabase/panel para retención (inicial 7 días desde última confirmación requerida), activación/pausa, horario diario; claves/ETag/versiones, referencias y copias R2 | Workflow independiente de limpieza, sustitución del borrado en publicación y recuperación |
| Titularidad de redes, administrador y entrega Zernio | Independencia operativa del proyecto |

Decidir antes del SQL: baseline separada, contrato fuente/título, correlación de eventos/confirmaciones con post._id de Zernio, modelo por plataforma y objetivos de recuperación. La política de limpieza acordada está en [el plan operativo](plan-operativo.md#acuerdo-de-limpieza-r2): workflow diario independiente, configuración persistida en Supabase, retención inicial de 7 días desde la última confirmación requerida y activación/pausa desde el proyecto. Su esquema físico sigue pendiente. No inventar definiciones ni registrar migraciones como aplicadas.
