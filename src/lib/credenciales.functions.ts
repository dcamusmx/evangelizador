import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CredencialResumen {
  id: string;
  servicio: string;
  nombre: string;
  descripcion: string | null;
  pista: string | null;
  activo: boolean;
  updated_at: string;
}

async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("No pudimos verificar tus permisos.");
  if (!data) throw new Error("Solo un administrador puede gestionar credenciales.");
}

export const listarCredenciales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CredencialResumen[]> => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("credenciales")
      .select("id, servicio, nombre, descripcion, pista, activo, updated_at")
      .order("servicio")
      .order("nombre");
    if (error) throw new Error("No se pudieron cargar las credenciales.");
    return (data ?? []) as CredencialResumen[];
  });

export const guardarCredencial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      servicio: string;
      nombre: string;
      descripcion?: string;
      valor: string;
      activo?: boolean;
    }) => {
      const servicio = input.servicio.trim().toLowerCase();
      const nombre = input.nombre.trim().toUpperCase();
      const valor = input.valor.trim();
      if (!/^[a-z0-9_-]{2,40}$/.test(servicio)) throw new Error("Servicio inválido.");
      if (!/^[A-Z0-9_]{2,60}$/.test(nombre))
        throw new Error("El nombre solo admite letras, números y guion bajo.");
      if (!valor) throw new Error("El valor no puede estar vacío.");
      if (valor.length > 5000) throw new Error("El valor es demasiado largo.");
      return {
        servicio,
        nombre,
        descripcion: input.descripcion?.trim() || null,
        valor,
        activo: input.activo ?? true,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { cifrar, pistaDe } = await import("@/lib/credenciales.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("credenciales").upsert(
      {
        servicio: data.servicio,
        nombre: data.nombre,
        descripcion: data.descripcion,
        valor_cifrado: cifrar(data.valor),
        pista: pistaDe(data.valor),
        activo: data.activo,
        actualizado_por: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "servicio,nombre" },
    );
    if (error) throw new Error("No se pudo guardar la credencial.");
    return { ok: true };
  });

export const cambiarEstadoCredencial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; activo: boolean }) => input)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("credenciales")
      .update({ activo: data.activo, actualizado_por: context.userId })
      .eq("id", data.id);
    if (error) throw new Error("No se pudo actualizar la credencial.");
    return { ok: true };
  });

export const eliminarCredencial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("credenciales").delete().eq("id", data.id);
    if (error) throw new Error("No se pudo eliminar la credencial.");
    return { ok: true };
  });

/** Prueba rápida: verifica que la credencial de pCloud responda. */
export const probarCredencialPcloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context);
    const { obtenerConfigPcloud } = await import("@/lib/pcloud.server");
    const cfg = await obtenerConfigPcloud();
    const res = await fetch(`https://${cfg.host}/userinfo?auth=${encodeURIComponent(cfg.token)}`);
    const json = (await res.json()) as { result: number; email?: string; error?: string };
    if (json.result !== 0) throw new Error(json.error ?? `pCloud error ${json.result}`);
    return { email: json.email ?? "cuenta verificada" };
  });
