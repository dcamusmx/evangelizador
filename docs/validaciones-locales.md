# Validaciones locales de la corrección de cargas

Fecha: 18 de octubre de 2026. HEAD: `526784a2c8d6f0bdf3b03a2225b9f15ede49473e`; incluye cambios locales todavía sin commit en confirmaciones R2/pCloud. Esta revisión no corrige problemas adicionales ni despliega.

## Estado posterior: corrección de los 14 errores

La corrección local posterior deja **0 errores TypeScript**, sin modificar tsconfig, añadir any ni supresiones. Se incorporó el contrato manual de Evangelios y los IDs existentes de contenido; se estrecha mes/IDs, se omiten opcionales ausentes y body vacío. Ver [procedencia y límites de los tipos](contrato-supabase-manual.md).

Validaciones posteriores a la corrección:

- `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false`: salida 0, sin diagnósticos.
- `node --test tests/upload-confirmation.test.mjs`: 37 aprobadas, 0 fallos, dependencias externas simuladas.
- `npm.cmd run build`: salida 0; permanecen avisos previos sobre inputValidator y vite-tsconfig-paths; artefactos locales Cloudflare, sin despliegue.
- ESLint en nueve archivos TypeScript modificados y el test: 245 errores previos (239 de formato y 6 any), 0 advertencias. El test y `src/types/database.ts` pasan. No se añadieron reglas desactivadas ni errores nuevos; una incidencia previa de formato desapareció en Evangelios. Comparación con HEAD normalizando CRLF solo en memoria para distinguir ruido de finales de línea; los archivos tocados usan LF sin reformateo global.
- `git diff --check`: sin errores de whitespace; Git puede advertir su futura conversión LF/CRLF.

Las secciones siguientes conservan el inventario y explicación históricos de **antes** de corregir estos 14 errores, no describen el estado actual.

## Inventario histórico: 14 diagnósticos

Configuración del proyecto, `noEmit: true`, `incremental: false`. Inventario obtenido con la API del TypeScript instalado y `getPreEmitDiagnostics`, incluyendo diagnósticos de configuración, sintaxis y semántica del programa.

| # | Archivo | Línea:columna | Código | Causa |
| --- | --- | --- | --- | --- |
| 1 | src/lib/n8n.functions.ts | 129:43 | TS18048 | Comparación `input.mes < 1`: mes puede ser undefined; Number.isInteger no estrecha ese tipo |
| 2 | src/lib/n8n.functions.ts | 129:60 | TS18048 | Comparación `input.mes > 12`: mismo problema |
| 3 | src/lib/n8n.functions.ts | 150:13 | TS2769 | `.from("evangelios")` no figura en Database generado |
| 4 | src/lib/n8n.functions.ts | 159:63 | TS2345 | Callback de map espera fecha; recibe tipo de error de consulta por tabla ausente del contrato tipado |
| 5 | src/lib/n8n.functions.ts | 181:15 | TS2769 | Callback de filter incompatible con ese tipo de error |
| 6 | src/lib/n8n.functions.ts | 182:12 | TS2345 | Callback de map de nuevos registros incompatible con ese tipo de error |
| 7 | src/routes/_authenticated/ajustes/index.tsx | 50:9 | TS2375 | Envía `mes: undefined` explícito donde `mes?: number` no lo permite con exactOptionalPropertyTypes |
| 8 | src/routes/_authenticated/dashboard.tsx | 52:21 | TS2345 | `.filter(Boolean)` no elimina null del tipo `(string | null)[]` usado en `.in()` |
| 9 | src/routes/_authenticated/evangelios.tsx | 75:15 | TS2769 | `.from("evangelios")` ausente en Database |
| 10 | src/routes/_authenticated/evangelios.tsx | 82:56 | TS2352 | Conversión de error de consulta a Record sin solapamiento suficiente |
| 11 | src/routes/_authenticated/evangelios.tsx | 266:43 | TS2769 | `.from("evangelios")` del guardado ausente en Database |
| 12 | src/routes/_authenticated/evangelios.tsx | 266:64 | TS2345 | Payload upsert incompatible con las tablas conocidas por los tipos generados |
| 13 | src/routes/zerniolinks.ts | 74:44 | TS2769 | fetch recibe propiedad `body: Buffer | undefined` explícita, incompatible con RequestInit estricto |
| 14 | src/types/database.ts | 112:3 | TS2375 | mapEvangelioRow asigna explícitamente undefined a propiedades opcionales; el diagnóstico identifica primero id |

Los errores de tipos de Evangelios no prueban un fallo SQL en producción: sus columnas activas fueron confirmadas manualmente, pero faltan en los tipos locales. Varios diagnósticos son derivados de la misma discrepancia, no catorce defectos independientes.

## Evidencia de reducción de 18 a 14

Se construyeron dos programas TypeScript con las mismas dependencias/configuración. Para la baseline, un CompilerHost sustituyó **solo en memoria** el contenido de los dos archivos de confirmación por `git show HEAD:<archivo>`. El resto del programa fue el mismo. No se revirtieron archivos, no se modificaron tipos/configuración y no se añadieron supresiones.

Resultado: baseline 18, actual 14, cuatro diagnósticos retirados y cero añadidos. Los catorce restantes coinciden exactamente en archivo, posición, código y mensaje con los de la baseline.

| Archivo en HEAD | Posición anterior | Código retirado | Cambio que lo resuelve |
| --- | --- | --- | --- |
| src/lib/pcloud.functions.ts | 76:27 | TS2339: estado no existe en `{ reflexion: string | null }` | Seleccionar `reflexion, estado` |
| src/lib/r2.functions.ts | 90:27 | TS2339: mismo acceso a estado no seleccionado | Seleccionar `reflexion, estado` |
| src/lib/pcloud.functions.ts | 72:43 | TS2379: reflexion puede ser undefined en el argumento a derivarEstadoContenido | `fila?.reflexion ?? null` |
| src/lib/r2.functions.ts | 86:43 | TS2379: mismo argumento incompatible | `fila?.reflexion ?? null` |

El nuevo control de error de lectura evita escribir con estado desconocido, pero no es la causa de estos cuatro diagnósticos retirados.

## Build, independiente de TypeScript y lint

Comando ejecutado: `npm.cmd run build` (script configurado: `vite build`). Resultado: **éxito, código de salida 0**. Vite 8.2.1 compiló cliente y servidor; Nitro generó `.output/public`, `.output/server`, `.output/nitro.json` y configuración Wrangler local, entre otros artefactos ignorados. El estado Git posterior no mostró cambios versionados atribuibles al build.

Advertencias observadas: `inputValidator()` deprecado a favor de `validator()` y plugin `vite-tsconfig-paths` redundante con soporte nativo de Vite. No se corrigieron.

El target local efectivo es Cloudflare, según los artefactos generados; no se probó el empaquetado específico de Vercel. No se ejecutó preview, despliegue ni una prueba de producción. El script de build no ejecuta tsc ni eslint: que pase no elimina sus fallos.

## Otros controles ya realizados

- `node --test tests/upload-confirmation.test.mjs`: 37 pruebas aprobadas, sin llamadas reales a servicios.
- ESLint del archivo de pruebas: sin errores ni advertencias.
- Lint global de la revisión anterior: falló; no se repitió ni se corrigió en esta revisión. En los dos archivos de confirmación se acreditaron diagnósticos ya existentes (tres any y dos incidencias de formato).
- `git diff --check`: control de whitespace independiente del build y del tipado.
