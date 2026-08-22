import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarRange, PencilLine } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { EmptyState, LoadingSpinner, PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MESES,
  construirDescripcionBaseEvangelio,
  construirTituloEvangelio,
  fechaLarga,
  formatoFechaBarra,
  rangoMesLocal,
  type EvangelioRegistro,
} from "@/types/database";

export const Route = createFileRoute("/_authenticated/evangelios")({
  head: () => ({
    meta: [
      { title: "Evangelios — Evangelio Diario" },
      {
        name: "description",
        content: "Consulta y edita los evangelios del mes seleccionado.",
      },
      { property: "og:title", content: "Evangelios — Evangelio Diario" },
      {
        property: "og:description",
        content: "Consulta y edita los evangelios del mes seleccionado.",
      },
    ],
  }),
  component: EvangeliosPage,
});

const hoy = new Date();
const anios = [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1];

function EvangeliosPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [anio, setAnio] = useState(String(hoy.getFullYear()));
  const [mes, setMes] = useState(String(hoy.getMonth() + 1).padStart(2, "0"));
  const [registroActivo, setRegistroActivo] = useState<EvangelioRegistro | null>(null);

  const { inicio, fin } = rangoMesLocal(Number(anio), Number(mes));

  const { data, isLoading } = useQuery({
    queryKey: ["evangelios_mes", anio, mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evangelios")
        .select("*")
        .gte("fecha", inicio)
        .lte("fecha", fin)
        .order("fecha", { ascending: true });

      if (error) throw error;
      return (data ?? []) as EvangelioRegistro[];
    },
  });

  const onGuardado = () => {
    void queryClient.invalidateQueries({ queryKey: ["evangelios_mes", anio, mes] });
  };

  const registrosOrdenados = useMemo(() => data ?? [], [data]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        titulo="Evangelios"
        descripcion="Revisa el contenido del mes y edita cada registro desde un formulario emergente."
      />

      <div className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted-foreground">Año</label>
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un año" />
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
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un mes" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner texto="Cargando evangelios del mes..." />
      ) : !registrosOrdenados || registrosOrdenados.length === 0 ? (
        <EmptyState
          titulo="No hay evangelios para este mes"
          descripcion="Selecciona otro mes o crea primero los registros de la tabla evangelios."
        />
      ) : (
        <div className="space-y-4">
          {registrosOrdenados.map((registro) => (
            <article
              key={registro.fecha}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    <CalendarRange className="h-3.5 w-3.5" />
                    {registro.fecha}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground capitalize">
                    {fechaLarga(registro.fecha)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {registro.santo_o_tiempo_liturgico ?? "Sin información litúrgica"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {registro.cita_evangelio ?? "Sin cita del evangelio"}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <Button variant="outline" size="sm" onClick={() => setRegistroActivo(registro)}>
                    <PencilLine className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Título
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {registro.titulo ?? construirTituloEvangelio(registro.fecha)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Descripción base
                  </p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-line">
                    {registro.descripcion_base ??
                      construirDescripcionBaseEvangelio(
                        registro.fecha,
                        registro.santo_o_tiempo_liturgico,
                        registro.cita_evangelio,
                      )}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {registroActivo ? (
        <Dialog
          open={Boolean(registroActivo)}
          onOpenChange={(open) => {
            if (!open) setRegistroActivo(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{formatoFechaBarra(registroActivo.fecha)}</DialogTitle>
              <DialogDescription>Actualiza los datos del evangelio para esta fecha.</DialogDescription>
            </DialogHeader>

            <FormularioEditarEvangelio
              registro={registroActivo}
              userId={user?.id ?? null}
              onGuardado={() => {
                onGuardado();
                setRegistroActivo(null);
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function FormularioEditarEvangelio({
  registro,
  userId,
  onGuardado,
}: {
  registro: EvangelioRegistro;
  userId: string | null;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState<EvangelioRegistro>(registro);
  const [guardando, setGuardando] = useState(false);

  const set = (campo: keyof EvangelioRegistro, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const limpio = (v: string | null | undefined) => (v && v.trim() !== "" ? v.trim() : null);

  const guardar = async () => {
    setGuardando(true);

    const payload = {
      fecha: form.fecha,
      santo_o_tiempo_liturgico: limpio(form.santo_o_tiempo_liturgico),
      cita_evangelio: limpio(form.cita_evangelio),
      titulo: limpio(form.titulo) ?? construirTituloEvangelio(form.fecha),
      descripcion_base:
        limpio(form.descripcion_base) ??
        construirDescripcionBaseEvangelio(
          form.fecha,
          form.santo_o_tiempo_liturgico,
          form.cita_evangelio,
        ),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("evangelios").upsert(payload, {
      onConflict: "fecha",
    });

    setGuardando(false);

    if (error) {
      console.error(error);
      return;
    }

    onGuardado();
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="evangelio-fecha">Fecha</Label>
          <Input
            id="evangelio-fecha"
            value={form.fecha}
            onChange={(e) => set("fecha", e.target.value)}
            type="date"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="evangelio-titulo">Título</Label>
          <Input
            id="evangelio-titulo"
            value={form.titulo ?? ""}
            onChange={(e) => set("titulo", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="evangelio-santo">Santo o tiempo litúrgico</Label>
        <Input
          id="evangelio-santo"
          value={form.santo_o_tiempo_liturgico ?? ""}
          onChange={(e) => set("santo_o_tiempo_liturgico", e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="evangelio-cita">Cita del evangelio</Label>
        <Input
          id="evangelio-cita"
          value={form.cita_evangelio ?? ""}
          onChange={(e) => set("cita_evangelio", e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="evangelio-descripcion">Descripción base</Label>
        <Textarea
          id="evangelio-descripcion"
          className="min-h-28"
          value={form.descripcion_base ?? ""}
          onChange={(e) => set("descripcion_base", e.target.value)}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onGuardado} type="button">
          Cerrar
        </Button>
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </div>
  );
}
