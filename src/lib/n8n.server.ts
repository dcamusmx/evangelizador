// Server-only: llamadas a los flujos externos (n8n).
export interface ConfigN8n {
  webhook: string;
  apiKey: string | null;
}

export async function obtenerConfigN8n(): Promise<ConfigN8n | null> {
  const { credencialOEnv } = await import("@/lib/credenciales.server");
  const webhook = await credencialOEnv("n8n", "WEBHOOK_GENERAR_MES", "N8N_WEBHOOK_GENERAR_MES");
  if (!webhook) return null;
  return { webhook, apiKey: process.env["N8N_INTERNAL_API_KEY"] ?? null };
}

export async function obtenerWebhookPublicarManual(): Promise<ConfigN8n | null> {
  const { credencialOEnv } = await import("@/lib/credenciales.server");
  const webhook = await credencialOEnv(
    "n8n",
    "WEBHOOK_PUBLICAR_MANUAL",
    "N8N_WEBHOOK_PUBLICAR_MANUAL",
  );
  if (!webhook) return null;
  return { webhook, apiKey: process.env["N8N_INTERNAL_API_KEY"] ?? null };
}

/** POST al webhook con la clave interna; devuelve el JSON o el texto de respuesta. */
export async function postN8n(
  cfg: ConfigN8n,
  cuerpo: Record<string, unknown>,
): Promise<{ status: number; data: unknown; texto: string }> {
  const res = await fetch(cfg.webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.apiKey ? { "X-N8N-API-KEY": cfg.apiKey } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`El flujo externo respondió ${res.status}. ${texto.slice(0, 200)}`);
  }
  let data: unknown = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = null;
  }
  return { status: res.status, data, texto: texto.slice(0, 1000) };
}

export async function llamarGenerarMes(
  cfg: ConfigN8n,
  cuerpo: Record<string, unknown>,
): Promise<string> {
  const r = await postN8n(cfg, cuerpo);
  return r.texto.slice(0, 500);
}
