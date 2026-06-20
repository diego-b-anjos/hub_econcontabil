import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";
import type { AcessoriasRow, AcessoriasSummary } from "./parser";
import { STATUS_LABELS, classifyStatus, summarize } from "./parser";
import {
  TBRAND, drawTrimHeader, drawAllTrimFooters, trimSectionTitle, loadImageDataURLTrim,
} from "@/lib/exporters";
import econLogo from "@/assets/econ-logo.png";

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export type AcessoriasFocus = "todas" | "pontuais" | "atrasadas";

export interface AcessoriasExportOptions {
  empresa?: string;        // razão social do escritório / cliente
  cnpj?: string;
  competencias?: string[]; // se vazio/undefined → todas
  /** Filtra o conjunto de tarefas exportado:
   *  - "todas": comportamento padrão
   *  - "pontuais": apenas antecipadas + no_prazo
   *  - "atrasadas": apenas atrasadas
   */
  focus?: AcessoriasFocus;
  sections?: {
    indicadores?: boolean;
    porCompetencia?: boolean;
    porResponsavel?: boolean;
    porObrigacao?: boolean;
    porEmpresa?: boolean;
    cruzObrigResp?: boolean;
    cruzEmpresaResp?: boolean;
    detalhado?: boolean;
    atrasadas?: boolean;          // bloco específico com lista de atrasadas
  };
  /** Slides a incluir no PPTX */
  slides?: {
    capa?: boolean;
    kpis?: boolean;
    statusComp?: boolean;
    responsaveis?: boolean;
    empresasCriticas?: boolean;
    obrigacoes?: boolean;
    atrasadas?: boolean;          // slide com tarefas atrasadas
  };
  periodoLabel: string;
}

const DEFAULT_SECTIONS = {
  indicadores: true, porCompetencia: true, porResponsavel: true,
  porObrigacao: true, porEmpresa: true, cruzObrigResp: true,
  cruzEmpresaResp: true, detalhado: false, atrasadas: false,
};
const DEFAULT_SLIDES = {
  capa: true, kpis: true, statusComp: true, responsaveis: true,
  empresasCriticas: true, obrigacoes: true, atrasadas: false,
};

function filterByCompetencias(rows: AcessoriasRow[], comps?: string[]): AcessoriasRow[] {
  if (!comps || !comps.length) return rows;
  const set = new Set(comps);
  return rows.filter((r) => set.has(r.competencia));
}

function applyFocus(rows: AcessoriasRow[], focus?: AcessoriasFocus): AcessoriasRow[] {
  if (!focus || focus === "todas") return rows;
  return rows.filter((r) => {
    const b = classifyStatus(r.status);
    if (focus === "pontuais") return b === "antecipada" || b === "no_prazo";
    if (focus === "atrasadas") return b === "atrasada";
    return true;
  });
}

// ===== Cruzamentos =====
function cruzObrigResp(rows: AcessoriasRow[]) {
  const m = new Map<string, Map<string, { total: number; atrasadas: number }>>();
  for (const r of rows) {
    const o = r.obrigacao || "—";
    const re = r.responsavelEntrega || r.responsavelPrazo || "—";
    const inner = m.get(o) || new Map();
    const cur = inner.get(re) || { total: 0, atrasadas: 0 };
    cur.total++;
    if (classifyStatus(r.status) === "atrasada") cur.atrasadas++;
    inner.set(re, cur); m.set(o, inner);
  }
  const obrs = [...m.keys()].sort();
  const resps = [...new Set(rows.map((r) => r.responsavelEntrega || r.responsavelPrazo || "—"))].sort();
  return { obrs, resps, get: (o: string, r: string) => m.get(o)?.get(r) };
}

function cruzEmpresaResp(rows: AcessoriasRow[]) {
  const m = new Map<string, Map<string, { total: number; atrasadas: number }>>();
  for (const r of rows) {
    const e = r.empresa || "—";
    const re = r.responsavelEntrega || r.responsavelPrazo || "—";
    const inner = m.get(e) || new Map();
    const cur = inner.get(re) || { total: 0, atrasadas: 0 };
    cur.total++;
    if (classifyStatus(r.status) === "atrasada") cur.atrasadas++;
    inner.set(re, cur); m.set(e, inner);
  }
  return m;
}

