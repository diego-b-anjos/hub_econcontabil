import { fontesPorTributo, TRIBUTOS, type Esfera, type Obrigacao } from "@/data/tributos";
import {
  PDF_DARK,
  PDF_GOLD,
  drawApresentacaoHeader,
  paginate,
} from "@/lib/pdf-style";

const TIPO_LABEL: Record<Esfera, string> = {
  federal: "Federal",
  estadual: "Estadual",
  municipal: "Municipal",
  trabalhista: "Trabalhista",
};

const MES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface LinhaExport {
  Mes: string;
  Dia: number;
  Esfera: string;
  Obrigação: string;
  Ente: string;
  "Tributos vinculados": string;
  Descrição: string;
  "Regra de vencimento": string;
  "Embasamento legal": string;
  "Fonte no Hub": string;
  Regimes: string;
}

export function obrigacaoParaLinha(o: Obrigacao, mesNome: string): LinhaExport {
  const tributos = o.tributoIds.map((tid) => TRIBUTOS[tid]?.sigla).filter(Boolean).join(", ");
  const fontes = Array.from(
    new Set(o.tributoIds.flatMap((tid) => fontesPorTributo(tid).map((f) => f.nome))),
  ).join(" • ");
  return {
    Mes: mesNome,
    Dia: o.dia,
    Esfera: TIPO_LABEL[o.tipo],
    Obrigação: o.nome,
    Ente: o.ente || "—",
    "Tributos vinculados": tributos || "—",
    Descrição: o.descricao,
    "Regra de vencimento": o.regraVencimento || "—",
    "Embasamento legal": o.embasamento || "—",
    "Fonte no Hub": fontes || "—",
    Regimes: (o.regimes || []).join(", ") || "—",
  };
}

export interface ExportSecao {
  /** Mês 1..12 — usado só para o nome da aba/linha; pode repetir entre seções. */
  mes: number;
  obrigacoes: Obrigacao[];
}

export interface ExportOpts {
  titulo: string;
  subtitulo?: string;
  fileBase: string; // sem extensão
  secoes: ExportSecao[];
}

