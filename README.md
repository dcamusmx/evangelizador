# Evangelio Diario Padre Hedi

PROMPT MAESTRO — EVANGELIO DIARIO

Quiero que desarrolles una webapp completa llamada Evangelio Diario.

Trabaja como arquitecto de software senior y desarrollador full-stack especializado en:

Vite

React

TypeScript

Tailwind CSS

Supabase

PostgreSQL

Supabase Auth

Supabase Row Level Security (RLS)

Supabase Edge Functions

react-router-dom

Integración con APIs REST

Aplicaciones responsive

Seguridad frontend/backend

1. Objetivo del proyecto

La aplicación servirá para gestionar la publicación diaria del Evangelio narrado y reflexionado por el:

Pbro. Hedilberto Pérez Vicente

El sistema permitirá:

Autenticar sacerdotes, editores y administradores.

Generar el calendario mensual de Evangelios.

Consultar los Evangelios registrados.

Escribir y modificar la reflexión de cada día.

Subir el video correspondiente al Evangelio.

Guardar los videos en pCloud.

Consultar el estado de publicación.

Mostrar el enlace final de YouTube.

Administrar usuarios y roles.

Integrarse con workflows externos de n8n.

IMPORTANTE:

La aplicación que estás construyendo es la webapp de gestión.

La automatización de scraping y publicación se realizará externamente mediante n8n, que ya existe como instancia self-hosted en Docker sobre AWS EC2.

2. ARQUITECTURA OBLIGATORIA

Utiliza exactamente esta arquitectura:

Frontend:

Vite

React

TypeScript

Tailwind CSS

react-router-dom

Supabase JS

Backend / servicios:

Supabase PostgreSQL

Supabase Auth

Supabase RLS

Supabase Edge Functions en Deno

Servicios externos:

pCloud: almacenamiento de videos

n8n: automatización y orquestación

Zernio: publicación/programación de videos en YouTube

Telegram: notificaciones de los workflows

Vatican News: fuente de información del Evangelio

La aplicación debe ser una SPA.

NO crear un backend Node.js adicional.

NO utilizar Next.js.

NO utilizar API Routes de Next.js.

3. PRINCIPIO DE ARQUITECTURA MÁS IMPORTANTE

Los videos NUNCA deben atravesar:

Supabase Edge Functions

servidores propios

n8n como archivo binario

El flujo obligatorio es:

Navegador
→ obtiene URL temporal de subida
→ sube directamente a pCloud

Posteriormente:

pCloud
→ URL pública/directa
→ Zernio
→ YouTube

Las Edge Functions solamente deben manejar:

autenticación/autorización

secretos

metadata

llamadas pequeñas a APIs

generación de links

Nunca transportar el archivo de video.

4. SEGURIDAD

Esta sección es CRÍTICA.

Nunca coloques en el frontend:

PCLOUD_AUTH_TOKEN

claves privadas

service_role de Supabase

webhook privado de n8n

tokens de Telegram

API keys de Zernio

En el frontend solamente pueden existir:

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

Los secretos deben vivir exclusivamente en:

Supabase Secrets

y utilizarse dentro de:

Supabase Edge Functions.

El control real de acceso debe realizarse mediante:

Supabase RLS.

Verificación del JWT.

Verificación del rol dentro de las Edge Functions.

ProtectedRoute solamente debe considerarse una protección de interfaz, NO una medida de seguridad.

5. AUTENTICACIÓN

Utilizar Supabase Auth.

Implementar:

Magic Link

Inicio de sesión mediante correo electrónico.

Google OAuth

Inicio de sesión con Google.

Crear:

src/lib/supabase.ts

src/lib/useAuth.tsx

src/routes/ProtectedRoute.tsx

src/routes/DashboardLayout.tsx

El AuthProvider debe mantener globalmente:

session

user

profile

loading

Al iniciar sesión consultar:

profiles

para conocer el rol del usuario.

6. ROLES

Existen tres roles:

admin

editor

pendiente

Reglas:

pendiente

Usuario recién registrado.

No debe acceder al contenido de la aplicación.

Después de iniciar sesión mostrar:

"Tu cuenta está pendiente de aprobación por un administrador."

editor

Puede:

consultar contenido diario

modificar reflexiones

subir videos

generar meses

consultar publicaciones

No puede administrar usuarios.

admin

Tiene todos los permisos del editor y además:

consultar usuarios

aprobar usuarios

cambiar roles

7. BASE DE DATOS

Utiliza Supabase PostgreSQL.

