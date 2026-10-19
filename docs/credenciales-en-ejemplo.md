# Saneamiento de .env.example

## Clasificación comprobada en código

La revisión local encontró valores no vacíos y sin forma de placeholder en el ejemplo. No se consultaron servicios ni valores de .env, y no se verificó vigencia de las credenciales.

| Variable | Clasificación y uso |
| --- | --- |
| N8N_INTERNAL_API_KEY | Secreto de servidor: src/lib/n8n.server.ts lo envía como X-N8N-API-KEY a los flujos de generación/publicación; src/routes/api/public/r2-download-url.ts lo acepta para autorizar acceso al video mediante URL firmada |
| SUPABASE_SERVICE_ROLE_KEY | Secreto privilegiado: el valor anterior contiene un JWT cuyo rol decodificado es service_role. src/integrations/supabase/client.server.ts lo usa para el cliente administrativo. Decodificar el rol no prueba validez de firma ni vigencia |
| CREDENCIALES_ENC_KEY | Secreto de servidor: src/lib/credenciales.server.ts deriva la llave de cifrado/descifrado AES-256-GCM. El ejemplo contenía un valor opaco sin marca de ejemplo |
| VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY | Claves publicables, con prefijo sb_publishable_. El cliente de navegador y el middleware las utilizan; no equivalen a service_role y dependen de autenticación/RLS para acceso. Se sustituyen por placeholders para evitar acoplar el ejemplo a un proyecto real |
| VITE_SUPABASE_URL / SUPABASE_URL | Identificador público del servicio, no un secreto; también sustituido por una URL de ejemplo |

Se reemplazan esas siete asignaciones por placeholders inequívocos. Las asignaciones vacías y demás comentarios se conservan. No se cambian nombres, consumidores, contratos de publicación ni variables externas. Copiar el ejemplo no produce configuración operativa hasta reemplazar los placeholders.

## Exposición histórica y rotación pendiente

Los tres valores con función de secreto aparecen tanto en HEAD previo como en el commit publicado 3f5d816, conservado en la referencia local origin/main. No se reconsultó el remoto. No hay evidencia suficiente para afirmar que sean ficticios o estén revocados: tratarlos como potencialmente comprometidos. Sustituirlos en el ejemplo no elimina copias históricas, clones ni artefactos que puedan contenerlos.

Requieren revisión y rotación/revocación si todavía están vigentes:

1. **N8N_INTERNAL_API_KEY**: coordinar Vercel y los consumidores/verificadores correspondientes en n8n, incluido el acceso al endpoint de descarga R2. No confundirla con n8n / API_KEY del panel sin comprobar correspondencia. Conservar compatibilidad durante el cambio y comprobar el flujo activo con una operación posterior autorizada.
2. **SUPABASE_SERVICE_ROLE_KEY**: identificar y revocar la credencial expuesta mediante el mecanismo admitido por el proyecto correcto, grjxcsngfnxdkkdkkujh, y actualizar los consumidores administrativos. El formato observado es JWT heredado: cambiar solo la variable no invalida la copia antigua. Antes de rotar material de firma compartido, evaluar efectos en otras claves y sesiones; este documento no autoriza ninguna operación.
3. **CREDENCIALES_ENC_KEY**: preparar descifrado con la llave anterior y recifrado controlado con una nueva, con respaldo y recuperación comprobados. No sustituir simplemente la variable: dejaría ilegibles las credenciales existentes. Evaluar también las credenciales protegidas si terceros pudieron obtener tanto la llave expuesta como sus valores cifrados; no se ha comprobado tal acceso.

No se recomienda rotar claves publicables solo por estar visibles: fueron diseñadas para exposición al cliente. Su sustitución en el ejemplo mejora la portabilidad. Esta revisión no verifica RLS ni concede seguridad al resto del sistema.

No se modificó .env, no se consultaron servicios, no se rotaron credenciales ni se reescribió historia. No se incluyen los valores antiguos, fragmentos, hashes ni identificadores de sus tokens en esta documentación.

## Validación

Revisión estructural del diff, conservación de todas las claves y asignaciones ajenas al saneamiento, comprobación de ausencia de los valores anteriores en el ejemplo y git diff --check. No se ejecutan pruebas funcionales ni build: solo cambian un archivo de ejemplo y documentación. La validación no certifica que el historial ni otros archivos estén libres de secretos.
