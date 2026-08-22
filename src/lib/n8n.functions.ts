import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { estadoBloqueadoParaN8n, estadoPermitePublicacion } from "@/types/database";

async function exigirStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (error) throw new Error("No pudimos verificar tus permisos.");
  if (!data) throw new Error("Tu cuenta no tiene permisos para esta acción.");
}

export interface ResultadoGenerarMes {
  via: "n8n" | "local";
  creados: number;
  existentes: number;
  mensaje: string;
}

/**
 * n8n-generar-mes: envía {mes, anio} al webhook guardado en credenciales (n8n / WEBHOOK_GENERAR_MES).
 * Si no hay webhook configurado, crea localmente los días vacíos del mes.
 */
export const generarMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { anio: number; mes: number }) => {
    if (!Number.isInteger(input.anio) || input.anio < 2000 || input.anio > 2100)
      throw new Error("Año inválido.");
    if (!Number.isInteger(input.mes) || input.mes < 1 || input.mes > 12)
      throw new Error("Mes inválido.");
    return input;
  })
  .handler(async ({ data, context }): Promise<ResultadoGenerarMes> => {
    await exigirStaff(context);

    const mm = String(data.mes).padStart(2, "0");
    const diasEnMes = new Date(data.anio, data.mes, 0).getDate();
    const inicio = `${data.anio}-${mm}-01`;
    const fin = `${data.anio}-${mm}-${String(diasEnMes).padStart(2, "0")}`;

    const { obtenerConfigN8n, postN8n } = await import("@/lib/n8n.server");
    const cfg = await obtenerConfigN8n();

    const { data: previas, error: errorPrevias } = await context.supabase
      .from("contenido_diario")
      .select("fecha")
      .gte("fecha", inicio)
      .lte("fecha", fin);
    if (errorPrevias) throw new Error("No pudimos leer el mes actual.");
    const yaExisten = new Set((previas ?? []).map((f: { fecha: string }) => f.fecha));

    if (cfg) {
      const r = await postN8n(cfg, { mes: data.mes, anio: data.anio, inicio, fin });
      const resumen =
        r.data && typeof r.data === "object"
          ? ((r.data as Record<string, unknown>)["mensaje"] as string | undefined)
          : undefined;
      return {
        via: "n8n",
        creados: 0,
        existentes: yaExisten.size,
        mensaje:
          resumen ??
          (r.texto.trim()
            ? r.texto.slice(0, 300)
            : "Se envió la solicitud al flujo de Vatican News. Los días aparecerán conforme se procesen."),
      };
    }

    const nuevas = [];
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = `${data.anio}-${mm}-${String(d).padStart(2, "0")}`;
      if (yaExisten.has(fecha)) continue;
      nuevas.push({
        fecha,
        estado: "pendiente_reflexion" as const,
        actualizado_por: context.userId,
      });
    }

    if (nuevas.length) {
      const { error } = await context.supabase.from("contenido_diario").insert(nuevas);
      if (error) throw new Error("No pudimos crear los días del mes.");
    }

    return {
      via: "local",
      creados: nuevas.length,
      existentes: yaExisten.size,
      mensaje: nuevas.length
        ? `Se crearon ${nuevas.length} días listos para escribir la reflexión.`
        : "El mes ya estaba completo.",
    };
  });

/** n8n-publicar-manual: dispara la publicación de un día concreto. */
export const publicarManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fecha: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error("Fecha inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await exigirStaff(context);

    const { data: registro, error: errorRegistro } = await context.supabase
      .from("contenido_diario")
      .select("fecha, estado")
      .eq("fecha", data.fecha)
      .maybeSingle();

    if (errorRegistro) throw new Error("No pudimos verificar el estado del registro para publicar.");
    if (!registro) throw new Error("No existe un registro para esta fecha.");
    if (!estadoPermitePublicacion(registro.estado)) {
      throw new Error(
        "Este registro no está listo para publicar. Debe estar en estado 'listo_para_publicar'.",
      );
    }
    if (estadoBloqueadoParaN8n(registro.estado)) {
      throw new Error("Este registro ya está publicado o programado, y no se puede volver a publicar.");
    }

    const { obtenerWebhookPublicarManual, postN8n } = await import("@/lib/n8n.server");
    const cfg = await obtenerWebhookPublicarManual();
    if (!cfg)
      throw new Error(
        "Falta la URL del webhook de publicación manual (n8n / WEBHOOK_PUBLICAR_MANUAL).",
      );
    const r = await postN8n(cfg, { fecha: data.fecha });
    const mensaje =
      r.data && typeof r.data === "object"
        ? ((r.data as Record<string, unknown>)["mensaje"] as string | undefined)
        : undefined;
    return {
      success: true as const,
      mensaje: mensaje ?? (r.texto.trim() ? r.texto.slice(0, 300) : "Publicación enviada a n8n."),
    };
  });

