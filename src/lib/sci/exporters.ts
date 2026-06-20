import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import {
  TBRAND, drawTrimHeader, drawAllTrimFooters, trimSectionTitle, loadImageDataURLTrim,
} from "@/lib/exporters";
import econLogo from "@/assets/econ-logo.png";
import type { SciFatRow, SciSummary } from "./parser";
import { MES_LABELS } from "./parser";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface SciExportOptions {
  empresa?: string;
  cnpj?: string;
  periodoLabel: string;
  meses?: number[]; // índices de meses a incluir (0..11). undefined = todos
  sections?: {
    indicadores?: boolean;
    porMes?: boolean;
    porPlano?: boolean;
    porAtividade?: boolean;
    porAnexo?: boolean;
    topClientes?: boolean;
    bottomClientes?: boolean;
    detalhado?: boolean;
  };
  slides?: {
    capa?: boolean;
    kpis?: boolean;
    porMes?: boolean;
    porPlano?: boolean;
    topClientes?: boolean;
  };
}

const DEFAULT_SECTIONS = {
  indicadores: true, porMes: true, porPlano: true, porAtividade: true,
  porAnexo: true, topClientes: true, bottomClientes: false, detalhado: false,
};
const DEFAULT_SLIDES = {
  capa: true, kpis: true, porMes: true, porPlano: true, topClientes: true,
};

