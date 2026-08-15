// Endpoint público para n8n/Zernio: genera una Presigned GET URL (1 h) del video del día.
// Sustituye a la Edge Function: en este stack la lógica HTTP externa vive en rutas de servidor.
// Auth: cabecera X-N8N-API-KEY (clave interna) O Bearer JWT de un usuario admin/editor.

import { createFileRoute } from "@tanstack/react-router";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-n8n-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  });
}

async function autorizado(request: Request): Promise<boolean> {
  const apiKey = request.headers.get("x-n8n-api-key");
  const esperada = process.env["N8N_INTERNAL_API_KEY"];

  if (apiKey && esperada && apiKey === esperada) {
    return true;
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const { createClient } = await import("@supabase/supabase-js");

  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

  const cliente = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },

    global: {
      fetch: (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const h = new Headers(init?.headers);

        h.set("apikey", key);
        h.set("Authorization", authHeader);

        return fetch(input, {
          ...init,
          headers: h,
        });
      },
    },
  });

  const { data, error } = await cliente.auth.getUser(
    authHeader.slice(7),
  );

  if (error || !data.user) {
    return false;
  }

  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  const { data: perfil } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  return (
    !!perfil &&
    ["admin", "editor"].includes(
      (perfil as { role: string }).role,
    )
  );
}

export const Route = createFileRoute(
  "/api/public/r2-download-url",
)({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response("ok", {
          headers: cors,
        }),

      POST: async ({ request }) => {
        // --------------------------------------------------
        // 1. AUTORIZACIÓN
        // --------------------------------------------------

        if (!(await autorizado(request))) {
          return json(
            {
              success: false,
              error: "No autorizado",
            },
            401,
          );
        }

        // --------------------------------------------------
        // 2. OBTENER FECHA
        // --------------------------------------------------
        //
        // Permitimos recibir:
        //
        // JSON:
        // {
        //   "fecha": "2026-08-01"
        // }
        //
        // O:
        //
        // /api/public/r2-download-url?fecha=2026-08-01
        //

        let body: { fecha?: string } = {};

        try {
          body = (await request.json()) as {
            fecha?: string;
          };
        } catch {
          // No detenemos la ejecución porque también
          // aceptamos fecha mediante query parameter.
        }

        const requestUrl = new URL(request.url);

        const fecha =
          body?.fecha?.trim() ||
          requestUrl.searchParams.get("fecha")?.trim();

        // --------------------------------------------------
        // 3. VALIDAR FECHA
        // --------------------------------------------------

        if (!fecha) {
          return json(
            {
              success: false,
              error: "Falta la fecha (AAAA-MM-DD)",
            },
            400,
          );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
          return json(
            {
              success: false,
              error: `Formato de fecha inválido: "${fecha}". Use AAAA-MM-DD`,
            },
            400,
          );
        }

        // --------------------------------------------------
        // 4. BUSCAR REGISTRO EN SUPABASE
        // --------------------------------------------------

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: registro, error } =
          await supabaseAdmin
            .from("contenido_diario")
            .select(
              `
                fecha,
                storage_provider,
                storage_key,
                storage_filename,
                storage_content_type,
                storage_size,
                estado,
                titulo,
                descripcion_base,
                reflexion,
                cita_evangelio
              `,
            )
            .eq("fecha", fecha)
            .maybeSingle();

        if (error) {
          console.error(
            "[r2-download-url] Error Supabase:",
            error,
          );

          return json(
            {
              success: false,
              error: "Error consultando contenido_diario",
              details: error.message,
            },
            500,
          );
        }

        if (!registro) {
          return json(
            {
              success: false,
              error: "No existe registro para esa fecha",
              fecha,
            },
            404,
          );
        }

        // --------------------------------------------------
        // 5. VALIDAR INFORMACIÓN DEL VIDEO
        // --------------------------------------------------

        const r = registro as Record<string, unknown>;

        if (
          r["storage_provider"] !== "cloudflare_r2" ||
          !r["storage_key"]
        ) {
          return json(
            {
              success: true,
              exists: false,
              downloadUrl: null,
              fecha: r["fecha"],
              error:
                "El registro no tiene un video almacenado en R2.",
            },
            200,
          );
        }

        // --------------------------------------------------
        // 6. COMPROBAR OBJETO EN CLOUDFLARE R2
        // --------------------------------------------------

        try {
          const {
            obtenerConfigR2,
            cabecerasObjeto,
            firmarUrl,
          } = await import("@/lib/r2.server");

          const cfg = await obtenerConfigR2();

          const key = r["storage_key"] as string;

          const meta = await cabecerasObjeto(cfg, key);

          // El registro existe en Supabase pero el archivo
          // físico no existe en R2.
          if (!meta) {
            return json(
              {
                success: true,
                exists: false,
                downloadUrl: null,
                fecha: r["fecha"],
                storageKey: key,
                error: "El video no existe en R2.",
              },
              200,
            );
          }

          // --------------------------------------------------
          // 7. GENERAR URL FIRMADA
          // --------------------------------------------------

          const expiresIn = 3600;

          const downloadUrl = firmarUrl(
            cfg,
            "GET",
            key,
            expiresIn,
          );

          // --------------------------------------------------
          // 8. RESPUESTA
          // --------------------------------------------------

          return json({
            success: true,

            exists: true,

            downloadUrl,

            expiresIn,

            filename: r["storage_filename"],

            fecha: r["fecha"],

            estado: r["estado"],

            titulo: r["titulo"],

            descripcion_base: r["descripcion_base"],

            reflexion: r["reflexion"],

            cita_evangelio: r["cita_evangelio"],

            object: {
              key,
              contentType: meta.contentType,
              size: meta.size,
            },
          });
        } catch (e) {
          console.error(
            "[r2-download-url] Error R2:",
            e,
          );

          return json(
            {
              success: false,
              error:
                e instanceof Error
                  ? e.message
                  : "Error desconocido procesando R2",
            },
            500,
          );
        }
      },
    },
  },
});