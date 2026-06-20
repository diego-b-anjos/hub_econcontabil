import { toast } from "sonner";
import type PptxGenJSType from "pptxgenjs";
import econLogo from "@/assets/econ-logo.png";
import type { SciFatRow } from "@/lib/sci/parser";
import type { AcessoriasRow } from "@/lib/acessorias/parser";
import type { ChecklistRow } from "@/lib/integracoes/checklist-parser";
import type { ProtocoloRow } from "@/lib/sci/protocolos-parser";
import { mergePptx } from "@/lib/pptx-merge";
import type { SlideExtraItem } from "./types";
import { PPT_DARK, PPT_GOLD, PPT_GRAY, PPT_OK, PPT_BAD, fmtBRL, fetchAsBase64 } from "./shared";

type PptxGenJS = PptxGenJSType;

export type EndivSnap = {
  cadastro?: { razaoSocial?: string; cnpj?: string };
  totalConsolidado?: number;
  totalEmDia?: number;
  totalDevedor?: number;
  debitos?: any[];
  salvoEm?: string;
  nome?: string;
};
export type ApuracaoHist = { empresa: string; cnpj: string; trimestre: string; resultado: any; criadoEm: string };
export type SpedHist = { cnpj?: string; razaoSocial?: string; meses?: any[]; totais?: any; salvoEm?: string };
export type PgdasHist = {
  cnpj?: string;
  razaoSocial?: string;
  meses?: any[];
  totalDAS?: number;
  totalFaturamento?: number;
  salvoEm?: string;
};

export interface PptxExportParams {
  sciF: SciFatRow[];
  accF: AcessoriasRow[];
  checklistF: ChecklistRow[];
  protocolosF: ProtocoloRow[];
  accProcessado: AcessoriasRow[];
  protocolosComResp: ProtocoloRow[];
  clienteFiltro: string;
  opts: Record<string, boolean>;
  nomeCapa: string;
  dataCapa: string;
  hojeISO: string;
  totalClientesUnicos: number;
  sciSummary: any;
  accSummary: any;
  checklistSummary: any;
  protocolosSummary: any;
  obrigacoes: { nome: string; total: number }[];
  obrigPorResponsavel: { nome: string; total: number }[];
  textoLivre: string;
  tituloPersonalizado: string;
  slidesExtras: SlideExtraItem[];
  endivF: EndivSnap[];
  apuracaoF: ApuracaoHist[];
  spedF: SpedHist[];
  pgdasF: PgdasHist[];
}