// ===================== PDF =====================
export async function exportSciPDF(rows: SciFatRow[], summary: SciSummary, opts: SciExportOptions) {
  const sections = { ...DEFAULT_SECTIONS, ...(opts.sections || {}) };
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 10;
  const logo = await loadImageDataURLTrim(econLogo);

  // Relatório geral da carteira: não exibe nome de empresa específica no cabeçalho
  const empresa = opts.empresa || "";
  const cnpj = opts.cnpj || "";
  const titulo = "Faturamento — SCI";
  const subtitulo = "Relatório consolidado de faturamento da carteira";

  // Quando não há empresa, header fica mais compacto (sem card EMPRESA/CNPJ)
  const headerH = empresa ? 48 : 30;
  drawTrimHeader(doc, logo, opts.periodoLabel, empresa, cnpj, titulo, subtitulo);
  let y = headerH;

  const newPage = () => {
    doc.addPage();
    drawTrimHeader(doc, logo, opts.periodoLabel, empresa, cnpj, titulo, subtitulo);
    return headerH;
  };

  if (sections.indicadores) {
    trimSectionTitle(doc, y, "Indicadores principais", `${summary.totalClientes} clientes na base`);
    y += 14;
    const kpis: { label: string; value: string; tone: [number, number, number] }[] = [
      { label: "FATURAMENTO TOTAL", value: fmt(summary.totalGeral), tone: TBRAND.dark },
      { label: "TOTAL DE CLIENTES", value: String(summary.totalClientes), tone: [22, 163, 74] },
      { label: "MÉDIA POR CLIENTE", value: fmt(summary.ticketMedio), tone: [124, 58, 237] },
      { label: "MÉDIA MENSAL", value: fmt(summary.mediaPorMesAtivo), tone: [220, 38, 38] },
    ];
    const cardW = (pageW - MARGIN * 2 - 12) / 4;
    kpis.forEach((k, i) => {
      const x = MARGIN + i * (cardW + 4);
      doc.setFillColor(...TBRAND.graySoft);
      doc.roundedRect(x, y, cardW, 22, 1.6, 1.6, "F");
      doc.setFillColor(...k.tone);
      doc.rect(x, y, 1.4, 22, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...TBRAND.gray);
      doc.text(k.label, x + 4, y + 6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...k.tone);
      doc.text(k.value, x + 4, y + 16);
    });
    y += 30;
  }

  if (sections.porMes) {
    if (y > pageH - 80) y = newPage();
    trimSectionTitle(doc, y, "Faturamento por mês");
    y += 12;
    const mesesShow = opts.meses && opts.meses.length ? opts.meses : summary.porMes.map((_, i) => i);
    const body = mesesShow.map((i) => {
      const m = summary.porMes[i];
      return [m.mes, fmt(m.valor), summary.totalGeral > 0 ? `${((m.valor / summary.totalGeral) * 100).toFixed(1)}%` : "—"];
    });
    autoTable(doc, {
      startY: y,
      head: [["Mês", "Faturamento", "% do total"]],
      body,
      foot: [["TOTAL", fmt(mesesShow.reduce((a, i) => a + summary.porMes[i].valor, 0)), "100,0%"]],
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, lineColor: TBRAND.grayLine, lineWidth: 0.15 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      footStyles: { fillColor: TBRAND.gold, textColor: TBRAND.dark, fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" }, 2: { halign: "right" } },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (sections.porPlano && summary.porPlano.length) {
    if (y > pageH - 80) y = newPage();
    trimSectionTitle(doc, y, "Faturamento por plano tributário");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Plano tributário", "Clientes", "Faturamento", "% total"]],
      body: summary.porPlano.map((p) => [
        p.plano, p.clientes, fmt(p.valor),
        summary.totalGeral > 0 ? `${((p.valor / summary.totalGeral) * 100).toFixed(1)}%` : "—",
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (sections.porAtividade && summary.porAtividade.length) {
    if (y > pageH - 80) y = newPage();
    trimSectionTitle(doc, y, "Faturamento por atividade");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Atividade", "Clientes", "Faturamento"]],
      body: summary.porAtividade.map((p) => [p.atividade, p.clientes, fmt(p.valor)]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (sections.porAnexo && summary.porAnexo.length) {
    if (y > pageH - 80) y = newPage();
    trimSectionTitle(doc, y, "Faturamento por anexo (Simples Nacional)");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Anexo", "Clientes", "Faturamento"]],
      body: summary.porAnexo.map((p) => [p.anexo, p.clientes, fmt(p.valor)]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (sections.topClientes && summary.topClientes.length) {
    if (y > pageH - 80) y = newPage();
    trimSectionTitle(doc, y, "Top 10 clientes por faturamento");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Cliente", "CNPJ", "Plano", "Faturamento"]],
      body: summary.topClientes.map((c) => [c.razao, c.cnpj, c.plano, fmt(c.valor)]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 3: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (sections.bottomClientes && summary.bottomClientes.length) {
    if (y > pageH - 80) y = newPage();
    trimSectionTitle(doc, y, "Clientes com menor faturamento");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Cliente", "CNPJ", "Plano", "Faturamento"]],
      body: summary.bottomClientes.map((c) => [c.razao, c.cnpj, c.plano, fmt(c.valor)]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 3: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (sections.detalhado && rows.length) {
    y = newPage();
    trimSectionTitle(doc, y, "Detalhamento por cliente");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Cliente", "CNPJ", "Plano", "Faturamento total"]],
      body: rows.map((r) => [r.razaoSocial, r.cnpj, r.planoTributario, fmt(r.total)]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.5, lineColor: TBRAND.grayLine, lineWidth: 0.08 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  drawAllTrimFooters(doc);
  doc.save(`faturamento-sci-${Date.now()}.pdf`);
}

// ===================== Excel =====================
export function exportSciExcel(rows: SciFatRow[], summary: SciSummary, opts: SciExportOptions) {
  const sections = { ...DEFAULT_SECTIONS, ...(opts.sections || {}) };
  const wb = XLSX.utils.book_new();

  if (sections.indicadores) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Indicador", "Valor"],
      ["Período", opts.periodoLabel],
      ["Faturamento total", summary.totalGeral],
      ["Total de clientes", summary.totalClientes],
      ["Ticket médio", summary.ticketMedio],
      ["Média por mês ativo", summary.mediaPorMesAtivo],
      ["Meses ativos", summary.mesesAtivos],
    ]), "Resumo");
  }

  if (sections.porMes) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      summary.porMes.map((m) => ({ Mês: m.mes, Faturamento: m.valor })),
    ), "Por Mês");
  }
  if (sections.porPlano) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      summary.porPlano.map((p) => ({ Plano: p.plano, Clientes: p.clientes, Faturamento: p.valor })),
    ), "Por Plano");
  }
  if (sections.porAtividade) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      summary.porAtividade.map((p) => ({ Atividade: p.atividade, Clientes: p.clientes, Faturamento: p.valor })),
    ), "Por Atividade");
  }
  if (sections.porAnexo) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      summary.porAnexo.map((p) => ({ Anexo: p.anexo, Clientes: p.clientes, Faturamento: p.valor })),
    ), "Por Anexo");
  }
  if (sections.detalhado || sections.topClientes) {
    const detail = rows.map((r) => {
      const obj: Record<string, any> = {
        "Razão Social": r.razaoSocial, CNPJ: r.cnpj, Plano: r.planoTributario,
        Atividade: r.atividade, Anexo: r.anexo,
      };
      MES_LABELS.forEach((m, i) => { obj[m] = r.meses[i]; });
      obj.TOTAL = r.total;
      return obj;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), "Detalhado");
  }

  XLSX.writeFile(wb, `faturamento-sci-${Date.now()}.xlsx`);
}

