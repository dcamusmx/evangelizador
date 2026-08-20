import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import {
  CalendarDays,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Upload,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { LoadingSpinner } from "@/components/PageHeader";
import { UserRoleBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: DashboardLayout,
});

const navItems = [
  { to: "/", label: "Inicio", icon: Home, adminOnly: false },
  { to: "/subir", label: "Subir video", icon: Upload, adminOnly: false },
  { to: "/listado", label: "Listado", icon: CalendarDays, adminOnly: false },
  { to: "/publicaciones", label: "Publicaciones", icon: CalendarDays, adminOnly: false },
  { to: "/ajustes", label: "Ajustes", icon: Settings, adminOnly: false },
] as const;

function DashboardLayout() {
  const { profile, user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const cerrarSesion = async () => {
    await signOut();
    void navigate({ to: "/login", replace: true });
  };

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner texto="Cargando tu cuenta..." />
      </div>
    );
  }

  if (profile.role === "pendiente") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold tracking-[0.28em] text-accent-strong uppercase">
            Evangelio Diario
          </p>
          <h1 className="mt-4 text-xl font-semibold text-foreground">Cuenta en espera</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Tu cuenta está pendiente de aprobación por un administrador.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">{profile.email ?? user?.email}</p>
          <Button variant="outline" className="mt-6 w-full" onClick={cerrarSesion}>
            Cerrar sesión
          </Button>
        </div>
      </main>
    );
  }

  const visibles = navItems.filter((i) => !i.adminOnly || profile.role === "admin");

  const Nav = ({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) => (
    <nav className="flex flex-col gap-1">
      {visibles.map((item) => {
        const activo = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors",
              compact ? "justify-center px-2" : "gap-3 px-3",
              activo
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!compact && <span>{item.label}</span>}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          void cerrarSesion();
        }}
        className={cn(
          "flex items-center rounded-lg py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
          compact ? "justify-center px-2" : "gap-3 px-3",
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!compact && <span>Cerrar sesión</span>}
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar p-4 transition-all duration-200 lg:flex",
          sidebarOpen ? "w-64" : "w-20",
        )}
      >
        <div className={cn("flex items-center justify-between px-2 py-2", !sidebarOpen && "justify-center")}>
          {!sidebarOpen ? (
            <div className="flex justify-center">
              <p className="text-[10px] font-semibold tracking-[0.24em] text-accent-strong uppercase">
                E
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.24em] text-accent-strong uppercase">
                  Gestión
                </p>
                <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
                  Evangelio Diario
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
                aria-label="Colapsar menú"
                className="h-8 w-8"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        {sidebarOpen ? (
          <div className="mt-4 flex-1 overflow-y-auto">
            <Nav />
          </div>
        ) : (
          <div className="mt-4 flex-1 overflow-y-auto">
            <Nav compact />
          </div>
        )}
        {!sidebarOpen && (
          <div className="mt-2 flex justify-center pb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Expandir menú"
              className="h-8 w-8"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col transition-all duration-200", sidebarOpen ? "lg:pl-64" : "lg:pl-20")}>
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setAbierto(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => setSidebarOpen((value) => !value)}
              aria-label={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </Button>
            <div className="lg:hidden">
              <p className="text-sm font-semibold text-foreground">Evangelio Diario</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {profile.nombre ?? profile.email}
              </p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
            <UserRoleBadge role={profile.role} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {abierto ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <div className="absolute top-0 left-0 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar p-4">
            <div className="flex items-center justify-between px-2 py-2">
              <p className="text-base font-semibold text-foreground">Evangelio Diario</p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-4 flex-1">
              <Nav onNavigate={() => setAbierto(false)} />
            </div>
            <Button variant="ghost" className="justify-start gap-3" onClick={cerrarSesion}>
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
