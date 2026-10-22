# Recifrado de credenciales: procedimiento y cierre registrado

El procedimiento siguiente conserva las condiciones revisadas del mantenimiento. La simulación y apply fueron autorizados y completados posteriormente; el cierre se registra a continuación. No autoriza repetir operaciones, ejecutar recover ni cambiar servicios. No incluir secretos en respuestas, argumentos, archivos JSON de entrada o Git. Se conservan los documentos pendientes y [la evidencia de conexión](comprobacion-session-pooler.md).

## Cierre registrado el 22 de octubre de 2026

| Comprobación | Resultado y procedencia |
| --- | --- |
| Simulación | Herramienta: 8 filas, validaciones correctas, respaldo cifrado autenticado y releído, committed=false, ROLLBACK confirmado y conexión cerrada |
| Primer intento de apply | Detenido antes de conectar o escribir. El propietario identificó una confusión de entrada: llave nueva introducida en ACTUAL. El diagnóstico local posterior pasó lectura, autenticación del respaldo correcto, correspondencia de esquema y validación de las tres llaves, sin conexión a producción |
| Apply autorizado posterior | Herramienta: 8 filas recifradas; mismas llaves de simulación comprobadas; esquema y datos revalidados antes de escribir; respaldo y recibo nuevos cifrados y verificados; committed=true y commitAcknowledged=true; conexión cerrada. No quedó COMMIT incierto y no se ejecutó recover |
| Vercel Production | El propietario confirma CREDENCIALES_ENC_KEY actualizada y despliegue Ready. No fue una modificación ni inspección del agente; SHA, deployment ID y fecha exacta del despliegue no aportados |
| Prueba funcional | El propietario confirma prueba R2 correcta después del despliegue; no se afirma una publicación de prueba ni eliminación de videos |
| Estado del mantenimiento | Cierre de recifrado y validación funcional registrado. La reactivación efectiva del workflow no fue comunicada; restaurar solo su estado previo conforme a la sección 8, sin pruebas de publicación |

**Custodia conservada:** respaldo de simulación, respaldo previo a apply y recibo de recuperación permanecen fuera de Git en los directorios privados preparados. No se han movido, sobrescrito, eliminado ni copiado en esta actualización. Conservar oldKey, newKey y backupKey en el gestor protegido bajo responsabilidad del propietario, con backupKey separada de los archivos; el agente no almacena sus valores. No retirar ninguna llave o archivo de recuperación ni expirar copias por este cierre documental.

El recibo corresponde al apply confirmado: no usar el de otro intento ni el respaldo de simulate para restaurar un estado distinto. Si hubo escrituras después del cierre, recover puede rechazar el estado actual y exige reconciliación de deltas; no forzarlo. El cierre no revoca copias históricas expuestas ni acredita rotación de las credenciales subyacentes o de N8N_INTERNAL_API_KEY. Permanecen vigentes las precauciones de respaldo, recuperación y COMMIT incierto para operaciones futuras.

### Revisión local posterior al cierre, previa al commit

- npm.cmd test en tools/credential-rekey: 19/19 pruebas aprobadas, sin omisiones.
- npm.cmd run test:native: 7/7 aprobadas en PostgreSQL 18.4 local desechable, dos sesiones independientes, sin conexión a Supabase. Incluye captura de catálogos, bloqueo concurrente, rollback, recuperación que rechaza cambios posteriores y restauración de un respaldo bajo llave independiente.
- TypeScript sin errores; 37/37 pruebas de confirmación existentes; ESLint aislado de todos los módulos de la herramienta y node --check correctos. Se usó npm.cmd por la política de PowerShell para scripts .ps1, sin modificar esa política.
- Seis bloques PowerShell documentales pasan el parser sin ejecutarse. Revisión de whitespace y git diff --check correctos.
- Revisados 17 archivos de herramienta/documentación: sin secretos detectados por patrones ni coincidencias con los tres secretos históricos, comparados exclusivamente en memoria sin imprimirlos. Sin .env, respaldos, recibos, capturas privadas, temporales, node_modules ni artefactos de compilación entre los archivos del commit. Los ejemplos de llaves en pruebas son ficticios.
- No se repitió build: no cambian código, configuración ni dependencias de la aplicación; el paquete de la herramienta y su lockfile son independientes. No se ejecutó lint global de la aplicación; su deuda previa queda fuera de este cambio.

