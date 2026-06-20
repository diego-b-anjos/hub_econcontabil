import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import {
  TBRAND, drawTrimHeader, drawAllTrimFooters, trimSectionTitle, loadImageDataURLTrim,
} from "@/lib/exporters";
import econLogo from "@/assets/econ-logo.png";
import type { ProtocoloRow, ProtocolosSummary } from "./protocolos-parser";

export interface ProtocolosExportOptions {
  periodoLabel: string;
}

const PPT_DARK = "1E1A16";
const PPT_GOLD = "F7B831";
const PPT_GRAY = "6E6E6E";

// ========== PDF ==========
export async function exportProtocolosPDF(rows: ProtocoloRow[], summary: ProtocolosSummary, opts: ProtocolosExportOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 10;
  const logo = await loadImageDataURLTrim(econLogo);
  const titulo = "Protocolos — SCI";
  const subtitulo = "Relatório consolidado de protocolos da carteira";
  drawTrimHeader(doc, logo, opts.periodoLabel, "", "", titulo, subtitulo);
  let y = 30;

  trimSectionTitle(doc, y, "Indicadores principais", `${summary.totalClientes} clientes`);
  y += 14;
  const kpis = [
    { l: "TOTAL DE PROTOCOLOS", v: String(summary.total), c: TBRAND.dark },
    { l: "CLIENTES", v: String(summary.totalClientes), c: [22, 163, 74] as [number, number, number] },
    { l: "RELATÓRIOS", v: String(summary.porRelatorio.filter((p) => p.chave !== "—").length), c: [14, 165, 233] as [number, number, number] },
    { l: "VALOR TOTAL", v: summary.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), c: TBRAND.gold },
  ];
  const cardW = (doc.internal.pageSize.getWidth() - MARGIN * 2 - 12) / 4;
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (cardW + 4);
    doc.setFillColor(...TBRAND.graySoft);
    doc.roundedRect(x, y, cardW, 22, 1.6, 1.6, "F");
    doc.setFillColor(...k.c);
    doc.rect(x, y, 1.4, 22, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...TBRAND.gray);
    doc.text(k.l, x + 4, y + 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(k.l === "VALOR TOTAL" ? 10 : 16); doc.setTextColor(...k.c);
    doc.text(k.v, x + 4, y + 16);
  });
  y += 30;

  const renderTable = (title: string, head: string[], body: any[][]) => {
    if (y > pageH - 60) {
      doc.addPage();
      drawTrimHeader(doc, logo, opts.periodoLabel, "", "", titulo, subtitulo);
      y = 30;
    }
    trimSectionTitle(doc, y, title); y += 12;
    autoTable(doc, {
      startY: y, head: [head], body, theme: "striped",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  };

  if (summary.porTipo.length) renderTable("Por tipo de protocolo",
    ["Tipo", "Quantidade", "% do total"],
    summary.porTipo.map((p) => [p.chave, p.quantidade, `${((p.quantidade / summary.total) * 100).toFixed(1)}%`]));

  if (summary.porResponsavel.length) renderTable("Por responsável",
    ["Responsável", "Quantidade", "% do total"],
    summary.porResponsavel.map((p) => [p.chave, p.quantidade, `${((p.quantidade / summary.total) * 100).toFixed(1)}%`]));

  if (summary.porCliente.length) renderTable("Top 15 clientes",
    ["Cliente", "CNPJ", "Quantidade"],
    summary.porCliente.slice(0, 15).map((p) => [p.chave, p.cnpj, p.quantidade]));

  if (summary.porMes.length) renderTable("Distribuição mensal",
    ["Mês", "Quantidade"],
    summary.porMes.map((p) => [p.mes, p.quantidade]));

  if (summary.declaracoes.length) renderTable("Declarações",
    ["Relatório", "Quantidade", "Valor"],
    summary.declaracoes.map((p) => [p.relatorio, p.quantidade, p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]));

  if (summary.memoriasCalculo.length) renderTable("Memórias de cálculo",
    ["Relatório", "Quantidade", "Valor"],
    summary.memoriasCalculo.map((p) => [p.relatorio, p.quantidade, p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]));

  if (summary.impostos.length) renderTable("Impostos",
    ["Relatório", "Quantidade", "Valor"],
    summary.impostos.map((p) => [p.relatorio, p.quantidade, p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]));

  if (summary.porRelatorio.length) renderTable("Por relatório (todos)",
    ["Relatório", "Categoria", "Quantidade", "Valor"],
    summary.porRelatorio.map((p) => {
      const cat = (rows.find((r) => r.relatorio === p.chave)?.categoria) || "outros";
      const lbl = cat === "declaracao" ? "Declaração" : cat === "memoria" ? "Memória de cálculo" : cat === "imposto" ? "Imposto" : "Outros";
      return [p.chave, lbl, p.quantidade, p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })];
    }));

  if (summary.porReferencia.length) renderTable("Por referência",
    ["Referência", "Quantidade", "Valor"],
    summary.porReferencia.map((p) => [p.chave, p.quantidade, p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })]));

  drawAllTrimFooters(doc);
  doc.save(`protocolos-sci-${Date.now()}.pdf`);
}

