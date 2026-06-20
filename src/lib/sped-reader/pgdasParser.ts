// Parser do Extrato do Simples Nacional (PGDAS-D) em PDF.
// Lê o PDF emitido pelo Portal do Simples Nacional e extrai, por período de apuração:
// - RBT12 (receita bruta dos últimos 12 meses)
// - RPA (receita bruta total do período de apuração) → faturamento
// - Valor total do DAS
// - Decomposição por tributo (IRPJ, CSLL, COFINS, PIS, CPP, ICMS, ISS)
//
// O layout do PDF é tabular; usamos pdfjs para extrair texto bruto e parsing por linhas.

import type { SpedParseResult, SpedMonthly } from "./parser";

let _pdfjsLib: typeof import("pdfjs-dist") | null = null;
async function getPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import("pdfjs-dist");
    _pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${_pdfjsLib.version}/build/pdf.worker.min.js`;
  }
  return _pdfjsLib;
}

const toMoney = (s: string): number => {
  if (!s) return 0;
  // Aceita "1.234.567,89" ou "1234567.89" ou "1.234,56"
  const clean = s.replace(/[R$\s]/g, "");
  if (/^-?\d+,\d{2}$/.test(clean) || /^-?[\d.]+,\d{2}$/.test(clean)) {
    return Number(clean.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(clean.replace(/[^\d.-]/g, "")) || 0;
};

const MES_NOMES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** Aceita "01/2024", "1/2024", "Janeiro/2024", "JAN/2024". Retorna {mes, ano} ou null. */
function parsePeriodo(s: string): { mes: number; ano: number; key: string } | null {
  const t = s.trim().toLowerCase();
  let m = t.match(/^(\d{1,2})\s*[/-]\s*(\d{4})$/);
  if (m) {
    const mes = Number(m[1]); const ano = Number(m[2]);
    if (mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100) {
      return { mes, ano, key: `${ano}-${String(mes).padStart(2, "0")}` };
    }
  }
  m = t.match(/^([a-zçãéí]+)\s*[/-]?\s*(\d{4})$/i);
  if (m) {
    const nome = m[1].toLowerCase();
    const mes = MES_NOMES[nome] || (nome.length >= 3 ? Object.entries(MES_NOMES).find(([k]) => k.startsWith(nome.slice(0, 3)))?.[1] : 0);
    const ano = Number(m[2]);
    if (mes && ano) return { mes, ano, key: `${ano}-${String(mes).padStart(2, "0")}` };
  }
  return null;
}

interface RawItem { x: number; y: number; str: string; page: number; }

async function pdfToText(file: File): Promise<{ items: RawItem[]; rawText: string }> {
  const pdfjsLib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const items: RawItem[] = [];
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageItems: { x: number; y: number; str: string }[] = [];
    for (const it of content.items as Array<{ str: string; transform: number[] }>) {
      const s = (it.str || "").trim();
      if (!s) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      pageItems.push({ x, y, str: s });
      items.push({ x, y, str: s, page: p });
    }
    // Reconstrói linhas: agrupa por Y aproximado, ordena por X
    const byY = new Map<number, { x: number; str: string }[]>();
    for (const it of pageItems) {
      const yBucket = Math.round(it.y);
      const arr = byY.get(yBucket) || [];
      arr.push({ x: it.x, str: it.str });
      byY.set(yBucket, arr);
    }
    const sortedYs = [...byY.keys()].sort((a, b) => b - a); // topo → base
    for (const y of sortedYs) {
      const row = byY.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.str).join(" ");
      lines.push(row);
    }
    lines.push("\f");
  }
  return { items, rawText: lines.join("\n") };
}

/** Tributos rastreados no extrato (mapeia para campos SpedMonthly). */
const TRIBUTO_PATTERNS: { regex: RegExp; field: keyof SpedMonthly | "irpj" | "csll" | "cpp"; }[] = [
  { regex: /\bIRPJ\b/i, field: "irpj" },
  { regex: /\bCSLL\b/i, field: "csll" },
  { regex: /\bCOFINS\b/i, field: "cofins" },
  { regex: /\bPIS(\s*\/\s*PASEP)?\b/i, field: "pis" },
  { regex: /\bCPP\b|Contribui[çc][ãa]o\s+Previdenci[áa]ria\s+Patronal/i, field: "cpp" },
  { regex: /\bICMS\b/i, field: "icmsDebito" },
  { regex: /\bISS(QN)?\b/i, field: "iss" },
];

/** Estende SpedMonthly com campos exclusivos do PGDAS-D. */
export interface PgdasMonthly extends SpedMonthly {
  /** Total do DAS pago no período. */
  das?: number;
  /** Receita Bruta dos Últimos 12 Meses informada no PA. */
  rbt12?: number;
  /** Decomposição por tributo (informativa). */
  irpj?: number;
  csll?: number;
  cpp?: number;
}

export interface PgdasParseResult extends SpedParseResult {
  meses: PgdasMonthly[];
  totalDAS: number;
}

const moneyRegex = /(R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\,\d{2})/;

function findMoneyAfter(line: string, marker: RegExp): number | null {
  const idx = line.search(marker);
  if (idx < 0) return null;
  const tail = line.slice(idx);
  const m = tail.match(moneyRegex);
  return m ? toMoney(m[2] || m[0]) : null;
}

/**
 * Faz o parsing do PDF do extrato PGDAS-D.
 * Tolera variações de layout: separa o documento em "blocos por período de apuração".
 */
export async function parsePgdasPdf(file: File): Promise<PgdasParseResult> {
  const { rawText } = await pdfToText(file);
  const lines = rawText.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  let cnpj: string | undefined;
  let razaoSocial: string | undefined;
  const alertas: string[] = [];

  // Captura CNPJ e razão social no início
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const ln = lines[i];
    const cm = ln.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (cm && !cnpj) cnpj = cm[1];
    const rm = ln.match(/Nome\s*Empresarial[:\s]+(.+)$/i) ||
               ln.match(/Raz[ãa]o\s*Social[:\s]+(.+)$/i);
    if (rm && !razaoSocial) razaoSocial = rm[1].trim().slice(0, 120);
  }

  // Identifica blocos por período de apuração
  // Procura linhas com "Período de Apuração" / "PA:" / "Período (PA)" e captura MM/AAAA na mesma linha ou próxima.
  type Bloco = { mes: number; ano: number; key: string; lines: string[]; startIdx: number };
  const blocos: Bloco[] = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!/per[íi]odo\s+de\s+apura[çc][ãa]o|^\s*PA[:\s]/i.test(ln)) continue;
    // Tenta extrair MM/AAAA da própria linha; se não, das próximas 2 linhas
    let p = parsePeriodo((ln.match(/(\d{1,2}\/\d{4})/) || [])[1] || "");
    if (!p) {
      for (let k = 1; k <= 3 && !p; k++) {
        const nxt = lines[i + k] || "";
        const found = nxt.match(/(\d{1,2}\/\d{4})/);
        if (found) p = parsePeriodo(found[1]);
      }
    }
    if (p) {
      blocos.push({ ...p, lines: [], startIdx: i });
    }
  }

  // Define faixas de linhas para cada bloco (até o próximo bloco)
  for (let b = 0; b < blocos.length; b++) {
    const start = blocos[b].startIdx;
    const end = b + 1 < blocos.length ? blocos[b + 1].startIdx : lines.length;
    blocos[b].lines = lines.slice(start, end);
  }

  // Se não achou nenhum bloco "Período de Apuração", tenta caminho alternativo:
  // varre todas as linhas e procura "Valor Total do DAS" + RBT12/RPA próximos a um MM/AAAA.
  if (!blocos.length) {
    const fallback = parseFallback(lines);
    if (fallback.length) {
      for (const f of fallback) blocos.push(f);
    } else {
      alertas.push("Não foi possível identificar períodos de apuração no extrato. Verifique se é o PDF do PGDAS-D oficial.");
    }
  }

  // Para cada bloco, extrai RBT12, RPA, DAS e tributos
  const meses: PgdasMonthly[] = [];
  let totalDAS = 0;
  for (const b of blocos) {
    const blockText = b.lines.join("\n");
    const flat = b.lines.join(" | ");

    let rbt12 = 0;
    let rpa = 0;
    let das = 0;

    // RBT12 — várias formas de label
    for (const ln of b.lines) {
      if (!rbt12) {
        const v = findMoneyAfter(ln, /Receita\s+Bruta\s+dos\s+[ÚU]ltimos\s+12\s+Meses|RBT[\s-]*12/i);
        if (v != null) rbt12 = v;
      }
      if (!rpa) {
        const v = findMoneyAfter(ln, /Receita\s+Bruta\s+(Total\s+)?do\s+PA|Receita\s+do\s+Per[íi]odo\s+de\s+Apura[çc][ãa]o|\bRPA\b/i);
        if (v != null) rpa = v;
      }
      if (!das) {
        const v = findMoneyAfter(ln, /Valor\s+Total\s+do\s+(DAS|Documento)|Total\s+devido|Total\s+do\s+DAS|Valor\s+do\s+DAS/i);
        if (v != null) das = v;
      }
    }

    // Fallback no texto consolidado
    if (!rbt12) {
      const v = findMoneyAfter(flat, /Receita\s+Bruta\s+dos\s+[ÚU]ltimos\s+12\s+Meses|RBT[\s-]*12/i);
      if (v != null) rbt12 = v;
    }
    if (!rpa) {
      const v = findMoneyAfter(flat, /Receita\s+Bruta\s+(Total\s+)?do\s+PA|Receita\s+do\s+Per[íi]odo|\bRPA\b/i);
      if (v != null) rpa = v;
    }
    if (!das) {
      const v = findMoneyAfter(flat, /Valor\s+Total\s+do\s+(DAS|Documento)|Total\s+devido|Total\s+do\s+DAS/i);
      if (v != null) das = v;
    }

    // Tributos: somatórios sobre todas as linhas do bloco
    let irpj = 0, csll = 0, cofins = 0, pis = 0, cpp = 0, icms = 0, iss = 0;
    for (const ln of b.lines) {
      for (const t of TRIBUTO_PATTERNS) {
        const v = findMoneyAfter(ln, t.regex);
        if (v != null && v > 0) {
          // Evita capturar "RBT12" como ICMS, etc — só se a linha não contiver indicador de "receita"
          if (/Receita|RBT|RPA|Total|Valor\s+Total\s+do\s+DAS/i.test(ln)) continue;
          if (t.field === "irpj") irpj = Math.max(irpj, v);
          else if (t.field === "csll") csll = Math.max(csll, v);
          else if (t.field === "cofins") cofins = Math.max(cofins, v);
          else if (t.field === "pis") pis = Math.max(pis, v);
          else if (t.field === "cpp") cpp = Math.max(cpp, v);
          else if (t.field === "icmsDebito") icms = Math.max(icms, v);
          else if (t.field === "iss") iss = Math.max(iss, v);
        }
      }
    }

    if (!rpa && !das && !rbt12) {
      alertas.push(`Período ${b.key}: não foi possível extrair valores (RBT12/RPA/DAS).`);
      continue;
    }

    totalDAS += das;
    meses.push({
      periodo: b.key, mes: b.mes, ano: b.ano,
      faturamento: rpa,
      compras: 0,
      icmsDebito: icms,
      icmsCredito: 0,
      ipiDebito: 0,
      ipiCredito: 0,
      pis,
      cofins,
      iss,
      das,
      rbt12,
      irpj, csll, cpp,
    });
  }

  meses.sort((a, b) => a.periodo.localeCompare(b.periodo));
  const totais = meses.reduce(
    (acc, m) => ({
      faturamento: acc.faturamento + m.faturamento,
      compras: 0,
      icmsDebito: acc.icmsDebito + m.icmsDebito,
      icmsCredito: 0,
      ipiDebito: 0, ipiCredito: 0,
      pis: acc.pis + m.pis,
      cofins: acc.cofins + m.cofins,
      iss: acc.iss + m.iss,
    }),
    { faturamento: 0, compras: 0, icmsDebito: 0, icmsCredito: 0, ipiDebito: 0, ipiCredito: 0, pis: 0, cofins: 0, iss: 0 },
  );

  if (!meses.length) {
    alertas.push("Nenhum período válido encontrado no extrato PGDAS-D.");
  }

  return {
    tipo: "pgdas",
    cnpj, razaoSocial,
    inicio: meses[0]?.periodo, fim: meses[meses.length - 1]?.periodo,
    meses, totais, totalDAS,
    registrosLidos: lines.length,
    alertas,
  };
}

function parseFallback(lines: string[]): { mes: number; ano: number; key: string; lines: string[]; startIdx: number }[] {
  // Procura padrões "MM/AAAA" próximos a "DAS" ou "RBT12"
  const out: { mes: number; ano: number; key: string; lines: string[]; startIdx: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const m = ln.match(/(\d{2}\/\d{4})/);
    if (!m) continue;
    const p = parsePeriodo(m[1]);
    if (!p) continue;
    // Considera bloco se houver "DAS" ou "RBT12" em ±5 linhas
    const ctx = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 25)).join(" ");
    if (!/DAS|RBT.?12|Receita\s+Bruta/i.test(ctx)) continue;
    if (out.find((o) => o.key === p.key)) continue;
    out.push({ ...p, lines: lines.slice(i, Math.min(lines.length, i + 25)), startIdx: i });
  }
  return out;
}
