import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: "/", replace: true });
    }
  }, [loading, session, navigate]);

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
                disabled={enviando}
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
                disabled={enviando}
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full"
              disabled={enviando}
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