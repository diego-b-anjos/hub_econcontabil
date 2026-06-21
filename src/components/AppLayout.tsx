import { lazy, Suspense, useState } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User as UserIcon, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { HeaderClientSelector } from "@/components/HeaderClientSelector";
import { HeaderNotifications } from "@/components/HeaderNotifications";
import { SidebarContext } from "@/contexts/SidebarContext";

const AppSidebarNav = lazy(() => import("@/components/AppSidebarNav"));

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const effectivelyCollapsed = sidebarCollapsed && !sidebarHovered;

  return (
    <SidebarContext.Provider value={{ collapsed: effectivelyCollapsed, toggle: () => setSidebarCollapsed((v) => !v) }}>
    <div className="min-h-screen bg-background flex flex-col">
      {/* Topbar preta — full width */}
      <header
        className="h-14 flex items-center justify-between px-4 md:px-6 shrink-0 z-20 border-b"
        style={{
          background: "hsl(var(--topbar-background))",
          color: "hsl(var(--topbar-foreground))",
          borderColor: "hsl(0 0% 14%)",
        }}
      >
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            className="md:hidden text-white hover:bg-white/10 px-2"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <NavLink to="/app" className="flex items-center gap-3" aria-label="ECON Hub do Escritório">
            <div className="bg-white/95 rounded-md px-2 py-1 flex items-center">
              <Logo className="h-7" />
            </div>
            <span className="hidden md:inline text-[10px] uppercase tracking-widest text-brand font-bold border-l border-zinc-700 pl-3">
              Hub do Escritório
            </span>
          </NavLink>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <HeaderClientSelector />
          <HeaderNotifications />
          <div className="flex items-center gap-3 border-l border-zinc-800 pl-3 md:pl-4">
            <div className="text-right hidden sm:block leading-tight">
              <div className="text-sm font-medium truncate max-w-[140px]">
                {user?.name || user?.email || "Usuário"}
              </div>
              <div className="text-[11px] text-zinc-400">Administrador</div>
            </div>
            <NavLink
              to="/app/perfil"
              aria-label="Perfil e configurações"
              className="w-9 h-9 rounded-full bg-zinc-800 border-2 border-brand flex items-center justify-center hover:bg-zinc-700 transition-colors"
              title="Perfil"
            >
              <UserIcon className="w-4 h-4 text-zinc-200" aria-hidden="true" />
            </NavLink>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Sair da conta"
              className="text-zinc-300 hover:bg-white/10 hover:text-white px-2"
              onClick={async () => {
                await signOut();
                nav("/login");
              }}
              title="Sair"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* Linha sidebar amarela + main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar amarela - desktop */}
        <aside
          className={`hidden md:flex ${effectivelyCollapsed ? "w-16" : "w-60"} flex-col shrink-0 border-r transition-all duration-200`}
          style={{
            background: "hsl(var(--sidebar-background))",
            color: "hsl(var(--sidebar-foreground))",
            borderColor: "hsl(var(--sidebar-border))",
          }}
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          <Suspense
            fallback={
              <div className="flex-1 p-3 space-y-2 animate-pulse">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-md bg-black/10" style={{ width: `${70 + (i % 3) * 10}%` }} />
                ))}
              </div>
            }
          >
            <AppSidebarNav />
          </Suspense>
        </aside>

        {/* Sidebar mobile - drawer */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-30 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside
              className="fixed top-14 left-0 bottom-0 w-64 z-40 md:hidden flex flex-col border-r overflow-y-auto"
              style={{
                background: "hsl(var(--sidebar-background))",
                color: "hsl(var(--sidebar-foreground))",
                borderColor: "hsl(var(--sidebar-border))",
              }}
              onClick={() => setMobileOpen(false)}
            >
              <Suspense fallback={<div className="p-4 text-xs">Carregando...</div>}>
                <AppSidebarNav />
              </Suspense>
            </aside>
          </>
        )}

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </SidebarContext.Provider>
  );
}
