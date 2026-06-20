import { useEffect, useMemo, useRef, useState } from "react";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { ActiveClientFilterChip } from "@/components/ActiveClientFilterChip";
import { apiClients } from "@/lib/api";
import html2canvas from "html2canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, FileText, Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import {
  AtividadeTrim, calcularTrim, compararTrim, fmtPctTrim,
  TRIMESTRES, TrimestreId, LIMITE_MAJORACAO,
} from "@/lib/apuracao-trim";
import { MoneyInput } from "@/components/MoneyInput";
import { PercentInput } from "@/components/PercentInput";
import { ComparativoBarChart, ImpactoReceitaPie } from "@/components/ImpactoCharts";
import { exportApuracaoTrimestralPDF, exportApuracaoTrimestralXLSX } from "@/lib/exporters";
import { FileSpreadsheet } from "lucide-react";
import { formatBRL } from "@/lib/tax-engine";
import { toast } from "sonner";

const uid = () => Math.random().toString(36).slice(2, 9);

const PRESETS = [
  { label: "Comércio/Indústria", ir: 8, csll: 12 },
  { label: "Serviços em geral", ir: 32, csll: 32 },
  { label: "Transporte de cargas", ir: 8, csll: 12 },
  { label: "Transporte de passageiros", ir: 16, csll: 12 },
  { label: "Revenda combustíveis", ir: 1.6, csll: 12 },
  { label: "Serviços hospitalares", ir: 8, csll: 12 },
];

const maskCNPJ = (v: string) =>
  v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
const onlyDigits = (v: string) => v.replace(/\D/g, "");