export interface FilaCsv {
  fecha: string;
  santo_o_tiempo_liturgico?: string;
  cita_evangelio?: string;
  titulo?: string;
  descripcion_base?: string;
  reflexion?: string;
}

export interface ResultadoImportarCsv {
  success: true;
  insertadas: number;
  actualizadas: number;
  omitidas: { fila: number; motivo: string }[];
}

const CAMPOS_TEXTO = [
  "santo_o_tiempo_liturgico",
  "cita_evangelio",
  "titulo",
  "descripcion_base",
  "reflexion",
] as const;

function fechaValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const [y, m, d] = f.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d
  );
}

/** importar-csv-mes: alta/actualización masiva sin borrar datos existentes. */
export const importarCsvMes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: FilaCsv[] }) => {
    if (!Array.isArray(input?.rows) || input.rows.length === 0)
      throw new Error("El archivo no tiene filas.");
    if (input.rows.length > 400) throw new Error("El archivo tiene demasiadas filas.");
    return input;
  })
  .handler(async ({ data, context }): Promise<ResultadoImportarCsv> => {
    await exigirStaff(context);

    const omitidas: { fila: number; motivo: string }[] = [];
    const validas: { fila: number; row: FilaCsv }[] = [];

    data.rows.forEach((row, i) => {
      const numero = i + 2; // fila del CSV contando el encabezado
      const fecha = (row.fecha ?? "").trim();
      if (!fechaValida(fecha)) {
        omitidas.push({ fila: numero, motivo: `fecha inválida: ${fecha || "(vacía)"}` });
        return;
      }
      validas.push({ fila: numero, row: { ...row, fecha } });
    });

    // Fechas duplicadas dentro del mismo CSV: ninguna se procesa.
    const conteo = new Map<string, number>();
    validas.forEach((v) => conteo.set(v.row.fecha, (conteo.get(v.row.fecha) ?? 0) + 1));
    const aProcesar = validas.filter((v) => {
      if ((conteo.get(v.row.fecha) ?? 0) > 1) {
        omitidas.push({ fila: v.fila, motivo: `fecha duplicada en el CSV: ${v.row.fecha}` });
        return false;
      }
      return true;
    });

    let insertadas = 0;
    let actualizadas = 0;

    for (const { row } of aProcesar) {
      const cambios: Record<string, string> = {};
      for (const campo of CAMPOS_TEXTO) {
        const valor = (row[campo] ?? "").toString().trim();
        if (valor !== "") cambios[campo] = valor;
      }

      const { data: existente, error: errorLectura } = await context.supabase
        .from("contenido_diario")
        .select("fecha, reflexion, storage_key, fileid_pcloud, estado")
        .eq("fecha", row.fecha)
        .maybeSingle();
      if (errorLectura) throw new Error("No pudimos leer el contenido existente.");

      if (!existente) {
        const { error } = await context.supabase
          .from("contenido_diario")
          .insert({ fecha: row.fecha, ...cambios, actualizado_por: context.userId } as never);
        if (error) throw new Error("No pudimos insertar una fila del CSV.");
        insertadas++;
        continue;
      }

      const estadoActual = existente.estado as string;
      const payload: Record<string, unknown> = { ...cambios, actualizado_por: context.userId };

      if (estadoActual !== "programado" && estadoActual !== "publicado") {
        const reflexionFinal = (
          (cambios["reflexion"] as string | undefined) ??
          existente.reflexion ??
          ""
        )
          .toString()
          .trim();
        const tieneVideo = Boolean(existente.storage_key ?? existente.fileid_pcloud);
        payload["estado"] = !reflexionFinal
          ? "pendiente_reflexion"
          : tieneVideo
            ? "listo_para_publicar"
            : "pendiente_video";
      }

      const { error } = await context.supabase
        .from("contenido_diario")
        .update(payload as never)
        .eq("fecha", row.fecha);
      if (error) throw new Error("No pudimos actualizar una fila del CSV.");
      actualizadas++;
    }

    return { success: true, insertadas, actualizadas, omitidas };
  });
