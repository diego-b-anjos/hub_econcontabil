import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Upload, FileText, Database, ArrowRight, Plus, Download, UserPlus, Trash2, History, FileDown,
} from "lucide-react";
import { parseSped, type SpedParseResult, type SpedMonthly } from "@/lib/sped-reader/parser";
import { parsePgdasPdf, type PgdasParseResult, type PgdasMonthly } from "@/lib/sped-reader/pgdasParser";
import { formatBRL } from "@/lib/tax-engine";
import { useNavigate } from "react-router-dom";
import { apiClients } from "@/lib/api";
import { lookupCnpj } from "@/lib/cnpj";
// jspdf/jspdf-autotable carregados dinamicamente em exportarPDF()
import econLogo from "@/assets/econ-logo.png";

type Imported = { name: string; result: SpedParseResult };
type ImportedPgdas = { name: string; result: PgdasParseResult };

const HIST_KEY = "sped_historico_empresas";
const PGDAS_HIST_KEY = "pgdas_historico_empresas";

const onlyDigits = (s?: string) => (s || "").replace(/\D/g, "");

const formatCNPJ = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const FIELDS: { key: keyof Omit<SpedMonthly, "periodo" | "mes" | "ano">; label: string }[] = [
  { key: "faturamento", label: "Faturamento" },
  { key: "compras", label: "Compras" },
  { key: "icmsDebito", label: "ICMS Débito" },
  { key: "icmsCredito", label: "ICMS Crédito" },
  { key: "ipiDebito", label: "IPI Débito" },
  { key: "ipiCredito", label: "IPI Crédito" },
  { key: "pis", label: "PIS" },
  { key: "cofins", label: "COFINS" },
  { key: "iss", label: "ISS" },
];

// Default: do Fiscal pegamos faturamento/compras/ICMS/IPI; do Contribuições pegamos faturamento/PIS/COFINS.
// Quando ambos coexistem na mesma competência, o usuário ajusta no diálogo "Configurar mesclagem".
const defaultFieldOriginFor = (tipo: SpedParseResult["tipo"]): Set<string> => {
  if (tipo === "fiscal") return new Set(["faturamento", "compras", "icmsDebito", "icmsCredito", "ipiDebito", "ipiCredito"]);
  if (tipo === "contribuicoes") return new Set(["faturamento", "pis", "cofins"]);
  return new Set(FIELDS.map((f) => f.key as string));
};