export async function gerarPptx(
  params: PptxExportParams,
  modo: "download" | "blob" = "download",
): Promise<Blob | null> {
  const {
    sciF,
    accF,
    checklistF,
    protocolosF,
    accProcessado,
    protocolosComResp,
    clienteFiltro,
    opts,
    nomeCapa,
    dataCapa,
    hojeISO,
    totalClientesUnicos,
    sciSummary,
    accSummary,
    checklistSummary,
    protocolosSummary,
    obrigacoes,
    obrigPorResponsavel,
    textoLivre,
    tituloPersonalizado,
    slidesExtras,
    endivF,
    apuracaoF,
    spedF,
    pgdasF,
  } = params;

  // Aplica o filtro por cliente: shadow das variáveis de origem para que toda a
  // lógica de geração utilize a fatia correta (Geral ou cliente específico).
  const sci = sciF;
  const acc = accF;
  const checklist = checklistF;
  const protocolos = protocolosF;
  if (!sci.length && !acc.length && !protocolosComResp.length) {
    toast.error(
      clienteFiltro === "Geral"
        ? "Importe dados do SCI, Acessórias ou SCI Protocolos antes de gerar a apresentação."
        : `Nenhum dado encontrado para o cliente "${clienteFiltro}". Selecione outro cliente ou volte para Geral.`,
    );
    return null;
  }
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = "Apresentação Executiva — Econ";
  pptx.company = "Econ Escritório Contábil";
  const logo = await fetchAsBase64(econLogo);

  let n = 1;
  // total será ajustado abaixo conforme módulos ativos
  let total = Object.values(opts).filter(Boolean).length;
  const footer = (sl: PptxGenJS.Slide) => {
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 7.18, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText("Econ Escritório Contábil · Apresentação Executiva", { x: 0.4, y: 7.25, w: 9, h: 0.25, fontSize: 9, color: PPT_GRAY, fontFace: "Calibri" });
    sl.addText(`${n}/${total}`, { x: 12.4, y: 7.25, w: 0.6, h: 0.25, fontSize: 9, color: PPT_GRAY, align: "right", fontFace: "Calibri" });
    n++;
  };
  const titleBar = (sl: PptxGenJS.Slide, txt: string, sub?: string) => {
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText(txt, { x: 0.4, y: 0.12, w: 9, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });
    if (sub) sl.addText(sub, { x: 0.4, y: 0.42, w: 9, h: 0.3, fontSize: 11, color: "C9C9C9", fontFace: "Calibri" });
    if (logo) sl.addImage({ data: logo, x: 12.0, y: 0.1, w: 1.1, h: 0.55 });
  };

  // Conta capas de módulo no total exibido no rodapé
  const _sciAtivo = sci.length && (opts.sciVisao || opts.sciClientes || opts.sciPorMes || opts.sciPorPlano);
  const _accAtivo = accProcessado.length && (opts.accVisao || opts.accObrigacoes || opts.accResponsaveis || opts.accEmpresasCriticas);
  const _checkAtivo = opts.checklistResp && checklist.length;
  const _protAtivo = protocolosComResp.length && (opts.protocolosVisao || opts.protocolosCategorias || opts.protocolosResponsavel || opts.protocolosReferencia || opts.protocolosClientes);
  total += [_sciAtivo, _accAtivo, _checkAtivo, _protAtivo].filter(Boolean).length;

  if (opts.capa) {
    const sl = pptx.addSlide();
    sl.background = { color: PPT_DARK };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    if (logo) sl.addImage({ data: logo, x: 0.7, y: 0.5, w: 1.8, h: 0.9 });
    sl.addText("Apresentação Executiva", { x: 0.7, y: 2.2, w: 12, h: 1.1, fontSize: 50, bold: true, color: "FFFFFF", fontFace: "Calibri" });
    const subtituloCapa = nomeCapa.trim() || "Visão consolidada · SCI + Acessórias";
    sl.addText(subtituloCapa, { x: 0.7, y: 3.3, w: 12, h: 0.7, fontSize: 26, bold: true, color: PPT_GOLD, fontFace: "Calibri" });
    sl.addShape(pptx.ShapeType.rect, { x: 0.7, y: 4.05, w: 1.5, h: 0.06, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText(`Total de clientes (carteira unificada): ${totalClientesUnicos}`, { x: 0.7, y: 4.3, w: 12, h: 0.4, fontSize: 16, color: "FFFFFF", fontFace: "Calibri" });
    // Data customizada (ou hoje)
    const dRaw = (dataCapa || hojeISO);
    const m = dRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dObj = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date();
    const dataFmt = dObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
    sl.addText(dataFmt, { x: 0.7, y: 6.5, w: 12, h: 0.4, fontSize: 14, color: PPT_GOLD, fontFace: "Calibri" });
    footer(sl);
  }

  // Helper: capa de seção/módulo (antes de cada módulo)
  const moduleCover = (titulo: string, subtitulo: string) => {
    const sl = pptx.addSlide();
    sl.background = { color: PPT_DARK };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 3.2, w: 13.33, h: 0.06, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    if (logo) sl.addImage({ data: logo, x: 0.7, y: 0.5, w: 1.4, h: 0.7 });
    sl.addText(titulo.toUpperCase(), { x: 0.7, y: 3.4, w: 12, h: 1.0, fontSize: 44, bold: true, color: "FFFFFF", fontFace: "Calibri", charSpacing: 2 });
    sl.addText(subtitulo, { x: 0.7, y: 4.45, w: 12, h: 0.5, fontSize: 18, color: PPT_GOLD, fontFace: "Calibri" });
    sl.addText("MÓDULO", { x: 0.7, y: 2.7, w: 5, h: 0.4, fontSize: 11, bold: true, color: PPT_GOLD, fontFace: "Calibri", charSpacing: 6 });
    footer(sl);
  };

  // ===== SCI =====
  const sciAtivo = sci.length && (opts.sciVisao || opts.sciClientes || opts.sciPorMes || opts.sciPorPlano);
  if (sciAtivo) moduleCover("SCI · Faturamento", "Carteira de clientes e desempenho financeiro");
  if (opts.sciVisao && sci.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI · Visão geral", "Faturamento da carteira");
    const kpis = [
      { l: "Faturamento total", v: fmtBRL(sciSummary.totalGeral), c: PPT_DARK },
      { l: "Total de clientes", v: String(sciSummary.totalClientes), c: PPT_OK },
      { l: "Ticket médio", v: fmtBRL(sciSummary.ticketMedio), c: PPT_GOLD },
      { l: "Média mensal", v: fmtBRL(sciSummary.mediaPorMesAtivo), c: PPT_BAD },
    ];
    kpis.forEach((k, i) => {
      const x = 0.4 + i * 3.18;
      sl.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: 3.0, h: 1.6, fill: { color: "FFFFFF" }, line: { color: "E5E5E5", width: 1 }, rectRadius: 0.08 });
      sl.addShape(pptx.ShapeType.rect, { x, y: 1.1, w: 0.08, h: 1.6, fill: { color: k.c }, line: { color: k.c } });
      sl.addText(k.l.toUpperCase(), { x: x + 0.25, y: 1.25, w: 2.7, h: 0.3, fontSize: 9, bold: true, color: PPT_GRAY, charSpacing: 4, fontFace: "Calibri" });
      sl.addText(k.v, { x: x + 0.25, y: 1.6, w: 2.7, h: 1.0, fontSize: 20, bold: true, color: k.c, fontFace: "Calibri" });
    });
    sl.addChart(pptx.ChartType.bar, [{ name: "Faturamento", labels: sciSummary.porMes.map((m: any) => m.mes), values: sciSummary.porMes.map((m: any) => m.valor) }], {
      x: 0.4, y: 3.0, w: 12.5, h: 4.0, barDir: "col", showLegend: false, chartColors: [PPT_GOLD],
      showValue: false,
      catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
      valAxisLabelFormatCode: 'R$ #,##0',
    });
    footer(sl);
  }

  if (opts.sciPorMes && sci.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI · Faturamento mensal");
    sl.addChart(pptx.ChartType.bar, [{ name: "Faturamento", labels: sciSummary.porMes.map((m: any) => m.mes), values: sciSummary.porMes.map((m: any) => m.valor) }], {
      x: 0.4, y: 1.0, w: 12.5, h: 5.8, barDir: "col", chartColors: [PPT_GOLD], showLegend: false,
      showValue: false,
      catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
      valAxisLabelFormatCode: 'R$ #,##0',
    });
    footer(sl);
  }

  if (opts.sciPorPlano && sci.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI · Carteira por plano tributário");
    sl.addChart(pptx.ChartType.doughnut, [{
      name: "Plano", labels: sciSummary.porPlano.slice(0, 8).map((p: any) => p.plano),
      values: sciSummary.porPlano.slice(0, 8).map((p: any) => p.valor),
    }], {
      x: 0.4, y: 1.0, w: 12.5, h: 5.8,
      showLegend: true, legendPos: "r", legendFontSize: 11, legendFontFace: "Calibri",
      showPercent: true, showValue: false, dataLabelFormatCode: '0%',
      dataLabelFontSize: 11, dataLabelFontBold: true, dataLabelColor: "FFFFFF",
      dataLabelPosition: "ctr", holeSize: 55,
    });
    footer(sl);
  }

  if (opts.sciClientes && sci.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI · Top 10 clientes");
    const tableRows: any[][] = [[
      { text: "Cliente", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Plano", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Faturamento", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    sciSummary.topClientes.forEach((c: any, i: number) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: c.razao, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: c.plano, options: { fill: { color: fill }, color: PPT_DARK } },
        { text: fmtBRL(c.valor), options: { fill: { color: fill }, color: PPT_DARK, align: "right", bold: true } },
      ]);
    });
    sl.addTable(tableRows, { x: 0.4, y: 1.0, w: 12.5, fontSize: 11, fontFace: "Calibri", border: { type: "solid", pt: 0.5, color: "E5E5E5" }, rowH: 0.4, colW: [6.5, 3.5, 2.5] });
    footer(sl);
  }

  // ===== Acessórias =====
  const accAtivo = accProcessado.length && (opts.accVisao || opts.accObrigacoes || opts.accResponsaveis || opts.accEmpresasCriticas);
  if (accAtivo) moduleCover("Acessórias · Entregas", "Indicadores e gestão de obrigações acessórias");
  if (opts.accVisao && accProcessado.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "Acessórias · Indicadores", "Gestão de entregas");
    const kpis = [
      { l: "Total de tarefas", v: String(accSummary.total), c: PPT_DARK },
      { l: "Pontualidade", v: `${accSummary.taxaPontualidade.toFixed(1)}%`, c: PPT_OK },
      { l: "Taxa de atraso", v: `${accSummary.taxaAtraso.toFixed(1)}%`, c: PPT_BAD },
      { l: "Pendentes", v: String(accSummary.porStatus.pendente), c: PPT_GOLD },
    ];
    kpis.forEach((k, i) => {
      const x = 0.4 + i * 3.18;
      sl.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: 3.0, h: 1.6, fill: { color: "FFFFFF" }, line: { color: "E5E5E5", width: 1 }, rectRadius: 0.08 });
      sl.addShape(pptx.ShapeType.rect, { x, y: 1.1, w: 0.08, h: 1.6, fill: { color: k.c }, line: { color: k.c } });
      sl.addText(k.l.toUpperCase(), { x: x + 0.25, y: 1.25, w: 2.7, h: 0.3, fontSize: 9, bold: true, color: PPT_GRAY, charSpacing: 4, fontFace: "Calibri" });
      sl.addText(k.v, { x: x + 0.25, y: 1.6, w: 2.7, h: 1.0, fontSize: 26, bold: true, color: k.c, fontFace: "Calibri" });
    });
    sl.addChart(pptx.ChartType.bar, [
      { name: "Entregues", labels: accSummary.porCompetencia.map((c: any) => c.competencia), values: accSummary.porCompetencia.map((c: any) => c.entregues) },
      { name: "Atrasadas", labels: accSummary.porCompetencia.map((c: any) => c.competencia), values: accSummary.porCompetencia.map((c: any) => c.atrasadas) },
    ], {
      x: 0.4, y: 3.0, w: 12.5, h: 4.0, barDir: "col", showLegend: true, legendPos: "b",
      chartColors: [PPT_OK, PPT_BAD], showValue: false,
      catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    });
    footer(sl);
  }

  if (opts.accObrigacoes && accProcessado.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "Acessórias · Obrigações", `${obrigacoes.length} tipos · ${accSummary.total} ocorrências`);
    const top = obrigacoes.slice(0, 18);
    const tableRows: any[][] = [[
      { text: "Obrigação", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Total", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    top.forEach((o, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: o.nome, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(o.total), options: { fill: { color: fill }, color: PPT_DARK, align: "right", bold: true } },
      ]);
    });
    sl.addTable(tableRows, { x: 0.4, y: 1.0, w: 12.5, fontSize: 11, fontFace: "Calibri", border: { type: "solid", pt: 0.5, color: "E5E5E5" }, rowH: 0.32, colW: [10.0, 2.5] });
    footer(sl);
  }

  if (opts.accResponsaveis && accProcessado.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "Acessórias · Obrigações por responsável");
    sl.addChart(pptx.ChartType.bar, [{
      name: "Obrigações", labels: obrigPorResponsavel.slice(0, 12).map((r) => r.nome),
      values: obrigPorResponsavel.slice(0, 12).map((r) => r.total),
    }], {
      x: 0.4, y: 1.0, w: 12.5, h: 5.8, barDir: "bar", showLegend: false, chartColors: [PPT_GOLD],
      showValue: false, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
    });
    footer(sl);
  }

  // ===== Check-list de empresas (responsáveis por empresa) =====
  if (opts.checklistResp && checklist.length) {
    moduleCover("Check-list · Carteira", "Empresas e responsáveis por carteira");
  }
  if (opts.checklistResp && checklist.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "Check-list · Carteira por responsável", `${checklistSummary.total} empresas · ${checklistSummary.ativos} ativas`);
    const tableRows: any[][] = [[
      { text: "Responsável", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Total", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Ativas", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "% Carteira", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    checklistSummary.porResponsavel.forEach((r: any, i: number) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: r.responsavel, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(r.total), options: { fill: { color: fill }, color: PPT_DARK, align: "right" } },
        { text: String(r.ativos), options: { fill: { color: fill }, color: PPT_OK, align: "right", bold: true } },
        { text: `${((r.total / checklistSummary.total) * 100).toFixed(1)}%`, options: { fill: { color: fill }, color: PPT_GRAY, align: "right" } },
      ]);
    });
    sl.addTable(tableRows, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 11, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" }, colW: [6.5, 2.0, 2.0, 2.0],
      autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.0, newSlideStartY: 1.0,
    });
    footer(sl);
  }

  // ===== Slide texto livre =====
  if (opts.textoLivre && (textoLivre.trim() || tituloPersonalizado.trim())) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, tituloPersonalizado.trim() || "Mensagem da diretoria");
    // Faixa lateral dourada estilizada
    sl.addShape(pptx.ShapeType.rect, { x: 0.4, y: 1.1, w: 0.12, h: 5.8, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText(textoLivre.trim() || " ", {
      x: 0.8, y: 1.1, w: 12.1, h: 5.8,
      fontSize: 18, color: PPT_DARK, fontFace: "Calibri",
      valign: "top", paraSpaceAfter: 8, lineSpacingMultiple: 1.4,
    });
    footer(sl);
  }

  if (opts.accEmpresasCriticas && accProcessado.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "Acessórias · Empresas críticas");
    const empTop = [...accSummary.porEmpresa].sort((a: any, b: any) => b.atrasadas - a.atrasadas).slice(0, 14);
    const tableRows: any[][] = [[
      { text: "Empresa", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Total", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Atrasadas", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Pendentes", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
    ]];
    empTop.forEach((e: any, i: number) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: e.empresa, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(e.total), options: { fill: { color: fill }, color: PPT_DARK, align: "center" } },
        { text: String(e.atrasadas), options: { fill: { color: fill }, color: PPT_BAD, bold: true, align: "center" } },
        { text: String(e.pendentes), options: { fill: { color: fill }, color: PPT_DARK, align: "center" } },
      ]);
    });
    sl.addTable(tableRows, { x: 0.4, y: 1.0, w: 12.5, fontSize: 11, fontFace: "Calibri", border: { type: "solid", pt: 0.5, color: "E5E5E5" }, rowH: 0.4, colW: [7.5, 1.7, 1.7, 1.6] });
    footer(sl);
  }


  // ===== SCI Protocolos =====
  const protAtivo = protocolosComResp.length && (opts.protocolosVisao || opts.protocolosCategorias || opts.protocolosResponsavel || opts.protocolosReferencia || opts.protocolosClientes);
  if (protAtivo) moduleCover("SCI Protocolos", "Protocolos enviados e arquivos contábeis");
  if (opts.protocolosVisao && protocolosComResp.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI Protocolos · Visão geral", "Protocolos enviados / arquivos contábeis");
    const ps = protocolosSummary;
    const kpis = [
      { l: "Total de protocolos", v: String(ps.total), c: PPT_DARK },
      { l: "Clientes atendidos", v: String(ps.totalClientes), c: PPT_OK },
      { l: "Total de impostos", v: fmtBRL(ps.valorTotalImpostos), c: PPT_GOLD },
      { l: "Relatórios distintos", v: String(ps.porRelatorio.filter((p: any) => p.chave !== "—").length), c: PPT_BAD },
    ];
    kpis.forEach((k, i) => {
      const x = 0.4 + i * 3.18;
      sl.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: 3.0, h: 1.6, fill: { color: "FFFFFF" }, line: { color: "E5E5E5", width: 1 }, rectRadius: 0.08 });
      sl.addShape(pptx.ShapeType.rect, { x, y: 1.1, w: 0.08, h: 1.6, fill: { color: k.c }, line: { color: k.c } });
      sl.addText(k.l.toUpperCase(), { x: x + 0.25, y: 1.25, w: 2.7, h: 0.3, fontSize: 9, bold: true, color: PPT_GRAY, charSpacing: 4, fontFace: "Calibri" });
      sl.addText(k.v, { x: x + 0.25, y: 1.6, w: 2.7, h: 1.0, fontSize: 18, bold: true, color: k.c, fontFace: "Calibri" });
    });
    if (ps.porMes.length) {
      sl.addChart(pptx.ChartType.bar, [{ name: "Protocolos", labels: ps.porMes.map((m: any) => m.mes), values: ps.porMes.map((m: any) => m.quantidade) }], {
        x: 0.4, y: 3.0, w: 12.5, h: 4.0, barDir: "col", showLegend: false, chartColors: [PPT_GOLD],
        showValue: false, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
      });
    }
    footer(sl);
  }

  if (opts.protocolosCategorias && protocolosComResp.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI Protocolos · Categorias", "Declarações · Memórias de cálculo · Impostos");
    const ps = protocolosSummary;
    const tableRows: any[][] = [[
      { text: "Categoria", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Quantidade", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Valor", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    ps.porCategoria.forEach((c: any, i: number) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      const showValor = c.chave !== "Declaração";
      tableRows.push([
        { text: c.chave, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(c.quantidade), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: showValor ? fmtBRL(c.valor) : "—", options: { fill: { color: fill }, align: "right", color: PPT_DARK, bold: true } },
      ]);
    });
    sl.addTable(tableRows, { x: 0.4, y: 1.0, w: 12.5, fontSize: 13, fontFace: "Calibri", border: { type: "solid", pt: 0.5, color: "E5E5E5" }, rowH: 0.45, colW: [6.5, 3.0, 3.0] });
    footer(sl);
  }

  if (opts.protocolosResponsavel && protocolosComResp.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI Protocolos · Total de impostos publicados por responsável");
    const ps = protocolosSummary;
    const totalImp = ps.valorTotalImpostos || 0;
    const tableRows: any[][] = [[
      { text: "Responsável", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Protocolos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Qtd. Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Total Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "% Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    ps.porResponsavel.forEach((p: any, i: number) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: p.chave, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.quantidade), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: String(p.qtdImpostos), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: fmtBRL(p.valorImpostos), options: { fill: { color: fill }, align: "right", color: PPT_DARK, bold: true } },
        { text: `${totalImp ? ((p.valorImpostos / totalImp) * 100).toFixed(1) : "0.0"}%`, options: { fill: { color: fill }, align: "right", color: PPT_GRAY } },
      ]);
    });
    sl.addTable(tableRows, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 11, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" }, colW: [4.5, 1.7, 1.7, 2.6, 2.0],
      autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.0, newSlideStartY: 1.0,
    });
    footer(sl);
  }

  if (opts.protocolosReferencia && protocolosComResp.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI Protocolos · Total de impostos publicados por referência", "Competência / período");
    const ps = protocolosSummary;
    const totalImp = ps.valorTotalImpostos || 0;
    // Recalcular impostos por referência (somente categoria imposto)
    const refMap = new Map<string, { q: number; v: number }>();
    for (const r of protocolosComResp) {
      if (r.categoria !== "imposto") continue;
      const k = r.referencia || "—";
      const cur = refMap.get(k) || { q: 0, v: 0 };
      cur.q += 1; cur.v += r.valor || 0;
      refMap.set(k, cur);
    }
    const refRows = [...refMap.entries()]
      .map(([chave, x]) => ({ chave, q: x.q, v: x.v }))
      .sort((a, b) => b.v - a.v);
    const tableRows: any[][] = [[
      { text: "Referência", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Qtd. Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Total Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "% Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    refRows.forEach((p, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: p.chave, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.q), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: fmtBRL(p.v), options: { fill: { color: fill }, align: "right", color: PPT_DARK, bold: true } },
        { text: `${totalImp ? ((p.v / totalImp) * 100).toFixed(1) : "0.0"}%`, options: { fill: { color: fill }, align: "right", color: PPT_GRAY } },
      ]);
    });
    sl.addTable(tableRows, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 12, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" }, colW: [5.5, 2.3, 2.7, 2.0],
      autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.0, newSlideStartY: 1.0,
    });
    footer(sl);
  }


  if (opts.protocolosClientes && protocolosComResp.length) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "SCI Protocolos · Top clientes", "Volume e total de impostos por cliente");
    const ps = protocolosSummary;
    const tableRows: any[][] = [[
      { text: "Cliente", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Protocolos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Qtd. Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Total Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    ps.porCliente.slice(0, 15).forEach((p: any, i: number) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: p.chave, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.quantidade), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: String(p.qtdImpostos), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: fmtBRL(p.valorImpostos), options: { fill: { color: fill }, align: "right", color: PPT_DARK, bold: true } },
      ]);
    });
    sl.addTable(tableRows, { x: 0.4, y: 1.0, w: 12.5, fontSize: 10, fontFace: "Calibri", border: { type: "solid", pt: 0.5, color: "E5E5E5" }, colW: [6.0, 1.8, 2.0, 2.7] });
    footer(sl);
  }

  // ===== Módulos extras (Endividamento + Apuração Trim + SPED + PGDAS-D) =====
  // Renderiza apenas quando há um cliente filtrado E há ao menos um histórico desses módulos.
  const temExtras = clienteFiltro !== "Geral" && (endivF.length || apuracaoF.length || spedF.length || pgdasF.length);
  if (temExtras) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, `Resumo do cliente · ${clienteFiltro}`, "Endividamento · Apuração Trimestral · SPED · PGDAS-D");
    const linhas: any[][] = [[
      { text: "Módulo", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Indicador", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Valor", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    const addRow = (mod: string, ind: string, val: string) => {
      const fill = linhas.length % 2 === 0 ? "FFFFFF" : "F7F7F7";
      linhas.push([
        { text: mod, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: ind, options: { fill: { color: fill }, color: PPT_DARK } },
        { text: val, options: { fill: { color: fill }, color: PPT_DARK, align: "right", bold: true } },
      ]);
    };
    // Endividamento — pega snapshot mais recente
    if (endivF.length) {
      const ult = [...endivF].sort((a, b) => (b.salvoEm || "").localeCompare(a.salvoEm || ""))[0];
      const totalDeb = (ult.debitos || []).reduce((s: number, d: any) => s + (d.valorAtualizado || d.valor || 0), 0);
      addRow("Endividamento", "Snapshots no histórico", String(endivF.length));
      addRow("Endividamento", `Última versão (${(ult.salvoEm || "").slice(0, 10)})`, ult.nome || "—");
      addRow("Endividamento", "Total de débitos consolidado", fmtBRL(totalDeb));
    }
    // Apuração Trimestral — pega o(s) trimestre(s) mais recente(s)
    if (apuracaoF.length) {
      const recente = [...apuracaoF].sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""))[0];
      const r = recente.resultado || {};
      addRow("Apuração Trim.", "Trimestres apurados", apuracaoF.map((a) => a.trimestre).join(", "));
      addRow("Apuração Trim.", `Último (${recente.trimestre})`, "");
      if (typeof r.irpjDevido === "number") addRow("Apuração Trim.", "IRPJ devido", fmtBRL(r.irpjDevido));
      if (typeof r.csllDevida === "number") addRow("Apuração Trim.", "CSLL devida", fmtBRL(r.csllDevida));
      if (typeof r.totalDevido === "number") addRow("Apuração Trim.", "Total devido", fmtBRL(r.totalDevido));
    }
    // SPED histórico
    if (spedF.length) {
      const ult = [...spedF].sort((a, b) => (b.salvoEm || "").localeCompare(a.salvoEm || ""))[0];
      const totFat = (ult.totais?.faturamento) || 0;
      addRow("SPED", "Históricos salvos", String(spedF.length));
      addRow("SPED", `Último (${(ult.salvoEm || "").slice(0, 10)})`, `${ult.meses?.length || 0} mês(es)`);
      addRow("SPED", "Faturamento (último)", fmtBRL(totFat));
    }
    // PGDAS-D histórico
    if (pgdasF.length) {
      const ult = [...pgdasF].sort((a, b) => (b.salvoEm || "").localeCompare(a.salvoEm || ""))[0];
      addRow("PGDAS-D", "Extratos salvos", String(pgdasF.length));
      addRow("PGDAS-D", `Último (${(ult.salvoEm || "").slice(0, 10)})`, `${ult.meses?.length || 0} período(s)`);
      addRow("PGDAS-D", "DAS total (último)", fmtBRL(ult.totalDAS || 0));
      addRow("PGDAS-D", "Faturamento RPA (último)", fmtBRL(ult.totalFaturamento || 0));
    }
    sl.addTable(linhas, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 12, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" }, colW: [3.0, 5.5, 4.0],
      autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.0, newSlideStartY: 1.0,
    });
    footer(sl);
  }

  if (opts.encerramento) {
    const sl = pptx.addSlide();
    sl.background = { color: PPT_DARK };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    if (logo) sl.addImage({ data: logo, x: 0.7, y: 0.5, w: 1.6, h: 0.8 });
    sl.addText("Obrigado.", { x: 0.7, y: 3.0, w: 12, h: 1.4, fontSize: 70, bold: true, color: "FFFFFF", fontFace: "Calibri" });
    sl.addText("Econ Escritório Contábil — Inteligência tributária e gestão.", { x: 0.7, y: 4.4, w: 12, h: 0.5, fontSize: 18, color: PPT_GOLD, fontFace: "Calibri" });
    footer(sl);
  }

  // Função interna que finaliza retornando blob (mesclado se houver extras)
  const finalize = async (): Promise<Blob> => {
    const buildSourceFromCustom = async (it: Extract<SlideExtraItem, { kind: "custom" }>): Promise<ArrayBuffer> => {
      const PptxGenJSCtor = (await import("pptxgenjs")).default;
      const p = new PptxGenJSCtor();
      p.layout = "LAYOUT_WIDE";
      const sl = p.addSlide();
      const fundo = it.corFundo === "claro" ? "FFFFFF" : it.corFundo === "dourado" ? PPT_GOLD : PPT_DARK;
      const fg = it.corFundo === "claro" ? PPT_DARK : it.corFundo === "dourado" ? PPT_DARK : "FFFFFF";
      const accent = it.corFundo === "dourado" ? PPT_DARK : PPT_GOLD;
      sl.background = { color: fundo };
      sl.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: accent }, line: { color: accent } });
      if (logo && it.layout === "capa") sl.addImage({ data: logo, x: 0.7, y: 0.5, w: 1.6, h: 0.8 });
      if (it.layout === "capa") {
        sl.addText(it.titulo || "Apresentação", { x: 0.7, y: 2.6, w: 12, h: 1.4, fontSize: 50, bold: true, color: fg, fontFace: "Calibri" });
        if (it.subtitulo) sl.addText(it.subtitulo, { x: 0.7, y: 3.9, w: 12, h: 0.6, fontSize: 22, color: accent, fontFace: "Calibri" });
        if (it.corpo) sl.addText(it.corpo, { x: 0.7, y: 4.7, w: 12, h: 1.5, fontSize: 14, color: fg, fontFace: "Calibri" });
      } else if (it.layout === "encerramento") {
        sl.addText(it.titulo || "Obrigado.", { x: 0.7, y: 3.0, w: 12, h: 1.4, fontSize: 70, bold: true, color: fg, fontFace: "Calibri" });
        if (it.subtitulo) sl.addText(it.subtitulo, { x: 0.7, y: 4.4, w: 12, h: 0.5, fontSize: 18, color: accent, fontFace: "Calibri" });
        if (it.corpo) sl.addText(it.corpo, { x: 0.7, y: 5.0, w: 12, h: 1.5, fontSize: 14, color: fg, fontFace: "Calibri" });
      } else {
        sl.addShape(p.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
        sl.addShape(p.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
        sl.addText(it.titulo || "Slide personalizado", { x: 0.4, y: 0.12, w: 12.5, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });
        if (it.subtitulo) sl.addText(it.subtitulo, { x: 0.4, y: 0.42, w: 12.5, h: 0.3, fontSize: 11, color: "C9C9C9", fontFace: "Calibri" });
        sl.addText(it.corpo || "", { x: 0.6, y: 1.2, w: 12.1, h: 5.6, fontSize: 16, color: PPT_DARK, fontFace: "Calibri", valign: "top" });
      }
      return (await p.write({ outputType: "arraybuffer" })) as ArrayBuffer;
    };

    const temSystem = slidesExtras.some((x) => x.kind === "system");

    if (!slidesExtras.length) {
      return (await pptx.write({ outputType: "blob" })) as Blob;
    }

    // Se nenhum item "system" foi declarado, o relatório do sistema é a base
    // e os extras são inseridos no início/fim conforme posição.
    if (!temSystem) {
      const baseBlob = (await pptx.write({ outputType: "blob" })) as Blob;
      const mergeItems: import("@/lib/pptx-merge").MergeItem[] = [];
      for (const it of slidesExtras) {
        if (it.kind === "system") continue;
        const source = it.kind === "file" ? await it.file.arrayBuffer() : await buildSourceFromCustom(it);
        mergeItems.push({ source, position: it.position });
      }
      return mergePptx(baseBlob, mergeItems);
    }

    // Há item "system": o sistema vira mais um item posicionável.
    // Construímos uma base vazia (1 slide placeholder que é removido depois não é trivial),
    // então usamos a primeira posição como base e mesclamos os demais por ordem da lista.
    const sistemaBuffer = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
    const itemBuffers: { source: ArrayBuffer; position: "start" | "end" }[] = [];
    for (const it of slidesExtras) {
      if (it.kind === "system") {
        itemBuffers.push({ source: sistemaBuffer, position: it.position });
      } else if (it.kind === "file") {
        itemBuffers.push({ source: await it.file.arrayBuffer(), position: it.position });
      } else {
        itemBuffers.push({ source: await buildSourceFromCustom(it), position: it.position });
      }
    }
    // Usa o primeiro item como base e mescla os demais
    const [primeiro, ...resto] = itemBuffers;
    const baseBlob = new Blob([primeiro.source], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    const mergeItems: import("@/lib/pptx-merge").MergeItem[] = resto.map((r) => ({ source: r.source, position: r.position }));
    return mergePptx(baseBlob, mergeItems);
  };

  try {
    const blob = await finalize();
    if (modo === "blob") return blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `apresentacao-executiva-${Date.now()}.pptx`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(slidesExtras.length ? `Apresentação gerada (com ${slidesExtras.length} slide(s) adicional(is))` : "Apresentação gerada");
    return blob;
  } catch (e) {
    console.error(e);
    toast.error("Falha ao gerar a apresentação.");
    return null;
  }
}
