import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, FileBarChart2, Info, Save, TrendingDown, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { apiClients, apiSimulations, type Client, type Simulation } from "@/lib/api";
import type { SimulationInput, SimulationResult, MonthResult } from "@/lib/tax-engine";
import { REGIME_LABELS, type RegimeKey } from "@/lib/tax-engine";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DRELREntry {
  cpv: number;              // Custo dos Produtos/Serviços
  despVendas: number;       // Despesas de Vendas
  despAdmin: number;        // Despesas Gerais e Administrativas
  despPessoalExtra: number; // Despesas com Pessoal (além da folha da simulação)
  depreciacao: number;      // Depreciação e Amortização
  recFinanceiras: number;   // Receitas Financeiras
  despFinanceiras: number;  // Despesas Financeiras
  outrasReceitas: number;   // Outras Receitas Operacionais
  outrasDespesas: number;   // Outras Despesas Operacionais
}

const EMPTY_LR: DRELREntry = {
  cpv: 0, despVendas: 0, despAdmin: 0, despPessoalExtra: 0,
  depreciacao: 0, recFinanceiras: 0, despFinanceiras: 0,
  outrasReceitas: 0, outrasDespesas: 0,
};

const LR_STORAGE_KEY = "econ_dre_lr_v1";

function loadLREntries(): Record<string, DRELREntry> {
  try { return JSON.parse(localStorage.getItem(LR_STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}
function saveLREntry(simId: string, entry: DRELREntry) {
  const all = loadLREntries();
  all[simId] = entry;
  localStorage.setItem(LR_STORAGE_KEY, JSON.stringify(all));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;

type RegimeOption = { key: RegimeKey; label: string; total: number };

const REGIME_FIELDS: Record<RegimeKey, keyof SimulationResult["totals"]> = {
  SN: "snTotal", LP: "lpTotal", IVA: "ivaTotal", SNH: "snhTotal",
};
const REGIME_MONTH_TOTAL: Record<RegimeKey, keyof MonthResult> = {
  SN: "totalSN", LP: "totalLP", IVA: "totalIVA", SNH: "totalSNH",
};

function parseBRL(v: string): number {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function inputBRL(v: number): string {
  return v === 0 ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Cálculo LR ───────────────────────────────────────────────────────────────

interface DRELRResult {
  receitaBruta: number;
  deducoes: number;         // PIS + COFINS + ISS (da simulação LP)
  receitaLiquida: number;
  cpv: number;
  lucroBruto: number;
  despOperacionais: number; // vendas + admin + pessoal + depr
  resultadoFinanceiro: number; // rec - desp financeiras
  outrasRecDespLiq: number;
  lair: number;
  irpj: number;
  csll: number;
  lucroLiquido: number;
}

function calcDRELR(simResult: SimulationResult, lr: DRELREntry): DRELRResult {
  const receitaBruta = simResult.totals.revenue;
  // Deduções: soma PIS+COFINS+ISS dos meses (dados do LP como proxy)
  const deducoes = simResult.months.reduce((acc, m) => acc + m.lpPIS + m.lpCOFINS + m.lpISS, 0);
  const receitaLiquida = receitaBruta - deducoes;
  const folhaSimulacao = simResult.totals.payrollGross;
  const totalPessoal = folhaSimulacao + lr.despPessoalExtra;
  const despOperacionais = lr.cpv + lr.despVendas + lr.despAdmin + totalPessoal + lr.depreciacao;
  const resultadoFinanceiro = lr.recFinanceiras - lr.despFinanceiras;
  const outrasRecDespLiq = lr.outrasReceitas - lr.outrasDespesas;
  const lair = receitaLiquida - despOperacionais + resultadoFinanceiro + outrasRecDespLiq;
  // IRPJ: 15% sobre LAIR + 10% adicional sobre excedente de R$ 240k/ano
  const irpjBase = Math.max(0, lair);
  const irpj = irpjBase * 0.15 + Math.max(0, irpjBase - 240_000) * 0.10;
  const csll = Math.max(0, lair) * 0.09;
  const lucroBruto = receitaLiquida - lr.cpv;
  return {
    receitaBruta, deducoes, receitaLiquida,
    cpv: lr.cpv, lucroBruto,
    despOperacionais, resultadoFinanceiro, outrasRecDespLiq,
    lair, irpj, csll,
    lucroLiquido: lair - irpj - csll,
  };
}

// ─── Linha DRE ────────────────────────────────────────────────────────────────

function DRERow({
  label, value, indent = 0, bold = false, negative = false, separator = false, highlight,
}: {
  label: string; value: number; indent?: number; bold?: boolean;
  negative?: boolean; separator?: boolean; highlight?: "green" | "red";
}) {
  const color = highlight === "green" ? "text-green-700" : highlight === "red" ? "text-red-600" : "";
  return (
    <tr className={`${separator ? "border-t-2 border-foreground/20" : "border-b border-border/40"} ${bold ? "font-bold" : ""}`}>
      <td className={`py-2 text-sm ${color}`} style={{ paddingLeft: `${indent * 16 + 8}px` }}>
        {label}
      </td>
      <td className={`py-2 text-sm text-right pr-2 ${color} ${negative && value !== 0 ? "text-red-600" : ""}`}>
        {negative && value !== 0 ? `(${fmt.format(value)})` : fmt.format(value)}
      </td>
    </tr>
  );
}

// ─── Input de campo numérico ──────────────────────────────────────────────────

function NumField({
  label, fieldKey, entry, onChange, help,
}: {
  label: string; fieldKey: keyof DRELREntry;
  entry: DRELREntry; onChange: (k: keyof DRELREntry, v: number) => void; help?: string;
}) {
  const [raw, setRaw] = useState(inputBRL(entry[fieldKey]));
  useEffect(() => { setRaw(inputBRL(entry[fieldKey])); }, [entry, fieldKey]);
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold">{label}</Label>
      <Input
        className="text-right h-9"
        placeholder="0,00"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => {
          const v = parseBRL(raw);
          onChange(fieldKey, v);
          setRaw(inputBRL(v));
        }}
      />
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DRESimplificada() {
  const { selectedIds } = useSelectedClients();
  const [clients, setClients] = useState<Client[]>([]);
  const [sims, setSims] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSimId, setSelectedSimId] = useState<string>("");
  const [selectedRegime, setSelectedRegime] = useState<RegimeKey>("LP");
  const [lrEntry, setLREntry] = useState<DRELREntry>(EMPTY_LR);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiClients.list().catch(() => []), apiSimulations.list().catch(() => [])])
      .then(([c, s]) => {
        setClients(Array.isArray(c) ? c : []);
        const list = Array.isArray(s) ? s : [];
        setSims(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (sims.length === 0) return;
    if (selectedIds.length === 1) {
      const clientSim = sims.find((s) => s.clientId === selectedIds[0]);
      if (clientSim) { setSelectedSimId(clientSim.id); return; }
    }
    if (!selectedSimId) setSelectedSimId(sims[0]?.id ?? "");
  }, [sims, selectedIds]);

  // Carrega entradas LR ao trocar simulação
  useEffect(() => {
    if (!selectedSimId) return;
    const all = loadLREntries();
    setLREntry(all[selectedSimId] ?? { ...EMPTY_LR });
  }, [selectedSimId]);

  const selectedSim = useMemo(() => sims.find((s) => s.id === selectedSimId), [sims, selectedSimId]);
  const simInput = selectedSim?.data as SimulationInput | undefined;
  const simResult = selectedSim?.result as SimulationResult | undefined;

  const regimeOptions = useMemo((): RegimeOption[] => {
    if (!simResult) return [];
    return (simResult.totals.byRegime ?? []).map(({ regime, total }) => ({
      key: regime, label: REGIME_LABELS[regime] ?? regime, total,
    }));
  }, [simResult]);

  useEffect(() => {
    if (simResult?.totals.bestRegime) setSelectedRegime(simResult.totals.bestRegime);
  }, [selectedSimId, simResult]);

  const clientName = useMemo(() => {
    if (!selectedSim) return null;
    if (selectedSim.clients?.name) return selectedSim.clients.name;
    return clients.find((x) => x.id === selectedSim.clientId)?.name ?? null;
  }, [selectedSim, clients]);

  const dreSimples = useMemo(() => {
    if (!simResult || !simInput) return null;
    const totalRevenue = simResult.totals.revenue;
    const totalTax = (simResult.totals as Record<string, number>)[REGIME_FIELDS[selectedRegime]] ?? 0;
    return { totalRevenue, totalTax, lucroEstimado: totalRevenue - totalTax, months: simResult.months };
  }, [simResult, simInput, selectedRegime]);

  const dreLR = useMemo(() => {
    if (!simResult) return null;
    return calcDRELR(simResult, lrEntry);
  }, [simResult, lrEntry]);

  const groupedSims = useMemo(() => {
    const byClient: Record<string, { client: Client | null; sims: Simulation[] }> = {};
    sims.forEach((s) => {
      const key = s.clientId ?? "__sem_cliente__";
      if (!byClient[key]) byClient[key] = { client: clients.find((c) => c.id === s.clientId) ?? null, sims: [] };
      byClient[key].sims.push(s);
    });
    return Object.values(byClient).sort((a, b) =>
      (a.client?.name ?? "Zzz").localeCompare(b.client?.name ?? "Zzz")
    );
  }, [sims, clients]);

  function handleLRChange(k: keyof DRELREntry, v: number) {
    setLREntry((prev) => ({ ...prev, [k]: v }));
  }
  function handleSaveLR() {
    if (!selectedSimId) return;
    saveLREntry(selectedSimId, lrEntry);
    toast({ title: "Salvo", description: "Dados contábeis salvos para esta simulação." });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <FileBarChart2 className="h-4 w-4" />
            <span>DRE Simplificada</span>
          </div>
          <h1 className="text-3xl font-display font-bold">Demonstração do Resultado</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Resultado estimado por regime tributário + apuração completa do Lucro Real com contas contábeis.
          </p>
        </div>
        <Link to="/app/painel-alertas">
          <Button variant="outline" className="gap-2">
            <Bell className="h-4 w-4" />
            Painel de Alertas
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando simulações...</div>
      ) : sims.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground space-y-2">
            <FileBarChart2 className="h-10 w-10 mx-auto opacity-30" />
            <p className="font-medium">Nenhuma simulação cadastrada</p>
            <Link to="/app/simulacoes">
              <Button variant="outline" size="sm" className="mt-2">Ir para Simulações</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
          {/* Sidebar */}
          <aside className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Simulações</h2>
            {groupedSims.map(({ client, sims: cs }) => (
              <div key={client?.id ?? "__sem_cliente__"} className="space-y-1">
                <div className="text-[11px] font-semibold text-muted-foreground px-2 py-0.5 truncate">
                  {client?.name ?? "Sem cliente"}
                </div>
                {cs.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSelectedSimId(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between gap-2 ${
                      selectedSimId === s.id ? "bg-black text-brand font-semibold" : "hover:bg-muted text-foreground"
                    }`}>
                    <span className="truncate">{s.name}</span>
                    <span className="text-xs shrink-0 opacity-60">{s.year}</span>
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Content */}
          {!selectedSim || !dreSimples ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Selecione uma simulação.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {/* Sim header */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <span>{selectedSim.name}</span>
                    <span className="text-muted-foreground font-normal text-sm">· {selectedSim.year}</span>
                    {clientName && <Badge variant="secondary" className="text-[11px]">{clientName}</Badge>}
                    {simResult?.totals.bestRegime && (
                      <Badge className="text-[11px] bg-green-100 text-green-800 border-green-300">
                        Melhor: {REGIME_LABELS[simResult.totals.bestRegime]}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {regimeOptions.map((ro) => (
                      <button key={ro.key} type="button" onClick={() => setSelectedRegime(ro.key)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                          selectedRegime === ro.key ? "bg-black text-brand border-transparent" : "border-border hover:bg-muted"
                        }`}>
                        {ro.label}
                        <span className="ml-2 text-xs opacity-70">{fmt.format(ro.total)}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="comparativo">
                <TabsList>
                  <TabsTrigger value="comparativo">Comparativo por Regime</TabsTrigger>
                  <TabsTrigger value="lucro-real">Lucro Real — Contas Contábeis</TabsTrigger>
                </TabsList>

                {/* ── Tab Comparativo ── */}
                <TabsContent value="comparativo" className="space-y-4 mt-4">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-5">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Receita Bruta</div>
                        <div className="text-2xl font-display font-bold mt-1">{fmt.format(dreSimples.totalRevenue)}</div>
                      </CardContent>
                    </Card>
                    <Card className="border-red-200">
                      <CardContent className="p-5">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Carga — {REGIME_LABELS[selectedRegime]}
                        </div>
                        <div className="text-2xl font-display font-bold mt-1 text-red-600">{fmt.format(dreSimples.totalTax)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {dreSimples.totalRevenue > 0 ? fmtPct(dreSimples.totalTax / dreSimples.totalRevenue) : "–"} da receita
                        </div>
                      </CardContent>
                    </Card>
                    <Card className={dreSimples.lucroEstimado >= 0 ? "border-green-200" : "border-red-200"}>
                      <CardContent className="p-5">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                          {dreSimples.lucroEstimado >= 0
                            ? <TrendingUp className="h-3 w-3 text-green-600" />
                            : <TrendingDown className="h-3 w-3 text-red-600" />}
                          Resultado antes de custos
                        </div>
                        <div className={`text-2xl font-display font-bold mt-1 ${dreSimples.lucroEstimado >= 0 ? "text-green-700" : "text-red-600"}`}>
                          {fmt.format(dreSimples.lucroEstimado)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Detalhamento mensal — {selectedSim.year}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-xs text-muted-foreground">
                              <th className="text-left py-2 pr-3 font-semibold">Mês</th>
                              <th className="text-right py-2 px-3 font-semibold">Receita</th>
                              <th className="text-right py-2 px-3 font-semibold">Impostos</th>
                              <th className="text-right py-2 px-3 font-semibold">Carga %</th>
                              <th className="text-right py-2 pl-3 font-semibold">Resultado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dreSimples.months.map((mr) => {
                              const tax = (mr as Record<string, number>)[REGIME_MONTH_TOTAL[selectedRegime]] ?? 0;
                              const res = mr.revenue - tax;
                              return (
                                <tr key={mr.month} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                                  <td className="py-2 pr-3 font-medium">{MES_ABREV[mr.month - 1]}</td>
                                  <td className="text-right py-2 px-3">{fmt.format(mr.revenue)}</td>
                                  <td className="text-right py-2 px-3 text-red-600">{fmt.format(tax)}</td>
                                  <td className="text-right py-2 px-3 text-muted-foreground">
                                    {mr.revenue > 0 ? fmtPct(tax / mr.revenue) : "–"}
                                  </td>
                                  <td className={`text-right py-2 pl-3 font-semibold ${res >= 0 ? "text-green-700" : "text-red-600"}`}>
                                    {fmt.format(res)}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-muted/30 font-bold">
                              <td className="py-2 pr-3">Total</td>
                              <td className="text-right py-2 px-3">{fmt.format(dreSimples.totalRevenue)}</td>
                              <td className="text-right py-2 px-3 text-red-600">{fmt.format(dreSimples.totalTax)}</td>
                              <td className="text-right py-2 px-3 text-muted-foreground">
                                {dreSimples.totalRevenue > 0 ? fmtPct(dreSimples.totalTax / dreSimples.totalRevenue) : "–"}
                              </td>
                              <td className={`text-right py-2 pl-3 ${dreSimples.lucroEstimado >= 0 ? "text-green-700" : "text-red-600"}`}>
                                {fmt.format(dreSimples.lucroEstimado)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                  <p className="text-xs text-muted-foreground border-t pt-3">
                    * Não inclui custos operacionais. Use a aba "Lucro Real" para apurar o LAIR com contas contábeis.
                  </p>
                </TabsContent>

                {/* ── Tab Lucro Real ── */}
                <TabsContent value="lucro-real" className="space-y-6 mt-4">
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Formulário de entradas */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          Contas Contábeis — Anual ({selectedSim.year})
                          <span className="text-[10px] text-muted-foreground font-normal">Valores anuais em R$</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Custos</p>
                          <NumField label="CPV / CSP — Custo dos Produtos ou Serviços Prestados"
                            fieldKey="cpv" entry={lrEntry} onChange={handleLRChange} />
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Despesas Operacionais</p>
                          <NumField label="Despesas de Vendas" fieldKey="despVendas" entry={lrEntry} onChange={handleLRChange} />
                          <NumField label="Despesas Gerais e Administrativas" fieldKey="despAdmin" entry={lrEntry} onChange={handleLRChange} />
                          <NumField label="Despesas com Pessoal (adicional à folha da simulação)"
                            fieldKey="despPessoalExtra" entry={lrEntry} onChange={handleLRChange}
                            help={`Folha já na simulação: ${fmt.format(simResult?.totals.payrollGross ?? 0)}`} />
                          <NumField label="Depreciação e Amortização" fieldKey="depreciacao" entry={lrEntry} onChange={handleLRChange} />
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resultado Financeiro</p>
                          <NumField label="Receitas Financeiras" fieldKey="recFinanceiras" entry={lrEntry} onChange={handleLRChange} />
                          <NumField label="Despesas Financeiras" fieldKey="despFinanceiras" entry={lrEntry} onChange={handleLRChange} />
                        </div>
                        <div className="space-y-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Outras Receitas/Despesas</p>
                          <NumField label="Outras Receitas Operacionais" fieldKey="outrasReceitas" entry={lrEntry} onChange={handleLRChange} />
                          <NumField label="Outras Despesas Operacionais" fieldKey="outrasDespesas" entry={lrEntry} onChange={handleLRChange} />
                        </div>
                        <Button className="w-full gap-2" onClick={handleSaveLR}>
                          <Save className="h-4 w-4" />
                          Salvar dados contábeis
                        </Button>
                      </CardContent>
                    </Card>

                    {/* DRE estruturada */}
                    {dreLR && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">DRE — Lucro Real ({selectedSim.year})</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <table className="w-full">
                            <tbody>
                              <DRERow label="(+) Receita Bruta" value={dreLR.receitaBruta} bold />
                              <DRERow label="(–) Deduções (PIS / COFINS / ISS)" value={dreLR.deducoes} indent={1} negative />
                              <DRERow label="= Receita Líquida" value={dreLR.receitaLiquida} bold separator />
                              <DRERow label="(–) CPV / CSP" value={dreLR.cpv} indent={1} negative />
                              <DRERow label="= Lucro Bruto" value={dreLR.lucroBruto} bold separator
                                highlight={dreLR.lucroBruto >= 0 ? "green" : "red"} />
                              <DRERow label="(–) Desp. Operacionais" value={dreLR.despOperacionais} indent={1} negative />
                              <DRERow label="(+/–) Resultado Financeiro"
                                value={Math.abs(dreLR.resultadoFinanceiro)}
                                negative={dreLR.resultadoFinanceiro < 0} indent={1} />
                              <DRERow label="(+/–) Outras Receitas/Despesas Líq."
                                value={Math.abs(dreLR.outrasRecDespLiq)}
                                negative={dreLR.outrasRecDespLiq < 0} indent={1} />
                              <DRERow label="= LAIR (Lucro Antes do IR)" value={dreLR.lair} bold separator
                                highlight={dreLR.lair >= 0 ? "green" : "red"} />
                              <DRERow label="(–) IRPJ (15% + 10% adicional)" value={dreLR.irpj} indent={1} negative />
                              <DRERow label="(–) CSLL (9%)" value={dreLR.csll} indent={1} negative />
                              <DRERow label="= Lucro Líquido do Exercício" value={dreLR.lucroLiquido} bold separator
                                highlight={dreLR.lucroLiquido >= 0 ? "green" : "red"} />
                            </tbody>
                          </table>

                          {/* Comparativo LR vs regimes */}
                          <div className="mt-5 pt-4 border-t space-y-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Comparativo — IRPJ+CSLL por regime
                            </p>
                            {[
                              { label: "Lucro Real (apurado)", value: dreLR.irpj + dreLR.csll, highlight: true },
                              ...regimeOptions.map((ro) => ({ label: ro.label, value: ro.total, highlight: false })),
                            ].map((item, i) => (
                              <div key={i} className={`flex items-center justify-between text-sm px-3 py-2 rounded-md ${
                                item.highlight ? "bg-black text-brand font-semibold" : "bg-muted/50"
                              }`}>
                                <span>{item.label}</span>
                                <span>{fmt.format(item.value)}</span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <Info className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>
                              Deduções calculadas com base nos dados de PIS/COFINS/ISS do Lucro Presumido da simulação.
                              IRPJ = 15% + 10% sobre LAIR &gt; R$ 240.000/ano. CSLL = 9%.
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
