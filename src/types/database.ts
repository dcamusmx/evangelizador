export type UserRole = "admin" | "editor" | "pendiente";

export type EstadoContenido =
  | "pendiente_reflexion"
  | "pendiente_video"
  | "listo_para_publicar"
  | "programado"
  | "publicado"
  | "error";

export const ESTADOS_PUBLICABLES = ["listo_para_publicar"] as const;
export const ESTADOS_BLOQUEADOS_N8N = ["publicado", "programado"] as const;

export function estadoPermitePublicacion(estado?: EstadoContenido | string | null): boolean {
  return estado === "listo_para_publicar";
}

export function estadoBloqueadoParaN8n(estado?: EstadoContenido | string | null): boolean {
  return estado === "publicado" || estado === "programado";
}

export function derivarEstadoContenido(params: {
  reflexion?: string | null;
  storage_key?: string | null;
  fileid_pcloud?: number | null;
  estadoActual?: EstadoContenido | string | null;
}): EstadoContenido {
  const { reflexion, storage_key, fileid_pcloud, estadoActual } = params;

  if (estadoActual === "publicado" || estadoActual === "programado") {
    return estadoActual as EstadoContenido;
  }

  if (!reflexion?.trim()) return "pendiente_reflexion";
  if (!storage_key && !fileid_pcloud) return "pendiente_video";
  return "listo_para_publicar";
}

export function fechaLocalISO(date: Date): string {
  const anio = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function rangoMesLocal(anio: number, mes: number): { inicio: string; fin: string } {
  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 0);
  return {
    inicio: fechaLocalISO(inicio),
    fin: fechaLocalISO(fin),
  };
}

export interface Profile {
  id: string;
  email: string | null;
  nombre: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface ContenidoDiario {
  fecha: string;
  santo_o_tiempo_liturgico: string | null;
  cita_evangelio: string | null;
  titulo: string | null;
  descripcion_base: string | null;
  reflexion: string | null;
  nombre_archivo_pcloud: string | null;
  fileid_pcloud: number | null;
  link_publico_pcloud: string | null;
  link_facebook: string | null;
  link_youtube: string | null;
  estado: EstadoContenido;
  storage_provider: string | null;
  storage_key: string | null;
  storage_filename: string | null;
  storage_size: number | null;
  storage_content_type: string | null;
  storage_etag: string | null;
  storage_uploaded_at: string | null;

  subido_por: string | null;
  actualizado_por: string | null;
  created_at: string;
  updated_at: string;
}

export const ESTADO_LABEL: Record<EstadoContenido, string> = {
  pendiente_reflexion: "Pendiente reflexión",
  pendiente_video: "Pendiente video",
  listo_para_publicar: "Listo",
  programado: "Programado",
  publicado: "Publicado",
  error: "Error",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  editor: "Editor",
  pendiente: "Pendiente",
};

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
