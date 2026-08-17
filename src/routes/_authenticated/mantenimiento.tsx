import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publicarManual } from "@/lib/n8n.functions";
import { GenerarMesDialog } from "@/components/GenerarMesDialog";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Pencil, Send } from "lucide-react";

import { EditarRegistroDialog } from "@/components/EditarRegistroDialog";


import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MESES, fechaLarga, type ContenidoDiario } from "@/types/database";

export const Route = createFileRoute("/_authenticated/mantenimiento")({
  head: () => ({
    meta: [
      { title: "Mantenimiento — Evangelio Diario" },
      {
        name: "description",
        content: "Genera el calendario mensual y escribe las reflexiones de cada día.",
      },
      { property: "og:title", content: "Mantenimiento — Evangelio Diario" },
      {
        property: "og:description",
        content: "Genera el calendario mensual y escribe las reflexiones de cada día.",
      },
    ],
  }),
  component: Mantenimiento,
});

const hoy = new Date();
const anios = [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1];

function Mantenimiento() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [anio, setAnio] = useState(String(hoy.getFullYear()));
  const [mes, setMes] = useState(String(hoy.getMonth() + 1).padStart(2, "0"));

  const inicio = `${anio}-${mes}-01`;
  const fin = new Date(Number(anio), Number(mes), 0).toISOString().slice(0, 10);

  const [generando, setGenerando] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ["contenido_mes", anio, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contenido_diario")
        .select("*")
        .gte("fecha", inicio)
        .lte("fecha", fin)
        .order("fecha", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContenidoDiario[];
    },
  });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        titulo="Mantenimiento"
        descripcion="Selecciona un mes para revisar y escribir las reflexiones."
        acciones={
          profile?.role === "admin" ? (
            <Button variant="outline" asChild>
              <Link to="/admin/credenciales">
                <KeyRound className="mr-2 h-4 w-4" /> Credenciales
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
          <Button onClick={() => setGenerando(true)}>Generar mes</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Puedes importar el mes desde Vatican News (flujo externo) o desde un archivo CSV.
        </p>

        <GenerarMesDialog
          abierto={generando}
          onOpenChange={setGenerando}
          anio={Number(anio)}
          mes={Number(mes)}
          onListo={() =>
            void queryClient.invalidateQueries({ queryKey: ["contenido_mes", anio, mes] })
          }
        />

      </div>

      {isLoading ? (
        <LoadingSpinner texto="Cargando el mes..." />
      ) : !data || data.length === 0 ? (
        <EmptyState
          titulo="Este mes aún no tiene registros"
          descripcion="Cuando se genere el mes aparecerán aquí los Evangelios."
        />
      ) : (
        <div className="space-y-4">
          {data.map((registro) => (
            <TarjetaDia
              key={registro.fecha}
              registro={registro}
              userId={user?.id ?? null}
              onGuardado={() =>
                queryClient.invalidateQueries({ queryKey: ["contenido_mes", anio, mes] })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaDia({
  registro,
  userId,
  onGuardado,
}: {
  registro: ContenidoDiario;
  userId: string | null;
  onGuardado: () => void;
}) {
  const [texto, setTexto] = useState(registro.reflexion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);
  const publicar = useServerFn(publicarManual);
  const mPublicar = useMutation({
    mutationFn: () => publicar({ data: { fecha: registro.fecha } }),
    onSuccess: (r: { mensaje: string }) => toast.success(r.mensaje),
    onError: (e: Error) => toast.error(e.message),
  });


  useEffect(() => {
    setTexto(registro.reflexion ?? "");
  }, [registro.reflexion]);

  const guardar = async () => {
    setGuardando(true);
    const { error } = await supabase
      .from("contenido_diario")
      .update({
        reflexion: texto.trim() === "" ? null : texto,
        actualizado_por: userId,
      })
      .eq("fecha", registro.fecha);
    setGuardando(false);
    if (error) {
      console.error(error);
      toast.error("No pudimos guardar la reflexión. Intenta de nuevo.");
      return;
    }
    toast.success("Reflexión guardada correctamente.");
    onGuardado();
  };

  const sinCambios = (registro.reflexion ?? "") === texto;

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground capitalize">
            {fechaLarga(registro.fecha)}
          </p>
          <p className="text-sm text-muted-foreground">
            {registro.santo_o_tiempo_liturgico ?? "Sin dato litúrgico"}
          </p>
          <p className="text-xs text-muted-foreground">{registro.cita_evangelio ?? "—"}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <StatusBadge estado={registro.estado} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Ver / editar
            </Button>
            <Button size="sm" onClick={() => mPublicar.mutate()} disabled={mPublicar.isPending}>
              <Send className="mr-2 h-3.5 w-3.5" />
              {mPublicar.isPending ? "Publicando..." : "Publicar ahora"}
            </Button>
          </div>
        </div>
      </div>

      <Textarea
        className="mt-4 min-h-32 sm:min-h-40"
        placeholder="Escribe aquí la reflexión del día..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      <div className="mt-3 flex justify-end">
        <Button onClick={guardar} disabled={guardando || sinCambios}>
          {guardando ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      <EditarRegistroDialog
        registro={registro}
        userId={userId}
        abierto={editando}
        onOpenChange={setEditando}
        onGuardado={onGuardado}
      />
    </article>
  );
}

