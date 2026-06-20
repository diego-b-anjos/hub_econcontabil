import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Empresa, BeneficioFiscal } from "@/types/cbenef";
import logoEcon from "@/assets/econ-logo.png";
import { getDescricaoCbenef, getDescricaoCST, getDispositivoCbenef, isEmpresaSimplesNacional } from "@/utils/descricaoUtils";

export const generatePDF = (empresa: Empresa, beneficios: BeneficioFiscal[], observacoes?: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(38, 38, 38);
  doc.rect(0, 0, pageWidth, 32, "F");

  // Gold accent line
  doc.setFillColor(218, 165, 32);
  doc.rect(0, 32, pageWidth, 2, "F");

  // Logo
  try {
    doc.addImage(logoEcon, "PNG", 10, 6, 40, 20);
  } catch {}

  // Title in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório cBenef", pageWidth / 2, 16, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth / 2, 24, { align: "center" });

  // Company info (without SCI)
  doc.setTextColor(38, 38, 38);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Dados da Empresa", 14, 46);

  doc.setDrawColor(218, 165, 32);
  doc.setLineWidth(0.5);
  doc.line(14, 48, pageWidth - 14, 48);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  let y = 54;
  const labelX = 14;
  const valueX = 55;
  const label2X = pageWidth / 2 + 5;
  const value2X = pageWidth / 2 + 30;

  // Row 1: Empresa (full width - name can be long)
  doc.setFont("helvetica", "bold");
  doc.text("Empresa:", labelX, y);
  doc.setFont("helvetica", "normal");
  const nomeLines = doc.splitTextToSize(empresa.nomeEmpresarial, pageWidth - valueX - 14);
  doc.text(nomeLines, valueX, y);
  y += Math.max(nomeLines.length * 5, 6) + 2;

  // Row 2: CNPJ + IE
  doc.setFont("helvetica", "bold");
  doc.text("CNPJ:", labelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(empresa.cnpj, valueX, y);
  doc.setFont("helvetica", "bold");
  doc.text("IE:", label2X, y);
  doc.setFont("helvetica", "normal");
  doc.text(empresa.ie || "—", value2X, y);
  y += 6;

  // Row 3: Município + Regime
  doc.setFont("helvetica", "bold");
  doc.text("Município:", labelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(empresa.municipio, valueX, y);
  doc.setFont("helvetica", "bold");
  doc.text("Regime:", label2X, y);
  doc.setFont("helvetica", "normal");
  doc.text(empresa.equipe, value2X, y);
  y += 6;

  // Legal basis
  y += 2;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("Embasamento Legal: Portaria SRE 70/2025 - Secretaria da Receita Estadual de São Paulo", 14, y);
  doc.setTextColor(38, 38, 38);
  y += 6;

  // Benefits table
  const cfopBeneficios = beneficios.filter((b) => b.tipo === "CFOP");
  const ncmBeneficios = beneficios.filter((b) => b.tipo === "NCM");

  const isSN = isEmpresaSimplesNacional(empresa.equipe);
  const cstLabel = isSN ? "CSOSN" : "CST";
  const getCodigo = (b: BeneficioFiscal) => isSN ? (b.csosn || "") : b.cst;

  let startY = y + 4;

  if (cfopBeneficios.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Benefícios por CFOP", 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [["CFOP", "Natureza da Operação", cstLabel, `Desc. ${cstLabel}`, "cBenef", "Desc. cBenef", "Legislação", "Destinatário"]],
      body: cfopBeneficios.map((b) => [
        b.cfopOuNcm,
        b.naturezaOperacao,
        getCodigo(b),
        getDescricaoCST(getCodigo(b)),
        b.cBenef,
        getDescricaoCbenef(b.cBenef),
        getDispositivoCbenef(b.cBenef),
        b.destinatario || "—",
      ]),
      headStyles: { fillColor: [38, 38, 38], textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 248, 220] },
      styles: { cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 14, font: "courier" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 9, font: "courier", halign: "center" },
        3: { cellWidth: 22 },
        4: { cellWidth: 16, font: "courier", fontStyle: "bold" },
        5: { cellWidth: 26 },
        6: { cellWidth: 30 },
        7: { cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  if (ncmBeneficios.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Benefícios por NCM", 14, startY);
    startY += 4;

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("* Os benefícios por NCM são utilizados para todas as demais operações fiscais.", 14, startY);
    doc.setTextColor(38, 38, 38);
    startY += 5;

    autoTable(doc, {
      startY,
      head: [["NCM", "Descrição", cstLabel, `Desc. ${cstLabel}`, "cBenef", "Desc. cBenef", "Legislação", "Destinatário"]],
      body: ncmBeneficios.map((b) => [
        b.cfopOuNcm,
        b.naturezaOperacao,
        getCodigo(b),
        getDescricaoCST(getCodigo(b)),
        b.cBenef,
        getDescricaoCbenef(b.cBenef),
        getDispositivoCbenef(b.cBenef),
        b.destinatario || "—",
      ]),
      headStyles: { fillColor: [38, 38, 38], textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 248, 220] },
      styles: { cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 16, font: "courier" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 9, font: "courier", halign: "center" },
        3: { cellWidth: 22 },
        4: { cellWidth: 16, font: "courier", fontStyle: "bold" },
        5: { cellWidth: 26 },
        6: { cellWidth: 30 },
        7: { cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Observations section
  if (observacoes && observacoes.trim()) {
    // Check if we need a new page
    const pageHeight = doc.internal.pageSize.getHeight();
    if (startY > pageHeight - 60) {
      doc.addPage();
      startY = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(38, 38, 38);
    doc.text("Observações", 14, startY);

    doc.setDrawColor(218, 165, 32);
    doc.setLineWidth(0.5);
    doc.line(14, startY + 2, pageWidth - 14, startY + 2);

    startY += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(observacoes.trim(), pageWidth - 28);
    doc.text(lines, 14, startY);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(38, 38, 38);
    doc.rect(0, pageHeight - 14, pageWidth, 14, "F");
    doc.setFillColor(218, 165, 32);
    doc.rect(0, pageHeight - 14, pageWidth, 1, "F");
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.text("Econ Escritório Contábil Ltda - Sistema cBenef | Portaria SRE 70/2025", 14, pageHeight - 5);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 5, { align: "right" });
  }

  doc.save(`cBenef_${empresa.nomeEmpresarial.replace(/\s+/g, "_")}.pdf`);
};
