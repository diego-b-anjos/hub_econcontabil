// Parser para o relatório "Gestão de Entregas" exportado do Acessórias.
// Layout esperado (CSV ; separado, codificação latin1/utf8):
// Obrigação / Tarefa; Tipo; Empresa; EmpID; CNPJ; Cidade; Estado;
// Prazo legal; Prazo Técnico; Data da entrega; Status; Departamento;
// Responsável prazo; Responsável entrega; Competência; Protocolo

export interface AcessoriasRow {
  obrigacao: string;
  tipo: string;
  empresa: string;
  empId: string;
  cnpj: string;
  cidade: string;
  estado: string;
  prazoLegal: string; // dd/mm/yyyy
  prazoTecnico: string;
  dataEntrega: string;
  status: string;
  departamento: string;
  responsavelPrazo: string;
  responsavelEntrega: string;
  competencia: string; // mm/yyyy
  protocolo: string;
}

export type StatusBucket =
  | "antecipada"
  | "no_prazo"
  | "atrasada"
  | "justificada"
  | "pendente"
  | "outros";

export function classifyStatus(status: string): StatusBucket {
  const s = status.toLowerCase();
  if (s.includes("antecipada")) return "antecipada";
  if (s.includes("pztéc") || s.includes("prazo técnico") || s.includes("pztec") || s.includes("prazo tecnico")) return "no_prazo";
  if (s.includes("justific")) return "justificada";
  if (s.includes("atras")) return "atrasada";
  if (s.includes("pendente")) return "pendente";
  return "outros";
}

export const STATUS_LABELS: Record<StatusBucket, string> = {
  antecipada: "Entregue antecipada",
  no_prazo: "Entregue no prazo",
  atrasada: "Atrasada",
  justificada: "Atraso justificado",
  pendente: "Pendente",
  outros: "Outros",
};

export const STATUS_COLORS: Record<StatusBucket, string> = {
  antecipada: "hsl(142 71% 45%)",
  no_prazo: "hsl(199 89% 48%)",
  justificada: "hsl(38 92% 50%)",
  atrasada: "hsl(0 84% 60%)",
  pendente: "hsl(262 83% 58%)",
  outros: "hsl(220 9% 46%)",
};

function splitCsvLine(line: string): string[] {
  // Suporta campos com aspas e separador ;
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (ch === ";" && !inQ) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseAcessoriasCSV(text: string): AcessoriasRow[] {
  // Remove BOM
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows: AcessoriasRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]);
    if (c.length < 15) continue;
    rows.push({
      obrigacao: c[0] || "",
      tipo: c[1] || "",
      empresa: c[2] || "",
      empId: c[3] || "",
      cnpj: c[4] || "",
      cidade: c[5] || "",
      estado: c[6] || "",
      prazoLegal: c[7] || "",
      prazoTecnico: c[8] || "",
      dataEntrega: c[9] || "",
      status: c[10] || "",
      departamento: c[11] || "",
      responsavelPrazo: c[12] || "",
      responsavelEntrega: c[13] || "",
      competencia: c[14] || "",
      protocolo: c[15] || "",
    });
  }
  return rows;
}

export interface AcessoriasSummary {
  total: number;
  porStatus: Record<StatusBucket, number>;
  porDepartamento: { nome: string; total: number; atrasadas: number }[];
  porResponsavel: { nome: string; total: number; atrasadas: number; noPrazo: number }[];
  porCompetencia: { competencia: string; total: number; atrasadas: number; entregues: number }[];
  porObrigacao: { nome: string; total: number; atrasadas: number }[];
  porEmpresa: { empresa: string; cnpj: string; total: number; atrasadas: number; pendentes: number }[];
  taxaPontualidade: number; // % entregue (antecipada+no_prazo) sobre concluídas
  taxaAtraso: number;
}

