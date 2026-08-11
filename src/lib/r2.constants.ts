/** Límite de subida simple (PUT) a Cloudflare R2. Por encima habría que migrar a multipart. */
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024 * 1024;
export const EXPIRA_SUBIDA = 600; // 10 minutos
export const EXPIRA_DESCARGA = 3600; // 1 hora
