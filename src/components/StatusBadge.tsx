import { cn } from "@/lib/utils";
import { ESTADO_LABEL, ROLE_LABEL, type EstadoContenido, type UserRole } from "@/types/database";

const estadoStyles: Record<EstadoContenido, string> = {
  pendiente_reflexion: "bg-warning-soft text-warning-strong border-warning-soft",
  pendiente_video: "bg-warning-soft text-warning-strong border-warning-soft",
  listo_para_publicar: "bg-info-soft text-info-strong border-info-soft",
  programado: "bg-accent-soft text-accent-strong border-accent-soft",
  publicado: "bg-success-soft text-success-strong border-success-soft",
  error: "bg-danger-soft text-danger-strong border-danger-soft",
};

const base =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({ estado }: { estado: EstadoContenido }) {
  return <span className={cn(base, estadoStyles[estado])}>{ESTADO_LABEL[estado]}</span>;
}

const roleStyles: Record<UserRole, string> = {
  admin: "bg-accent-soft text-accent-strong border-accent-soft",
  editor: "bg-info-soft text-info-strong border-info-soft",
  pendiente: "bg-warning-soft text-warning-strong border-warning-soft",
};

export function UserRoleBadge({ role }: { role: UserRole }) {
  return <span className={cn(base, roleStyles[role])}>{ROLE_LABEL[role]}</span>;
}

export function CheckBadge({ ok, okLabel, pendingLabel }: { ok: boolean; okLabel: string; pendingLabel: string }) {
  return (
    <span
      className={cn(
        base,
        ok
          ? "bg-success-soft text-success-strong border-success-soft"
          : "bg-muted text-muted-foreground border-border",
      )}
    >
      {ok ? okLabel : pendingLabel}
    </span>
  );
}