export async function exportarCalendarioPDF(opts: ExportOpts): Promise<void> {
  const total = opts.secoes.reduce((s, se) => s + se.obrigacoes.length, 0);
  if (!total) throw new Error("Nenhuma obrigação para exportar");
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  doc.text(opts.titulo, 10, 12);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  if (opts.subtitulo) doc.text(opts.subtitulo, 10, 18);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} · ECON Hub`, 10, opts.subtitulo ? 23 : 18);
  doc.setTextColor(0);

  let cursor = opts.subtitulo ? 28 : 23;
  for (const sec of opts.secoes) {
    if (!sec.obrigacoes.length) continue;
    const mesNome = MES_NOMES[sec.mes - 1];
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.setFillColor(241, 245, 249);
    doc.rect(8, cursor, 281, 6, "F");
    doc.text(`${mesNome} — ${sec.obrigacoes.length} obrigação(ões)`, 10, cursor + 4);
    cursor += 8;
    const linhas = sec.obrigacoes.map((o) => obrigacaoParaLinha(o, mesNome));
    autoTable(doc, {
      startY: cursor,
      head: [["Dia", "Esfera", "Obrigação", "Tributos", "Vencimento", "Embasamento legal", "Fonte"]],
      body: linhas.map((l) => [
        String(l.Dia), l.Esfera,
        `${l.Obrigação}${l.Ente !== "—" ? `\n${l.Ente}` : ""}`,
        l["Tributos vinculados"], l["Regra de vencimento"], l["Embasamento legal"], l["Fonte no Hub"],
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.5, valign: "top" },
      headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 22 },
        2: { cellWidth: 55 },
        3: { cellWidth: 35 },
        4: { cellWidth: 50 },
        5: { cellWidth: 60 },
        6: { cellWidth: 35 },
      },
      margin: { left: 8, right: 8 },
    });
    // @ts-expect-error autotable injects lastAutoTable
    cursor = (doc as any).lastAutoTable.finalY + 6;
    if (cursor > 190 && sec !== opts.secoes[opts.secoes.length - 1]) {
      doc.addPage();
      cursor = 12;
    }
  }
  doc.save(`${opts.fileBase}.pdf`);
}

export async function exportarCalendarioExcel(opts: ExportOpts): Promise<void> {
  const total = opts.secoes.reduce((s, se) => s + se.obrigacoes.length, 0);
  if (!total) throw new Error("Nenhuma obrigação para exportar");
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();
  for (const sec of opts.secoes) {
    if (!sec.obrigacoes.length) continue;
    const mesNome = MES_NOMES[sec.mes - 1];
    const linhas = sec.obrigacoes.map((o) => {
      const l = obrigacaoParaLinha(o, mesNome);
      // Para abas mensais, removemos a coluna Mes (redundante)
      const { Mes: _omit, ...rest } = l;
      return rest;
    });
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 35 }, { wch: 25 }, { wch: 22 },
      { wch: 60 }, { wch: 28 }, { wch: 45 }, { wch: 22 }, { wch: 22 },
    ];
    let nome = mesNome.slice(0, 28);
    let n = 2;
    while (usados.has(nome)) nome = `${mesNome.slice(0, 25)}_${n++}`;
    usados.add(nome);
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  XLSX.writeFile(wb, `${opts.fileBase}.xlsx`);
}

export const MES_NOMES_EXPORT = MES_NOMES;

// ============================================================================
// PDF "Apenas obrigações" — sem agrupamento por mês, layout Apresentação
// ============================================================================

export interface ClienteHeaderInfo {
  nome: string;
  cnpj?: string | null;
  municipio?: string | null;
  uf?: string | null;
  taxRegime?: string | null;
}

export interface ExportObrigacoesOpts {
  cliente: ClienteHeaderInfo | null;
  obrigacoes: Obrigacao[];
  fileBase: string;
  /** Critério de ordenação: por esfera (default) ou por nome. */
  ordenarPor?: "esfera" | "nome";
  contadorNome?: string;
  contadorCrc?: string;
}

const REGIME_LABEL_PDF: Record<string, string> = {
  SN: "Simples Nacional",
  LP: "Lucro Presumido",
  LR: "Lucro Real",
  MEI: "MEI",
};

const ESFERA_ORDEM: Record<Esfera, number> = {
  federal: 1, estadual: 2, municipal: 3, trabalhista: 4,
};

export async function exportarObrigacoesPDF(opts: ExportObrigacoesOpts): Promise<void> {
  if (!opts.obrigacoes.length) throw new Error("Nenhuma obrigação selecionada");
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;

  const ordenadas = [...opts.obrigacoes].sort((a, b) => {
    if ((opts.ordenarPor || "esfera") === "esfera") {
      const oa = ESFERA_ORDEM[a.tipo] - ESFERA_ORDEM[b.tipo];
      if (oa !== 0) return oa;
    }
    return a.nome.localeCompare(b.nome);
  });

  const tituloPdf = "Calendário Fiscal — Obrigações Selecionadas";
  let subtitulo: string | undefined;
  if (opts.cliente) {
    const c = opts.cliente;
    const partes = [c.nome];
    if (c.cnpj) partes.push(`CNPJ ${c.cnpj}`);
    if (c.municipio && c.uf) partes.push(`${c.municipio}/${c.uf}`);
    if (c.taxRegime) partes.push(REGIME_LABEL_PDF[c.taxRegime] || c.taxRegime);
    subtitulo = partes.join("  ·  ");
  }
  const headerOpts = {
    titulo: tituloPdf,
    subtitulo,
    dataDireita: new Date().toLocaleDateString("pt-BR"),
  };
  const startY = drawApresentacaoHeader(doc, headerOpts);

  const linhas = ordenadas.map((o) => {
    const tributos = o.tributoIds.map((tid) => TRIBUTOS[tid]?.sigla).filter(Boolean).join(", ");
    const fontes = Array.from(
      new Set(o.tributoIds.flatMap((tid) => fontesPorTributo(tid).map((f) => f.nome))),
    ).join(" • ");
    const venc = o.regraVencimento || `Dia ${o.dia}`;
    const ente = o.ente ? ` (${o.ente})` : "";
    return [
      TIPO_LABEL[o.tipo],
      `${o.nome}${ente}`,
      tributos || "—",
      venc,
      o.embasamento || "—",
      fontes || "—",
    ];
  });

  autoTable(doc, {
    startY: startY + 4,
    head: [["Esfera", "Obrigação", "Tributos", "Vencimento", "Embasamento legal", "Fonte no Hub"]],
    body: linhas,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2, valign: "top" },
    headStyles: {
      fillColor: PDF_DARK,
      textColor: PDF_GOLD,
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 70 },
      2: { cellWidth: 36 },
      3: { cellWidth: 42 },
      4: { cellWidth: 65 },
      5: { cellWidth: 38 },
    },
    margin: { left: M, right: M, top: 28, bottom: 18 },
    didDrawPage: (data) => {
      // Página 2+ recebe o mesmo cabeçalho dourado para manter o padrão visual
      if (data.pageNumber > 1) {
        drawApresentacaoHeader(doc, headerOpts);
      }
    },
  });

  // Assinatura — Contador responsável
  if (opts.contadorNome) {
    const H = doc.internal.pageSize.getHeight();
    // @ts-expect-error autotable injects lastAutoTable
    let y = (doc as any).lastAutoTable.finalY + 8;
    if (y > H - 25) { doc.addPage(); y = drawApresentacaoHeader(doc, headerOpts) + 6; }
    doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...PDF_DARK);
    doc.text("Contador responsável:", M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
    doc.text(opts.contadorNome, M + 48, y);
    if (opts.contadorCrc) doc.text(`CRC: ${opts.contadorCrc}`, M, y + 5);
    doc.text(
      `Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
      W - M, y + 5, { align: "right" },
    );
  }

  paginate(doc);
  doc.save(`${opts.fileBase}.pdf`);
}
