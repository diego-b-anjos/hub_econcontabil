import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiSimulations, type Simulation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileBarChart, Trash2, Clock, Scale, Trash } from "lucide-react";
import { formatBRL } from "@/lib/tax-engine";
import { toast } from "sonner";
import { listReformaHistory, removeReformaHistory, clearReformaHistory, type ReformaHistoryEntry } from "@/lib/reforma-history";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { ActiveClientFilterChip } from "@/components/ActiveClientFilterChip";

export default function Simulations() {
  const [allItems, setAllItems] = useState<Simulation[]>([]);
  const [reformaRecent, setReformaRecent] = useState<ReformaHistoryEntry[]>([]);
  const { selectedIds } = useSelectedClients();

  const load = async () => {
    try {
      const all = await apiSimulations.list();
      setAllItems(all);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar simulações");
    }
    setReformaRecent(listReformaHistory().slice(0, 5));
  };

  useEffect(() => { load(); }, []);

  // Filtra a lista pelo filtro global do header.
  // Vazio = comportamento original (mostra tudo).
  const items = useMemo(() => {
    if (!selectedIds.length) return allItems;
    const s = new Set(selectedIds);
    return allItems.filter((it) => it.clientId && s.has(it.clientId));
  }, [allItems, selectedIds]);
  const recent = useMemo(() => items.slice(0, 5), [items]);

  const remove = async (id: string) => {
    if (!confirm("Excluir esta simulação?")) return;
    try {
      await apiSimulations.remove(id);
      toast.success("Excluída"); load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  const removeReforma = (id: string) => {
    removeReformaHistory(id);
    setReformaRecent(listReformaHistory().slice(0, 5));
  };

  const limparReforma = () => {
    if (!confirm("Limpar todo o histórico da Reforma Tributária?")) return;
    clearReformaHistory();
    setReformaRecent([]);
    toast.success("Histórico limpo");
  };

  return (
    <div className="space-y-6">
      <ActiveClientFilterChip />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold">Comparativo Tributário</h1>
          <p className="text-muted-foreground text-sm">
            Central de simulações: Lucro Presumido × Simples Nacional e análises da Reforma Tributária (LC 214/2025).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/app/reforma-tributaria"><Scale className="w-4 h-4 mr-2" /> Nova análise (Reforma)</Link>
          </Button>
          <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90 shadow-brand">
            <Link to="/app/simulacoes/nova"><Plus className="w-4 h-4 mr-2" /> Nova simulação</Link>
          </Button>
        </div>
      </div>

      {/* Recentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" />
            Simulações recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma simulação ainda.{" "}
              <Link to="/app/simulacoes/nova" className="text-brand font-semibold hover:underline">
                Criar a primeira
              </Link>.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  to={`/app/simulacoes/${r.id}`}
                  className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded"
                >
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Ano {r.year}{r.clients?.name ? ` · ${r.clients.name}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.updatedAt).toLocaleDateString("pt-BR")}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reforma Tributária - recentes */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand" />
            Análises da Reforma Tributária recentes
          </CardTitle>
          {reformaRecent.length > 0 && (
            <Button size="sm" variant="ghost" onClick={limparReforma}>
              <Trash className="w-4 h-4 mr-1" /> Limpar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {reformaRecent.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma análise registrada ainda.{" "}
              <Link to="/app/reforma-tributaria" className="text-brand font-semibold hover:underline">
                Abrir analisador
              </Link>.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reformaRecent.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-3 -mx-2 px-2 rounded hover:bg-muted/50"
                >
                  <Link to="/app/reforma-tributaria" className="flex-1 min-w-0">
                    <div className="font-semibold">{r.moduloLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.resumo || "Sessão de análise LC 214/2025"}
                      {r.ano ? ` · Ano ${r.ano}` : ""}
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("pt-BR")}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeReforma(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico completo */}
      <div>
        <h2 className="text-lg font-display font-bold mb-3">Histórico completo</h2>
        {items.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma simulação ainda.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {items.map((s) => {
              const r = (s.result as any)?.totals;
              const best = r?.bestRegime;
              return (
                <Card key={s.id} className="hover:shadow-elegant transition-shadow">
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileBarChart className="w-4 h-4 text-brand" />
                        <Link to={`/app/simulacoes/${s.id}`} className="font-display font-bold hover:underline">{s.name}</Link>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">Ano {s.year}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary">Anexo {s.snAnnex}</span>
                      </div>
                      {s.clients?.name && <div className="text-xs text-muted-foreground mt-1">Cliente: {s.clients.name}</div>}
                    </div>
                    {r && (
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Simples</div>
                          <div className={`font-bold ${best === "SN" ? "text-success" : ""}`}>{formatBRL(r.snTotal)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Presumido</div>
                          <div className={`font-bold ${best === "LP" ? "text-success" : ""}`}>{formatBRL(r.lpTotal)}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline"><Link to={`/app/simulacoes/${s.id}`}>Abrir</Link></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