Crear enum o mecanismo equivalente para:

role:

admin
editor
pendiente

Crear tabla:

profiles

Campos:

id uuid primary key

email text

nombre text

role admin/editor/pendiente

created_at timestamptz

El id debe corresponder con:

auth.users.id

Los nuevos usuarios deben comenzar automáticamente con:

role = pendiente

Crear tabla:

contenido_diario

Campos:

fecha date PRIMARY KEY

santo_o_tiempo_liturgico text

cita_evangelio text

titulo text

descripcion_base text

reflexion text nullable

nombre_archivo_pcloud text nullable

fileid_pcloud bigint nullable

link_publico_pcloud text nullable

link_youtube text nullable

estado

subido_por uuid

actualizado_por uuid

created_at timestamptz

updated_at timestamptz

Estados válidos:

pendiente_reflexion

pendiente_video

listo_para_publicar

programado

publicado

error

8. ROW LEVEL SECURITY

Implementar RLS cuidadosamente.

profiles:

Usuario:

puede consultar su propio profile

Admin:

puede consultar todos

puede modificar roles

contenido_diario:

admin/editor:

SELECT

INSERT

UPDATE

pendiente:

ningún acceso al contenido

Las políticas de seguridad deben depender del role almacenado en profiles.

No dependas exclusivamente del frontend.

9. RUTAS DE LA APLICACIÓN

Utilizar react-router-dom.

Crear:

/login

/auth/callback

/

/subir

/mantenimiento

/admin/usuarios

10. DASHBOARD

Crear un DashboardLayout profesional.

Debe incluir navegación:

Inicio

Subir video

Mantenimiento

Usuarios

Cerrar sesión

"Usuarios" solamente debe aparecer cuando:

role === admin

Desktop:

sidebar lateral.

Mobile:

menú responsive.

Mostrar en el encabezado:

nombre del usuario

correo

rol

Diseño limpio, moderno y administrativo.

11. PANTALLA LOGIN

Ruta:

/login

Diseño profesional y sencillo.

Mostrar:

EVANGELIO DIARIO

"Gestión de publicaciones"

Botones:

"Continuar con Google"

"Enviar enlace de acceso"

Campo:

Correo electrónico

Manejar:

loading

errores

confirmación del Magic Link

12. AUTH CALLBACK

Ruta:

/auth/callback

Esperar que Supabase resuelva la sesión.

Mostrar temporalmente:

"Iniciando sesión..."

Después:

si usuario autorizado
→ /

si pendiente
→ pantalla de espera

13. LISTADO PRINCIPAL

Ruta:

/

Consultar:

contenido_diario

Orden:

fecha descendente o con los días más próximos claramente visibles.

Mostrar una tabla responsive.

Columnas:

Fecha

Evangelio

Estado reflexión

Estado video

Estado publicación

YouTube

Acciones

Mostrar:

santo_o_tiempo_liturgico

cita_evangelio

Usar badges visuales para estados.

Ejemplo:

pendiente_reflexion → Pendiente reflexión

pendiente_video → Pendiente video

listo_para_publicar → Listo

programado → Programado

publicado → Publicado

error → Error

Si existe link_youtube mostrar:

"Ver en YouTube"

abriendo una pestaña nueva.

Agregar:

filtro por mes

filtro por año

filtro por estado

búsqueda

estados vacíos

skeleton/loading

14. MANTENIMIENTO

Ruta:

/mantenimiento

Objetivo:

Generar los registros de un mes.

Editar reflexiones.

Parte superior:

Selector Año

Selector Mes

Botón:

"Generar mes"

Al presionarlo:

invocar Supabase Edge Function:

generar-mes

mediante:

supabase.functions.invoke("generar-mes")

Enviar:

{
mes,
anio
}

La Edge Function llamará internamente a un webhook de n8n.

El webhook NUNCA debe estar almacenado en el frontend.

Debe existir como secreto:

N8N_WEBHOOK_GENERAR_MES

Mostrar:

loading

éxito

error

resultado recibido

Después actualizar el listado.

15. EDICIÓN DE REFLEXIONES

En /mantenimiento mostrar los días del mes seleccionado.

Para cada día mostrar:

Fecha

Santo o tiempo litúrgico

Cita del Evangelio

Reflexión

La reflexión debe poder editarse mediante:

textarea

Botón:

Guardar

El guardado puede hacerse directamente desde React a Supabase:

contenido_diario.update()

porque estará protegido mediante RLS.

Registrar:

actualizado_por

updated_at

Mostrar feedback:

"Reflexión guardada correctamente."

No guardar automáticamente en cada pulsación.

16. SUBIR VIDEO

Ruta:

/subir

Formulario:

Fecha

Archivo de video

Mostrar información del registro seleccionado:

Fecha

Santo / tiempo litúrgico

Cita

Título

Estado actual

Permitir formatos normales de video, especialmente:

.mp4

Implementar drag & drop si resulta conveniente.

Mostrar:

nombre del archivo

tamaño

barra de progreso

estado de subida

17. FLUJO PCLOUD

Este flujo debe respetarse estrictamente.

PASO 1

Frontend llama:

supabase.functions.invoke(
"pcloud-create-upload-link"
)

enviando:

fecha

nombre del archivo

tamaño si es necesario

PASO 2

La Edge Function:

valida usuario

comprueba admin/editor

utiliza PCLOUD_AUTH_TOKEN

crea directorio si no existe

Ruta:

/EvangelioDiario/{año}/{mes}/

Utilizar API de pCloud:

createfolderifnotexists

Después:

createuploadlink

El link temporal debe:

expirar aproximadamente en 2 horas

limitar el tamaño si la API lo permite

La Edge Function devuelve al navegador la información necesaria para subir.

PASO 3

El navegador sube directamente a pCloud mediante:

uploadtolink

IMPORTANTE:

el archivo NO debe pasar por Supabase.

Implementar progreso real de subida.

Puede utilizarse XMLHttpRequest si es necesario para obtener:

upload.onprogress

PASO 4

Después de una subida exitosa llamar:

pcloud-confirm-upload

La Edge Function:

valida usuario

consulta pCloud

ejecuta listfolder

confirma que el archivo existe

recupera fileid

actualiza contenido_diario

Guardar:

nombre_archivo_pcloud

fileid_pcloud

subido_por

actualizado_por

updated_at

Cambiar el estado de acuerdo con la información existente.

Si existe reflexión y video:

listo_para_publicar

Si falta reflexión:

pendiente_reflexion

Si falta video:

pendiente_video

18. EDGE FUNCTION generar-mes

Crear:

supabase/functions/generar-mes/index.ts

Debe:

validar JWT

consultar profile

permitir admin/editor

leer:

N8N_WEBHOOK_GENERAR_MES

desde Deno.env
5. llamar al webhook mediante POST
6. enviar:

{
mes,
anio
}

devolver la respuesta de n8n al frontend

Nunca retornar el webhook secreto.

Añadir manejo robusto de errores.

19. EDGE FUNCTION pcloud-create-upload-link

Crear:

supabase/functions/pcloud-create-upload-link/index.ts

Debe:

validar JWT

verificar admin/editor

leer PCLOUD_AUTH_TOKEN de Supabase Secrets

crear la carpeta del año/mes

crear upload link temporal

retornar solamente los datos necesarios para realizar la subida

Nunca retornar PCLOUD_AUTH_TOKEN.

20. EDGE FUNCTION pcloud-confirm-upload

Crear:

supabase/functions/pcloud-confirm-upload/index.ts

Debe:

validar JWT

verificar admin/editor

consultar pCloud listfolder

localizar el archivo subido

recuperar fileid

actualizar contenido_diario

retornar resultado

No descargar el video.

21. ADMINISTRACIÓN DE USUARIOS

Ruta:

/admin/usuarios

Exclusivamente admin.

Consultar profiles.

Mostrar tabla:

Nombre

Correo

Rol

Fecha de registro

Acciones

Permitir cambiar:

pendiente → editor

pendiente → admin

editor → admin

admin → editor

Antes de modificar un rol mostrar confirmación.

Impedir, si es razonable, que el último administrador del sistema se quite a sí mismo los permisos de admin.

Mostrar claramente usuarios:

Pendientes

Editores

Administradores

22. N8N

NO necesitas construir los workflows de n8n dentro de React.

Sin embargo, diseña la aplicación considerando estos tres workflows externos.

WF1 — Generar mes

Webhook iniciado desde:

Edge Function generar-mes

Flujo externo:

Webhook
→ generar fechas
→ consultar Vatican News
→ extraer información
→ insertar/upsert en contenido_diario

Crea:

titulo:

Evangelio del día - {fecha larga} - Pbro. Hedilberto Pérez Vicente

descripcion_base:

{fecha larga}
{santo_o_tiempo_liturgico}
Evangelio ({cita_evangelio})

Estado inicial:

