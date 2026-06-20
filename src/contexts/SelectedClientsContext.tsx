import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

const STORAGE_KEY = "econ_selected_clients_v1";

interface SelectedClientsCtx {
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  setSelectedIds: (ids: string[]) => void;
  clear: () => void;
  selectAll: (ids: string[]) => void;
  count: number;
}

const Ctx = createContext<SelectedClientsCtx>({
  selectedIds: [],
  isSelected: () => false,
  toggle: () => {},
  setSelectedIds: () => {},
  clear: () => {},
  selectAll: () => {},
  count: 0,
});

export const SelectedClientsProvider = ({ children }: { children: ReactNode }) => {
  const [selectedIds, setSelectedIdsState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds)); } catch { /* quota */ }
  }, [selectedIds]);

  const setSelectedIds = useCallback((ids: string[]) => {
    setSelectedIdsState(Array.from(new Set(ids)));
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIdsState((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const clear = useCallback(() => setSelectedIdsState([]), []);
  const selectAll = useCallback((ids: string[]) => setSelectedIdsState(Array.from(new Set(ids))), []);
  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const value = useMemo<SelectedClientsCtx>(() => ({
    selectedIds, isSelected, toggle, setSelectedIds, clear, selectAll, count: selectedIds.length,
  }), [selectedIds, isSelected, toggle, setSelectedIds, clear, selectAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useSelectedClients = () => useContext(Ctx);
