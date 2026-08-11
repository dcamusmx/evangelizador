// Server-only: llamada al flujo externo (n8n) que genera el contenido del mes.
export interface ConfigN8n {
  webhook: string;
  apiKey: string | null;
}

export async function obtenerConfigN8n(): Promise<ConfigN8n | null> {
  const { credencialOEnv } = await import("@/lib/credenciales.server");
  const webhook = await credencialOEnv("n8n", "WEBHOOK_GENERAR_MES", "N8N_WEBHOOK_GENERAR_MES");
  if (!webhook) return null;
  const apiKey = await credencialOEnv("n8n", "API_KEY", "N8N_API_KEY");
  return { webhook, apiKey };
}

export async function llamarGenerarMes(
  cfg: ConfigN8n,
  cuerpo: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(cfg.webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cfg.apiKey ? { "x-api-key": cfg.apiKey } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  if (!res.ok) {
    throw new Error(`El flujo externo respondió ${res.status}. ${texto.slice(0, 200)}`);
  }
  return texto.slice(0, 500);
}
