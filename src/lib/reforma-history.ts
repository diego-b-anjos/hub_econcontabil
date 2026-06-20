// Histórico leve das análises da Reforma Tributária (LC 214/2025)
// Persistido em localStorage para concentrar no painel "Comparativo Tributário".

const KEY = "reforma_tributaria_history_v1";

export type ReformaHistoryEntry = {
  id: string;
  modulo: string;          // ex: "calculo", "simples", "imobiliario", "regimes"
  moduloLabel: string;     // rótulo amigável
  resumo?: string;         // descrição curta (ex: "Lucro Presumido · R$ 1.200.000,00")
  ano?: number;            // ano da transição usado
  createdAt: string;       // ISO
};

export function listReformaHistory(): ReformaHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ReformaHistoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addReformaHistory(entry: Omit<ReformaHistoryEntry, "id" | "createdAt">): ReformaHistoryEntry {
  const item: ReformaHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = [item, ...listReformaHistory()].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(all));
  return item;
}

export function removeReformaHistory(id: string) {
  const all = listReformaHistory().filter((e) => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearReformaHistory() {
  localStorage.removeItem(KEY);
}
