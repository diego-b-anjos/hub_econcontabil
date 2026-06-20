import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import {
  MODULE_CATEGORIES,
  topLevelModulesByCategory,
  subItemsOf,
  type AppModule,
} from "@/config/modules";
import { prefetchRoute } from "@/App";
import { useSidebar } from "@/contexts/SidebarContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const itemBase =
  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors w-full";
const itemBaseCollapsed =
  "flex items-center justify-center py-2 rounded-md text-sm font-semibold transition-colors w-full";
const itemActive = "bg-black text-brand shadow-sm";
const itemIdle = "text-black/80 hover:bg-black/10 hover:text-black";

function LeafItem({ item, depth = 0 }: { item: AppModule; depth?: number }) {
  const { collapsed } = useSidebar();
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onMouseEnter={() => prefetchRoute(item.to)}
      onFocus={() => prefetchRoute(item.to)}
      onTouchStart={() => prefetchRoute(item.to)}
      className={({ isActive }) => {
        if (collapsed && depth === 0)
          return `${itemBaseCollapsed} ${isActive ? itemActive : itemIdle}`;
        return `${itemBase} ${isActive ? itemActive : itemIdle} ${
          depth > 0 ? "pl-9 text-[13px] py-1.5 font-medium" : ""
        }`;
      }}
    >
      {depth === 0 && <item.icon className="w-4 h-4 shrink-0" />}
      {!collapsed && <span className="truncate flex-1">{item.label}</span>}
      {!collapsed && item.status === "coming-soon" && (
        <span className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/10 text-black/60 font-bold">
          em breve
        </span>
      )}
    </NavLink>
  );
  if (collapsed && depth === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

function GroupItem({ item }: { item: AppModule }) {
  const { collapsed } = useSidebar();
  const location = useLocation();
  const subs = subItemsOf(item.id);
  const isAnySubActive = subs.some((s) =>
    s.end ? location.pathname === s.to : location.pathname.startsWith(s.to),
  );
  const [open, setOpen] = useState(isAnySubActive);
  useEffect(() => {
    if (isAnySubActive) setOpen(true);
  }, [isAnySubActive]);

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={item.to}
            onMouseEnter={() => prefetchRoute(item.to)}
            onFocus={() => prefetchRoute(item.to)}
            className={() =>
              `${itemBaseCollapsed} ${isAnySubActive ? itemActive : itemIdle}`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${itemBase} ${isAnySubActive ? itemActive : itemIdle}`}
        aria-expanded={open}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        <span className="truncate flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {subs.map((s) => (
            <LeafItem key={s.id} item={s} depth={1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppSidebarNav() {
  const { collapsed, toggle } = useSidebar();

  const sidebarBorder = "hsl(var(--sidebar-border))";
  const navPad = collapsed ? "px-2 py-3" : "p-3";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Navegação principal */}
      <nav className={`flex-1 overflow-y-auto space-y-5 ${navPad}`}>
        {MODULE_CATEGORIES.map((cat) => {
          const items = topLevelModulesByCategory(cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[10px] uppercase tracking-widest text-black/55 font-bold">
                  {cat}
                </div>
              )}
              <div className="space-y-1">
                {items.map((item) =>
                  item.isGroup ? (
                    <GroupItem key={item.id} item={item} />
                  ) : (
                    <LeafItem key={item.id} item={item} />
                  ),
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Rodapé — Configurações + Recolher/Expandir */}
      <div
        className={`border-t shrink-0 space-y-1 ${collapsed ? "px-2 py-2" : "p-3"}`}
        style={{ borderColor: sidebarBorder }}
      >
        {collapsed ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/app/perfil"
                  title="Configurações"
                  className={({ isActive }) =>
                    `${itemBaseCollapsed} ${isActive ? itemActive : itemIdle}`
                  }
                >
                  <Settings className="w-4 h-4 shrink-0" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">Configurações</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  title="Expandir menu"
                  onClick={toggle}
                  className={`${itemBaseCollapsed} ${itemIdle}`}
                >
                  <PanelLeftOpen className="w-4 h-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <NavLink
              to="/app/perfil"
              className={({ isActive }) =>
                `${itemBase} ${isActive ? itemActive : itemIdle}`
              }
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Configurações</span>
            </NavLink>

            <button
              type="button"
              onClick={toggle}
              className={`${itemBase} ${itemIdle}`}
            >
              <PanelLeftClose className="w-4 h-4 shrink-0" />
              <span>Recolher menu</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
