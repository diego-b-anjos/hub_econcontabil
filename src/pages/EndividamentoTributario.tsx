import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, FileDown, FileSpreadsheet, Landmark, Receipt, Wallet, RefreshCw, ShieldCheck, CheckCircle2, History as HistoryIcon, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/econ-logo.png";
import { Button } from "@/components/ui/button";
import { UploadUnificado, type ArquivoDetectado, type DetectedKind } from "@/components/endividamento/UploadUnificado";
import { AtalhoPgeSP } from "@/components/endividamento/AtalhoPgeSP";
import { StatCard } from "@/components/endividamento/StatCard";
import { TotaisPorEnte } from "@/components/endividamento/TotaisPorEnte";
import { DebitosTable } from "@/components/endividamento/DebitosTable";
import { ParcelamentosList } from "@/components/endividamento/ParcelamentosList";
import { ImportDiagnostics } from "@/components/endividamento/ImportDiagnostics";
import { CertidoesNegativasCard } from "@/components/endividamento/CertidoesNegativasCard";
import { CadastroEditor } from "@/components/endividamento/CadastroEditor";
import { VersaoDatasEditor } from "@/components/endividamento/VersaoDatasEditor";
import { HistoricoVersoes, type VersaoSnapshot } from "@/components/endividamento/HistoricoVersoes";
import { parsePdf, type ForceType } from "@/lib/endividamento/pdfParser";
import { tentarParserExtra } from "@/lib/endividamento/extraParsers";
import { exportarExcel, exportarPDF } from "@/lib/endividamento/exporters";
import { fmtBRL } from "@/lib/endividamento/format";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { ActiveClientFilterChip } from "@/components/ActiveClientFilterChip";
import { apiClients } from "@/lib/api";
import type { Debito, Parcelamento, DadosCadastrais, Orgao, DiagnosticoImport, CertidaoNegativa, StatusParc } from "@/lib/endividamento/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";

const inferStatus = (d: Debito): StatusParc => {
  if (d.statusParc) return d.statusParc;
  if (!d.parcelado) return "devedor";
  const s = (d.situacao || "").toUpperCase();
  if (/RESCIS/.test(s)) return "rescisao";
  if (/ATRASO/.test(s)) return "em-atraso";
  if (/D[IÍ]VIDA ATIVA|INSCRITO/.test(s)) return "divida-ativa";
  return "em-dia";
};

const STORAGE_KEY = "painel-fiscal-econ:v1";
const HISTORY_KEY = "painel-fiscal-econ:historico:v1";
const PREF_KEY = "painel-fiscal-econ:prefs:v1";

const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as {
      debitos: Debito[];
      parcelamentos: Parcelamento[];
      cadastro: DadosCadastrais;
      dataAtualizacao: string;
      certidoes: CertidaoNegativa[];
      versao?: number;
      datasPorOrgao?: Partial<Record<Orgao, string>>;
    };
  } catch {
    return null;
  }
};

const loadHistorico = (): VersaoSnapshot[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as VersaoSnapshot[]) : [];
  } catch {
    return [];
  }
};

interface Prefs {
  ocultarPendenciasDeclaracao: boolean;
}
const loadPrefs = (): Prefs => {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { ocultarPendenciasDeclaracao: false };
    return { ocultarPendenciasDeclaracao: false, ...(JSON.parse(raw) || {}) };
  } catch {
    return { ocultarPendenciasDeclaracao: false };
  }
};

