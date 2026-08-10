// Helpers server-only para hablar con la API de pCloud.
// El token NUNCA sale del servidor: el navegador solo recibe un enlace de subida temporal.

export interface PcloudConfig {
  host: string;
  token: string;
  carpeta: string;
}

export function leerConfigPcloud(): PcloudConfig {
  const token = process.env["PCLOUD_AUTH_TOKEN"];
  if (!token) {
    throw new Error(
      "Falta la credencial de pCloud. Un administrador debe configurarla antes de subir videos.",
    );
  }
  return {
    host: process.env["PCLOUD_API_HOST"] ?? "eapi.pcloud.com",
    token,
    carpeta: process.env["PCLOUD_CARPETA"] ?? "/EvangelioDiario",
  };
}

async function llamar<T>(
  cfg: PcloudConfig,
  metodo: string,
  params: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`https://${cfg.host}/${metodo}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("auth", cfg.token);

  const res = await fetch(url.toString());
  const json = (await res.json()) as { result: number; error?: string } & T;
  if (json.result !== 0) {
    throw new Error(`pCloud (${metodo}): ${json.error ?? `error ${json.result}`}`);
  }
  return json;
}

/** Crea (si hace falta) la carpeta destino y devuelve su folderid. */
export async function asegurarCarpeta(cfg: PcloudConfig): Promise<number> {
  const json = await llamar<{ metadata: { folderid: number } }>(cfg, "createfolderifnotexists", {
    path: cfg.carpeta,
  });
  return json.metadata.folderid;
}

/** Enlace de subida temporal: el navegador sube directo a pCloud con este código. */
export async function crearEnlaceSubida(
  cfg: PcloudConfig,
  folderid: number,
  comentario: string,
): Promise<{ code: string; uploadlinkid: number }> {
  const expira = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const json = await llamar<{ code: string; uploadlinkid: number }>(cfg, "createuploadlink", {
    folderid,
    comment: comentario,
    expire: expira,
    maxfiles: 1,
  });
  return { code: json.code, uploadlinkid: json.uploadlinkid };
}

export async function borrarEnlaceSubida(cfg: PcloudConfig, uploadlinkid: number): Promise<void> {
  try {
    await llamar(cfg, "deleteuploadlink", { uploadlinkid });
  } catch (e) {
    console.error("No se pudo borrar el enlace de subida:", e);
  }
}

/** Busca el archivo recién subido dentro de la carpeta destino. */
export async function buscarArchivo(
  cfg: PcloudConfig,
  folderid: number,
  nombre: string,
): Promise<{ fileid: number; name: string; size: number } | null> {
  const json = await llamar<{
    metadata: { contents?: { isfolder: boolean; fileid?: number; name: string; size?: number }[] };
  }>(cfg, "listfolder", { folderid });
  const item = (json.metadata.contents ?? []).find((c) => !c.isfolder && c.name === nombre);
  if (!item?.fileid) return null;
  return { fileid: item.fileid, name: item.name, size: item.size ?? 0 };
}

/** Devuelve (o crea) el enlace público de descarga directa del archivo. */
export async function obtenerLinkPublico(cfg: PcloudConfig, fileid: number): Promise<string> {
  try {
    const json = await llamar<{ link: string }>(cfg, "getfilepublink", { fileid });
    return json.link;
  } catch {
    // Si ya existe un enlace público, pCloud devuelve error 2283: lo recuperamos del listado.
    const json = await llamar<{ publinks: { link: string; fileid?: number }[] }>(
      cfg,
      "listpublinks",
      {},
    );
    const existente = json.publinks.find((p) => p.fileid === fileid);
    if (!existente) throw new Error("No se pudo obtener el enlace público del archivo.");
    return existente.link;
  }
}
