import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Info, ExternalLink, Scale, Database, Plug, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

const TIPO_CONFIG: Record<Esfera, { label: string; color: string; bg: string }> = {
  federal:     { label: "Federal",     color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  estadual:    { label: "Estadual",    color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  municipal:   { label: "Municipal",   color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  trabalhista: { label: "Trabalhista", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
};

const MES_NOMES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const REGIME_LABEL: Record<string, RegimeAplicavel> = {
  SN: "Simples Nacional",
  LP: "Lucro Presumido",
  LR: "Lucro Real",
  MEI: "MEI",
};

const MUNICIPIOS_DISPONIVEIS = [
  "Todos",
  "São Paulo/SP",
  "Osasco/SP",
  "Barueri/SP",
  "Santana de Parnaíba/SP",
  "Cotia/SP",
  "Santo André/SP",
  "São Bernardo do Campo/SP",
];

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
  const [selected, setSelected] = useState<Obrigacao | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  function mesAnterior() {
    if (mes === 1) { setMes(12); setAno((a) => a - 1); }
    else setMes((m) => m - 1);
  }
  function proximoMes() {
    if (mes === 12) { setMes(1); setAno((a) => a + 1); }
    else setMes((m) => m + 1);
  }

  useEffect(() => {
    apiClients.list().then(setClientes).catch(() => {
      // silencioso — calendário funciona sem clientes
    });
  }, []);

  // Pré-seleciona automaticamente o primeiro cliente do filtro global do header
  useEffect(() => {
    if (!clientes.length) return;
    if (selectedIds.length > 0) {
      const first = selectedIds.find((id) => clientes.some((c) => c.id === id));
      if (first && first !== clienteId) setClienteId(first);
    } else if (clienteId !== "_none") {
      setClienteId("_none");
    }
    // só reage a mudanças do filtro global / lista de clientes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, clientes]);

  const clienteSelecionado = useMemo(
    () => clientes.find((c) => c.id === clienteId) || null,
    [clientes, clienteId],
  );

  // Quando seleciona um cliente, alinha os filtros visuais ao perfil dele
  useEffect(() => {
    if (!clienteSelecionado) return;
    if (clienteSelecionado.municipio && clienteSelecionado.uf) {
      const ente = `${clienteSelecionado.municipio}/${clienteSelecionado.uf}`;
      if (MUNICIPIOS_DISPONIVEIS.includes(ente)) setMunicipioFiltro(ente);
    }
    if (clienteSelecionado.taxRegime) setRegimeFiltro(clienteSelecionado.taxRegime);
  }, [clienteSelecionado]);

  // Quando há cliente, usamos a função inteligente; senão o fluxo manual de filtros
  const obrigacoesBase = useMemo<Obrigacao[]>(() => {
    if (clienteSelecionado) {
      return obrigacoesParaCliente(mes, {
        municipio: clienteSelecionado.municipio,
        uf: clienteSelecionado.uf,
        taxRegime: clienteSelecionado.taxRegime,
      });
    }
    return obrigacoesDoMes(mes);
  }, [mes, clienteSelecionado]);

  const filtradas = useMemo(() => {
    let out = tipoFiltro === "todos"
      ? obrigacoesBase
      : obrigacoesBase.filter((o) => o.tipo === tipoFiltro);
    if (municipioFiltro !== "Todos" && !clienteSelecionado) {
      out = out.filter((o) => o.tipo !== "municipal" || o.ente === municipioFiltro);
    }
    if (regimeFiltro !== "todos" && !clienteSelecionado) {
      const label = REGIME_LABEL[regimeFiltro];
      out = out.filter((o) => !o.regimes || !o.regimes.length || (label && o.regimes.includes(label)));
    }
    return [...out].sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome));
  }, [obrigacoesBase, tipoFiltro, municipioFiltro, regimeFiltro, clienteSelecionado]);

  const vencendoHoje = filtradas.filter((o) => {
    const d = new Date(ano, mes - 1, o.dia);
    return d.getFullYear() === agora.getFullYear() &&
           d.getMonth() === agora.getMonth() &&
           d.getDate() === agora.getDate();
  });

  // Próximas 7 dias — considera cruzamento de virada de mês corretamente
  const proximas7 = (() => {
    const amanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
    const limite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 7, 23, 59, 59);

    const doCurrent = filtradas.filter((o) => {
      const d = new Date(ano, mes - 1, o.dia);
      return d >= amanha && d <= limite;
    });

    // Se o limite entra no mês seguinte, busca obrigações desse mês também
    if (limite.getMonth() !== amanha.getMonth() || limite.getFullYear() !== amanha.getFullYear()) {
      const nextMes = mes === 12 ? 1 : mes + 1;
      const nextAno = mes === 12 ? ano + 1 : ano;
      const nextBase = clienteSelecionado
        ? obrigacoesParaCliente(nextMes, {
            municipio: clienteSelecionado.municipio,
            uf: clienteSelecionado.uf,
            taxRegime: clienteSelecionado.taxRegime,
          })
        : obrigacoesDoMes(nextMes);
      const nextFilt = tipoFiltro === "todos"
        ? nextBase
        : nextBase.filter((o) => o.tipo === tipoFiltro);
      const doNext = nextFilt.filter((o) => {
        const d = new Date(nextAno, nextMes - 1, o.dia);
        return d >= amanha && d <= limite;
      });
      return [...doCurrent, ...doNext];
    }

    return doCurrent;
  })();

  /** Universo de obrigações para o diálogo de exportação — respeita
   *  cliente (se houver) ou os filtros visuais atuais (regime/município/esfera). */
  const universoExport = (m: number): Obrigacao[] => {
    const base = clienteSelecionado
      ? obrigacoesParaCliente(m, {
          municipio: clienteSelecionado.municipio,
          uf: clienteSelecionado.uf,
          taxRegime: clienteSelecionado.taxRegime,
        })
      : obrigacoesDoMes(m);
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
    <div className="space-y-6 p-6">
      <ActiveClientFilterChip />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Calendário de Obrigações Fiscais</h1>
          <p className="text-muted-foreground mt-1">
            Prazos federais, estaduais (SP) e municipais (região) com embasamento legal,
            tributos vinculados e fonte dos dados no Hub.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <FileDown className="h-4 w-4 mr-1.5" /> Exportar calendário
          </Button>
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
          : `calendario`}
      />

      {/* Alertas do dia */}
      {vencendoHoje.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="font-semibold text-orange-800 flex items-center gap-2">
            <Info className="h-4 w-4" />
            {vencendoHoje.length} obrigação(ões) vencem HOJE ({agora.toLocaleDateString("pt-BR")})
          </p>
          <ul className="mt-2 space-y-1">
            {vencendoHoje.map((o) => (
              <li key={o.id} className="text-sm text-orange-700 font-medium">• {o.nome}: {o.descricao}</li>
            ))}
          </ul>
        </div>
      )}
      {proximas7.length > 0 && vencendoHoje.length === 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="font-semibold text-yellow-800 flex items-center gap-2">
            <Info className="h-4 w-4" />
            {proximas7.length} obrigação(ões) vencem nos próximos 7 dias
          </p>
          <ul className="mt-2 space-y-1">
            {proximas7.map((o) => (
              <li key={o.id} className="text-sm text-yellow-700">
                • Dia {o.dia}: <span className="font-medium">{o.nome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navegação de mês */}
      <Card>
        <CardHeader className="pb-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={mesAnterior}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {MES_NOMES[mes - 1]} <span className="text-muted-foreground font-normal text-base">{ano}</span>
              </CardTitle>
              <Button variant="outline" size="icon" onClick={proximoMes}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["todos","federal","estadual","municipal","trabalhista"] as const).map((t) => (
                <Button
                  key={t}
                  variant={tipoFiltro === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTipoFiltro(t)}
                  className="capitalize"
                >
                  {t === "todos" ? "Todos" : TIPO_CONFIG[t]?.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Regime:</span>
            {(["todos", "SN", "LP", "LR"] as const).map((r) => (
              <Button
                key={r}
                variant={regimeFiltro === r ? "default" : "outline"}
                size="sm"
                onClick={() => setRegimeFiltro(r)}
                disabled={!!clienteSelecionado}
                className="text-[11px] h-7 px-2"
              >
                {r === "todos" ? "Todos" : REGIME_LABEL[r]}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Município:</span>
            {MUNICIPIOS_DISPONIVEIS.map((m) => (
              <Button
                key={m}
                variant={municipioFiltro === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMunicipioFiltro(m)}
                disabled={!!clienteSelecionado}
                className="text-[11px] h-7 px-2"
              >
                {m}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtradas.length === 0 && (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nenhuma obrigação encontrada para este filtro.
            </p>
          )}
          {filtradas.map((o) => {
            const cfg = TIPO_CONFIG[o.tipo];
            const dOblg = new Date(ano, mes - 1, o.dia);
            const isHoje = dOblg.getFullYear() === agora.getFullYear() && dOblg.getMonth() === agora.getMonth() && dOblg.getDate() === agora.getDate();
            const isProxima = (() => { const am = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1); const lim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 7, 23, 59, 59); return dOblg >= am && dOblg <= lim; })();
            const isOpen = selected?.id === o.id;
            const tributos = o.tributoIds.map((tid) => TRIBUTOS[tid]).filter(Boolean);
            const fontes = Array.from(
              new Set(o.tributoIds.flatMap((tid) => fontesPorTributo(tid).map((f) => f.nome))),
            );
            return (
              <button
                key={o.id}
                onClick={() => setSelected(isOpen ? null : o)}
                className={cn(
                  "w-full text-left rounded-xl border p-4 transition-all hover:shadow-sm",
                  cfg.bg,
                  isHoje && "ring-2 ring-orange-500",
                  isProxima && !isHoje && "ring-1 ring-yellow-400",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-lg",
                      isHoje ? "bg-orange-500 text-white" : isProxima ? "bg-yellow-400 text-yellow-900" : "bg-white",
                      cfg.color,
                    )}>
                      {o.dia}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-semibold", cfg.color)}>{o.nome}</p>
                      {o.ente && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{o.ente}</p>
                      )}
                      {tributos.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tributos.map((t) => (
                            <Badge key={t.id} variant="outline" className="text-[10px] h-5 bg-white/70">
                              {t.sigla}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {isOpen && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-muted-foreground">{o.descricao}</p>
                          {o.regraVencimento && (
                            <p className="text-xs italic text-muted-foreground">
                              <strong>Vencimento:</strong> {o.regraVencimento}
                            </p>
                          )}
                          {o.embasamento && (
                            <div className="rounded-lg border bg-white/70 p-2.5">
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
                                <Scale className="h-3 w-3" /> Embasamento legal
                              </p>
                              <p className="text-xs mt-1 text-foreground">{o.embasamento}</p>
                            </div>
                          )}
                          {tributos.length > 0 && (
                            <div className="rounded-lg border bg-white/70 p-2.5">
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
                                <Database className="h-3 w-3" /> Tributos vinculados
                              </p>
                              <ul className="mt-1 space-y-0.5">
                                {tributos.map((t) => (
                                  <li key={t.id} className="text-xs text-foreground">
                                    <strong>{t.sigla}</strong> — {t.nome}
                                    {t.codigos && t.codigos.length > 0 && (
                                      <span className="text-muted-foreground"> ({t.codigos.join(", ")})</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {fontes.length > 0 && (
                            <div className="rounded-lg border bg-white/70 p-2.5">
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
                                <Plug className="h-3 w-3" /> Fonte dos dados no Hub
                              </p>
                              <p className="text-xs mt-1 text-foreground">{fontes.join(" • ")}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {o.regimes && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {o.regimes.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px] h-5">{r}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isHoje && <Badge className="bg-orange-500 text-white text-[10px]">Hoje</Badge>}
                    {isProxima && !isHoje && <Badge variant="outline" className="border-yellow-400 text-yellow-700 text-[10px]">Em breve</Badge>}
                    <Badge variant="outline" className={cn("text-[10px]", cfg.color)}>{cfg.label}</Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium">Legenda:</span>
        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
          <span key={key} className={cn("flex items-center gap-1.5", cfg.color)}>
            <span className={cn("h-3 w-3 rounded-full", cfg.bg, "border")} />
            {cfg.label}
          </span>
        ))}
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Clique em qualquer obrigação para ver descrição, <strong>embasamento legal</strong>,
          tributos vinculados e fonte dos dados. Os prazos indicam o vencimento padrão —
          verifique sempre os portais oficiais
          (<a href="https://www.gov.br/receitafederal" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Receita Federal <ExternalLink className="h-3 w-3" /></a>,
          {" "}<a href="https://portal.fazenda.sp.gov.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">SEFAZ-SP <ExternalLink className="h-3 w-3" /></a>),
          pois podem ocorrer postergações por feriados ou atos normativos.
        </span>
      </p>
    </div>
  );
};

export default Calendario;
