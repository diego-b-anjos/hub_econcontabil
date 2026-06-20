import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, FileSpreadsheet, Presentation, ArrowLeft, Download, Users, DollarSign, TrendingUp, Briefcase } from "lucide-react";
import { DataPersistencePanel } from "@/components/DataPersistencePanel";
import { safeSaveJSON } from "@/lib/safe-storage";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { parseSciExcel, summarizeSci, MES_LABELS, type SciFatRow } from "@/lib/sci/parser";
import { exportSciPDF, exportSciExcel, exportSciPPTX, type SciExportOptions } from "@/lib/sci/exporters";

const STORAGE = "sci_faturamento_data";
const PIE_COLORS = ["#1E1A16", "#F7B831", "#16A34A", "#0EA5E9", "#7C3AED", "#DC2626", "#F59E0B"];

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SciFaturamento() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SciFatRow[]>([]);
  const [filtroPlano, setFiltroPlano] = useState<string>("__all");
  const [busca, setBusca] = useState("");
  const [meses, setMeses] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drilldown
  const [drillOpen, setDrillOpen] = useState<null | "totalFat" | "clientes" | "ticket" | "media">(null);

  // Export dialog
  const [exportOpen, setExportOpen] = useState<null | "pdf" | "excel" | "pptx">(null);
  const [expSections, setExpSections] = useState({
    indicadores: true, porMes: true, porPlano: true, porAtividade: true,
    porAnexo: true, topClientes: true, bottomClientes: false, detalhado: false,
  });
  const [expSlides, setExpSlides] = useState({
    capa: true, kpis: true, porMes: true, porPlano: true, topClientes: true,
  });
  const [expMeses, setExpMeses] = useState<number[]>([]);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE); if (raw) setRows(JSON.parse(raw)); } catch { /* noop */ }
  }, []);

  const persist = (r: SciFatRow[]) => {
    setRows(r);
    try { localStorage.setItem(STORAGE, JSON.stringify(r)); } catch { /* noop */ }
  };

  const handleFile = async (f: File) => {
    try {
      const parsed = await parseSciExcel(f);
      if (!parsed.length) return toast.error("Arquivo sem registros válidos.");
      persist(parsed);
      toast.success(`${parsed.length} clientes importados`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao ler o arquivo.");
    }
  };

  const planos = useMemo(() => Array.from(new Set(rows.map((r) => r.planoTributario).filter(Boolean))).sort(), [rows]);

  const filtrado = useMemo(() => {
    return rows.filter((r) => {
      if (filtroPlano !== "__all" && r.planoTributario !== filtroPlano) return false;
      if (busca) {
        const b = busca.toLowerCase();
        if (!(r.razaoSocial.toLowerCase().includes(b) || r.cnpj.includes(b))) return false;
      }
      return true;
    }).map((r) => {
      if (!meses.length) return r;
      const novosMeses = r.meses.map((v, i) => meses.includes(i) ? v : 0);
      const novoTotal = novosMeses.reduce((a, b) => a + b, 0);
      return { ...r, meses: novosMeses, total: novoTotal };
    });
  }, [rows, filtroPlano, busca, meses]);

  const summary = useMemo(() => summarizeSci(filtrado), [filtrado]);

  const periodoLabel = useMemo(() => {
    const ativos = summary.porMes.filter((m) => m.valor > 0).map((m) => m.mes);
    if (!ativos.length) return "Sem dados";
    return ativos.length === 12 ? "Ano completo" : ativos.join(", ");
  }, [summary]);

  // Drilldown rows
  const drillRows = useMemo(() => {
    if (!drillOpen) return [];
    if (drillOpen === "ticket" || drillOpen === "media") return [...filtrado].sort((a, b) => b.total - a.total);
    if (drillOpen === "totalFat") return [...filtrado].sort((a, b) => b.total - a.total);
    return filtrado; // clientes
  }, [drillOpen, filtrado]);

  const drillTitles: Record<NonNullable<typeof drillOpen>, { titulo: string; descricao: string }> = {
    totalFat: { titulo: "Faturamento total", descricao: "Soma do faturamento de todos os clientes da carteira no período selecionado." },
    clientes: { titulo: "Total de Clientes", descricao: "Lista completa dos clientes cadastrados na base SCI importada." },
    ticket: { titulo: "Média de faturamento por cliente", descricao: "Faturamento médio por cliente — base do cálculo: faturamento total ÷ número de clientes." },
    media: { titulo: "Média mensal", descricao: "Faturamento total dividido pelos meses ativos da base." },
  };

  const buildOpts = (): SciExportOptions => ({
    empresa: "",
    cnpj: "",
    periodoLabel,
    sections: expSections,
    slides: expSlides,
    meses: expMeses.length ? expMeses : undefined,
  });

  const runExport = async () => {
    try {
      const opts = buildOpts();
      if (exportOpen === "pdf") await exportSciPDF(filtrado, summary, opts);
      else if (exportOpen === "excel") exportSciExcel(filtrado, summary, opts);
      else if (exportOpen === "pptx") await exportSciPPTX(filtrado, summary, opts);
      setExportOpen(null);
    } catch (e) {
      console.error(e); toast.error("Falha ao exportar.");
    }
  };

  const exportDrillCSV = () => {
    const lines = ["Razão Social;CNPJ;Plano;Faturamento"];
    drillRows.forEach((r) => lines.push([r.razaoSocial, r.cnpj, r.planoTributario, r.total.toFixed(2)].join(";")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${drillOpen}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!rows.length) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/integracoes")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Integrações
        </Button>
        <Card>
          <CardHeader><CardTitle className="font-display">Importar planilha de Faturamento — SCI</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use o arquivo <strong>Excel exportado pelo SCI</strong>. Colunas reconhecidas:
              Razão Social, CNPJ, Plano Tributário, Atividade, Anexo, Descrição e mensais (JAN..DEZ + TOTAL).
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <Button onClick={() => inputRef.current?.click()}>Selecionar XLSX</Button>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">SCI</div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Faturamento da Carteira</h1>
          <p className="text-sm text-muted-foreground mt-1">{summary.totalClientes} clientes · {periodoLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Importar nova
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setExpMeses([]); setExportOpen("pdf"); }}>
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setExpMeses([]); setExportOpen("excel"); }}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button size="sm" onClick={() => { setExpMeses([]); setExportOpen("pptx"); }}>
            <Presentation className="w-4 h-4 mr-1" /> Apresentação
          </Button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.currentTarget.value = ""; }} />
        </div>
      </div>

      <div className="mb-4">
        <DataPersistencePanel
          label="Faturamento SCI"
          fileSlug="sci-faturamento"
          data={rows}
          hasData={rows.length > 0}
          onSave={() => safeSaveJSON({ [STORAGE]: rows }, "Faturamento SCI")}
          onImport={(d) => { if (Array.isArray(d)) persist(d as SciFatRow[]); else toast.error("Formato inválido."); }}
          onClear={() => persist([])}
        />
      </div>

      {/* KPIs clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI onClick={() => setDrillOpen("totalFat")} icon={<DollarSign className="w-4 h-4" />} label="Faturamento total" value={fmt(summary.totalGeral)} tone="brand" />
        <KPI onClick={() => setDrillOpen("clientes")} icon={<Users className="w-4 h-4" />} label="Total de clientes" value={String(summary.totalClientes)} tone="success" />
        <KPI onClick={() => setDrillOpen("ticket")} icon={<TrendingUp className="w-4 h-4" />} label="Média por cliente" value={fmt(summary.ticketMedio)} tone="warning" />
        <KPI onClick={() => setDrillOpen("media")} icon={<Briefcase className="w-4 h-4" />} label="Média por mês ativo" value={fmt(summary.mediaPorMesAtivo)} tone="danger" />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Plano tributário</Label>
            <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={filtroPlano} onChange={(e) => setFiltroPlano(e.target.value)}>
              <option value="__all">Todos</option>
              {planos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Buscar</Label>
            <Input placeholder="Razão social ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Meses incluídos</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {MES_LABELS.map((m, i) => {
                const active = !meses.length || meses.includes(i);
                return (
                  <button key={m} type="button"
                    className={`px-2 py-1 rounded text-[10px] border transition ${active ? "bg-brand text-white border-brand" : "bg-muted/30 text-muted-foreground"}`}
                    onClick={() => setMeses((prev) => {
                      const all = MES_LABELS.map((_, k) => k);
                      const cur = prev.length ? prev : all;
                      return cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b);
                    })}>{m}</button>
                );
              })}
              {meses.length > 0 && <button onClick={() => setMeses([])} className="text-[10px] text-muted-foreground underline">limpar</button>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="visao">
        <TabsList>
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Faturamento por mês</CardTitle></CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={summary.porMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="valor" fill="#F7B831" name="Faturamento" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="font-display text-base">Distribuição por plano</CardTitle></CardHeader>
              <CardContent style={{ height: 380 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={summary.porPlano.slice(0, 8)}
                      dataKey="valor"
                      nameKey="plano"
                      cx="50%"
                      cy="42%"
                      outerRadius={90}
                      innerRadius={45}
                    >
                      {summary.porPlano.slice(0, 8).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      layout="horizontal"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 11, paddingTop: 8, lineHeight: "16px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="planos">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano tributário</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">% total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.porPlano.map((p) => (
                    <TableRow key={p.plano}>
                      <TableCell className="font-medium">{p.plano}</TableCell>
                      <TableCell className="text-right">{p.clientes}</TableCell>
                      <TableCell className="text-right">{fmt(p.valor)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {summary.totalGeral > 0 ? `${((p.valor / summary.totalGeral) * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atividades">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atividade</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">% total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.porAtividade.map((p) => (
                    <TableRow key={p.atividade}>
                      <TableCell className="font-medium">{p.atividade || "—"}</TableCell>
                      <TableCell className="text-right">{p.clientes}</TableCell>
                      <TableCell className="text-right">{fmt(p.valor)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {summary.totalGeral > 0 ? `${((p.valor / summary.totalGeral) * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anexos">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anexo</TableHead>
                    <TableHead className="text-right">Clientes</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">% total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.porAnexo.map((p) => (
                    <TableRow key={p.anexo}>
                      <TableCell className="font-medium">{p.anexo || "—"}</TableCell>
                      <TableCell className="text-right">{p.clientes}</TableCell>
                      <TableCell className="text-right">{fmt(p.valor)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {summary.totalGeral > 0 ? `${((p.valor / summary.totalGeral) * 100).toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes">
          <Card>
            <CardContent className="pt-4">
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrado.slice(0, 500).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-xs">{r.razaoSocial}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.cnpj}</TableCell>
                        <TableCell className="text-xs">{r.planoTributario}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drilldown */}
      <Dialog open={!!drillOpen} onOpenChange={(o) => !o && setDrillOpen(null)}>
        <DialogContent className="max-w-5xl">
          {drillOpen && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{drillTitles[drillOpen].titulo}</DialogTitle>
                <DialogDescription>{drillTitles[drillOpen].descricao}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{drillRows.length} clientes · {periodoLabel}</span>
                <Button size="sm" variant="outline" onClick={exportDrillCSV}>
                  <Download className="w-4 h-4 mr-1" /> Exportar CSV
                </Button>
              </div>
              <ScrollArea className="h-[440px] mt-2">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillRows.slice(0, 600).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.razaoSocial}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.cnpj}</TableCell>
                        <TableCell className="text-xs">{r.planoTributario}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmt(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Export dialog */}
      <Dialog open={!!exportOpen} onOpenChange={(o) => !o && setExportOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Exportar {exportOpen === "pdf" ? "PDF" : exportOpen === "excel" ? "Excel" : "Apresentação"}
            </DialogTitle>
            <DialogDescription>Escolha quais meses e seções deseja incluir.</DialogDescription>
          </DialogHeader>

          <div>
            <Label className="text-xs uppercase tracking-wider">Meses</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {MES_LABELS.map((m, i) => {
                const active = !expMeses.length || expMeses.includes(i);
                return (
                  <button key={m} type="button"
                    className={`px-2.5 py-1 rounded text-xs border ${active ? "bg-brand text-white border-brand" : "bg-muted/30"}`}
                    onClick={() => setExpMeses((prev) => {
                      const all = MES_LABELS.map((_, k) => k);
                      const cur = prev.length ? prev : all;
                      return cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b);
                    })}>{m}</button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Em branco = todos os meses.</p>
          </div>

          {exportOpen !== "pptx" ? (
            <div>
              <Label className="text-xs uppercase tracking-wider">Seções</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {([
                  ["indicadores", "Indicadores principais"],
                  ["porMes", "Por mês"],
                  ["porPlano", "Por plano"],
                  ["porAtividade", "Por atividade"],
                  ["porAnexo", "Por anexo"],
                  ["topClientes", "Top 10 clientes"],
                  ["bottomClientes", "Menor faturamento"],
                  ["detalhado", "Detalhamento (clientes)"],
                ] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={expSections[k]} onCheckedChange={(v) => setExpSections((p) => ({ ...p, [k]: !!v }))} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-xs uppercase tracking-wider">Slides</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {([
                  ["capa", "Capa"],
                  ["kpis", "Indicadores"],
                  ["porMes", "Evolução mensal"],
                  ["porPlano", "Por plano (tabela)"],
                  ["topClientes", "Top 10 clientes"],
                ] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={expSlides[k]} onCheckedChange={(v) => setExpSlides((p) => ({ ...p, [k]: !!v }))} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(null)}>Cancelar</Button>
            <Button onClick={runExport}><Download className="w-4 h-4 mr-1" /> Gerar arquivo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
    <button type="button" onClick={onClick}
      className={`text-left rounded-xl border bg-gradient-to-br ${tones[tone]} p-4 transition hover:shadow-md hover:-translate-y-0.5 cursor-pointer`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">{icon}<span>{label}</span></div>
      <div className="text-xl md:text-2xl font-display font-bold mt-2 break-words">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">Clique para detalhes</div>
    </button>
  );
}
