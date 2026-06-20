import { createContext, useContext } from "react";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

export const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => undefined,
});

export function useSidebar() {
  return useContext(SidebarContext);
}
