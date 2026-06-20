import { create } from "zustand";
import { Empresa, BeneficioFiscal } from "@/types/cbenef";
import { initialEmpresas, initialBeneficios } from "@/data/initialData";

interface CbenefStore {
  empresas: Empresa[];
  beneficios: BeneficioFiscal[];
  empresaBeneficios: Record<string, string[]>;
  addEmpresa: (empresa: Omit<Empresa, "id">) => void;
  addEmpresas: (empresas: Omit<Empresa, "id">[]) => void;
  updateEmpresa: (id: string, empresa: Partial<Omit<Empresa, "id">>) => void;
  removeEmpresa: (id: string) => void;
  removeEmpresas: (ids: string[]) => void;
  addBeneficio: (beneficio: Omit<BeneficioFiscal, "id">) => void;
  addBeneficios: (beneficios: Omit<BeneficioFiscal, "id">[]) => void;
  updateBeneficio: (id: string, data: Partial<Omit<BeneficioFiscal, "id">>) => void;
  removeBeneficio: (id: string) => void;
  assignBeneficio: (empresaId: string, beneficioId: string) => void;
  unassignBeneficio: (empresaId: string, beneficioId: string) => void;
  duplicarBeneficios: (origemId: string, destinoIds: string[], beneficioIds?: string[]) => number;
  getEmpresaBeneficios: (empresaId: string) => BeneficioFiscal[];
}

const STORAGE_KEY = "econ-cbenef-data";

function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return null;
}

function saveToStorage(state: { empresas: Empresa[]; beneficios: BeneficioFiscal[]; empresaBeneficios: Record<string, string[]> }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    empresas: state.empresas,
    beneficios: state.beneficios,
    empresaBeneficios: state.empresaBeneficios,
  }));
}

const stored = loadFromStorage();

export const useCbenefStore = create<CbenefStore>((set, get) => ({
  empresas: stored?.empresas || initialEmpresas,
  beneficios: stored?.beneficios || initialBeneficios,
  empresaBeneficios: stored?.empresaBeneficios || {
    "1": ["15", "1"],
    "2": ["18", "19", "20"],
  },

  addEmpresa: (empresa) => {
    set((state) => {
      const newState = {
        ...state,
        empresas: [...state.empresas, { ...empresa, id: crypto.randomUUID() }],
      };
      saveToStorage(newState);
      return newState;
    });
  },

  addEmpresas: (empresas) => {
    set((state) => {
      const newEmpresas = empresas.map((e) => ({ ...e, id: crypto.randomUUID() }));
      const newState = {
        ...state,
        empresas: [...state.empresas, ...newEmpresas],
      };
      saveToStorage(newState);
      return newState;
    });
  },

  updateEmpresa: (id, data) => {
    set((state) => {
      const newState = {
        ...state,
        empresas: state.empresas.map((e) => e.id === id ? { ...e, ...data } : e),
      };
      saveToStorage(newState);
      return newState;
    });
  },

  removeEmpresa: (id) => {
    set((state) => {
      const { [id]: _, ...rest } = state.empresaBeneficios;
      const newState = {
        ...state,
        empresas: state.empresas.filter((e) => e.id !== id),
        empresaBeneficios: rest,
      };
      saveToStorage(newState);
      return newState;
    });
  },

  removeEmpresas: (ids) => {
    set((state) => {
      const newEB = { ...state.empresaBeneficios };
      ids.forEach((id) => { delete newEB[id]; });
      const newState = {
        ...state,
        empresas: state.empresas.filter((e) => !ids.includes(e.id)),
        empresaBeneficios: newEB,
      };
      saveToStorage(newState);
      return newState;
    });
  },

  addBeneficio: (beneficio) => {
    set((state) => {
      const newState = {
        ...state,
        beneficios: [...state.beneficios, { ...beneficio, id: crypto.randomUUID() }],
      };
      saveToStorage(newState);
      return newState;
    });
  },

  addBeneficios: (beneficios) => {
    set((state) => {
      const newBeneficios = beneficios.map((b) => ({ ...b, id: crypto.randomUUID() }));
      const newState = {
        ...state,
        beneficios: [...state.beneficios, ...newBeneficios],
      };
      saveToStorage(newState);
      return newState;
    });
  },

  updateBeneficio: (id, data) => {
    set((state) => {
      const newState = {
        ...state,
        beneficios: state.beneficios.map((b) => b.id === id ? { ...b, ...data } : b),
      };
      saveToStorage(newState);
      return newState;
    });
  },

  removeBeneficio: (id) => {
    set((state) => {
      const newEmpresaBeneficios = { ...state.empresaBeneficios };
      Object.keys(newEmpresaBeneficios).forEach((key) => {
        newEmpresaBeneficios[key] = newEmpresaBeneficios[key].filter((b) => b !== id);
      });
      const newState = {
        ...state,
        beneficios: state.beneficios.filter((b) => b.id !== id),
        empresaBeneficios: newEmpresaBeneficios,
      };
      saveToStorage(newState);
      return newState;
    });
  },

  assignBeneficio: (empresaId, beneficioId) => {
    set((state) => {
      const current = state.empresaBeneficios[empresaId] || [];
      if (current.includes(beneficioId)) return state;
      const newState = {
        ...state,
        empresaBeneficios: {
          ...state.empresaBeneficios,
          [empresaId]: [...current, beneficioId],
        },
      };
      saveToStorage(newState);
      return newState;
    });
  },

  unassignBeneficio: (empresaId, beneficioId) => {
    set((state) => {
      const current = state.empresaBeneficios[empresaId] || [];
      const newState = {
        ...state,
        empresaBeneficios: {
          ...state.empresaBeneficios,
          [empresaId]: current.filter((b) => b !== beneficioId),
        },
      };
      saveToStorage(newState);
      return newState;
    });
  },

  duplicarBeneficios: (origemId, destinoIds, beneficioIds) => {
    const state = get();
    const origemBeneficios = beneficioIds || state.empresaBeneficios[origemId] || [];
    if (origemBeneficios.length === 0) return 0;
    let count = 0;
    set((s) => {
      const newEB = { ...s.empresaBeneficios };
      destinoIds.forEach((destId) => {
        const current = newEB[destId] || [];
        const toAdd = origemBeneficios.filter((b) => !current.includes(b));
        if (toAdd.length > 0) {
          newEB[destId] = [...current, ...toAdd];
          count += toAdd.length;
        }
      });
      const newState = { ...s, empresaBeneficios: newEB };
      saveToStorage(newState);
      return newState;
    });
    return count;
  },

  getEmpresaBeneficios: (empresaId) => {
    const state = get();
    const ids = state.empresaBeneficios[empresaId] || [];
    return state.beneficios.filter((b) => ids.includes(b.id));
  },
}));
