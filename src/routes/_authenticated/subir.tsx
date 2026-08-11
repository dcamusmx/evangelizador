import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmarSubidaR2, crearUrlSubidaR2, TAMANO_MAXIMO_BYTES } from "@/lib/r2.functions";
import { fechaLarga } from "@/types/database";

export const Route = createFileRoute("/_authenticated/subir")({
  head: () => ({
    meta: [
      { title: "Subir video — Evangelio Diario" },
      { name: "description", content: "Sube el video del Evangelio del día al almacenamiento." },
      { property: "og:title", content: "Subir video — Evangelio Diario" },
      {
        property: "og:description",
        content: "Sube el video del Evangelio del día al almacenamiento.",
      },
    ],
  }),
  component: SubirVideo,
});

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function subirConProgreso(
  uploadUrl: string,
  contentType: string,
  archivo: File,
  onProgreso: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error("La conexión con Cloudflare R2 falló."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Cloudflare R2 rechazó el archivo (código ${xhr.status}).`));
    };
    xhr.send(archivo);
  });
}

function SubirVideo() {
  const pedirUrl = useServerFn(crearUrlSubidaR2);
  const confirmar = useServerFn(confirmarSubidaR2);

  const [fecha, setFecha] = useState(hoyISO());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [fase, setFase] = useState<"idle" | "preparando" | "subiendo" | "confirmando" | "listo">(
    "idle",
  );
  const [resultado, setResultado] = useState<{ objectKey: string; nombreArchivo: string } | null>(
    null,
  );

  const ocupado = fase !== "idle" && fase !== "listo";

  const iniciar = async () => {
    if (!archivo) {
      toast.error("Selecciona un archivo de video.");
      return;
    }
    if (!archivo.type.startsWith("video/")) {
      toast.error("El archivo debe ser un video.");
      return;
    }
    if (archivo.size <= 0) {
      toast.error("El archivo está vacío.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      toast.error("El video supera el tamaño máximo permitido (5 GB).");
      return;
    }

    setResultado(null);
    try {
      setFase("preparando");
      const contentType = archivo.type || "video/mp4";
      const firma = await pedirUrl({
        data: { fecha, filename: archivo.name, contentType, fileSize: archivo.size },
      });

      setFase("subiendo");
      setProgreso(0);
      await subirConProgreso(firma.uploadUrl, contentType, archivo, setProgreso);

      setFase("confirmando");
      const res = await confirmar({ data: { fecha, objectKey: firma.objectKey } });

      setResultado({ objectKey: res.objectKey, nombreArchivo: res.nombreArchivo });
      setFase("listo");
      toast.success("Video subido correctamente.");
    } catch (e) {
      console.error(e);
      setFase("idle");
      setProgreso(null);
      toast.error(e instanceof Error ? e.message : "No fue posible preparar la subida.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        titulo="Subir video"
        descripcion="El archivo viaja directo desde tu navegador a Cloudflare R2; nunca pasa por el servidor."
      />

      <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="space-y-2">
          <Label htmlFor="fecha">Fecha del Evangelio</Label>
          <Input
            id="fecha"
            type="date"
            className="h-11"
            value={fecha}
            disabled={ocupado}
            onChange={(e) => setFecha(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{fechaLarga(fecha)}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="archivo">Archivo de video</Label>
          <Input
            id="archivo"
            type="file"
            accept="video/*"
            className="h-11 py-2"
            disabled={ocupado}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          {archivo ? (
            <p className="text-xs text-muted-foreground">
              {archivo.name} · {(archivo.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          ) : null}
        </div>

        {fase === "subiendo" && progreso !== null ? (
          <div className="space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Subiendo… {progreso}%</p>
          </div>
        ) : null}

        <Button className="h-11 w-full gap-2" disabled={!archivo || ocupado} onClick={iniciar}>
          <UploadCloud className="h-4 w-4" />
          {fase === "preparando"
            ? "Preparando subida…"
            : fase === "subiendo"
              ? "Subiendo…"
              : fase === "confirmando"
                ? "Verificando archivo…"
                : "Subir video"}
        </Button>

        {resultado ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent-strong" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">Video subido correctamente</p>
              <p className="break-all text-xs text-muted-foreground">{resultado.objectKey}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
