// Parser do "Check-List Geral de Empresas / Obrigações" (Excel .xlsx)
// Aba "2026" com cabeçalho na linha 3.
// Colunas relevantes: NOME EMPRESARIAL | CNPJ | EQUIPE | NÍVEL | RAMO ATIVIDADE | MUNICIPIO | UF | RESPONSAVEL
import * as XLSX from "xlsx";

export interface ChecklistRow {
  condicao: string;
  sci: string;
  empresa: string;
  cnpj: string;
  grupo: string;
  equipe: string;       // plano tributário no SCI
  nivel: string;
  ramo: string;
  municipio: string;
  uf: string;
  responsavel: string;
  processo: string;
}

const norm = (s: unknown) =>
  String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function findCol(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (!h) continue;
    for (const c of candidates) if (h === c || h.includes(c)) return i;
  }
  return -1;
}

export async function parseChecklist(file: File): Promise<ChecklistRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  // Junta todas as abas que pareçam ter o layout (header com NOME EMPRESARIAL).
  const out: ChecklistRow[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    let headerIdx = -1;
    for (let i = 0; i < Math.min(15, json.length); i++) {
      const row = json[i] || [];
      const txt = row.map((c) => norm(c)).join("|");
      if (txt.includes("nome empresarial") && txt.includes("responsavel")) { headerIdx = i; break; }
    }
    if (headerIdx < 0) continue;
    const headers: string[] = (json[headerIdx] || []).map((c: unknown) => String(c || ""));
    const c = {
      condicao: findCol(headers, ["condicao"]),
      sci: findCol(headers, ["sci"]),
      empresa: findCol(headers, ["nome empresarial", "razao social"]),
      cnpj: findCol(headers, ["cnpj"]),
      grupo: findCol(headers, ["grupos", "grupo"]),
      equipe: findCol(headers, ["equipe"]),
      nivel: findCol(headers, ["nivel"]),
      ramo: findCol(headers, ["ramo"]),
      municipio: findCol(headers, ["municipio"]),
      uf: findCol(headers, ["uf"]),
      responsavel: findCol(headers, ["responsavel"]),
      processo: findCol(headers, ["processo"]),
    };
    for (let i = headerIdx + 1; i < json.length; i++) {
      const row = json[i] || [];
      const empresa = c.empresa >= 0 ? String(row[c.empresa] || "").trim() : "";
      if (!empresa) continue;
      out.push({
        condicao: c.condicao >= 0 ? String(row[c.condicao] || "").trim() : "",
        sci: c.sci >= 0 ? String(row[c.sci] || "").trim() : "",
        empresa,
        cnpj: c.cnpj >= 0 ? String(row[c.cnpj] || "").trim() : "",
        grupo: c.grupo >= 0 ? String(row[c.grupo] || "").trim() : "",
        equipe: c.equipe >= 0 ? String(row[c.equipe] || "").trim() : "",
        nivel: c.nivel >= 0 ? String(row[c.nivel] || "").trim() : "",
        ramo: c.ramo >= 0 ? String(row[c.ramo] || "").trim() : "",
        municipio: c.municipio >= 0 ? String(row[c.municipio] || "").trim() : "",
        uf: c.uf >= 0 ? String(row[c.uf] || "").trim() : "",
        responsavel: c.responsavel >= 0 ? String(row[c.responsavel] || "").trim() : "",
        processo: c.processo >= 0 ? String(row[c.processo] || "").trim() : "",
      });
    }
  }
  return out;
}

export interface ChecklistSummary {
  total: number;
  ativos: number;
  inativos: number;
  porResponsavel: { responsavel: string; total: number; ativos: number }[];
  porPlano: { plano: string; total: number }[];
  porUF: { uf: string; total: number }[];
  porRamo: { ramo: string; total: number }[];
  porGrupo: { grupo: string; total: number }[];
}

export function summarizeChecklist(rows: ChecklistRow[]): ChecklistSummary {
  const isAtivo = (r: ChecklistRow) => /ativo/i.test(r.condicao) && !/inativo/i.test(r.condicao);
  const ativos = rows.filter(isAtivo).length;

  const groupBy = <T extends string>(key: (r: ChecklistRow) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = key(r) || "—";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const respMap = new Map<string, { total: number; ativos: number }>();
  for (const r of rows) {
    const k = r.responsavel || "—";
    const cur = respMap.get(k) || { total: 0, ativos: 0 };
    cur.total += 1;
    if (isAtivo(r)) cur.ativos += 1;
    respMap.set(k, cur);
  }
  const porResponsavel = [...respMap.entries()]
    .map(([responsavel, v]) => ({ responsavel, total: v.total, ativos: v.ativos }))
    .sort((a, b) => b.total - a.total);

  return {
    total: rows.length,
    ativos,
    inativos: rows.length - ativos,
    porResponsavel,
    porPlano: groupBy((r) => r.equipe).map(([plano, total]) => ({ plano, total })),
    porUF: groupBy((r) => r.uf).map(([uf, total]) => ({ uf, total })),
    porRamo: groupBy((r) => r.ramo).map(([ramo, total]) => ({ ramo, total })),
    porGrupo: groupBy((r) => r.grupo).map(([grupo, total]) => ({ grupo, total })),
  };
}