Esta revisión no repite simulate/apply/recover ni consulta producción. Los lanzadores privados utilizados durante la operación y sus resultados permanecen fuera del repositorio; no forman parte de la herramienta publicada. Se conservan los documentos operativos pendientes de rotación n8n y otras tareas sin declararlas completadas.

## 0. Evidencia y condiciones de inicio

Inspección inicial verificada: Session pooler aws-0-us-west-2.pooler.supabase.com:5432, base postgres, usuario postgres.grjxcsngfnxdkkdkkujh; rol efectivo postgres con BYPASSRLS, USAGE/SELECT/UPDATE, PostgreSQL 17.6, TLSv1.3 con CA y hostname verificados. Esa inspección se hizo READ ONLY y terminó en ROLLBACK, sin filas ni bloqueo exclusivo. El esquema capturado es compatible en columnas, PK(id), UNIQUE(servicio,nombre), índices, reglas y trigger. El descifrado real y recifrado se validaron después, según el cierre anterior.

Captura exacta privada: C:\Users\dcamu\AppData\Local\Evangelizador\preflight\cd5f858a42a845e4a141514ed3ff9bc1\schema.json. El operador debe aprobarla y confirmar ausencia de deriva; apply la compara dentro de su bloqueo. Si cambia, detenerse y repetir inspección/aprobación: no editar el snapshot para forzar aceptación.

**Inventario confirmado por el propietario:** es el único usuario de la aplicación; existe un único workflow activo, invocado desde botones del sitio; no hay otros consumidores ni disparadores automáticos según su comprobación. Puede suspender completamente el uso. Esta evidencia manual sustituye la incertidumbre anterior del inventario; no es una inspección directa de paneles por el agente. No existe pausa global en código y no se exige implementarla ni activar All Deployments automáticamente. Sigue siendo obligatorio comprobar la pausa y el drenaje antes de operar.

## 1. Pausa operativa proporcional: acuerdo vigente

Este apartado sustituye la exigencia anterior de una barrera universal de ingreso. Para el inventario confirmado se acepta una pausa operativa del único propietario, sin desplegar código de mantenimiento ni exigir All Deployments. No garantiza aislamiento frente a un atacante con credenciales comprometidas: ese riesgo se separa del control de concurrencia normal.

| Consumidor | Evidencia | Detener nuevas solicitudes | Verificar drenaje | Reanudar |
| --- | --- | --- | --- | --- |
| Aplicación Vercel y panel de credenciales | Propietario: único usuario. Código: operaciones de credenciales con autenticación y comprobación admin; generación/publicación y cargas con autenticación | Cerrar sesión desde la aplicación en todos los dispositivos/perfiles, cerrar pestañas y no usar botones ni llamadas directas durante la ventana. No navegar a despliegues antiguos. No iniciar promociones concurrentes | Esperar fin de solicitudes/subidas iniciadas; comprobar invocaciones pendientes si el panel lo permite y conciliar cualquier operación que estaba abierta. Cerrar pestañas no cancela por sí solo solicitudes ya aceptadas | Tras simulación terminada con ROLLBACK puede volver a abrirse con la llave actual; tras apply solo después de M4 o recuperación completa validada |
| Único workflow n8n | Propietario: un workflow, solo botones, sin disparadores automáticos. Código confirma invocación externa; ID/nombre registrar manualmente | Anotar ID/nombre y estado previo; desactivar/despublicar temporalmente según versión, sin ejecutar nodos ni cambiar sus credenciales. No ejecutar manualmente ni reintentar | Executions: Running=0 y Waiting=0; verificar también cola, reintentos/subejecuciones y trabajos ya aceptados por proveedores. Resolver resultados inciertos sin reenviar ni borrar videos. Desactivar no cancela ejecuciones previas | Restaurar su estado anterior al final, cuando aplicación y datos sean compatibles; sin publicación de prueba ni recuperación automática de trabajos |
| Tareas programadas/otros consumidores | Propietario confirma inexistencia de otros consumidores y disparadores automáticos; no acreditado por inspección remota | No hay tareas adicionales que pausar conforme al inventario. No crear ni iniciar ninguna durante mantenimiento | Reconfirmar que el inventario sigue vigente al comenzar; si aparece un consumidor, detener y ampliar la pausa antes de continuar | No activar tareas que no existían; si cambia el inventario, revisar procedimiento |
| Herramientas locales y acceso directo | Código: preflight y herramienta rekey disponibles. Propietario puede suspender uso | Detener servidores locales y scripts en todos sus equipos; cerrar clientes/SQL Editor tras terminar o revertir sus transacciones. Mantener únicamente la herramienta y la terminal del operador necesarias para el ensayo | Confirmar procesos propios detenidos sin imprimir argumentos/entornos; no dejar transacciones ni escritores en cola. Consultar metadatos de sesiones/locks solo si hace falta bajo alcance de lectura autorizado | Reiniciar únicamente con configuración compatible. Para simulación, la configuración antigua sigue vigente; para apply, no reabrir procesos con la llave vieja |

