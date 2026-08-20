import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/PageHeader";
import { UserRoleBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ROLE_LABEL, type Profile, type UserRole } from "@/types/database";

export const Route = createFileRoute("/_authenticated/ajustes/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios — Evangelio Diario" },
      { name: "description", content: "Aprueba cuentas y administra los roles del equipo." },
      { property: "og:title", content: "Usuarios — Evangelio Diario" },
      {
        property: "og:description",
        content: "Aprueba cuentas y administra los roles del equipo.",
      },
    ],
  }),
  component: AdminUsuarios,
});

function AdminUsuarios() {
  const { profile: yo } = useAuth();
  const queryClient = useQueryClient();
  const [pendienteCambio, setPendienteCambio] = useState<{
    perfil: Profile;
    nuevoRol: UserRole;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  if (yo?.role !== "admin") {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          titulo="Acceso restringido"
          descripcion="Solo los administradores pueden gestionar usuarios."
        />
      </div>
    );
  }

  const admins = (data ?? []).filter((p) => p.role === "admin");

  const confirmarCambio = async () => {
    if (!pendienteCambio) return;
    const { perfil, nuevoRol } = pendienteCambio;
    setPendienteCambio(null);

    if (perfil.role === "admin" && nuevoRol !== "admin" && admins.length <= 1) {
      toast.error("No puedes quitar el último administrador del sistema.");
      return;
    }

    const { error } = await supabase.from("profiles").update({ role: nuevoRol }).eq("id", perfil.id);
    if (error) {
      console.error(error);
      toast.error("No pudimos cambiar el rol. Intenta de nuevo.");
      return;
    }
    toast.success(`Rol actualizado a ${ROLE_LABEL[nuevoRol]}.`);
    void queryClient.invalidateQueries({ queryKey: ["profiles"] });
  };

  const grupos: { titulo: string; role: UserRole }[] = [
    { titulo: "Pendientes de aprobación", role: "pendiente" },
    { titulo: "Editores", role: "editor" },
    { titulo: "Administradores", role: "admin" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader titulo="Usuarios" descripcion="Aprueba cuentas nuevas y administra los roles." />

      {isLoading ? (
        <LoadingSpinner texto="Cargando usuarios..." />
      ) : (
        <div className="space-y-8">
          {grupos.map((grupo) => {
            const filas = (data ?? []).filter((p) => p.role === grupo.role);
            return (
              <section key={grupo.role}>
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  {grupo.titulo} ({filas.length})
                </h2>
                {filas.length === 0 ? (
                  <EmptyState titulo="Sin usuarios en este grupo" />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="border-b border-border bg-secondary/60 text-left text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-3 font-medium">Nombre</th>
                          <th className="px-4 py-3 font-medium">Correo</th>
                          <th className="px-4 py-3 font-medium">Rol</th>
                          <th className="px-4 py-3 font-medium">Registro</th>
                          <th className="px-4 py-3 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((p) => (
                          <tr key={p.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3 font-medium text-foreground">
                              {p.nombre ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
                            <td className="px-4 py-3">
                              <UserRoleBadge role={p.role} />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString("es-MX")}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {(["editor", "admin"] as UserRole[])
                                  .filter((r) => r !== p.role)
                                  .map((r) => (
                                    <Button
                                      key={r}
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setPendienteCambio({ perfil: p, nuevoRol: r })
                                      }
                                    >
                                      Hacer {ROLE_LABEL[r].toLowerCase()}
                                    </Button>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={pendienteCambio !== null}
        onOpenChange={(o) => !o && setPendienteCambio(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de rol</AlertDialogTitle>
            <AlertDialogDescription>
              {pendienteCambio
                ? `${pendienteCambio.perfil.nombre ?? pendienteCambio.perfil.email} pasará a ser ${ROLE_LABEL[pendienteCambio.nuevoRol].toLowerCase()}.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCambio}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
