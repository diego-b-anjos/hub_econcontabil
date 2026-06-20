import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/econ-logo.png";
import type { RelatorioFiscal, Orgao } from "./types";
import { fmtBRL, orgaoLabel } from "./format";
import { montarResumo, frasesExecutivas, explicacoesGlossario } from "./resumo";

/** Aplica filtro opcional de "ocultar pendências de declaração" nos débitos. */
function aplicarFiltros(rel: RelatorioFiscal): RelatorioFiscal {
  const ocultar = (rel as RelatorioFiscal & { ocultarPendenciasDeclaracao?: boolean })
    .ocultarPendenciasDeclaracao;
  if (!ocultar) return rel;
  return {
    ...rel,
    debitos: rel.debitos.filter((d) => !d.pendenciaDeclaracao),
  };
}

/**
 * Rótulo final da situação que respeita a classificação manual (statusParc)
 * feita pelo usuário na UI. Corrige o caso em que o débito foi marcado
 * como "rescisão" mas o relatório ainda exibia "em dia".
 */
const situacaoLabel = (d: import("./types").Debito): string => {
  const status = d.statusParc;
  if (status) {
    switch (status) {
      case "devedor": return "Devedor";
      case "em-dia": return "Parcelamento em Dia";
      case "em-atraso": return "Parcelamento em Atraso";
      case "rescisao": return "Parcelamento em Rescisão";
      case "divida-ativa": return "Em Dívida Ativa";
    }
  }
  if (d.parcelado) return d.situacao || "Suspenso (parcelado)";
  return d.situacao || "Devedor";
};

/** Verifica se há débito marcado como parcelamento em rescisão. */
const temRescisao = (rel: RelatorioFiscal): boolean =>
  rel.debitos.some((d) => d.statusParc === "rescisao" || /RESCIS/i.test(d.situacao || ""));

const AVISO_RESCISAO_TITULO = "ATENÇÃO — RISCO EM PARCELAMENTOS EM RESCISÃO";
const AVISO_RESCISAO_TEXTO =
  "Foram identificados débitos vinculados a parcelamentos em fase de rescisão. " +
  "Caso a rescisão seja efetivada, a empresa perderá os descontos de multa e juros " +
  "concedidos no parcelamento e os débitos poderão ser inscritos em Dívida Ativa, " +
  "com acréscimo de encargos legais (até 20%) e possibilidade de protesto e execução fiscal. " +
  "Recomenda-se regularizar as parcelas em atraso com urgência.";

/** Texto com as datas por ente para inclusão em cabeçalhos. */
const datasPorOrgaoTexto = (rel: RelatorioFiscal): string => {
  const m = rel.datasPorOrgao || {};
  const entradas = (Object.keys(m) as Orgao[])
    .filter((o) => m[o])
    .map((o) => `${orgaoLabel(o)}: ${m[o]}`);
  return entradas.join("   •   ");
};

const versaoTexto = (rel: RelatorioFiscal): string =>
  rel.versao ? `Versão #${rel.versao}` : "";

/** Data atual no momento da exportação (data do RELATÓRIO, não das consultas). */
const hojeBR = (): string => new Date().toLocaleString("pt-BR");

/** Codifica o snapshot do relatório em base64 para embutir no PDF/Excel,
 *  permitindo reimportar o arquivo gerado e reconstruir o histórico. */
export const SNAPSHOT_MAGIC = "PFE-SNAPSHOT::";
export function encodeSnapshot(rel: RelatorioFiscal): string {
  const json = JSON.stringify(rel);
  // btoa não suporta UTF-8 direto — precisamos escapar.
  const b64 = typeof window !== "undefined"
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, "utf-8").toString("base64");
  return `${SNAPSHOT_MAGIC}${b64}`;
}
export function decodeSnapshot(text: string): RelatorioFiscal | null {
  const idx = text.indexOf(SNAPSHOT_MAGIC);
  if (idx < 0) return null;
  const tail = text.slice(idx + SNAPSHOT_MAGIC.length);
  // Pega só caracteres base64 válidos
  const m = tail.match(/[A-Za-z0-9+/=]+/);
  if (!m) return null;
  try {
    const json = decodeURIComponent(escape(atob(m[0])));
    return JSON.parse(json) as RelatorioFiscal;
  } catch {
    return null;
  }
}

