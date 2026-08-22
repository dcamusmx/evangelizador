import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { useAuth } from "@/lib/useAuth";
import { generarDesdeEvangelios } from "@/lib/n8n.functions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const crear = useServerFn(generarDesdeEvangelios);
  const [tipo, setTipo] = useState<"mes" | "anio">("mes");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));

  const anios = [2025, 2026, 2027, 2028, 2029, 2030, 2031];

  const mCrear = useMutation({
    mutationFn: () =>
      crear({
        data: {
          tipo,
          anio: Number(anio),
          mes: tipo === "mes" ? Number(mes) : undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(r.mensaje);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

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

      {profile?.role === "admin" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Crear contenido diario desde evangelios</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Genera registros en la tabla contenido diario solo cuando las fechas ya existan en la tabla evangelios.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Tipo</label>
              <Select value={tipo} onValueChange={(value) => setTipo(value as "mes" | "anio")}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Mes</SelectItem>
                  <SelectItem value="anio">Año completo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Año</label>
              <Select value={anio} onValueChange={setAnio}>
                <SelectTrigger>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {anios.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Mes</label>
              <Select
                value={tipo === "mes" ? mes : "01"}
                onValueChange={setMes}
                disabled={tipo !== "mes"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m).padStart(2, "0")}>
                      {new Date(2024, m - 1, 1).toLocaleString("es-MX", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="mt-4"
            onClick={() => mCrear.mutate()}
            disabled={mCrear.isPending}
          >
            {mCrear.isPending
              ? "Creando registros..."
              : tipo === "mes"
                ? "Crear mes desde evangelios"
                : "Crear año completo desde evangelios"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
