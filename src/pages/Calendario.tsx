import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Info, ExternalLink, Scale, Database,
  Plug, FileDown, CheckSquare, Square, X, RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTaskStore, type Task } from "@/store/taskStore";
import {
  obrigacoesDoMes,
  obrigacoesParaCliente,
  fontesPorTributo,
  TRIBUTOS,
  type Obrigacao,
  type Esfera,
  type RegimeAplicavel,
} from "@/data/tributos";
import { apiClients, type Client } from "@/lib/api";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { ActiveClientFilterChip } from "@/components/ActiveClientFilterChip";
import { ExportarCalendarioDialog } from "@/components/ExportarCalendarioDialog";

// ── Constantes ──────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<Esfera, { label: string; dot: string; chip: string; border: string }> = {
  federal:     { label: "Federal",     dot: "bg-blue-500",   chip: "bg-blue-100 text-blue-800",     border: "border-blue-300"   },
  estadual:    { label: "Estadual",    dot: "bg-purple-500", chip: "bg-purple-100 text-purple-800", border: "border-purple-300" },
  municipal:   { label: "Municipal",   dot: "bg-green-500",  chip: "bg-green-100 text-green-800",   border: "border-green-300"  },
  trabalhista: { label: "Trabalhista", dot: "bg-orange-500", chip: "bg-orange-100 text-orange-800", border: "border-orange-300" },
};

const PRIORITY_CHIP: Record<string, string> = {
  baixa: "bg-zinc-100 text-zinc-700",
  media: "bg-yellow-100 text-yellow-800",
  alta:  "bg-red-100 text-red-700",
};

const MES_NOMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const REGIME_LABEL: Record<string, RegimeAplicavel> = {
  SN: "Simples Nacional", LP: "Lucro Presumido", LR: "Lucro Real", MEI: "MEI",
};

const MUNICIPIOS_DISPONIVEIS = [
  "Todos","São Paulo/SP","Osasco/SP","Barueri/SP",
  "Santana de Parnaíba/SP","Cotia/SP","Santo André/SP","São Bernardo do Campo/SP",
];

const RECURRENCE_LABEL: Record<string, string> = {
  none: "Esporádica", daily: "Diária", weekly: "Semanal", monthly: "Mensal",
};

// ── Painel lateral de detalhes do dia ────────────────────────────────────────

interface DaySelection {
  day: number;
  obrigacoes: Obrigacao[];
  tasks: Task[];
}

