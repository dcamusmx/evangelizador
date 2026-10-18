# Evangelizador: reglas del proyecto

## Identidad y evidencia

- Repositorio: `dcamusmx/evangelizador`; rama principal: `main`. Producción: `https://evangelizador.vercel.app`, en Vercel.
- Supabase de Evangelio Diario: `grjxcsngfnxdkkdkkujh`. No consultar otro proyecto sin autorización explícita.
- La conexión histórica con Lovable corresponde al repositorio original `evangeliodiario`, no al actual. No asumir sincronización ni despliegues mediante Lovable por archivos heredados.
- Stack real: React, TypeScript, Vite, TanStack Start/Router/Query, Tailwind y Supabase. Videos en Cloudflare R2; publicación externa mediante n8n/Zernio. pCloud conserva código heredado.
- Leer [la línea base](docs/estado-verificado.md), [la propuesta de esquema](docs/esquema-y-reconciliacion.md) y [el plan operativo](docs/plan-operativo.md). Distinguir código local, evidencia manual del propietario y verificaciones directas. El README contiene especificaciones históricas.

## Seguridad y operaciones

- No mostrar secretos, tokens, valores cifrados ni cadenas de conexión. No leer valores de archivos `.env` durante auditorías.
- No ejecutar migraciones, cambios de permisos/datos, workflows, publicaciones ni despliegues sin autorización para esa operación. Documentación o preparación local no los autorizan.
- No hacer push, cambiar de rama ni reescribir historia publicada durante auditorías. Las actualizaciones Git requieren autorización acorde al alcance solicitado.
- No aplicar las migraciones locales a ciegas ni registrar versiones como aplicadas. La base activa y las migraciones están pendientes de reconciliación.
- Mantener RLS y autorización en backend. Nunca usar `service_role` en el navegador.
- Preparar validación y recuperación antes de cada cambio operativo, probar primero en aislamiento y conservar compatibilidad.

## Publicación y entrega

- Confirmar YouTube y Facebook independientemente. Un éxito parcial no autoriza repetir una publicación ya aceptada.
- Diseñar reserva atómica, idempotencia, tratamiento de eventos repetidos/desordenados, errores y reintentos limitados en n8n.
- Incluir eliminación segura R2 entre las primeras correcciones: simulación inicial, confirmaciones por plataforma, retención, identidad exacta del objeto y ausencia de trabajos pendientes. No borrar por mera aceptación del envío ni solo por `estado = publicado`.
- Configurar destinos n8n y cuentas desde el proyecto, sin identificadores ni URLs de respaldo fijos.
- Entregar panel para conectar, reconectar y seleccionar YouTube/Facebook y cuenta Zernio exclusiva del proyecto al padre Edilberto.

## Alcance actual

El alcance autorizado incluye documentación de etapas 0 y 1, conservación de estados al confirmar cargas R2/pCloud, alineación manual de tipos y sus validaciones locales. El commit local requiere la revisión final y validaciones solicitadas por el propietario. No autoriza cambios de SQL, base de datos, workflows activos, eliminación de objetos R2, push ni despliegues. Las correcciones funcionales adicionales del plan requieren una solicitud posterior.
