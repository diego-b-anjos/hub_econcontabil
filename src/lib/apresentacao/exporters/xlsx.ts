import { toast } from "sonner";
import type { SciFatRow } from "@/lib/sci/parser";
import type { AcessoriasRow } from "@/lib/acessorias/parser";
import type { ProtocoloRow } from "@/lib/sci/protocolos-parser";

export interface XlsxExportParams {
  sciF: SciFatRow[];
  accF: AcessoriasRow[];
  protocolosF: ProtocoloRow[];
  accProcessado: AcessoriasRow[];
  protocolosComResp: ProtocoloRow[];
  sciSummary: any;
  protocolosSummary: any;
  obrigPorResponsavel: { nome: string; total: number }[];
}

// Constrói o workbook XLSX a partir dos parâmetros. Pura — sem efeito colateral
// de download — para permitir testes de regressão (geração determinística).
export async function buildXlsxWorkbook(params: XlsxExportParams) {
  const {
    sciF,
    accF,
    protocolosF,
    accProcessado,
    protocolosComResp,
    sciSummary,
    protocolosSummary,
    obrigPorResponsavel,
  } = params;
  const sci = sciF; const acc = accF; const protocolos = protocolosF;
  void acc; void protocolos;
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  if (sci.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Cliente", "Plano", "Faturamento"],
      ...sciSummary.topClientes.map((c: any) => [c.razao, c.plano, c.valor]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "SCI Top Clientes");
  }
  if (accProcessado.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Responsável", "Total Obrigações"],
      ...obrigPorResponsavel.map((r) => [r.nome, r.total]),
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Acessórias Resp.");
  }
  if (protocolosComResp.length) {
    const ps = protocolosSummary;
    const totalImp = ps.valorTotalImpostos || 0;
    const wsResp = XLSX.utils.aoa_to_sheet([
      ["Responsável", "Protocolos", "Qtd. Impostos", "Total Impostos", "%"],
      ...ps.porResponsavel.map((p: any) => [
        p.chave, p.quantidade, p.qtdImpostos, p.valorImpostos,
        totalImp ? p.valorImpostos / totalImp : 0,
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsResp, "Impostos Resp.");
    const refMap = new Map<string, { q: number; v: number }>();
    for (const r of protocolosComResp) {
      if (r.categoria !== "imposto") continue;
      const k = r.referencia || "—";
      const cur = refMap.get(k) || { q: 0, v: 0 };
      cur.q += 1; cur.v += r.valor || 0; refMap.set(k, cur);
    }
    const wsRef = XLSX.utils.aoa_to_sheet([
      ["Referência", "Qtd. Impostos", "Total Impostos", "%"],
      ...[...refMap.entries()].sort((a, b) => b[1].v - a[1].v).map(([k, v]) => [
        k, v.q, v.v, totalImp ? v.v / totalImp : 0,
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsRef, "Impostos Referência");
  }
  return { XLSX, wb };
}

export async function gerarXlsx(params: XlsxExportParams): Promise<void> {
  const { sciF, accProcessado, protocolosComResp } = params;
  if (!sciF.length && !accProcessado.length && !protocolosComResp.length) {
    toast.error("Importe dados antes de exportar.");
    return;
  }
  const { XLSX, wb } = await buildXlsxWorkbook(params);
  XLSX.writeFile(wb, `apresentacao-executiva-${Date.now()}.xlsx`);
  toast.success("Excel gerado");
}
