// Server-only: firma AWS SigV4 para Cloudflare R2 (S3 compatible).
// Las llaves NUNCA salen del servidor; al navegador solo viajan URLs firmadas temporales.
import { createHash, createHmac } from "node:crypto";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string | null;
}

const REGION = "auto";
const SERVICE = "s3";

export async function obtenerConfigR2(): Promise<R2Config> {
  const { credencialOEnv } = await import("@/lib/credenciales.server");
  const [accountId, accessKeyId, secretAccessKey, bucket, endpoint, publicBaseUrl] =
    await Promise.all([
      credencialOEnv("cloudflare_r2", "ACCOUNT_ID", "R2_ACCOUNT_ID"),
      credencialOEnv("cloudflare_r2", "ACCESS_KEY_ID", "R2_ACCESS_KEY_ID"),
      credencialOEnv("cloudflare_r2", "SECRET_ACCESS_KEY", "R2_SECRET_ACCESS_KEY"),
      credencialOEnv("cloudflare_r2", "BUCKET_NAME", "R2_BUCKET_NAME"),
      credencialOEnv("cloudflare_r2", "ENDPOINT", "R2_ENDPOINT"),
      credencialOEnv("cloudflare_r2", "PUBLIC_BASE_URL", "R2_PUBLIC_BASE_URL"),
    ]);

  const faltantes = [
    !accountId && "ACCOUNT_ID",
    !accessKeyId && "ACCESS_KEY_ID",
    !secretAccessKey && "SECRET_ACCESS_KEY",
    !bucket && "BUCKET_NAME",
  ].filter(Boolean);

  if (faltantes.length) {
    throw new Error(
      `Falta configurar en Credenciales: ${faltantes.join(", ")} de Cloudflare R2.`,
    );
  }

  return {
    accountId: accountId!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
    endpoint: (endpoint ?? `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, ""),
    publicBaseUrl: publicBaseUrl?.replace(/\/+$/, "") ?? null,
  };
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function encodeKey(key: string): string {
  return key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
}

function fechas() {
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: amz, fecha: amz.slice(0, 8) };
}

function firmaClave(cfg: R2Config, fecha: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, fecha), REGION), SERVICE), "aws4_request");
}

/** URL firmada (query string) para PUT o GET de un objeto. */
export function firmarUrl(
  cfg: R2Config,
  metodo: "PUT" | "GET" | "HEAD",
  objectKey: string,
  expiraSegundos: number,
  headersFirmados: Record<string, string> = {},
): string {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${encodeKey(objectKey)}`);
  const { amzDate, fecha } = fechas();

  const headers: Record<string, string> = { host: url.host, ...headersFirmados };
  const claves = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const signedHeaders = claves.join(";");
  const canonicalHeaders = claves
    .map((k) => {
      const original = Object.keys(headers).find((h) => h.toLowerCase() === k)!;
      return `${k}:${String(headers[original]).trim()}\n`;
    })
    .join("");

  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${cfg.accessKeyId}/${fecha}/${REGION}/${SERVICE}/aws4_request`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiraSegundos),
    "X-Amz-SignedHeaders": signedHeaders,
  });

  const canonicalQuery = [...params.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [
    metodo,
    url.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const scope = `${fecha}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", firmaClave(cfg, fecha))
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${url.origin}${url.pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Petición firmada con cabecera Authorization (para HeadBucket / HeadObject desde el servidor). */
async function peticionFirmada(
  cfg: R2Config,
  metodo: "HEAD" | "GET",
  ruta: string,
): Promise<Response> {
  const url = new URL(`${cfg.endpoint}${ruta}`);
  const { amzDate, fecha } = fechas();
  const payloadHash = sha256Hex("");

  const canonicalHeaders =
    `host:${url.host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    metodo,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${fecha}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", firmaClave(cfg, fecha))
    .update(stringToSign, "utf8")
    .digest("hex");

  return fetch(url.toString(), {
    method: metodo,
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
}

/** Comprueba que el bucket exista y sea accesible con las llaves guardadas. */
export async function comprobarBucket(cfg: R2Config): Promise<void> {
  const res = await peticionFirmada(cfg, "HEAD", `/${cfg.bucket}`);
  if (res.status === 200) return;
  if (res.status === 403) throw new Error("Las llaves de R2 no tienen acceso a ese bucket.");
  if (res.status === 404) throw new Error(`El bucket "${cfg.bucket}" no existe en tu cuenta de R2.`);
  throw new Error(`Cloudflare R2 respondió con el código ${res.status}.`);
}

export interface MetadatosObjeto {
  size: number;
  contentType: string | null;
  etag: string | null;
}

export async function cabecerasObjeto(
  cfg: R2Config,
  objectKey: string,
): Promise<MetadatosObjeto | null> {
  const res = await peticionFirmada(cfg, "HEAD", `/${cfg.bucket}/${encodeKey(objectKey)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No pudimos verificar el archivo en R2 (código ${res.status}).`);
  return {
    size: Number(res.headers.get("content-length") ?? 0),
    contentType: res.headers.get("content-type"),
    etag: res.headers.get("etag")?.replace(/"/g, "") ?? null,
  };
}

/** Nombre de objeto seguro: EvangelioDiario/{año}/{mes}/{fecha}-{nombre}.ext */
export function construirObjectKey(fecha: string, filename: string): string {
  const [anio, mes] = fecha.split("-");
  const punto = filename.lastIndexOf(".");
  const base = punto > 0 ? filename.slice(0, punto) : filename;
  const ext = (punto > 0 ? filename.slice(punto + 1) : "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const seguro =
    base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "video";
  return `EvangelioDiario/${anio}/${mes}/${fecha}-${seguro}.${ext || "mp4"}`;
}
