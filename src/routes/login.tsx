import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({

  head: () => ({
    meta: [
      { title: "Iniciar sesión — Evangelio Diario" },
      { name: "description", content: "Acceso al panel de gestión de Evangelio Diario." },
      { property: "og:title", content: "Iniciar sesión — Evangelio Diario" },
      {
        property: "og:description",
        content: "Acceso al panel de gestión de Evangelio Diario.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [googleCargando, setGoogleCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  const enviarMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setEnviando(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setEnviando(false);
    if (error) {
      console.error(error);
      toast.error("No pudimos enviar el enlace de acceso. Intenta de nuevo.");
      return;
    }
    setEnviado(true);
  };

  const entrarConGoogle = async () => {
    setGoogleCargando(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.error) {
      setGoogleCargando(false);
      console.error(result.error);
      toast.error("No pudimos iniciar sesión con Google.");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.28em] text-accent-strong uppercase">
            Pbro. Hedilberto Pérez Vicente
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            EVANGELIO DIARIO
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestión de publicaciones</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          {enviado ? (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-medium text-foreground">Revisa tu correo</h2>
              <p className="text-sm text-muted-foreground">
                Enviamos un enlace de acceso a <strong className="text-foreground">{email}</strong>.
                Ábrelo desde este mismo dispositivo para entrar.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setEnviado(false)}>
                Usar otro correo
              </Button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={googleCargando}
                onClick={entrarConGoogle}
              >
                {googleCargando ? "Conectando..." : "Continuar con Google"}
              </Button>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">o con tu correo</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={enviarMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="nombre@correo.com"
                    className="h-11"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={enviando}>
                  {enviando ? "Enviando..." : "Enviar enlace de acceso"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Las cuentas nuevas requieren aprobación de un administrador.
        </p>
      </div>
    </main>
  );
}
