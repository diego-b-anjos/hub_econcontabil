import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, FileSpreadsheet, Presentation, ArrowLeft, ListChecks, Users, DollarSign, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { parseSciProtocolos, summarizeProtocolos, applyResponsaveisFromChecklist, buildResponsavelMap, normalizeReferencia, referenciaToMesKey, type ProtocoloRow } from "@/lib/sci/protocolos-parser";
import { exportProtocolosPDF, exportProtocolosExcel, exportProtocolosPPTX } from "@/lib/sci/protocolos-exporters";
import type { ChecklistRow } from "@/lib/integracoes/checklist-parser";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataPersistencePanel } from "@/components/DataPersistencePanel";
import { safeSaveJSON } from "@/lib/safe-storage";

const STORAGE = "sci_protocolos_data";
const PIE_COLORS = ["#1E1A16", "#F7B831", "#16A34A", "#0EA5E9", "#7C3AED", "#DC2626", "#F59E0B", "#10B981"];
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SciProtocolos() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ProtocoloRow[]>([]);
  const [busca, setBusca] = useState("");
  const [mesesSelecionados, setMesesSelecionados] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE); if (raw) setRows(JSON.parse(raw)); } catch { /* noop */ }
  }, []);

  // Aplica responsáveis vindos do check-list de empresas (importado na Apresentação)
  // sempre que o componente renderizar — sem persistir em disco para evitar loops.
  const rowsComResp = useMemo(() => {
    try {
      const raw = localStorage.getItem("checklist_empresas");
      if (!raw) return rows;
      const checklist = JSON.parse(raw) as ChecklistRow[];
      const mapa = buildResponsavelMap(checklist);
      return applyResponsaveisFromChecklist(rows, mapa);
    } catch { return rows; }
  }, [rows]);

  const persist = (r: ProtocoloRow[]) => {
    setRows(r);
    try { localStorage.setItem(STORAGE, JSON.stringify(r)); } catch { /* noop */ }
  };

  const handleFile = async (f: File) => {
    try {
      const parsed = await parseSciProtocolos(f);
      if (!parsed.length) return toast.error("Arquivo sem registros válidos.");
      persist(parsed);
      const refs = parsed.filter((r) => referenciaToMesKey(r.referencia)).length;
      toast.success(`${parsed.length} protocolos importados · ${refs} com referência reconhecida`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao ler o arquivo.");
    }
  };

  // Mês do relatório: usa EXCLUSIVAMENTE a coluna "Referência" do CSV.
  // Se vier como dd/mm/aaaa, considera apenas mm/aaaa.
  const mesDe = (r: ProtocoloRow): string | null => {
    return referenciaToMesKey(r.referencia);
  };

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const r of rowsComResp) { const k = mesDe(r); if (k) set.add(k); }
    return [...set].sort();
  }, [rowsComResp]);

  const fmtMes = (k: string) => {
    const [y, mo] = k.split("-");
    const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${nomes[Number(mo) - 1]}/${y}`;
  };

  const filtrado = useMemo(() => {
    let base = rowsComResp;
    if (mesesSelecionados.length) {
      const sel = new Set(mesesSelecionados);
      base = base.filter((r) => { const k = mesDe(r); return k && sel.has(k); });
    }
    if (!busca) return base;
    const b = busca.toLowerCase();
    return base.filter((r) =>
      r.cliente.toLowerCase().includes(b) ||
      r.cnpj.includes(b) ||
      r.numero.toLowerCase().includes(b) ||
      r.tipo.toLowerCase().includes(b) ||
      r.responsavel.toLowerCase().includes(b),
    );
  }, [rowsComResp, busca, mesesSelecionados]);

  const summary = useMemo(() => summarizeProtocolos(filtrado), [filtrado]);

  // Matriz cruzada Relatório × Referência (qtd. de protocolos)
  const matrizRelRef = useMemo(() => {
    const refs = new Set<string>();
    const rels = new Map<string, Map<string, number>>();
    for (const r of filtrado) {
      const ref = normalizeReferencia(r.referencia) || "—";
      const rel = r.relatorio || "—";
      refs.add(ref);
      const m = rels.get(rel) || new Map();
      m.set(ref, (m.get(ref) || 0) + 1);
      rels.set(rel, m);
    }
    // ordena referências (MM/AAAA) cronologicamente
    const refList = [...refs].sort((a, b) => {
      const pa = a.match(/^(\d{1,2})\/(\d{4})$/);
      const pb = b.match(/^(\d{1,2})\/(\d{4})$/);
      if (pa && pb) return (pa[2] + pa[1].padStart(2, "0")).localeCompare(pb[2] + pb[1].padStart(2, "0"));
      return a.localeCompare(b);
    });
    const relList = [...rels.entries()]
      .map(([rel, m]) => ({
        rel,
        total: [...m.values()].reduce((a, b) => a + b, 0),
        valores: refList.map((ref) => m.get(ref) || 0),
      }))
      .sort((a, b) => b.total - a.total);
    return { refs: refList, rels: relList };
  }, [filtrado]);

  const periodoLabel = useMemo(() => {
    // Lê dd/mm/aaaa direto da string (sem Date) — formato pt-BR.
    const tuplas = filtrado.map((r) => {
      const ds = (r.data || "").trim();
      let m = ds.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (m) {
        let [, d, mo, y] = m;
        if (y.length === 2) y = (Number(y) >= 70 ? "19" : "20") + y;
        return { y: Number(y), mo: Number(mo), d: Number(d), s: `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${y}` };
      }
      m = ds.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) {
        return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]),
          s: `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1]}` };
      }
      return null;
    }).filter(Boolean) as { y: number; mo: number; d: number; s: string }[];
    if (!tuplas.length) return "Período integral";
    const cmp = (a: typeof tuplas[0]) => a.y * 10000 + a.mo * 100 + a.d;
    const sorted = [...tuplas].sort((a, b) => cmp(a) - cmp(b));
    return `${sorted[0].s} a ${sorted[sorted.length - 1].s}`;
  }, [filtrado]);

  const KPI = ({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) => (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
            <p className="text-2xl lg:text-3xl font-bold mt-1 break-words leading-tight" style={{ color: tone }}>{value}</p>
          </div>
          <div className="p-2 rounded-lg shrink-0" style={{ background: `${tone}1A` }}>
            <Icon className="h-5 w-5" style={{ color: tone }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/integracoes")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">SCI · Protocolos</h1>
            <p className="text-sm text-muted-foreground">Gestão consolidada de protocolos da carteira</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Importar planilha
          </Button>
          <input
            ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onClick={(e) => { e.currentTarget.value = ""; }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
          />
          {rows.length > 0 && (
            <>
              <Button variant="outline" onClick={() => exportProtocolosPDF(filtrado, summary, { periodoLabel })}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" onClick={() => exportProtocolosExcel(filtrado, summary, { periodoLabel })}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button onClick={() => exportProtocolosPPTX(filtrado, summary, { periodoLabel })}>
                <Presentation className="h-4 w-4 mr-2" /> Apresentação
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4">
        <DataPersistencePanel
          label="Protocolos SCI"
          fileSlug="sci-protocolos"
          data={rows}
          hasData={rows.length > 0}
          onSave={() => safeSaveJSON({ [STORAGE]: rows }, "Protocolos SCI")}
          onImport={(d) => { if (Array.isArray(d)) persist(d as ProtocoloRow[]); else toast.error("Formato inválido."); }}
          onClear={() => persist([])}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 flex flex-col items-center text-center gap-3">
            <ListChecks className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold">Nenhum protocolo importado</h2>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                Importe a planilha de protocolos exportada do SCI (.xlsx) para gerar resumos, gráficos e relatórios.
              </p>
            </div>
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Importar planilha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI label="Total de Protocolos" value={String(summary.total)} icon={ListChecks} tone="#1E1A16" />
            <KPI label="Clientes" value={String(summary.totalClientes)} icon={Users} tone="#16A34A" />
            <KPI label="Relatórios" value={String(summary.porRelatorio.filter((p) => p.chave !== "—").length)} icon={FileBarChart} tone="#0EA5E9" />
            <KPI label="Valor total" value={fmtBRL(summary.valorTotal)} icon={DollarSign} tone="#F7B831" />
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <Input placeholder="Buscar por cliente, CNPJ, número, tipo ou responsável..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-md" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {mesesSelecionados.length ? `${mesesSelecionados.length} mês(es)` : "Filtrar meses"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="p-2 border-b flex items-center justify-between">
                  <span className="text-xs font-semibold">Selecionar meses</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setMesesSelecionados(mesesDisponiveis)}>Todos</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setMesesSelecionados([])}>Limpar</Button>
                  </div>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-2 space-y-1">
                    {mesesDisponiveis.length === 0 && <p className="text-xs text-muted-foreground p-2">Sem meses identificados.</p>}
                    {mesesDisponiveis.map((m) => (
                      <label key={m} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={mesesSelecionados.includes(m)}
                          onCheckedChange={(v) => setMesesSelecionados((p) => v ? [...p, m] : p.filter((x) => x !== m))}
                        />
                        {fmtMes(m)}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            {mesesSelecionados.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {mesesSelecionados.slice(0, 6).map((m) => (
                  <Badge key={m} variant="secondary" className="text-xs gap-1">
                    {fmtMes(m)}
                    <button onClick={() => setMesesSelecionados((p) => p.filter((x) => x !== m))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
                {mesesSelecionados.length > 6 && <span className="text-xs text-muted-foreground">+{mesesSelecionados.length - 6}</span>}
              </div>
            )}
            <span className="text-xs text-muted-foreground ml-auto">Período: {periodoLabel}</span>
          </div>

          <Tabs defaultValue="visao">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="visao">Visão geral</TabsTrigger>
              <TabsTrigger value="dec">Declarações</TabsTrigger>
              <TabsTrigger value="mem">Memórias de cálculo</TabsTrigger>
              <TabsTrigger value="imp">Impostos</TabsTrigger>
              <TabsTrigger value="doc">Documentos fiscais</TabsTrigger>
              <TabsTrigger value="resp">Por responsável</TabsTrigger>
              <TabsTrigger value="cli">Por cliente</TabsTrigger>
              <TabsTrigger value="rel">Por relatório</TabsTrigger>
              <TabsTrigger value="ref">Por referência</TabsTrigger>
              <TabsTrigger value="det">Detalhado</TabsTrigger>
            </TabsList>

            <TabsContent value="visao" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Distribuição mensal</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={summary.porMes}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" /><YAxis />
                        <Tooltip /> <Bar dataKey="quantidade" fill="#F7B831" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Por tipo</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={summary.porTipo.slice(0, 8)} dataKey="quantidade" nameKey="chave" cx="50%" cy="45%" outerRadius={90} label={(e: any) => e.chave}>
                          {summary.porTipo.slice(0, 8).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip /> <Legend verticalAlign="bottom" height={28} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="dec">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Relatório (Declarações)</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {summary.declaracoes.map((p) => (
                      <TableRow key={p.relatorio}>
                        <TableCell className="font-medium">{p.relatorio}</TableCell>
                        <TableCell className="text-right">{p.quantidade}</TableCell>
                        <TableCell className="text-right">{fmtBRL(p.valor)}</TableCell>
                      </TableRow>
                    ))}
                    {!summary.declaracoes.length && (
                      <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Nenhuma declaração identificada na base.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="mem">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Relatório (Memórias de cálculo)</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {summary.memoriasCalculo.map((p) => (
                      <TableRow key={p.relatorio}>
                        <TableCell className="font-medium">{p.relatorio}</TableCell>
                        <TableCell className="text-right">{p.quantidade}</TableCell>
                        <TableCell className="text-right">{fmtBRL(p.valor)}</TableCell>
                      </TableRow>
                    ))}
                    {!summary.memoriasCalculo.length && (
                      <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Nenhuma memória de cálculo identificada na base.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="imp">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Relatório (Impostos)</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {summary.impostos.map((p) => (
                      <TableRow key={p.relatorio}>
                        <TableCell className="font-medium">{p.relatorio}</TableCell>
                        <TableCell className="text-right">{p.quantidade}</TableCell>
                        <TableCell className="text-right">{fmtBRL(p.valor)}</TableCell>
                      </TableRow>
                    ))}
                    {!summary.impostos.length && (
                      <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Nenhum imposto identificado na base.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="doc">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Relatório (Documentos fiscais)</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {summary.documentosFiscais.map((p) => (
                      <TableRow key={p.relatorio}>
                        <TableCell className="font-medium">{p.relatorio}</TableCell>
                        <TableCell className="text-right">{p.quantidade}</TableCell>
                        <TableCell className="text-right">{fmtBRL(p.valor)}</TableCell>
                      </TableRow>
                    ))}
                    {!summary.documentosFiscais.length && (
                      <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Nenhum documento fiscal identificado na base.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="resp">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Protocolos</TableHead>
                    <TableHead className="text-right">Qtd. Impostos</TableHead>
                    <TableHead className="text-right">Total Impostos</TableHead>
                    <TableHead className="text-right">% Impostos</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {summary.porResponsavel.map((p) => (
                      <TableRow key={p.chave}>
                        <TableCell className="font-medium">{p.chave}</TableCell>
                        <TableCell className="text-right">{p.quantidade}</TableCell>
                        <TableCell className="text-right">{p.qtdImpostos}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtBRL(p.valorImpostos)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{summary.valorTotalImpostos ? ((p.valorImpostos / summary.valorTotalImpostos) * 100).toFixed(1) : "0.0"}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="cli">
              <Card><CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead className="text-right">Protocolos</TableHead>
                      <TableHead className="text-right">Qtd. Impostos</TableHead>
                      <TableHead className="text-right">Total Impostos</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {summary.porCliente.map((p) => (
                        <TableRow key={p.chave}>
                          <TableCell className="font-medium">{p.chave}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.cnpj}</TableCell>
                          <TableCell className="text-right">{p.quantidade}</TableCell>
                          <TableCell className="text-right">{p.qtdImpostos}</TableCell>
                          <TableCell className="text-right font-bold">{fmtBRL(p.valorImpostos)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="rel">
              <Card><CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Relatório</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {summary.porRelatorio.map((p) => (
                      <TableRow key={p.chave}>
                        <TableCell className="font-medium">{p.chave}</TableCell>
                        <TableCell className="text-right">{p.quantidade}</TableCell>
                        <TableCell className="text-right">{fmtBRL(p.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="ref">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Relatório × Referência (quantidade)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px] w-full">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="sticky left-0 bg-background z-10 min-w-[260px]">Relatório</TableHead>
                              {matrizRelRef.refs.map((ref) => (
                                <TableHead key={ref} className="text-right whitespace-nowrap">{ref}</TableHead>
                              ))}
                              <TableHead className="text-right font-bold">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {matrizRelRef.rels.map((row) => (
                              <TableRow key={row.rel}>
                                <TableCell className="sticky left-0 bg-background z-10 font-medium">{row.rel}</TableCell>
                                {row.valores.map((v, i) => (
                                  <TableCell key={i} className="text-right text-sm">{v || "—"}</TableCell>
                                ))}
                                <TableCell className="text-right font-bold">{row.total}</TableCell>
                              </TableRow>
                            ))}
                            {!matrizRelRef.rels.length && (
                              <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">Nenhum dado.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Resumo por referência (apenas com valor financeiro)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Referência</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {summary.porReferencia.map((p) => (
                          <TableRow key={p.chave}>
                            <TableCell className="font-medium">{p.chave}</TableCell>
                            <TableCell className="text-right">{p.quantidade}</TableCell>
                            <TableCell className="text-right">{fmtBRL(p.valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="det">
              <Card><CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Nº</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead>
                      <TableHead>Relatório</TableHead><TableHead>Categoria</TableHead>
                      <TableHead>Referência</TableHead><TableHead>Responsável</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filtrado.slice(0, 500).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{r.numero}</TableCell>
                          <TableCell className="text-xs">{r.data}</TableCell>
                          <TableCell className="font-medium">{r.cliente}</TableCell>
                          <TableCell className="text-xs">{r.relatorio}</TableCell>
                          <TableCell className="text-xs">{r.categoria === "declaracao" ? "Declaração" : r.categoria === "memoria" ? "Memória de cálculo" : r.categoria === "imposto" ? "Imposto" : r.categoria === "documento_fiscal" ? "Documento fiscal" : "—"}</TableCell>
                          <TableCell className="text-xs">{r.referencia}</TableCell>
                          <TableCell className="text-xs">{r.responsavel}</TableCell>
                          <TableCell className="text-xs text-right">{r.valor ? fmtBRL(r.valor) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filtrado.length > 500 && (
                    <p className="text-xs text-muted-foreground p-3">Exibindo 500 de {filtrado.length} registros. Exporte para visualizar a base completa.</p>
                  )}
                </ScrollArea>
              </CardContent></Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
