import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileUp, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generarMes, importarCsvMes, type FilaCsv } from "@/lib/n8n.functions";
import { MESES } from "@/types/database";

const COLUMNAS = [
  "fecha",
  "santo_o_tiempo_liturgico",
  "cita_evangelio",
  "titulo",
  "descripcion_base",
  "reflexion",
] as const;

interface Props {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  anio: number;
  mes: number;
  onListo: () => void;
}

export function GenerarMesDialog({ abierto, onOpenChange, anio, mes, onListo }: Props) {
  const generar = useServerFn(generarMes);
  const importar = useServerFn(importarCsvMes);
  const [filas, setFilas] = useState<FilaCsv[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");

  const mGenerar = useMutation({
    mutationFn: () => generar({ data: { anio, mes } }),
    onSuccess: (r) => {
      toast.success(r.mensaje);
      onListo();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mImportar = useMutation({
    mutationFn: () => importar({ data: { rows: filas ?? [] } }),
    onSuccess: (r) => {
      toast.success(
        `Importación lista: ${r.insertadas} insertadas, ${r.actualizadas} actualizadas${
          r.omitidas.length ? `, ${r.omitidas.length} omitidas` : ""
        }.`,
      );
      if (r.omitidas.length) {
        toast.error(
          r.omitidas
            .slice(0, 5)
            .map((o) => `Fila ${o.fila}: ${o.motivo}`)
            .join(" · "),
        );
      }
      setFilas(null);
      setNombreArchivo("");
      onListo();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const descargarPlantilla = () => {
    const dias = new Date(anio, mes, 0).getDate();
    const mm = String(mes).padStart(2, "0");
    const lineas = [COLUMNAS.join(",")];
    for (let d = 1; d <= dias; d++) {
      lineas.push(`${anio}-${mm}-${String(d).padStart(2, "0")},,,,,`);
    }
    const blob = new Blob([`\uFEFF${lineas.join("\n")}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evangelio-diario-${anio}-${mm}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const leerArchivo = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data
          .map((r) => {
            const fila: FilaCsv = { fecha: (r["fecha"] ?? "").trim() };
            for (const c of COLUMNAS.slice(1)) {
              const v = (r[c] ?? "").trim();
              if (v) (fila as unknown as Record<string, string>)[c] = v;
            }
            return fila;
          })
          .filter((r) => Object.values(r).some((v) => v));
        if (!rows.length) {
          toast.error("El archivo no tiene filas con datos.");
          return;
        }
        setFilas(rows);
        setNombreArchivo(file.name);
      },
      error: () => toast.error("No pudimos leer el archivo CSV."),
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Generar {MESES[mes - 1]} {anio}
          </DialogTitle>
          <DialogDescription>Elige cómo quieres cargar los días del mes.</DialogDescription>
        </DialogHeader>

        <section className="rounded-xl border border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Globe className="h-4 w-4" /> Opción A — Importar desde Vatican News
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ejecuta el flujo externo configurado en Credenciales.
          </p>
          <Button
            className="mt-3"
            onClick={() => mGenerar.mutate()}
            disabled={mGenerar.isPending || mImportar.isPending}
          >
            {mGenerar.isPending ? "Generando..." : "Importar desde Vatican News"}
          </Button>
        </section>

        <section className="rounded-xl border border-border p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileUp className="h-4 w-4" /> Opción B — Importar desde CSV
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Las celdas vacías no borran información existente.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={descargarPlantilla}>
              <Download className="mr-2 h-4 w-4" /> Descargar plantilla vacía
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) leerArchivo(f);
                  e.target.value = "";
                }}
              />
              <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-secondary">
                Importar CSV
              </span>
            </label>
          </div>

          {filas ? (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                {nombreArchivo} — {filas.length} filas
              </p>
              <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Campos con datos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={`${f.fecha}-${i}`} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono">{f.fecha || "—"}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {Object.keys(f).filter((k) => k !== "fecha").join(", ") || "solo fecha"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                className="mt-3"
                onClick={() => mImportar.mutate()}
                disabled={mImportar.isPending}
              >
                {mImportar.isPending ? "Importando..." : "Confirmar importación"}
              </Button>
            </div>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