M1 operativo: el propietario registra que no usa la aplicación, sesiones/pestañas y servidores locales cerrados, workflow desactivado, Running/Waiting/cola y trabajos pendientes en cero, sin escrituras ni consumidores activos salvo la herramienta. No dar por cumplido por mera ausencia de tráfico reciente. Una operación incierta o un escritor pendiente bloquea el ensayo hasta conciliarlo. Las pruebas nativas locales no acreditan este estado de producción. El lock EXCLUSIVE permite SELECT y no sustituye esta pausa.

### 1.1 Escritura anónima: resultado de la revisión local

No se identificó una vía de escritura **sin autenticación** que, por sí misma, invalide esta estrategia en el código actual:

- src/lib/credenciales.functions.ts exige requireSupabaseAuth y has_role(admin) antes de guardar, activar o borrar; el middleware valida el token mediante Supabase. El navegador no recibe service_role.
- Las funciones de generación/publicación, R2 y pCloud usan requireSupabaseAuth; las cargas comprueban además permisos staff. El receptor api/public/r2-download-url.ts rechaza POST sin clave interna válida ni JWT admin/editor antes de leer configuración. Su operación es lectura/HEAD y firma GET, no escritura en credenciales; OPTIONS solo devuelve cabeceras. CORS abierto no equivale a autorización.
- La captura directa conservada de public.credenciales muestra RLS habilitado, no forzado, sin políticas. El acceso de filas por roles normales queda denegado por defecto; el backend privilegiado sí puede eludir RLS. La evidencia manual de mínimo privilegio en evangelios/contenido_diario deja anon sin permisos y mantiene RLS. No se ha repetido aquí una prueba remota de acceso anónimo ni una auditoría exhaustiva de funciones remotas.

El resultado es ausencia de una vía conocida en lo revisado, no una garantía global. Una URL firmada de carga ya emitida puede permitir escribir un objeto de almacenamiento hasta expirar, pero no cambiar filas de credenciales; detener subidas previas. Si se detecta una ruta anónima de escritura, una invocación inesperada o consumidor no inventariado, suspender el ensayo y evaluar el control mínimo específico antes de implementarlo.

### 1.2 Riesgos residuales separados: público y despliegues antiguos

El dominio sigue públicamente accesible si no se configura protección adicional. Los endpoints conocidos exigen autenticación para operaciones sensibles; cerrar sesión no revoca necesariamente todos los JWT ya emitidos. La clave N8N_INTERNAL_API_KEY tuvo exposición histórica y su rotación no queda acreditada por este procedimiento; un poseedor podría llamar al endpoint R2 de lectura. La revocación HS256 fue comunicada manualmente por el propietario, sin probarse de nuevo aquí. No se presupone ausencia de abuso con credenciales expuestas.

No existe inventario local de URLs generadas históricas ni acceso administrativo Vercel disponible al agente: su accesibilidad y código/entorno real siguen sin comprobar. Pueden conservar llaves viejas y código diferente; actualizar Production no los actualiza. Para esta pausa el propietario se compromete a no usarlos ni iniciar llamadas a ellos. Revisar Deployments/Domains, aliases y logs si están disponibles, sin publicar ni enviar POST de negocio. Registrar cualquier tráfico inesperado; una URL pública por sí sola no demuestra escritura anónima. La autorización del código actual no acredita la de cada versión histórica.