export function summarize(rows: AcessoriasRow[]): AcessoriasSummary {
  const porStatus: Record<StatusBucket, number> = {
    antecipada: 0, no_prazo: 0, atrasada: 0, justificada: 0, pendente: 0, outros: 0,
  };
  const dep = new Map<string, { total: number; atrasadas: number }>();
  const resp = new Map<string, { total: number; atrasadas: number; noPrazo: number }>();
  const comp = new Map<string, { total: number; atrasadas: number; entregues: number }>();
  const obr = new Map<string, { total: number; atrasadas: number }>();
  const emp = new Map<string, { empresa: string; cnpj: string; total: number; atrasadas: number; pendentes: number }>();

  for (const r of rows) {
    const b = classifyStatus(r.status);
    porStatus[b]++;

    const d = dep.get(r.departamento) || { total: 0, atrasadas: 0 };
    d.total++; if (b === "atrasada") d.atrasadas++;
    dep.set(r.departamento || "—", d);

    const respKey = r.responsavelPrazo || r.responsavelEntrega || "—";
    const rr = resp.get(respKey) || { total: 0, atrasadas: 0, noPrazo: 0 };
    rr.total++;
    if (b === "atrasada") rr.atrasadas++;
    if (b === "antecipada" || b === "no_prazo") rr.noPrazo++;
    resp.set(respKey, rr);

    const cc = comp.get(r.competencia) || { total: 0, atrasadas: 0, entregues: 0 };
    cc.total++;
    if (b === "atrasada") cc.atrasadas++;
    if (b === "antecipada" || b === "no_prazo" || b === "justificada") cc.entregues++;
    comp.set(r.competencia || "—", cc);

    const oo = obr.get(r.obrigacao) || { total: 0, atrasadas: 0 };
    oo.total++; if (b === "atrasada") oo.atrasadas++;
    obr.set(r.obrigacao || "—", oo);

    const empKey = r.cnpj || r.empresa;
    const ee = emp.get(empKey) || { empresa: r.empresa, cnpj: r.cnpj, total: 0, atrasadas: 0, pendentes: 0 };
    ee.total++;
    if (b === "atrasada") ee.atrasadas++;
    if (b === "pendente") ee.pendentes++;
    emp.set(empKey, ee);
  }

  const concluidas = porStatus.antecipada + porStatus.no_prazo + porStatus.atrasada + porStatus.justificada;
  const pontuais = porStatus.antecipada + porStatus.no_prazo;
  const taxaPontualidade = concluidas > 0 ? (pontuais / concluidas) * 100 : 0;
  const taxaAtraso = concluidas > 0 ? (porStatus.atrasada / concluidas) * 100 : 0;

  const sortByTotal = <T extends { total: number }>(arr: T[]) => arr.sort((a, b) => b.total - a.total);
  const sortByComp = (a: { competencia: string }, b: { competencia: string }) => {
    const pa = a.competencia.split("/"); const pb = b.competencia.split("/");
    return (pa[1] + pa[0]).localeCompare(pb[1] + pb[0]);
  };

  return {
    total: rows.length,
    porStatus,
    porDepartamento: sortByTotal(Array.from(dep.entries()).map(([nome, v]) => ({ nome, ...v }))),
    porResponsavel: sortByTotal(Array.from(resp.entries()).map(([nome, v]) => ({ nome, ...v }))),
    porCompetencia: Array.from(comp.entries()).map(([competencia, v]) => ({ competencia, ...v })).sort(sortByComp),
    porObrigacao: sortByTotal(Array.from(obr.entries()).map(([nome, v]) => ({ nome, ...v }))),
    porEmpresa: sortByTotal(Array.from(emp.entries()).map(([, v]) => v)),
    taxaPontualidade,
    taxaAtraso,
  };
}

// ===== Merge inteligente para acompanhamento mensal =====
// Chave única de uma tarefa importada
export function rowKey(r: AcessoriasRow): string {
  return [r.cnpj || r.empresa, r.obrigacao, r.competencia, r.prazoLegal].join("|");
}

