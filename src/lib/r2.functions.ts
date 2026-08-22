import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXPIRA_DESCARGA, EXPIRA_SUBIDA, TAMANO_MAXIMO_BYTES } from "@/lib/r2.constants";
import { derivarEstadoContenido } from "@/types/database";

async function exigirStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (error) throw new Error("No pudimos verificar tus permisos.");
  if (!data) throw new Error("Tu cuenta no tiene permisos para subir videos.");
}

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("No pudimos verificar tus permisos.");
  if (!data) throw new Error("Solo un administrador puede probar la conexión.");
}

/** Prueba de conexión: comprueba que el bucket configurado sea accesible. */
export const probarCredencialR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { obtenerConfigR2, comprobarBucket } = await import("@/lib/r2.server");
    const cfg = await obtenerConfigR2();
    await comprobarBucket(cfg);
    return { success: true, message: "Conexión con Cloudflare R2 correcta" };
  });

/** Paso 1: genera una URL firmada PUT para que el navegador suba directo a R2. */
export const crearUrlSubidaR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { fecha: string; filename: string; contentType: string; fileSize: number }) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error("Fecha inválida.");
      if (!input.filename?.trim()) throw new Error("Selecciona un archivo de video.");
      if (!input.contentType?.startsWith("video/"))
        throw new Error("El archivo debe ser un video.");
      if (!(input.fileSize > 0)) throw new Error("El archivo está vacío.");
      if (input.fileSize > TAMANO_MAXIMO_BYTES)
        throw new Error("El video supera el tamaño máximo permitido (5 GB).");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await exigirStaff(context);
    const { obtenerConfigR2, construirObjectKey, firmarUrl } = await import("@/lib/r2.server");
    const cfg = await obtenerConfigR2();
    const objectKey = construirObjectKey(data.fecha, data.filename);
    const uploadUrl = firmarUrl(cfg, "PUT", objectKey, EXPIRA_SUBIDA, {
      "content-type": data.contentType,
    });
    return {
      success: true as const,
      uploadUrl,
      objectKey,
      contentType: data.contentType,
      expiresIn: EXPIRA_SUBIDA,
    };
  });

/** Paso 2: verifica el objeto en R2 (HeadObject) y guarda el registro. */
export const confirmarSubidaR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fecha: string; objectKey: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error("Fecha inválida.");
    if (!input.objectKey?.startsWith("EvangelioDiario/")) throw new Error("Archivo no válido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await exigirStaff(context);
    const { obtenerConfigR2, cabecerasObjeto } = await import("@/lib/r2.server");
    const cfg = await obtenerConfigR2();
    const meta = await cabecerasObjeto(cfg, data.objectKey);
    if (!meta) throw new Error("El video se subió pero no pudo verificarse.");

    const { data: fila } = await context.supabase
      .from("contenido_diario")
      .select("reflexion")
      .eq("fecha", data.fecha)
      .maybeSingle();

    const estado = derivarEstadoContenido({
      reflexion: fila?.reflexion,
      storage_key: data.objectKey,
      fileid_pcloud: null,
      estadoActual: fila?.estado ?? null,
    });
    const nombre = data.objectKey.split("/").pop() ?? data.objectKey;

    const { error } = await context.supabase.from("contenido_diario").upsert(
      {
        fecha: data.fecha,
        storage_provider: "cloudflare_r2",
        storage_key: data.objectKey,
        storage_filename: nombre,
        storage_size: meta.size,
        storage_content_type: meta.contentType,
        storage_etag: meta.etag,
        storage_uploaded_at: new Date().toISOString(),
        estado,
        subido_por: context.userId,
        actualizado_por: context.userId,
      },
      { onConflict: "fecha" },
    );
    if (error) throw new Error("El video se subió pero no pudimos guardar el registro.");

    return {
      success: true as const,
      objectKey: data.objectKey,
      nombreArchivo: nombre,
      size: meta.size,
      contentType: meta.contentType,
      estado,
    };
  });

/** Preparado para la fase de publicación: URL temporal de descarga para n8n/Zernio. */
export const crearUrlDescargaR2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fecha: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error("Fecha inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await exigirStaff(context);
    const { data: fila, error: errFila } = await context.supabase
      .from("contenido_diario")
      .select("storage_key, storage_filename")
      .eq("fecha", data.fecha)
      .maybeSingle();
    if (errFila) throw new Error("No pudimos leer el registro del día.");
    if (!fila?.storage_key) throw new Error("Ese día no tiene video en el almacenamiento.");

    const { obtenerConfigR2, firmarUrl } = await import("@/lib/r2.server");
    const cfg = await obtenerConfigR2();
    return {
      success: true as const,
      downloadUrl: firmarUrl(cfg, "GET", fila.storage_key as string, EXPIRA_DESCARGA),
      objectKey: fila.storage_key as string,
      nombreArchivo: fila.storage_filename as string | null,
      expiresIn: EXPIRA_DESCARGA,
    };
  });