// ========== Excel ==========
export function exportProtocolosExcel(rows: ProtocoloRow[], summary: ProtocolosSummary, opts: ProtocolosExportOptions) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Indicador", "Valor"],
    ["Período", opts.periodoLabel],
    ["Total de protocolos", summary.total],
    ["Total de clientes", summary.totalClientes],
    ["Relatórios", summary.porRelatorio.filter((p) => p.chave !== "—").length],
    ["Valor total (R$)", summary.valorTotal],
  ]), "Resumo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.porTipo.map((p) => ({ Tipo: p.chave, Quantidade: p.quantidade }))), "Por Tipo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.porResponsavel.map((p) => ({
      Responsável: p.chave, Protocolos: p.quantidade,
      "Qtd. Impostos": p.qtdImpostos, "Total Impostos": p.valorImpostos,
    }))), "Por Responsável");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.porCliente.map((p) => ({
      Cliente: p.chave, CNPJ: p.cnpj, Protocolos: p.quantidade,
      "Qtd. Impostos": p.qtdImpostos, "Total Impostos": p.valorImpostos,
    }))), "Por Cliente");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.porMes.map((p) => ({ Mês: p.mes, Quantidade: p.quantidade }))), "Por Mês");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.porRelatorio.map((p) => ({ Relatório: p.chave, Quantidade: p.quantidade, Valor: p.valor }))), "Por Relatório");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.porReferencia.map((p) => ({ Referência: p.chave, Quantidade: p.quantidade, Valor: p.valor }))), "Por Referência");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.declaracoes.map((p) => ({ Relatório: p.relatorio, Quantidade: p.quantidade, Valor: p.valor }))), "Declarações");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.memoriasCalculo.map((p) => ({ Relatório: p.relatorio, Quantidade: p.quantidade, Valor: p.valor }))), "Memórias de cálculo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    summary.impostos.map((p) => ({ Relatório: p.relatorio, Quantidade: p.quantidade, Valor: p.valor }))), "Impostos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map((r) => ({
    Número: r.numero, Data: r.data, Cliente: r.cliente, CNPJ: r.cnpj,
    Tipo: r.tipo, Relatório: r.relatorio, Categoria:
      r.categoria === "declaracao" ? "Declaração" : r.categoria === "memoria" ? "Memória de cálculo" : r.categoria === "imposto" ? "Imposto" : "Outros",
    Referência: r.referencia, Descrição: r.descricao,
    Responsável: r.responsavel, Origem: r.origem, Valor: r.valor, Observação: r.observacao,
  }))), "Detalhado");
  XLSX.writeFile(wb, `protocolos-sci-${Date.now()}.xlsx`);
}

// ========== PPTX ==========
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