La protección de ingreso es una defensa adicional recomendable frente a ese riesgo, **no condición automática del ensayo** con el inventario confirmado. [Vercel distingue All Deployments y otros alcances](https://vercel.com/docs/deployment-protection). Si se observa actividad no controlada o escritura anónima en una versión antigua, posponer operaciones y proponer aislamiento de esa superficie; un cambio a src/server.ts nuevo no protegería versiones ya desplegadas. No se propone implementar ahora una barrera global ni cambiar servicios.

### 1.3 Secuencia breve: ejecutar primero únicamente simulate

1. Aprobar el esquema capturado y confirmar que se conserva la evidencia TLS/Session pooler. No leer .env ni cambiar configuración. Acordar ventana y registrar M1 con la tabla anterior; completar el drenaje antes de introducir llaves.
2. Preparar y recuperar desde el gestor oldKey, newKey y backupKey independiente, sin mostrarlas. Revisar directorio protegido, ACL y custodia según sección 2. Definir la función enmascarada de sección 3. Esto no autoriza apply ni cambios Vercel.
3. Ejecutar únicamente el comando simulate de sección 4, con nombres de archivo nuevos. Introducir contraseña y llaves en la entrada enmascarada; no usar argumentos con secretos ni archivos de entrada. Descifra/recifra en memoria y crea respaldo local cifrado; no actualiza PostgreSQL.
4. Exigir salida 0, mode=simulate, committed=false y rows entre 1 y 10000, respaldo autenticado/releído, sin errores; registrar únicamente resultados no sensibles. Confirmar proceso finalizado, conexión cerrada y ROLLBACK. Conservar respaldo y backupKey bajo custodia separada: abrir el sobre necesita backupKey y descifrar ciphertexts originales requiere oldKey.
5. Si falla o se interrumpe: mantener pausa hasta confirmar proceso/transacción terminados, no pasar a apply, no cambiar llaves ni repetir con el mismo archivo. El ensayo no debe haber cambiado datos; investigar antes de reintentar. Si surge duda sobre operaciones previas, reconciliar sin sobrescribir.
6. Si termina correctamente, se puede cerrar la ventana del ensayo: volver a usar la aplicación con llave vigente y restaurar al final el workflow, sin publicaciones de prueba. El apply queda pendiente de autorización separada y **una nueva pausa M1**; no reutilizar el ensayo como prueba de ausencia de cambios posteriores. Las secciones de respaldo final, recuperación y COMMIT incierto siguen vigentes para esa futura operación.

Consulta opcional de metadatos para revisar locks/transacciones sobre la tabla, por operador autorizado; NO ejecutada aquí, no incluye texto SQL ni parámetros:

```sql
SELECT l.pid, a.usename, a.application_name, a.state,
       a.xact_start, a.wait_event_type, l.mode, l.granted,
       pg_blocking_pids(l.pid) AS blocking_pids
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON a.pid=l.pid
WHERE l.relation=to_regclass('public.credenciales')
ORDER BY l.pid,l.mode;
```

No mata sesiones. Una lista vacía no sustituye el compromiso de pausa operativa y el drenaje de M1.

## 2. Llaves, custodia y directorio protegido

En un gestor de contraseñas cifrado, crear dos entradas independientes usando su generador criptográficamente seguro: **64 caracteres aleatorios** para CREDENCIALES_ENC_KEY nueva y otros 64 para la llave del respaldo. No reutilizar la JWT, N8N_INTERNAL_API_KEY ni la llave antigua. Registrar las versiones de los elementos, no sus valores. La herramienta exige llaves distintas y al menos 32 bytes para nueva/backup; la longitud sola no garantiza aleatoriedad.

Custodiar la llave de respaldo separada de los archivos cifrados y, preferiblemente, de la entrada de llave de datos: otro vault/custodio con acceso restringido. Confirmar recuperación del gestor en otra sesión autorizada antes de operar. No mostrar valores en el chat, usar generación por consola que los imprima, exportarlos en claro, hacer capturas ni activar transcripciones. Obtener oldKey exacta del gestor/configuración vigente mediante acceso manual seguro; el agente no la leerá de .env ni de Vercel. No recortar ni alterar el texto.

Mantener la llave vieja en custodia privada para recuperación hasta aceptar el cambio. backupKey abre el sobre de respaldo; oldKey sigue siendo necesaria para descifrar los ciphertexts originales. Recifrar no invalida una copia histórica obtenida por terceros; tratar las credenciales subyacentes según el procedimiento de incidente.

Comandos de preparación LOCAL, para ejecutar después de autorizar la ventana. No contienen secretos:

```powershell
Set-Location -LiteralPath 'C:\Repositorio\evangelio-diario-standalone'
$Schema = 'C:\Users\dcamu\AppData\Local\Evangelizador\preflight\cd5f858a42a845e4a141514ed3ff9bc1\schema.json'
$Ca = 'C:\Repositorio\certificado_evangelio_supabase\prod-ca-2021.crt'
$RunDir = Join-Path $env:LOCALAPPDATA ('Evangelizador\rekey\' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $RunDir | Out-Null
$operatorSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$operatorGrant = '*' + $operatorSid + ':(OI)(CI)F'
icacls.exe $RunDir /inheritance:r /grant:r $operatorGrant '*S-1-5-18:(OI)(CI)F'
if ($LASTEXITCODE -ne 0) { throw 'No continuar: ACL del directorio no verificada.' }
icacls.exe $RunDir
```

Validar ACL y volumen cifrado; no colocar en carpetas compartidas/sincronizadas. schemaFile/backup/recibo se guardan fuera de Git; el respaldo y recibo tienen cifrado independiente. Los archivos nuevos nunca se sobrescriben. Conservar una copia protegida del directorio aprobado en otro almacenamiento y comprobarla antes de descartar copias locales.

## 3. Función de sesión para entrada enmascarada

Esta definición es código no secreto. Pegar en una terminal PowerShell LOCAL sin transcripción y revisarla antes de usar. Solo llama al CLI existente. No cambia política de ejecución ni almacena contraseñas/llaves en archivos; recibe cuatro entradas con Read-Host -AsSecureString y las convierte a UTF-8 únicamente en memoria para stdin. No ejecutar en el chat, un terminal compartido o CI con captura de entradas.

```powershell
function Invoke-CredentialRekey {
  param(
    [Parameter(Mandatory=$true)][ValidateSet('simulate','apply','recover')][string]$Mode,
    [Parameter(Mandatory=$true)][string]$SchemaFile,
    [Parameter(Mandatory=$true)][string]$CaFile,
    [Parameter(Mandatory=$true)][string]$BackupFile,
    [string]$ReceiptFile,
    [switch]$SchemaReviewed,
    [switch]$MaintenanceConfirmed
  )
  if (!$SchemaReviewed -or !$MaintenanceConfirmed) {
    throw 'Se requieren esquema aprobado y mantenimiento real confirmado.'
  }
  if ($Mode -ne 'simulate' -and !$ReceiptFile) { throw 'Falta el recibo.' }
  $secrets = @{}
  $plain = $null
  $request = $null
  $bytes = $null
  $process = $null
  $pointers = New-Object System.Collections.Generic.List[System.IntPtr]
  try {
    $secrets.password = Read-Host 'Contraseña PostgreSQL (no API key)' -AsSecureString
    $secrets.oldKey = Read-Host 'Llave de datos ANTIGUA exacta' -AsSecureString
    $secrets.newKey = Read-Host 'Llave de datos NUEVA exacta (también en recover)' -AsSecureString
    $secrets.backupKey = Read-Host 'Llave INDEPENDIENTE del respaldo' -AsSecureString
    $plain = @{}
    foreach ($name in @('password','oldKey','newKey','backupKey')) {
      $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secrets[$name])
      $pointers.Add($ptr)
      $plain[$name] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    $request = @{
      target='grjxcsngfnxdkkdkkujh'
      operatorAuthorized=$true
      maintenanceConfirmed=$true
      connection=@{
        host='aws-0-us-west-2.pooler.supabase.com'
        port=5432
        database='postgres'
        user='postgres.grjxcsngfnxdkkdkkujh'
        password=$plain.password
        ca=[IO.File]::ReadAllText($CaFile)
      }
      oldKey=$plain.oldKey
      newKey=$plain.newKey
      backupKey=$plain.backupKey
      schemaFile=$SchemaFile
      backupFile=$BackupFile
    }
    if ($ReceiptFile) { $request.receiptFile=$ReceiptFile }
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName=(Get-Command node.exe).Source
    $info.Arguments='C:\Repositorio\evangelio-diario-standalone\tools\credential-rekey\cli.mjs ' + $Mode
    $info.WorkingDirectory='C:\Repositorio\evangelio-diario-standalone'
    $info.UseShellExecute=$false
    $info.CreateNoWindow=$true
    $info.RedirectStandardInput=$true
    $info.RedirectStandardOutput=$true
    $info.RedirectStandardError=$true
    $process=New-Object Diagnostics.Process
    $process.StartInfo=$info
    $process.Start() | Out-Null
    $bytes=[Text.Encoding]::UTF8.GetBytes(($request | ConvertTo-Json -Depth 5 -Compress))
    $process.StandardInput.BaseStream.Write($bytes,0,$bytes.Length)
    $process.StandardInput.BaseStream.Close()
    [Array]::Clear($bytes,0,$bytes.Length)
    $bytes=$null
    $plain.Clear()
    $request=$null
    $safeOut=$process.StandardOutput.ReadToEnd()
    $safeError=$process.StandardError.ReadToEnd()
    $process.WaitForExit()
    if ($safeOut) { Write-Output $safeOut.Trim() }
    if ($safeError) { Write-Output $safeError.Trim() }
    if ($process.ExitCode -ne 0) { throw 'Fallo o resultado incierto; mantener pausa y reconciliar.' }
  } catch {
    throw 'OPERACION_NO_CONFIRMADA: mantener mantenimiento; no repetir ni promover a ciegas.'
  } finally {
    if ($null -ne $bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
    if ($null -ne $plain) { $plain.Clear() }
    $request=$null
    foreach ($ptr in $pointers) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    foreach ($value in $secrets.Values) { $value.Dispose() }
    if ($null -ne $process) { $process.Dispose() }
  }
}
```

Los flags no crean mantenimiento ni conceden autorización: son afirmaciones del operador después de M1. Los strings gestionados por PowerShell/V8 pueden quedar transitoriamente en memoria pese a limpiar buffers; cerrar la sesión/proceso al terminar y evitar dumps/depuración. Si se corta el launcher, confirmar que el hijo terminó y reconciliar la transacción antes de reiniciar consumidores.

## 4. Simulación real: procedimiento ejecutado bajo autorización

Con M1 y esquema aprobado, ejecutar UNA vez con un nombre nuevo:

```powershell
Invoke-CredentialRekey -Mode simulate -SchemaFile $Schema -CaFile $Ca `
  -BackupFile (Join-Path $RunDir 'simulation-before.rekey-backup') `
  -SchemaReviewed -MaintenanceConfirmed
```

Resultado exigido: mode=simulate, rows mayor que cero y no superior a 10000, committed=false, salida 0. Descifra TODAS las filas, incluidas inactivas, solo en memoria; valida roundtrip con la nueva llave y termina ROLLBACK. **No escribe en PostgreSQL, pero sí crea un respaldo LOCAL cifrado**: no interpretar simulate como cero archivos ni como inspección inocua. Toma EXCLUSIVE temporalmente; por ello se ejecuta dentro de mantenimiento.

Punto M2: ningún error de descifrado/esquema; respaldo creado, autenticado y releído por la herramienta con backupKey. Las pruebas locales ya restauraron ese formato en base vacía; no se afirma haber restaurado producción. Si se exige restaurar un respaldo real antes del corte, preparar un destino aislado y autorizarlo por separado: no enviarlo automáticamente a otra base ni omitir esa decisión.

Ante cualquier error, mantener pausa, comprobar que terminó la transacción y corregir la causa. No aplicar filas parciales, no omitir una inactiva corrupta, no reutilizar archivos existentes. Los intentos futuros necesitan nombres nuevos y el mismo material de llave aprobado; no generar otra llave entre simulate y apply sin repetir la validación.

## 5. Respaldo final y recifrado

Antes de apply: M1 sigue vigente, M2 aprobado, schema sin deriva, nueva llave recuperable del gestor y ruta de promoción/retorno acordada. No iniciar una operación cuyos plazos superen los límites validados; no cambiar timeouts a ciegas.

```powershell
Invoke-CredentialRekey -Mode apply -SchemaFile $Schema -CaFile $Ca `
  -BackupFile (Join-Path $RunDir 'apply-before.rekey-backup') `
  -ReceiptFile (Join-Path $RunDir 'apply-recovery.rekey-backup') `
  -SchemaReviewed -MaintenanceConfirmed
```

apply vuelve a validar TODAS las filas, guarda/respalda/verifica el snapshot previo antes de escribir, recifra en una transacción, verifica ciphertexts/contenido y metadatos, y guarda recibo autenticado del estado posterior exacto antes de COMMIT. No usa el respaldo de simulate para restaurar un apply distinto. No se apoya en RLS para aislar escritores: toma bloqueo de tabla; la pausa debe impedir lectores incompatibles y escritores antiguos después de liberarlo.

Punto M3: salida 0 con mode=apply, committed=true y rows igual al ensayo sin cambios intermedios; respaldo y recibo accesibles bajo custodia. El trigger recalcula updated_at. La presencia del recibo NO demuestra por sí sola que COMMIT ocurrió: puede existir aunque la conexión se pierda antes o después del commit. Ante resultado incierto no ejecutar apply otra vez ni recover a ciegas; reconciliar bajo pausa mediante un procedimiento de comparación revisado.

## 6. Vercel: nueva configuración, despliegue y validación

Operaciones manuales posteriores autorizadas, no realizadas aquí:

1. Mantener pausa de todos los consumidores. Vercel → proyecto asociado a evangelizador.vercel.app → Settings → Environment Variables → **CREDENCIALES_ENC_KEY**, ámbito Production: sustituirla por la entrada NUEVA exacta del gestor mediante su integración/autorrelleno seguro. No imprimirla ni introducirla en Git, .env.example, CLI arguments o logs. No tocar SUPABASE_SERVICE_ROLE_KEY, N8N_INTERNAL_API_KEY, API_KEY ni destinos en este lote.
2. No cambiar Preview/Development a ciegas. Si un despliegue de otro ámbito puede acceder a ESTA base, debe permanecer aislado; incorporarlo al inventario y actualizarlo coordinadamente antes de permitirle acceso. No dejar consumidores con la llave antigua sobre ciphertexts nuevos.
3. Deployments → versión de código aprobada → Redeploy, usando la configuración actualizada; revisar las opciones del panel. Mantener la pausa operativa M1 hasta que quede Ready; si se añadió protección de ingreso, conservarla durante esa ventana. Confirmar SHA y deployment ID. No promover automáticamente un despliegue viejo como retorno: puede conservar la llave antigua. No usar la aplicación durante construcción y promoción; si aparece tráfico no controlado, detener el procedimiento y revisar el aislamiento antes de continuar.
4. Abrir únicamente al operador la versión candidata y validar login y lectura de registros. Esas acciones no demuestran por sí solas descifrado de credenciales: el listado del panel tampoco descifra valor_cifrado.
5. Para validar consumo real, usar una entrada cifrada activa comprobada y una acción sin efectos. El código ofrece probarCredencialR2 → obtenerConfigR2 → comprobarBucket, que realiza HeadBucket: puede validar descifrado/conexión sin cargar, publicar ni borrar videos. Solo usarla si las credenciales activas realmente proceden del panel; un fallback de entorno no prueba la nueva llave. No compartir logs/URLs/headers. Si no hay un consumidor sin efectos confirmado, dejar esa validación pendiente y mantener pausa; no inventar un dry-run del workflow activo.
6. apply ya comprobó todas las filas con la llave nueva. Mantener aún sin escrituras de prueba para preservar la recuperación automática exacta. Si se exige prueba de escritura cifrada desde la aplicación, definirla/autorizarla y cerrar primero la decisión de rollback automático: una fila nueva o un timestamp modificado hará rechazar el recibo. Después de esa escritura se necesita recuperación de deltas revisada, no restore masivo.

Punto M4: Ready en versión/configuración correctas, lectura y consumo descifrado sin efectos confirmados, antiguos despliegues fuera de uso conforme a M1, riesgo residual registrado y cero errores de llave. No basta un HTTP 200 de la página principal.

Referencias para revisar las opciones actuales del panel: [variables Vercel](https://vercel.com/docs/environment-variables) y [gestión de despliegues/redeploy](https://vercel.com/docs/deployments/managing-deployments#redeploy-a-project). La disponibilidad del control de ingreso/mantenimiento en esta cuenta sigue sin comprobarse.

## 7. Recuperación por fase

| Fallo | Acción y condición para volver a atender tráfico |
| --- | --- |
| Antes de apply o durante simulate | No hay cambio de datos por simulate. Mantener pausa hasta confirmar terminación/ROLLBACK. Con causa resuelta, puede abandonarse el corte con datos/llave antigua y el despliegue original compatibles |
| apply falla antes de COMMIT confirmado | La herramienta intenta ROLLBACK. No asumirlo por el mensaje genérico: comprobar estado. Si se confirma rollback, conservar datos/llave antigua; no promover nueva llave |
| Resultado de COMMIT incierto | Mantener pausa. No repetir apply. Comparar estado con snapshots autenticados mediante revisión segura. El CLI no tiene modo automático de reconciliación: prepararlo/autorizarlo si se necesita, sin imprimir filas |
| COMMIT confirmado, falla cambio de variable/build/promoción | Mantener consumidores parados. Preferir corregir/promover una versión con llave NUEVA. Si se decide volver atrás y no hubo escrituras, usar recover siguiente y después configurar/redesplegar con llave ANTIGUA. No devolver tráfico al despliegue viejo antes de restaurar los datos |
| recover falla por schema/cambio posterior | Detenerse, conservar pausa y archivos; preparar reconciliación del delta. No forzar ni borrar filas. Un rollback del código o de la variable no repara ciphertexts incompatibles |
| Error tras reapertura/escrituras | Volver a pausar y reconciliar cambios. No restaurar el snapshot por encima de escrituras nuevas; no repetir publicaciones inciertas |

Comando exacto de recuperación solo después de decisión explícita, con M1 mantenido, M3 confirmado y recibo de ESE apply:

```powershell
Invoke-CredentialRekey -Mode recover -SchemaFile $Schema -CaFile $Ca `
  -ReceiptFile (Join-Path $RunDir 'apply-recovery.rekey-backup') `
  -BackupFile (Join-Path $RunDir 'recover-before.rekey-backup') `
  -SchemaReviewed -MaintenanceConfirmed
```

Introducir oldKey y newKey con los mismos significados que en apply, no intercambiarlas; backupKey idéntica. recover exige igualdad exacta con el estado posterior, guarda otro respaldo y restaura ciphertexts/metadatos originales salvo updated_at recalculado por el trigger. Resultado esperado: mode=recover, committed=true, salida 0. Después restituir CREDENCIALES_ENC_KEY ANTIGUA en los ámbitos afectados y crear/promover un despliegue con esa configuración; verificar consumo antes de reabrir. La llave antigua sigue comprometida: este retorno es contingencia temporal, no solución definitiva.

## 8. Reapertura y cierre

Reanudar solo tras M4 (avance) o verificación completa datos+aplicación compatibles (recuperación), aprobación del responsable, antiguos procesos detenidos/fuera de uso conforme a M1 y trabajos inciertos conciliados. Habilitar primero consumidores internos controlados, después acceso de usuarios y finalmente disparadores n8n previstos; observar ejecuciones naturales sin generar publicaciones de prueba. No reactivar borrado de videos como validación.

Registrar solo fecha, SHA/deployment ID, versión de elemento del gestor, counts y resultados booleanos de comprobación. Conservar respaldos/recibo y sus llaves con retención/custodia definida; tras validar respaldo nuevo restaurable y cerrar recuperación, expirar las copias antiguas bajo autorización. La copia de la llave vieja en Git no puede considerarse borrada.

## Revisión previa de este documento (evidencia histórica anterior a la ejecución)

Los comandos permanecen sin ejecutar contra producción. La función PowerShell se valida sintácticamente, no con claves reales. Las garantías de transacción, respaldo y recuperación proceden de las 19 pruebas locales y 7 nativas ya registradas; los gates M1–M4 y la promoción no están probados en producción. La pausa operativa del único propietario sustituye la exigencia de barrera global conforme a la sección 1; no elimina los riesgos residuales allí registrados.

Resultado de preparación: los cinco bloques PowerShell pasan el parser local sin ejecutarse; git diff --check correcto y archivos/dependencias de aplicación intactos. No se generaron llaves, no se creó el directorio del corte ni se ejecutó ningún comando de mantenimiento o recifrado. No se hizo commit, push ni despliegue.
