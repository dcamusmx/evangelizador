import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.42 3.58v2.98h3.91c2.29-2.11 3.53-5.22 3.53-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.93l-3.91-2.98c-1.08.72-2.46 1.15-4.02 1.15-3.09 0-5.71-2.09-6.65-4.89H1.32v3.07C3.29 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.35 14.35A7.2 7.2 0 0 1 5 12c0-.82.14-1.61.35-2.35V6.58H1.32A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.32 5.42l4.03-3.07z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.45-3.45C17.94 1.19 15.24 0 12 0 7.31 0 3.29 2.7 1.32 6.58l4.03 3.07C6.29 6.85 8.91 4.76 12 4.76z"
      />
    </svg>
  );
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Evangelio Diario" },
      {
        name: "description",
        content: "Acceso al panel de gestión de Evangelio Diario.",
      },
      {
        property: "og:title",
        content: "Iniciar sesión — Evangelio Diario",
      },
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
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviandoGoogle, setEnviandoGoogle] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: "/", replace: true });
    }
  }, [loading, session, navigate]);

  const iniciarSesionConGoogle = async () => {
    setEnviandoGoogle(true);

    try {
      // Supabase gestiona el redirect a Google y de vuelta; el navegador sale de esta página.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error(error);
        toast.error("No pudimos iniciar sesión con Google.");
        setEnviandoGoogle(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error al iniciar sesión con Google.");
      setEnviandoGoogle(false);
    }
  };

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailLimpio = email.trim();

    if (!emailLimpio || !password) {
      toast.error("Ingresa tu correo electrónico y contraseña.");
      return;
    }

    setEnviando(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailLimpio,
        password,
      });

      if (error) {
        console.error(error);

        if (error.message.toLowerCase().includes("invalid login credentials")) {
          toast.error("Correo o contraseña incorrectos.");
        } else if (error.message.toLowerCase().includes("email not confirmed")) {
          toast.error("Debes confirmar tu correo electrónico antes de ingresar.");
        } else {
          toast.error("No pudimos iniciar sesión. Intenta de nuevo.");
        }

        return;
      }

      toast.success("Sesión iniciada correctamente.");

      void navigate({
        to: "/",
        replace: true,
      });
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error al iniciar sesión.");
    } finally {
      setEnviando(false);
    }
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

          <p className="mt-1 text-sm text-muted-foreground">
            Gestión de publicaciones
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              Iniciar sesión
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Ingresa con tu correo electrónico y contraseña.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2"
            onClick={() => void iniciarSesionConGoogle()}
            disabled={enviandoGoogle || enviando}
          >
            <GoogleIcon />
            {enviandoGoogle ? "Conectando..." : "Continuar con Google"}
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">o</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={iniciarSesion} className="space-y-4">
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
                disabled={enviando || enviandoGoogle}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>

              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Tu contraseña"
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={enviando || enviandoGoogle}
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={enviando || enviandoGoogle}
            >
              {enviando ? "Ingresando..." : "Iniciar sesión"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Las cuentas nuevas requieren aprobación de un administrador.
        </p>
      </div>
    </main>
  );
}