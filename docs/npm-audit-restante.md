# Diagnóstico de las alertas npm restantes

Registro: 18 de octubre de 2026. Base inspeccionada: `58fae1410d0ec9e5ee82016b4d1de3d27804b562`, desplegada y con funcionamiento confirmado manualmente por el propietario. El diagnóstico inicial se conserva a continuación; la actualización local posteriormente autorizada y sus validaciones se registran al final. No se modifican SQL ni workflows ni se publican cambios.

## Método y alcance de la evidencia

Se refrescó npm audit en modo consulta (salida 1 por vulnerabilidades), npm ls completo y con omit=dev; se inspeccionaron manifests y consumidores locales instalados. Audit agrupa cuatro nombres de paquete: tres high y uno critical, pero hay **cinco copias instaladas** porque brace-expansion aparece en dos ramas. Sus tres avisos tienen rangos y parches distintos.

No se ejecutaron PoC, patrones maliciosos ni comandos construidos con entradas hostiles. No se accedió al panel o filesystem de Vercel. La búsqueda de nombres de estos paquetes y marcadores de los parsers no encontró coincidencias en los JS/MJS/JSON del artefacto de la instalación limpia temporal usado para validar 58fae14. Es un indicio local, no prueba de ausencia absoluta por minificación/externalización ni del artefacto real de Vercel. No se encontraron importaciones directas de estos cuatro paquetes en src ni rutas que procesen globs, YAML o sourcemaps recibidos del usuario.

**dev=false en package-lock no demuestra uso durante peticiones de producción**: el proyecto declara plugins de build como dependencias normales. npm ls --omit=dev sigue incluyendo js-yaml y source-map-js por esa clasificación, aunque las cadenas observadas sean de compilación. La ausencia de una ruta encontrada no equivale a demostrar que una vulnerabilidad sea inexplotable.

## 1. brace-expansion: 1.1.18 y 5.0.9 — high agregado

Cadenas locales:

- eslint@9.39.5 → minimatch@3.1.5 → brace-expansion@1.1.18.
- typescript-eslint@8.66.0 → @typescript-eslint/typescript-estree@8.66.0 → minimatch@10.2.6 → brace-expansion@5.0.9.

Ambas copias son dev=true; las rutas observadas corresponden al lint/análisis de archivos. Un patrón glob hostil procesado por expand/minimatch puede consumir CPU o agotar la pila. La exposición relevante sería aceptar patrones/configuración no confiables en tooling/CI. No se comprobó un consumidor de globs del usuario en el servidor publicado.

Avisos oficiales del mantenedor y parches de cada rama:

| Aviso | Riesgo | Primer parche 1.x / 5.x |
| --- | --- | --- |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr), CVE-2026-102277 | Reprocesamiento cuadrático, bloqueo del event loop | 1.1.21 / 5.0.12 |
| [GHSA-qhr7-859c-m2p7](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7), CVE-2026-102278 | Recursión con grupos anidados, agotamiento de pila | 1.1.20 / 5.0.11 |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p), CVE-2026-102276 | Recursión/expansión de argumentos en parseCommaParts, caída del proceso | 1.1.19 / 5.0.10 |

Cambio mínimo propuesto para cubrir los tres: **1.1.21 y 5.0.12**, manteniendo ambas ramas. Los padres admiten respectivamente ^1.1.7 y ^5.0.8; no hace falta cambiar de major de ESLint/minimatch. No basta con actualizar solo la copia hoisted 1.x.

## 2. js-yaml: 4.3.1 — high

Cadenas locales:

- eslint@9.39.5 → @eslint/eslintrc@3.3.6 → js-yaml@4.3.1.
- @tanstack/react-start@1.168.60 → @tanstack/start-plugin-core@1.171.49 → xmlbuilder2@4.0.3 → la misma js-yaml@4.3.1.

El [aviso oficial GHSA-2883-xcg3-v3hh](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh), CVE-2026-84375, describe consumo excesivo de CPU con merges de secuencias de mapas vacíos que el límite maxTotalMergeKeys no contabiliza. La rama 4.x tiene merges habilitados por defecto. Parche: **4.3.2** (la rama 3.x se corrige en 3.15.2, no instalada aquí).

Uso observado: lint y generación de sitemap durante build. XMLBuilder dispone de YAMLReader que llama a load(str), pero el consumidor de Start inspeccionado crea XML desde objetos y texto; no se encontró que le entregue YAML hostil. El riesgo requiere alcanzar el parser con un documento no confiable. Es dependencia clasificada como producción en el lock por Start, pero no se acreditó procesamiento YAML durante peticiones. La configuración/contenidos no confiables en CI y otros consumidores externos no se verificaron.

