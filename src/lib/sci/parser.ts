// Parser do relatório de Faturamento exportado pelo SCI (Excel .xlsx)
// Layout esperado (1ª aba):
// RAZÃO SOCIAL | CNPJ | PLANO TRIBUTÁRIO | ATIVIDADE | ANEXO DE PRESTAÇÃO DE SERVIÇO
//   | DESCRIÇÃO | JAN | FEV | MAR | ABR | MAI | JUN | JUL | AGO | SET | OUT | NOV | DEZ | TOTAL
import * as XLSX from "xlsx";

export interface SciFatRow {
  razaoSocial: string;
  cnpj: string;
  planoTributario: string;
  atividade: string;
  anexo: string;
  descricao: string; // "Faturamento" normalmente
  meses: number[];   // 12 posições (JAN..DEZ)
  total: number;
}

export const MES_LABELS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function num(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Conserta texto que veio em UTF-8 mas foi lido como latin1.
function fixMoji(s: string): string {
  if (!s || typeof s !== "string") return s;
  if (!/Ã[\x80-\xBF]|Â[\x80-\xBF]/.test(s)) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if ((decoded.match(/Ã/g)?.length || 0) < (s.match(/Ã/g)?.length || 0)) return decoded;
    return s;
  } catch { return s; }
}

export async function parseSciExcel(file: File): Promise<SciFatRow[]> {
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);
  let wb: XLSX.WorkBook;
  if (isCsv) {
    wb = XLSX.read(buf, { type: "array", raw: false, codepage: 65001 });
    const sample = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]).slice(0, 4000);
    if (/Ã[\x80-\xBF]|Â[\x80-\xBF]/.test(sample)) {
      wb = XLSX.read(buf, { type: "array", raw: false, codepage: 1252 });
    }
  } else {
    wb = XLSX.read(buf, { type: "array" });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!json.length) return [];
  // Conserta mojibake célula a célula (defesa em profundidade).
  for (let i = 0; i < json.length; i++) {
    const row = json[i] || [];
    for (let j = 0; j < row.length; j++) {
      if (typeof row[j] === "string") row[j] = fixMoji(row[j]);
    }
  }
  // Detecta linha de header (que contém "RAZÃO SOCIAL" / "CNPJ")
  let headerIdx = 0;
  for (let i = 0; i < Math.min(20, json.length); i++) {
    const row = json[i] || [];
    const txt = row.map((c) => String(c || "").toUpperCase()).join("|");
    if (txt.includes("RAZÃO SOCIAL") || txt.includes("RAZAO SOCIAL") || (txt.includes("CNPJ") && txt.includes("JAN"))) {
      headerIdx = i; break;
    }
  }
  const out: SciFatRow[] = [];
  for (let i = headerIdx + 1; i < json.length; i++) {
    const row = json[i] || [];
    if (!row.length) continue;
    const razao = String(row[0] || "").trim();
    if (!razao) continue;
    if (razao.toUpperCase().startsWith("TOTAL")) continue;
    const meses = Array.from({ length: 12 }, (_, k) => num(row[6 + k]));
    const planoTributario = String(row[2] || "").trim();
    const atividade = String(row[3] || "").trim();
    const anexoOrig = String(row[4] || "").trim();
    out.push({
      razaoSocial: razao,
      cnpj: String(row[1] || "").trim(),
      planoTributario,
      atividade,
      anexo: inferAnexo(planoTributario, atividade, anexoOrig),
      descricao: String(row[5] || "").trim(),
      meses,
      total: num(row[18]) || meses.reduce((a, b) => a + b, 0),
    });
  }
  return out;
}

