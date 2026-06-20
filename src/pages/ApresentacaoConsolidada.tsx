import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { listPptxSlides, type PptxSlideInfo } from "@/lib/pptx-preview";
import { toast } from "sonner";
import { summarizeSci, type SciFatRow } from "@/lib/sci/parser";
import { summarize as summarizeAcc, classifyStatus, type AcessoriasRow } from "@/lib/acessorias/parser";
import { parseChecklist, summarizeChecklist, type ChecklistRow } from "@/lib/integracoes/checklist-parser";
import { summarizeProtocolos, applyResponsaveisFromChecklist, buildResponsavelMap, type ProtocoloRow } from "@/lib/sci/protocolos-parser";
import { safeSaveJSON } from "@/lib/safe-storage";
import { gerarPptx } from "@/lib/apresentacao/exporters/pptx";
import { gerarPdf } from "@/lib/apresentacao/exporters/pdf";
import { useAuth } from "@/contexts/AuthContext";
import { gerarXlsx } from "@/lib/apresentacao/exporters/xlsx";
import { StatusCardsRow } from "@/components/ApresentacaoConsolidada/StatusCardsRow";
import { FiltroClienteCard } from "@/components/ApresentacaoConsolidada/FiltroClienteCard";
import { CapaCard } from "@/components/ApresentacaoConsolidada/CapaCard";
import { MensagemCard } from "@/components/ApresentacaoConsolidada/MensagemCard";
import { SlidesSelectorCard, type SlidesOpts } from "@/components/ApresentacaoConsolidada/SlidesSelectorCard";
import { FiltrosExportacaoCard } from "@/components/ApresentacaoConsolidada/FiltrosExportacaoCard";
import { SlidesExtrasCard } from "@/components/ApresentacaoConsolidada/SlidesExtrasCard";
import { AcoesGeracaoBar } from "@/components/ApresentacaoConsolidada/AcoesGeracaoBar";
import { PreviewDeckDialog } from "@/components/ApresentacaoConsolidada/PreviewDeckDialog";
import { RemoverItemDialog } from "@/components/ApresentacaoConsolidada/RemoverItemDialog";
import type { SlideExtraItem } from "@/components/ApresentacaoConsolidada/types";
import { apiClients, type Client } from "@/lib/api";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { ActiveClientFilterChip } from "@/components/ActiveClientFilterChip";

type EndivSnap = { cadastro?: { razaoSocial?: string; cnpj?: string }; totalConsolidado?: number; totalEmDia?: number; totalDevedor?: number; debitos?: unknown[]; salvoEm?: string; nome?: string };
type ApuracaoHist = { empresa: string; cnpj: string; trimestre: string; resultado: unknown; criadoEm: string };
type SpedHist = { cnpj?: string; razaoSocial?: string; meses?: unknown[]; totais?: unknown; salvoEm?: string };
type PgdasHist = { cnpj?: string; razaoSocial?: string; meses?: unknown[]; totalDAS?: number; totalFaturamento?: number; salvoEm?: string };