const EndividamentoTributario = () => {
  const persisted = loadPersisted();
  const [debitos, setDebitos] = useState<Debito[]>(persisted?.debitos ?? []);
  const [parcelamentos, setParcelamentos] = useState<Parcelamento[]>(persisted?.parcelamentos ?? []);
  const [cadastro, setCadastro] = useState<DadosCadastrais>(persisted?.cadastro ?? {});

  // Pré-preenche o cadastro a partir do primeiro cliente do filtro global.
  // Só sobrescreve campos que ainda estão vazios (preserva o que o usuário digitou).
  const { selectedIds: globalSelectedIds } = useSelectedClients();
  useEffect(() => {
    if (!globalSelectedIds.length) return;
    let cancelled = false;
    apiClients.list().then((all) => {
      if (cancelled) return;
      const first = globalSelectedIds.map((id) => all.find((c) => c.id === id)).find((c) => !!c);
      if (!first) return;
      setCadastro((prev) => ({
        ...prev,
        razaoSocial: prev.razaoSocial || first.name || prev.razaoSocial,
        cnpj: prev.cnpj || first.cnpj || prev.cnpj,
      }));
    }).catch(() => { /* silencioso */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSelectedIds]);
  const [dataAtualizacao, setDataAtualizacao] = useState<string>(
    persisted?.dataAtualizacao ?? new Date().toLocaleString("pt-BR"),
  );
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoImport[]>([]);
  const [certidoes, setCertidoes] = useState<CertidaoNegativa[]>(persisted?.certidoes ?? []);
  const [versao, setVersao] = useState<number>(persisted?.versao ?? 1);
  const [datasPorOrgao, setDatasPorOrgao] = useState<Partial<Record<Orgao, string>>>(
    persisted?.datasPorOrgao ?? {},
  );
  const [historico, setHistorico] = useState<VersaoSnapshot[]>(loadHistorico);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [aba, setAba] = useState<"painel" | "historico">("painel");
  const [importing, setImporting] = useState(false);

  // Diálogo de nomeação da versão antes de exportar.
  const [exportDialog, setExportDialog] = useState<{
    formato: "excel" | "pdf";
    fn: (rel: typeof relatorio) => void | Promise<void>;
  } | null>(null);
  const [nomeVersao, setNomeVersao] = useState("");
  const hojeBR = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };
  const [dataVersao, setDataVersao] = useState(hojeBR());
  // Override pontual da preferência durante a exportação (refletido no relatório).
  const [exportOcultarDecl, setExportOcultarDecl] = useState<boolean>(false);

  // Persiste histórico de versões exportadas separadamente.
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historico));
    } catch {
      // ignora
    }
  }, [historico]);

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* noop */ }
  }, [prefs]);

  // Persiste automaticamente classificações manuais (statusParc), edições e exclusões.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          debitos,
          parcelamentos,
          cadastro,
          dataAtualizacao,
          certidoes,
          versao,
          datasPorOrgao,
        }),
      );
    } catch {
      // Quota excedida ou navegador em modo privado: ignora silenciosamente.
    }
  }, [debitos, parcelamentos, cadastro, dataAtualizacao, certidoes, versao, datasPorOrgao]);

  const [reprocessingFile, setReprocessingFile] = useState<string | null>(null);
  const arquivosRef = useRef<Map<string, File>>(new Map());
  const reenviarRef = useRef<HTMLInputElement>(null);
  /** Mapeia o tipo detectado pela UI unificada para os parâmetros do pdfParser. */
  const mapearTipo = (
    tipo: DetectedKind,
  ): { orgao?: Orgao; force?: ForceType; usaPdfParser: boolean } => {
    switch (tipo) {
      case "rfb": return { orgao: "RFB", force: "rfb", usaPdfParser: true };
      case "darf": return { orgao: "RFB", usaPdfParser: true };
      case "pgfn-regularize": return { orgao: "PGFN", force: "pgfn-regularize", usaPdfParser: true };
      case "municipal-osasco": return { orgao: "Municipal", force: "municipal-osasco", usaPdfParser: true };
      case "municipal-generico": return { orgao: "Municipal", force: "municipal-generico", usaPdfParser: true };
      case "estadual-generico": return { orgao: "Estadual", usaPdfParser: true };
      // Os tipos abaixo são tratados pelos parsers extras
      case "pgfn-csv":
      case "sefaz-sp":
      case "pge-sp":
      case "cnd-sp":
      case "desconhecido":
      default:
        return { usaPdfParser: false };
    }
  };

  /** Importa lote de arquivos detectados pelo UploadUnificado. */
  const importarUnificado = async (itens: ArquivoDetectado[]) => {
    setImporting(true);
    try {
      // Agrupa por arquivo, processando cada um com o parser apropriado.
      const novosDiag: DiagnosticoImport[] = [];
      const novasDatas: Partial<Record<Orgao, string>> = {};
      let added = 0;

      const aplicar = (r: Partial<typeof relatorio>) => {
        if (r.cadastro && Object.keys(r.cadastro).length) setCadastro((c) => ({ ...c, ...r.cadastro }));
        if (r.certidoesNegativas?.length) {
          setCertidoes((prev) => {
            const key = (c: CertidaoNegativa) => `${c.orgao}|${c.emissor}`;
            const map = new Map(prev.map((c) => [key(c), c]));
            r.certidoesNegativas!.forEach((c) => map.set(key(c), c));
            return [...map.values()];
          });
          added += r.certidoesNegativas.length;
        }
        if (r.debitos?.length) {
          setDebitos((prev) => {
            const key = (d: Debito) => `${d.orgao}|${d.receita}|${d.competencia}|${d.observacao || ""}`;
            const map = new Map(prev.map((d) => [key(d), d]));
            r.debitos!.forEach((d) => map.set(key(d), d));
            return [...map.values()];
          });
          added += r.debitos.length;
        }
        if (r.parcelamentos?.length) {
          setParcelamentos((prev) => {
            const key = (p: Parcelamento) => `${p.orgao}|${p.identificador}`;
            const map = new Map(prev.map((p) => [key(p), p]));
            r.parcelamentos!.forEach((p) => map.set(key(p), p));
            return [...map.values()];
          });
          added += r.parcelamentos.length;
        }
      };

      for (const { file, tipo } of itens) {
        try {
          arquivosRef.current.set(file.name, file);
          const { orgao, force, usaPdfParser } = mapearTipo(tipo);
          let extraData: Partial<typeof relatorio> | null = null;
          let diagnostico: DiagnosticoImport;

          if (!usaPdfParser) {
            const extra = await tentarParserExtra(file);
            if (extra) {
              extraData = extra.data as Partial<typeof relatorio>;
              diagnostico = extra.diagnostico;
            } else {
              // Usuário marcou como "desconhecido" mas o parser extra também falhou.
              // Tenta o pdfParser com o tipo bruto.
              const r = await parsePdf(file);
              extraData = r.data as Partial<typeof relatorio>;
              diagnostico = r.diagnostico;
            }
          } else {
            const r = await parsePdf(file, orgao, "auto", force);
            extraData = r.data as Partial<typeof relatorio>;
            diagnostico = r.diagnostico;
          }

          novosDiag.push(diagnostico);
          if (extraData?.dataAtualizacao) {
            setDataAtualizacao(extraData.dataAtualizacao);
            const orgaoArquivo: Orgao | undefined =
              orgao ??
              extraData.debitos?.[0]?.orgao ??
              extraData.parcelamentos?.[0]?.orgao ??
              extraData.certidoesNegativas?.[0]?.orgao;
            if (orgaoArquivo) novasDatas[orgaoArquivo] = extraData.dataAtualizacao;
          }
          aplicar(extraData || {});

          const cert = extraData?.certidoesNegativas?.length || 0;
          if ((extraData?.debitos?.length || 0) + (extraData?.parcelamentos?.length || 0) + cert > 0) {
            toast.success(`${file.name} importado`, {
              description: cert
                ? `Certidão NEGATIVA reconhecida (${extraData!.certidoesNegativas![0].emissor})`
                : `${extraData?.debitos?.length || 0} débitos • ${extraData?.parcelamentos?.length || 0} parcelamentos`,
            });
          } else {
            toast.warning(`${file.name}: nada importado`, {
              description: "Veja o diagnóstico abaixo.",
            });
          }
        } catch (e) {
          console.error(e);
          toast.error(`Falha ao ler ${file.name}`);
        }
      }

      setDiagnosticos((prev) => {
        const byName = new Map(prev.map((d) => [d.arquivo, d]));
        novosDiag.forEach((d) => byName.set(d.arquivo, d));
        return [...byName.values()];
      });
      if (Object.keys(novasDatas).length) {
        setDatasPorOrgao((prev) => ({ ...prev, ...novasDatas }));
      }
      if (!added) toast.warning("Nenhum dado novo encontrado — confira o diagnóstico");
    } finally {
      setImporting(false);
    }
  };

  const handleUpload = async (
    files: File[],
    orgaoHint?: Orgao,
    mode: "auto" | "coluna" = "auto",
    forceType?: ForceType,
  ) => {
    let added = 0;
    const novosDiag: DiagnosticoImport[] = [];
    const novasDatas: Partial<Record<Orgao, string>> = {};
    for (const file of files) {
      try {
        arquivosRef.current.set(file.name, file);
        const { data: r, diagnostico } = await parsePdf(file, orgaoHint, mode, forceType);
        novosDiag.push(diagnostico);
        if (r.cadastro && Object.keys(r.cadastro).length) setCadastro((c) => ({ ...c, ...r.cadastro }));
        if (r.dataAtualizacao) {
          setDataAtualizacao(r.dataAtualizacao);
          // Determina o órgão deste arquivo para registrar a data por ente.
          const orgaoArquivo: Orgao | undefined =
            orgaoHint ??
            (forceType === "pgfn-regularize"
              ? "PGFN"
              : forceType === "rfb"
              ? "RFB"
              : r.debitos?.[0]?.orgao ??
                r.parcelamentos?.[0]?.orgao ??
                r.certidoesNegativas?.[0]?.orgao);
          if (orgaoArquivo) novasDatas[orgaoArquivo] = r.dataAtualizacao;
        }
        if (r.certidoesNegativas?.length) {
          setCertidoes((prev) => {
            const key = (c: CertidaoNegativa) => `${c.orgao}|${c.emissor}`;
            const map = new Map(prev.map((c) => [key(c), c]));
            r.certidoesNegativas!.forEach((c) => map.set(key(c), c));
            return [...map.values()];
          });
          added += r.certidoesNegativas.length;
        }
        if (r.debitos?.length) {
          setDebitos((prev) => {
            const key = (d: Debito) => `${d.orgao}|${d.receita}|${d.competencia}|${d.observacao || ""}`;
            const map = new Map(prev.map((d) => [key(d), d]));
            r.debitos!.forEach((d) => map.set(key(d), d));
            return [...map.values()];
          });
          added += r.debitos.length;
        }
        if (r.parcelamentos?.length) {
          setParcelamentos((prev) => {
            const key = (p: Parcelamento) => `${p.orgao}|${p.identificador}`;
            const map = new Map(prev.map((p) => [key(p), p]));
            r.parcelamentos!.forEach((p) => map.set(key(p), p));
            return [...map.values()];
          });
          added += r.parcelamentos.length;
        }
        const cert = r.certidoesNegativas?.length || 0;
        if ((r.debitos?.length || 0) + (r.parcelamentos?.length || 0) + cert > 0) {
          toast.success(`${file.name} importado`, {
            description: cert
              ? `Certidão NEGATIVA reconhecida (${r.certidoesNegativas![0].emissor})`
              : `${r.debitos?.length || 0} débitos • ${r.parcelamentos?.length || 0} parcelamentos`,
          });
        } else {
          toast.warning(`${file.name}: nada importado`, {
            description: "Veja o diagnóstico abaixo.",
          });
        }
      } catch (e) {
        console.error(e);
        toast.error(`Falha ao ler ${file.name}`);
      }
    }
    setDiagnosticos((prev) => {
      const byName = new Map(prev.map((d) => [d.arquivo, d]));
      novosDiag.forEach((d) => byName.set(d.arquivo, d));
      return [...byName.values()];
    });
    if (Object.keys(novasDatas).length) {
      setDatasPorOrgao((prev) => ({ ...prev, ...novasDatas }));
    }
    if (!added) toast.warning("Nenhum dado novo encontrado — confira o diagnóstico");
  };

  const handleReenvio = (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (arr.length) handleUpload(arr);
    if (reenviarRef.current) reenviarRef.current.value = "";
  };

  const handleReprocessColumn = async (arquivo: string) => {
    const file = arquivosRef.current.get(arquivo);
    if (!file) {
      toast.error("Arquivo original não disponível — reenvie o PDF.");
      return;
    }
    setReprocessingFile(arquivo);
    // Remove débitos/parcelamentos prévios deste arquivo (best-effort: limpa tudo do mesmo nome via reimport)
    try {
      await handleUpload([file], undefined, "coluna");
      toast.success(`${arquivo} reprocessado em modo coluna`);
    } finally {
      setReprocessingFile(null);
    }
  };

  const totals = useMemo(() => {
    const orig = debitos.reduce((s, d) => s + d.valorOriginal, 0);
    const multa = debitos.reduce((s, d) => s + d.multa, 0);
    const juros = debitos.reduce((s, d) => s + d.juros, 0);
    // Parcelamentos em atraso vindos da lista de parcelamentos.
    const parc = parcelamentos.reduce((s, p) => s + (p.valorEmAtraso || 0), 0);
    // Separa débitos por status semântico:
    //   • "em-dia"      → Total Regularizado (NÃO entra no Total Devido)
    //   • "em-atraso"   → Total Devido + soma como "Parc. em Atraso"
    //   • "rescisao"    → Total Devido (acordo em risco)
    //   • "devedor"     → Total Devido
    let regularizado = 0;
    let devidoDebitos = 0;
    let parcAtrasoDebitos = 0;
    debitos.forEach((d) => {
      const st = inferStatus(d);
      if (st === "em-dia") regularizado += d.total;
      else {
        devidoDebitos += d.total;
        if (st === "em-atraso") parcAtrasoDebitos += d.total;
      }
    });
    const total = devidoDebitos + parc;
    const parcAtrasoTotal = parcAtrasoDebitos + parc;
    return { orig, multa, juros, total, parc: parcAtrasoTotal, regularizado };
  }, [debitos, parcelamentos]);

  const relatorio = {
    cadastro,
    dataAtualizacao,
    debitos,
    parcelamentos,
    certidoesNegativas: certidoes,
    versao,
    datasPorOrgao,
  };
  const exportarComVersao = async (
    fn: (rel: typeof relatorio) => void | Promise<void>,
    formato: "excel" | "pdf",
  ) => {
    // Abre diálogo para nomear a versão antes de gerar o arquivo.
    setNomeVersao(
      cadastro.razaoSocial ? `${cadastro.razaoSocial} — Atualização` : "",
    );
    setDataVersao(hojeBR());
    setExportOcultarDecl(prefs.ocultarPendenciasDeclaracao);
    setExportDialog({ fn, formato });
  };

  const confirmarExport = async () => {
    if (!exportDialog) return;
    const { fn, formato } = exportDialog;
    const relComMeta = {
      ...relatorio,
      ocultarPendenciasDeclaracao: exportOcultarDecl,
    };
    const snapshot: VersaoSnapshot = {
      versao,
      exportadoEm: new Date().toISOString(),
      formato,
      relatorio: JSON.parse(JSON.stringify(relComMeta)),
      nome: nomeVersao.trim() || undefined,
      dataVersao: dataVersao.trim() || undefined,
    };
    setExportDialog(null);
    await fn(relComMeta);
    setHistorico((h) => [snapshot, ...h].slice(0, 50));
    setVersao((v) => v + 1);
  };
  const limpar = () => {
    setDebitos([]); setParcelamentos([]); setCadastro({}); setDiagnosticos([]); setCertidoes([]);
    setDatasPorOrgao({});
    setVersao(1);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    toast.info("Dados limpos");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 pt-3"><ActiveClientFilterChip /></div>
      {/* Top bar */}
      <header className="bg-secondary border-b-4 border-primary">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-background rounded-md p-2">
              <img src={logo} alt="Econ Escritório Contábil" className="h-10" />
            </div>
            <div>
              <h1 className="text-primary font-bold text-lg leading-tight">Painel Fiscal Econ</h1>
              <p className="text-primary/70 text-xs">Endividamento tributário consolidado</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-primary/80 text-xs">
            <ShieldCheck className="h-4 w-4" />
            Processamento 100% local — nenhum arquivo é enviado a servidores
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Hero / Cliente */}
        <section className="rounded-2xl bg-gradient-dark p-6 md:p-10 shadow-card relative overflow-hidden">
          <div className="absolute inset-0 bg-secondary/30" />
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -left-16 -bottom-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-widest uppercase text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Cliente
              </span>
              <h2 className="text-3xl font-extrabold leading-[1.05] tracking-tight text-background sm:text-4xl md:text-5xl lg:text-6xl">
                {cadastro.razaoSocial || "Aguardando upload do relatório fiscal"}
              </h2>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-background/85 md:text-base">
                {cadastro.cnpj && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-background/55">CNPJ</span>
                    <span className="font-semibold text-primary">{cadastro.cnpj}</span>
                  </span>
                )}
                {cadastro.inscricaoMunicipal && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-background/40" />
                    <span className="text-background/55">Inscr. Municipal</span>
                    <span className="font-semibold text-primary">{cadastro.inscricaoMunicipal}</span>
                  </span>
                )}
                {cadastro.inscricaoEstadual && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-background/40" />
                    <span className="text-background/55">Inscr. Estadual</span>
                    <span className="font-semibold text-primary">{cadastro.inscricaoEstadual}</span>
                  </span>
                )}
                {cadastro.municipio && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-background/40" />
                    <span className="font-medium text-background">{cadastro.municipio}/{cadastro.uf}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-background/40" />
                  <span className="text-background/70">Atualizado em {dataAtualizacao}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-background/40" />
                  <span className="text-background/55">Versão</span>
                  <span className="font-semibold text-primary">#{versao}</span>
                </span>
              </div>
              {Object.keys(datasPorOrgao).length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-background/70">
                  <span className="uppercase tracking-wider text-background/50">Datas por ente:</span>
                  {(Object.keys(datasPorOrgao) as Orgao[]).map((o) => (
                    <span key={o} className="inline-flex items-center gap-1.5">
                      <span className="text-background/55">{o}</span>
                      <span className="font-semibold text-primary">{datasPorOrgao[o]}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="pt-2">
                <CadastroEditor cadastro={cadastro} onChange={setCadastro} />
              </div>
              <div>
                <VersaoDatasEditor
                  versao={versao}
                  dataAtualizacao={dataAtualizacao}
                  datasPorOrgao={datasPorOrgao}
                  onChange={(patch) => {
                    if (patch.versao !== undefined) setVersao(patch.versao);
                    if (patch.dataAtualizacao !== undefined) setDataAtualizacao(patch.dataAtualizacao);
                    if (patch.datasPorOrgao !== undefined) setDatasPorOrgao(patch.datasPorOrgao);
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 lg:flex-nowrap lg:justify-end">
              <Button
                variant="outline"
                onClick={limpar}
                disabled={!debitos.length && !parcelamentos.length}
                className="h-11 min-w-[130px] border-background/25 bg-background/5 text-background backdrop-blur-sm hover:bg-background/15 hover:text-background"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Limpar
              </Button>
              <Button
                onClick={() => exportarComVersao(exportarExcel, "excel")}
                disabled={!debitos.length}
                className="h-11 min-w-[170px] border border-background/15 bg-background text-secondary shadow-sm hover:bg-background/90"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar Excel
              </Button>
              <Button
                onClick={() => exportarComVersao(exportarPDF, "pdf")}
                disabled={!debitos.length}
                className="h-11 min-w-[170px] bg-primary text-primary-foreground font-semibold shadow-brand hover:bg-primary/90"
              >
                <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
              </Button>
            </div>
          </div>
        </section>

        <Tabs value={aba} onValueChange={(v) => setAba(v as "painel" | "historico")}>
          <TabsList>
            <TabsTrigger value="painel"><LayoutDashboard className="h-4 w-4 mr-2" />Painel</TabsTrigger>
            <TabsTrigger value="historico"><HistoryIcon className="h-4 w-4 mr-2" />Histórico de versões</TabsTrigger>
          </TabsList>

          <TabsContent value="painel" className="space-y-8">
            {/* Totais por ente (verde quando sem pendências) */}
            <TotaisPorEnte debitos={debitos} parcelamentos={parcelamentos} />

            {/* Stats consolidados */}
            <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <StatCard label="Valor Original" value={fmtBRL(totals.orig)} icon={Receipt} />
              <StatCard label="Multa" value={fmtBRL(totals.multa)} icon={Wallet} />
              <StatCard label="Juros" value={fmtBRL(totals.juros)} icon={Wallet} />
              <StatCard label="Total Devido" value={fmtBRL(totals.total)} icon={Landmark} highlight hint="Débitos em aberto + parcelamentos em atraso/rescisão" />
              <StatCard label="Parc. em Atraso" value={fmtBRL(totals.parc)} icon={Building2} hint={`${parcelamentos.length} parcelamento(s)`} />
              <StatCard label="Total Regularizado" value={fmtBRL(totals.regularizado)} icon={CheckCircle2} hint="Parcelamentos em dia (não entram no devido)" />
            </section>

            {/* Upload unificado */}
            <section>
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <h3 className="text-lg font-bold">Importar relatórios</h3>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={prefs.ocultarPendenciasDeclaracao}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, ocultarPendenciasDeclaracao: !!v }))}
                  />
                  Ocultar pendências de declarações na exportação
                </label>
              </div>
              <div className="mb-3">
                <AtalhoPgeSP cnpjPadrao={cadastro.cnpj || ""} />
              </div>
              <UploadUnificado onConfirm={importarUnificado} busy={importing} />
            </section>
          </TabsContent>

          <TabsContent value="historico">
            <HistoricoVersoes
              historico={historico}
              onClear={() => { setHistorico([]); toast.info("Histórico limpo"); }}
              onRemove={(idx) => setHistorico((h) => h.filter((_, i) => i !== idx))}
              onImport={(snaps) => setHistorico((h) => [...snaps, ...h].slice(0, 50))}
            />
          </TabsContent>
        </Tabs>

        {aba === "painel" && (<>

        {/* Diagnóstico de importação */}
        {diagnosticos.length > 0 && (
          <section>
            <input
              ref={reenviarRef}
              type="file"
              accept="application/pdf"
              multiple
              hidden
              onChange={(e) => handleReenvio(e.target.files)}
            />
            <ImportDiagnostics
              items={diagnosticos}
              onReimport={() => reenviarRef.current?.click()}
              onClear={() => setDiagnosticos([])}
              onReprocessColumn={handleReprocessColumn}
              reprocessingFile={reprocessingFile}
              canReprocess={(name) => arquivosRef.current.has(name)}
            />
          </section>
        )}

        {/* Parcelamentos */}
        {parcelamentos.length > 0 && (
          <section>
            <ParcelamentosList
              items={parcelamentos}
              onUpdate={(id, patch) =>
                setParcelamentos((prev) =>
                  prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
                )
              }
              onRemove={(id) =>
                setParcelamentos((prev) => prev.filter((p) => p.id !== id))
              }
              onRemoveAll={() => {
                setParcelamentos([]);
                toast.info("Parcelamentos removidos");
              }}
            />
          </section>
        )}

        {/* Certidões negativas */}
        {certidoes.length > 0 && (
          <section>
            <CertidoesNegativasCard
              items={certidoes}
              onRemove={(id) => setCertidoes((p) => p.filter((c) => c.id !== id))}
              onUpdate={(id, patch) =>
                setCertidoes((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)))
              }
            />
          </section>
        )}

        {/* Débitos */}
        <section>
          <h3 className="text-lg font-bold mb-3">Débitos por órgão</h3>
          <DebitosTable
            debitos={debitos}
            onRemove={(id) => setDebitos((p) => p.filter((d) => d.id !== id))}
            onRemoveMany={(ids) => {
              const set = new Set(ids);
              setDebitos((p) => p.filter((d) => !set.has(d.id)));
              toast.success(`${ids.length} débito(s) removido(s)`);
            }}
            onUpdateMany={(ids, patch) => {
              const set = new Set(ids);
              setDebitos((p) => p.map((d) => (set.has(d.id) ? { ...d, ...patch } : d)));
              toast.success(`${ids.length} débito(s) atualizado(s)`);
            }}
            onUpdate={(id, patch) =>
              setDebitos((p) =>
                p.map((d) => {
                  if (d.id !== id) return d;
                  const merged = { ...d, ...patch };
                  // Recalcula total automaticamente quando principal/multa/juros mudarem,
                  // a não ser que o próprio total tenha sido editado nesta operação.
                  const editouValores =
                    "valorOriginal" in patch || "multa" in patch || "juros" in patch;
                  const editouTotal = "total" in patch;
                  if (editouValores && !editouTotal) {
                    merged.total =
                      Number(merged.valorOriginal || 0) +
                      Number(merged.multa || 0) +
                      Number(merged.juros || 0);
                  }
                  return merged;
                }),
              )
            }
          />
        </section>

        </>)}
      </main>

      <footer className="border-t border-border mt-12 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Econ Escritório Contábil — Painel de Endividamento Tributário
      </footer>

      <Dialog open={!!exportDialog} onOpenChange={(o) => !o && setExportDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nomear esta versão</DialogTitle>
            <DialogDescription>
              Identifique este snapshot para localizá-lo facilmente no histórico.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nome-versao" className="text-xs uppercase text-muted-foreground">
                Nome da versão
              </Label>
              <Input
                id="nome-versao"
                placeholder="Ex.: Cliente A — Atualização PGFN"
                value={nomeVersao}
                onChange={(e) => setNomeVersao(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="data-versao" className="text-xs uppercase text-muted-foreground">
                Data da versão (dd/mm/aaaa)
              </Label>
              <Input
                id="data-versao"
                placeholder="dd/mm/aaaa"
                value={dataVersao}
                onChange={(e) => setDataVersao(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Será gerado o arquivo <strong>{exportDialog?.formato.toUpperCase()}</strong> e
              registrado o snapshot #{versao} no histórico.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exportOcultarDecl}
                onCheckedChange={(v) => setExportOcultarDecl(!!v)}
              />
              Ocultar pendências de declarações neste arquivo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarExport}>Exportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EndividamentoTributario;
