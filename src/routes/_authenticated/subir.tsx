import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmarSubida, solicitarEnlaceSubida } from "@/lib/pcloud.functions";
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

function subirAlEnlace(
  endpoint: string,
  code: string,
  nombreArchivo: string,
  archivo: File,
  onProgreso: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("code", code);
    form.append("names", nombreArchivo);
    form.append("file", archivo, nombreArchivo);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgreso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Se interrumpió la conexión durante la subida."));
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText) as { result: number; error?: string };
        if (res.result !== 0) {
          reject(new Error(res.error ?? "El almacenamiento rechazó el archivo."));
          return;
        }
        resolve();
      } catch {
        reject(new Error("Respuesta inesperada del almacenamiento."));
      }
    };
    xhr.send(form);
  });
}

function SubirVideo() {
  const pedirEnlace = useServerFn(solicitarEnlaceSubida);
  const confirmar = useServerFn(confirmarSubida);

  const [fecha, setFecha] = useState(hoyISO());
  const [archivo, setArchivo] = useState<File | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [fase, setFase] = useState<"idle" | "preparando" | "subiendo" | "confirmando" | "listo">(
    "idle",
  );
  const [resultado, setResultado] = useState<{ link: string; nombreArchivo: string } | null>(null);

  const ocupado = fase !== "idle" && fase !== "listo";

  const iniciar = async () => {
    if (!archivo) return;
    setResultado(null);
    try {
      setFase("preparando");
      const extension = archivo.name.split(".").pop() ?? "mp4";
      const enlace = await pedirEnlace({ data: { fecha, extension } });

      setFase("subiendo");
      setProgreso(0);
      await subirAlEnlace(
        enlace.endpoint,
        enlace.code,
        enlace.nombreArchivo,
        archivo,
        setProgreso,
      );

      setFase("confirmando");
      const res = await confirmar({
        data: {
          fecha,
          folderid: enlace.folderid,
          uploadlinkid: enlace.uploadlinkid,
          nombreArchivo: enlace.nombreArchivo,
        },
      });

      setResultado({ link: res.link, nombreArchivo: res.nombreArchivo });
      setFase("listo");
      toast.success("Video subido y registrado correctamente.");
    } catch (e) {
      console.error(e);
      setFase("idle");
      setProgreso(null);
      toast.error(e instanceof Error ? e.message : "No pudimos completar la subida.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        titulo="Subir video"
        descripcion="El archivo viaja directo desde tu navegador al almacenamiento; nunca pasa por el servidor."
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
            ? "Preparando…"
            : fase === "subiendo"
              ? "Subiendo…"
              : fase === "confirmando"
                ? "Registrando…"
                : "Subir video"}
        </Button>

        {resultado ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-accent-strong" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">{resultado.nombreArchivo}</p>
              <a
                href={resultado.link}
                target="_blank"
                rel="noreferrer"
                className="break-all text-xs text-primary underline"
              >
                {resultado.link}
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
