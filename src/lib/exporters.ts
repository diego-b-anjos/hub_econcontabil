// Exportação de relatórios PDF e Excel
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  SimulationResult,
  SimulationInput,
  formatBRL,
  formatPct,
  MONTH_NAMES,
  ANNEX_LABELS,
} from "./tax-engine";
import econLogo from "@/assets/econ-logo.png";

interface ExportMeta {
  simulationName: string;
  clientName?: string;
  companyName?: string; // razão social/empresa para cabeçalho
  cnpj?: string;
  contadorName?: string; // mantido para compatibilidade, NÃO é mais exibido
  year: number;
}

export type ExportLayout = "resumido" | "detalhado" | "declaracao";

export interface ExportSections {
  identificacao?: boolean;
  resumo?: boolean;
  recomendacao?: boolean;
  graficos?: boolean;
  tabelaMensal?: boolean;
  detalhamentoSN?: boolean;
  detalhamentoLP?: boolean;
  baseLegal?: boolean;
  // === Seções específicas do layout "declaracao" ===
  cabecalhoDeclaracao?: boolean;   // identificação institucional do contador
  textoDeclaratorio?: boolean;     // parágrafo "Declaro para os devidos fins..."
  tabelaFaturamento?: boolean;     // tabela mensal × acumulado
  assinaturas?: boolean;           // bloco de assinaturas (contador + sócio)
}

export interface ExportOptions {
  /** Quantidade de meses a exibir nas tabelas (a partir do último). Default: todos. */
  monthsLimit?: number;
  /** Imagens base64 dos gráficos para incluir no PDF. */
  charts?: { title: string; image: string }[];
  /** Seções a exportar (todas por padrão, conforme layout). */
  sections?: ExportSections;
  /** Cidade emitida na declaração. */
  cidadeEmissao?: string;
  /** Nome do sócio/representante para assinatura. */
  socioNome?: string;
  /** CPF do sócio. */
  socioCPF?: string;
  /** Nome do contador para assinatura. */
  contadorNome?: string;
  /** CPF do contador. */
  contadorCPF?: string;
  /** CRC do contador. */
  contadorCRC?: string;
}

// Cabeçalho/rodapé/paleta institucional vivem na seção do Trimestral mais abaixo
// (drawTrimHeader, drawTrimFooter, drawAllTrimFooters, trimSectionTitle, TBRAND).
// O exportPDF abaixo reaproveita essas mesmas primitivas.

