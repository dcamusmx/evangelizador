// Endpoint público para n8n/Zernio: genera una Presigned GET URL (1 h) del video del día.
// Sustituye a la Edge Function: en este stack la lógica HTTP externa vive en rutas de servidor.
// Auth: cabecera X-N8N-API-KEY (clave interna) O Bearer JWT de un usuario admin/editor.
import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-n8n-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function autorizado(request: Request): Promise<boolean> {
  const apiKey = request.headers.get("x-n8n-api-key");
  const esperada = process.env["N8N_INTERNAL_API_KEY"];
  if (apiKey && esperada && apiKey === esperada) return true;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const cliente = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        h.set("Authorization", authHeader);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await cliente.auth.getUser(authHeader.slice(7));
  if (error || !data.user) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  return !!perfil && ["admin", "editor"].includes((perfil as { role: string }).role);
}

export const Route = createFileRoute("/api/public/r2-download-url")({
  server: {
    handlers: {
      OPTIONS: () => new Response("ok", { headers: cors }),
      POST: async ({ request }) => {
        if (!(await autorizado(request))) return json({ success: false, error: "No autorizado" }, 401);

        const body = (await request.json().catch(() => ({}))) as { fecha?: string };
        const fecha = body.fecha;
        if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          return json({ success: false, error: "Falta la fecha (AAAA-MM-DD)" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: registro, error } = await supabaseAdmin
          .from("contenido_diario")
          .select(
            "fecha, storage_provider, storage_key, storage_filename, storage_content_type, storage_size, estado, titulo, descripcion_base, reflexion, cita_evangelio",
          )
          .eq("fecha", fecha)
          .maybeSingle();

        if (error || !registro) {
          return json({ success: false, error: "No existe registro para esa fecha" }, 404);
        }
        const r = registro as Record<string, unknown>;
        if (r["storage_provider"] !== "cloudflare_r2" || !r["storage_key"]) {
          return json({ success: false, error: "El registro no tiene un video almacenado." }, 400);
        }

        try {
          const { obtenerConfigR2, cabecerasObjeto, firmarUrl } = await import("@/lib/r2.server");
          const cfg = await obtenerConfigR2();
          const key = r["storage_key"] as string;
          const meta = await cabecerasObjeto(cfg, key);
          if (!meta) return json({ success: false, error: "El video no existe en R2." }, 404);

          const expiresIn = 3600;
          return json({
            success: true,
            downloadUrl: firmarUrl(cfg, "GET", key, expiresIn),
            expiresIn,
            filename: r["storage_filename"],
            fecha: r["fecha"],
            estado: r["estado"],
            titulo: r["titulo"],
            descripcion_base: r["descripcion_base"],
            reflexion: r["reflexion"],
            cita_evangelio: r["cita_evangelio"],
            object: { key, contentType: meta.contentType, size: meta.size },
          });
        } catch (e) {
          return json({ success: false, error: (e as Error).message }, 500);
        }
      },
    },
  },
});