Cambio mínimo propuesto: resolver **js-yaml@4.3.2** para ambos caminos, compatible con ^4.3.0 de eslintrc y ^4.1.1 de xmlbuilder2. Sin actualización mayor de TanStack o del parser.

## 3. shell-quote: 1.10.0 — critical

Cadena local: @lovable.dev/vite-tanstack-config@2.12.0 → @tanstack/devtools-vite@0.8.3 → @tanstack/devtools-bundler-core@0.1.1 → launch-editor@2.14.1 → shell-quote@1.10.0 (dev=true).

El [aviso oficial GHSA-pqg4-j6r4-53mv](https://github.com/ljharb/shell-quote/security/advisories/GHSA-pqg4-j6r4-53mv), CVE-2026-102422, afecta a quote(): un token de comentario seguido de un string hostil con salto de línea puede permitir inyección cuando el resultado se ejecuta en una shell. Corregido en **1.11.0**; el parche rechaza esa combinación, por lo que debe verificarse compatibilidad del consumidor.

Evidencia local: el plugin de Lovable carga devtools solo con mode=development (`dist/index.js`, cerca de línea 613). Devtools abre el editor vía launch-editor. Su `guess.js:67` utiliza shellQuote.parse(specifiedEditor), no quote(); el índice usa spawn en Unix y una rama propia para Windows. No se encontró la cadena exacta parse → quote → shell descrita en el aviso, ni este tooling en las rutas de producción inspeccionadas. No se concluye que otros problemas de ejecución de comandos estén descartados ni que un dev server expuesto sea seguro.

Cambio mínimo propuesto: **shell-quote@1.11.0**, compatible con ^1.8.4 de launch-editor. No requiere actualizar la configuración Lovable heredada ni cambiar el framework.

## 4. source-map-js: 1.2.1 — high

Cadenas locales:

- @tailwindcss/vite@4.3.3 → @tailwindcss/node@4.3.3 → source-map-js@1.2.1.
- vite@8.2.1 → postcss@8.5.26 → la misma source-map-js@1.2.1.

El [aviso revisado GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), CVE-2026-93749, describe bloqueo síncrono con offsets de línea excesivos en secciones de sourcemaps indexados. Afecta >=1.0.0 y <1.2.2; parche **1.2.2**, también referenciado en [la versión oficial](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).

Uso observado: build CSS/sourcemaps. Tailwind importa SourceMapGenerator y PostCSS sí instancia SourceMapConsumer para mapas anteriores (`lib/previous-map.js` y `lib/map-generator.js`). Para explotar ese camino tendría que entrar un sourcemap hostil en los insumos de compilación; no se encontró una ruta que procese sourcemaps enviados por usuarios en runtime. Está clasificada como producción por las dependencias de build, no por prueba de exposición HTTP. No se inspeccionó el pipeline remoto ni se descartaron insumos externos.

Cambio mínimo propuesto: resolver **source-map-js@1.2.2**, compatible con ^1.2.1 de ambos padres; sin actualización mayor de Vite/Tailwind.

## Propuesta antes de tocar dependencias

1. Revisar/autorizar la actualización exclusivamente de estas resoluciones transitivas: brace-expansion 1.1.21 y 5.0.12, js-yaml 4.3.2, shell-quote 1.11.0 y source-map-js 1.2.2. Los siete rangos de padres se comprobaron con semver y admiten esos parches.
2. Actualización dirigida de lockfiles dentro de los rangos existentes; evitar un update general o agregar dependencias directas ficticias. Si el gestor no mantiene el alcance, evaluar overrides específicos por rama/padre, documentados, en lugar de forzar upgrades mayores. Los overrides no se proponen como primera opción.
3. Regenerar bun.lock desde el package-lock final y validar frozen sin cambiar minimumReleaseAge. Revisar la diff para excluir cambios no necesarios y confirmar con npm ls que ambas copias de brace-expansion quedaron corregidas.
4. npm ci en copia limpia, TypeScript, 37 pruebas, build y diff --check. Repetir npm audit completo y omit=dev; comprobar que desaparecen los seis avisos agrupados en cuatro paquetes, sin confundir el filtro dev con prueba de seguridad de runtime.
5. Validación adicional acotada de apertura del editor si se utiliza, lint y generación CSS/sourcemaps/sitemap. No lanzar payloads maliciosos ni probarlos en producción. Revisión final antes de commit/push/despliegue conforme a la autorización posterior.

Prioridad práctica: corregir las cuatro en un lote transitivo pequeño, incluyendo shell-quote por su impacto potencial en entornos de desarrollo. La prioridad no afirma explotación activa ni vulnerabilidad HTTP demostrada. No hay motivo acreditado para otro salto mayor de TanStack como solución a estas alertas.

## Estado del diagnóstico inicial

Solo documentación modificada. Dependencias, lockfiles, código funcional, SQL y workflows permanecen intactos. Sin instalaciones, audit fix, commit, push ni despliegue durante este diagnóstico. El resultado npm audit sigue siendo no limpio hasta aplicar y verificar los parches propuestos.

## Actualización local autorizada y validada

El propietario autorizó el parche mínimo y su commit local. Se reconsultaron los cuatro avisos enlazados y sus versiones corregidas siguen correspondiendo a los parches propuestos. El aviso específico de shell-quote tiene severidad High en la página del mantenedor; Critical describe la clasificación agregada del audit inicial, no la severidad de ese aviso individual.

Solo cambian cinco entradas de resolución en cada lockfile (`package-lock.json` y `bun.lock`), con sus integridades. `package.json` y `bunfig.toml` permanecen intactos; no se agregan overrides ni dependencias directas. La actualización dirigida con npm eligió inicialmente shell-quote 1.12.0; se acotó manualmente su resolución a 1.11.0 usando tarball e integridad consultados al registro oficial. La instalación limpia posterior validó esa resolución.

| Paquete final | Padres y rangos comprobados con semver |
| --- | --- |
| brace-expansion 1.1.21 | minimatch 3.1.5: ^1.1.7 |
| brace-expansion 5.0.12 | minimatch 10.2.6: ^5.0.8 |
| js-yaml 4.3.2 | @eslint/eslintrc: ^4.3.0; xmlbuilder2: ^4.1.1 |
| shell-quote 1.11.0 | launch-editor: ^1.8.4 |
| source-map-js 1.2.2 | @tailwindcss/node y postcss: ^1.2.1 |

Validaciones del estado final, realizadas en carpetas temporales nuevas sin copiar archivos .env:

- Node 24.18.0 / npm 11.16.0: `npm ci --no-fund` satisfactorio; instalación limpia de 418 paquetes.
- `npm ls brace-expansion js-yaml shell-quote source-map-js --all`: satisfactorio, ambas ramas de brace-expansion corregidas y sin copias anteriores de los cuatro paquetes.
- `npm audit --json` y `npm audit --omit=dev --json`: salida 0, cero vulnerabilidades en todas las severidades. Es el resultado del catálogo consultado, no garantía de ausencia de vulnerabilidades desconocidas.
- Bun 1.4.3: generación desde el package-lock final mediante `bun install --lockfile-only`; instalación en otra carpeta temporal con `bun install --frozen-lockfile` satisfactoria. Conservada la protección minimumReleaseAge y sus exclusiones existentes. El diff de Bun contiene exactamente las mismas cinco actualizaciones que npm.
- `tsc --noEmit`: salida 0.
- `node --test tests/upload-confirmation.test.mjs`: 37/37, sin fallos ni omisiones.
- `npm run build`: salida 0, cliente y servidor generados en la copia temporal. No es un despliegue ni una prueba funcional en producción.
- `git diff --check`: satisfactorio tras la revisión final.

Avisos restantes no relacionados con npm audit: instalación informa deprecación de tsconfck y falta de mantenimiento de Recharts 2; build informa de inputValidator obsoleto y resolución nativa de paths disponible en Vite. No se corrigen en este lote. La deuda de lint previa permanece fuera de alcance y no se reejecutó lint al no cambiar código funcional. No se probó apertura interactiva del editor ni integraciones externas.

Recuperación: revertir el commit de este lote en un commit nuevo y reinstalar desde ambos lockfiles anteriores; ello reintroduciría las alertas conocidas y requiere evaluar ese riesgo. No hubo cambios de datos ni servicios. Al cerrar la implementación local todavía no se había realizado push ni despliegue.

## Publicación y comprobación manual posterior

El commit `3f5d8167e1db201572c41f76823a0d71ef69346f` se publicó mediante push fast-forward autorizado a origin/main. Posteriormente, el propietario confirmó producción: **Vercel Ready; acceso, navegación y edición de registros correctos**. Evidencia manual comunicada en esta conversación, sin inspección directa del panel por el agente. No acredita pruebas de recepción de webhooks, publicación de contenido ni eliminación de videos. No se aportaron deployment ID ni fecha del despliegue.