function DayPanel({ sel, ano, mes, onClose, onToggleTask }: {
  sel: DaySelection;
  ano: number;
  mes: number;
  onClose: () => void;
  onToggleTask: (id: string, isDone: boolean) => void;
}) {
  const date = new Date(ano, mes - 1, sel.day);
  const label = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="w-80 shrink-0 border-l bg-card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <p className="text-xs text-muted-foreground capitalize">{label}</p>
          <p className="font-bold text-lg">{sel.day} de {MES_NOMES[mes - 1]}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Obrigações */}
        {sel.obrigacoes.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Obrigações fiscais ({sel.obrigacoes.length})
            </p>
            {sel.obrigacoes.map((o) => {
              const cfg = TIPO_CONFIG[o.tipo];
              const tributos = o.tributoIds.map((tid) => TRIBUTOS[tid]).filter(Boolean);
              const fontes = Array.from(
                new Set(o.tributoIds.flatMap((tid) => fontesPorTributo(tid).map((f) => f.nome))),
              );
              return (
                <div key={o.id} className={cn("rounded-lg border p-3 space-y-1.5", cfg.border, "bg-card")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-snug">{o.nome}</p>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", cfg.chip)}>
                      {cfg.label}
                    </span>
                  </div>
                  {o.ente && <p className="text-xs text-muted-foreground">{o.ente}</p>}
                  <p className="text-xs text-muted-foreground">{o.descricao}</p>
                  {tributos.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tributos.map((t) => (
                        <Badge key={t.id} variant="outline" className="text-[10px] h-4">{t.sigla}</Badge>
                      ))}
                    </div>
                  )}
                  {o.embasamento && (
                    <div className="rounded bg-muted/50 p-2 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground font-medium mb-0.5">
                        <Scale className="w-3 h-3" /> Embasamento
                      </span>
                      {o.embasamento}
                    </div>
                  )}
                  {fontes.length > 0 && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Plug className="w-3 h-3" /> {fontes.join(" · ")}
                    </p>
                  )}
                  {o.regimes && o.regimes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {o.regimes.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[9px] h-4">{r}</Badge>
                      ))}
                    </div>
                  )}
                  {o.regraVencimento && (
                    <p className="text-[10px] text-muted-foreground italic">{o.regraVencimento}</p>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Tarefas */}
        {sel.tasks.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tarefas ({sel.tasks.length})
            </p>
            {sel.tasks.map((t) => {
              const isDone = t.column === "done";
              return (
                <div
                  key={t.id}
                  onClick={() => onToggleTask(t.id, isDone)}
                  className={cn(
                    "rounded-lg border p-3 cursor-pointer transition-colors space-y-1",
                    isDone ? "bg-green-50 border-green-200 opacity-70" : "hover:bg-muted/40 border-border",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {isDone
                      ? <CheckSquare className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      : <Square className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium leading-snug", isDone && "line-through text-muted-foreground")}>
                        {t.title}
                      </p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pl-6">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", PRIORITY_CHIP[t.priority])}>
                      {t.priority === "baixa" ? "Baixa" : t.priority === "media" ? "Média" : "Alta"}
                    </span>
                    {t.recurrence !== "none" && (
                      <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">
                        <RotateCcw className="w-2.5 h-2.5" /> {RECURRENCE_LABEL[t.recurrence]}
                      </span>
                    )}
                    {t.tag && (
                      <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{t.tag}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {sel.obrigacoes.length === 0 && sel.tasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento neste dia.</p>
        )}
      </div>

      <div className="p-3 border-t">
        <p className="text-[10px] text-muted-foreground text-center">
          Clique em uma tarefa para marcar/desmarcar como concluída
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

const Calendario = () => {
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [municipioFiltro, setMunicipioFiltro] = useState<string>("Todos");
  const [regimeFiltro, setRegimeFiltro] = useState<string>("todos");
  const { selectedIds } = useSelectedClients();
  const [clienteId, setClienteId] = useState<string>("_none");
  const [clientes, setClientes] = useState<Client[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DaySelection | null>(null);
  const { tasks, updateTask } = useTaskStore();

  function mesAnterior() {
    if (mes === 1) { setMes(12); setAno((a) => a - 1); }
    else setMes((m) => m - 1);
  }
  function proximoMes() {
    if (mes === 12) { setMes(1); setAno((a) => a + 1); }
    else setMes((m) => m + 1);
  }

  useEffect(() => {
    apiClients.list().then(setClientes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientes.length) return;
    if (selectedIds.length > 0) {
      const first = selectedIds.find((id) => clientes.some((c) => c.id === id));
      if (first && first !== clienteId) setClienteId(first);
    } else if (clienteId !== "_none") {
      setClienteId("_none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, clientes]);

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => c.id === clienteId) || null,
    [clientes, clienteId],
  );

  useEffect(() => {
    if (!clienteSelecionado) return;
    if (clienteSelecionado.municipio && clienteSelecionado.uf) {
      const ente = `${clienteSelecionado.municipio}/${clienteSelecionado.uf}`;
      if (MUNICIPIOS_DISPONIVEIS.includes(ente)) setMunicipioFiltro(ente);
    }
    if (clienteSelecionado.taxRegime) setRegimeFiltro(clienteSelecionado.taxRegime);
  }, [clienteSelecionado]);

  const obrigacoesBase = useMemo<Obrigacao[]>(() => {
    if (clienteSelecionado) {
      return obrigacoesParaCliente(mes, {
        municipio: clienteSelecionado.municipio,
        uf: clienteSelecionado.uf,
        taxRegime: clienteSelecionado.taxRegime,
      }, ano);
    }
    return obrigacoesDoMes(mes, ano);
  }, [mes, ano, clienteSelecionado]);

  const filtradas = useMemo(() => {
    let out = tipoFiltro === "todos" ? obrigacoesBase : obrigacoesBase.filter((o) => o.tipo === tipoFiltro);
    if (municipioFiltro !== "Todos" && !clienteSelecionado) {
      out = out.filter((o) => o.tipo !== "municipal" || o.ente === municipioFiltro);
    }
    if (regimeFiltro !== "todos" && !clienteSelecionado) {
      const label = REGIME_LABEL[regimeFiltro];
      out = out.filter((o) => !o.regimes || !o.regimes.length || (label && o.regimes.includes(label)));
    }
    return out;
  }, [obrigacoesBase, tipoFiltro, municipioFiltro, regimeFiltro, clienteSelecionado]);

  // Tarefas do mês visível
  const mesStr = `${ano}-${String(mes).padStart(2, "0")}`;
  const tarefasMes = tasks.filter((t) => t.dueDate && t.dueDate.startsWith(mesStr));

  // Indexar obrigações e tarefas por dia
  const obByDay = useMemo(() => {
    const map: Record<number, Obrigacao[]> = {};
    filtradas.forEach((o) => {
      if (!map[o.dia]) map[o.dia] = [];
      map[o.dia].push(o);
    });
    return map;
  }, [filtradas]);

  const taskByDay = useMemo(() => {
    const map: Record<number, Task[]> = {};
    tarefasMes.forEach((t) => {
      const day = parseInt(t.dueDate!.slice(8, 10), 10);
      if (!map[day]) map[day] = [];
      map[day].push(t);
    });
    return map;
  }, [tarefasMes]);

  // Grade mensal
  const firstDayOfMonth = new Date(ano, mes - 1, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const today = agora.getDate();
  const isCurrentMonth = agora.getMonth() + 1 === mes && agora.getFullYear() === ano;

  function openDay(day: number) {
    setSelectedDay({
      day,
      obrigacoes: obByDay[day] ?? [],
      tasks: taskByDay[day] ?? [],
    });
  }

  function onToggleTask(id: string, isDone: boolean) {
    updateTask(id, { column: isDone ? "doing" : "done" });
    // refresh panel
    if (selectedDay) {
      setSelectedDay((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id ? { ...t, column: isDone ? "doing" : "done" } : t
          ),
        };
      });
    }
  }

  const universoExport = (m: number): Obrigacao[] => {
    const base = clienteSelecionado
      ? obrigacoesParaCliente(m, {
          municipio: clienteSelecionado.municipio,
          uf: clienteSelecionado.uf,
          taxRegime: clienteSelecionado.taxRegime,
        }, ano)
      : obrigacoesDoMes(m, ano);
    let out = tipoFiltro === "todos" ? base : base.filter((o) => o.tipo === tipoFiltro);
    if (municipioFiltro !== "Todos" && !clienteSelecionado) {
      out = out.filter((o) => o.tipo !== "municipal" || o.ente === municipioFiltro);
    }
    if (regimeFiltro !== "todos" && !clienteSelecionado) {
      const label = REGIME_LABEL[regimeFiltro];
      out = out.filter((o) => !o.regimes || !o.regimes.length || (label && o.regimes.includes(label)));
    }
    return out;
  };

  return (
    <div className="flex flex-col gap-0 h-full -m-6">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 space-y-4 shrink-0">
        <ActiveClientFilterChip />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Calendário</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Obrigações fiscais e tarefas do escritório
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setExportOpen(true)}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> Exportar
            </Button>
          </div>
        </div>

        {/* Filtros regime + município */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground">Regime:</span>
          {(["todos","SN","LP","LR"] as const).map((r) => (
            <Button key={r} variant={regimeFiltro === r ? "default" : "outline"} size="sm"
              onClick={() => setRegimeFiltro(r)} disabled={!!clienteSelecionado}
              className="text-[11px] h-6 px-2">
              {r === "todos" ? "Todos" : REGIME_LABEL[r]}
            </Button>
          ))}
          <span className="text-xs font-medium text-muted-foreground ml-2">Município:</span>
          {MUNICIPIOS_DISPONIVEIS.map((m) => (
            <Button key={m} variant={municipioFiltro === m ? "default" : "outline"} size="sm"
              onClick={() => setMunicipioFiltro(m)} disabled={!!clienteSelecionado}
              className="text-[11px] h-6 px-2">
              {m}
            </Button>
          ))}
        </div>
      </div>

      <ExportarCalendarioDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        cliente={clienteSelecionado ? {
          nome: clienteSelecionado.name,
          cnpj: clienteSelecionado.cnpj,
          municipio: clienteSelecionado.municipio,
          uf: clienteSelecionado.uf,
          taxRegime: clienteSelecionado.taxRegime,
        } : null}
        getObrigacoes={universoExport}
        modoInicial="apenas_obrigacoes"
        fileBase={clienteSelecionado
          ? `calendario-${clienteSelecionado.name.replace(/\s+/g, "_").toLowerCase()}`
          : "calendario"}
      />

      {/* Calendário + painel lateral */}
      <div className="flex flex-1 min-h-0 overflow-hidden border-t">
        {/* Grade */}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          {/* Navegação de mês */}
          <div className="flex items-center justify-between px-6 py-3 border-b bg-card shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={mesAnterior}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-bold min-w-[200px] text-center">
                {MES_NOMES[mes - 1]} <span className="font-normal text-muted-foreground">{ano}</span>
              </h2>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={proximoMes}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isCurrentMonth && (
                <Button variant="ghost" size="sm" className="text-xs h-7"
                  onClick={() => { setMes(agora.getMonth() + 1); setAno(agora.getFullYear()); }}>
                  Hoje
                </Button>
              )}
            </div>

            {/* Legenda — clique para filtrar */}
            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => setTipoFiltro("todos")}
                className={cn("flex items-center gap-1 cursor-pointer transition-opacity",
                  tipoFiltro === "todos" ? "text-foreground font-semibold" : "text-muted-foreground opacity-50 hover:opacity-80"
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                Todos
              </button>
              {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setTipoFiltro(tipoFiltro === key ? "todos" : key)}
                  className={cn("flex items-center gap-1 cursor-pointer transition-opacity",
                    tipoFiltro === key
                      ? "text-foreground font-semibold"
                      : tipoFiltro !== "todos"
                        ? "text-muted-foreground opacity-30 hover:opacity-60"
                        : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full", cfg.dot)} />
                  {cfg.label}
                </button>
              ))}
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                Tarefa
              </span>
            </div>
          </div>

          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 border-b shrink-0">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {/* Células dos dias */}
          <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: "minmax(110px, 1fr)" }}>
            {cells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="border-b border-r last:border-r-0 bg-muted/20" />;
              }

              const obs   = obByDay[day] ?? [];
              const tasks = taskByDay[day] ?? [];
              const isToday      = isCurrentMonth && day === today;
              const isSelected   = selectedDay?.day === day;
              const hasObs       = obs.length > 0;
              const hasTasks     = tasks.length > 0;
              const MAX_VISIBLE  = 3;

              // Chips a mostrar: obrigações primeiro, depois tarefas
              const allItems: Array<{ label: string; cls: string; done?: boolean }> = [
                ...obs.map((o) => ({ label: o.nome, cls: TIPO_CONFIG[o.tipo].chip })),
                ...tasks.map((t) => ({
                  label: t.title,
                  cls: t.column === "done"
                    ? "bg-green-100 text-green-800 line-through opacity-70"
                    : "bg-teal-100 text-teal-800",
                  done: t.column === "done",
                })),
              ];
              const visible  = allItems.slice(0, MAX_VISIBLE);
              const overflow = allItems.length - MAX_VISIBLE;

              return (
                <div
                  key={day}
                  onClick={() => openDay(day)}
                  className={cn(
                    "border-b border-r last:border-r-0 p-1.5 cursor-pointer transition-colors flex flex-col gap-1 min-h-[110px]",
                    isSelected ? "bg-primary/5 ring-inset ring-2 ring-primary/40" : "hover:bg-muted/30",
                    isToday ? "bg-orange-50/60" : "",
                  )}
                >
                  {/* Número do dia */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn(
                      "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full",
                      isToday ? "bg-orange-500 text-white" : "text-foreground",
                    )}>
                      {day}
                    </span>
                    {(hasObs || hasTasks) && (
                      <div className="flex gap-0.5">
                        {hasObs && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        {hasTasks && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                      </div>
                    )}
                  </div>

                  {/* Chips de eventos */}
                  <div className="flex flex-col gap-0.5 flex-1">
                    {visible.map((item, i) => (
                      <span
                        key={i}
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded truncate leading-tight",
                          item.cls,
                        )}
                        title={item.label}
                      >
                        {item.label}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="text-[10px] text-muted-foreground px-1.5">
                        +{overflow} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel lateral */}
        {selectedDay && (
          <DayPanel
            sel={selectedDay}
            ano={ano}
            mes={mes}
            onClose={() => setSelectedDay(null)}
            onToggleTask={onToggleTask}
          />
        )}
      </div>

      {/* Rodapé */}
      <div className="px-6 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
        <Info className="h-3 w-3 shrink-0" />
        Prazos indicam o vencimento padrão — verifique os portais oficiais{" "}
        <a href="https://www.gov.br/receitafederal" target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5">
          Receita Federal <ExternalLink className="h-2.5 w-2.5" />
        </a>{" "}e{" "}
        <a href="https://portal.fazenda.sp.gov.br" target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5">
          SEFAZ-SP <ExternalLink className="h-2.5 w-2.5" />
        </a>.
        Tarefas: clique no dia e marque como concluída no painel.
      </div>
    </div>
  );
};

export default Calendario;
