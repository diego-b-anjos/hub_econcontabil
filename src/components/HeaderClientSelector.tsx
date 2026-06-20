import { useEffect, useMemo, useState } from "react";
import { Search, Check, X, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClients, type Client } from "@/lib/api";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { OPEN_CLIENT_SELECTOR_EVENT } from "@/components/ActiveClientFilterChip";

export function HeaderClientSelector() {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const { selectedIds, toggle, clear, selectAll, count } = useSelectedClients();

  // Permite que chips das páginas abram este popover ao clicar.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_CLIENT_SELECTOR_EVENT, handler);
    return () => window.removeEventListener(OPEN_CLIENT_SELECTOR_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    apiClients.list()
      .then((d) => { if (!cancelled) setClients(Array.isArray(d) ? d : []); })
      .catch(() => { /* sem backend: opera em modo local */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const label = useMemo(() => {
    if (count === 0) return "Buscar cliente, CNPJ...";
    if (count === 1) {
      const c = clients.find((x) => x.id === selectedIds[0]);
      return c?.name || "1 cliente";
    }
    return `${count} clientes selecionados`;
  }, [count, selectedIds, clients]);

  const allIds = useMemo(() => clients.map((c) => c.id), [clients]);

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Selecionar clientes"
            className="bg-zinc-900 border border-zinc-800 rounded-full transition-colors hover:border-zinc-600 focus:outline-none focus:border-brand
              /* mobile */ flex items-center justify-center w-9 h-9
              /* desktop */ md:w-72 md:h-auto md:pl-10 md:pr-4 md:py-1.5 md:text-left md:justify-between"
          >
            {/* Mobile: ícone + badge de contagem */}
            <Users className="w-4 h-4 text-zinc-400 md:hidden" />
            {count > 0 && (
              <span className="md:hidden absolute -top-1 -right-1 bg-brand text-brand-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
            {/* Desktop: busca por texto */}
            <Search className="hidden md:block absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <span className={`hidden md:block text-sm text-white ${count === 0 ? "text-zinc-500 truncate" : "truncate"}`}>{label}</span>
            {count > 1 && (
              <Badge variant="secondary" className="hidden md:flex ml-2 bg-brand text-brand-foreground text-[10px] h-5 px-1.5 shrink-0">
                {count}
              </Badge>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              Filtro global de clientes
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => selectAll(allIds)}
                disabled={!clients.length}
              >
                Todos
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={clear}
                disabled={count === 0}
              >
                Limpar
              </Button>
            </div>
          </div>
          <Command shouldFilter={true}>
            <CommandInput placeholder="Nome ou CNPJ..." />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>
                {loading ? "Carregando..." : "Nenhum cliente encontrado."}
              </CommandEmpty>
              <CommandGroup>
                {clients.map((c) => {
                  const checked = selectedIds.includes(c.id);
                  const value = `${c.name} ${c.cnpj || ""} ${c.nomeFantasia || ""}`.trim();
                  return (
                    <CommandItem
                      key={c.id}
                      value={value}
                      onSelect={() => toggle(c.id)}
                      className="flex items-center gap-2"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          checked ? "bg-primary border-primary" : "border-input"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {c.cnpj || "Sem CNPJ"}
                          {c.taxRegime ? ` · ${c.taxRegime}` : ""}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          {count > 0 && (
            <div className="border-t px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>{count} selecionado{count > 1 ? "s" : ""}</span>
              <button
                onClick={clear}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpar tudo
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