/** Tenta extrair um snapshot embutido de um arquivo PDF ou Excel gerado por
 *  este sistema. Retorna null quando o arquivo não contém o marcador. */
export async function extrairSnapshotDeArquivo(file: File): Promise<RelatorioFiscal | null> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const candidatos = [wb.description, wb.subject, wb.title].filter(Boolean) as string[];
      for (const c of candidatos) {
        const s = decodeSnapshot(c);
        if (s) return s;
      }
    } catch {
      // ignora
    }
    return null;
  }
  if (nome.endsWith(".pdf")) {
    try {
      // Lê o PDF como texto bruto e procura pelo marcador embutido em /Subject.
      const buf = await file.arrayBuffer();
      // Usa latin1/binary para preservar bytes originais
      const bytes = new Uint8Array(buf);
      let texto = "";
      const chunk = 65536;
      for (let i = 0; i < bytes.length; i += chunk) {
        texto += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      // Snapshot direto (texto plano, caso jsPDF não tenha codificado)
      const direto = decodeSnapshot(texto);
      if (direto) return direto;
      // jsPDF escreve strings PDF entre parênteses, podendo escapar \\n etc.
      const idx = texto.indexOf(SNAPSHOT_MAGIC);
      if (idx >= 0) {
        // A partir do marcador, captura caracteres base64 contíguos
        const tail = texto.slice(idx);
        return decodeSnapshot(tail);
      }
    } catch {
      // ignora
    }
    return null;
  }
  return null;
}

const YELLOW = "FFFFCC00";
const BLACK = "FF111111";