export default function SpedReader() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Imported[]>([]);
  const [loading, setLoading] = useState(false);
  // Extrato PGDAS-D (PDF do Simples Nacional)
  const [pgdasFiles, setPgdasFiles] = useState<File[]>([]);
  const [pgdasResults, setPgdasResults] = useState<ImportedPgdas[]>([]);
  const [pgdasLoading, setPgdasLoading] = useState(false);
  const nav = useNavigate();

  // Mesclagem por arquivo (quando há sobreposição de competência)
  const [fieldsByFile, setFieldsByFile] = useState<Record<string, Set<string>>>({});
  const [mergeOpen, setMergeOpen] = useState(false);

  // Conflito de empresa
  const [conflict, setConflict] = useState<{ pendingFiles: File[]; existingCnpj: string; newCnpj: string } | null>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list));
  };

  // Identifica CNPJ atual já carregado
  const currentCnpj = results[0]?.result.cnpj ? onlyDigits(results[0].result.cnpj) : "";

  const doProcess = async (toProcess: File[], replace: boolean) => {
    setLoading(true);
    try {
      const out: Imported[] = [];
      for (const f of toProcess) {
        const text = await f.text();
        const r = parseSped(text);
        out.push({ name: f.name, result: r });
      }
      const next = replace ? out : [...results, ...out];
      setResults(next);

      // Defaults de campos por arquivo
      setFieldsByFile((prev) => {
        const map = { ...prev };
        if (replace) for (const k of Object.keys(map)) delete map[k];
        for (const item of out) {
          map[item.name] = defaultFieldOriginFor(item.result.tipo);
        }
        return map;
      });

      toast.success(`${out.length} arquivo(s) processado(s)`);
      setFiles([]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao processar SPED");
    } finally {
      setLoading(false);
    }
  };

  const processar = async () => {
    if (!files.length) return toast.error("Selecione um ou mais arquivos SPED (.txt)");
    setLoading(true);
    try {
      // pré-leitura para detectar CNPJ do primeiro arquivo
      const firstText = await files[0].text();
      const firstParsed = parseSped(firstText);
      const newCnpj = onlyDigits(firstParsed.cnpj);

      if (results.length && currentCnpj && newCnpj && currentCnpj !== newCnpj) {
        setConflict({ pendingFiles: files, existingCnpj: currentCnpj, newCnpj });
        setLoading(false);
        return;
      }
      await doProcess(files, false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao processar SPED");
      setLoading(false);
    }
  };

  // Persistir histórico da empresa atual em localStorage
  const salvarHistoricoAtual = () => {
    if (!results.length) return;
    const payload = {
      cnpj: results[0].result.cnpj,
      razaoSocial: results[0].result.razaoSocial,
      arquivos: results.map((r) => r.name),
      meses: consolidado,
      totais,
      salvoEm: new Date().toISOString(),
    };
    const prev = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
    prev.push(payload);
    localStorage.setItem(HIST_KEY, JSON.stringify(prev));
  };

  const confirmConflict = async (saveHistory: boolean) => {
    if (!conflict) return;
    if (saveHistory) {
      salvarHistoricoAtual();
      toast.success("Histórico da empresa anterior salvo");
    }
    setResults([]);
    setFieldsByFile({});
    await doProcess(conflict.pendingFiles, true);
    setConflict(null);
  };

  // Detecta sobreposição de competência entre arquivos
  const overlap = useMemo(() => {
    if (results.length < 2) return false;
    const periodSets = results.map((r) => new Set(r.result.meses.map((m) => m.periodo)));
    for (let i = 0; i < periodSets.length; i++)
      for (let j = i + 1; j < periodSets.length; j++)
        for (const p of periodSets[i]) if (periodSets[j].has(p)) return true;
    return false;
  }, [results]);

  // Consolidação respeitando seleção de campos por arquivo
  const consolidado = useMemo(() => {
    const map = new Map<string, SpedMonthly>();
    for (const { name, result } of results) {
      const allow = fieldsByFile[name] ?? defaultFieldOriginFor(result.tipo);
      for (const m of result.meses) {
        const ex = map.get(m.periodo) ?? {
          periodo: m.periodo, mes: m.mes, ano: m.ano,
          faturamento: 0, compras: 0, icmsDebito: 0, icmsCredito: 0,
          ipiDebito: 0, ipiCredito: 0, pis: 0, cofins: 0, iss: 0,
        };
        for (const f of FIELDS) {
          if (allow.has(f.key as string)) (ex as any)[f.key] += (m as any)[f.key];
        }
        map.set(m.periodo, ex);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [results, fieldsByFile]);

  const totais = useMemo(() => consolidado.reduce(
    (a, m) => ({
      faturamento: a.faturamento + m.faturamento,
      compras: a.compras + m.compras,
      icmsDebito: a.icmsDebito + m.icmsDebito,
      icmsCredito: a.icmsCredito + m.icmsCredito,
      ipiDebito: a.ipiDebito + m.ipiDebito,
      ipiCredito: a.ipiCredito + m.ipiCredito,
      pis: a.pis + m.pis,
      cofins: a.cofins + m.cofins,
      iss: a.iss + m.iss,
    }),
    { faturamento: 0, compras: 0, icmsDebito: 0, icmsCredito: 0, ipiDebito: 0, ipiCredito: 0, pis: 0, cofins: 0, iss: 0 },
  ), [consolidado]);

  const enviarParaSimulacao = () => {
    if (!consolidado.length) return toast.error("Nada para enviar");
    localStorage.setItem("sped_extracao", JSON.stringify({
      meses: consolidado,
      totais,
      origem: results.map((r) => r.name),
      criadoEm: new Date().toISOString(),
    }));
    toast.success("Dados disponíveis para nova simulação");
    nav("/app/simulacoes/nova");
  };

  const limparTudo = () => {
    setResults([]);
    setFieldsByFile({});
    toast.success("Importação limpa");
  };

  // ===== PGDAS-D (Extrato Simples Nacional em PDF) =====
  const handlePgdasFiles = (list: FileList | null) => {
    if (!list) return;
    setPgdasFiles(Array.from(list));
  };

  const processarPgdas = async () => {
    if (!pgdasFiles.length) return toast.error("Selecione um ou mais PDFs do PGDAS-D");
    setPgdasLoading(true);
    try {
      const out: ImportedPgdas[] = [];
      for (const f of pgdasFiles) {
        const r = await parsePgdasPdf(f);
        out.push({ name: f.name, result: r });
      }
      setPgdasResults((prev) => [...prev, ...out]);
      toast.success(`${out.length} extrato(s) PGDAS-D processado(s)`);
      setPgdasFiles([]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao processar PGDAS-D");
    } finally {
      setPgdasLoading(false);
    }
  };

  const limparPgdas = () => {
    setPgdasResults([]);
    setPgdasFiles([]);
    toast.success("Extratos PGDAS-D limpos");
  };

  // Consolida todos os meses dos PGDAS-D carregados (somando se houver duplicidade)
  const pgdasConsolidado = useMemo<PgdasMonthly[]>(() => {
    const map = new Map<string, PgdasMonthly>();
    for (const { result } of pgdasResults) {
      for (const m of result.meses) {
        const ex = map.get(m.periodo);
        if (!ex) {
          map.set(m.periodo, { ...m });
        } else {
          map.set(m.periodo, {
            ...ex,
            faturamento: ex.faturamento + m.faturamento,
            das: (ex.das || 0) + (m.das || 0),
            rbt12: m.rbt12 || ex.rbt12,
            irpj: (ex.irpj || 0) + (m.irpj || 0),
            csll: (ex.csll || 0) + (m.csll || 0),
            cofins: ex.cofins + m.cofins,
            pis: ex.pis + m.pis,
            cpp: (ex.cpp || 0) + (m.cpp || 0),
            icmsDebito: ex.icmsDebito + m.icmsDebito,
            iss: ex.iss + m.iss,
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [pgdasResults]);

  const pgdasTotalDAS = useMemo(
    () => pgdasConsolidado.reduce((s, m) => s + (m.das || 0), 0),
    [pgdasConsolidado],
  );
  const pgdasTotalFat = useMemo(
    () => pgdasConsolidado.reduce((s, m) => s + m.faturamento, 0),
    [pgdasConsolidado],
  );

  // Persiste extratos PGDAS-D por empresa (consumido pela Apresentação Executiva)
  const salvarPgdasHistorico = () => {
    if (!pgdasResults.length) return toast.error("Nada para salvar");
    const r0 = pgdasResults[0].result;
    const payload = {
      cnpj: r0.cnpj,
      razaoSocial: r0.razaoSocial,
      arquivos: pgdasResults.map((r) => r.name),
      meses: pgdasConsolidado,
      totalDAS: pgdasTotalDAS,
      totalFaturamento: pgdasTotalFat,
      salvoEm: new Date().toISOString(),
    };
    try {
      const prev = JSON.parse(localStorage.getItem(PGDAS_HIST_KEY) || "[]");
      prev.push(payload);
      localStorage.setItem(PGDAS_HIST_KEY, JSON.stringify(prev));
      toast.success("Extrato PGDAS-D salvo no histórico (disponível na Apresentação Executiva).");
    } catch {
      toast.error("Não foi possível salvar (armazenamento cheio).");
    }
  };

  const exportarPgdasCSV = () => {
    if (!pgdasConsolidado.length) return;
    const headers = ["Período", "Faturamento (RPA)", "RBT12", "DAS Total", "IRPJ", "CSLL", "COFINS", "PIS", "CPP", "ICMS", "ISS"];
    const linhas = pgdasConsolidado.map((m) => [
      m.periodo,
      m.faturamento, m.rbt12 || 0, m.das || 0,
      m.irpj || 0, m.csll || 0, m.cofins, m.pis, m.cpp || 0, m.icmsDebito, m.iss,
    ]);
    const csv = [headers, ...linhas]
      .map((row) => row.map((c) => `"${typeof c === "number" ? String(c).replace(".", ",") : c}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pgdas-${pgdasResults[0]?.result.cnpj || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cadastrarCliente = async () => {
    const r = results[0]?.result;
    if (!r) return;
    const nameSped = r.razaoSocial?.trim();
    const cnpjSped = r.cnpj ? formatCNPJ(r.cnpj) : "";
    const cnpjDigits = (r.cnpj || "").replace(/\D/g, "");
    if (!nameSped && !cnpjDigits) return toast.error("CNPJ/Razão social não encontrados no SPED");

    // Tenta enriquecer automaticamente com BrasilAPI / ReceitaWS
    let d: Awaited<ReturnType<typeof lookupCnpj>> | null = null;
    if (cnpjDigits.length === 14) {
      try { d = await lookupCnpj(cnpjDigits); } catch { /* segue só com dados do SPED */ }
    }
    try {
      await apiClients.create({
        name: d?.razaoSocial || nameSped || "",
        nomeFantasia: d?.nomeFantasia || null,
        cnpj: cnpjSped || null,
        inscricaoEstadual: d?.inscricaoEstadual || null,
        inscricaoMunicipal: null,
        taxRegime: d?.taxRegime || null,
        naturezaJuridica: d?.naturezaJuridica || null,
        porte: d?.porte || null,
        dataAbertura: d?.dataAbertura || null,
        situacaoCadastral: d?.situacaoCadastral || null,
        capitalSocial: d?.capitalSocial || null,
        activity: d?.cnaePrincipalDescricao || null,
        cnaePrincipalCodigo: d?.cnaePrincipalCodigo || null,
        cnaePrincipalDescricao: d?.cnaePrincipalDescricao || null,
        cnaesSecundarios: d?.cnaesSecundarios?.length ? d.cnaesSecundarios : null,
        cep: d?.cep || null,
        logradouro: d?.logradouro || null,
        numero: d?.numero || null,
        complemento: d?.complemento || null,
        bairro: d?.bairro || null,
        municipio: d?.municipio || null,
        uf: d?.uf || null,
        address: d?.enderecoFormatado || null,
        telefone: d?.telefone || null,
        telefoneSecundario: d?.telefoneSecundario || null,
        email: d?.email || null,
        notes: `Cadastrado a partir do SPED em ${new Date().toLocaleDateString("pt-BR")}`,
      });
    } catch (e: any) {
      return toast.error(e.message || "Erro ao cadastrar cliente");
    }
    toast.success(d
      ? `Cliente "${d.razaoSocial || nameSped}" cadastrado com dados completos do CNPJ`
      : `Cliente "${nameSped}" cadastrado (sem enriquecimento — CNPJ não encontrado online)`);
  };

  const exportarCSV = () => {
    if (!consolidado.length) return;
    const headers = ["Período", ...FIELDS.map((f) => f.label)];
    const linhas = consolidado.map((m) => [
      m.periodo,
      ...FIELDS.map((f) => String((m as any)[f.key]).replace(".", ",")),
    ]);
    const totalRow = ["Total", ...FIELDS.map((f) => String((totais as any)[f.key]).replace(".", ","))];
    const csv = [headers, ...linhas, totalRow]
      .map((row) => row.map((c) => `"${c}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sped-consolidado-${results[0]?.result.cnpj || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = async () => {
    if (!consolidado.length) return;
    const r0 = results[0]?.result;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();
    const MARGIN = 10;

    // Cabeçalho com logo
    try {
      const img = await fetch(econLogo).then((r) => r.blob());
      const dataUrl: string = await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.readAsDataURL(img);
      });
      doc.addImage(dataUrl, "PNG", MARGIN, 8, 22, 12);
    } catch {}

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Relatório de Leitura de SPED", pageW - MARGIN, 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(
      `${r0?.razaoSocial || "—"}${r0?.cnpj ? ` · CNPJ ${formatCNPJ(r0.cnpj)}` : ""}`,
      pageW - MARGIN, 19, { align: "right" },
    );
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} · ${results.length} arquivo(s)`,
      pageW - MARGIN, 23.5, { align: "right" },
    );
    doc.setTextColor(0);

    const head = [["Período", ...FIELDS.map((f) => f.label)]];
    const body = consolidado.map((m) => [
      m.periodo,
      ...FIELDS.map((f) => formatBRL((m as any)[f.key])),
    ]);
    const foot = [["Total", ...FIELDS.map((f) => formatBRL((totais as any)[f.key]))]];

    autoTable(doc, {
      head, body, foot,
      startY: 30,
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.8, lineWidth: 0.1, lineColor: [220, 220, 220] },
      headStyles: { fillColor: [30, 30, 30], textColor: [240, 200, 60], fontSize: 7.5, halign: "center" },
      bodyStyles: { halign: "right" },
      footStyles: { fillColor: [240, 200, 60], textColor: [30, 30, 30], fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
      alternateRowStyles: { fillColor: [250, 249, 245] },
    });

    // Lista de arquivos lidos
    let y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 100;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Arquivos processados", MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    for (const { name, result } of results) {
      const linha = `• ${name} — ${result.tipo} · ${result.meses.length} mês(es) · ${result.registrosLidos} registros`;
      doc.text(linha, MARGIN, y);
      y += 4.5;
    }

    doc.save(`relatorio-sped-${r0?.cnpj || "export"}.pdf`);
  };

  const toggleField = (fileName: string, key: string, checked: boolean) => {
    setFieldsByFile((prev) => {
      const cur = new Set(prev[fileName] ?? []);
      if (checked) cur.add(key); else cur.delete(key);
      return { ...prev, [fileName]: cur };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Leitura de SPED e Extrato SN</div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Leitor de SPED e Extrato Simples Nacional</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe arquivos EFD ICMS/IPI, EFD-Contribuições ou o <strong>Extrato do Simples Nacional (PGDAS-D)</strong> para extrair faturamento, compras, impostos e DAS por competência.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Importar arquivos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Arquivos SPED (.txt)</Label>
            <Input type="file" multiple accept=".txt" onChange={(e) => handleFiles(e.target.files)} />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} arquivo(s) selecionado(s): {files.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={processar} disabled={loading || !files.length}>
              <FileText className="w-4 h-4 mr-2" />
              {loading ? "Processando…" : results.length ? "Adicionar período" : "Processar SPED"}
            </Button>
            {results.length > 0 && (
              <Button variant="outline" onClick={limparTudo}>
                <Trash2 className="w-4 h-4 mr-2" /> Limpar importação
              </Button>
            )}
          </div>
          {results.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <Plus className="w-3 h-3 inline mr-1" />
              Selecione novos arquivos e clique em <strong>Adicionar período</strong> para incluir mais competências
              da mesma empresa.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ============== EXTRATO PGDAS-D (PDF) ============== */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Extrato do Simples Nacional (PGDAS-D · PDF)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Carregue um ou mais PDFs do Extrato emitido pelo Portal do Simples Nacional para extrair
            <strong> RBT12, faturamento (RPA), DAS pago e tributos por competência</strong>.
            O parser tolera variações de layout e identifica períodos automaticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Extratos PGDAS-D (.pdf)</Label>
            <Input type="file" multiple accept=".pdf,application/pdf" onChange={(e) => handlePgdasFiles(e.target.files)} />
            {pgdasFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {pgdasFiles.length} arquivo(s): {pgdasFiles.map((f) => f.name).join(", ")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={processarPgdas} disabled={pgdasLoading || !pgdasFiles.length}>
              <FileText className="w-4 h-4 mr-2" />
              {pgdasLoading ? "Processando PDF…" : "Processar Extrato"}
            </Button>
            {pgdasResults.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={exportarPgdasCSV}>
                  <Download className="w-4 h-4 mr-2" /> Exportar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={salvarPgdasHistorico}>
                  <History className="w-4 h-4 mr-2" /> Salvar no histórico
                </Button>
                <Button variant="outline" size="sm" onClick={limparPgdas}>
                  <Trash2 className="w-4 h-4 mr-2" /> Limpar
                </Button>
              </>
            )}
          </div>

          {pgdasResults.length > 0 && (
            <div className="space-y-2">
              {pgdasResults.map(({ name, result }) => (
                <div key={name} className="rounded-md border p-3 text-xs">
                  <div className="flex justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {name}
                        <Badge variant="secondary">PGDAS-D</Badge>
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {result.razaoSocial && `${result.razaoSocial} · `}
                        {result.cnpj && `CNPJ ${result.cnpj} · `}
                        {result.inicio && result.fim && `${result.inicio} → ${result.fim}`}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-right">
                      {result.meses.length} período(s) · DAS total: <strong className="text-foreground">{formatBRL(result.totalDAS)}</strong>
                    </div>
                  </div>
                  {result.alertas.length > 0 && (
                    <ul className="mt-2 text-destructive list-disc pl-5">
                      {result.alertas.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {pgdasConsolidado.length > 0 && (
            <div className="overflow-auto max-h-[420px] border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    {["Período", "RPA (Faturamento)", "RBT12", "DAS", "IRPJ", "CSLL", "COFINS", "PIS", "CPP", "ICMS", "ISS"].map((h) => (
                      <th key={h} className="text-right py-2 px-2 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pgdasConsolidado.map((m) => (
                    <tr key={m.periodo} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-semibold">{m.periodo}</td>
                      <td className="text-right">{formatBRL(m.faturamento)}</td>
                      <td className="text-right">{formatBRL(m.rbt12 || 0)}</td>
                      <td className="text-right font-semibold text-primary">{formatBRL(m.das || 0)}</td>
                      <td className="text-right">{formatBRL(m.irpj || 0)}</td>
                      <td className="text-right">{formatBRL(m.csll || 0)}</td>
                      <td className="text-right">{formatBRL(m.cofins)}</td>
                      <td className="text-right">{formatBRL(m.pis)}</td>
                      <td className="text-right">{formatBRL(m.cpp || 0)}</td>
                      <td className="text-right">{formatBRL(m.icmsDebito)}</td>
                      <td className="text-right">{formatBRL(m.iss)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-bold">
                  <tr>
                    <td className="py-2 px-2">Total</td>
                    <td className="text-right">{formatBRL(pgdasTotalFat)}</td>
                    <td className="text-right text-muted-foreground">—</td>
                    <td className="text-right text-primary">{formatBRL(pgdasTotalDAS)}</td>
                    <td colSpan={7} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base">Arquivos lidos</CardTitle>
            <div className="flex gap-2">
              {overlap && (
                <Button size="sm" variant="outline" onClick={() => setMergeOpen(true)}>
                  Configurar mesclagem
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={cadastrarCliente}>
                <UserPlus className="w-4 h-4 mr-2" /> Cadastrar cliente
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map(({ name, result }) => (
              <div key={name} className="rounded-md border p-3 text-sm">
                <div className="flex justify-between flex-wrap gap-2">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {name}
                      <Badge variant="secondary" className="capitalize">{result.tipo}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {result.razaoSocial && `${result.razaoSocial} · `}
                      {result.cnpj && `CNPJ ${result.cnpj} · `}
                      {result.inicio && result.fim && `${result.inicio} → ${result.fim}`}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {result.registrosLidos} registros · {result.meses.length} mês(es)
                  </div>
                </div>
                {result.alertas.length > 0 && (
                  <ul className="mt-2 text-xs text-destructive list-disc pl-5">
                    {result.alertas.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
              </div>
            ))}
            {overlap && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Há arquivos com a mesma competência. Use <strong>Configurar mesclagem</strong> para
                escolher quais informações cada arquivo deve contribuir.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {consolidado.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Resumo consolidado por mês
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportarCSV}>
                <Download className="w-4 h-4 mr-2" /> Exportar CSV
              </Button>
              <Button size="sm" onClick={exportarPDF}>
                <FileDown className="w-4 h-4 mr-2" /> Exportar PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[520px]">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  {["Período", ...FIELDS.map((f) => f.label)].map((h) => (
                    <th key={h} className="text-right py-2 px-2 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consolidado.map((m) => (
                  <tr key={m.periodo} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-semibold">{m.periodo}</td>
                    {FIELDS.map((f) => (
                      <td key={f.key as string} className="text-right">{formatBRL((m as any)[f.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr className="font-bold">
                  <td className="py-2 px-2">Total</td>
                  {FIELDS.map((f) => (
                    <td key={f.key as string} className="text-right">{formatBRL((totais as any)[f.key])}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {consolidado.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={enviarParaSimulacao} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Usar dados em nova simulação <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Modal de mesclagem por arquivo */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mesclagem de informações</DialogTitle>
            <DialogDescription>
              Existem arquivos com a mesma competência. Escolha quais campos cada arquivo deve
              contribuir para o consolidado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {results.map(({ name, result }) => {
              const set = fieldsByFile[name] ?? defaultFieldOriginFor(result.tipo);
              return (
                <div key={name} className="rounded-md border p-3">
                  <div className="font-semibold text-sm flex items-center gap-2 mb-2">
                    {name} <Badge variant="secondary" className="capitalize">{result.tipo}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {FIELDS.map((f) => (
                      <label key={f.key as string} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={set.has(f.key as string)}
                          onCheckedChange={(c) => toggleField(name, f.key as string, !!c)}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setMergeOpen(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflito de empresa */}
      <AlertDialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" /> Empresa diferente detectada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os arquivos selecionados pertencem a um CNPJ diferente do que está sendo trabalhado.
              <br />
              Atual: <strong>{conflict && formatCNPJ(conflict.existingCnpj)}</strong>
              <br />
              Novo: <strong>{conflict && formatCNPJ(conflict.newCnpj)}</strong>
              <br /><br />
              Deseja salvar o histórico da empresa atual antes de iniciar uma nova importação?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => confirmConflict(false)}>
              Descartar e iniciar nova
            </Button>
            <AlertDialogAction onClick={() => confirmConflict(true)}>
              Salvar histórico e iniciar nova
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