export default function ApresentacaoConsolidada() {
  const navigate = useNavigate();
  const { displayName, displayCrc } = useAuth();
  const [sci, setSci] = useState<SciFatRow[]>([]);
  const [acc, setAcc] = useState<AcessoriasRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [protocolos, setProtocolos] = useState<ProtocoloRow[]>([]);
  const checklistRef = useRef<HTMLInputElement>(null);
  const [tituloPersonalizado, setTituloPersonalizado] = useState("");
  const [textoLivre, setTextoLivre] = useState("");
  const [melhorando, setMelhorando] = useState(false);
  const [nomeCapa, setNomeCapa] = useState("");
  const hojeISO = new Date().toISOString().slice(0, 10);
  const [dataCapa, setDataCapa] = useState<string>(hojeISO);
  const [opts, setOpts] = useState<SlidesOpts>({
    capa: true,
    sciVisao: true,
    sciClientes: true,
    sciPorMes: true,
    sciPorPlano: true,
    accVisao: true,
    accObrigacoes: true,
    accResponsaveis: true,
    accEmpresasCriticas: true,
    checklistResp: true,
    protocolosVisao: true,
    protocolosCategorias: true,
    protocolosResponsavel: true,
    protocolosReferencia: true,
    protocolosClientes: true,
    textoLivre: true,
    encerramento: true,
  });
  const [excluirAtrasadas, setExcluirAtrasadas] = useState(false);
  const [slidesExtras, setSlidesExtras] = useState<SlideExtraItem[]>([]);
  const slidesExtrasRef = useRef<HTMLInputElement>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [previewSlides, setPreviewSlides] = useState<PptxSlideInfo[] | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const previewItem = removendoId ? slidesExtras.find((x) => x.id === removendoId) ?? null : null;

  const [endivHist, setEndivHist] = useState<EndivSnap[]>([]);
  const [apuracaoHist, setApuracaoHist] = useState<ApuracaoHist[]>([]);
  const [spedHist, setSpedHist] = useState<SpedHist[]>([]);
  const [pgdasHist, setPgdasHist] = useState<PgdasHist[]>([]);

  useEffect(() => {
    const readJSON = <T,>(key: string, fallback: T): T => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
      catch { return fallback; }
    };
    setSci(readJSON("sci_faturamento_data", []));
    setAcc(readJSON("acessorias_gestao_entregas", []));
    setChecklist(readJSON("checklist_empresas", []));
    setProtocolos(readJSON("sci_protocolos_data", []));
    setEndivHist(readJSON("painel-fiscal-econ:historico:v1", []));
    setApuracaoHist(readJSON("apuracao_trim_historico:v1", []));
    setSpedHist(readJSON("sped_historico_empresas", []));
    setPgdasHist(readJSON("pgdas_historico_empresas", []));
  }, []);

  const handleChecklist = async (f: File) => {
    try {
      const parsed = await parseChecklist(f);
      if (!parsed.length) return toast.error("Planilha sem registros válidos.");
      setChecklist(parsed);
      try { localStorage.setItem("checklist_empresas", JSON.stringify(parsed)); } catch { /* noop */ }
      toast.success(`${parsed.length} empresas carregadas do check-list.`);
    } catch (e) {
      console.error(e); toast.error("Falha ao ler o check-list.");
    }
  };

  const melhorarTexto = async () => {
    if (!textoLivre.trim()) return toast.error("Escreva um texto antes de melhorar com IA.");
    setMelhorando(true);
    try {
      const res = await fetch("/api/melhorar-texto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: textoLivre,
          titulo: tituloPersonalizado || "Mensagem da diretoria",
          contexto: "Apresentação executiva consolidada (SCI + Acessórias) da Econ Escritório Contábil.",
        }),
      });
      if (!res.ok) throw new Error("Funcionalidade de IA não disponível no momento.");
      const data = (await res.json()) as { texto?: string };
      const novo = data?.texto?.trim();
      if (!novo) throw new Error("Resposta vazia da IA.");
      setTextoLivre(novo);
      toast.success("Texto refinado pela IA.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao melhorar texto.");
    } finally {
      setMelhorando(false);
    }
  };

  const [clienteFiltro, setClienteFiltro] = useState<string>("Geral");
  const { selectedIds } = useSelectedClients();
  const [cadastros, setCadastros] = useState<Client[]>([]);
  useEffect(() => {
    if (!selectedIds.length) return;
    let cancelled = false;
    apiClients.list()
      .then((d) => { if (!cancelled) setCadastros(d); })
      .catch(() => { /* silencioso */ });
    return () => { cancelled = true; };
  }, [selectedIds.length]);
  // Sincroniza com o filtro global do header.
  // - Se há clientes selecionados: pré-seleciona o primeiro nome disponível.
  // - Se a seleção global ficou vazia: volta para "Geral".
  useEffect(() => {
    if (!selectedIds.length) {
      if (clienteFiltro !== "Geral") setClienteFiltro("Geral");
      return;
    }
    if (!cadastros.length) return;
    const primeiroNome = selectedIds
      .map((id) => cadastros.find((c) => c.id === id)?.name)
      .find((n): n is string => !!n);
    if (primeiroNome && primeiroNome !== clienteFiltro) {
      setClienteFiltro(primeiroNome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, cadastros]);
  const norm = (s: string) => (s || "").toLowerCase().trim();
  const onlyDig = (s: string) => (s || "").replace(/\D/g, "");

  const clientesDisponiveis = useMemo<{ key: string; label: string; cnpj?: string }[]>(() => {
    const map = new Map<string, { key: string; label: string; cnpj?: string }>();
    const add = (label: string, cnpj?: string) => {
      const lbl = (label || "").trim();
      if (!lbl) return;
      const key = norm(lbl);
      if (!map.has(key)) map.set(key, { key, label: lbl, cnpj: onlyDig(cnpj || "") || undefined });
    };
    sci.forEach((r) => add(r.razaoSocial, r.cnpj));
    acc.forEach((r) => add(r.empresa, r.cnpj));
    checklist.forEach((r) => add(r.empresa, r.cnpj));
    protocolos.forEach((r) => add(r.cliente, r.cnpj));
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [sci, acc, checklist, protocolos]);

  // Set estável de CNPJs do filtro global (multi-cliente). Quando há
  // 2+ clientes selecionados, usamos esse set para restringir os datasets
  // independentemente do clienteFiltro local.
  const cnpjsGlobais = useMemo<Set<string> | null>(() => {
    if (selectedIds.length < 2 || !cadastros.length) return null;
    const s = new Set<string>();
    for (const id of selectedIds) {
      const c = cadastros.find((x) => x.id === id);
      const d = onlyDig(c?.cnpj || "");
      if (d) s.add(d);
    }
    return s.size ? s : null;
  }, [selectedIds, cadastros]);

  const matchCliente = (label?: string, cnpj?: string): boolean => {
    // Multi-cliente: aplica filtro por SET de CNPJs (identificador estável).
    if (cnpjsGlobais) {
      const d = onlyDig(cnpj || "");
      return !!d && cnpjsGlobais.has(d);
    }
    if (clienteFiltro === "Geral") return true;
    const wanted = clientesDisponiveis.find((c) => c.label === clienteFiltro);
    if (!wanted) return false;
    if (label && norm(label) === wanted.key) return true;
    if (cnpj && wanted.cnpj && onlyDig(cnpj) === wanted.cnpj) return true;
    return false;
  };

  const semFiltro = clienteFiltro === "Geral" && !cnpjsGlobais;
  const sciF = useMemo(() => semFiltro ? sci : sci.filter((r) => matchCliente(r.razaoSocial, r.cnpj)), [sci, clienteFiltro, clientesDisponiveis, cnpjsGlobais]);
  const accF = useMemo(() => semFiltro ? acc : acc.filter((r) => matchCliente(r.empresa, r.cnpj)), [acc, clienteFiltro, clientesDisponiveis, cnpjsGlobais]);
  const checklistF = useMemo(() => semFiltro ? checklist : checklist.filter((r) => matchCliente(r.empresa, r.cnpj)), [checklist, clienteFiltro, clientesDisponiveis, cnpjsGlobais]);
  const protocolosF = useMemo(() => semFiltro ? protocolos : protocolos.filter((r) => matchCliente(r.cliente, r.cnpj)), [protocolos, clienteFiltro, clientesDisponiveis, cnpjsGlobais]);

  const endivF = useMemo(() => semFiltro ? endivHist : endivHist.filter((s) => matchCliente(s.cadastro?.razaoSocial, s.cadastro?.cnpj)), [endivHist, clienteFiltro, cnpjsGlobais]);
  const apuracaoF = useMemo(() => semFiltro ? apuracaoHist : apuracaoHist.filter((s) => matchCliente(s.empresa, s.cnpj)), [apuracaoHist, clienteFiltro, cnpjsGlobais]);
  const spedF = useMemo(() => semFiltro ? spedHist : spedHist.filter((s) => matchCliente(s.razaoSocial, s.cnpj)), [spedHist, clienteFiltro, cnpjsGlobais]);
  const pgdasF = useMemo(() => semFiltro ? pgdasHist : pgdasHist.filter((s) => matchCliente(s.razaoSocial, s.cnpj)), [pgdasHist, clienteFiltro, cnpjsGlobais]);

  const sciSummary = useMemo(() => summarizeSci(sciF), [sciF]);

  const checklistRespMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of checklistF) {
      if (!c.responsavel) continue;
      const cnpj = (c.cnpj || "").replace(/\D/g, "");
      if (cnpj) m.set(`cnpj:${cnpj}`, c.responsavel);
      if (c.empresa) m.set(`emp:${c.empresa.toLowerCase().trim()}`, c.responsavel);
    }
    return m;
  }, [checklistF]);

  const accProcessado = useMemo(() => {
    let base = accF;
    if (checklistRespMap.size) {
      base = base.map((r) => {
        const cnpj = (r.cnpj || "").replace(/\D/g, "");
        const novo = (cnpj && checklistRespMap.get(`cnpj:${cnpj}`))
          || (r.empresa && checklistRespMap.get(`emp:${r.empresa.toLowerCase().trim()}`))
          || "";
        if (!novo) return r;
        return { ...r, responsavelEntrega: novo, responsavelPrazo: novo };
      });
    }
    if (excluirAtrasadas) {
      base = base.filter((r) => classifyStatus(r.status) !== "atrasada");
    }
    return base;
  }, [accF, checklistRespMap, excluirAtrasadas]);

  const accSummary = useMemo(() => summarizeAcc(accProcessado), [accProcessado]);
  const checklistSummary = useMemo(() => summarizeChecklist(checklistF), [checklistF]);
  const protocolosComResp = useMemo(() => {
    const mapa = buildResponsavelMap(checklistF);
    return mapa.size ? applyResponsaveisFromChecklist(protocolosF, mapa) : protocolosF;
  }, [protocolosF, checklistF]);
  const protocolosSummary = useMemo(() => summarizeProtocolos(protocolosComResp), [protocolosComResp]);

  const totalClientesUnicos = useMemo(() => {
    const set = new Set<string>();
    sciF.forEach((r) => set.add(r.cnpj || r.razaoSocial));
    accF.forEach((r) => set.add(r.cnpj || r.empresa));
    return set.size;
  }, [sciF, accF]);

  const obrigacoes = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of accProcessado) m.set(r.obrigacao || "—", (m.get(r.obrigacao || "—") || 0) + 1);
    return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [accProcessado]);

  const obrigPorResponsavel = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of accProcessado) {
      const k = r.responsavelEntrega || r.responsavelPrazo || "—";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [accProcessado]);

  const gerar = async (modo: "download" | "blob" = "download"): Promise<Blob | null> => {
    return gerarPptx({
      sciF, accF, checklistF, protocolosF,
      accProcessado, protocolosComResp,
      clienteFiltro,
      opts,
      nomeCapa, dataCapa, hojeISO,
      totalClientesUnicos,
      sciSummary, accSummary, checklistSummary, protocolosSummary,
      obrigacoes, obrigPorResponsavel,
      textoLivre, tituloPersonalizado,
      slidesExtras,
      endivF, apuracaoF, spedF, pgdasF,
    }, modo);
  };

  const gerarPDF = async () => {
    await gerarPdf({
      sciF, accF, protocolosF,
      accProcessado, protocolosComResp,
      totalClientesUnicos,
      sciSummary, accSummary, protocolosSummary,
      obrigPorResponsavel,
      contadorNome: displayName(),
      contadorCrc: displayCrc(),
    });
  };

  const gerarExcel = async () => {
    await gerarXlsx({
      sciF, accF, protocolosF,
      accProcessado, protocolosComResp,
      sciSummary, protocolosSummary,
      obrigPorResponsavel,
    });
  };

  const previewDeck = async () => {
    setCarregandoPreview(true);
    try {
      const blob = await gerar("blob");
      if (!blob) return;
      const slides = await listPptxSlides(blob);
      setPreviewSlides(slides);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar prévia.");
    } finally {
      setCarregandoPreview(false);
    }
  };

  const renomearItem = (id: string, nome: string) =>
    setSlidesExtras((p) => p.map((x) => x.id === id ? { ...x, nome } as SlideExtraItem : x));

  const confirmarRemocao = () => {
    if (!removendoId) return;
    setSlidesExtras((p) => p.filter((x) => x.id !== removendoId));
    setRemovendoId(null);
  };

  const semDados = !sci.length && !acc.length && !checklist.length && !protocolos.length;

  return (
    <div className="space-y-6">
      <ActiveClientFilterChip />
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/integracoes")} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Integrações
        </Button>
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Consolidado</div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Apresentação Executiva</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unifica os dados importados do <strong>SCI</strong>, da <strong>Acessórias</strong> e do <strong>Check-list de empresas</strong> em um único deck institucional.
        </p>
      </div>

      <StatusCardsRow
        sci={sci} acc={acc} checklist={checklist} protocolos={protocolos}
        sciSummary={sciSummary} accSummary={accSummary}
        checklistSummary={checklistSummary} protocolosSummary={protocolosSummary}
        excluirAtrasadas={excluirAtrasadas}
        checklistRespMapSize={checklistRespMap.size}
        checklistRef={checklistRef}
        onChecklistFile={handleChecklist}
        setChecklist={setChecklist}
        onSaveChecklist={() => safeSaveJSON({ checklist_empresas: checklist }, "Check-list")}
        onImportChecklist={(rows) => {
          setChecklist(rows);
          try { localStorage.setItem("checklist_empresas", JSON.stringify(rows)); } catch { /* noop */ }
        }}
        onClearChecklist={() => { setChecklist([]); try { localStorage.removeItem("checklist_empresas"); } catch { /* noop */ } }}
      />

      <FiltroClienteCard
        clienteFiltro={clienteFiltro}
        setClienteFiltro={setClienteFiltro}
        clientesDisponiveis={clientesDisponiveis}
        counts={{
          sci: sciF.length, acc: accF.length, checklist: checklistF.length, protocolos: protocolosF.length,
          endiv: endivF.length, apuracao: apuracaoF.length, sped: spedF.length, pgdas: pgdasF.length,
        }}
      />

      <CapaCard nomeCapa={nomeCapa} setNomeCapa={setNomeCapa} dataCapa={dataCapa} setDataCapa={setDataCapa} />

      <MensagemCard
        tituloPersonalizado={tituloPersonalizado} setTituloPersonalizado={setTituloPersonalizado}
        textoLivre={textoLivre} setTextoLivre={setTextoLivre}
        melhorando={melhorando} onMelhorar={melhorarTexto}
      />

      <SlidesSelectorCard opts={opts} setOpts={setOpts} />

      <FiltrosExportacaoCard excluirAtrasadas={excluirAtrasadas} setExcluirAtrasadas={setExcluirAtrasadas} />

      <SlidesExtrasCard
        slidesExtras={slidesExtras} setSlidesExtras={setSlidesExtras}
        slidesExtrasRef={slidesExtrasRef}
        editandoId={editandoId} setEditandoId={setEditandoId}
        setRemovendoId={setRemovendoId}
        renomearItem={renomearItem}
      />

      <AcoesGeracaoBar
        semDados={semDados} carregandoPreview={carregandoPreview}
        onPdf={gerarPDF} onExcel={gerarExcel} onPreview={previewDeck}
        onPptx={() => gerar("download")}
      />

      <PreviewDeckDialog
        previewSlides={previewSlides} setPreviewSlides={setPreviewSlides}
        onBaixar={() => gerar("download")}
      />

      <RemoverItemDialog
        removendoId={removendoId} setRemovendoId={setRemovendoId}
        previewItem={previewItem} onConfirmar={confirmarRemocao}
      />
    </div>
  );
}
