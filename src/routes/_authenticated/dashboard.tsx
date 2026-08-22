import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingSpinner, EmptyState } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MESES, rangoMesLocal, type ContenidoDiario } from "@/types/database";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard operativo — Evangelio Diario" },
      { name: "description", content: "Dashboard mensual del estado operativo de los Evangelios." },
      { property: "og:title", content: "Dashboard operativo — Evangelio Diario" },
      { property: "og:description", content: "Trazabilidad, estados y métricas por mes." },
    ],
  }),
  component: DashboardOperativo,
});

const anioActual = new Date().getFullYear();
const anios = [anioActual - 1, anioActual, anioActual + 1];

function DashboardOperativo() {
  const [anio, setAnio] = useState(String(anioActual));
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));

  const { inicio, fin } = rangoMesLocal(Number(anio), Number(mes));

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard_operativo", anio, mes],
    queryFn: async () => {
      const { data: registros, error: errorRegistros } = await supabase
        .from("contenido_diario")
        .select("*")
        .gte("fecha", inicio)
        .lte("fecha", fin)
        .order("fecha", { ascending: true });

      if (errorRegistros) throw errorRegistros;

      const ids = [...new Set((registros ?? []).map((r) => r.actualizado_por).filter(Boolean))];
      const perfilesMap = new Map<string, string>();

      if (ids.length > 0) {
        const { data: perfiles, error: errorPerfiles } = await supabase
          .from("profiles")
          .select("id, nombre, email")
          .in("id", ids);

        if (errorPerfiles) throw errorPerfiles;
        for (const perfil of perfiles ?? []) {
          perfilesMap.set(perfil.id, perfil.nombre ?? perfil.email ?? "Usuario");
        }
      }

      return {
        registros: (registros ?? []) as ContenidoDiario[],
        perfilesMap,
      };
    },
  });

  const metrics = useMemo(() => {
    const registros = data?.registros ?? [];
    const pendientes = registros.filter((r) =>
      ["pendiente_reflexion", "pendiente_video"].includes(r.estado),
    ).length;
    const reflexionSinVideo = registros.filter(
      (r) => Boolean(r.reflexion?.trim()) && !(r.storage_key || r.fileid_pcloud),
    ).length;
    const videoSinPublicar = registros.filter(
      (r) => Boolean(r.storage_key || r.fileid_pcloud) && !["publicado", "programado"].includes(r.estado),
    ).length;
    const errores = registros.filter((r) => r.estado === "error").length;
    const publicados = registros.filter((r) => r.estado === "publicado").length;
    const programados = registros.filter((r) => r.estado === "programado").length;

    return { pendientes, reflexionSinVideo, videoSinPublicar, errores, publicados, programados };
  }, [data]);

  const trazabilidad = useMemo(() => {
    return [...(data?.registros ?? [])]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((registro) => ({
        fecha: registro.fecha,
        estado: registro.estado,
        actualizadoPor: data?.perfilesMap.get(registro.actualizado_por ?? "") ?? "Sistema",
        updatedAt: registro.updated_at,
      }));
  }, [data]);

  const historial = useMemo(() => {
    return trazabilidad.slice(0, 8);
  }, [trazabilidad]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        titulo="Dashboard operativo"
        descripcion="Resumen mensual del flujo editorial y de publicación del Evangelio del día."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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

        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger>
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="col-span-2 flex items-center justify-end xl:col-span-4">
          <Button variant="outline" size="sm" type="button">
            Mes: {MESES[Number(mes) - 1]} {anio}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8">
          <LoadingSpinner texto="Cargando dashboard operativo..." />
        </div>
      ) : error ? (
        <EmptyState
          titulo="No pudimos cargar el dashboard"
          descripcion="Revisa la conexión o el acceso a los datos e intenta de nuevo."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard titulo="Días pendientes" valor={metrics.pendientes} descripcion="Sin reflexión o sin video" />
            <MetricCard titulo="Reflexión sin video" valor={metrics.reflexionSinVideo} descripcion="Listos para subir metadata" />
            <MetricCard titulo="Video sin publicar" valor={metrics.videoSinPublicar} descripcion="Con video y aún no publicados" />
            <MetricCard titulo="Registros con error" valor={metrics.errores} descripcion="Requieren revisión" />
            <MetricCard titulo="Programados" valor={metrics.programados} descripcion="En cola de publicación" />
            <MetricCard titulo="Publicados" valor={metrics.publicados} descripcion="Cerrados correctamente" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <h3 className="mb-3 text-base font-semibold text-foreground">Trazabilidad por fecha y editor</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 font-medium">Fecha</th>
                      <th className="px-2 py-2 font-medium">Estado</th>
                      <th className="px-2 py-2 font-medium">Editor</th>
                      <th className="px-2 py-2 font-medium">Última actualización</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trazabilidad.map((item) => (
                      <tr key={`${item.fecha}-${item.updatedAt}`} className="border-b border-border last:border-0">
                        <td className="px-2 py-2 font-medium text-foreground">{item.fecha}</td>
                        <td className="px-2 py-2"><StatusBadge estado={item.estado as any} /></td>
                        <td className="px-2 py-2 text-muted-foreground">{item.actualizadoPor}</td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {new Date(item.updatedAt).toLocaleString("es-MX", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <h3 className="mb-3 text-base font-semibold text-foreground">Historial reciente</h3>
              <div className="space-y-3">
                {historial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay cambios recientes en este mes.</p>
                ) : (
                  historial.map((item) => (
                    <div key={`${item.fecha}-${item.updatedAt}`} className="rounded-lg border border-border bg-secondary/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{item.fecha}</span>
                        <StatusBadge estado={item.estado as any} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Actualizado por: {item.actualizadoPor}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleString("es-MX", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ titulo, valor, descripcion }: { titulo: string; valor: number; descripcion: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{valor}</p>
      <p className="mt-2 text-xs text-muted-foreground">{descripcion}</p>
    </div>
  );
}
