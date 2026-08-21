import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  FileText,
  ListFilter,
  Pencil,
  Send,
  Settings,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingSpinner } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { EditarRegistroDialog } from "@/components/EditarRegistroDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/useAuth";
import { publicarManual } from "@/lib/n8n.functions";
import type { ContenidoDiario } from "@/types/database";

const hoy = new Date();
const manana = new Date(hoy);
manana.setDate(hoy.getDate() + 1);

const iso = (date: Date) => date.toISOString().slice(0, 10);
const fechaLocal = (date: Date) =>
  date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Inicio — Evangelio Diario" },
      {
        name: "description",
        content: "Panel principal para preparar y compartir la publicación del Evangelio del día.",
      },
      { property: "og:title", content: "Inicio — Evangelio Diario" },
      {
        property: "og:description",
        content: "Panel principal para preparar y compartir la publicación del Evangelio del día.",
      },
    ],
  }),
  component: HomeDashboard,
});

function HomeDashboard() {
  const hoyIso = iso(hoy);
  const mananaIso = iso(manana);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [redSeleccionada, setRedSeleccionada] = useState<"youtube" | "facebook">("youtube");
  const [editandoSiguiente, setEditandoSiguiente] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["home_dashboard", hoyIso, mananaIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contenido_diario")
        .select("*")
        .in("fecha", [hoyIso, mananaIso])
        .order("fecha", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContenidoDiario[];
    },
  });

  const registros = useMemo(
    () => Object.fromEntries((data ?? []).map((registro) => [registro.fecha, registro])),
    [data],
  );

  const registroActual = registros[hoyIso] ?? null;
  const registroSiguiente = registros[mananaIso] ?? null;
  const estaPublicado = registroActual?.estado === "publicado";

  useEffect(() => {
    if (registroActual) {
      setRedSeleccionada(registroActual.link_youtube ? "youtube" : "facebook");
    }
  }, [registroActual]);

  const linkSeleccionado = useMemo(() => {
    if (!registroActual) return "";
    const link =
      redSeleccionada === "youtube"
        ? registroActual.link_youtube || registroActual.link_facebook || ""
        : registroActual.link_facebook || registroActual.link_youtube || "";
    return link;
  }, [redSeleccionada, registroActual]);

  const shareText = useMemo(() => {
    if (!registroActual) return "";

    const titulo = registroActual.santo_o_tiempo_liturgico ?? "Evangelio del día";
    const cita = registroActual.cita_evangelio ?? "";
    const reflexion = registroActual.reflexion ?? "";

    return [
      `Evangelio del día - ${fechaLocal(hoy)} - Pbro. Hedilberto Pérez Vicente`,
      titulo,
      cita ? `Evangelio (${cita})` : "Evangelio",
      reflexion,
      linkSeleccionado,
    ]
      .filter(Boolean)
      .join("\n");
  }, [linkSeleccionado, registroActual]);

  const copiarMensaje = async () => {
    if (!shareText) {
      toast.error("Todavía no hay un registro publicado para hoy.");
      return;
    }

    if (!linkSeleccionado) {
      toast.error("Selecciona una red social con enlace disponible para copiar el mensaje.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareText);
      toast.success(`Mensaje de ${redSeleccionada === "youtube" ? "YouTube" : "Facebook"} copiado.`);
    } catch {
      toast.error("No fue posible copiar el mensaje. Puedes seleccionarlo manualmente.");
    }
  };

  const publicarSiguiente = useServerFn(publicarManual);
  const mPublicarSiguiente = useMutation({
    mutationFn: () => publicarSiguiente({ data: { fecha: registroSiguiente!.fecha } }),
    onSuccess: (r: { mensaje: string }) => {
      toast.success(r.mensaje);
      void queryClient.invalidateQueries({ queryKey: ["home_dashboard", hoyIso, mananaIso] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publicarActual = useServerFn(publicarManual);
  const mPublicarActual = useMutation({
    mutationFn: async () => {
      if (!registroActual) throw new Error("No hay un registro para hoy.");

      const resultado = await publicarActual({ data: { fecha: registroActual.fecha } });

      const { error } = await supabase
        .from("contenido_diario")
        .update({
          estado: "publicado",
          actualizado_por: user?.id ?? null,
        })
        .eq("fecha", registroActual.fecha);

      if (error) throw new Error("No pudimos marcar como publicado el registro del día actual.");

      return {
        mensaje: `${resultado.mensaje} Estado actualizado a publicado.`,
      };
    },
    onSuccess: (r: { mensaje: string }) => {
      toast.success(r.mensaje);
      void queryClient.invalidateQueries({ queryKey: ["home_dashboard", hoyIso, mananaIso] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const links = [
    { to: "/subir", label: "Subir video", icon: Upload },
    { to: "/listado", label: "Listado", icon: ListFilter },
    { to: "/publicaciones", label: "Publicaciones", icon: FileText },
    { to: "/ajustes", label: "Ajustes", icon: Settings },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        titulo="Bienvenido"
        descripcion="Revisa el contenido del día y prepara la publicación del Evangelio de mañana."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Registro del día actual</h2>
            {registroActual ? (
              estaPublicado ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Publicado
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                  Sin publicar
                </span>
              )
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                Pendiente
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="mt-4">
              <LoadingSpinner texto="Cargando registro del día..." />
            </div>
          ) : registroActual ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{fechaLocal(hoy)}</p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">
                  {registroActual.santo_o_tiempo_liturgico ?? "Evangelio del día"}
                </h3>
              </div>

              <div className="space-y-2 text-sm text-foreground/80">
                <p>
                  <span className="font-medium text-foreground">Cita del evangelio:</span>{" "}
                  {registroActual.cita_evangelio ?? "—"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Reflexión:</span>{" "}
                  {registroActual.reflexion ?? "—"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {!estaPublicado ? (
                  <Button
                    size="sm"
                    onClick={() => mPublicarActual.mutate()}
                    disabled={mPublicarActual.isPending}
                  >
                    <Send className="mr-2 h-3.5 w-3.5" />
                    {mPublicarActual.isPending ? "Publicando..." : "Publicar"}
                  </Button>
                ) : null}
                {registroActual.link_youtube ? (
                  <a href={registroActual.link_youtube} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      YouTube <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                ) : null}
                {registroActual.link_facebook ? (
                  <a href={registroActual.link_facebook} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      Facebook <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                ) : null}
              </div>

              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">Mensaje para compartir</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copiarMensaje}
                    aria-label="Copiar mensaje"
                    className="h-8 w-8"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Red social para el enlace
                  </label>
                  <Select
                    value={redSeleccionada}
                    onValueChange={(value) => setRedSeleccionada(value as "youtube" | "facebook")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona red social" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube" disabled={!registroActual?.link_youtube}>
                        YouTube
                      </SelectItem>
                      <SelectItem value="facebook" disabled={!registroActual?.link_facebook}>
                        Facebook
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-foreground/80">
                  {shareText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              El registro del día actual aún no está publicado. Puedes prepararlo desde la sección de publicaciones y subir el video cuando corresponda.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Preparación para el día siguiente</h2>
            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium text-foreground">
              {fechaLocal(manana)}
            </span>
          </div>

          {isLoading ? (
            <div className="mt-4">
              <LoadingSpinner texto="Cargando preparación..." />
            </div>
          ) : registroSiguiente ? (
            <div className="mt-4 space-y-3 text-sm text-foreground/80">
              <p>
                <span className="font-medium text-foreground">Tema litúrgico:</span>{" "}
                {registroSiguiente.santo_o_tiempo_liturgico ?? "—"}
              </p>
              <p>
                <span className="font-medium text-foreground">Cita:</span>{" "}
                {registroSiguiente.cita_evangelio ?? "—"}
              </p>
              <p>
                <span className="font-medium text-foreground">Estado:</span>{" "}
                {registroSiguiente.estado}
              </p>
              <p>
                <span className="font-medium text-foreground">Reflexión:</span>{" "}
                {registroSiguiente.reflexion
                  ? registroSiguiente.reflexion.slice(0, 220) +
                    (registroSiguiente.reflexion.length > 220 ? "..." : "")
                  : "Sin reflexión aún"}
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditandoSiguiente(true)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Editar registro
                </Button>
                <Button
                  size="sm"
                  onClick={() => mPublicarSiguiente.mutate()}
                  disabled={mPublicarSiguiente.isPending}
                >
                  <Send className="mr-2 h-3.5 w-3.5" />
                  {mPublicarSiguiente.isPending ? "Publicando..." : "Publicar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              Todavía no hay preparación creada para el siguiente día.
            </div>
          )}

          {registroSiguiente ? (
            <EditarRegistroDialog
              registro={registroSiguiente}
              userId={user?.id ?? null}
              abierto={editandoSiguiente}
              onOpenChange={setEditandoSiguiente}
              onGuardado={() =>
                void queryClient.invalidateQueries({ queryKey: ["home_dashboard", hoyIso, mananaIso] })
              }
            />
          ) : null}
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {links.map(({ to, label, icon: Icon }) => (
          <Button
            key={to}
            asChild
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3 text-left"
          >
            <Link to={to} className="flex w-full items-center gap-3">
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