pendiente_reflexion

WF2 — Publicación diaria

n8n ejecutará diariamente:

consulta registro de hoy

→ comprueba reflexión

→ comprueba video

→ obtiene public link de pCloud

→ obtiene URL directa del video

→ construye descripción

→ Zernio

→ YouTube

→ actualiza estado a programado

La aplicación únicamente debe reflejar esos cambios desde Supabase.

WF3 — Confirmación Zernio

Webhook externo recibe:

post.published

o:

post.failed

Éxito:

estado = publicado

link_youtube = URL resultante

Error:

estado = error

La webapp mostrará automáticamente estos estados al volver a consultar Supabase.

23. EXPERIENCIA DE USUARIO

Quiero una aplicación profesional pero sencilla de utilizar.

Usuarios principales:

sacerdote

asistentes

administrador

No debe parecer una herramienta para desarrolladores.

Priorizar:

claridad

botones grandes

textos legibles

indicadores visuales

pocos pasos

buena experiencia móvil

mensajes de confirmación claros

Idioma completo:

ESPAÑOL.

24. DISEÑO VISUAL

Crear una identidad visual sobria relacionada con una aplicación religiosa institucional, pero moderna.

Evitar:

exceso de ornamentos

estilos anticuados

interfaces excesivamente oscuras

colores saturados

Preferir:

fondos claros

blanco

gris muy claro

tonos azul/gris elegantes

acentos dorados muy discretos si funcionan visualmente

tarjetas suaves

bordes sutiles

tipografía muy legible

Debe funcionar perfectamente en:

desktop

tablet

smartphone

25. COMPONENTES REUTILIZABLES

Crear componentes cuando tenga sentido.

Por ejemplo:

StatusBadge

LoadingSpinner

PageHeader

ConfirmDialog

EmptyState

VideoUploader

MonthSelector

ReflectionEditor

UserRoleBadge

No sobrearquitecturar.

26. MANEJO DE ESTADOS

Todas las operaciones asincrónicas deben gestionar:

loading

success

error

Mostrar mensajes humanos.

Evitar mostrar errores técnicos crudos al usuario.

Los detalles técnicos pueden enviarse a:

console.error

durante desarrollo.

27. TIPADO

Utilizar TypeScript correctamente.

Crear tipos para:

Profile

ContenidoDiario

UserRole

EstadoContenido

No recurrir indiscriminadamente a:

any

28. VARIABLES DE ENTORNO

Frontend:

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

Supabase Secrets:

PCLOUD_AUTH_TOKEN

N8N_WEBHOOK_GENERAR_MES

No crear variables VITE_ para secretos.

29. MIGRACIONES

Genera las migraciones SQL necesarias para:

enums

profiles

contenido_diario

indexes

triggers updated_at

creación automática de profile cuando se registra auth.users

RLS

policies

La creación automática del profile debe asignar inicialmente:

role = pendiente

IMPORTANTE:

las policies deben evitar recursión infinita al consultar profiles.

Implementa una estrategia segura para resolver el rol, por ejemplo mediante una función PostgreSQL SECURITY DEFINER apropiadamente restringida si resulta necesario.

30. VERIFICACIÓN DE ROL EN EDGE FUNCTIONS

No confíes en que porque el usuario ve una pantalla tiene autorización.

Cada Edge Function protegida debe:

leer Authorization Bearer token

obtener el usuario autenticado

consultar su role

permitir únicamente:

admin/editor

según corresponda

retornar 401/403 si no tiene permiso

31. CORS

Las Supabase Edge Functions deben manejar correctamente:

OPTIONS

y los headers CORS necesarios para que la SPA pueda invocarlas.

No utilizar "*" indiscriminadamente para configuraciones de producción si podemos limitar el origen posteriormente.

Diseña la implementación para que pueda configurarse el dominio permitido.

32. COSAS QUE NO DEBES INVENTAR

Hay algunos detalles que todavía deben probarse contra las APIs reales.

NO inventes comportamiento ni parámetros si no están confirmados.

En particular:

pCloud

Debe verificarse en vivo que:

uploadtolink

permita la subida directa desde navegador sin problemas de CORS/Referrer.

Zernio

El parámetro exacto:

Scheduled Date

se configura externamente en n8n.

No necesitas implementarlo en esta webapp.

Vatican News

El CSS selector exacto para extraer los datos se configurará directamente en n8n.

No necesitas implementar el scraping desde React.

Cuando alguno de estos puntos interfiera con la implementación, márcalo explícitamente:

