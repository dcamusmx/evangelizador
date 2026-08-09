import type { ReactNode } from "react";

export function PageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {titulo}
        </h1>
        {descripcion ? (
          <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
        ) : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </div>
  );
}

export function EmptyState({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <p className="text-base font-medium text-foreground">{titulo}</p>
      {descripcion ? <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p> : null}
    </div>
  );
}

export function LoadingSpinner({ texto }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
      {texto ?? "Cargando..."}
    </div>
  );
}