export default function ApuracaoTrimestral() {
  const [trimestre, setTrimestre] = useState<TrimestreId>("1T2026");
  const [empresa, setEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [buscando, setBuscando] = useState(false);

  // Pré-popula empresa+CNPJ pelo primeiro cliente do filtro global,
  // só se os campos ainda estiverem vazios (não sobrescreve digitação).
  const { selectedIds } = useSelectedClients();
  useEffect(() => {
    if (!selectedIds.length) return;
    if (empresa.trim() || cnpj.trim()) return;
    let cancelled = false;
    apiClients.list().then((all) => {
      if (cancelled) return;
      const first = selectedIds.map((id) => all.find((c) => c.id === id)).find((c) => !!c);
      if (first) {
        setEmpresa(first.name || "");
        if (first.cnpj) setCnpj(first.cnpj);
      }
    }).catch(() => { /* silencioso */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);
  const [exporting, setExporting] = useState(false);

  const chartBarRef = useRef<HTMLDivElement>(null);
  const chartPieRef = useRef<HTMLDivElement>(null);

  const [atividades, setAtividades] = useState<AtividadeTrim[]>([
    { id: uid(), nome: "Comércio", presuncaoIR: 8, presuncaoCSLL: 12, receita: 0 },
  ]);
  const [receitaFinanceira, setReceitaFinanceira] = useState(0);
  const [irrf, setIrrf] = useState(0);
  const [csllRet, setCsllRet] = useState(0);
  const [pisRet, setPisRet] = useState(0);
  const [cofinsRet, setCofinsRet] = useState(0);

  const trimInfo = TRIMESTRES.find((t) => t.id === trimestre)!;
  const input = { atividades, receitaFinanceira, irrfRetido: irrf, csllRetida: csllRet, pisRetido: pisRet, cofinsRetida: cofinsRet, trimestre };
  const resultado = useMemo(() => calcularTrim(input), [input]);
  const comp = useMemo(() => compararTrim(input), [input]);

  const updateAt = (id: string, patch: Partial<AtividadeTrim>) =>
    setAtividades((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addAt = (preset?: typeof PRESETS[number]) =>
    setAtividades((a) => [...a, { id: uid(), nome: preset?.label ?? "Nova atividade", presuncaoIR: preset?.ir ?? 8, presuncaoCSLL: preset?.csll ?? 12, receita: 0 }]);
  const removeAt = (id: string) => setAtividades((a) => a.filter((x) => x.id !== id));

  const buscarCNPJ = async () => {
    const d = onlyDigits(cnpj);
    if (d.length !== 14) { toast.error("Informe um CNPJ válido."); return; }
    setBuscando(true);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
      if (!r.ok) throw new Error();
      const j = await r.json();
      setEmpresa(j.razao_social || j.nome_fantasia || "");
      toast.success("Dados da empresa carregados.");
    } catch { toast.error("Não foi possível consultar o CNPJ."); }
    finally { setBuscando(false); }
  };

  const captureRef = async (ref: React.RefObject<HTMLDivElement>): Promise<string | undefined> => {
    if (!ref.current) return undefined;
    try {
      const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2 });
      return canvas.toDataURL("image/png");
    } catch { return undefined; }
  };

  const persistirHistorico = () => {
    if (!empresa.trim() && !cnpj.trim()) return;
    try {
      const HIST_KEY = "apuracao_trim_historico:v1";
      const prev = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      const entry = {
        empresa, cnpj, trimestre,
        atividades, receitaFinanceira,
        retencoes: { irrf, csll: csllRet, pis: pisRet, cofins: cofinsRet },
        resultado, comp,
        criadoEm: new Date().toISOString(),
      };
      // Substitui se já existir mesmo cnpj+trimestre
      const filtered = (prev as any[]).filter(
        (e) => !(e.cnpj === cnpj && e.trimestre === trimestre),
      );
      filtered.push(entry);
      localStorage.setItem(HIST_KEY, JSON.stringify(filtered));
    } catch { /* quota cheia: ignora */ }
  };

  const exportar = async () => {
    setExporting(true);
    try {
      const [chartBar, chartPie] = await Promise.all([captureRef(chartBarRef), captureRef(chartPieRef)]);
      await exportApuracaoTrimestralPDF({
        empresa, cnpj, trimestre, comp, atividades, receitaFinanceira,
        retencoes: { irrf, csll: csllRet, pis: pisRet, cofins: cofinsRet },
        chartBar, chartPie,
      });
      persistirHistorico();
      toast.success("PDF gerado.");
    } catch (e) { console.error(e); toast.error("Falha ao gerar PDF."); }
    finally { setExporting(false); }
  };

  return (
    <div className="space-y-6">
      <ActiveClientFilterChip />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Apuração Trimestral — IRPJ / CSLL</h1>
          <p className="text-sm text-muted-foreground">Lucro Presumido com majoração da LC nº 224/2025 (IN RFB nº 2.305/2025)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportar} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                exportApuracaoTrimestralXLSX({
                  empresa, cnpj, trimestre, comp, atividades, receitaFinanceira,
                  retencoes: { irrf, csll: csllRet, pis: pisRet, cofins: cofinsRet },
                });
                persistirHistorico();
                toast.success("Excel gerado.");
              } catch (e) { console.error(e); toast.error("Falha ao gerar Excel."); }
            }}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <Label className="text-xs">CNPJ</Label>
            <div className="flex gap-2">
              <Input value={cnpj} onChange={(e) => setCnpj(maskCNPJ(e.target.value))} onBlur={() => onlyDigits(cnpj).length === 14 && buscarCNPJ()} placeholder="00.000.000/0000-00" className="font-mono" />
              <Button variant="secondary" onClick={buscarCNPJ} disabled={buscando} size="icon" aria-label="Buscar CNPJ">
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="md:col-span-5">
            <Label className="text-xs">Razão Social</Label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Período</Label>
            <Select value={trimestre} onValueChange={(v) => setTrimestre(v as TrimestreId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIMESTRES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-12 rounded-md bg-muted/60 border border-border px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Majoração aplicável:</strong>{" "}
            {trimInfo.majoraIR ? "IRPJ ✓" : "IRPJ —"} · {trimInfo.majoraCSLL ? "CSLL ✓" : "CSLL — (a partir do 2º Trim/2026)"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Receitas por Atividade</span>
            <span className="text-sm font-normal text-muted-foreground tabular-nums">Total: {formatBRL(resultado.receitaTotal)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {atividades.map((a) => (
            <div key={a.id} className="grid grid-cols-12 gap-3 items-end rounded-lg border border-border p-3 bg-muted/30">
              <div className="col-span-12 md:col-span-4">
                <Label className="text-xs">Atividade</Label>
                <Input value={a.nome} onChange={(e) => updateAt(a.id, { nome: e.target.value })} />
              </div>
              <div className="col-span-4 md:col-span-2">
                <Label className="text-xs">Pres. IR</Label>
                <PercentInput value={a.presuncaoIR / 100} onValueChange={(n) => updateAt(a.id, { presuncaoIR: n * 100 })} />
              </div>
              <div className="col-span-4 md:col-span-2">
                <Label className="text-xs">Pres. CSLL</Label>
                <PercentInput value={a.presuncaoCSLL / 100} onValueChange={(n) => updateAt(a.id, { presuncaoCSLL: n * 100 })} />
              </div>
              <div className="col-span-3 md:col-span-3">
                <Label className="text-xs">Receita do Trimestre</Label>
                <MoneyInput value={a.receita} onValueChange={(n) => updateAt(a.id, { receita: n })} />
              </div>
              <div className="col-span-1">
                <Button variant="ghost" size="icon" onClick={() => removeAt(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => addAt()} className="gap-2"><Plus className="h-4 w-4" /> Adicionar</Button>
            {PRESETS.map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => addAt(p)}>+ {p.label}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Outras Receitas e Retenções</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Receita Financeira</Label><MoneyInput value={receitaFinanceira} onValueChange={setReceitaFinanceira} /></div>
          <div><Label>IRRF Retido</Label><MoneyInput value={irrf} onValueChange={setIrrf} /></div>
          <div><Label>CSLL Retida</Label><MoneyInput value={csllRet} onValueChange={setCsllRet} /></div>
          <div><Label>PIS Retido</Label><MoneyInput value={pisRet} onValueChange={setPisRet} /></div>
          <div><Label>COFINS Retida</Label><MoneyInput value={cofinsRet} onValueChange={setCofinsRet} /></div>
        </CardContent>
      </Card>

      {/* Cards de impacto */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardContent className="pt-5">
            <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">Total a Recolher</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{formatBRL(comp.comMajoracao.totalAPagar)}</div>
            <div className="text-[11px] opacity-80 mt-1">
              Carga sobre receita: <span className="font-semibold tabular-nums">
                {comp.comMajoracao.receitaTotal > 0 ? ((comp.comMajoracao.totalAPagar / comp.comMajoracao.receitaTotal) * 100).toFixed(2) : "0,00"}%
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-5">
            <div className="text-[11px] uppercase tracking-wider text-destructive font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Aumento (R$)
            </div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-destructive">+{formatBRL(comp.diffTotal)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">vs. regra anterior (até 12/2025)</div>
          </CardContent>
        </Card>
        <Card className="border-primary bg-primary/10">
          <CardContent className="pt-5">
            <div className="text-[11px] uppercase tracking-wider text-secondary font-semibold">Aumento (%)</div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-secondary">+{fmtPctTrim(comp.pctTotal)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">No total de IRPJ + CSLL</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Comparativo por Tributo</CardTitle></CardHeader>
          <CardContent><div ref={chartBarRef}><ComparativoBarChart comp={comp} /></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Impacto sobre a Receita</CardTitle></CardHeader>
          <CardContent><div ref={chartPieRef}><ImpactoReceitaPie comp={comp} /></div></CardContent>
        </Card>
      </div>

      {/* Tabela comparativa */}
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Comparativo: Sem × Com Majoração
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-secondary text-secondary-foreground">
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-right">Sem Majoração</th>
                  <th className="p-2 text-right">Com Majoração</th>
                  <th className="p-2 text-right">Diferença</th>
                  <th className="p-2 text-right">Aumento %</th>
                </tr>
              </thead>
              <tbody className="tabular-nums font-mono">
                <Row label="IRPJ" a={comp.semMajoracao.irpjAPagar} b={comp.comMajoracao.irpjAPagar} d={comp.diffIRPJ} p={comp.pctIRPJ} />
                <Row label="CSLL" a={comp.semMajoracao.csllAPagar} b={comp.comMajoracao.csllAPagar} d={comp.diffCSLL} p={comp.pctCSLL} />
                <tr className="font-bold bg-primary/10 border-t-2 border-primary">
                  <td className="p-2 font-sans">TOTAL</td>
                  <td className="p-2 text-right">{formatBRL(comp.semMajoracao.totalAPagar)}</td>
                  <td className="p-2 text-right">{formatBRL(comp.comMajoracao.totalAPagar)}</td>
                  <td className="p-2 text-right text-destructive">+{formatBRL(comp.diffTotal)}</td>
                  <td className="p-2 text-right text-destructive">+{fmtPctTrim(comp.pctTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Limite trimestral para majoração: <strong>{formatBRL(LIMITE_MAJORACAO)}</strong> ·
            Excedente sujeito a +10% sobre presunção: <strong>{formatBRL(Math.max(0, comp.comMajoracao.receitaTotal - LIMITE_MAJORACAO))}</strong>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, a, b, d, p }: { label: string; a: number; b: number; d: number; p: number }) {
  return (
    <tr className="border-b border-border">
      <td className="p-2 font-sans">{label}</td>
      <td className="p-2 text-right">{formatBRL(a)}</td>
      <td className="p-2 text-right">{formatBRL(b)}</td>
      <td className="p-2 text-right text-destructive">+{formatBRL(d)}</td>
      <td className="p-2 text-right text-destructive">+{fmtPctTrim(p)}</td>
    </tr>
  );
}