"REQUIERE PRUEBA EN VIVO"

en lugar de inventar una solución.

33. NO IMPLEMENTAR

No implementar en el frontend:

scraping de Vatican News

APIs de Zernio

Telegram

publicación directa a YouTube

secretos de pCloud

webhook privado de n8n

service_role de Supabase

Todo eso pertenece a servicios externos o Edge Functions.

34. ESTRUCTURA PROPUESTA

Mantén una estructura similar a:

src/
components/
lib/
supabase.ts
useAuth.tsx
pages/
Login.tsx
Dashboard.tsx
SubirVideo.tsx
Mantenimiento.tsx
AdminUsuarios.tsx
routes/
ProtectedRoute.tsx
DashboardLayout.tsx
types/
database.ts
App.tsx
main.tsx

supabase/
migrations/
functions/
generar-mes/
index.ts
pcloud-create-upload-link/
index.ts
pcloud-confirm-upload/
index.ts

Puedes mejorar esta organización si existe una justificación clara, pero mantén el proyecto sencillo.

35. ORDEN DE IMPLEMENTACIÓN

No intentes desarrollar todo sin estructura.

Trabaja en este orden:

FASE 1

Analizar arquitectura y preparar modelo de datos.

FASE 2

Crear migraciones Supabase:

tablas

enums

triggers

profiles

RLS

policies

FASE 3

Configurar:

Supabase client

AuthProvider

ProtectedRoute

login

callback

FASE 4

Crear:

DashboardLayout

navegación

listado principal

FASE 5

Crear:

mantenimiento

selector mes/año

editor de reflexiones

FASE 6

Crear:

Edge Function generar-mes

y conectar botón.

FASE 7

Crear:

pantalla subir video

Edge Function pcloud-create-upload-link

Edge Function pcloud-confirm-upload

flujo directo navegador → pCloud

FASE 8

Crear:

administración de usuarios

FASE 9

Revisión completa de:

seguridad

RLS

responsive

manejo de errores

loading states

TypeScript

permisos

secretos

36. FORMA DE TRABAJAR CONMIGO

Esto es importante.

Estás desarrollando el proyecto mediante el chat de Lovable.

No me entregues únicamente explicaciones conceptuales.

Quiero que MODIFIQUES Y CONSTRUYAS realmente el proyecto.

En cada fase:

analiza el estado actual del proyecto

identifica los archivos que deben modificarse

implementa los cambios

comprueba errores de TypeScript/build

corrige los errores encontrados

indícame brevemente qué quedó terminado

indícame qué configuración externa necesito realizar, si existe

No elimines funcionalidades existentes que ya funcionen.

No cambies arquitectura sin explicarlo.

Si falta una credencial o secreto:

NO lo inventes.

Implementa el código utilizando la variable correspondiente y dime exactamente dónde configurarla.

Si falta información externa que podamos configurar después, deja la aplicación preparada para incorporarla.

37. CRITERIO DE TERMINACIÓN

Consideraremos terminada la webapp cuando exista este recorrido funcional:

Usuario entra a la web.

Inicia sesión.

Supabase determina su profile.

Usuario pendiente recibe pantalla de espera.

Editor/admin entra al dashboard.

Puede consultar contenido diario.

Puede seleccionar mes.

Puede generar el mes mediante la Edge Function/n8n.

Puede escribir una reflexión.

Puede guardar la reflexión.

Puede seleccionar un video.

Obtiene un upload link temporal.

El navegador sube el video directamente a pCloud.

La aplicación confirma la subida.

Supabase guarda el fileid.

El dashboard muestra el estado actualizado.

Cuando n8n/Zernio actualicen el registro, se muestra Programado/Publicado.

El enlace de YouTube aparece cuando exista.

El admin puede aprobar usuarios.

38. PRIMERA TAREA

Comienza ahora.

Primero:

inspecciona el proyecto existente

determina qué partes ya están creadas

NO sobrescribas innecesariamente código funcional

prepara o corrige el esquema de Supabase y las políticas RLS

prepara la autenticación y estructura base de rutas

después construye el dashboard

Si Lovable ya encuentra algunas partes implementadas, reutilízalas y continúa desde el estado real del proyecto.

Antes de avanzar hacia pCloud, asegúrate de que:

login + perfiles + roles + RLS + dashboard

funcionen correctamente.

Empieza implementando esta primera etapa.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://evangeliodiario.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c53d4977-5297-47e0-ac34-9554c6bf04df).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
