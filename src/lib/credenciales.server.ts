// Server-only: cifrado y acceso a las credenciales guardadas en la base de datos.
// Los valores nunca se devuelven al navegador, solo una pista con los últimos caracteres.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function clave(): Buffer {
  const raw = process.env["CREDENCIALES_ENC_KEY"];
  if (!raw) throw new Error("Falta la llave de cifrado de credenciales.");
  return createHash("sha256").update(raw).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const ct = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function descifrar(guardado: string): string {
  const buf = Buffer.from(guardado, "base64");
  const decipher = createDecipheriv("aes-256-gcm", clave(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export function pistaDe(valor: string): string {
  if (valor.length <= 4) return "••••";
  return `••••${valor.slice(-4)}`;
}

/** Devuelve el valor descifrado de una credencial activa, o null si no existe. */
export async function obtenerCredencial(servicio: string, nombre: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("credenciales")
    .select("valor_cifrado")
    .eq("servicio", servicio)
    .eq("nombre", nombre)
    .eq("activo", true)
    .maybeSingle();
  if (error) throw new Error("No se pudieron leer las credenciales.");
  if (!data) return null;
  try {
    return descifrar((data as { valor_cifrado: string }).valor_cifrado);
  } catch {
    throw new Error(`La credencial ${servicio}/${nombre} no se pudo descifrar.`);
  }
}

/** Credencial guardada en base de datos, con respaldo en variables de entorno. */
export async function credencialOEnv(
  servicio: string,
  nombre: string,
  envVar: string,
): Promise<string | null> {
  const guardada = await obtenerCredencial(servicio, nombre);
  return guardada ?? process.env[envVar] ?? null;
}