// =================== PDF ===================
export async function exportAcessoriasPDF(
  rowsAll: AcessoriasRow[],
  _summaryAll: AcessoriasSummary,
  opts: AcessoriasExportOptions,
) {
  const sections = { ...DEFAULT_SECTIONS, ...(opts.sections || {}) };
  const rows = applyFocus(filterByCompetencias(rowsAll, opts.competencias), opts.focus);
  const s = summarize(rows);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 10;
  const logo = await loadImageDataURLTrim(econLogo);

  // Relatório geral de gestão: header sem empresa específica
  const empresaIn = (opts.empresa || "").trim();
  const empresa = empresaIn && empresaIn !== "Econ Escritório Contábil" && empresaIn !== "Gestão de Entregas" ? empresaIn : "";
  const cnpjIn = (opts.cnpj || "").trim();
  const cnpj = cnpjIn && cnpjIn !== "—" ? cnpjIn : "";
  const titulo = "Gestão de Entregas — Acessórias";
  const subtitulo = "Relatório executivo de obrigações acessórias";

  const headerH = empresa ? 48 : 30;
  const newPage = () => {
    doc.addPage();
    drawTrimHeader(doc, logo, opts.periodoLabel, empresa, cnpj, titulo, subtitulo);
    return headerH;
  };

  drawTrimHeader(doc, logo, opts.periodoLabel, empresa, cnpj, titulo, subtitulo);
  let y = headerH;

  // ===== Indicadores =====
  if (sections.indicadores) {
    trimSectionTitle(doc, y, "Indicadores principais", `Total ${s.total} tarefas`);
    y += 14;

    const kpis: { label: string; value: string; tone: [number, number, number] }[] = [
      { label: "PONTUALIDADE", value: fmtPct(s.taxaPontualidade), tone: [22, 163, 74] },
      { label: "TAXA DE ATRASO", value: fmtPct(s.taxaAtraso), tone: [220, 38, 38] },
      { label: "ENTREGUES", value: String(s.porStatus.antecipada + s.porStatus.no_prazo), tone: TBRAND.dark },
      { label: "PENDENTES", value: String(s.porStatus.pendente), tone: [124, 58, 237] },
    ];
    const cardW = (pageW - MARGIN * 2 - 12) / 4;
    kpis.forEach((k, i) => {
      const x = MARGIN + i * (cardW + 4);
      doc.setFillColor(...TBRAND.graySoft);
      doc.roundedRect(x, y, cardW, 22, 1.6, 1.6, "F");
      doc.setFillColor(...k.tone);
      doc.rect(x, y, 1.4, 22, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.setTextColor(...TBRAND.gray);
      doc.text(k.label, x + 4, y + 6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(15);
      doc.setTextColor(...k.tone);
      doc.text(k.value, x + 4, y + 16);
    });
    y += 30;

    // Tabela de status
    autoTable(doc, {
      startY: y,
      head: [["Status", "Quantidade", "% do total"]],
      body: (Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((k) => [
        STATUS_LABELS[k], String(s.porStatus[k]),
        s.total > 0 ? fmtPct((s.porStatus[k] / s.total) * 100) : "—",
      ]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, lineColor: TBRAND.grayLine, lineWidth: 0.15 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== Por competência =====
  if (sections.porCompetencia && s.porCompetencia.length) {
    if (y > pageH - 70) y = newPage();
    trimSectionTitle(doc, y, "Desempenho por competência");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Competência", "Total", "Entregues", "Atrasadas", "% Atraso"]],
      body: s.porCompetencia.map((c) => [
        c.competencia, c.total, c.entregues, c.atrasadas,
        c.total > 0 ? fmtPct((c.atrasadas / c.total) * 100) : "—",
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== Por responsável =====
  if (sections.porResponsavel && s.porResponsavel.length) {
    if (y > pageH - 70) y = newPage();
    trimSectionTitle(doc, y, "Desempenho por responsável");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Responsável", "Total", "No prazo", "Atrasadas", "% Pontualidade"]],
      body: s.porResponsavel.slice(0, 50).map((r) => [
        r.nome, r.total, r.noPrazo, r.atrasadas,
        r.total > 0 ? fmtPct((r.noPrazo / r.total) * 100) : "—",
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== Por obrigação =====
  if (sections.porObrigacao && s.porObrigacao.length) {
    if (y > pageH - 70) y = newPage();
    trimSectionTitle(doc, y, "Obrigações com mais atrasos");
    y += 12;
    const top = [...s.porObrigacao].sort((a, b) => b.atrasadas - a.atrasadas).slice(0, 30);
    autoTable(doc, {
      startY: y,
      head: [["Obrigação / Tarefa", "Total", "Atrasadas", "% Atraso"]],
      body: top.map((o) => [o.nome, o.total, o.atrasadas, o.total > 0 ? fmtPct((o.atrasadas / o.total) * 100) : "—"]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== Por empresa =====
  if (sections.porEmpresa && s.porEmpresa.length) {
    if (y > pageH - 70) y = newPage();
    trimSectionTitle(doc, y, "Empresas com mais atrasos");
    y += 12;
    const empTop = [...s.porEmpresa].sort((a, b) => b.atrasadas - a.atrasadas).slice(0, 40);
    autoTable(doc, {
      startY: y,
      head: [["Empresa", "CNPJ", "Total", "Atrasadas", "Pendentes"]],
      body: empTop.map((e) => [e.empresa, e.cnpj, e.total, e.atrasadas, e.pendentes]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== Cruzamento: Obrigação × Responsável =====
  if (sections.cruzObrigResp) {
    y = newPage();
    trimSectionTitle(doc, y, "Obrigações × Responsáveis", "Total / Atrasadas");
    y += 12;
    const cz = cruzObrigResp(rows);
    const obrsTop = [...s.porObrigacao].slice(0, 25).map((o) => o.nome);
    const respsTop = [...s.porResponsavel].slice(0, 8).map((r) => r.nome);
    const head = [["Obrigação", ...respsTop, "Total"]];
    const body = obrsTop.map((o) => {
      const cells: any[] = [o];
      let totObr = 0;
      respsTop.forEach((re) => {
        const v = cz.get(o, re);
        if (v) { totObr += v.total; cells.push(`${v.total}${v.atrasadas ? ` / ${v.atrasadas}` : ""}`); }
        else cells.push("—");
      });
      cells.push(totObr);
      return cells;
    });
    autoTable(doc, {
      startY: y, head, body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, lineColor: TBRAND.grayLine, lineWidth: 0.1, halign: "center" },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center", fontSize: 7.5 },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: TBRAND.dark, cellWidth: 55 } },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ===== Cruzamento: Empresa × Responsável =====
  if (sections.cruzEmpresaResp) {
    y = newPage();
    trimSectionTitle(doc, y, "Empresas × Responsáveis", "Total / Atrasadas");
    y += 12;
    const cz = cruzEmpresaResp(rows);
    const empsTop = [...s.porEmpresa].slice(0, 30).map((e) => e.empresa);
    const respsTop = [...s.porResponsavel].slice(0, 8).map((r) => r.nome);
    const head = [["Empresa", ...respsTop, "Total"]];
    const body = empsTop.map((e) => {
      const cells: any[] = [e];
      let tot = 0;
      respsTop.forEach((re) => {
        const v = cz.get(e)?.get(re);
        if (v) { tot += v.total; cells.push(`${v.total}${v.atrasadas ? ` / ${v.atrasadas}` : ""}`); }
        else cells.push("—");
      });
      cells.push(tot); return cells;
    });
    autoTable(doc, {
      startY: y, head, body,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, lineColor: TBRAND.grayLine, lineWidth: 0.1, halign: "center" },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center", fontSize: 7.5 },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: TBRAND.dark, cellWidth: 55 } },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  // ===== Tarefas atrasadas (lista detalhada) =====
  if (sections.atrasadas) {
    const atrasadas = rows.filter((r) => classifyStatus(r.status) === "atrasada");
    if (atrasadas.length) {
      y = newPage();
      trimSectionTitle(doc, y, "Tarefas atrasadas", `${atrasadas.length} ocorrências`);
      y += 12;
      autoTable(doc, {
        startY: y,
        head: [["Obrigação", "Empresa", "Comp.", "Prazo legal", "Entrega", "Responsável"]],
        body: atrasadas.slice(0, 1000).map((r) => [
          r.obrigacao, r.empresa, r.competencia, r.prazoLegal, r.dataEntrega || "—",
          r.responsavelEntrega || r.responsavelPrazo || "—",
        ]),
        theme: "striped",
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, lineColor: TBRAND.grayLine, lineWidth: 0.08 },
        headStyles: { fillColor: [220, 38, 38], textColor: 255, halign: "center", fontSize: 7.5 },
        alternateRowStyles: { fillColor: TBRAND.graySoft },
        margin: { left: MARGIN, right: MARGIN },
      });
    }
  }

  // ===== Detalhado =====
  if (sections.detalhado && rows.length) {
    y = newPage();
    trimSectionTitle(doc, y, "Detalhamento de tarefas");
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Obrigação", "Empresa", "Comp.", "Prazo legal", "Entrega", "Status", "Responsável"]],
      body: rows.slice(0, 1000).map((r) => [
        r.obrigacao, r.empresa, r.competencia, r.prazoLegal, r.dataEntrega || "—", r.status,
        r.responsavelEntrega || r.responsavelPrazo || "—",
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1.5, lineColor: TBRAND.grayLine, lineWidth: 0.08 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center", fontSize: 7 },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  drawAllTrimFooters(doc);
  doc.save(`gestao-entregas-${Date.now()}.pdf`);
}

// ===== EXPORT genérico de uma lista (drilldown) =====
export function exportListPDF(
  rows: AcessoriasRow[],
  titulo: string,
  periodo: string,
  empresa = "",
  cnpj = "",
) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  loadImageDataURLTrim(econLogo).then((logo) => {
    drawTrimHeader(doc, logo, periodo, empresa, cnpj, titulo, "Detalhamento de obrigações acessórias");
    autoTable(doc, {
      startY: empresa ? 48 : 30,
      head: [["Obrigação", "Empresa", "CNPJ", "Comp.", "Prazo legal", "Entrega", "Status", "Responsável"]],
      body: rows.map((r) => [
        r.obrigacao, r.empresa, r.cnpj, r.competencia, r.prazoLegal, r.dataEntrega || "—",
        r.status, r.responsavelEntrega || r.responsavelPrazo || "—",
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, lineColor: TBRAND.grayLine, lineWidth: 0.1 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
      alternateRowStyles: { fillColor: TBRAND.graySoft },
      margin: { left: 8, right: 8 },
    });
    drawAllTrimFooters(doc);
    doc.save(`${titulo.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`);
  });
}

export function exportListExcel(rows: AcessoriasRow[], titulo: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
    Obrigação: r.obrigacao, Empresa: r.empresa, CNPJ: r.cnpj, Competência: r.competencia,
    "Prazo legal": r.prazoLegal, Entrega: r.dataEntrega, Status: r.status,
    Responsável: r.responsavelEntrega || r.responsavelPrazo,
  })));
  XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 30));
  XLSX.writeFile(wb, `${titulo.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.xlsx`);
}

// =================== EXCEL ===================
export function exportAcessoriasExcel(
  rowsAll: AcessoriasRow[],
  _summaryAll: AcessoriasSummary,
  opts: AcessoriasExportOptions,
) {
  const sections = { ...DEFAULT_SECTIONS, ...(opts.sections || {}) };
  const rows = applyFocus(filterByCompetencias(rowsAll, opts.competencias), opts.focus);
  const s = summarize(rows);
  const wb = XLSX.utils.book_new();

  if (sections.indicadores) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Indicador", "Valor"],
      ["Período", opts.periodoLabel],
      ["Total de tarefas", s.total],
      ["Entregues antecipadas", s.porStatus.antecipada],
      ["Entregues no prazo", s.porStatus.no_prazo],
      ["Atrasadas", s.porStatus.atrasada],
      ["Atrasos justificados", s.porStatus.justificada],
      ["Pendentes", s.porStatus.pendente],
      ["Taxa de pontualidade (%)", Number(s.taxaPontualidade.toFixed(2))],
      ["Taxa de atraso (%)", Number(s.taxaAtraso.toFixed(2))],
    ]), "Resumo");
  }

  if (sections.porCompetencia) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      s.porCompetencia.map((c) => ({ Competência: c.competencia, Total: c.total, Entregues: c.entregues, Atrasadas: c.atrasadas })),
    ), "Por Competência");
  }
  if (sections.porResponsavel) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      s.porResponsavel.map((r) => ({ Responsável: r.nome, Total: r.total, "No prazo": r.noPrazo, Atrasadas: r.atrasadas })),
    ), "Por Responsável");
  }
  if (sections.porObrigacao) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      s.porObrigacao.map((o) => ({ Obrigação: o.nome, Total: o.total, Atrasadas: o.atrasadas })),
    ), "Por Obrigação");
  }
  if (sections.porEmpresa) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      s.porEmpresa.map((e) => ({ Empresa: e.empresa, CNPJ: e.cnpj, Total: e.total, Atrasadas: e.atrasadas, Pendentes: e.pendentes })),
    ), "Por Empresa");
  }
  if (sections.atrasadas) {
    const atrasadas = rows.filter((r) => classifyStatus(r.status) === "atrasada");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(atrasadas.map((r) => ({
      Obrigação: r.obrigacao, Empresa: r.empresa, CNPJ: r.cnpj, Competência: r.competencia,
      "Prazo legal": r.prazoLegal, Entrega: r.dataEntrega, Status: r.status,
      Responsável: r.responsavelEntrega || r.responsavelPrazo,
    }))), "Atrasadas");
  }

  if (sections.cruzObrigResp) {
    const cz = cruzObrigResp(rows);
    const head = ["Obrigação", ...cz.resps];
    const body = cz.obrs.map((o) => [o, ...cz.resps.map((re) => {
      const v = cz.get(o, re); return v ? `${v.total}${v.atrasadas ? ` (${v.atrasadas} atr.)` : ""}` : "";
    })]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...body]), "Obrig × Resp");
  }

  if (sections.detalhado) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map((r) => ({
      "Obrigação": r.obrigacao, Tipo: r.tipo, Empresa: r.empresa, CNPJ: r.cnpj,
      Cidade: r.cidade, UF: r.estado, "Prazo legal": r.prazoLegal, "Prazo técnico": r.prazoTecnico,
      "Data entrega": r.dataEntrega, Status: r.status, Departamento: r.departamento,
      "Resp. prazo": r.responsavelPrazo, "Resp. entrega": r.responsavelEntrega,
      Competência: r.competencia, Protocolo: r.protocolo,
    }))), "Detalhado");
  }

  XLSX.writeFile(wb, `gestao-entregas-${Date.now()}.xlsx`);
}