export async function exportProtocolosPPTX(rows: ProtocoloRow[], summary: ProtocolosSummary, opts: ProtocolosExportOptions) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = "Protocolos — SCI";
  pptx.company = "Econ Escritório Contábil";
  const logoData = await fetchAsBase64(econLogo);

  const drawFooter = (sl: PptxGenJS.Slide, num: string, total: number) => {
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 7.18, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText("Econ Escritório Contábil · Protocolos — SCI", { x: 0.4, y: 7.25, w: 9, h: 0.25, fontSize: 9, color: PPT_GRAY, fontFace: "Calibri" });
    sl.addText(`${num}/${total}`, { x: 12.4, y: 7.25, w: 0.6, h: 0.25, fontSize: 9, color: PPT_GRAY, align: "right", fontFace: "Calibri" });
  };
  const titleBar = (sl: PptxGenJS.Slide, txt: string) => {
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText(txt, { x: 0.4, y: 0.12, w: 9, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });
    if (logoData) sl.addImage({ data: logoData, x: 12.0, y: 0.1, w: 1.1, h: 0.55 });
  };

  const totalSlides = 5;
  let n = 1;

  // Capa
  {
    const sl = pptx.addSlide();
    sl.background = { color: PPT_DARK };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    if (logoData) sl.addImage({ data: logoData, x: 0.7, y: 0.5, w: 1.6, h: 0.8 });
    sl.addText("ECON · Escritório Contábil", { x: 0.7, y: 1.5, w: 12, h: 0.4, fontSize: 14, color: "C9C9C9", fontFace: "Calibri" });
    sl.addText("Protocolos — SCI", { x: 0.7, y: 2.6, w: 12, h: 1.1, fontSize: 54, bold: true, color: "FFFFFF", fontFace: "Calibri" });
    sl.addText("Gestão de protocolos da carteira", { x: 0.7, y: 3.7, w: 12, h: 0.5, fontSize: 22, color: PPT_GOLD, fontFace: "Calibri" });
    sl.addText(`Período: ${opts.periodoLabel}`, { x: 0.7, y: 4.5, w: 12, h: 0.4, fontSize: 16, color: "FFFFFF", fontFace: "Calibri" });
    sl.addText(`Total: ${summary.total} protocolos · ${summary.totalClientes} clientes`, { x: 0.7, y: 4.95, w: 12, h: 0.4, fontSize: 14, color: "C9C9C9", fontFace: "Calibri" });
    drawFooter(sl, String(n++), totalSlides);
  }

  // KPIs
  {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Indicadores principais");
    const kpis = [
      { l: "Total", v: String(summary.total), c: PPT_DARK },
      { l: "Clientes", v: String(summary.totalClientes), c: "16A34A" },
      { l: "Relatórios", v: String(summary.porRelatorio.filter((p) => p.chave !== "—").length), c: "0EA5E9" },
      { l: "Valor total", v: summary.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), c: PPT_GOLD },
    ];
    kpis.forEach((k, i) => {
      const x = 0.4 + i * 3.18;
      sl.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: 3.0, h: 1.6, fill: { color: "FFFFFF" }, line: { color: "E5E5E5", width: 1 }, rectRadius: 0.08 });
      sl.addShape(pptx.ShapeType.rect, { x, y: 1.1, w: 0.08, h: 1.6, fill: { color: k.c }, line: { color: k.c } });
      sl.addText(k.l.toUpperCase(), { x: x + 0.25, y: 1.25, w: 2.7, h: 0.3, fontSize: 9, bold: true, color: PPT_GRAY, charSpacing: 4, fontFace: "Calibri" });
      sl.addText(k.v, { x: x + 0.25, y: 1.6, w: 2.7, h: 1.0, fontSize: k.l === "Valor total" ? 16 : 26, bold: true, color: k.c, fontFace: "Calibri", fit: "shrink" });
    });
    if (summary.porMes.length) {
      sl.addText("Distribuição mensal", { x: 0.4, y: 3.0, w: 12, h: 0.4, fontSize: 14, bold: true, color: PPT_DARK, fontFace: "Calibri" });
      sl.addChart(pptx.ChartType.bar, [{ name: "Protocolos", labels: summary.porMes.map((m) => m.mes), values: summary.porMes.map((m) => m.quantidade) }], {
        x: 0.4, y: 3.45, w: 12.5, h: 3.5, barDir: "col", chartColors: [PPT_GOLD], showLegend: false,
        showValue: false,
        catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
      });
    }
    drawFooter(sl, String(n++), totalSlides);
  }

  // Por responsável (com totais de impostos)
  {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Por responsável");
    const totalImp = summary.valorTotalImpostos || 0;
    const rowsT: any[][] = [[
      { text: "Responsável", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Protocolos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Qtd. Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Total Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "% Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    summary.porResponsavel.forEach((p, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      rowsT.push([
        { text: p.chave, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.quantidade), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: String(p.qtdImpostos), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: p.valorImpostos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), options: { fill: { color: fill }, align: "right", color: PPT_DARK, bold: true } },
        { text: `${totalImp ? ((p.valorImpostos / totalImp) * 100).toFixed(1) : "0.0"}%`, options: { fill: { color: fill }, align: "right", color: PPT_GRAY } },
      ]);
    });
    sl.addTable(rowsT, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 11, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" }, colW: [4.5, 1.7, 1.7, 2.6, 2.0],
      autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.0, newSlideStartY: 1.0,
    });
    drawFooter(sl, String(n++), totalSlides);
  }

  // Impostos (relatórios + total)
  {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Impostos por relatório");
    const totalImp = summary.valorTotalImpostos || 0;
    const totalQtd = summary.impostos.reduce((a, p) => a + p.quantidade, 0);
    sl.addText(`Total de impostos: ${totalImp.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · ${totalQtd} guias`,
      { x: 0.4, y: 0.85, w: 12.5, h: 0.35, fontSize: 12, color: PPT_DARK, bold: true, fontFace: "Calibri" });
    const rowsT: any[][] = [[
      { text: "Relatório", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Quantidade", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Valor", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "% do total", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    summary.impostos.forEach((p, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      rowsT.push([
        { text: p.relatorio, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.quantidade), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), options: { fill: { color: fill }, align: "right", color: PPT_DARK, bold: true } },
        { text: `${totalImp ? ((p.valor / totalImp) * 100).toFixed(1) : "0.0"}%`, options: { fill: { color: fill }, align: "right", color: PPT_GRAY } },
      ]);
    });
    if (!summary.impostos.length) {
      rowsT.push([{ text: "Nenhum imposto identificado.", options: { colspan: 4, align: "center", color: PPT_GRAY, italic: true } } as any]);
    }
    sl.addTable(rowsT, {
      x: 0.4, y: 1.3, w: 12.5, fontSize: 11, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" }, colW: [5.5, 2.0, 3.0, 2.0],
      autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.0, newSlideStartY: 1.0,
    });
    drawFooter(sl, String(n++), totalSlides);
  }
  {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" }; titleBar(sl, "Top 15 clientes (volume e impostos)");
    const rowsT: any[][] = [[
      { text: "Cliente", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Protocolos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Qtd. Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
      { text: "Total Impostos", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "right" } },
    ]];
    summary.porCliente.slice(0, 15).forEach((p, i) => {
      const fill = i % 2 === 0 ? "FFFFFF" : "F7F7F7";
      rowsT.push([
        { text: p.chave, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
        { text: String(p.quantidade), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: String(p.qtdImpostos), options: { fill: { color: fill }, align: "right", color: PPT_DARK } },
        { text: p.valorImpostos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), options: { fill: { color: fill }, align: "right", color: PPT_DARK, bold: true } },
      ]);
    });
    sl.addTable(rowsT, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 10, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" }, colW: [6.0, 1.8, 2.0, 2.7],
      autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.0, newSlideStartY: 1.0,
    });
    drawFooter(sl, String(n++), totalSlides);
  }

  await pptx.writeFile({ fileName: `protocolos-sci-${Date.now()}.pptx` });
}
