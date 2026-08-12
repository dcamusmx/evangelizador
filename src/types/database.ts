export type UserRole = "admin" | "editor" | "pendiente";

export type EstadoContenido =
  | "pendiente_reflexion"
  | "pendiente_video"
  | "listo_para_publicar"
  | "programado"
  | "publicado"
  | "error";

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