export async function exportarExcel(rel: RelatorioFiscal) {
  rel = aplicarFiltros(rel);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Econ Escritório Contábil";
  wb.created = new Date();
  // Embute snapshot completo nas propriedades do arquivo para reimportação.
  wb.description = encodeSnapshot(rel);
  wb.title = `Endividamento — ${rel.cadastro.razaoSocial || "cliente"}`;

  const dataRelatorio = hojeBR();

  // ---------- Aba: Resumo Executivo ----------
  const wsR = wb.addWorksheet("Resumo Executivo");
  wsR.mergeCells("A1:F1");
  wsR.getCell("A1").value = "RESUMO EXECUTIVO";
  wsR.getCell("A1").font = { bold: true, size: 14, color: { argb: BLACK } };
  wsR.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  wsR.getCell("A1").alignment = { horizontal: "center" };
  wsR.getRow(1).height = 26;

  wsR.mergeCells("A2:F2");
  wsR.getCell("A2").value = [
    rel.cadastro.razaoSocial,
    rel.cadastro.cnpj && `CNPJ: ${rel.cadastro.cnpj}`,
    rel.cadastro.inscricaoMunicipal && `Inscr. Municipal: ${rel.cadastro.inscricaoMunicipal}`,
    rel.cadastro.inscricaoEstadual && `Inscr. Estadual: ${rel.cadastro.inscricaoEstadual}`,
  ].filter(Boolean).join("  •  ");
  wsR.getCell("A2").alignment = { horizontal: "center" };
  wsR.getCell("A2").font = { bold: true };

  // Linha 3: versão + data geral
  wsR.mergeCells("A3:F3");
  wsR.getCell("A3").value = [
    versaoTexto(rel),
    `Emitido em: ${dataRelatorio}`,
  ].filter(Boolean).join("   •   ");
  wsR.getCell("A3").alignment = { horizontal: "center" };
  wsR.getCell("A3").font = { italic: true, color: { argb: "FF555555" } };

  // Linha de datas por ente, se houver
  const dpo = datasPorOrgaoTexto(rel);
  if (dpo) {
    wsR.mergeCells("A4:F4");
    wsR.getCell("A4").value = `Datas das consultas por ente — ${dpo}`;
    wsR.getCell("A4").alignment = { horizontal: "center", wrapText: true };
    wsR.getCell("A4").font = { italic: true, color: { argb: "FF555555" } };
  }

  const resumo = montarResumo(rel);
  const frases = frasesExecutivas(rel, resumo);

  let rIdx = 4;
  // Aviso destacado quando há débitos em parcelamento em rescisão.
  if (temRescisao(rel)) {
    wsR.mergeCells(`A${rIdx}:F${rIdx}`);
    const tCell = wsR.getCell(`A${rIdx}`);
    tCell.value = `⚠ ${AVISO_RESCISAO_TITULO}`;
    tCell.font = { bold: true, size: 12, color: { argb: "FF7F1D1D" } };
    tCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
    tCell.alignment = { horizontal: "center", vertical: "middle" };
    wsR.getRow(rIdx).height = 22;
    rIdx++;
    wsR.mergeCells(`A${rIdx}:F${rIdx}`);
    const bCell = wsR.getCell(`A${rIdx}`);
    bCell.value = AVISO_RESCISAO_TEXTO;
    bCell.font = { color: { argb: "FF7F1D1D" } };
    bCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF2F2" } };
    bCell.alignment = { wrapText: true, vertical: "top" };
    wsR.getRow(rIdx).height = 60;
    rIdx += 2;
  }
  wsR.getCell(`A${rIdx}`).value = "Em poucas palavras:";
  wsR.getCell(`A${rIdx}`).font = { bold: true, size: 12 };
  rIdx++;
  frases.forEach((f) => {
    wsR.mergeCells(`A${rIdx}:F${rIdx}`);
    wsR.getCell(`A${rIdx}`).value = `• ${f}`;
    wsR.getCell(`A${rIdx}`).alignment = { wrapText: true, vertical: "top" };
    wsR.getRow(rIdx).height = 32;
    rIdx++;
  });

  rIdx++;
  wsR.getCell(`A${rIdx}`).value = "O que cada coluna significa:";
  wsR.getCell(`A${rIdx}`).font = { bold: true, size: 12 };
  rIdx++;
  explicacoesGlossario.forEach((g) => {
    wsR.mergeCells(`A${rIdx}:F${rIdx}`);
    wsR.getCell(`A${rIdx}`).value = `${g.titulo}: ${g.texto}`;
    wsR.getCell(`A${rIdx}`).alignment = { wrapText: true, vertical: "top" };
    wsR.getRow(rIdx).height = 36;
    rIdx++;
  });

  rIdx += 1;
  const headR = ["Órgão", "Imposto / Tributo", "Qtd. Débitos", "Principal", "Multa + Juros", "Total Atualizado"];
  wsR.addRow([]);
  wsR.addRow(headR);
  const hrR = wsR.getRow(wsR.rowCount);
  hrR.eachCell((c) => {
    c.font = { bold: true, color: { argb: YELLOW } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    c.alignment = { horizontal: "center" };
  });
  resumo.forEach((r) => {
    const row = wsR.addRow([r.orgao, r.imposto, r.qtdDebitos, r.principal, r.multa + r.juros, r.total]);
    [4, 5, 6].forEach((i) => (row.getCell(i).numFmt = '"R$" #,##0.00'));
  });
  const totR = wsR.addRow([
    "TOTAL DÉBITOS EM ABERTO", "", resumo.reduce((s, r) => s + r.qtdDebitos, 0),
    resumo.reduce((s, r) => s + r.principal, 0),
    resumo.reduce((s, r) => s + r.multa + r.juros, 0),
    resumo.reduce((s, r) => s + r.total, 0),
  ]);
  totR.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4B8" } };
  });
  [4, 5, 6].forEach((i) => (totR.getCell(i).numFmt = '"R$" #,##0.00'));
  // Parcelas em atraso e total consolidado
  const _totalParcAtraso = rel.parcelamentos.reduce((s, p) => s + (p.valorEmAtraso || 0), 0);
  if (_totalParcAtraso > 0) {
    const parcRow = wsR.addRow([
      "(+) Parcelas em atraso de parcelamentos",
      "", "", "", "", _totalParcAtraso,
    ]);
    parcRow.getCell(6).numFmt = '"R$" #,##0.00';
    parcRow.eachCell((c) => (c.font = { italic: true }));
  }
  const totalConsolidadoXls =
    resumo.reduce((s, r) => s + r.total, 0) + _totalParcAtraso;
  const consRow = wsR.addRow([
    "TOTAL CONSOLIDADO DA EMPRESA", "", "", "", "", totalConsolidadoXls,
  ]);
  consRow.eachCell((c) => {
    c.font = { bold: true, color: { argb: BLACK } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  });
  consRow.getCell(6).numFmt = '"R$" #,##0.00';
  wsR.columns = [
    { width: 24 }, { width: 36 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 20 },
  ];

  // Certidões negativas
  if (rel.certidoesNegativas?.length) {
    wsR.addRow([]);
    const tit = wsR.addRow(["ÓRGÃOS SEM DÉBITOS – CERTIDÕES NEGATIVAS RECONHECIDAS"]);
    wsR.mergeCells(`A${tit.number}:F${tit.number}`);
    tit.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    tit.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };
    tit.getCell(1).alignment = { horizontal: "center" };
    const headC = wsR.addRow(["Órgão", "Emissor", "Nº da Certidão", "Emissão", "Validade", "Arquivo"]);
    headC.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };
      c.alignment = { horizontal: "center" };
    });
    rel.certidoesNegativas.forEach((c) => {
      const r = wsR.addRow([
        orgaoLabel(c.orgao),
        c.emissor,
        c.numero || "—",
        c.dataEmissao || "—",
        c.validade || "—",
        c.arquivo || "—",
      ]);
      r.getCell(1).font = { bold: true, color: { argb: "FF15803D" } };
    });
  }

  const ws = wb.addWorksheet("Endividamento Tributário", {
    views: [{ state: "frozen", ySplit: 6 }],
  });

  ws.mergeCells("A1:I1");
  ws.getCell("A1").value = "RELATÓRIO DE ENDIVIDAMENTO TRIBUTÁRIO";
  ws.getCell("A1").font = { bold: true, size: 16, color: { argb: BLACK } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:I2");
  ws.getCell("A2").value = `${rel.cadastro.razaoSocial || ""}  •  CNPJ: ${rel.cadastro.cnpj || ""}`;
  ws.getCell("A2").font = { bold: true, size: 12 };
  ws.getCell("A2").alignment = { horizontal: "center" };

  ws.mergeCells("A3:I3");
  ws.getCell("A3").value = [
    versaoTexto(rel),
    `Emitido em: ${dataRelatorio}`,
    dpo && `Consultas: ${dpo}`,
  ].filter(Boolean).join("   •   ");
  ws.getCell("A3").alignment = { horizontal: "center" };
  ws.getCell("A3").font = { italic: true, color: { argb: "FF555555" } };

  // Resumo
  const totalGeral = rel.debitos.reduce((s, d) => s + d.total, 0);
  const totalParc = rel.parcelamentos.reduce((s, p) => s + (p.valorEmAtraso || 0), 0);
  const totalConsolidado = totalGeral + totalParc;
  ws.mergeCells("A5:I5");
  ws.getCell("A5").value = `DÉBITOS EM ABERTO: ${fmtBRL(totalGeral)}   •   PARCELAS EM ATRASO: ${fmtBRL(totalParc)}   •   TOTAL CONSOLIDADO: ${fmtBRL(totalConsolidado)}`;
  ws.getCell("A5").font = { bold: true, size: 12, color: { argb: BLACK } };
  ws.getCell("A5").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4B8" } };
  ws.getCell("A5").alignment = { horizontal: "center" };

  // Header
  const header = [
    "Órgão", "Tributo / Receita", "Competência", "Vencimento",
    "Valor Original", "Multa", "Juros", "Total Atualizado", "Situação",
  ];
  const headerRow = ws.addRow([]);
  ws.addRow(header);
  const hr = ws.getRow(ws.rowCount);
  hr.eachCell((c) => {
    c.font = { bold: true, color: { argb: YELLOW } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = { top: { style: "thin" }, bottom: { style: "thin" } };
  });

  rel.debitos
    .sort((a, b) => a.orgao.localeCompare(b.orgao) || a.competencia.localeCompare(b.competencia))
    .forEach((d) => {
      const r = ws.addRow([
        orgaoLabel(d.orgao), d.receita, d.competencia, d.vencimento || "-",
        d.valorOriginal,
        d.valorJaAtualizado && !d.multa ? "incluso" : d.multa,
        d.valorJaAtualizado && !d.juros ? "incluso" : d.juros,
        d.total,
        situacaoLabel(d),
      ]);
      [5, 8].forEach((i) => (r.getCell(i).numFmt = '"R$" #,##0.00'));
      [6, 7].forEach((i) => {
        const cell = r.getCell(i);
        if (typeof cell.value === "number") cell.numFmt = '"R$" #,##0.00';
        else { cell.font = { italic: true, color: { argb: "FF666666" } }; cell.alignment = { horizontal: "right" }; }
      });
    });

  // Linha de total
  const totalRow = ws.addRow(["", "", "", "TOTAL", 
    rel.debitos.reduce((s, d) => s + d.valorOriginal, 0),
    rel.debitos.reduce((s, d) => s + d.multa, 0),
    rel.debitos.reduce((s, d) => s + d.juros, 0),
    totalGeral, ""]);
  totalRow.eachCell((c) => {
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF4B8" } };
  });
  [5, 6, 7, 8].forEach((i) => (totalRow.getCell(i).numFmt = '"R$" #,##0.00'));

  // Nota explicativa sobre valores marcados como "incluso"
  if (rel.debitos.some((d) => d.valorJaAtualizado)) {
    const noteRow = ws.addRow([
      'Observação: valores marcados como "incluso" já estão atualizados pelo órgão (ex.: PGE/Dívida Ativa), com multa e juros embutidos no Total.',
    ]);
    ws.mergeCells(`A${noteRow.number}:I${noteRow.number}`);
    noteRow.getCell(1).font = { italic: true, color: { argb: "FF666666" } };
    noteRow.getCell(1).alignment = { wrapText: true, vertical: "top" };
    ws.getRow(noteRow.number).height = 26;
  }

  ws.columns.forEach((c, i) => {
    c.width = [22, 38, 14, 14, 16, 14, 14, 18, 22][i];
  });

  // Aba parcelamentos
  if (rel.parcelamentos.length) {
    const ws2 = wb.addWorksheet("Parcelamentos");
    ws2.addRow(["Órgão", "Identificador", "Modalidade", "Parcelas em atraso", "Valor em atraso", "Situação"]);
    const h = ws2.getRow(1);
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: YELLOW } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    });
    rel.parcelamentos.forEach((p) => {
      const r = ws2.addRow([
        orgaoLabel(p.orgao), p.identificador, p.modalidade || "-",
        p.parcelasEmAtraso ?? "-", p.valorEmAtraso ?? 0, p.situacao || "-",
      ]);
      r.getCell(5).numFmt = '"R$" #,##0.00';
    });
    ws2.columns.forEach((c, i) => (c.width = [22, 32, 32, 18, 18, 22][i]));
  }

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `Endividamento_${(rel.cadastro.cnpj || "cliente").replace(/\D/g, "")}.xlsx`);
}