export async function exportPDF(
  input: SimulationInput,
  result: SimulationResult,
  meta: ExportMeta,
  layout: ExportLayout | boolean,
  options: ExportOptions = {}
) {
  // Compat: layout boolean → "detalhado" | "resumido"
  const lay: ExportLayout =
    typeof layout === "boolean" ? (layout ? "detalhado" : "resumido") : layout;

  // Defaults de seções por layout
  const def: Required<ExportSections> = {
    identificacao: lay !== "declaracao",
    resumo: lay !== "declaracao",
    recomendacao: lay !== "declaracao",
    graficos: lay === "detalhado",
    tabelaMensal: lay === "resumido",
    detalhamentoSN: lay === "detalhado",
    detalhamentoLP: lay === "detalhado",
    baseLegal: lay === "detalhado",
    cabecalhoDeclaracao: lay === "declaracao",
    textoDeclaratorio: lay === "declaracao",
    tabelaFaturamento: lay === "declaracao",
    assinaturas: lay === "declaracao",
  };
  const s: Required<ExportSections> = { ...def, ...(options.sections || {}) };

  // Template institucional ECON — mesma base do Relatório Trimestral
  // Unidade: mm | A4 | margens laterais 10mm
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const MARGIN = 10;
  const logo = await loadImageDataURLTrim(econLogo);

  const showSN = input.compareMode !== "lp";
  const showLP = input.compareMode !== "sn";
  const isCompare = input.compareMode === "compare";

  // Títulos
  const titleMap: Record<ExportLayout, string> = {
    resumido: "Comparativo Tributário — Resumido",
    detalhado: "Comparativo Tributário — Detalhado",
    declaracao: "Declaração de Faturamento",
  };
  const baseLineDefault = isCompare
    ? "Simples Nacional × Lucro Presumido · LC nº 123/2006"
    : showSN
    ? "Simples Nacional · LC nº 123/2006"
    : "Lucro Presumido · Lei nº 9.249/1995";
  // Para a Declaração de Faturamento, não exibimos "Simples Nacional × Lucro Presumido"
  const baseLine = lay === "declaracao" ? "" : baseLineDefault;

  const company = meta.companyName || meta.clientName || "—";

  // Filtra meses se monthsLimit informado (últimos N)
  const monthsToShow =
    options.monthsLimit && options.monthsLimit > 0 && options.monthsLimit < result.months.length
      ? result.months.slice(-options.monthsLimit)
      : result.months;
  const isFiltered = monthsToShow.length !== result.months.length;
  // Período dinâmico exibido no cabeçalho — reflete a seleção do usuário
  const periodLabel = isFiltered
    ? `${MONTH_NAMES[monthsToShow[0].month - 1]} a ${MONTH_NAMES[monthsToShow[monthsToShow.length - 1].month - 1]}/${meta.year}`
    : `Ano-base ${meta.year}`;
  const periodNote = isFiltered
    ? `Período: ${MONTH_NAMES[monthsToShow[0].month - 1]} a ${MONTH_NAMES[monthsToShow[monthsToShow.length - 1].month - 1]}/${meta.year}`
    : `Ano-base: ${meta.year}`;

  // ===========================================================
  //  Layout "Declaração de Faturamento" — modelo do contador
  // ===========================================================
  if (lay === "declaracao") {
    if (s.cabecalhoDeclaracao) {
      drawTrimHeader(doc, logo, periodLabel, company, meta.cnpj || "—", titleMap[lay], baseLine);
    }
    let dy = TRIM_HEADER_BOTTOM_Y + 8;
    doc.setTextColor(...TBRAND.dark);

    if (s.textoDeclaratorio) {
      dy += 3;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const txt =
        "Declaro para os devidos fins e a quem possa interessar que a empresa acima citada, " +
        "apresentou no período correspondente o seguinte faturamento:";
      const lines = doc.splitTextToSize(txt, pageW - MARGIN * 2);
      doc.text(lines, MARGIN, dy);
      dy += lines.length * 5 + 3;
    }

    if (s.tabelaFaturamento) {
      let acumulado = 0;
      const rows = monthsToShow.map((m) => {
        acumulado += m.revenue;
        return [
          `${MONTH_NAMES[m.month - 1]}/${meta.year}`,
          fmtBRLTrim(m.revenue),
          fmtBRLTrim(acumulado),
        ];
      });
      autoTable(doc, {
        startY: dy,
        head: [["Mês / Ano", "Faturamento Mensal", "Faturamento Acumulado"]],
        body: rows,
        foot: [["Total", "", fmtBRLTrim(acumulado)]],
        margin: { left: MARGIN, right: MARGIN },
        styles: { font: "helvetica", lineColor: TBRAND.grayLine, lineWidth: 0.15, cellPadding: 3, fontSize: 10 },
        headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, halign: "center" },
        bodyStyles: { halign: "right", valign: "middle" },
        footStyles: { fillColor: TBRAND.gold, textColor: TBRAND.dark, fontStyle: "bold", halign: "right" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: TBRAND.dark } },
        alternateRowStyles: { fillColor: [250, 249, 245] },
      });
      dy = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : dy + 80;
    }

    if (s.assinaturas) {
      const cidade = options.cidadeEmissao || "—";
      const dataExt = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...TBRAND.dark);
      doc.text(`${cidade}, ${dataExt}.`, pageW - MARGIN, dy, { align: "right" });
      dy += 16;

      const half = (pageW - MARGIN * 2) / 2 - 4;
      const drawSign = (x: number, nome: string, linhas: (string | undefined)[]) => {
        doc.setDrawColor(...TBRAND.dark);
        doc.setLineWidth(0.3);
        doc.line(x, dy, x + half, dy);
        let ly = dy + 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(nome || "—", x + half / 2, ly, { align: "center" });
        ly += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        for (const l of linhas) {
          if (!l) continue;
          doc.text(l, x + half / 2, ly, { align: "center" });
          ly += 3.8;
        }
      };

      drawSign(MARGIN, options.contadorNome || meta.contadorName || "ECON ESCRITÓRIO CONTÁBIL LTDA", [
        "Contador",
        options.contadorCPF ? `CPF: ${options.contadorCPF}` : undefined,
        options.contadorCRC ? `CRC: ${options.contadorCRC}` : undefined,
      ]);
      drawSign(MARGIN + half + 8, options.socioNome || "—", [
        "Sócio(a) / Representante",
        options.socioCPF ? `CPF: ${options.socioCPF}` : undefined,
      ]);
    }

    drawAllTrimFooters(doc);
    doc.save(`Declaracao_Faturamento_${(meta.companyName || meta.simulationName).replace(/[^\w\d-]+/g, "_")}.pdf`);
    return;
  }

  // Cabeçalho institucional (mesmo do Trimestral)
  drawTrimHeader(doc, logo, periodLabel, company, meta.cnpj || "—", titleMap[lay], baseLine);
  let y = TRIM_HEADER_BOTTOM_Y;

  // ===== Identificação =====
  if (s.identificacao) {
    trimSectionTitle(doc, y, titleMap[lay], baseLine);
    y += 14;

    doc.setTextColor(...TBRAND.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(meta.simulationName, MARGIN, y);
    y += 5.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TBRAND.gray);
    doc.text(periodNote, MARGIN, y);
    y += 4.5;

    const modeLabel =
      input.compareMode === "compare"
        ? "Comparativo Simples Nacional × Lucro Presumido"
        : input.compareMode === "sn"
        ? "Apenas Simples Nacional"
        : "Apenas Lucro Presumido";
    doc.text(`Modo: ${modeLabel}`, MARGIN, y);
    y += 4.5;

    if (showSN) {
      doc.text(
        `Regime SN: ${ANNEX_LABELS[input.annex]}${input.autoFatorR ? " (Fator R automático III/V)" : ""}`,
        MARGIN, y,
      );
      y += 4.5;
    }
    if (showLP) {
      doc.text(
        `Lucro Presumido: presunção IRPJ ${formatPct(input.presumptionRate, 0)} | CSLL ${formatPct(input.cssllPresumptionRate, 0)} | ISS ${formatPct(input.issRate, 2)} | ICMS ${formatPct(input.icmsRate, 2)}`,
        MARGIN, y, { maxWidth: pageW - MARGIN * 2 },
      );
      y += 4.5;
    }
    y += 3;
  }

  // Totais filtrados
  const tFiltered = (() => {
    const sum = (k: keyof (typeof monthsToShow)[0]) =>
      monthsToShow.reduce((acc, m) => acc + (m[k] as number), 0);
    return {
      revenue: sum("revenue"),
      snDAS: sum("snTax"),
      snTotal: sum("totalSN"),
      lpTotal: sum("totalLP"),
    };
  })();
  const t = result.totals;
  const better = t.bestRegime;
  const tDisp = isFiltered
    ? tFiltered
    : { revenue: t.revenue, snDAS: t.snDAS, snTotal: t.snTotal, lpTotal: t.lpTotal };

  // ===== Cards de Resumo (mesmo padrão da capa Trimestral) =====
  if (s.resumo) {
    const burdenSN = tDisp.revenue > 0 ? tDisp.snTotal / tDisp.revenue : 0;
    const burdenLP = tDisp.revenue > 0 ? tDisp.lpTotal / tDisp.revenue : 0;
    const boxes: { label: string; value: string; sub?: string; highlight?: boolean }[] = [
      { label: "RECEITA TOTAL", value: fmtBRLTrim(tDisp.revenue) },
    ];
    if (showSN)
      boxes.push({
        label: "TOTAL SIMPLES NACIONAL",
        value: fmtBRLTrim(tDisp.snTotal),
        sub: `Carga: ${formatPct(burdenSN, 2)}`,
        highlight: isCompare && better === "SN",
      });
    if (showLP)
      boxes.push({
        label: "TOTAL LUCRO PRESUMIDO",
        value: fmtBRLTrim(tDisp.lpTotal),
        sub: `Carga: ${formatPct(burdenLP, 2)}`,
        highlight: isCompare && better === "LP",
      });

    const gap = 4;
    const cardH = 26;
    const cardW = (pageW - MARGIN * 2 - gap * (boxes.length - 1)) / boxes.length;
    boxes.forEach((b, i) => {
      const x = MARGIN + i * (cardW + gap);
      if (b.highlight) {
        doc.setFillColor(...TBRAND.gold);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
        doc.setTextColor(...TBRAND.dark);
      } else {
        doc.setFillColor(...TBRAND.dark);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
        doc.setTextColor(...TBRAND.gold);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(b.label, x + 4, y + 5.5);

      doc.setFontSize(13);
      doc.setTextColor(...(b.highlight ? TBRAND.dark : TBRAND.white));
      doc.text(b.value, x + 4, y + 14);

      if (b.sub) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...(b.highlight ? TBRAND.dark : ([220, 220, 220] as [number, number, number])));
        doc.text(b.sub, x + 4, y + 21);
      }
    });
    y += cardH + 6;
  }

  // ===== Banner de ECONOMIA =====
  if (s.recomendacao && isCompare) {
    const worstTotal = Math.max(tDisp.snTotal, tDisp.lpTotal);
    const savingAbs = Math.abs(tDisp.lpTotal - tDisp.snTotal);
    const savingPct = worstTotal > 0 ? savingAbs / worstTotal : 0;
    const burdenPctBest = tDisp.revenue > 0 ? (better === "SN" ? tDisp.snTotal : tDisp.lpTotal) / tDisp.revenue : 0;
    const monthlyAvg = monthsToShow.length > 0 ? savingAbs / monthsToShow.length : 0;

    const bannerH = 32;
    doc.setFillColor(...TBRAND.goldSoft);
    doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, bannerH, 2, 2, "F");
    doc.setDrawColor(...TBRAND.gold);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, bannerH, 2, 2, "S");

    doc.setFillColor(...TBRAND.gold);
    doc.rect(MARGIN, y, 1.5, bannerH, "F");

    doc.setTextColor(...TBRAND.dark);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ECONOMIA ANUAL ESTIMADA", MARGIN + 5, y + 6);

    doc.setFontSize(16);
    doc.text(fmtBRLTrim(savingAbs), MARGIN + 5, y + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const msg = `Optando pelo ${better === "SN" ? "SIMPLES NACIONAL" : "LUCRO PRESUMIDO"}, a empresa economiza ${formatPct(savingPct, 1)} (média de ${fmtBRLTrim(monthlyAvg)}/mês). Carga tributária: ${formatPct(burdenPctBest, 2)} sobre a receita.`;
    const msgLines = doc.splitTextToSize(msg, pageW - MARGIN * 2 - 50);
    doc.text(msgLines, MARGIN + 5, y + 21);

    // Bloco % à direita
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TBRAND.dark);
    doc.setFontSize(7);
    doc.text("REDUÇÃO", pageW - MARGIN - 4, y + 8, { align: "right" });
    doc.setFontSize(20);
    doc.text(formatPct(savingPct, 1), pageW - MARGIN - 4, y + 20, { align: "right" });

    y += bannerH + 6;
  }

  // ===== Tabela mensal (resumida) — usada por "resumido" e "declaracao" =====
  if (s.tabelaMensal && lay !== "detalhado") {
    const cols = isCompare
      ? ["Mês", "Receita", "DAS", "Total SN", "Total LP", "Diferença", "Melhor"]
      : showSN
      ? ["Mês", "Receita", "Alíq. SN", "DAS", "Encargos", "Total SN"]
      : ["Mês", "Receita", "IRPJ+Adic.", "PIS/COFINS", "ISS/ICMS", "INSS Pat.", "Total LP"];

    const rows = monthsToShow.map((m) => {
      if (isCompare) {
        const diff = m.totalLP - m.totalSN;
        const b = diff > 0 ? "SN" : diff < 0 ? "LP" : "—";
        return [
          MONTH_NAMES[m.month - 1],
          fmtBRLTrim(m.revenue),
          fmtBRLTrim(m.snTax),
          fmtBRLTrim(m.totalSN),
          fmtBRLTrim(m.totalLP),
          fmtBRLTrim(Math.abs(diff)),
          b,
        ];
      }
      if (showSN) {
        return [
          MONTH_NAMES[m.month - 1],
          fmtBRLTrim(m.revenue),
          formatPct(m.snRate),
          fmtBRLTrim(m.snTax),
          fmtBRLTrim(m.payrollTaxes),
          fmtBRLTrim(m.totalSN),
        ];
      }
      return [
        MONTH_NAMES[m.month - 1],
        fmtBRLTrim(m.revenue),
        fmtBRLTrim(m.lpIRPJ + m.lpAdicional),
        fmtBRLTrim(m.lpPIS + m.lpCOFINS),
        fmtBRLTrim(m.lpISS + m.lpICMS),
        fmtBRLTrim(m.lpINSSPatronal),
        fmtBRLTrim(m.totalLP),
      ];
    });

    const totalRow: string[] = isCompare
      ? [
          "TOTAL",
          fmtBRLTrim(tDisp.revenue),
          fmtBRLTrim(tDisp.snDAS),
          fmtBRLTrim(tDisp.snTotal),
          fmtBRLTrim(tDisp.lpTotal),
          fmtBRLTrim(Math.abs(tDisp.lpTotal - tDisp.snTotal)),
          better,
        ]
      : showSN
      ? ["TOTAL", fmtBRLTrim(tDisp.revenue), "—", fmtBRLTrim(tDisp.snDAS), "", fmtBRLTrim(tDisp.snTotal)]
      : ["TOTAL", fmtBRLTrim(tDisp.revenue), "", "", "", "", fmtBRLTrim(tDisp.lpTotal)];

    autoTable(doc, {
      startY: y,
      head: [cols],
      body: rows,
      foot: [totalRow],
      margin: { left: MARGIN, right: MARGIN },
      styles: { font: "helvetica", lineColor: TBRAND.grayLine, lineWidth: 0.1, cellPadding: 2.2, fontSize: 8.5 },
      headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, fontSize: 8.5, halign: "center", cellPadding: 3 },
      bodyStyles: { halign: "right", valign: "middle" },
      footStyles: { fillColor: TBRAND.gold, textColor: TBRAND.dark, fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: TBRAND.dark } },
      alternateRowStyles: { fillColor: [250, 249, 245] },
    });
  }

  // ===== Detalhado =====
  if (lay === "detalhado") {
    if (s.baseLegal) {
      doc.setFontSize(8);
      doc.setTextColor(...TBRAND.gray);
      const legalLines = [
        showSN
          ? "Base legal: LC nº 123/2006 e alterações; tabelas dos Anexos I a V do Simples Nacional."
          : "",
        showLP ? "Lucro Presumido conforme Lei nº 9.249/1995." : "",
        "Este relatório é uma simulação. A escolha do regime deve considerar projeções de receita, folha e despesas dedutíveis.",
      ].filter(Boolean);
      legalLines.forEach((ln, i) => doc.text(ln, MARGIN, y + i * 4, { maxWidth: pageW - MARGIN * 2 }));
    }

    // Gráficos
    if (s.graficos && options.charts && options.charts.length > 0) {
      for (const ch of options.charts) {
        doc.addPage("a4", "landscape");
        drawTrimHeader(doc, logo, periodLabel, company, meta.cnpj || "—", titleMap[lay], baseLine);
        let ly = TRIM_HEADER_BOTTOM_Y;
        trimSectionTitle(doc, ly, ch.title, baseLine);
        ly += 12;
        const w = doc.internal.pageSize.getWidth() - MARGIN * 2;
        const h = w * 0.42;
        doc.addImage(ch.image, "PNG", MARGIN, ly, w, h);
      }
    }

    // Detalhamento SN
    if (s.detalhamentoSN && showSN) {
      doc.addPage("a4", "landscape");
      drawTrimHeader(doc, logo, periodLabel, company, meta.cnpj || "—", titleMap[lay], baseLine);
      let ly = TRIM_HEADER_BOTTOM_Y;
      trimSectionTitle(doc, ly, "Detalhamento Mensal — Simples Nacional", baseLine);
      ly += 12;
      autoTable(doc, {
        startY: ly,
        head: [["Mês", "Receita", "RBT12", "Fator R", "Anexo", "Alíq. efetiva", "DAS", "Encargos folha", "Total SN"]],
        body: monthsToShow.map((m) => [
          MONTH_NAMES[m.month - 1],
          fmtBRLTrim(m.revenue),
          fmtBRLTrim(m.rbt12),
          formatPct(m.fatorR),
          m.annexApplied,
          formatPct(m.snRate),
          fmtBRLTrim(m.snTax),
          fmtBRLTrim(m.payrollTaxes),
          fmtBRLTrim(m.totalSN),
        ]),
        foot: [["TOTAL", fmtBRLTrim(tDisp.revenue), "", "", "", "", fmtBRLTrim(tDisp.snDAS), "", fmtBRLTrim(tDisp.snTotal)]],
        margin: { left: MARGIN, right: MARGIN },
        styles: { font: "helvetica", lineColor: TBRAND.grayLine, lineWidth: 0.1, cellPadding: 2.2, fontSize: 8 },
        headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, fontSize: 8, halign: "center", cellPadding: 3 },
        bodyStyles: { halign: "right", valign: "middle" },
        footStyles: { fillColor: TBRAND.gold, textColor: TBRAND.dark, fontStyle: "bold", halign: "right" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: TBRAND.dark } },
        alternateRowStyles: { fillColor: [250, 249, 245] },
      });
    }

    // Detalhamento LP
    if (s.detalhamentoLP && showLP) {
      doc.addPage("a4", "landscape");
      drawTrimHeader(doc, logo, periodLabel, company, meta.cnpj || "—", titleMap[lay], baseLine);
      let ly = TRIM_HEADER_BOTTOM_Y;
      trimSectionTitle(doc, ly, "Detalhamento Mensal — Lucro Presumido", baseLine);
      ly += 12;
      autoTable(doc, {
        startY: ly,
        head: [["Mês", "Receita", "IRPJ", "Adicional", "CSLL", "PIS", "COFINS", "ISS", "ICMS", "IPI", "INSS Pat.", "Total LP"]],
        body: monthsToShow.map((m) => [
          MONTH_NAMES[m.month - 1],
          fmtBRLTrim(m.revenue),
          fmtBRLTrim(m.lpIRPJ),
          fmtBRLTrim(m.lpAdicional),
          fmtBRLTrim(m.lpCSLL),
          fmtBRLTrim(m.lpPIS),
          fmtBRLTrim(m.lpCOFINS),
          fmtBRLTrim(m.lpISS),
          fmtBRLTrim(m.lpICMS),
          fmtBRLTrim(m.lpIPI),
          fmtBRLTrim(m.lpINSSPatronal),
          fmtBRLTrim(m.totalLP),
        ]),
        foot: [
          (() => {
            const sum = (k: keyof (typeof monthsToShow)[0]) =>
              monthsToShow.reduce((acc, m) => acc + (m[k] as number), 0);
            return [
              "TOTAL",
              fmtBRLTrim(tDisp.revenue),
              fmtBRLTrim(sum("lpIRPJ")),
              fmtBRLTrim(sum("lpAdicional")),
              fmtBRLTrim(sum("lpCSLL")),
              fmtBRLTrim(sum("lpPIS")),
              fmtBRLTrim(sum("lpCOFINS")),
              fmtBRLTrim(sum("lpISS")),
              fmtBRLTrim(sum("lpICMS")),
              fmtBRLTrim(sum("lpIPI")),
              fmtBRLTrim(sum("lpINSSPatronal")),
              fmtBRLTrim(tDisp.lpTotal),
            ];
          })(),
        ],
        margin: { left: MARGIN, right: MARGIN },
        styles: { font: "helvetica", lineColor: TBRAND.grayLine, lineWidth: 0.1, cellPadding: 2.2, fontSize: 7.5 },
        headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, fontSize: 7.5, halign: "center", cellPadding: 3 },
        bodyStyles: { halign: "right", valign: "middle" },
        footStyles: { fillColor: TBRAND.gold, textColor: TBRAND.dark, fontStyle: "bold", halign: "right" },
        columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: TBRAND.dark } },
        alternateRowStyles: { fillColor: [250, 249, 245] },
      });
    }
  } else if (s.graficos && options.charts && options.charts.length > 0) {
    for (const ch of options.charts) {
      doc.addPage("a4", "landscape");
      drawTrimHeader(doc, logo, periodLabel, company, meta.cnpj || "—", titleMap[lay], baseLine);
      let ly = TRIM_HEADER_BOTTOM_Y;
      trimSectionTitle(doc, ly, ch.title, baseLine);
      ly += 12;
      const w = doc.internal.pageSize.getWidth() - MARGIN * 2;
      const h = w * 0.42;
      doc.addImage(ch.image, "PNG", MARGIN, ly, w, h);
    }
  }

  // Suprime variável de página não usada (mantém compat de assinatura)
  void pageH;

  drawAllTrimFooters(doc);
  doc.save(`${meta.simulationName.replace(/[^\w\d-]+/g, "_")}_${lay}.pdf`);
}

