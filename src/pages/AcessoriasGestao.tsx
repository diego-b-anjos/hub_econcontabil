import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Upload, FileSpreadsheet, FileText, Presentation, ArrowLeft,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, Download, History,
} from "lucide-react";
import { toast } from "sonner";
import { DataPersistencePanel } from "@/components/DataPersistencePanel";
import { safeSaveJSON } from "@/lib/safe-storage";
import {
  parseAcessoriasCSV, summarize, classifyStatus,
  STATUS_LABELS, STATUS_COLORS,
  previewMerge, applyMerge,
  type AcessoriasRow, type MergeMode, type MergePreview,
} from "@/lib/acessorias/parser";
import {
  exportAcessoriasPDF, exportAcessoriasExcel, exportAcessoriasPPTX,
  exportListPDF, exportListExcel, exportListPPTX,
  type AcessoriasExportOptions,
} from "@/lib/acessorias/exporters";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";

const STORAGE = "acessorias_gestao_entregas";
const HISTORY = "acessorias_gestao_history";

interface HistoryEntry {
  id: string;
  data: string;       // ISO
  competencias: string[];
  totalLinhas: number;
  modo: MergeMode | "initial";
}

export default function AcessoriasGestao() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AcessoriasRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filtroComp, setFiltroComp] = useState<string>("__all");
  const [filtroResp, setFiltroResp] = useState<string>("__all");
  const [filtroStatus, setFiltroStatus] = useState<string>("__all");
  const [busca, setBusca] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Drilldown
  const [drillKpi, setDrillKpi] = useState<null | "pontualidade" | "atraso" | "entregues" | "pendentes">(null);

  // Merge dialog
  const [mergeData, setMergeData] = useState<{ novos: AcessoriasRow[]; preview: MergePreview } | null>(null);
  const [mergeMode, setMergeMode] = useState<MergeMode>("merge_full");

  // Export dialog
  const [exportOpen, setExportOpen] = useState<null | "pdf" | "excel" | "pptx">(null);
  const [expCompetencias, setExpCompetencias] = useState<string[]>([]);
  const [expFocus, setExpFocus] = useState<"todas" | "pontuais" | "atrasadas">("todas");
  const [expSections, setExpSections] = useState({
    indicadores: true, porCompetencia: true, porResponsavel: true,
    porObrigacao: true, porEmpresa: true, cruzObrigResp: true,
    cruzEmpresaResp: true, detalhado: false, atrasadas: false,
  });
  const [expSlides, setExpSlides] = useState({
    capa: true, kpis: true, statusComp: true, responsaveis: true,
    empresasCriticas: true, obrigacoes: true, atrasadas: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setRows(JSON.parse(raw));
      const h = localStorage.getItem(HISTORY);
      if (h) setHistory(JSON.parse(h));
    } catch { /* noop */ }
  }, []);

  const persist = (r: AcessoriasRow[], hist?: HistoryEntry[]) => {
    setRows(r);
    try { localStorage.setItem(STORAGE, JSON.stringify(r)); } catch { /* noop */ }
    if (hist) {
      setHistory(hist);
      try { localStorage.setItem(HISTORY, JSON.stringify(hist)); } catch { /* noop */ }
    }
  };

  const handleFile = async (f: File) => {
    try {
      const buf = await f.arrayBuffer();
      let text = new TextDecoder("utf-8").decode(buf);
      if (text.includes("\uFFFD")) text = new TextDecoder("latin1").decode(buf);
      const parsed = parseAcessoriasCSV(text);
      if (!parsed.length) return toast.error("Arquivo sem registros válidos.");

      // Primeiro upload? Substitui direto
      if (!rows.length) {
        const comps = Array.from(new Set(parsed.map((r) => r.competencia).filter(Boolean)));
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          data: new Date().toISOString(),
          competencias: comps,
          totalLinhas: parsed.length,
          modo: "initial",
        };
        persist(parsed, [entry, ...history]);
        toast.success(`${parsed.length} tarefas importadas`);
        return;
      }

      // Acompanhamento mensal: detecta o que mudou
      const preview = previewMerge(rows, parsed);
      setMergeData({ novos: parsed, preview });
      // Modo padrão sugerido
      setMergeMode(preview.competenciasSobrepostas.length === 0 ? "append" : "merge_full");
    } catch {
      toast.error("Falha ao ler o arquivo.");
    }
  };

  const confirmMerge = () => {
    if (!mergeData) return;
    const merged = applyMerge(rows, mergeData.novos, mergeMode);
    const comps = Array.from(new Set(mergeData.novos.map((r) => r.competencia).filter(Boolean)));
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      competencias: comps,
      totalLinhas: mergeData.novos.length,
      modo: mergeMode,
    };
    persist(merged, [entry, ...history].slice(0, 30));
    setMergeData(null);
    toast.success("Base atualizada com acompanhamento mensal");
  };

  const competencias = useMemo(
    () => Array.from(new Set(rows.map((r) => r.competencia).filter(Boolean))).sort((a, b) => {
      const pa = a.split("/"); const pb = b.split("/");
      return (pa[1] + pa[0]).localeCompare(pb[1] + pb[0]);
    }),
    [rows],
  );
  const responsaveis = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => [r.responsavelPrazo, r.responsavelEntrega]).filter(Boolean))).sort(),
    [rows],
  );

  const filtrado = useMemo(() => {
    return rows.filter((r) => {
      if (filtroComp !== "__all" && r.competencia !== filtroComp) return false;
      if (filtroResp !== "__all" && r.responsavelPrazo !== filtroResp && r.responsavelEntrega !== filtroResp) return false;
      if (filtroStatus !== "__all" && classifyStatus(r.status) !== filtroStatus) return false;
      if (busca) {
        const b = busca.toLowerCase();
        if (!(r.empresa.toLowerCase().includes(b) || r.obrigacao.toLowerCase().includes(b) || r.cnpj.includes(b))) return false;
      }
      return true;
    });
  }, [rows, filtroComp, filtroResp, filtroStatus, busca]);

  const summary = useMemo(() => summarize(filtrado), [filtrado]);

  const periodoLabel = filtroComp !== "__all"
    ? `Competência ${filtroComp}`
    : (competencias.length ? `${competencias[0]} a ${competencias[competencias.length - 1]}` : "—");

  const statusChartData = (Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>)
    .map((k) => ({ name: STATUS_LABELS[k], value: summary.porStatus[k], color: STATUS_COLORS[k] }))
    .filter((d) => d.value > 0);

  // Drilldown: linhas para cada KPI
  const drillRows = useMemo(() => {
    if (!drillKpi) return [];
    return filtrado.filter((r) => {
      const b = classifyStatus(r.status);
      if (drillKpi === "pontualidade") return b === "antecipada" || b === "no_prazo";
      if (drillKpi === "atraso") return b === "atrasada";
      if (drillKpi === "entregues") return b === "antecipada" || b === "no_prazo" || b === "justificada";
      if (drillKpi === "pendentes") return b === "pendente";
      return false;
    });
  }, [drillKpi, filtrado]);

  const drillTitle: Record<NonNullable<typeof drillKpi>, { titulo: string; descricao: string }> = {
    pontualidade: {
      titulo: "Pontualidade",
      descricao: "Tarefas entregues dentro do prazo legal ou antecipadas — base do índice de pontualidade.",
    },
    atraso: {
      titulo: "Taxa de Atraso",
      descricao: "Tarefas entregues após o prazo legal, sem justificativa formal — compõem a taxa de atraso.",
    },
    entregues: {
      titulo: "Entregues",
      descricao: "Total de tarefas concluídas (antecipadas, no prazo ou com atraso justificado).",
    },
    pendentes: {
      titulo: "Pendentes",
      descricao: "Tarefas ainda sem entrega registrada e dentro/fora do prazo aguardando ação.",
    },
  };

  // Cruzamentos para visão UI
  const obrigResp = useMemo(() => {
    const m = new Map<string, Map<string, { total: number; atrasadas: number }>>();
    for (const r of filtrado) {
      const o = r.obrigacao || "—";
      const re = r.responsavelEntrega || r.responsavelPrazo || "—";
      const inner = m.get(o) || new Map();
      const cur = inner.get(re) || { total: 0, atrasadas: 0 };
      cur.total++;
      if (classifyStatus(r.status) === "atrasada") cur.atrasadas++;
      inner.set(re, cur); m.set(o, inner);
    }
    return m;
  }, [filtrado]);

  const buildExportOpts = (): AcessoriasExportOptions => ({
    empresa: "",
    cnpj: "",
    competencias: expCompetencias.length ? expCompetencias : undefined,
    focus: expFocus,
    sections: expSections,
    slides: expSlides,
    periodoLabel: expCompetencias.length
      ? expCompetencias.join(" · ")
      : periodoLabel,
  });

  const runExport = async () => {
    const opts = buildExportOpts();
    try {
      if (exportOpen === "pdf") await exportAcessoriasPDF(rows, summary, opts);
      else if (exportOpen === "excel") exportAcessoriasExcel(rows, summary, opts);
      else if (exportOpen === "pptx") await exportAcessoriasPPTX(rows, summary, opts);
      setExportOpen(null);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao exportar.");
    }
  };

  const openExport = (kind: "pdf" | "excel" | "pptx") => {
    // Pré-seleciona competência atual se filtrada
    setExpCompetencias(filtroComp !== "__all" ? [filtroComp] : []);
    setExportOpen(kind);
  };

  if (!rows.length) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/integracoes")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Integrações
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Importar relatório de Gestão de Entregas — Acessórias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use o arquivo CSV exportado em <strong>Acessórias → Gestão de Entregas</strong>. Reconhece as colunas:
              Obrigação, Empresa, CNPJ, Prazos, Status, Departamento, Responsável e Competência.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <Button onClick={() => inputRef.current?.click()}>Selecionar CSV</Button>
              <input
                ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <p className="text-xs text-muted-foreground mt-3">
                Mensalmente, basta importar a planilha atualizada — o sistema mostrará o que foi alterado antes de salvar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/integracoes")} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Integrações
          </Button>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Acessórias</div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Gestão de Entregas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {summary.total} tarefas · {periodoLabel}
            {history.length > 0 && (
              <> · <span className="inline-flex items-center gap-1"><History className="w-3 h-3" />{history.length} importações</span></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Atualizar (mensal)
          </Button>
          <Button variant="outline" size="sm" onClick={() => openExport("pdf")}>
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => openExport("excel")}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button size="sm" onClick={() => openExport("pptx")}>
            <Presentation className="w-4 h-4 mr-1" /> Apresentação
          </Button>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.currentTarget.value = ""; }} />
        </div>
      </div>

      <DataPersistencePanel
        label="Acessórias"
        fileSlug="acessorias-gestao"
        data={{ rows, history }}
        hasData={rows.length > 0}
        onSave={() => safeSaveJSON({ [STORAGE]: rows, [HISTORY]: history }, "Acessórias")}
        onImport={(d: any) => {
          if (Array.isArray(d)) { persist(d as AcessoriasRow[]); return; }
          if (d && Array.isArray(d.rows)) { persist(d.rows as AcessoriasRow[], Array.isArray(d.history) ? d.history as HistoryEntry[] : history); return; }
          toast.error("Formato inválido.");
        }}
        onClear={() => persist([], [])}
      />

      {/* KPIs clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI onClick={() => setDrillKpi("pontualidade")} icon={<TrendingUp className="w-4 h-4" />} label="Pontualidade" value={`${summary.taxaPontualidade.toFixed(1)}%`} tone="success" />
        <KPI onClick={() => setDrillKpi("atraso")} icon={<AlertTriangle className="w-4 h-4" />} label="Taxa de atraso" value={`${summary.taxaAtraso.toFixed(1)}%`} tone="danger" />
        <KPI onClick={() => setDrillKpi("entregues")} icon={<CheckCircle2 className="w-4 h-4" />} label="Entregues" value={String(summary.porStatus.antecipada + summary.porStatus.no_prazo + summary.porStatus.justificada)} tone="brand" />
        <KPI onClick={() => setDrillKpi("pendentes")} icon={<Clock className="w-4 h-4" />} label="Pendentes" value={String(summary.porStatus.pendente)} tone="warning" />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 grid md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Competência</Label>
            <Select value={filtroComp} onValueChange={setFiltroComp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                {competencias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Responsável</Label>
            <Select value={filtroResp} onValueChange={setFiltroResp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {responsaveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((k) =>
                  <SelectItem key={k} value={k}>{STATUS_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Buscar</Label>
            <Input placeholder="Empresa, CNPJ ou obrigação" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="visao">
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="responsaveis">Responsáveis</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="cruzamento">Cruzamento</TabsTrigger>
          <TabsTrigger value="detalhado">Detalhado</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Distribuição por status</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" nameKey="name" outerRadius={110} innerRadius={60}>
                      {statusChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-display text-base">Evolução por competência</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={summary.porCompetencia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="competencia" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="entregues" stroke="hsl(142 71% 45%)" strokeWidth={2} name="Entregues" />
                    <Line type="monotone" dataKey="atrasadas" stroke="hsl(0 84% 60%)" strokeWidth={2} name="Atrasadas" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="font-display text-base">Top 10 obrigações com mais atrasos</CardTitle></CardHeader>
            <CardContent style={{ height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={[...summary.porObrigacao].sort((a, b) => b.atrasadas - a.atrasadas).slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis dataKey="nome" type="category" fontSize={11} width={120} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="hsl(199 89% 48%)" name="Total" />
                  <Bar dataKey="atrasadas" fill="hsl(0 84% 60%)" name="Atrasadas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responsaveis" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Desempenho por responsável</CardTitle></CardHeader>
            <CardContent style={{ height: 420 }}>
              <ResponsiveContainer>
                <BarChart data={summary.porResponsavel.slice(0, 12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" fontSize={10} angle={-20} textAnchor="end" height={80} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="noPrazo" stackId="a" fill="hsl(142 71% 45%)" name="No prazo" />
                  <Bar dataKey="atrasadas" stackId="a" fill="hsl(0 84% 60%)" name="Atrasadas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <ScrollArea className="h-[360px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">No prazo</TableHead>
                      <TableHead className="text-right">Atrasadas</TableHead>
                      <TableHead className="text-right">% Pontualidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.porResponsavel.map((r) => (
                      <TableRow key={r.nome}>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell className="text-right">{r.total}</TableCell>
                        <TableCell className="text-right">{r.noPrazo}</TableCell>
                        <TableCell className="text-right">{r.atrasadas}</TableCell>
                        <TableCell className="text-right">
                          {r.total > 0 ? `${((r.noPrazo / r.total) * 100).toFixed(1)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas">
          <Card>
            <CardContent className="pt-4">
              <ScrollArea className="h-[540px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Atrasadas</TableHead>
                      <TableHead className="text-right">Pendentes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.porEmpresa.map((e) => (
                      <TableRow key={e.cnpj || e.empresa}>
                        <TableCell className="font-medium">{e.empresa}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.cnpj}</TableCell>
                        <TableCell className="text-right">{e.total}</TableCell>
                        <TableCell className="text-right">
                          {e.atrasadas > 0 ? <Badge variant="destructive">{e.atrasadas}</Badge> : 0}
                        </TableCell>
                        <TableCell className="text-right">{e.pendentes || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cruzamento: Obrigação × Responsável */}
        <TabsContent value="cruzamento">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Obrigações × Responsáveis</CardTitle>
              <p className="text-xs text-muted-foreground">Total / em vermelho: atrasadas. Top 8 responsáveis nas colunas.</p>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[560px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="min-w-[220px]">Obrigação</TableHead>
                      {summary.porResponsavel.slice(0, 8).map((r) => (
                        <TableHead key={r.nome} className="text-center text-xs">{r.nome}</TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.porObrigacao.slice(0, 30).map((o) => {
                      const respsTop = summary.porResponsavel.slice(0, 8);
                      let total = 0;
                      return (
                        <TableRow key={o.nome}>
                          <TableCell className="font-medium text-sm">{o.nome}</TableCell>
                          {respsTop.map((re) => {
                            const v = obrigResp.get(o.nome)?.get(re.nome);
                            if (v) total += v.total;
                            return (
                              <TableCell key={re.nome} className="text-center text-xs">
                                {v ? (
                                  <span>
                                    {v.total}
                                    {v.atrasadas > 0 && <span className="text-destructive font-semibold"> / {v.atrasadas}</span>}
                                  </span>
                                ) : "—"}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-semibold">{total}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detalhado">
          <Card>
            <CardContent className="pt-4">
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Obrigação</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Comp.</TableHead>
                      <TableHead>Prazo legal</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrado.slice(0, 500).map((r, i) => {
                      const b = classifyStatus(r.status);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-xs">{r.obrigacao}</TableCell>
                          <TableCell className="text-xs">{r.empresa}</TableCell>
                          <TableCell className="text-xs">{r.competencia}</TableCell>
                          <TableCell className="text-xs">{r.prazoLegal}</TableCell>
                          <TableCell className="text-xs">{r.dataEntrega || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge style={{ backgroundColor: STATUS_COLORS[b], color: "white" }}>{r.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{r.responsavelEntrega || r.responsavelPrazo || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Histórico de importações</CardTitle>
              <p className="text-xs text-muted-foreground">Controle do acompanhamento mensal — cada upload e o que foi feito.</p>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma importação registrada ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Competências</TableHead>
                      <TableHead className="text-right">Linhas</TableHead>
                      <TableHead>Modo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs">{new Date(h.data).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">{h.competencias.join(", ") || "—"}</TableCell>
                        <TableCell className="text-right text-xs">{h.totalLinhas}</TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{h.modo}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==== Drilldown KPI Modal ==== */}
      <Dialog open={!!drillKpi} onOpenChange={(o) => !o && setDrillKpi(null)}>
        <DialogContent className="max-w-5xl">
          {drillKpi && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{drillTitle[drillKpi].titulo}</DialogTitle>
                <DialogDescription>{drillTitle[drillKpi].descricao}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{drillRows.length} tarefas · {periodoLabel}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportListExcel(drillRows, drillTitle[drillKpi].titulo)}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportListPDF(drillRows, drillTitle[drillKpi].titulo, periodoLabel)}>
                    <Download className="w-4 h-4 mr-1" /> PDF
                  </Button>
                  <Button size="sm" onClick={() => exportListPPTX(drillRows, drillTitle[drillKpi].titulo, periodoLabel)}>
                    <Presentation className="w-4 h-4 mr-1" /> Apresentação
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[440px] mt-2">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Obrigação</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Comp.</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRows.slice(0, 800).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.obrigacao}</TableCell>
                        <TableCell className="text-xs">{r.empresa}</TableCell>
                        <TableCell className="text-xs">{r.competencia}</TableCell>
                        <TableCell className="text-xs">{r.prazoLegal}</TableCell>
                        <TableCell className="text-xs">{r.dataEntrega || "—"}</TableCell>
                        <TableCell className="text-xs">{r.responsavelEntrega || r.responsavelPrazo || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ==== Merge mensal Modal ==== */}
      <Dialog open={!!mergeData} onOpenChange={(o) => !o && setMergeData(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Acompanhamento mensal — o que atualizar?</DialogTitle>
            <DialogDescription>
              Detectamos uma planilha nova. Escolha como deseja combinar com a base atual para evitar sobrescrita indevida.
            </DialogDescription>
          </DialogHeader>
          {mergeData && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Tarefas atuais" value={mergeData.preview.totalAtual} />
                <Stat label="Tarefas no novo arquivo" value={mergeData.preview.totalNovo} />
                <Stat label="Competências sobrepostas" value={mergeData.preview.competenciasSobrepostas.join(", ") || "nenhuma"} />
                <Stat label="Competências novas" value={mergeData.preview.novasCompetencias.join(", ") || "nenhuma"} />
                <Stat label="Tarefas inéditas" value={mergeData.preview.novas} />
                <Stat label="Tarefas atualizadas (status/entrega)" value={mergeData.preview.atualizadas} />
                <Stat label="Já idênticas" value={mergeData.preview.iguais} />
                <Stat label="Empresas novas" value={mergeData.preview.empresasNovas.length} />
              </div>

              <RadioGroup value={mergeMode} onValueChange={(v) => setMergeMode(v as MergeMode)} className="space-y-2 mt-2">
                <Opt value="merge_full" title="Mesclar tudo (recomendado)"
                  desc="Adiciona tarefas inéditas e atualiza status/data de entrega das já existentes." mode={mergeMode} />
                <Opt value="append" title="Apenas adicionar competências novas"
                  desc="Ignora competências já presentes na base. Útil para acompanhamento mês a mês sem alterar histórico." mode={mergeMode} />
                <Opt value="update_only" title="Somente atualizar status/entregas"
                  desc="Mantém a lista atual; só atualiza datas e status do que já estava cadastrado." mode={mergeMode} />
                <Opt value="replace_overlap" title="Substituir competências sobrepostas"
                  desc="Apaga totalmente as competências do novo arquivo e usa a versão recém-importada." mode={mergeMode} />
                <Opt value="overwrite_all" title="Substituir TUDO" danger
                  desc="Remove toda a base e usa apenas o novo arquivo." mode={mergeMode} />
              </RadioGroup>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setMergeData(null)}>Cancelar</Button>
                <Button onClick={confirmMerge}>Confirmar atualização</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ==== Export personalizado Modal ==== */}
      <Dialog open={!!exportOpen} onOpenChange={(o) => !o && setExportOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Exportar {exportOpen === "pdf" ? "PDF" : exportOpen === "excel" ? "Excel" : "Apresentação"}
            </DialogTitle>
            <DialogDescription>Escolha quais períodos e seções deseja incluir no relatório.</DialogDescription>
          </DialogHeader>

          <div>
            <Label className="text-xs uppercase tracking-wider">Períodos</Label>
            <div className="border rounded-md p-3 mt-1 max-h-40 overflow-auto grid grid-cols-3 gap-2">
              {competencias.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={expCompetencias.includes(c)}
                    onCheckedChange={(v) => {
                      setExpCompetencias((prev) => v ? [...prev, c] : prev.filter((x) => x !== c));
                    }}
                  />
                  {c}
                </label>
              ))}
              {competencias.length === 0 && <span className="text-xs text-muted-foreground">Sem competências</span>}
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="ghost" onClick={() => setExpCompetencias([])}>Todas</Button>
              <Button size="sm" variant="ghost" onClick={() => setExpCompetencias(competencias)}>Selecionar todas</Button>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider">Foco do relatório</Label>
            <div className="flex gap-2 mt-1">
              {([
                ["todas", "Todas as tarefas"],
                ["pontuais", "Apenas pontuais"],
                ["atrasadas", "Apenas atrasadas"],
              ] as const).map(([v, l]) => (
                <button key={v} type="button"
                  className={`px-3 py-1.5 rounded text-xs border transition ${expFocus === v ? "bg-brand text-white border-brand" : "bg-muted/30"}`}
                  onClick={() => setExpFocus(v)}>{l}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              "Apenas pontuais" remove tarefas atrasadas dos resumos e listas. "Apenas atrasadas" mantém somente os atrasos.
            </p>
          </div>
          </div>

          {exportOpen !== "pptx" ? (
            <div>
              <Label className="text-xs uppercase tracking-wider">Seções do relatório</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {([
                  ["indicadores", "Indicadores principais"],
                  ["porCompetencia", "Desempenho por competência"],
                  ["porResponsavel", "Por responsável"],
                  ["porObrigacao", "Por obrigação"],
                  ["porEmpresa", "Por empresa"],
                  ["cruzObrigResp", "Obrigações × Responsáveis"],
                  ["cruzEmpresaResp", "Empresas × Responsáveis"],
                  ["atrasadas", "Lista de tarefas atrasadas"],
                  ["detalhado", "Detalhamento (linhas)"],
                ] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={expSections[k]}
                      onCheckedChange={(v) => setExpSections((p) => ({ ...p, [k]: !!v }))} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs uppercase tracking-wider">Slides da apresentação</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {([
                  ["capa", "Capa"],
                  ["kpis", "KPIs + status + competência"],
                  ["statusComp", "Volume por competência"],
                  ["responsaveis", "Responsáveis (gráfico)"],
                  ["obrigacoes", "Obrigações (gráfico)"],
                  ["empresasCriticas", "Empresas críticas (tabela)"],
                  ["atrasadas", "Tarefas atrasadas (tabela)"],
                ] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={expSlides[k]}
                      onCheckedChange={(v) => setExpSlides((p) => ({ ...p, [k]: !!v }))} />
                    {l}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Layout institucional ECON: fundo escuro com detalhes em dourado.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(null)}>Cancelar</Button>
            <Button onClick={runExport}>
              <Download className="w-4 h-4 mr-1" /> Gerar arquivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Helpers UI =====
function KPI({ icon, label, value, tone, onClick }: {
  icon: React.ReactNode; label: string; value: string;
  tone: "success" | "danger" | "brand" | "warning";
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    success: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    danger: "from-red-500/15 to-red-500/5 border-red-500/30 text-red-700 dark:text-red-400",
    brand: "from-primary/15 to-primary/5 border-primary/30 text-primary",
    warning: "from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border bg-gradient-to-br ${tones[tone]} p-4 transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-display font-bold mt-2">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">Clique para detalhes</div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-sm font-medium mt-1 break-words">{value}</div>
    </div>
  );
}

function Opt({ value, title, desc, mode, danger }: {
  value: MergeMode; title: string; desc: string; mode: MergeMode; danger?: boolean;
}) {
  const active = mode === value;
  return (
    <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${active ? "border-primary bg-primary/5" : "hover:bg-muted/40"} ${danger ? "border-destructive/40" : ""}`}>
      <RadioGroupItem value={value} className="mt-1" />
      <div>
        <div className={`font-medium text-sm ${danger ? "text-destructive" : ""}`}>{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}