// =================== PPTX (cores ECON) ===================
// Cores do escritório: dark "1E1A16" / gold "F7B831" / claro "FEF3D1"
const PPT_DARK = "1E1A16";
const PPT_GOLD = "F7B831";
const PPT_GOLD_SOFT = "FEF3D1";
const PPT_GRAY = "6E6E6E";
const PPT_OK = "16A34A";
const PPT_BAD = "DC2626";

async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url); const blob = await r.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject; fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function exportAcessoriasPPTX(
  rowsAll: AcessoriasRow[],
  _summaryAll: AcessoriasSummary,
  opts: AcessoriasExportOptions,
) {
  const slides = { ...DEFAULT_SLIDES, ...(opts.slides || {}) };
  const rows = applyFocus(filterByCompetencias(rowsAll, opts.competencias), opts.focus);
  const s = summarize(rows);
  const logoData = await fetchAsBase64(econLogo);

  // Total de clientes (CNPJ únicos) e por obrigação
  const clientesUnicos = new Set(rows.map((r) => r.cnpj || r.empresa)).size;
  const obrigCount = new Map<string, number>();
  for (const r of rows) obrigCount.set(r.obrigacao || "—", (obrigCount.get(r.obrigacao || "—") || 0) + 1);
  const obrigList = [...obrigCount.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  const respCount = new Map<string, number>();
  for (const r of rows) {
    const k = r.responsavelEntrega || r.responsavelPrazo || "—";
    respCount.set(k, (respCount.get(k) || 0) + 1);
  }
  const respList = [...respCount.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pptx.title = "Gestão de Entregas — Acessórias";
  pptx.company = "Econ Escritório Contábil";

  // Tema mestre (footer com fina régua dourada)
  const drawFooter = (slide: PptxGenJS.Slide, num: string) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 7.18, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    slide.addText("Econ Escritório Contábil · Gestão de Entregas — Acessórias", { x: 0.4, y: 7.25, w: 9, h: 0.25, fontSize: 9, color: PPT_GRAY, fontFace: "Calibri" });
    slide.addText(num, { x: 12.4, y: 7.25, w: 0.6, h: 0.25, fontSize: 9, color: PPT_GRAY, align: "right", fontFace: "Calibri" });
  };
  const titleBar = (sl: PptxGenJS.Slide, txt: string) => {
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText(txt, { x: 0.4, y: 0.12, w: 9, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });
    if (logoData) sl.addImage({ data: logoData, x: 12.0, y: 0.1, w: 1.1, h: 0.55 });
  };

  // total de slides (capa + kpis + statusComp + responsaveis + obrigacoes + empresasCriticas + clientes + obrigList + respList)
  const total = (slides.capa ? 1 : 0) + (slides.kpis ? 1 : 0) + (slides.statusComp ? 1 : 0)
    + (slides.responsaveis ? 1 : 0) + (slides.empresasCriticas ? 1 : 0) + (slides.obrigacoes ? 1 : 0) + 3;
  let pageNum = 1;

  // ===== Capa (com logo Econ) =====
  if (slides.capa) {
    const sl = pptx.addSlide();
    sl.background = { color: PPT_DARK };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    if (logoData) sl.addImage({ data: logoData, x: 0.7, y: 0.5, w: 1.8, h: 0.9 });
    sl.addText("Escritório Contábil", { x: 0.7, y: 1.5, w: 5, h: 0.4, fontSize: 13, color: "C9C9C9", fontFace: "Calibri" });

    sl.addText("Gestão de Entregas", { x: 0.7, y: 2.6, w: 12, h: 1.1, fontSize: 54, bold: true, color: "FFFFFF", fontFace: "Calibri" });
    sl.addText("Relatório executivo · Acessórias", { x: 0.7, y: 3.7, w: 12, h: 0.5, fontSize: 22, color: PPT_GOLD, fontFace: "Calibri" });
    sl.addShape(pptx.ShapeType.rect, { x: 0.7, y: 4.25, w: 1.5, h: 0.06, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });

    sl.addText(`Período: ${opts.periodoLabel}`, { x: 0.7, y: 4.5, w: 12, h: 0.4, fontSize: 16, color: "FFFFFF", fontFace: "Calibri" });
    sl.addText(`Total de clientes: ${clientesUnicos} · Total de tarefas: ${s.total}`, { x: 0.7, y: 4.95, w: 12, h: 0.4, fontSize: 14, color: "C9C9C9", fontFace: "Calibri" });
    sl.addText(new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }), { x: 0.7, y: 6.5, w: 12, h: 0.4, fontSize: 12, color: PPT_GOLD, fontFace: "Calibri" });
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  // ===== KPIs =====
  if (slides.kpis) {
    const sl = pptx.addSlide();
    sl.background = { color: "FFFFFF" };
    titleBar(sl, "Indicadores principais");
    sl.addText(opts.periodoLabel, { x: 0.4, y: 0.42, w: 12.5, h: 0.3, fontSize: 11, color: "C9C9C9", fontFace: "Calibri", align: "right" });

    const kpis = [
      { l: "Total de tarefas", v: String(s.total), c: PPT_DARK },
      { l: "Pontualidade", v: `${s.taxaPontualidade.toFixed(1)}%`, c: PPT_OK },
      { l: "Taxa de atraso", v: `${s.taxaAtraso.toFixed(1)}%`, c: PPT_BAD },
      { l: "Pendentes", v: String(s.porStatus.pendente), c: PPT_GOLD },
    ];
    kpis.forEach((k, i) => {
      const x = 0.4 + i * 3.18;
      sl.addShape(pptx.ShapeType.roundRect, { x, y: 1.1, w: 3.0, h: 1.6, fill: { color: "FFFFFF" }, line: { color: "E5E5E5", width: 1 }, rectRadius: 0.08 });
      sl.addShape(pptx.ShapeType.rect, { x, y: 1.1, w: 0.08, h: 1.6, fill: { color: k.c }, line: { color: k.c } });
      sl.addText(k.l.toUpperCase(), { x: x + 0.25, y: 1.25, w: 2.7, h: 0.3, fontSize: 9, bold: true, color: PPT_GRAY, charSpacing: 4, fontFace: "Calibri" });
      sl.addText(k.v, { x: x + 0.25, y: 1.55, w: 2.7, h: 1.0, fontSize: 36, bold: true, color: k.c, fontFace: "Calibri" });
    });

    // Doughnut status
    sl.addText("Distribuição por Status", { x: 0.4, y: 3.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: PPT_DARK, fontFace: "Calibri" });
    sl.addChart(pptx.ChartType.doughnut, [{
      name: "Status",
      labels: Object.values(STATUS_LABELS),
      values: [s.porStatus.antecipada, s.porStatus.no_prazo, s.porStatus.atrasada, s.porStatus.justificada, s.porStatus.pendente, s.porStatus.outros],
    }], {
      x: 0.4, y: 3.45, w: 6.0, h: 3.5, showLegend: true, legendPos: "r",
      chartColors: ["16A34A", "0EA5E9", "DC2626", "F59E0B", "7C3AED", "94A3B8"],
      dataLabelColor: "FFFFFF", showPercent: true,
    });

    // Por competência
    sl.addText("Evolução por competência", { x: 6.8, y: 3.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: PPT_DARK, fontFace: "Calibri" });
    sl.addChart(pptx.ChartType.bar, [
      { name: "Entregues", labels: s.porCompetencia.map((c) => c.competencia), values: s.porCompetencia.map((c) => c.entregues) },
      { name: "Atrasadas", labels: s.porCompetencia.map((c) => c.competencia), values: s.porCompetencia.map((c) => c.atrasadas) },
    ], {
      x: 6.8, y: 3.45, w: 6.1, h: 3.5, barDir: "col", showLegend: true, legendPos: "b",
      chartColors: [PPT_OK, PPT_BAD], catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
    });
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  // ===== Status × Competência (mais detalhado) =====
  if (slides.statusComp) {
    const sl = pptx.addSlide();
    sl.background = { color: "FFFFFF" };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText("Volume por Competência", { x: 0.4, y: 0.12, w: 12, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });

    sl.addChart(pptx.ChartType.bar, [
      { name: "Total", labels: s.porCompetencia.map((c) => c.competencia), values: s.porCompetencia.map((c) => c.total) },
      { name: "Entregues", labels: s.porCompetencia.map((c) => c.competencia), values: s.porCompetencia.map((c) => c.entregues) },
      { name: "Atrasadas", labels: s.porCompetencia.map((c) => c.competencia), values: s.porCompetencia.map((c) => c.atrasadas) },
    ], {
      x: 0.4, y: 1.0, w: 12.5, h: 6.0, barDir: "col", showLegend: true, legendPos: "b",
      chartColors: [PPT_DARK, PPT_OK, PPT_BAD], catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
      showTitle: false,
    });
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  // ===== Responsáveis =====
  if (slides.responsaveis) {
    const sl = pptx.addSlide();
    sl.background = { color: "FFFFFF" };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText("Desempenho por responsável", { x: 0.4, y: 0.12, w: 12, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });

    const top = s.porResponsavel.slice(0, 12);
    sl.addChart(pptx.ChartType.bar, [
      { name: "No prazo", labels: top.map((r) => r.nome), values: top.map((r) => r.noPrazo) },
      { name: "Atrasadas", labels: top.map((r) => r.nome), values: top.map((r) => r.atrasadas) },
    ], {
      x: 0.4, y: 1.0, w: 12.5, h: 6.0, barDir: "bar", showLegend: true, legendPos: "b",
      barGrouping: "stacked", chartColors: [PPT_OK, PPT_BAD],
      catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
    });
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  // ===== Obrigações × Responsáveis =====
  if (slides.obrigacoes) {
    const sl = pptx.addSlide();
    sl.background = { color: "FFFFFF" };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText("Obrigações com mais atrasos", { x: 0.4, y: 0.12, w: 12, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });

    const top = [...s.porObrigacao].sort((a, b) => b.atrasadas - a.atrasadas).slice(0, 12);
    sl.addChart(pptx.ChartType.bar, [
      { name: "Total", labels: top.map((o) => o.nome), values: top.map((o) => o.total) },
      { name: "Atrasadas", labels: top.map((o) => o.nome), values: top.map((o) => o.atrasadas) },
    ], {
      x: 0.4, y: 1.0, w: 12.5, h: 6.0, barDir: "bar", showLegend: true, legendPos: "b",
      chartColors: [PPT_DARK, PPT_BAD], catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
    });
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  // ===== Empresas críticas =====
  if (slides.empresasCriticas) {
    const sl = pptx.addSlide();
    sl.background = { color: "FFFFFF" };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText("Empresas com mais atrasos", { x: 0.4, y: 0.12, w: 12, h: 0.5, fontSize: 22, bold: true, color: PPT_GOLD, fontFace: "Calibri" });

    const empTop = [...s.porEmpresa].sort((a, b) => b.atrasadas - a.atrasadas).slice(0, 14);
    const tableRows: any[][] = [[
      { text: "Empresa", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "left" } },
      { text: "CNPJ", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Total", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Atrasadas", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Pendentes", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
    ]];
    empTop.forEach((e, idx) => {
      const fill = idx % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tableRows.push([
        { text: e.empresa, options: { fill: { color: fill }, color: PPT_DARK, bold: true, align: "left" } },
        { text: e.cnpj, options: { fill: { color: fill }, color: PPT_GRAY, align: "center" } },
        { text: String(e.total), options: { fill: { color: fill }, color: PPT_DARK, align: "center" } },
        { text: String(e.atrasadas), options: { fill: { color: fill }, color: PPT_BAD, bold: true, align: "center" } },
        { text: String(e.pendentes), options: { fill: { color: fill }, color: PPT_DARK, align: "center" } },
      ]);
    });
    sl.addTable(tableRows, {
      x: 0.4, y: 1.0, w: 12.5, fontSize: 11, fontFace: "Calibri",
      border: { type: "solid", pt: 0.5, color: "E5E5E5" }, rowH: 0.4,
      colW: [5.5, 2.6, 1.4, 1.5, 1.5],
    });
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  // ===== Slide: Tarefas atrasadas =====
  if (slides.atrasadas) {
    const atrasadasList = rows.filter((r) => classifyStatus(r.status) === "atrasada");
    if (atrasadasList.length) {
      const PER = 14;
      for (let i = 0; i < atrasadasList.length; i += PER) {
        const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
        titleBar(sl, i === 0 ? `Tarefas atrasadas (${atrasadasList.length})` : `Tarefas atrasadas (cont.)`);
        const chunk = atrasadasList.slice(i, i + PER);
        const tableRows: any[][] = [[
          { text: "Obrigação", options: { bold: true, fill: { color: PPT_BAD }, color: "FFFFFF" } },
          { text: "Empresa", options: { bold: true, fill: { color: PPT_BAD }, color: "FFFFFF" } },
          { text: "Comp.", options: { bold: true, fill: { color: PPT_BAD }, color: "FFFFFF", align: "center" } },
          { text: "Prazo", options: { bold: true, fill: { color: PPT_BAD }, color: "FFFFFF", align: "center" } },
          { text: "Entrega", options: { bold: true, fill: { color: PPT_BAD }, color: "FFFFFF", align: "center" } },
          { text: "Responsável", options: { bold: true, fill: { color: PPT_BAD }, color: "FFFFFF" } },
        ]];
        chunk.forEach((r, idx) => {
          const fill = idx % 2 === 0 ? "FFFFFF" : "FFF5F5";
          tableRows.push([
            { text: r.obrigacao, options: { fill: { color: fill }, color: PPT_DARK, bold: true } },
            { text: r.empresa, options: { fill: { color: fill }, color: PPT_DARK } },
            { text: r.competencia, options: { fill: { color: fill }, color: PPT_GRAY, align: "center" } },
            { text: r.prazoLegal, options: { fill: { color: fill }, color: PPT_GRAY, align: "center" } },
            { text: r.dataEntrega || "—", options: { fill: { color: fill }, color: PPT_GRAY, align: "center" } },
            { text: r.responsavelEntrega || r.responsavelPrazo || "—", options: { fill: { color: fill }, color: PPT_DARK } },
          ]);
        });
        sl.addTable(tableRows, {
          x: 0.4, y: 1.0, w: 12.5, fontSize: 9.5, fontFace: "Calibri",
          border: { type: "solid", pt: 0.5, color: "E5E5E5" }, rowH: 0.36,
          colW: [3.4, 3.4, 1.0, 1.3, 1.3, 2.1],
        });
        drawFooter(sl, `${pageNum++}/${total}`);
      }
    }
  }

  // ===== Slide: Total de Clientes / Resumo carteira =====
  {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "Carteira atendida");
    sl.addShape(pptx.ShapeType.roundRect, { x: 1.5, y: 1.6, w: 4.0, h: 2.8, fill: { color: PPT_DARK }, line: { color: PPT_DARK }, rectRadius: 0.1 });
    sl.addText("TOTAL DE CLIENTES", { x: 1.5, y: 1.8, w: 4.0, h: 0.4, fontSize: 12, bold: true, color: PPT_GOLD, align: "center", charSpacing: 6, fontFace: "Calibri" });
    sl.addText(String(clientesUnicos), { x: 1.5, y: 2.2, w: 4.0, h: 1.6, fontSize: 80, bold: true, color: "FFFFFF", align: "center", fontFace: "Calibri" });
    sl.addShape(pptx.ShapeType.roundRect, { x: 7.0, y: 1.6, w: 4.8, h: 2.8, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD }, rectRadius: 0.1 });
    sl.addText("TOTAL DE TAREFAS", { x: 7.0, y: 1.8, w: 4.8, h: 0.4, fontSize: 12, bold: true, color: PPT_DARK, align: "center", charSpacing: 6, fontFace: "Calibri" });
    sl.addText(String(s.total), { x: 7.0, y: 2.2, w: 4.8, h: 1.6, fontSize: 80, bold: true, color: PPT_DARK, align: "center", fontFace: "Calibri" });
    sl.addText(`${obrigList.length} obrigações distintas · ${respList.length} responsáveis`, { x: 0.4, y: 5.0, w: 12.5, h: 0.5, fontSize: 16, color: PPT_GRAY, align: "center", fontFace: "Calibri" });
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  // ===== Slide: Obrigações com totais =====
  {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "Obrigações · totais");
    const top = obrigList.slice(0, 18);
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
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  // ===== Slide: Total de obrigações por responsável =====
  {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    titleBar(sl, "Obrigações por responsável");
    sl.addChart(pptx.ChartType.bar, [{
      name: "Obrigações", labels: respList.slice(0, 14).map((r) => r.nome), values: respList.slice(0, 14).map((r) => r.total),
    }], { x: 0.4, y: 1.0, w: 12.5, h: 5.8, barDir: "bar", showLegend: false, chartColors: [PPT_GOLD], catAxisLabelFontSize: 10, valAxisLabelFontSize: 10 });
    drawFooter(sl, `${pageNum++}/${total}`);
  }

  await pptx.writeFile({ fileName: `gestao-entregas-${Date.now()}.pptx` });
}

// ===== EXPORT PPTX para listas (drilldown) =====
export async function exportListPPTX(rows: AcessoriasRow[], titulo: string, periodo: string) {
  const logoData = await fetchAsBase64(econLogo);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = titulo;
  pptx.company = "Econ Escritório Contábil";

  // Capa
  const cover = pptx.addSlide();
  cover.background = { color: PPT_DARK };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
  if (logoData) cover.addImage({ data: logoData, x: 0.7, y: 0.5, w: 1.6, h: 0.8 });
  cover.addText(titulo, { x: 0.7, y: 2.8, w: 12, h: 1.2, fontSize: 50, bold: true, color: "FFFFFF", fontFace: "Calibri" });
  cover.addText(`Período: ${periodo} · ${rows.length} tarefas`, { x: 0.7, y: 4.0, w: 12, h: 0.5, fontSize: 18, color: PPT_GOLD, fontFace: "Calibri" });

  // Páginas com tabela (até 20 linhas por slide)
  const PER = 20;
  for (let i = 0; i < rows.length; i += PER) {
    const sl = pptx.addSlide(); sl.background = { color: "FFFFFF" };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: PPT_DARK }, line: { color: PPT_DARK } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0.7, w: 13.33, h: 0.04, fill: { color: PPT_GOLD }, line: { color: PPT_GOLD } });
    sl.addText(titulo, { x: 0.4, y: 0.12, w: 9, h: 0.5, fontSize: 20, bold: true, color: PPT_GOLD, fontFace: "Calibri" });
    if (logoData) sl.addImage({ data: logoData, x: 12.0, y: 0.1, w: 1.1, h: 0.55 });

    const slice = rows.slice(i, i + PER);
    const tr: any[][] = [[
      { text: "Obrigação", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Empresa", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Comp.", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD, align: "center" } },
      { text: "Status", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
      { text: "Responsável", options: { bold: true, fill: { color: PPT_DARK }, color: PPT_GOLD } },
    ]];
    slice.forEach((r, k) => {
      const fill = k % 2 === 0 ? "FFFFFF" : "F7F7F7";
      tr.push([
        { text: r.obrigacao, options: { fill: { color: fill }, color: PPT_DARK } },
        { text: r.empresa, options: { fill: { color: fill }, color: PPT_DARK } },
        { text: r.competencia, options: { fill: { color: fill }, align: "center", color: PPT_GRAY } },
        { text: r.status, options: { fill: { color: fill }, color: PPT_DARK } },
        { text: r.responsavelEntrega || r.responsavelPrazo || "—", options: { fill: { color: fill }, color: PPT_DARK } },
      ]);
    });
    sl.addTable(tr, { x: 0.3, y: 1.0, w: 12.7, fontSize: 9, fontFace: "Calibri", border: { type: "solid", pt: 0.5, color: "E5E5E5" }, rowH: 0.28, colW: [3.4, 3.6, 1.2, 1.8, 2.7] });
  }

  await pptx.writeFile({ fileName: `${titulo.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pptx` });
}