export interface MergePreview {
  novasCompetencias: string[];          // competências que ainda não existem na base
  competenciasSobrepostas: string[];    // competências presentes em ambos
  empresasNovas: string[];              // empresas (CNPJ) novas
  totalAtual: number;
  totalNovo: number;
  iguais: number;                       // tarefas já existentes idênticas
  atualizadas: number;                  // mesma chave, status/entrega mudaram
  novas: number;                        // chaves inéditas
  removidasNoNovo: number;              // tarefas no atual ausentes no novo (mesma comp.)
}

export function previewMerge(atuais: AcessoriasRow[], novos: AcessoriasRow[]): MergePreview {
  const compsAtuais = new Set(atuais.map((r) => r.competencia).filter(Boolean));
  const compsNovas = new Set(novos.map((r) => r.competencia).filter(Boolean));
  const empresasAtuais = new Set(atuais.map((r) => r.cnpj || r.empresa));
  const empresasNovasSet = new Set(novos.map((r) => r.cnpj || r.empresa));

  const novasCompetencias = [...compsNovas].filter((c) => !compsAtuais.has(c));
  const competenciasSobrepostas = [...compsNovas].filter((c) => compsAtuais.has(c));
  const empresasNovas = [...empresasNovasSet].filter((e) => !empresasAtuais.has(e));

  const mapAtual = new Map(atuais.map((r) => [rowKey(r), r]));
  const mapNovo = new Map(novos.map((r) => [rowKey(r), r]));

  let iguais = 0, atualizadas = 0, novas = 0;
  for (const [k, n] of mapNovo) {
    const a = mapAtual.get(k);
    if (!a) novas++;
    else if (a.status === n.status && a.dataEntrega === n.dataEntrega) iguais++;
    else atualizadas++;
  }
  let removidasNoNovo = 0;
  for (const [k, a] of mapAtual) {
    if (compsNovas.has(a.competencia) && !mapNovo.has(k)) removidasNoNovo++;
  }

  return {
    novasCompetencias, competenciasSobrepostas, empresasNovas,
    totalAtual: atuais.length, totalNovo: novos.length,
    iguais, atualizadas, novas, removidasNoNovo,
  };
}

export type MergeMode =
  | "append"          // só adiciona competências novas, ignora sobrepostas
  | "replace_overlap" // substitui as competências sobrepostas inteiras
  | "update_only"     // mantém atuais, mas atualiza status/entrega das chaves coincidentes (não adiciona inéditas das comp. sobrepostas)
  | "merge_full"      // adiciona inéditas + atualiza coincidentes
  | "overwrite_all";  // descarta tudo e usa só o novo

export function applyMerge(atuais: AcessoriasRow[], novos: AcessoriasRow[], mode: MergeMode): AcessoriasRow[] {
  if (mode === "overwrite_all") return [...novos];
  const compsNovas = new Set(novos.map((r) => r.competencia));
  const mapNovo = new Map(novos.map((r) => [rowKey(r), r]));

  if (mode === "append") {
    const filtrados = novos.filter((r) => !atuais.some((a) => a.competencia === r.competencia));
    return [...atuais, ...filtrados];
  }

  if (mode === "replace_overlap") {
    const base = atuais.filter((r) => !compsNovas.has(r.competencia));
    return [...base, ...novos];
  }

  if (mode === "update_only") {
    return atuais.map((a) => {
      const k = rowKey(a);
      const n = mapNovo.get(k);
      return n ? { ...a, status: n.status, dataEntrega: n.dataEntrega, protocolo: n.protocolo || a.protocolo } : a;
    });
  }

  // merge_full
  const mapAtual = new Map(atuais.map((r) => [rowKey(r), r]));
  for (const [k, n] of mapNovo) {
    const a = mapAtual.get(k);
    if (a) mapAtual.set(k, { ...a, status: n.status, dataEntrega: n.dataEntrega, protocolo: n.protocolo || a.protocolo });
    else mapAtual.set(k, n);
  }
  return Array.from(mapAtual.values());
}