// ===================== PPTX =====================
const PPT_DARK = "1E1A16";
const PPT_GOLD = "F7B831";
const PPT_GRAY = "6E6E6E";
const PPT_OK = "16A34A";
const PPT_BAD = "DC2626";

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function exportSciPPTX(rows: SciFatRow[], summary: SciSummary, opts: SciExportOptions) {
  const slides = { ...DEFAULT_SLIDES, ...(opts.slides || {}) };
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = "Faturamento — SCI";
  pptx.company = "Econ Escritório Contábil";
  const logoData = await fetchAsBase64(econLogo);

  const drawFooter = (sl: PptxGenJS.Slide, num: string) => {
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 7.18, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText("Econ Escritório Contábil · Faturamento — SCI", { x: 0.4, y: 7.25, w: 9, h: 0.25, fontSize: 9, color: PPT_GRAY, fontFace: "Calibri" });
    sl.addText(num, { x: 12.4, y: 7.25, w: 0.6, h: 0.25, fontSize: 9, color: PPT_GRAY, align: "right", fontFace: "Calibri" });
  };
  const titleBar = (sl: PptxGenJS.Slide, txt: string) => {
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText(txt, { x: 0.4, y: 0.12, w: 9, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });
    if (logoData) sl.addImage({ data: logoData, x: 12.0, y: 0.1, w: 1.1, h: 0.55 });
  };

  const slidePorAtividade = !!(slides.porPlano && summary.porAtividade.length);
  const slidePorAnexo = !!(slides.porPlano && summary.porAnexo.length);
  const total = (slides.capa ? 1 : 0) + (slides.kpis ? 1 : 0) + (slides.porMes ? 1 : 0)
    + (slides.porPlano ? 1 : 0) + (slidePorAtividade ? 1 : 0) + (slidePorAnexo ? 1 : 0)
    + (slides.topClientes ? 1 : 0);
  let n = 1;

  if (slides.capa) {
    const sl = pptx.addSlide();
    sl.background = { color: PPT_DARK };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    if (logoData) sl.addImage({ data: logoData, x: 0.7, y: 0.5, w: 1.6, h: 0.8 });
    sl.addText("ECON · Escritório Contábil", { x: 0.7, y: 1.5, w: 12, h: 0.4, fontSize: 14, color: "C9C9C9", fontFace: "Calibri" });
    sl.addText("Faturamento — SCI", { x: 0.7, y: 2.6, w: 12, h: 1.1, fontSize: 54, bold: true, color: "FFFFFF", fontFace: "Calibri" });
    sl.addText("Relatório consolidado da carteira", { x: 0.7, y: 3.7, w: 12, h: 0.5, fontSize: 22, color: PPT_GOLD, fontFace: "Calibri" });
    sl.addShape(pptx.ShapeType.rect, { x: 0.7, y: 4.25, w: 1.5, h: 0.06, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText(`Período: ${opts.periodoLabel}`, { x: 0.7, y: 4.5, w: 12, h: 0.4, fontSize: 16, color: "FFFFFF", fontFace: "Calibri" });
    sl.addText(`Total de clientes: ${summary.totalClientes} · Faturamento total: ${fmt(summary.totalGeral)}`, { x: 0.7, y: 4.95, w: 12, h: 0.4, fontSize: 14, color: "C9C9C9", fontFace: "Calibri" });
    sl.addText(new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }), { x: 0.7, y: 6.5, w: 12, h: 0.4, fontSize: 12, color: PPT_GOLD, fontFace: "Calibri" });
    drawFooter(sl, `${n++}/${total}`);
  }

  if (slides.kpis) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Indicadores principais");
    const kpis = [
      { l: "Faturamento total", v: fmt(summary.totalGeral), c: PPT_DARK },
      { l: "Total de clientes", v: String(summary.totalClientes), c: PPT_OK },
      { l: "Média por cliente", v: fmt(summary.ticketMedio), c: PPT_GOLD },
      { l: "Média por mês ativo", v: fmt(summary.mediaPorMesAtivo), c: PPT_BAD },
    ];
    kpis.forEach((k, i) => {
      const x = 0.4 + i * 3.18;
      sl.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: 3.0, h: 1.6, fill: { color: "FFFFFF" }, line: { color: "E5E5E5", width: 1 }, rectRadius: 0.08 });
      sl.addShape(pptx.ShapeType.rect, { x, y: 1.1, w: 0.08, h: 1.6, fill: { color: k.c }, line: { color: k.c } });
      sl.addText(k.l.toUpperCase(), { x: x + 0.25, y: 1.25, w: 2.7, h: 0.3, fontSize: 9, bold: true, color: PPT_GRAY, charSpacing: 4, fontFace: "Calibri" });
      sl.addText(k.v, { x: x + 0.25, y: 1.6, w: 2.7, h: 1.0, fontSize: 22, bold: true, color: k.c, fontFace: "Calibri" });
    });
    sl.addText("Faturamento por mês", { x: 0.4, y: 3.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: PPT_DARK, fontFace: "Calibri" });
    sl.addChart(pptx.ChartType.bar, [{ name: "Faturamento", labels: summary.porMes.map((m) => m.mes), values: summary.porMes.map((m) => m.valor) }], {
      x: 0.4, y: 3.45, w: 6.0, h: 3.5, barDir: "col", showLegend: false, chartColors: [PPT_GOLD],
      showValue: true, dataLabelFormatCode: 'R$ #,##0.00', dataLabelFontSize: 8,
      valAxisLabelFormatCode: 'R$ #,##0',
    });
    sl.addText("Faturamento por plano tributário", { x: 6.8, y: 3.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: PPT_DARK, fontFace: "Calibri" });
    sl.addChart(pptx.ChartType.doughnut, [{
      name: "Plano", labels: summary.porPlano.slice(0, 6).map((p) => p.plano),
      values: summary.porPlano.slice(0, 6).map((p) => p.valor),
    }], { x: 6.8, y: 3.45, w: 6.1, h: 3.5, showLegend: true, legendPos: "r", showPercent: true, dataLabelFormatCode: '0.0%' });
    drawFooter(sl, `${n++}/${total}`);
  }

  if (slides.porMes) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Evolução mensal do faturamento");
    sl.addChart(pptx.ChartType.bar, [{ name: "Faturamento", labels: summary.porMes.map((m) => m.mes), values: summary.porMes.map((m) => m.valor) }], {
      x: 0.4, y: 1.0, w: 12.5, h: 5.8, barDir: "col", showLegend: false, chartColors: [PPT_GOLD],
      catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
      showValue: true, dataLabelFormatCode: 'R$ #,##0.00', dataLabelFontSize: 9,
      valAxisLabelFormatCode: 'R$ #,##0',
    });
    drawFooter(sl, `${n++}/${total}`);
  }

  if (slides.porPlano) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Carteira por plano tributário");
    const tableRows: any[][] = [[
      { text: "Plano tributário", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Clientes", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Faturamento", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "% Total", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    summary.porPlano.forEach((p, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: p.plano, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.clientes), options: { fill: { color: fill }, align: "center", color: PPT_DARK } },
        { text: fmt(p.valor), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: summary.totalGeral > 0 ? `${((p.valor / summary.totalGeral) * 100).toFixed(1)}%` : "—", options: { fill: { color: fill }, align: "right", color: PPT_GRAY } },
      ]);
    });
    sl.addTable(tableRows, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 10, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" },
      colW: [6.5, 1.8, 2.6, 1.6],
      autoPage: true, autoPageRepeatHeader: true,
      autoPageSlideStartY: 1.0, autoPageHeaderRows: 1,
      newSlideStartY: 1.0,
    });
    drawFooter(sl, `${n++}/${total}`);
  }

  if (slidePorAtividade) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Carteira por atividade");
    const tableRows: any[][] = [[
      { text: "Atividade", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Clientes", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Faturamento", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "% Total", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    summary.porAtividade.forEach((p, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: p.atividade || "—", options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.clientes), options: { fill: { color: fill }, align: "center", color: PPT_DARK } },
        { text: fmt(p.valor), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: summary.totalGeral > 0 ? `${((p.valor / summary.totalGeral) * 100).toFixed(1)}%` : "—", options: { fill: { color: fill }, align: "right", color: PPT_GRAY } },
      ]);
    });
    sl.addTable(tableRows, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 10, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" },
      colW: [6.5, 1.8, 2.6, 1.6],
      autoPage: true, autoPageRepeatHeader: true,
      autoPageSlideStartY: 1.0, autoPageHeaderRows: 1, newSlideStartY: 1.0,
    });
    drawFooter(sl, `${n++}/${total}`);
  }

  if (slidePorAnexo) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Carteira por anexo (Simples Nacional)");
    const tableRows: any[][] = [[
      { text: "Anexo", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Clientes", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Faturamento", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "% Total", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    summary.porAnexo.forEach((p, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: p.anexo || "—", options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.clientes), options: { fill: { color: fill }, align: "center", color: PPT_DARK } },
        { text: fmt(p.valor), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: summary.totalGeral > 0 ? `${((p.valor / summary.totalGeral) * 100).toFixed(1)}%` : "—", options: { fill: { color: fill }, align: "right", color: PPT_GRAY } },
      ]);
    });
    sl.addTable(tableRows, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 10, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" },
      colW: [6.5, 1.8, 2.6, 1.6],
      autoPage: true, autoPageRepeatHeader: true,
      autoPageSlideStartY: 1.0, autoPageHeaderRows: 1, newSlideStartY: 1.0,
    });
    drawFooter(sl, `${n++}/${total}`);
  }

  if (slides.topClientes) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Top 10 clientes por faturamento");
    const tableRows: any[][] = [[
      { text: "Cliente", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "CNPJ", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Plano", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Faturamento", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    summary.topClientes.forEach((c, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: c.razao, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: c.cnpj, options: { fill: { color: fill }, align: "center", color: PPT_GRAY } },
        { text: c.plano, options: { fill: { color: fill }, color: PPT_DARK } },
        { text: fmt(c.valor), options: { fill: { color: fill }, align: "right", color: PPT_DARK, bold: true } },
      ]);
    });
    sl.addTable(tableRows, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 10, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" },
      colW: [5.6, 2.4, 2.5, 2.0],
      autoPage: true, autoPageRepeatHeader: true,
      autoPageSlideStartY: 1.0, autoPageHeaderRows: 1, newSlideStartY: 1.0,
    });
    drawFooter(sl, `${n++}/${total}`);
  }

  await pptx.writeFile({ fileName: `faturamento-sci-${Date.now()}.pptx` });
}
