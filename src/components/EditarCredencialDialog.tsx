import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { guardarCredencial, type CredencialResumen } from "@/lib/credenciales.functions";

interface Props {
  credencial: CredencialResumen | null;
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  onGuardado: () => void;
}

export function EditarCredencialDialog({ credencial, abierto, onOpenChange, onGuardado }: Props) {
  const guardar = useServerFn(guardarCredencial);
  const [descripcion, setDescripcion] = useState("");
  const [valor, setValor] = useState("");

  useEffect(() => {
    if (abierto && credencial) {
      setDescripcion(credencial.descripcion ?? "");
      setValor("");
    }
  }, [abierto, credencial]);

  const mGuardar = useMutation({
    mutationFn: () => {
      if (!credencial) throw new Error("No hay credencial seleccionada.");
      return guardar({
        data: {
          servicio: credencial.servicio,
          nombre: credencial.nombre,
          descripcion,
          valor,
          activo: credencial.activo,
        },
      });
    },
    onSuccess: () => {
      toast.success("Credencial actualizada correctamente.");
      onGuardado();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar credencial</DialogTitle>
          <DialogDescription>
            {credencial ? `${credencial.servicio} / ${credencial.nombre}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nuevo valor</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="El valor guardado no se muestra; escribe uno nuevo para reemplazarlo"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Input
              placeholder="Para qué se usa esta credencial"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mGuardar.mutate()} disabled={mGuardar.isPending || !valor.trim()}>
            {mGuardar.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