// Inferência de Anexo do Simples Nacional quando ausente, baseada na atividade.
// Regra solicitada: Comércio => Anexo I; Indústria => Anexo II; Indústria e Comércio => Anexo I e II.
// Para outros planos tributários, mantém como está (sem anexo).
export function inferAnexo(plano: string, atividade: string, anexoOrig: string): string {
  const orig = (anexoOrig || "").trim();
  // Considera "vazio" os marcadores comuns que vêm na exportação.
  const vazio = !orig
    || orig === "-"
    || /^(n\/?a|nao tem|n[aã]o tem|sem anexo|nenhum)/i.test(orig.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const isSimples = /simples/i.test(plano || "");
  if (!vazio) return orig;
  if (!isSimples) return orig;
  const a = (atividade || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const temComercio = /comercio/.test(a);
  const temIndustria = /industria/.test(a);
  const temServico = /servico/.test(a);
  if (temComercio && temIndustria) return "Anexo I e II";
  if (temIndustria) return "Anexo II";
  if (temComercio) return "Anexo I";
  if (temServico) return "Sem anexo (Serviços)";
  return "Sem anexo";
}

// =================== Resumo ===================
export interface SciSummary {
  totalGeral: number;
  totalClientes: number;
  porMes: { mes: string; valor: number }[];
  porPlano: { plano: string; valor: number; clientes: number }[];
  porAtividade: { atividade: string; valor: number; clientes: number }[];
  porAnexo: { anexo: string; valor: number; clientes: number }[];
  topClientes: { razao: string; cnpj: string; valor: number; plano: string }[];
  bottomClientes: { razao: string; cnpj: string; valor: number; plano: string }[];
  ticketMedio: number;
  mediaMensal: number;
  mesesAtivos: number;        // meses com pelo menos um valor > 0
  mediaPorMesAtivo: number;   // total / mesesAtivos
}

export function summarizeSci(rows: SciFatRow[]): SciSummary {
  const totalGeral = rows.reduce((a, r) => a + r.total, 0);
  const porMes = MES_LABELS.map((mes, i) => ({
    mes,
    valor: rows.reduce((a, r) => a + (r.meses[i] || 0), 0),
  }));
  const mesesAtivos = porMes.filter((m) => m.valor > 0).length;

  const groupBy = (key: (r: SciFatRow) => string) => {
    const m = new Map<string, { valor: number; clientes: Set<string> }>();
    for (const r of rows) {
      const k = key(r) || "—";
      const cur = m.get(k) || { valor: 0, clientes: new Set() };
      cur.valor += r.total;
      cur.clientes.add(r.cnpj || r.razaoSocial);
      m.set(k, cur);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, valor: v.valor, clientes: v.clientes.size }))
      .sort((a, b) => b.valor - a.valor);
  };

  const porPlano = groupBy((r) => r.planoTributario).map((x) => ({ plano: x.key, valor: x.valor, clientes: x.clientes }));
  const porAtividade = groupBy((r) => r.atividade).map((x) => ({ atividade: x.key, valor: x.valor, clientes: x.clientes }));
  const porAnexo = groupBy((r) => r.anexo || "Sem anexo").map((x) => ({ anexo: x.key, valor: x.valor, clientes: x.clientes }));

  const sortedByVal = [...rows].sort((a, b) => b.total - a.total);
  const topClientes = sortedByVal.slice(0, 10).map((r) => ({
    razao: r.razaoSocial, cnpj: r.cnpj, valor: r.total, plano: r.planoTributario,
  }));
  const bottomClientes = sortedByVal.filter((r) => r.total > 0).slice(-10).reverse().map((r) => ({
    razao: r.razaoSocial, cnpj: r.cnpj, valor: r.total, plano: r.planoTributario,
  }));

  return {
    totalGeral,
    totalClientes: rows.length,
    porMes, porPlano, porAtividade, porAnexo, topClientes, bottomClientes,
    ticketMedio: rows.length > 0 ? totalGeral / rows.length : 0,
    mediaMensal: totalGeral / 12,
    mesesAtivos,
    mediaPorMesAtivo: mesesAtivos > 0 ? totalGeral / mesesAtivos : 0,
  };
}