export function exportXLSX(
  input: SimulationInput,
  result: SimulationResult,
  meta: ExportMeta,
  layout: ExportLayout | boolean,
  options: ExportOptions = {}
) {
  const lay: ExportLayout =
    typeof layout === "boolean" ? (layout ? "detalhado" : "resumido") : layout;
  const wb = XLSX.utils.book_new();
  const allMonths = result.months;
  const months =
    options.monthsLimit && options.monthsLimit > 0 && options.monthsLimit < allMonths.length
      ? allMonths.slice(-options.monthsLimit)
      : allMonths;
  const isFiltered = months.length !== allMonths.length;
  const sumMo = (k: keyof (typeof months)[0]) => months.reduce((acc, m) => acc + (m[k] as number), 0);
  const t = isFiltered
    ? {
        revenue: sumMo("revenue"),
        snDAS: sumMo("snTax"),
        snTotal: sumMo("totalSN"),
        lpTotal: sumMo("totalLP"),
        bestRegime: sumMo("totalSN") <= sumMo("totalLP") ? ("SN" as const) : ("LP" as const),
        saving: Math.abs(sumMo("totalSN") - sumMo("totalLP")),
        avgFatorR: result.totals.avgFatorR,
        payrollGross: result.totals.payrollGross,
        payrollEmployerCost: result.totals.payrollEmployerCost,
      }
    : result.totals;
  const showSN = input.compareMode !== "lp";
  const showLP = input.compareMode !== "sn";

  // Resumo
  const summary: any[][] = [
    ["Econ Escritório Contábil Ltda — Comparativo Tributário"],
    [],
    ["Simulação", meta.simulationName],
    ["Empresa", meta.companyName || meta.clientName || ""],
    ["CNPJ", meta.cnpj || ""],
    ["Ano-base", meta.year],
    ...(isFiltered
      ? [["Período", `${MONTH_NAMES[months[0].month - 1]} a ${MONTH_NAMES[months[months.length - 1].month - 1]}`]]
      : []),
    ["Modo", input.compareMode === "compare" ? "Comparativo" : input.compareMode === "sn" ? "Apenas SN" : "Apenas LP"],
    ...(showSN ? [["Anexo SN", ANNEX_LABELS[input.annex]], ["Fator R automático", input.autoFatorR ? "Sim (III/V)" : "Não"]] : []),
    ...(showLP
      ? [
          ["Presunção IRPJ", input.presumptionRate],
          ["Presunção CSLL", input.cssllPresumptionRate],
          ["Alíquota ISS", input.issRate],
          ["Alíquota ICMS", input.icmsRate],
        ]
      : []),
    [],
    ["RESUMO"],
    ["Receita total", t.revenue],
    ...(showSN ? [["DAS (Simples)", t.snDAS], ["Total Simples Nacional", t.snTotal]] : []),
    ...(showLP ? [["Total Lucro Presumido", t.lpTotal]] : []),
    ...(input.compareMode === "compare"
      ? [
          ["Regime mais econômico", t.bestRegime === "SN" ? "Simples Nacional" : "Lucro Presumido"],
          ["Economia (R$)", t.saving],
          ["Economia (%)", Math.max(t.snTotal, t.lpTotal) > 0 ? t.saving / Math.max(t.snTotal, t.lpTotal) : 0],
          ["Carga tributária SN", t.revenue > 0 ? t.snTotal / t.revenue : 0],
          ["Carga tributária LP", t.revenue > 0 ? t.lpTotal / t.revenue : 0],
        ]
      : []),
    ...(showSN ? [["Fator R médio", t.avgFatorR]] : []),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 32 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

  // Detalhamento SN
  if (showSN) {
    const headers = ["Mês", "Receita", "RBT12", "Fator R", "Anexo", "Alíq. SN", "DAS", "Encargos folha", "Total SN"];
    const body = months.map((m) => [
      MONTH_NAMES[m.month - 1],
      m.revenue,
      m.rbt12,
      m.fatorR,
      m.annexApplied,
      m.snRate,
      m.snTax,
      m.payrollTaxes,
      m.totalSN,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body, ["TOTAL", t.revenue, "", "", "", "", t.snDAS, "", t.snTotal]]);
    ws["!cols"] = headers.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, "Simples Nacional");
  }

  // Detalhamento LP
  if (showLP) {
    const headers = ["Mês", "Receita", "IRPJ", "Adicional", "CSLL", "PIS", "COFINS", "ISS", "ICMS", "IPI", "INSS Pat.", "Total LP"];
    const body = months.map((m) => [
      MONTH_NAMES[m.month - 1],
      m.revenue,
      m.lpIRPJ,
      m.lpAdicional,
      m.lpCSLL,
      m.lpPIS,
      m.lpCOFINS,
      m.lpISS,
      m.lpICMS,
      m.lpIPI,
      m.lpINSSPatronal,
      m.lpTotal,
    ]);
    const sum = (k: keyof (typeof months)[0]) => months.reduce((acc, m) => acc + (m[k] as number), 0);
    const totalRow = [
      "TOTAL",
      t.revenue,
      sum("lpIRPJ"),
      sum("lpAdicional"),
      sum("lpCSLL"),
      sum("lpPIS"),
      sum("lpCOFINS"),
      sum("lpISS"),
      sum("lpICMS"),
      sum("lpIPI"),
      sum("lpINSSPatronal"),
      t.lpTotal,
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body, totalRow]);
    ws["!cols"] = headers.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, "Lucro Presumido");
  }

  // Comparativo (se aplicável)
  if (input.compareMode === "compare") {
    const headers = ["Mês", "Receita", "Total SN", "Total LP", "Diferença (LP - SN)", "Mais econômico"];
    const body = months.map((m) => {
      const diff = m.totalLP - m.totalSN;
      return [MONTH_NAMES[m.month - 1], m.revenue, m.totalSN, m.totalLP, diff, diff > 0 ? "SN" : diff < 0 ? "LP" : "—"];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "Comparativo");
  }

  XLSX.writeFile(wb, `${meta.simulationName.replace(/[^\w\d-]+/g, "_")}_${lay}.xlsx`);
}

