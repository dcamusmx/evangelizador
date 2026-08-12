import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/PageHeader";
import { CheckBadge, StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ESTADO_LABEL, MESES, fechaLarga, type ContenidoDiario } from "@/types/database";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Contenido diario — Evangelio Diario" },
      {
        name: "description",
        content: "Listado de Evangelios diarios, reflexiones, videos y publicaciones.",
      },
      { property: "og:title", content: "Contenido diario — Evangelio Diario" },
      {
        property: "og:description",
        content: "Listado de Evangelios diarios, reflexiones, videos y publicaciones.",
      },
    ],
  }),
  component: ListadoPrincipal,
});

const anioActual = new Date().getFullYear();
const anios = [anioActual - 1, anioActual, anioActual + 1];

function ListadoPrincipal() {
  const [anio, setAnio] = useState<string>(String(anioActual));
  const [mes, setMes] = useState<string>("todos");
  const [estado, setEstado] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<"desc" | "asc">("desc");


  const { data, isLoading, error } = useQuery({
    queryKey: ["contenido_diario", anio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contenido_diario")
        .select("*")
        .gte("fecha", `${anio}-01-01`)
        .lte("fecha", `${anio}-12-31`)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContenidoDiario[];
    },
  });

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = (data ?? []).filter((r) => {
      if (mes !== "todos" && r.fecha.slice(5, 7) !== mes) return false;
      if (estado !== "todos" && r.estado !== estado) return false;
      if (!q) return true;
      return [r.titulo, r.cita_evangelio, r.santo_o_tiempo_liturgico, r.fecha]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    return lista.sort((a, b) =>
      orden === "desc" ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha),
    );
  }, [data, mes, estado, busqueda, orden]);


  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        titulo="Contenido diario"
        descripcion="Consulta el estado de cada Evangelio: reflexión, video y publicación."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            <SelectItem value="todos">Todos los meses</SelectItem>
            {MESES.map((m, i) => (
              <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={estado} onValueChange={setEstado}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={orden} onValueChange={(v) => setOrden(v as "desc" | "asc")}>
          <SelectTrigger>
            <SelectValue placeholder="Orden" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Fecha: más reciente primero</SelectItem>
            <SelectItem value="asc">Fecha: más antigua primero</SelectItem>
          </SelectContent>
        </Select>



        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título o cita"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card">
          <LoadingSpinner texto="Cargando contenido..." />
        </div>
      ) : error ? (
        <EmptyState
          titulo="No pudimos cargar el contenido"
          descripcion="Revisa tu conexión e intenta de nuevo."
        />
      ) : filas.length === 0 ? (
        <EmptyState
          titulo="Sin registros"
          descripcion="Genera el mes desde Mantenimiento para crear los Evangelios."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-secondary/60 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Evangelio</th>
                <th className="px-4 py-3 font-medium">Reflexión</th>
                <th className="px-4 py-3 font-medium">Video</th>
                <th className="px-4 py-3 font-medium">Publicación</th>
                <th className="px-4 py-3 font-medium">YouTube</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.fecha} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <p className="font-medium text-foreground">{r.fecha}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {fechaLarga(r.fecha)}
                    </p>
                  </td>
                  <td className="max-w-sm px-4 py-3 align-top">
                    <p className="font-medium text-foreground">
                      {r.santo_o_tiempo_liturgico ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.cita_evangelio ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <CheckBadge
                      ok={Boolean(r.reflexion?.trim())}
                      okLabel="Escrita"
                      pendingLabel="Pendiente"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <CheckBadge
                      ok={Boolean(r.fileid_pcloud)}
                      okLabel="Subido"
                      pendingLabel="Pendiente"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge estado={r.estado} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    {r.link_youtube ? (
                      <a
                        href={r.link_youtube}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        Ver en YouTube <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