async function loadLogoDataUrl(): Promise<string> {
  const res = await fetch(logo);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export async function exportarPDF(rel: RelatorioFiscal) {
  rel = aplicarFiltros(rel);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Data do RELATÓRIO = momento atual da geração.
  // `rel.dataAtualizacao` e `rel.datasPorOrgao` continuam representando a data
  // das consultas individuais a cada ente.
  const dataRelatorio = hojeBR();

  // Embute snapshot completo nas propriedades do PDF para permitir reimportação
  // a partir do próprio arquivo gerado.
  doc.setProperties({
    title: `Endividamento Tributário — ${rel.cadastro.razaoSocial || "cliente"}`,
    subject: encodeSnapshot(rel),
    author: "Econ Escritório Contábil",
    keywords: `painel-fiscal-econ versao-${rel.versao || 1}`,
  });

  const logoData = await loadLogoDataUrl();
  // Cabeçalho amarelo
  doc.setFillColor(255, 204, 0);
  doc.rect(0, 0, W, 80, "F");
  doc.addImage(logoData, "PNG", 30, 18, 110, 44);

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relatório de Endividamento Tributário", W - 30, 38, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    [versaoTexto(rel), `Emitido em: ${dataRelatorio}`].filter(Boolean).join("   •   "),
    W - 30,
    56,
    { align: "right" },
  );

  // ============ PÁGINA: RESUMO EXECUTIVO ============
  const resumo = montarResumo(rel);
  const frases = frasesExecutivas(rel, resumo);
  let yR = 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text("Resumo Executivo", 30, yR);
  yR += 8;
  doc.setDrawColor(255, 204, 0);
  doc.setLineWidth(2);
  doc.line(30, yR, W - 30, yR);
  yR += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(rel.cadastro.razaoSocial || "—", 30, yR);
  yR += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  // Linha 1: identificação cadastral
  const ids = [
    `CNPJ: ${rel.cadastro.cnpj || "—"}`,
    rel.cadastro.inscricaoMunicipal && `Inscr. Municipal: ${rel.cadastro.inscricaoMunicipal}`,
    rel.cadastro.inscricaoEstadual && `Inscr. Estadual: ${rel.cadastro.inscricaoEstadual}`,
  ].filter(Boolean).join("   •   ");
  doc.text(ids, 30, yR);
  yR += 13;
  // Linha 2: versão + data do relatório (hoje)
  doc.text(
    `${versaoTexto(rel)}   •   Emitido em ${dataRelatorio}`,
    30,
    yR,
  );
  yR += 13;
  // Linha 3+: datas das CONSULTAS por ente, se houver (uma por linha para clareza)
  const dpoTxt = datasPorOrgaoTexto(rel);
  if (dpoTxt) {
    doc.setFont("helvetica", "bold");
    doc.text("Datas das consultas por ente:", 30, yR);
    yR += 12;
    doc.setFont("helvetica", "normal");
    const m = rel.datasPorOrgao || {};
    (Object.keys(m) as Orgao[])
      .filter((o) => m[o])
      .forEach((o) => {
        doc.text(`• ${orgaoLabel(o)}: ${m[o]}`, 40, yR);
        yR += 12;
      });
    yR += 4;
  } else {
    yR += 4;
  }

  // Bloco verde de certidões negativas
  if (rel.certidoesNegativas?.length) {
    const boxX = 30;
    const boxW = W - 60;
    const boxH = 26;
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(34, 197, 94);
    doc.setLineWidth(1);
    doc.roundedRect(boxX, yR, boxW, boxH, 4, 4, "FD");
    doc.setTextColor(21, 128, 61);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const titulo = "ORGAOS SEM DEBITOS - CERTIDOES NEGATIVAS RECONHECIDAS";
    // Centraliza horizontalmente dentro do bloco para evitar transbordo
    doc.text(titulo, boxX + boxW / 2, yR + boxH / 2 + 3, {
      align: "center",
      maxWidth: boxW - 24,
    });
    doc.setTextColor(20);
    yR += boxH + 8;
    autoTable(doc, {
      startY: yR,
      head: [["Órgão", "Emissor", "Nº da Certidão", "Emissão", "Validade"]],
      body: rel.certidoesNegativas.map((c) => [
        orgaoLabel(c.orgao),
        c.emissor,
        c.numero || "—",
        c.dataEmissao || "—",
        c.validade || "—",
      ]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold" },
      bodyStyles: { fillColor: [240, 253, 244] },
      margin: { left: 30, right: 30 },
    });
    yR = (doc as any).lastAutoTable.finalY + 12;
  }

  // Aviso de rescisão (vermelho) — antes do "Em poucas palavras"
  if (temRescisao(rel)) {
    const padding = 10;
    const innerW = W - 60 - padding * 2;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const tituloLines = doc.splitTextToSize(`AVISO IMPORTANTE — ${AVISO_RESCISAO_TITULO}`, innerW);
    doc.setFont("helvetica", "normal");
    const corpoLines = doc.splitTextToSize(AVISO_RESCISAO_TEXTO, innerW);
    const boxH = padding * 2 + tituloLines.length * 12 + 4 + corpoLines.length * 11;
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(1);
    doc.roundedRect(30, yR, W - 60, boxH, 4, 4, "FD");
    doc.setTextColor(127, 29, 29);
    doc.setFont("helvetica", "bold");
    doc.text(tituloLines, 30 + padding, yR + padding + 10);
    doc.setFont("helvetica", "normal");
    doc.text(corpoLines, 30 + padding, yR + padding + 10 + tituloLines.length * 12 + 4);
    yR += boxH + 12;
    doc.setTextColor(20);
  }

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Em poucas palavras:", 30, yR);
  yR += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  frases.forEach((f) => {
    const lines = doc.splitTextToSize(`• ${f}`, W - 60);
    doc.text(lines, 30, yR);
    yR += lines.length * 13 + 4;
  });

  yR += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("O que cada coluna significa:", 30, yR);
  yR += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  explicacoesGlossario.forEach((g) => {
    doc.setFont("helvetica", "bold");
    const tlines = doc.splitTextToSize(g.titulo, W - 60);
    doc.text(tlines, 30, yR);
    yR += tlines.length * 11;
    doc.setFont("helvetica", "normal");
    const blines = doc.splitTextToSize(g.texto, W - 60);
    doc.text(blines, 30, yR);
    yR += blines.length * 11 + 4;
    if (yR > doc.internal.pageSize.getHeight() - 200) { doc.addPage(); yR = 60; }
  });

  // Tabela do resumo por órgão/imposto
  if (yR > doc.internal.pageSize.getHeight() - 200) { doc.addPage(); yR = 60; }
  autoTable(doc, {
    startY: yR + 6,
    head: [["Órgão", "Imposto / Tributo", "Qtd.", "Principal", "Multa + Juros", "Total Atualizado"]],
    body: resumo.map((r) => [
      r.orgao, r.imposto, String(r.qtdDebitos),
      fmtBRL(r.principal), fmtBRL(r.multa + r.juros), fmtBRL(r.total),
    ]),
    foot: (() => {
      const subDeb = resumo.reduce((s, r) => s + r.total, 0);
      const parcAtr = rel.parcelamentos.reduce((s, p) => s + (p.valorEmAtraso || 0), 0);
      const consol = subDeb + parcAtr;
      const rows: any[] = [[
        "Subtotal débitos em aberto", "",
        String(resumo.reduce((s, r) => s + r.qtdDebitos, 0)),
        fmtBRL(resumo.reduce((s, r) => s + r.principal, 0)),
        fmtBRL(resumo.reduce((s, r) => s + r.multa + r.juros, 0)),
        fmtBRL(subDeb),
      ]];
      if (parcAtr > 0) {
        rows.push(["(+) Parcelas em atraso de parcelamentos", "", "", "", "", fmtBRL(parcAtr)]);
      }
      rows.push(["TOTAL CONSOLIDADO DA EMPRESA", "", "", "", "", fmtBRL(consol)]);
      return rows;
    })(),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [17, 17, 17], textColor: [255, 204, 0] },
    footStyles: { fillColor: [255, 244, 184], textColor: [17, 17, 17], fontStyle: "bold" },
    columnStyles: { 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    margin: { left: 30, right: 30 },
  });

  // Quebra de página antes do detalhamento
  doc.addPage();
  doc.setFillColor(255, 204, 0);
  doc.rect(0, 0, W, 80, "F");
  doc.addImage(logoData, "PNG", 30, 18, 110, 44);
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Detalhamento dos Débitos", W - 30, 38, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    [versaoTexto(rel), `Emitido em: ${dataRelatorio}`].filter(Boolean).join("   •   "),
    W - 30,
    56,
    { align: "right" },
  );

  // Bloco cliente
  let y = 100;
  doc.setFillColor(17, 17, 17);
  doc.rect(30, y, W - 60, 60, "F");
  doc.setTextColor(255, 204, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CLIENTE", 42, y + 18);
  doc.setTextColor(255);
  doc.setFont("helvetica", "normal");
  doc.text(rel.cadastro.razaoSocial || "—", 42, y + 34);
  doc.setFontSize(9);
  doc.text(
    `CNPJ: ${rel.cadastro.cnpj || "—"}   |   ${rel.cadastro.municipio || ""}${rel.cadastro.uf ? "/" + rel.cadastro.uf : ""}`,
    42,
    y + 50,
  );

  // Resumo
  y += 80;
  const totalGeral = rel.debitos.reduce((s, d) => s + d.total, 0);
  const totalOrig = rel.debitos.reduce((s, d) => s + d.valorOriginal, 0);
  const totalMulta = rel.debitos.reduce((s, d) => s + d.multa, 0);
  const totalJuros = rel.debitos.reduce((s, d) => s + d.juros, 0);
  const totalParc = rel.parcelamentos.reduce((s, p) => s + (p.valorEmAtraso || 0), 0);

  const cards = [
    { label: "Valor Original", val: fmtBRL(totalOrig) },
    { label: "Multa", val: fmtBRL(totalMulta) },
    { label: "Juros", val: fmtBRL(totalJuros) },
    { label: "Total Consolidado", val: fmtBRL(totalGeral + totalParc), highlight: true },
  ];
  const cw = (W - 60 - 30) / 4;
  cards.forEach((c, i) => {
    const x = 30 + i * (cw + 10);
    doc.setDrawColor(220);
    doc.setFillColor(c.highlight ? 255 : 250, c.highlight ? 244 : 250, c.highlight ? 184 : 250);
    doc.roundedRect(x, y, cw, 56, 6, 6, "FD");
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(c.label, x + 12, y + 18);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(c.val, x + 12, y + 40);
  });

  // Tabela de débitos agrupada por órgão
  y += 76;
  const grouped: Record<string, typeof rel.debitos> = {};
  rel.debitos.forEach((d) => {
    (grouped[d.orgao] = grouped[d.orgao] || []).push(d);
  });

  for (const orgao of Object.keys(grouped)) {
    const dataOrgao = rel.datasPorOrgao?.[orgao as Orgao];
    const tituloOrgao = dataOrgao
      ? `${orgaoLabel(orgao)}   —   Atualizado em ${dataOrgao}`
      : orgaoLabel(orgao);
    autoTable(doc, {
      startY: y,
      head: [[tituloOrgao]],
      body: [],
      theme: "plain",
      headStyles: {
        fillColor: [255, 204, 0],
        textColor: [17, 17, 17],
        fontStyle: "bold",
        fontSize: 11,
        halign: "left",
      },
      margin: { left: 30, right: 30 },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY,
      head: [["Tributo", "Comp.", "Vcto.", "Original", "Multa", "Juros", "Total", "Situação"]],
      body: grouped[orgao].map((d) => [
        d.receita,
        d.competencia,
        d.vencimento || "-",
        fmtBRL(d.valorOriginal),
        d.valorJaAtualizado && !d.multa ? "incluso" : fmtBRL(d.multa),
        d.valorJaAtualizado && !d.juros ? "incluso" : fmtBRL(d.juros),
        fmtBRL(d.total),
        situacaoLabel(d),
      ]),
      foot: [[
        "Subtotal", "", "",
        fmtBRL(grouped[orgao].reduce((s, d) => s + d.valorOriginal, 0)),
        fmtBRL(grouped[orgao].reduce((s, d) => s + d.multa, 0)),
        fmtBRL(grouped[orgao].reduce((s, d) => s + d.juros, 0)),
        fmtBRL(grouped[orgao].reduce((s, d) => s + d.total, 0)),
        "",
      ]],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [17, 17, 17], textColor: [255, 204, 0] },
      footStyles: { fillColor: [255, 244, 184], textColor: [17, 17, 17], fontStyle: "bold" },
      columnStyles: {
        3: { halign: "right" }, 4: { halign: "right" },
        5: { halign: "right" }, 6: { halign: "right" },
      },
      margin: { left: 30, right: 30 },
    });
    y = (doc as any).lastAutoTable.finalY + 14;
    // Nota: alguns órgãos (ex.: PGE/Dívida Ativa) não discriminam multa/juros
    // — o "Total" já vem atualizado pelo órgão.
    if (grouped[orgao].some((d) => d.valorJaAtualizado)) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100);
      const nota =
        "Observação: os valores marcados como “incluso” já estão atualizados pelo órgão, " +
        "com multa e juros embutidos no Total.";
      const linhas = doc.splitTextToSize(nota, W - 60);
      doc.text(linhas, 30, y);
      y += linhas.length * 10 + 6;
      doc.setTextColor(20);
      doc.setFont("helvetica", "normal");
    }
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 60;
    }
  }

  if (rel.parcelamentos.length) {
    if (y > doc.internal.pageSize.getHeight() - 200) { doc.addPage(); y = 60; }
    autoTable(doc, {
      startY: y,
      head: [["Parcelamentos Ativos"]],
      body: [],
      theme: "plain",
      headStyles: { fillColor: [255, 204, 0], textColor: [17, 17, 17], fontStyle: "bold", fontSize: 11 },
      margin: { left: 30, right: 30 },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY,
      head: [["Órgão", "Identificador", "Modalidade", "Parc. atraso", "Valor atraso", "Situação"]],
      body: rel.parcelamentos.map((p) => [
        orgaoLabel(p.orgao), p.identificador, p.modalidade || "-",
        p.parcelasEmAtraso ?? "-",
        p.valorEmAtraso != null ? fmtBRL(p.valorEmAtraso) : "-",
        p.situacao || "-",
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [17, 17, 17], textColor: [255, 204, 0] },
      margin: { left: 30, right: 30 },
    });
  }

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(255, 204, 0);
    doc.setLineWidth(2);
    doc.line(30, H - 36, W - 30, H - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Econ Escritório Contábil Ltda", 30, H - 20);
    doc.text(`Página ${i}/${pageCount}`, W - 30, H - 20, { align: "right" });
  }

  doc.save(`Endividamento_${(rel.cadastro.cnpj || "cliente").replace(/\D/g, "")}.pdf`);
}