// ====================== APURAÇÃO TRIMESTRAL (LC 224/2025) ======================
// Layout institucional ECON — replicado do projeto "Lucro Presumido - Adicional de 10%"
import type { Comparativo as ApuracaoComparativo, AtividadeTrim, TrimestreId } from "./apuracao-trim";
import { TRIMESTRES, FUNDAMENTACAO_LEGAL, fmtPctTrim, LIMITE_MAJORACAO } from "./apuracao-trim";

interface ExportTrimData {
  empresa: string;
  cnpj: string;
  trimestre: TrimestreId;
  comp: ApuracaoComparativo;
  atividades: AtividadeTrim[];
  receitaFinanceira: number;
  retencoes: { irrf: number; csll: number; pis: number; cofins: number };
  // capturas opcionais (não usadas — gráficos são renderizados via canvas para qualidade)
  chartBar?: string;
  chartPie?: string;
}

const fmtBRLTrim = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Paleta institucional ECON
export const TBRAND = {
  dark: [30, 26, 22] as [number, number, number],
  darkSoft: [55, 48, 40] as [number, number, number],
  gold: [247, 184, 49] as [number, number, number],
  goldSoft: [254, 243, 209] as [number, number, number],
  red: [200, 50, 50] as [number, number, number],
  redSoft: [253, 232, 232] as [number, number, number],
  gray: [110, 110, 110] as [number, number, number],
  graySoft: [245, 245, 245] as [number, number, number],
  grayLine: [220, 220, 220] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export async function loadImageDataURLTrim(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function truncateToWidthT(doc: jsPDF, txt: string, maxW: number): string {
  if (!txt) return "—";
  if (doc.getTextWidth(txt) <= maxW) return txt;
  let s = txt;
  while (s.length > 1 && doc.getTextWidth(s + "…") > maxW) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}

const TRIM_HEADER_H = 38;
const TRIM_HEADER_RULE = 1.2;
const TRIM_HEADER_AIR = 5;
const TRIM_HEADER_BOTTOM_Y = TRIM_HEADER_H + TRIM_HEADER_RULE + TRIM_HEADER_AIR;

export function drawTrimHeader(
  doc: jsPDF,
  logoData: string | null,
  tLabel: string,
  empresa: string,
  cnpj: string,
  titleOverride?: string,
  subtitleOverride?: string,
) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...TBRAND.dark);
  doc.rect(0, 0, w, TRIM_HEADER_H, "F");
  doc.setFillColor(...TBRAND.gold);
  doc.rect(0, TRIM_HEADER_H, w, TRIM_HEADER_RULE, "F");

  const logoBoxW = 24, logoBoxH = 16, logoBoxX = 8, logoBoxY = 4;
  if (logoData) {
    try {
      doc.setFillColor(...TBRAND.white);
      doc.roundedRect(logoBoxX, logoBoxY, logoBoxW, logoBoxH, 1.6, 1.6, "F");
      doc.addImage(logoData, "PNG", logoBoxX + 1.5, logoBoxY + 1.5, logoBoxW - 3, logoBoxH - 3);
    } catch { /* noop */ }
  }

  const leftX = logoBoxX + logoBoxW + 6;
  const rightX = w - 10;
  const usableW = rightX - leftX;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const wTri = doc.getTextWidth(tLabel || "");
  const triGap = 6;
  const titleMaxW = Math.max(40, usableW - wTri - triGap);

  const tituloFull = titleOverride || "Relatório de Apuração — IRPJ e CSLL";
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TBRAND.gold);
  let titleSize = 13;
  doc.setFontSize(titleSize);
  while (titleSize > 9 && doc.getTextWidth(tituloFull) > titleMaxW) {
    titleSize -= 0.5;
    doc.setFontSize(titleSize);
  }
  doc.text(truncateToWidthT(doc, tituloFull, titleMaxW), leftX, 11);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...TBRAND.gold);
  doc.text(truncateToWidthT(doc, tLabel, wTri + 2), rightX, 11, { align: "right" });

  const subFull = subtitleOverride || "Lucro Presumido · LC nº 224/2025 · IN RFB nº 2.305/2025";
  doc.setFont("helvetica", "normal");
  doc.setTextColor(225, 225, 225);
  let subSize = 8.5;
  doc.setFontSize(subSize);
  while (subSize > 6.5 && doc.getTextWidth(subFull) > usableW) {
    subSize -= 0.25;
    doc.setFontSize(subSize);
  }
  doc.text(truncateToWidthT(doc, subFull, usableW), leftX, 17.5);

  // Card empresa + CNPJ — só desenha quando há identificação real (relatórios por cliente)
  const hasEmpresa = !!(empresa && empresa.trim() && empresa.trim() !== "—");
  const hasCnpj = !!(cnpj && cnpj.trim() && cnpj.trim() !== "—");
  if (hasEmpresa || hasCnpj) {
    const cardX = 8, cardY = 21, cardW = w - 16, cardH = 14;
    doc.setFillColor(...TBRAND.darkSoft);
    doc.roundedRect(cardX, cardY, cardW, cardH, 1.5, 1.5, "F");
    doc.setFillColor(...TBRAND.gold);
    doc.rect(cardX, cardY, 1.2, cardH, "F");

    const padX = 5;
    const labelX = cardX + padX;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...TBRAND.gold);
    doc.text("EMPRESA", labelX, cardY + 4.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const cnpjLabelW = doc.getTextWidth("CNPJ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const cnpjValW = doc.getTextWidth(cnpj || "—");
    const cnpjBlockW = cnpjLabelW + 2 + cnpjValW;
    const empMaxW = cardW - padX * 2 - cnpjBlockW - 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(245, 245, 245);
    doc.text(truncateToWidthT(doc, (empresa || "—").trim(), empMaxW), labelX, cardY + 10);

    const cnpjRightX = cardX + cardW - padX;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...TBRAND.gold);
    doc.text("CNPJ", cnpjRightX, cardY + 4.5, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(245, 245, 245);
    doc.text(cnpj || "—", cnpjRightX, cardY + 10, { align: "right" });
  }
}

export function drawTrimFooter(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const di = doc as unknown as {
    internal: {
      getNumberOfPages: () => number;
      getCurrentPageInfo: () => { pageNumber: number };
    };
  };
  const totalPages = di.internal.getNumberOfPages();
  const current = di.internal.getCurrentPageInfo().pageNumber;

  doc.setDrawColor(...TBRAND.gold);
  doc.setLineWidth(0.4);
  doc.line(10, h - 14, w - 10, h - 14);
  doc.setFontSize(7.5);
  doc.setTextColor(...TBRAND.gray);
  doc.setFont("helvetica", "normal");
  doc.text("Econ Escritório Contábil Ltda", 10, h - 8);
  doc.text(`Página ${current} de ${totalPages}`, w - 10, h - 8, { align: "right" });
}

export function drawAllTrimFooters(doc: jsPDF) {
  const di = doc as unknown as { internal: { getNumberOfPages: () => number } };
  const total = di.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawTrimFooter(doc);
  }
}

export function trimSectionTitle(doc: jsPDF, y: number, label: string, sub?: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...TBRAND.dark);
  doc.rect(10, y, 3, 7, "F");
  doc.setTextColor(...TBRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(label, 16, y + 5.4);
  if (sub) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TBRAND.gray);
    doc.text(sub, w - 10, y + 5.4, { align: "right" });
  }
  doc.setDrawColor(...TBRAND.grayLine);
  doc.setLineWidth(0.2);
  doc.line(10, y + 8.5, w - 10, y + 8.5);
}

