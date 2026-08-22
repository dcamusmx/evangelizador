import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { derivarEstadoContenido } from "@/types/database";

async function exigirStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (error) throw new Error("No pudimos verificar tus permisos.");
  if (!data) throw new Error("Tu cuenta no tiene permisos para subir videos.");
}

/** Paso 1: el servidor crea un enlace de subida temporal en pCloud. */
export const solicitarEnlaceSubida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fecha: string; extension: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error("Fecha inválida.");
    if (!/^[a-z0-9]{2,5}$/i.test(input.extension)) throw new Error("Archivo no válido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await exigirStaff(context);
    const { obtenerConfigPcloud, asegurarCarpeta, crearEnlaceSubida } = await import(
      "@/lib/pcloud.server"
    );
    const cfg = await obtenerConfigPcloud();
    const folderid = await asegurarCarpeta(cfg);
    const nombreArchivo = `${data.fecha}.${data.extension.toLowerCase()}`;
    const { code, uploadlinkid } = await crearEnlaceSubida(
      cfg,
      folderid,
      `Evangelio ${data.fecha}`,
    );
    return {
      code,
      uploadlinkid,
      folderid,
      nombreArchivo,
      endpoint: `https://${cfg.host}/uploadtolink`,
    };
  });

/** Paso 3: el servidor confirma la subida, publica el enlace y guarda el registro. */
export const confirmarSubida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      fecha: string;
      folderid: number;
      uploadlinkid: number;
      nombreArchivo: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await exigirStaff(context);
    const { obtenerConfigPcloud, buscarArchivo, obtenerLinkPublico, borrarEnlaceSubida } =
      await import("@/lib/pcloud.server");
    const cfg = await obtenerConfigPcloud();

    await borrarEnlaceSubida(cfg, data.uploadlinkid);

    const archivo = await buscarArchivo(cfg, data.folderid, data.nombreArchivo);
    if (!archivo) throw new Error("No encontramos el archivo en el almacenamiento.");

    const link = await obtenerLinkPublico(cfg, archivo.fileid);

    const { data: fila } = await context.supabase
      .from("contenido_diario")
      .select("reflexion")
      .eq("fecha", data.fecha)
      .maybeSingle();

    const estado = derivarEstadoContenido({
      reflexion: fila?.reflexion,
      storage_key: null,
      fileid_pcloud: archivo.fileid,
      estadoActual: fila?.estado ?? null,
    });

    const { error } = await context.supabase.from("contenido_diario").upsert(
      {
        fecha: data.fecha,
        nombre_archivo_pcloud: archivo.name,
        fileid_pcloud: archivo.fileid,
        link_publico_pcloud: link,
        estado,
        subido_por: context.userId,
        actualizado_por: context.userId,
      },
      { onConflict: "fecha" },
    );
    if (error) throw new Error("El video se subió pero no pudimos guardar el registro.");

    return { fileid: archivo.fileid, link, nombreArchivo: archivo.name, estado };
  });
