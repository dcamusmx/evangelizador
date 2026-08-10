import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";

import { useAuth } from "@/lib/useAuth";
import { PageHeader, EmptyState, LoadingSpinner } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listarCredenciales,
  guardarCredencial,
  cambiarEstadoCredencial,
  eliminarCredencial,
  probarCredencialPcloud,
} from "@/lib/credenciales.functions";

export const Route = createFileRoute("/_authenticated/admin/credenciales")({
  head: () => ({
    meta: [
      { title: "Credenciales — Evangelio Diario" },
      {
        name: "description",
        content: "Guarda y administra de forma segura los tokens de pCloud, n8n, Telegram y más.",
      },
      { property: "og:title", content: "Credenciales — Evangelio Diario" },
      {
        property: "og:description",
        content: "Guarda y administra de forma segura los tokens de servicios externos.",
      },
    ],
  }),
  component: CredencialesPage,
});

const CATALOGO: Record<string, { etiqueta: string; campos: { nombre: string; ayuda: string }[] }> =
  {
    pcloud: {
      etiqueta: "pCloud",
      campos: [
        { nombre: "AUTH_TOKEN", ayuda: "Token de acceso de la API de pCloud" },
        { nombre: "API_HOST", ayuda: "eapi.pcloud.com (Europa) o api.pcloud.com" },
        { nombre: "CARPETA", ayuda: "Ruta destino, por ejemplo /EvangelioDiario" },
      ],
    },
    n8n: {
      etiqueta: "n8n",
      campos: [
        { nombre: "WEBHOOK_GENERAR_MES", ayuda: "URL del webhook para generar el mes" },
        { nombre: "API_KEY", ayuda: "Clave opcional enviada en la cabecera" },
      ],
    },
    telegram: {
      etiqueta: "Telegram",
      campos: [
        { nombre: "BOT_TOKEN", ayuda: "Token del bot de Telegram" },
        { nombre: "CHAT_ID", ayuda: "Identificador del chat o canal" },
      ],
    },
    youtube: {
      etiqueta: "YouTube",
      campos: [
        { nombre: "CLIENT_ID", ayuda: "ID de cliente OAuth" },
        { nombre: "CLIENT_SECRET", ayuda: "Secreto de cliente OAuth" },
        { nombre: "REFRESH_TOKEN", ayuda: "Token de actualización" },
      ],
    },
    otro: { etiqueta: "Otro servicio", campos: [] },
  };

function CredencialesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listar = useServerFn(listarCredenciales);
  const guardar = useServerFn(guardarCredencial);
  const cambiar = useServerFn(cambiarEstadoCredencial);
  const borrar = useServerFn(eliminarCredencial);
  const probar = useServerFn(probarCredencialPcloud);

  const [servicio, setServicio] = useState("pcloud");
  const [servicioLibre, setServicioLibre] = useState("");
  const [nombre, setNombre] = useState("AUTH_TOKEN");
  const [descripcion, setDescripcion] = useState("");
  const [valor, setValor] = useState("");

  useEffect(() => {
    if (profile && profile.role !== "admin") {
      toast.error("Solo los administradores pueden ver las credenciales.");
      void navigate({ to: "/", replace: true });
    }
  }, [profile, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["credenciales"],
    queryFn: () => listar({}),
    enabled: profile?.role === "admin",
  });

  const mGuardar = useMutation({
    mutationFn: () =>
      guardar({
        data: {
          servicio: servicio === "otro" ? servicioLibre : servicio,
          nombre,
          descripcion,
          valor,
        },
      }),
    onSuccess: () => {
      toast.success("Credencial guardada de forma segura.");
      setValor("");
      setDescripcion("");
      void qc.invalidateQueries({ queryKey: ["credenciales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mCambiar = useMutation({
    mutationFn: (v: { id: string; activo: boolean }) => cambiar({ data: v }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["credenciales"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mBorrar = useMutation({
    mutationFn: (id: string) => borrar({ data: { id } }),
    onSuccess: () => {
      toast.success("Credencial eliminada.");
      void qc.invalidateQueries({ queryKey: ["credenciales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mProbar = useMutation({
    mutationFn: () => probar({}),
    onSuccess: (r: { email: string }) => toast.success(`pCloud responde: ${r.email}`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (profile?.role !== "admin") return null;

  const campos = CATALOGO[servicio]?.campos ?? [];
  const ayuda = campos.find((c) => c.nombre === nombre)?.ayuda;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        titulo="Credenciales"
        descripcion="Tokens y llaves de servicios externos. Se guardan cifradas y nunca se muestran de nuevo."
        acciones={
          <Button
            variant="outline"
            onClick={() => mProbar.mutate()}
            disabled={mProbar.isPending}
          >
            {mProbar.isPending ? "Probando..." : "Probar pCloud"}
          </Button>
        }
      />

      <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold text-foreground">Agregar o actualizar</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select
              value={servicio}
              onValueChange={(v) => {
                setServicio(v);
                const primero = CATALOGO[v]?.campos[0]?.nombre;
                setNombre(primero ?? "");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATALOGO).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {servicio === "otro" ? (
              <Input
                placeholder="nombre-del-servicio"
                value={servicioLibre}
                onChange={(e) => setServicioLibre(e.target.value)}
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Clave</Label>
            {campos.length ? (
              <Select value={nombre} onValueChange={setNombre}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la clave" />
                </SelectTrigger>
                <SelectContent>
                  {campos.map((c) => (
                    <SelectItem key={c.nombre} value={c.nombre}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="NOMBRE_DE_LA_CLAVE"
                value={nombre}
                onChange={(e) => setNombre(e.target.value.toUpperCase())}
              />
            )}
            {ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Valor</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="Pega aquí el token o la URL"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Descripción (opcional)</Label>
            <Input
              placeholder="Para qué se usa esta credencial"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={() => mGuardar.mutate()}
          disabled={mGuardar.isPending || !valor.trim() || !nombre.trim()}
        >
          <KeyRound className="mr-2 h-4 w-4" />
          {mGuardar.isPending ? "Guardando..." : "Guardar credencial"}
        </Button>
      </section>

      {isLoading ? (
        <LoadingSpinner texto="Cargando credenciales..." />
      ) : !data?.length ? (
        <EmptyState
          titulo="Aún no hay credenciales"
          descripcion="Agrega la primera para conectar pCloud, n8n o Telegram."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Clave</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Activa</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {CATALOGO[c.servicio]?.etiqueta ?? c.servicio}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{c.nombre}</span>
                    {c.descripcion ? (
                      <p className="mt-1 text-xs text-muted-foreground">{c.descripcion}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {c.pista ?? "••••"}
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={c.activo}
                      onCheckedChange={(v) => mCambiar.mutate({ id: c.id, activo: v })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar credencial"
                      onClick={() => {
                        if (confirm(`¿Eliminar ${c.servicio} / ${c.nombre}?`)) mBorrar.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