// =============== Gráficos via canvas ===============
function trimChartBarras(c: ApuracaoComparativo): string {
  const W = 1000, H = 420;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

  const groups = [
    { name: "IRPJ", sem: c.semMajoracao.irpjAPagar, com: c.comMajoracao.irpjAPagar },
    { name: "CSLL", sem: c.semMajoracao.csllAPagar, com: c.comMajoracao.csllAPagar },
    { name: "TOTAL", sem: c.semMajoracao.totalAPagar, com: c.comMajoracao.totalAPagar },
  ];
  const max = Math.max(...groups.flatMap((g) => [g.sem, g.com]), 1) * 1.15;
  const padL = 90, padR = 30, padT = 60, padB = 90;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx.fillStyle = "#1e1a16";
  ctx.font = "bold 22px Helvetica, Arial";
  ctx.textAlign = "left";
  ctx.fillText("Comparativo de Imposto a Recolher", padL - 10, 30);
  ctx.font = "13px Helvetica, Arial";
  ctx.fillStyle = "#666";
  ctx.fillText("Regra anterior (até 12/2025) × Regra nova (LC 224/2025)", padL - 10, 50);

  ctx.strokeStyle = "#eaeaea";
  ctx.fillStyle = "#777";
  ctx.font = "11px Helvetica, Arial";
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const y = padT + (chartH / 5) * i;
    const v = max * (1 - i / 5);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillText(v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`, padL - 8, y + 4);
  }

  const groupW = chartW / groups.length;
  const barW = groupW * 0.30;
  groups.forEach((g, i) => {
    const x0 = padL + groupW * i + (groupW - barW * 2 - 10) / 2;
    const semH = (g.sem / max) * chartH;
    const comH = (g.com / max) * chartH;
    ctx.fillStyle = "#9aa0a6";
    ctx.fillRect(x0, padT + chartH - semH, barW, semH);
    ctx.fillStyle = "#c83232";
    ctx.fillRect(x0 + barW + 10, padT + chartH - comH, barW, comH);
    ctx.fillStyle = "#1e1a16";
    ctx.font = "bold 11px Helvetica, Arial";
    ctx.textAlign = "center";
    ctx.fillText(fmtBRLTrim(g.sem), x0 + barW / 2, padT + chartH - semH - 6);
    ctx.fillText(fmtBRLTrim(g.com), x0 + barW + 10 + barW / 2, padT + chartH - comH - 6);
    ctx.fillStyle = "#1e1a16";
    ctx.font = "bold 14px Helvetica, Arial";
    ctx.fillText(g.name, x0 + barW + 5, padT + chartH + 22);
    if (g.sem > 0) {
      const pct = ((g.com - g.sem) / g.sem) * 100;
      ctx.font = "bold 11px Helvetica, Arial";
      ctx.fillStyle = "#c83232";
      ctx.fillText(`+ ${pct.toFixed(2)}%`, x0 + barW + 5, padT + chartH + 38);
    }
  });

  const lgY = H - 32;
  ctx.fillStyle = "#9aa0a6"; ctx.fillRect(padL, lgY, 14, 14);
  ctx.fillStyle = "#1e1a16"; ctx.font = "12px Helvetica, Arial"; ctx.textAlign = "left";
  ctx.fillText("Sem majoração (regra até 12/2025)", padL + 20, lgY + 11);
  ctx.fillStyle = "#c83232"; ctx.fillRect(padL + 290, lgY, 14, 14);
  ctx.fillStyle = "#1e1a16";
  ctx.fillText("Com majoração (LC 224/2025)", padL + 310, lgY + 11);

  return canvas.toDataURL("image/png");
}

function trimChartPizza(c: ApuracaoComparativo): string {
  const W = 800, H = 420;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#1e1a16";
  ctx.font = "bold 22px Helvetica, Arial";
  ctx.textAlign = "left";
  ctx.fillText("Impacto da Carga Tributária sobre a Receita", 30, 32);
  ctx.font = "13px Helvetica, Arial";
  ctx.fillStyle = "#666";
  ctx.fillText("Quanto da sua receita fica retido em tributos (IRPJ + CSLL)", 30, 52);

  const receita = c.comMajoracao.receitaTotal || 1;
  const impSem = c.semMajoracao.totalAPagar;
  const impAumento = Math.max(0, c.diffTotal);
  const liquido = Math.max(0, receita - impSem - impAumento);

  const slices = [
    { name: "Receita Líquida da empresa", value: liquido, color: "#1e1a16" },
    { name: "Imposto base (regra até 12/2025)", value: impSem, color: "#9aa0a6" },
    { name: "Aumento da majoração (LC 224/2025)", value: impAumento, color: "#c83232" },
  ].filter((s) => s.value > 0);

  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const cx = 220, cy = 230, r = 130;
  let start = -Math.PI / 2;
  slices.forEach((s) => {
    const ang = (s.value / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + ang); ctx.closePath();
    ctx.fillStyle = s.color; ctx.fill();
    start += ang;
  });
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();

  ctx.fillStyle = "#666"; ctx.font = "12px Helvetica, Arial"; ctx.textAlign = "center";
  ctx.fillText("Carga total", cx, cy - 14);
  ctx.fillStyle = "#c83232"; ctx.font = "bold 22px Helvetica, Arial";
  const cargaPct = ((impSem + impAumento) / receita) * 100;
  ctx.fillText(`${cargaPct.toFixed(2)}%`, cx, cy + 10);
  ctx.fillStyle = "#888"; ctx.font = "11px Helvetica, Arial";
  ctx.fillText("da receita", cx, cy + 26);

  let ly = 130;
  slices.forEach((s) => {
    ctx.fillStyle = s.color; ctx.fillRect(420, ly, 16, 16);
    ctx.fillStyle = "#1e1a16"; ctx.font = "bold 13px Helvetica, Arial"; ctx.textAlign = "left";
    ctx.fillText(s.name, 444, ly + 12);
    ctx.font = "12px Helvetica, Arial"; ctx.fillStyle = "#555";
    const pct = ((s.value / total) * 100).toFixed(2);
    ctx.fillText(`${fmtBRLTrim(s.value)}  ·  ${pct}%`, 444, ly + 30);
    ly += 60;
  });

  return canvas.toDataURL("image/png");
}

// =============== Capa executiva ===============
function drawTrimCapa(doc: jsPDF, logoData: string | null, data: ExportTrimData, tLabel: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  const headerH = 95;
  doc.setFillColor(...TBRAND.dark);
  doc.rect(0, 0, w, headerH, "F");
  doc.setFillColor(...TBRAND.gold);
  doc.rect(0, headerH, w, 2.5, "F");

  const logoW = 38, logoH = 26, textBlockW = 120;
  const totalBlockW = logoW + 8 + textBlockW;
  const blockX = (w - totalBlockW) / 2;
  const logoX = blockX, logoY = (headerH - logoH) / 2;
  const textX = logoX + logoW + 8;

  if (logoData) {
    try {
      doc.setFillColor(...TBRAND.white);
      doc.roundedRect(logoX, logoY, logoW, logoH, 2, 2, "F");
      doc.addImage(logoData, "PNG", logoX + 3, logoY + 2.5, logoW - 6, logoH - 5);
    } catch { /* noop */ }
  }

  const textCenterY = logoY + logoH / 2;
  doc.setTextColor(...TBRAND.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("RELATÓRIO EXECUTIVO", textX, textCenterY - 7);
  doc.setFontSize(18);
  doc.setTextColor(...TBRAND.white);
  doc.text("Apuração de IRPJ e CSLL", textX, textCenterY + 1);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TBRAND.gold);
  doc.text("Lucro Presumido — com majoração da base", textX, textCenterY + 8);
  doc.setFontSize(8.5);
  doc.setTextColor(220, 220, 220);
  doc.text("Fundamento: Lei Complementar nº 224/2025  ·  IN RFB nº 2.305/2025", textX, textCenterY + 14);

  // Bloco dados
  const boxY = 115, boxH = 42;
  doc.setFillColor(...TBRAND.graySoft);
  doc.roundedRect(15, boxY, w - 30, boxH, 2, 2, "F");
  doc.setDrawColor(...TBRAND.gold);
  doc.setLineWidth(0.6);
  doc.line(15, boxY, 15, boxY + boxH);

  const colLX = 22, colRX = w / 2 + 8, colW = w / 2 - 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...TBRAND.gray);
  doc.text("EMPRESA", colLX, boxY + 7);
  doc.text("PERÍODO DE APURAÇÃO", colRX, boxY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...TBRAND.dark);
  const empresaLines = doc.splitTextToSize(data.empresa || "—", colW);
  doc.text(empresaLines.slice(0, 2), colLX, boxY + 13);
  doc.text(tLabel, colRX, boxY + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...TBRAND.gray);
  doc.text("CNPJ", colLX, boxY + 27);
  doc.text("DATA DE EMISSÃO", colRX, boxY + 27);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...TBRAND.dark);
  doc.text(data.cnpj || "—", colLX, boxY + 33);
  doc.text(new Date().toLocaleDateString("pt-BR"), colRX, boxY + 33);

  // Cards de impacto
  const c = data.comp;
  const receita = c.comMajoracao.receitaTotal;
  const cargaCom = receita > 0 ? (c.comMajoracao.totalAPagar / receita) * 100 : 0;
  const cargaSem = receita > 0 ? (c.semMajoracao.totalAPagar / receita) * 100 : 0;

  const cardY = boxY + boxH + 8;
  const cardH = 34, gap = 5;
  const cardW = (w - 30 - 2 * gap) / 3;

  doc.setFillColor(...TBRAND.dark);
  doc.roundedRect(15, cardY, cardW, cardH, 2, 2, "F");
  doc.setTextColor(...TBRAND.gold);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TOTAL A RECOLHER", 20, cardY + 7);
  doc.setTextColor(...TBRAND.white);
  doc.setFontSize(17);
  doc.text(fmtBRLTrim(c.comMajoracao.totalAPagar), 20, cardY + 19);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 220, 220);
  doc.text(`Carga sobre a receita: ${cargaCom.toFixed(2)}%`, 20, cardY + 28);

  doc.setFillColor(...TBRAND.redSoft);
  doc.roundedRect(15 + cardW + gap, cardY, cardW, cardH, 2, 2, "F");
  doc.setDrawColor(...TBRAND.red);
  doc.setLineWidth(0.6);
  doc.roundedRect(15 + cardW + gap, cardY, cardW, cardH, 2, 2, "S");
  doc.setTextColor(...TBRAND.red);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("AUMENTO DA CARGA (R$)", 20 + cardW + gap, cardY + 7);
  doc.setFontSize(17);
  doc.text(`+ ${fmtBRLTrim(c.diffTotal)}`, 20 + cardW + gap, cardY + 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 30, 30);
  doc.text(`Versus regra anterior (até 12/2025)`, 20 + cardW + gap, cardY + 28);

  doc.setFillColor(...TBRAND.goldSoft);
  doc.roundedRect(15 + 2 * (cardW + gap), cardY, cardW, cardH, 2, 2, "F");
  doc.setDrawColor(...TBRAND.gold);
  doc.roundedRect(15 + 2 * (cardW + gap), cardY, cardW, cardH, 2, 2, "S");
  doc.setTextColor(...TBRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("AUMENTO DA CARGA (%)", 20 + 2 * (cardW + gap), cardY + 7);
  doc.setFontSize(17);
  doc.text(`+ ${fmtPctTrim(c.pctTotal)}`, 20 + 2 * (cardW + gap), cardY + 19);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`De ${cargaSem.toFixed(2)}% para ${cargaCom.toFixed(2)}% da receita`, 20 + 2 * (cardW + gap), cardY + 28);

  // Resumo
  const resY = cardY + cardH + 10;
  doc.setFillColor(...TBRAND.goldSoft);
  doc.roundedRect(15, resY, w - 30, 46, 2, 2, "F");
  doc.setDrawColor(...TBRAND.gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, resY, w - 30, 46, 2, 2, "S");

  doc.setTextColor(...TBRAND.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Em poucas palavras", 22, resY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const resumo =
    `Sobre uma receita de ${fmtBRLTrim(receita)} no ${tLabel}, sua empresa recolheria ${fmtBRLTrim(c.semMajoracao.totalAPagar)} ` +
    `pelas regras vigentes até dezembro/2025. Com a majoração instituída pela LC nº 224/2025, o valor passa a ${fmtBRLTrim(c.comMajoracao.totalAPagar)}, ` +
    `representando um aumento de ${fmtBRLTrim(c.diffTotal)} (${fmtPctTrim(c.pctTotal)}) na carga tributária. ` +
    `Em termos de receita, a tributação passa de ${cargaSem.toFixed(2)}% para ${cargaCom.toFixed(2)}%.`;
  const lines = doc.splitTextToSize(resumo, w - 44);
  doc.text(lines, 22, resY + 16);

  doc.setFontSize(8);
  doc.setTextColor(...TBRAND.gray);
  doc.text(
    "As páginas a seguir detalham o comparativo, a memória de cálculo e o embasamento legal aplicado.",
    w / 2, h - 22,
    { align: "center", maxWidth: w - 30 }
  );
}

export async function exportApuracaoTrimestralPDF(data: ExportTrimData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const tLabel = TRIMESTRES.find((t) => t.id === data.trimestre)?.label ?? "";

  const logoData = await loadImageDataURLTrim(econLogo);

  // ===== PÁGINA 1 — CAPA =====
  drawTrimCapa(doc, logoData, data, tLabel);

  // ===== PÁGINA 2 — VISÃO GRÁFICA =====
  doc.addPage();
  drawTrimHeader(doc, logoData, tLabel, data.empresa, data.cnpj);
  let y = TRIM_HEADER_BOTTOM_Y;
  trimSectionTitle(doc, y, "Visão Gráfica", "Comparativo IRPJ × CSLL e impacto na receita");
  y += 12;

  try {
    const img = trimChartBarras(data.comp);
    const imgW = w - 20;
    const imgH = imgW * (420 / 1000);
    doc.addImage(img, "PNG", 10, y, imgW, imgH);
    y += imgH + 6;
  } catch { /* noop */ }

  try {
    const img2 = trimChartPizza(data.comp);
    const imgW = w - 20;
    const imgH = imgW * (420 / 800);
    doc.addImage(img2, "PNG", 10, y, imgW, imgH);
  } catch { /* noop */ }

  // ===== PÁGINA 3 — COMPARATIVO DETALHADO =====
  doc.addPage();
  drawTrimHeader(doc, logoData, tLabel, data.empresa, data.cnpj);
  y = TRIM_HEADER_BOTTOM_Y;
  trimSectionTitle(doc, y, "Comparativo Detalhado", "Sem majoração × Com majoração");
  y += 12;

  const c = data.comp;

  autoTable(doc, {
    startY: y,
    head: [["INDICADOR", "Sem Majoração\n(até 12/2025)", "Com Majoração\n(novas regras)", "Diferença R$", "Aumento %"]],
    body: [
      [
        "Base de Cálculo IRPJ",
        fmtBRLTrim(c.semMajoracao.bcIRComFinanceira),
        fmtBRLTrim(c.comMajoracao.bcIRComFinanceira),
        fmtBRLTrim(c.comMajoracao.bcIRComFinanceira - c.semMajoracao.bcIRComFinanceira),
        fmtPctTrim(
          c.semMajoracao.bcIRComFinanceira > 0
            ? (c.comMajoracao.bcIRComFinanceira - c.semMajoracao.bcIRComFinanceira) / c.semMajoracao.bcIRComFinanceira
            : 0
        ),
      ],
      ["IRPJ a Pagar", fmtBRLTrim(c.semMajoracao.irpjAPagar), fmtBRLTrim(c.comMajoracao.irpjAPagar), `+ ${fmtBRLTrim(c.diffIRPJ)}`, `+ ${fmtPctTrim(c.pctIRPJ)}`],
      [
        "Base de Cálculo CSLL",
        fmtBRLTrim(c.semMajoracao.bcCSLLComFinanceira),
        fmtBRLTrim(c.comMajoracao.bcCSLLComFinanceira),
        fmtBRLTrim(c.comMajoracao.bcCSLLComFinanceira - c.semMajoracao.bcCSLLComFinanceira),
        fmtPctTrim(
          c.semMajoracao.bcCSLLComFinanceira > 0
            ? (c.comMajoracao.bcCSLLComFinanceira - c.semMajoracao.bcCSLLComFinanceira) / c.semMajoracao.bcCSLLComFinanceira
            : 0
        ),
      ],
      ["CSLL a Pagar", fmtBRLTrim(c.semMajoracao.csllAPagar), fmtBRLTrim(c.comMajoracao.csllAPagar), `+ ${fmtBRLTrim(c.diffCSLL)}`, `+ ${fmtPctTrim(c.pctCSLL)}`],
      ["TOTAL A RECOLHER", fmtBRLTrim(c.semMajoracao.totalAPagar), fmtBRLTrim(c.comMajoracao.totalAPagar), `+ ${fmtBRLTrim(c.diffTotal)}`, `+ ${fmtPctTrim(c.pctTotal)}`],
    ],
    margin: { left: 10, right: 10 },
    styles: { font: "helvetica", lineColor: TBRAND.grayLine, lineWidth: 0.1, cellPadding: 3 },
    headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, fontSize: 9, halign: "center", valign: "middle", cellPadding: 4 },
    bodyStyles: { fontSize: 9.5, valign: "middle" },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    columnStyles: {
      0: { fontStyle: "bold", textColor: TBRAND.dark, cellWidth: 50 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", textColor: TBRAND.red, fontStyle: "bold" },
      4: { halign: "right", textColor: TBRAND.red, fontStyle: "bold" },
    },
    didParseCell: (h) => {
      if (h.row.index === 4 && h.section === "body") {
        h.cell.styles.fillColor = TBRAND.gold;
        h.cell.styles.textColor = TBRAND.dark;
        h.cell.styles.fontStyle = "bold";
        h.cell.styles.fontSize = 10.5;
      }
      if ((h.row.index === 1 || h.row.index === 3) && h.section === "body" && h.column.index === 0) {
        h.cell.styles.fillColor = TBRAND.darkSoft;
        h.cell.styles.textColor = TBRAND.gold;
      }
    },
  });

  type AutoTableDoc = jsPDF & { lastAutoTable: { finalY: number } };
  y = (doc as AutoTableDoc).lastAutoTable.finalY + 8;

  doc.setFillColor(...TBRAND.graySoft);
  doc.roundedRect(10, y, w - 20, 22, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TBRAND.dark);
  doc.text("Como ler esta tabela", 14, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const help =
    "A coluna “Sem Majoração” representa o tributo que seria devido pelas regras vigentes até 31/12/2025. A coluna “Com Majoração” aplica o acréscimo de 10% sobre a presunção (LC 224/2025). As últimas colunas mostram o impacto absoluto (R$) e relativo (%) sobre a carga tributária trimestral.";
  doc.text(doc.splitTextToSize(help, w - 28), 14, y + 11);

  // ===== PÁGINA 4 — ATIVIDADES + RETENÇÕES =====
  doc.addPage();
  drawTrimHeader(doc, logoData, tLabel, data.empresa, data.cnpj);
  y = TRIM_HEADER_BOTTOM_Y;
  trimSectionTitle(doc, y, "Composição da Receita por Atividade");
  y += 12;

  autoTable(doc, {
    startY: y,
    head: [["Atividade", "Pres. IR", "Pres. CSLL", "Receita do Trimestre"]],
    body: [
      ...data.atividades.map((a) => [
        a.nome,
        `${a.presuncaoIR}%`,
        `${a.presuncaoCSLL}%`,
        fmtBRLTrim(a.receita),
      ]),
      [
        { content: "TOTAL", styles: { fontStyle: "bold", fillColor: TBRAND.gold, textColor: TBRAND.dark } },
        { content: "", styles: { fillColor: TBRAND.gold } },
        { content: "", styles: { fillColor: TBRAND.gold } },
        {
          content: fmtBRLTrim(data.atividades.reduce((s, a) => s + a.receita, 0)),
          styles: { fontStyle: "bold", halign: "right", fillColor: TBRAND.gold, textColor: TBRAND.dark },
        },
      ],
    ],
    margin: { left: 10, right: 10 },
    styles: { font: "helvetica", lineColor: TBRAND.grayLine, lineWidth: 0.1, cellPadding: 3 },
    headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, fontSize: 9, halign: "center", cellPadding: 4 },
    bodyStyles: { fontSize: 9.5 },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: "bold", textColor: TBRAND.dark },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });

  y = (doc as AutoTableDoc).lastAutoTable.finalY + 10;

  trimSectionTitle(doc, y, "Receita Financeira e Retenções na Fonte");
  y += 12;

  autoTable(doc, {
    startY: y,
    head: [["Item", "Valor (R$)"]],
    body: [
      ["Receita Financeira", fmtBRLTrim(data.receitaFinanceira)],
      ["IRRF Retido", fmtBRLTrim(data.retencoes.irrf)],
      ["CSLL Retida", fmtBRLTrim(data.retencoes.csll)],
      ["PIS Retido", fmtBRLTrim(data.retencoes.pis)],
      ["COFINS Retida", fmtBRLTrim(data.retencoes.cofins)],
    ],
    margin: { left: 10, right: 10 },
    styles: { font: "helvetica", lineColor: TBRAND.grayLine, lineWidth: 0.1, cellPadding: 3 },
    headStyles: { fillColor: TBRAND.dark, textColor: TBRAND.gold, fontSize: 9, halign: "left", cellPadding: 4 },
    bodyStyles: { fontSize: 9.5 },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    columnStyles: { 0: { fontStyle: "bold", textColor: TBRAND.dark }, 1: { halign: "right" } },
  });

  // ===== PÁGINA 5 — EMBASAMENTO LEGAL =====
  doc.addPage();
  drawTrimHeader(doc, logoData, tLabel, data.empresa, data.cnpj);
  y = TRIM_HEADER_BOTTOM_Y;
  trimSectionTitle(doc, y, "Embasamento Legal", "Fundamentação jurídica da majoração");
  y += 14;

  doc.setTextColor(...TBRAND.dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const legalLines = doc.splitTextToSize(
    FUNDAMENTACAO_LEGAL.replace("EMBASAMENTO LEGAL DA MAJORAÇÃO\n\n", ""),
    w - 24
  );
  doc.text(legalLines, 12, y);

  void LIMITE_MAJORACAO;

  drawAllTrimFooters(doc);
  doc.save(`Apuracao_${(data.cnpj || "empresa").replace(/\D/g, "")}_${data.trimestre}.pdf`);
}

// ====================== EXCEL — Apuração Trimestral ======================
type TCellStyle = NonNullable<XLSX.CellObject["s"]>;
function tStyled(v: string | number, s: TCellStyle, t: "s" | "n" = typeof v === "number" ? "n" : "s", z?: string): XLSX.CellObject {
  const cell: XLSX.CellObject = { v, t, s };
  if (z) cell.z = z;
  return cell;
}
const T_FMT_BRL = 'R$ #,##0.00;[Red]-R$ #,##0.00';
const T_FMT_PCT = '0.00%;[Red]-0.00%';
const T_STYLES = {
  title: { font: { name: "Calibri", sz: 16, bold: true, color: { rgb: "F7B831" } }, fill: { fgColor: { rgb: "1E1A16" } }, alignment: { horizontal: "center", vertical: "center" } } as TCellStyle,
  subtitle: { font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E1A16" } }, alignment: { horizontal: "center", vertical: "center" } } as TCellStyle,
  sectionHeader: { font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "1E1A16" } }, fill: { fgColor: { rgb: "F7B831" } }, alignment: { horizontal: "left", vertical: "center" } } as TCellStyle,
  tableHead: { font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "F7B831" } }, fill: { fgColor: { rgb: "1E1A16" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } } as TCellStyle,
  labelBold: { font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "1E1A16" } }, alignment: { horizontal: "left", vertical: "center" } } as TCellStyle,
  cell: { font: { name: "Calibri", sz: 10, color: { rgb: "1E1A16" } }, alignment: { horizontal: "right", vertical: "center" } } as TCellStyle,
  cellAlt: { font: { name: "Calibri", sz: 10, color: { rgb: "1E1A16" } }, fill: { fgColor: { rgb: "FAF9F5" } }, alignment: { horizontal: "right", vertical: "center" } } as TCellStyle,
  cellRed: { font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "C83232" } }, alignment: { horizontal: "right", vertical: "center" } } as TCellStyle,
  totalRow: { font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "1E1A16" } }, fill: { fgColor: { rgb: "F7B831" } }, alignment: { horizontal: "right", vertical: "center" } } as TCellStyle,
  totalLabel: { font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "1E1A16" } }, fill: { fgColor: { rgb: "F7B831" } }, alignment: { horizontal: "left", vertical: "center" } } as TCellStyle,
  infoLabel: { font: { name: "Calibri", sz: 9, bold: true, color: { rgb: "6E6E6E" } }, alignment: { horizontal: "left", vertical: "center" } } as TCellStyle,
  infoValue: { font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "1E1A16" } }, alignment: { horizontal: "left", vertical: "center" } } as TCellStyle,
  legal: { font: { name: "Calibri", sz: 10, color: { rgb: "1E1A16" } }, alignment: { horizontal: "left", vertical: "top", wrapText: true } } as TCellStyle,
  legalTitle: { font: { name: "Calibri", sz: 14, bold: true, color: { rgb: "F7B831" } }, fill: { fgColor: { rgb: "1E1A16" } }, alignment: { horizontal: "center", vertical: "center" } } as TCellStyle,
};

function tSetCell(ws: XLSX.WorkSheet, addr: string, cell: XLSX.CellObject) { ws[addr] = cell; }
function tEnsureRange(ws: XLSX.WorkSheet, lastCol: number, lastRow: number) {
  ws["!ref"] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: lastCol, r: lastRow } });
}

export function exportApuracaoTrimestralXLSX(data: ExportTrimData) {
  const c = data.comp;
  const tLabel = TRIMESTRES.find((t) => t.id === data.trimestre)?.label ?? "";
  const wb = XLSX.utils.book_new();
  const receita = c.comMajoracao.receitaTotal;
  const cargaCom = receita > 0 ? c.comMajoracao.totalAPagar / receita : 0;
  const cargaSem = receita > 0 ? c.semMajoracao.totalAPagar / receita : 0;

  // Aba 1
  const ws1: XLSX.WorkSheet = {};
  ws1["!cols"] = [{ wch: 38 }, { wch: 24 }, { wch: 24 }, { wch: 22 }, { wch: 16 }];
  ws1["!merges"] = []; ws1["!rows"] = [];

  tSetCell(ws1, "A1", tStyled("RELATÓRIO DE APURAÇÃO — IRPJ E CSLL", T_STYLES.title));
  ws1["!merges"]!.push({ s: { c: 0, r: 0 }, e: { c: 4, r: 0 } });
  ws1["!rows"]![0] = { hpt: 28 };
  tSetCell(ws1, "A2", tStyled("Lucro Presumido · LC nº 224/2025 · IN RFB nº 2.305/2025", T_STYLES.subtitle));
  ws1["!merges"]!.push({ s: { c: 0, r: 1 }, e: { c: 4, r: 1 } });
  ws1["!rows"]![1] = { hpt: 18 };

  tSetCell(ws1, "A4", tStyled("EMPRESA", T_STYLES.infoLabel));
  tSetCell(ws1, "B4", tStyled(data.empresa || "—", T_STYLES.infoValue));
  ws1["!merges"]!.push({ s: { c: 1, r: 3 }, e: { c: 4, r: 3 } });
  tSetCell(ws1, "A5", tStyled("CNPJ", T_STYLES.infoLabel));
  tSetCell(ws1, "B5", tStyled(data.cnpj || "—", T_STYLES.infoValue));
  tSetCell(ws1, "A6", tStyled("PERÍODO", T_STYLES.infoLabel));
  tSetCell(ws1, "B6", tStyled(tLabel, T_STYLES.infoValue));
  tSetCell(ws1, "A7", tStyled("RECEITA TOTAL DO TRIMESTRE", T_STYLES.infoLabel));
  tSetCell(ws1, "B7", tStyled(receita, T_STYLES.infoValue, "n", T_FMT_BRL));

  tSetCell(ws1, "A9", tStyled("COMPARATIVO DE TRIBUTAÇÃO", T_STYLES.sectionHeader));
  ws1["!merges"]!.push({ s: { c: 0, r: 8 }, e: { c: 4, r: 8 } });
  ws1["!rows"]![8] = { hpt: 22 };

  const heads = ["INDICADOR", "Sem Majoração\n(até 12/2025)", "Com Majoração\n(novas regras)", "Diferença R$", "Aumento %"];
  heads.forEach((h, i) => tSetCell(ws1, XLSX.utils.encode_cell({ c: i, r: 9 }), tStyled(h, T_STYLES.tableHead)));
  ws1["!rows"]![9] = { hpt: 30 };

  const rows: Array<[string, number, number, number, number, boolean]> = [
    ["Base de Cálculo IRPJ", c.semMajoracao.bcIRComFinanceira, c.comMajoracao.bcIRComFinanceira,
      c.comMajoracao.bcIRComFinanceira - c.semMajoracao.bcIRComFinanceira,
      c.semMajoracao.bcIRComFinanceira > 0 ? (c.comMajoracao.bcIRComFinanceira - c.semMajoracao.bcIRComFinanceira) / c.semMajoracao.bcIRComFinanceira : 0, false],
    ["IRPJ a Pagar", c.semMajoracao.irpjAPagar, c.comMajoracao.irpjAPagar, c.diffIRPJ, c.pctIRPJ, false],
    ["Base de Cálculo CSLL", c.semMajoracao.bcCSLLComFinanceira, c.comMajoracao.bcCSLLComFinanceira,
      c.comMajoracao.bcCSLLComFinanceira - c.semMajoracao.bcCSLLComFinanceira,
      c.semMajoracao.bcCSLLComFinanceira > 0 ? (c.comMajoracao.bcCSLLComFinanceira - c.semMajoracao.bcCSLLComFinanceira) / c.semMajoracao.bcCSLLComFinanceira : 0, false],
    ["CSLL a Pagar", c.semMajoracao.csllAPagar, c.comMajoracao.csllAPagar, c.diffCSLL, c.pctCSLL, false],
    ["TOTAL A RECOLHER", c.semMajoracao.totalAPagar, c.comMajoracao.totalAPagar, c.diffTotal, c.pctTotal, true],
  ];
  rows.forEach((row, idx) => {
    const r = 10 + idx;
    const isTotal = row[5];
    const labelStyle = isTotal ? T_STYLES.totalLabel : T_STYLES.labelBold;
    const numStyle = isTotal ? T_STYLES.totalRow : idx % 2 === 0 ? T_STYLES.cell : T_STYLES.cellAlt;
    const diffStyle = isTotal ? T_STYLES.totalRow : T_STYLES.cellRed;
    tSetCell(ws1, XLSX.utils.encode_cell({ c: 0, r }), tStyled(row[0], labelStyle));
    tSetCell(ws1, XLSX.utils.encode_cell({ c: 1, r }), tStyled(row[1], numStyle, "n", T_FMT_BRL));
    tSetCell(ws1, XLSX.utils.encode_cell({ c: 2, r }), tStyled(row[2], numStyle, "n", T_FMT_BRL));
    tSetCell(ws1, XLSX.utils.encode_cell({ c: 3, r }), tStyled(row[3], diffStyle, "n", T_FMT_BRL));
    tSetCell(ws1, XLSX.utils.encode_cell({ c: 4, r }), tStyled(row[4], diffStyle, "n", T_FMT_PCT));
  });

  const impactStart = 16;
  tSetCell(ws1, `A${impactStart + 1}`, tStyled("IMPACTO SOBRE A RECEITA", T_STYLES.sectionHeader));
  ws1["!merges"]!.push({ s: { c: 0, r: impactStart }, e: { c: 4, r: impactStart } });
  ws1["!rows"]![impactStart] = { hpt: 22 };
  const impacto: Array<[string, number]> = [
    ["Carga tributária sem majoração", cargaSem],
    ["Carga tributária com majoração", cargaCom],
    ["Variação da carga (pontos %)", cargaCom - cargaSem],
  ];
  impacto.forEach((row, i) => {
    const r = impactStart + 1 + i;
    tSetCell(ws1, `A${r + 1}`, tStyled(row[0], T_STYLES.labelBold));
    tSetCell(ws1, `B${r + 1}`, tStyled(row[1], i % 2 === 0 ? T_STYLES.cell : T_STYLES.cellAlt, "n", T_FMT_PCT));
    ws1["!merges"]!.push({ s: { c: 1, r }, e: { c: 4, r } });
  });

  tEnsureRange(ws1, 4, impactStart + 1 + impacto.length);
  XLSX.utils.book_append_sheet(wb, ws1, "Comparativo");

  // Aba 2
  const ws2: XLSX.WorkSheet = {};
  ws2["!cols"] = [{ wch: 38 }, { wch: 18 }, { wch: 18 }, { wch: 22 }];
  ws2["!merges"] = []; ws2["!rows"] = [];
  tSetCell(ws2, "A1", tStyled("ATIVIDADES E RETENÇÕES", T_STYLES.title));
  ws2["!merges"]!.push({ s: { c: 0, r: 0 }, e: { c: 3, r: 0 } });
  ws2["!rows"]![0] = { hpt: 28 };
  tSetCell(ws2, "A2", tStyled(`${data.empresa || "—"} · ${data.cnpj || "—"} · ${tLabel}`, T_STYLES.subtitle));
  ws2["!merges"]!.push({ s: { c: 0, r: 1 }, e: { c: 3, r: 1 } });
  ws2["!rows"]![1] = { hpt: 18 };

  tSetCell(ws2, "A4", tStyled("COMPOSIÇÃO DA RECEITA POR ATIVIDADE", T_STYLES.sectionHeader));
  ws2["!merges"]!.push({ s: { c: 0, r: 3 }, e: { c: 3, r: 3 } });
  ws2["!rows"]![3] = { hpt: 22 };
  ["Atividade", "Presunção IR", "Presunção CSLL", "Receita do Trimestre"].forEach((h, i) =>
    tSetCell(ws2, XLSX.utils.encode_cell({ c: i, r: 4 }), tStyled(h, T_STYLES.tableHead))
  );
  ws2["!rows"]![4] = { hpt: 26 };
  data.atividades.forEach((a, i) => {
    const r = 5 + i;
    const cs = i % 2 === 0 ? T_STYLES.cell : T_STYLES.cellAlt;
    tSetCell(ws2, XLSX.utils.encode_cell({ c: 0, r }), tStyled(a.nome, T_STYLES.labelBold));
    tSetCell(ws2, XLSX.utils.encode_cell({ c: 1, r }), tStyled(a.presuncaoIR / 100, cs, "n", T_FMT_PCT));
    tSetCell(ws2, XLSX.utils.encode_cell({ c: 2, r }), tStyled(a.presuncaoCSLL / 100, cs, "n", T_FMT_PCT));
    tSetCell(ws2, XLSX.utils.encode_cell({ c: 3, r }), tStyled(a.receita, cs, "n", T_FMT_BRL));
  });
  const totalRow = 5 + data.atividades.length;
  tSetCell(ws2, XLSX.utils.encode_cell({ c: 0, r: totalRow }), tStyled("TOTAL", T_STYLES.totalLabel));
  tSetCell(ws2, XLSX.utils.encode_cell({ c: 1, r: totalRow }), tStyled("", T_STYLES.totalRow));
  tSetCell(ws2, XLSX.utils.encode_cell({ c: 2, r: totalRow }), tStyled("", T_STYLES.totalRow));
  tSetCell(ws2, XLSX.utils.encode_cell({ c: 3, r: totalRow }),
    tStyled(data.atividades.reduce((s, a) => s + a.receita, 0), T_STYLES.totalRow, "n", T_FMT_BRL));

  const retStart = totalRow + 2;
  tSetCell(ws2, `A${retStart + 1}`, tStyled("RECEITA FINANCEIRA E RETENÇÕES NA FONTE", T_STYLES.sectionHeader));
  ws2["!merges"]!.push({ s: { c: 0, r: retStart }, e: { c: 3, r: retStart } });
  ws2["!rows"]![retStart] = { hpt: 22 };
  ["Item", "", "", "Valor (R$)"].forEach((h, i) =>
    tSetCell(ws2, XLSX.utils.encode_cell({ c: i, r: retStart + 1 }), tStyled(h, T_STYLES.tableHead))
  );
  ws2["!merges"]!.push({ s: { c: 0, r: retStart + 1 }, e: { c: 2, r: retStart + 1 } });
  const retencoes: Array<[string, number]> = [
    ["Receita Financeira", data.receitaFinanceira],
    ["IRRF Retido", data.retencoes.irrf],
    ["CSLL Retida", data.retencoes.csll],
    ["PIS Retido", data.retencoes.pis],
    ["COFINS Retida", data.retencoes.cofins],
  ];
  retencoes.forEach((row, i) => {
    const r = retStart + 2 + i;
    const cs = i % 2 === 0 ? T_STYLES.cell : T_STYLES.cellAlt;
    tSetCell(ws2, XLSX.utils.encode_cell({ c: 0, r }), tStyled(row[0], T_STYLES.labelBold));
    tSetCell(ws2, XLSX.utils.encode_cell({ c: 3, r }), tStyled(row[1], cs, "n", T_FMT_BRL));
    ws2["!merges"]!.push({ s: { c: 0, r }, e: { c: 2, r } });
  });
  tEnsureRange(ws2, 3, retStart + 2 + retencoes.length);
  XLSX.utils.book_append_sheet(wb, ws2, "Atividades");

  // Aba 3
  const ws3: XLSX.WorkSheet = {};
  ws3["!cols"] = [{ wch: 110 }];
  ws3["!merges"] = []; ws3["!rows"] = [{ hpt: 32 }];
  tSetCell(ws3, "A1", tStyled("EMBASAMENTO LEGAL DA MAJORAÇÃO", T_STYLES.legalTitle));
  const legalText = FUNDAMENTACAO_LEGAL.replace("EMBASAMENTO LEGAL DA MAJORAÇÃO\n\n", "");
  const paragraphs = legalText.split("\n").filter((p) => p.trim().length > 0);
  paragraphs.forEach((p, i) => {
    const r = i + 2;
    tSetCell(ws3, `A${r}`, tStyled(p, T_STYLES.legal));
    const lines = Math.ceil(p.length / 110);
    ws3["!rows"]![r - 1] = { hpt: Math.max(18, lines * 16) };
  });
  tEnsureRange(ws3, 0, paragraphs.length + 1);
  XLSX.utils.book_append_sheet(wb, ws3, "Embasamento Legal");

  XLSX.writeFile(wb, `Apuracao_${(data.cnpj || "empresa").replace(/\D/g, "")}_${data.trimestre}.xlsx`);
}
