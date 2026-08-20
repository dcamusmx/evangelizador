import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, Users } from "lucide-react";

import { useAuth } from "@/lib/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/ajustes/")({
  head: () => ({
    meta: [
      { title: "Ajustes — Evangelio Diario" },
      {
        name: "description",
        content: "Administración de usuarios y credenciales del sistema.",
      },
      { property: "og:title", content: "Ajustes — Evangelio Diario" },
      {
        property: "og:description",
        content: "Administración de usuarios y credenciales del sistema.",
      },
    ],
  }),
  component: AjustesHome,
});

function AjustesHome() {
  const { profile } = useAuth();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        titulo="Ajustes"
        descripcion="Administración del equipo y configuraciones del sistema."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {profile?.role === "admin" ? (
          <>
            <Button asChild variant="outline" className="h-auto justify-start gap-3 p-4 text-left">
              <Link to="/ajustes/usuarios" className="flex w-full items-center gap-3">
                <Users className="h-4 w-4" />
                <span className="flex flex-col">
                  <span className="font-medium">Usuarios</span>
                  <span className="text-xs text-muted-foreground">Gestiona accesos y roles.</span>
                </span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-auto justify-start gap-3 p-4 text-left">
              <Link to="/ajustes/credenciales" className="flex w-full items-center gap-3">
                <KeyRound className="h-4 w-4" />
                <span className="flex flex-col">
                  <span className="font-medium">Credenciales</span>
                  <span className="text-xs text-muted-foreground">Tokens y secretos del sistema.</span>
                </span>
              </Link>
            </Button>
          </>
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground md:col-span-2">
            No tienes permisos para ver las opciones de administración.
          </div>
        )}
      </div>
    </div>
  );
}
