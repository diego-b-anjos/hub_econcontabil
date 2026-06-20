import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Empresa, BeneficioFiscal } from "@/types/cbenef";
import { getDescricaoCbenef, getDescricaoCST, getDispositivoCbenef, isEmpresaSimplesNacional } from "@/utils/descricaoUtils";
import logoEcon from "@/assets/econ-logo.png";

interface EmpresaComBeneficios {
  empresa: Empresa;
  beneficios: BeneficioFiscal[];
}

export const generateAllEmpresasPDF = (items: EmpresaComBeneficios[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  items.forEach((item, idx) => {
    if (idx > 0) doc.addPage();

    // Header
    doc.setFillColor(38, 38, 38);
    doc.rect(0, 0, pageWidth, 32, "F");
    doc.setFillColor(218, 165, 32);
    doc.rect(0, 32, pageWidth, 2, "F");
    try { doc.addImage(logoEcon, "PNG", 10, 6, 40, 20); } catch {}
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório cBenef", pageWidth / 2, 16, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth / 2, 24, { align: "center" });

    // Company info
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

    doc.setFont("helvetica", "bold");
    doc.text("Empresa:", 14, y);
    doc.setFont("helvetica", "normal");
    const nomeLines = doc.splitTextToSize(item.empresa.nomeEmpresarial, pageWidth - 69);
    doc.text(nomeLines, 55, y);
    y += Math.max(nomeLines.length * 5, 6) + 2;

    doc.setFont("helvetica", "bold");
    doc.text("CNPJ:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(item.empresa.cnpj, 55, y);
    doc.setFont("helvetica", "bold");
    doc.text("IE:", pageWidth / 2 + 5, y);
    doc.setFont("helvetica", "normal");
    doc.text(item.empresa.ie || "—", pageWidth / 2 + 30, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Município:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(item.empresa.municipio, 55, y);
    y += 6;

    // Legal basis
    y += 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("Embasamento Legal: Portaria SRE 70/2025 - Secretaria da Receita Estadual de São Paulo", 14, y);
    doc.setTextColor(38, 38, 38);
    y += 6;

    const cfop = item.beneficios.filter((b) => b.tipo === "CFOP");
    const ncm = item.beneficios.filter((b) => b.tipo === "NCM");
    let startY = y + 4;

    const isSN = isEmpresaSimplesNacional(item.empresa.equipe);
    const cstLabel = isSN ? "CSOSN" : "CST";
    const getCodigo = (b: BeneficioFiscal) => isSN ? (b.csosn || "") : b.cst;

    const tableColumns = ["CFOP/NCM", cstLabel, `Desc. ${cstLabel}`, "cBenef", "Desc. cBenef", "Legislação", "Destinatário"];
    const tableStyles = {
      headStyles: { fillColor: [38, 38, 38] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontSize: 7, fontStyle: "bold" as const },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255, 248, 220] as [number, number, number] },
      styles: { cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 16, font: "courier" as const },
        1: { cellWidth: 9, font: "courier" as const, halign: "center" as const },
        2: { cellWidth: 22 },
        3: { cellWidth: 16, font: "courier" as const, fontStyle: "bold" as const },
        4: { cellWidth: 26 },
        5: { cellWidth: 30 },
        6: { cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    };

    if (cfop.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Benefícios por CFOP", 14, startY);
      startY += 4;
      autoTable(doc, {
        startY,
        head: [tableColumns],
        body: cfop.map((b) => [b.cfopOuNcm, getCodigo(b), getDescricaoCST(getCodigo(b)), b.cBenef, getDescricaoCbenef(b.cBenef), getDispositivoCbenef(b.cBenef), b.destinatario || "—"]),
        ...tableStyles,
      });
      startY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (ncm.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Benefícios por NCM", 14, startY);
      startY += 4;
      autoTable(doc, {
        startY,
        head: [tableColumns],
        body: ncm.map((b) => [b.cfopOuNcm, getCodigo(b), getDescricaoCST(getCodigo(b)), b.cBenef, getDescricaoCbenef(b.cBenef), getDispositivoCbenef(b.cBenef), b.destinatario || "—"]),
        ...tableStyles,
      });
    }
  });

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(38, 38, 38);
    doc.rect(0, ph - 14, pageWidth, 14, "F");
    doc.setFillColor(218, 165, 32);
    doc.rect(0, ph - 14, pageWidth, 1, "F");
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.text("Econ Escritório Contábil Ltda - Sistema cBenef | Portaria SRE 70/2025", 14, ph - 5);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, ph - 5, { align: "right" });
  }

  doc.save("cBenef_Todas_Empresas.pdf");
};

export const generateAllEmpresasExcel = (items: EmpresaComBeneficios[]) => {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData: (string | undefined)[][] = [
    ["Econ Escritório Contábil Ltda - Relatório cBenef - Todas as Empresas"],
    [],
    ["Data de Emissão", new Date().toLocaleDateString("pt-BR")],
    ["Embasamento Legal", "Portaria SRE 70/2025"],
    [],
    ["Empresa", "CNPJ", "IE", "Município", "Qtd. Benefícios"],
  ];
  items.forEach((item) => {
    summaryData.push([item.empresa.nomeEmpresarial, item.empresa.cnpj, item.empresa.ie, item.empresa.municipio, String(item.beneficios.length)]);
  });
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 40 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo");

  // One sheet per company
  items.forEach((item) => {
    const sheetName = item.empresa.nomeEmpresarial.substring(0, 28).replace(/[[\]*?/\\]/g, "");
    const isSN = isEmpresaSimplesNacional(item.empresa.equipe);
    const cstLabel = isSN ? "CSOSN" : "CST";
    const getCodigo = (b: BeneficioFiscal) => isSN ? (b.csosn || "") : b.cst;
    const data: (string | undefined)[][] = [
      ["Empresa", item.empresa.nomeEmpresarial],
      ["CNPJ", item.empresa.cnpj],
      ["IE", item.empresa.ie],
      ["Município", item.empresa.municipio],
      [],
      ["Tipo", "CFOP / NCM", cstLabel, `Descrição ${cstLabel}`, "cBenef", "Descrição cBenef", "Legislação", "Destinatário"],
    ];
    item.beneficios.forEach((b) => {
      data.push([b.tipo, b.cfopOuNcm, getCodigo(b), getDescricaoCST(getCodigo(b)), b.cBenef, getDescricaoCbenef(b.cBenef), getDispositivoCbenef(b.cBenef), b.destinatario || ""]);
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 35 }, { wch: 14 }, { wch: 40 }, { wch: 45 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, "cBenef_Todas_Empresas.xlsx");
};
