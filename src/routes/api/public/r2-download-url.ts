// Endpoint público para n8n/Zernio: version 16-08-26 con node code
// genera una Presigned GET URL (1 h) del video del día.
//
// Auth:
// - X-N8N-API-KEY para llamadas internas desde n8n
// - Bearer JWT para usuarios admin/editor
//
// Fecha:
// - Preferida: ?fecha=AAAA-MM-DD
// - Alternativa: JSON body { "fecha": "AAAA-MM-DD" }

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
  // --------------------------------------------------
  // 1. API KEY INTERNA DE N8N
  // --------------------------------------------------

  const apiKey = request.headers.get("x-n8n-api-key");
  const esperada = process.env["N8N_INTERNAL_API_KEY"];

  if (apiKey && esperada && apiKey === esperada) {
    return true;
  }

  // --------------------------------------------------
  // 2. BEARER JWT
  // --------------------------------------------------

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
        const headers = new Headers(init?.headers);

        headers.set("apikey", key);
        headers.set("Authorization", authHeader);

        return fetch(input, {
          ...init,
          headers,
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
        // ==================================================
        // 1. AUTORIZACIÓN
        // ==================================================

        if (!(await autorizado(request))) {
          return json(
            {
              success: false,
              error: "No autorizado",
            },
            401,
          );
        }

        // ==================================================
        // 2. OBTENER FECHA
        // ==================================================
        //
        // Prioridad:
        //
        // 1. Query parameter:
        //    ?fecha=2026-08-01
        //
        // 2. JSON body:
        //    { "fecha": "2026-08-01" }
        //

        const requestUrl = new URL(request.url);

        const fechaQuery =
          requestUrl.searchParams.get("fecha")?.trim();

        let fechaBody: string | undefined;

        // Solo intentamos leer body si no vino fecha por query.
        if (!fechaQuery) {
          try {
            const body = (await request.json()) as {
              fecha?: unknown;
            };

            if (typeof body?.fecha === "string") {
              fechaBody = body.fecha.trim();
            }
          } catch {
            // Body opcional.
            // No es error si la fecha llegó por query parameter.
          }
        }

        const fecha = fechaQuery || fechaBody;

        // ==================================================
        // 3. VALIDAR FECHA
        // ==================================================

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

        // ==================================================
        // 4. CONSULTAR CONTENIDO_DIARIO
        // ==================================================

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
            "[r2-download-url] Error consultando Supabase:",
            error,
          );

          return json(
            {
              success: false,
              error: "Error consultando contenido_diario",
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

        const r = registro as Record<string, unknown>;

        // ==================================================
        // 5. ¿EL REGISTRO TIENE VIDEO R2?
        // ==================================================

        if (
          r["storage_provider"] !== "cloudflare_r2" ||
          !r["storage_key"]
        ) {
          return json({
            success: true,
            exists: false,
            downloadUrl: null,

            fecha: r["fecha"],
            estado: r["estado"],

            reason: "no_storage",

            message:
              "El registro no tiene un video almacenado en R2.",
          });
        }

        // ==================================================
        // 6. COMPROBAR ARCHIVO EN R2
        // ==================================================

        try {
          const {
            obtenerConfigR2,
            cabecerasObjeto,
            firmarUrl,
          } = await import("@/lib/r2.server");

          const cfg = await obtenerConfigR2();

          const key = r["storage_key"] as string;

          const meta = await cabecerasObjeto(cfg, key);

          // Registro en Supabase existe pero archivo físico no.
          if (!meta) {
            return json({
              success: true,
              exists: false,
              downloadUrl: null,

              fecha: r["fecha"],
              estado: r["estado"],

              reason: "object_not_found",

              storageKey: key,

              message:
                "El registro existe, pero el video no existe físicamente en R2.",
            });
          }

          // ==================================================
          // 7. GENERAR PRESIGNED GET URL
          // ==================================================

          const expiresIn = 3600;

          const downloadUrl = firmarUrl(
            cfg,
            "GET",
            key,
            expiresIn,
          );

          // ==================================================
          // 8. RESPUESTA EXITOSA
          // ==================================================

          return json({
            success: true,
            exists: true,

            downloadUrl,
            expiresIn,

            fecha: r["fecha"],

            filename: r["storage_filename"],

            estado: r["estado"],

            titulo: r["titulo"],

            descripcion_base: r["descripcion_base"],

            reflexion: r["reflexion"],

            cita_evangelio: r["cita_evangelio"],

            object: {
              key,

              contentType:
                meta.contentType ||
                r["storage_content_type"],

              size:
                meta.size ||
                r["storage_size"],
            },
          });
        } catch (error) {
          console.error(
            "[r2-download-url] Error procesando R2:",
            error,
          );

          return json(
            {
              success: false,

              error:
                error instanceof Error
                  ? error.message
                  : "Error desconocido procesando R2",
            },
            500,
          );
        }
      },
    },
  },
});