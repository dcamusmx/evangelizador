import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ESTADO_LABEL,
  fechaLarga,
  type ContenidoDiario,
  type EstadoContenido,
} from "@/types/database";

interface Props {
  registro: ContenidoDiario;
  userId: string | null;
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  onGuardado: () => void;
}

export function EditarRegistroDialog({
  registro,
  userId,
  abierto,
  onOpenChange,
  onGuardado,
}: Props) {
  const [form, setForm] = useState(registro);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) setForm(registro);
  }, [abierto, registro]);

  const set = (campo: keyof ContenidoDiario, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const limpio = (v: string | null) => (v && v.trim() !== "" ? v : null);

  const guardar = async () => {
    setGuardando(true);
    const { error } = await supabase
      .from("contenido_diario")
      .update({
        santo_o_tiempo_liturgico: limpio(form.santo_o_tiempo_liturgico),
        cita_evangelio: limpio(form.cita_evangelio),
        titulo: limpio(form.titulo),
        descripcion_base: limpio(form.descripcion_base),
        reflexion: limpio(form.reflexion),
        link_youtube: limpio(form.link_youtube),
        estado: form.estado,
        actualizado_por: userId,
      })
      .eq("fecha", registro.fecha);
    setGuardando(false);
    if (error) {
      console.error(error);
      toast.error("No pudimos guardar los cambios. Intenta de nuevo.");
      return;
    }
    toast.success("Registro actualizado correctamente.");
    onGuardado();
    onOpenChange(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="capitalize">{fechaLarga(registro.fecha)}</DialogTitle>
          <DialogDescription>
            Edita todos los campos del registro de este día.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="santo">Santo o tiempo litúrgico</Label>
              <Input
                id="santo"
                value={form.santo_o_tiempo_liturgico ?? ""}
                onChange={(e) => set("santo_o_tiempo_liturgico", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cita">Cita del Evangelio</Label>
              <Input
                id="cita"
                value={form.cita_evangelio ?? ""}
                onChange={(e) => set("cita_evangelio", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={form.titulo ?? ""}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="descripcion">Descripción base</Label>
            <Textarea
              id="descripcion"
              className="min-h-24"
              value={form.descripcion_base ?? ""}
              onChange={(e) => set("descripcion_base", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="reflexion">Reflexión</Label>
            <Textarea
              id="reflexion"
              className="min-h-40"
              value={form.reflexion ?? ""}
              onChange={(e) => set("reflexion", e.target.value)}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="youtube">Enlace de YouTube</Label>
              <Input
                id="youtube"
                placeholder="https://youtu.be/..."
                value={form.link_youtube ?? ""}
                onChange={(e) => set("link_youtube", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Estado</Label>
              <Select
                value={form.estado}
                onValueChange={(v) => setForm((f) => ({ ...f, estado: v as EstadoContenido }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Video</p>
            <p>Archivo: {registro.storage_filename ?? registro.nombre_archivo_pcloud ?? "—"}</p>
            <p>Ruta en almacenamiento: {registro.storage_key ?? "—"}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
