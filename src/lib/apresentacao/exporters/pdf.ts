import { toast } from "sonner";
import type { SciFatRow } from "@/lib/sci/parser";
import type { AcessoriasRow } from "@/lib/acessorias/parser";
import type { ProtocoloRow } from "@/lib/sci/protocolos-parser";
import { fmtBRL } from "./shared";

export interface PdfExportParams {
  sciF: SciFatRow[];
  accF: AcessoriasRow[];
  protocolosF: ProtocoloRow[];
  accProcessado: AcessoriasRow[];
  protocolosComResp: ProtocoloRow[];
  totalClientesUnicos: number;
  sciSummary: any;
  accSummary: any;
  protocolosSummary: any;
  obrigPorResponsavel: { nome: string; total: number }[];
  /** Nome do contador responsável — preferir do cadastro de Contadores
   *  (vinculado ao usuário); cair no nome do usuário local se ausente. */
  contadorNome?: string;
  /** CRC do contador responsável — opcional, exibido na assinatura. */
  contadorCrc?: string;
}

// Constrói o documento jsPDF — pura, sem download — para reuso em testes.
export async function buildPdfDoc(params: PdfExportParams) {
  const {
    sciF, accF, protocolosF, accProcessado, protocolosComResp,
    totalClientesUnicos, sciSummary, accSummary, protocolosSummary, obrigPorResponsavel,
    contadorNome, contadorCrc,
  } = params;
  const sci = sciF; const acc = accF; const protocolos = protocolosF;
  void acc; void protocolos;
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;
  let y = 16;
  const header = (titulo: string) => {
    doc.setFillColor(30, 26, 22); doc.rect(0, 0, W, 14, "F");
    doc.setFillColor(247, 184, 49); doc.rect(0, 14, W, 0.8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(247, 184, 49);
    doc.text(titulo, M, 9);
    y = 22;
  };
  header("Apresentação Executiva — Econ");
  doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString("pt-BR"), W - M, 9, { align: "right" });
  doc.setTextColor(20); doc.setFontSize(11);
  doc.text(`Carteira unificada: ${totalClientesUnicos} clientes`, M, y); y += 8;

  const section = (title: string, head: string[], body: any[][]) => {
    if (!body.length) return;
    if (y > 250) { doc.addPage(); header("Apresentação Executiva — Econ"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(30, 26, 22);
    doc.text(title, M, y); y += 4;
    autoTable(doc, {
      startY: y, head: [head], body, theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 26, 22], textColor: [247, 184, 49], fontStyle: "bold" },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  if (sci.length) {
    section("SCI · Top 10 clientes",
      ["Cliente", "Plano", "Faturamento"],
      sciSummary.topClientes.slice(0, 10).map((c: any) => [c.razao, c.plano, fmtBRL(c.valor)]));
  }
  if (accProcessado.length) {
    section("Acessórias · Indicadores",
      ["Métrica", "Valor"],
      [
        ["Total tarefas", String(accSummary.total)],
        ["Pontualidade", `${accSummary.taxaPontualidade.toFixed(1)}%`],
        ["Atraso", `${accSummary.taxaAtraso.toFixed(1)}%`],
        ["Pendentes", String(accSummary.porStatus.pendente)],
      ]);
    section("Acessórias · Por responsável",
      ["Responsável", "Total"],
      obrigPorResponsavel.slice(0, 15).map((r) => [r.nome, String(r.total)]));
  }
  if (protocolosComResp.length) {
    const ps = protocolosSummary;
    const totalImp = ps.valorTotalImpostos || 0;
    section("SCI Protocolos · Total de impostos publicados por responsável",
      ["Responsável", "Protocolos", "Qtd. Imp.", "Total Impostos", "%"],
      ps.porResponsavel.map((p: any) => [
        p.chave, String(p.quantidade), String(p.qtdImpostos),
        fmtBRL(p.valorImpostos),
        `${totalImp ? ((p.valorImpostos / totalImp) * 100).toFixed(1) : "0.0"}%`,
      ]));
    const refMap = new Map<string, { q: number; v: number }>();
    for (const r of protocolosComResp) {
      if (r.categoria !== "imposto") continue;
      const k = r.referencia || "—";
      const cur = refMap.get(k) || { q: 0, v: 0 };
      cur.q += 1; cur.v += r.valor || 0; refMap.set(k, cur);
    }
    const refRows = [...refMap.entries()].sort((a, b) => b[1].v - a[1].v);
    section("SCI Protocolos · Total de impostos publicados por referência",
      ["Referência", "Qtd. Impostos", "Total Impostos", "%"],
      refRows.map(([k, v]) => [
        k, String(v.q), fmtBRL(v.v),
        `${totalImp ? ((v.v / totalImp) * 100).toFixed(1) : "0.0"}%`,
      ]));
  }
  // Assinatura — Contador responsável (do cadastro de Contadores via AuthContext;
  // fallback para nome do usuário local quando não há vínculo).
  if (contadorNome) {
    if (y > 250) { doc.addPage(); header("Apresentação Executiva — Econ"); }
    y = Math.max(y, doc.internal.pageSize.getHeight() - 35);
    doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(30, 26, 22);
    doc.text("Contador responsável:", M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
    doc.text(contadorNome, M + 42, y);
    if (contadorCrc) { doc.text(`CRC: ${contadorCrc}`, M, y + 5); }
    doc.text(
      `Emitido em ${new Date().toLocaleDateString("pt-BR")}`,
      W - M, y + 5, { align: "right" },
    );
  }
  return doc;
}

export async function gerarPdf(params: PdfExportParams): Promise<void> {
  const { sciF, accProcessado, protocolosComResp } = params;
  if (!sciF.length && !accProcessado.length && !protocolosComResp.length) {
    toast.error("Importe dados antes de exportar.");
    return;
  }
  const doc = await buildPdfDoc(params);
  doc.save(`apresentacao-executiva-${Date.now()}.pdf`);
  toast.success("PDF gerado");
}
