// Endpoint público: recibe el webhook de Zernio y lo reenvía al webhook de n8n
// autoalojado, que no puede recibir llamadas directas de Zernio por políticas de dominio.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

const DESTINO_DEFAULT = "http://3.144.148.129/webhook/links";

// Headers que no deben reenviarse tal cual: el runtime/fetch los recalcula.
const HEADERS_EXCLUIDOS = new Set([
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
]);

function compararSeguro(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Zernio firma el body crudo con hex HMAC-SHA256 usando el Secret Key del webhook
// (https://docs.zernio.com/webhooks#signature-verification).
function firmaValida(cuerpoRaw: Buffer, firmaRecibida: string, secreto: string): boolean {
  const esperada = createHmac("sha256", secreto).update(cuerpoRaw).digest("hex");
  return compararSeguro(firmaRecibida.trim().toLowerCase(), esperada);
}

async function reenviar(request: Request): Promise<Response> {
  const cuerpoRaw =
    request.method === "GET" || request.method === "HEAD"
      ? Buffer.alloc(0)
      : Buffer.from(await request.arrayBuffer());

  // Si hay Secret Key configurada, exigir la firma X-Zernio-Signature (o su alias legacy) antes de reenviar.
  const secreto = process.env["ZERNIO_WEBHOOK_SECRET"];

  if (secreto) {
    const firmaRecibida =
      request.headers.get("x-zernio-signature") ??
      request.headers.get("x-late-signature");

    if (!firmaRecibida) {
      return new Response(JSON.stringify({ error: "No signature provided." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    if (!firmaValida(cuerpoRaw, firmaRecibida, secreto)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const destino = process.env["N8N_WEBHOOK_LINKS_URL"] || DESTINO_DEFAULT;

  const headers = new Headers();
  request.headers.forEach((valor, nombre) => {
    if (!HEADERS_EXCLUIDOS.has(nombre.toLowerCase())) {
      headers.set(nombre, valor);
    }
  });

  const controller = new AbortController();
  // Zernio espera 2xx en 5s o reintenta (hasta 7 veces); n8n debe ser idempotente
  // usando X-Zernio-Event-Id como clave de deduplicación.
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const respuesta = await fetch(destino, {
      method: request.method,
      headers,
      body: cuerpoRaw.length > 0 ? cuerpoRaw : undefined,
      signal: controller.signal,
    });

    const texto = await respuesta.text();

    return new Response(texto, {
      status: respuesta.status,
      headers: {
        "content-type":
          respuesta.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("[zerniolinks] Error reenviando a n8n:", error);

    return new Response(
      JSON.stringify({ error: "No se pudo reenviar el webhook a n8n" }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const Route = createFileRoute("/zerniolinks")({
  server: {
    handlers: {
      GET: ({ request }) => reenviar(request),
      POST: ({ request }) => reenviar(request),
    },
  },
});
