import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/lib/useAuth";
import { LoadingSpinner } from "@/components/PageHeader";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Iniciando sesión — Evangelio Diario" },
      { name: "description", content: "Validando tu acceso a Evangelio Diario." },
      { property: "og:title", content: "Iniciando sesión — Evangelio Diario" },
      { property: "og:description", content: "Validando tu acceso a Evangelio Diario." },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    void navigate({ to: session ? "/" : "/login", replace: true });
  }, [loading, session, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <LoadingSpinner texto="Iniciando sesión..." />
    </main>
  );
}
