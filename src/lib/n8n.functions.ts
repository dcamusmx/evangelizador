import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function exigirStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (error) throw new Error("No pudimos verificar tus permisos.");
  if (!data) throw new Error("Tu cuenta no tiene permisos para generar el mes.");
}

export interface ResultadoGenerarMes {
  via: "n8n" | "local";
  creados: number;
  existentes: number;
  mensaje: string;
}

/**
 * Genera los días del mes. Si hay un webhook de n8n configurado se delega en él;
 * si no, se crean localmente los días vacíos para poder escribir las reflexiones.
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

    const { obtenerConfigN8n, llamarGenerarMes } = await import("@/lib/n8n.server");
    const cfg = await obtenerConfigN8n();

    const { data: previas, error: errorPrevias } = await context.supabase
      .from("contenido_diario")
      .select("fecha")
      .gte("fecha", inicio)
      .lte("fecha", fin);
    if (errorPrevias) throw new Error("No pudimos leer el mes actual.");
    const yaExisten = new Set((previas ?? []).map((f: { fecha: string }) => f.fecha));

    if (cfg) {
      await llamarGenerarMes(cfg, { anio: data.anio, mes: data.mes, inicio, fin });
      return {
        via: "n8n",
        creados: 0,
        existentes: yaExisten.size,
        mensaje:
          "Se envió la solicitud al flujo externo. Los días aparecerán conforme se procesen.",
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
