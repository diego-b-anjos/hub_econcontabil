import type { jsPDF } from "jspdf";

export const PDF_DARK: [number, number, number] = [30, 26, 22];
export const PDF_GOLD: [number, number, number] = [247, 184, 49];
export const PDF_GRAY: [number, number, number] = [110, 110, 110];

export interface ApresentacaoHeaderOpts {
  titulo: string;
  subtitulo?: string;
  dataDireita?: string;
}

export function drawApresentacaoHeader(
  doc: jsPDF,
  opts: ApresentacaoHeaderOpts,
): number {
  const W = doc.internal.pageSize.getWidth();
  const M = 12;
  doc.setFillColor(...PDF_DARK);
  doc.rect(0, 0, W, 14, "F");
  doc.setFillColor(...PDF_GOLD);
  doc.rect(0, 14, W, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PDF_GOLD);
  doc.text(opts.titulo, M, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  if (opts.dataDireita) {
    doc.text(opts.dataDireita, W - M, 9, { align: "right" });
  }
  if (opts.subtitulo) {
    doc.setTextColor(20);
    doc.setFontSize(10);
    doc.text(opts.subtitulo, M, 22);
    doc.setTextColor(0);
    return 28;
  }
  doc.setTextColor(0);
  return 22;
}

export function drawApresentacaoFooter(
  doc: jsPDF,
  pagina: number,
  totalPaginas: number,
  marca = "ECON Hub do Escritório",
): void {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  doc.setDrawColor(...PDF_GOLD);
  doc.setLineWidth(0.4);
  doc.line(M, H - 10, W - M, H - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_GRAY);
  doc.text(marca, M, H - 5);
  doc.text(`Página ${pagina} de ${totalPaginas}`, W - M, H - 5, { align: "right" });
  doc.setTextColor(0);
}

/** Aplica drawApresentacaoFooter em todas as páginas já desenhadas. */
export function paginate(doc: jsPDF, marca?: string): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawApresentacaoFooter(doc, i, total, marca);
  }
}
