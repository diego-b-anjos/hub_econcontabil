import { useEffect, useState } from "react";
import { Filter, X } from "lucide-react";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { apiClients, type Client } from "@/lib/api";

export const OPEN_CLIENT_SELECTOR_EVENT = "econ:open-client-selector";

/**
 * Chip discreto que aparece em cada página integrada com o filtro global.
 * - Clicável: abre o popover do seletor no header (via CustomEvent).
 * - Tem botão "X" para limpar o filtro.
 * - Mostra "Filtrando: <nome> +N" quando há ≥1 cliente.
 */
export function ActiveClientFilterChip() {
  const { selectedIds, count, clear } = useSelectedClients();
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    if (count === 0) return;
    let cancelled = false;
    apiClients.list()
      .then((d) => { if (!cancelled) setClients(d); })
      .catch(() => { /* silencioso */ });
    return () => { cancelled = true; };
  }, [count]);

  if (count === 0) return null;

  const nomes = selectedIds
    .map((id) => clients.find((c) => c.id === id)?.name)
    .filter(Boolean) as string[];
  const primeiro = nomes[0] || "(carregando)";
  const resto = count - 1;

  const abrirSelector = () => {
    window.dispatchEvent(new CustomEvent(OPEN_CLIENT_SELECTOR_EVENT));
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 pl-2 pr-1 py-0.5 text-[11px] mb-3">
      <button
        type="button"
        onClick={abrirSelector}
        className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
        title="Alterar clientes filtrados"
      >
        <Filter className="w-3 h-3 text-primary" />
        <span className="font-semibold text-primary">Filtrando:</span>
        <span className="truncate max-w-[180px]">{primeiro}</span>
        {resto > 0 && <span className="text-muted-foreground">+{resto}</span>}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); clear(); }}
        aria-label="Limpar filtro de clientes"
        className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
