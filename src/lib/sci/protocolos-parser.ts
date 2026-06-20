// Parser flexível para "Relatório de Protocolos" exportado pelo SCI.
// Detecta colunas dinamicamente a partir do cabeçalho (varia entre exportações).
import * as XLSX from "xlsx";

export type ProtocoloCategoria = "declaracao" | "memoria" | "imposto" | "documento_fiscal" | "outros";

export interface ProtocoloRow {
  numero: string;
  data: string;            // ISO yyyy-mm-dd quando possível
  dataObj: Date | null;
  cliente: string;
  cnpj: string;
  tipo: string;            // tipo de protocolo / serviço
  descricao: string;
  status: string;
  responsavel: string;
  origem: string;          // entrada/saída/interno
  observacao: string;
  relatorio: string;       // nome do relatório / módulo
  referencia: string;      // competência / referência (ex.: 01/2026)
  valor: number;           // valor do protocolo (com correção pt-BR)
  categoria: ProtocoloCategoria;
}

// Conserta texto que veio em UTF-8 mas foi lido como latin1 (mojibake típico:
// "Ã§Ã£o" -> "ção", "Ãª" -> "ê", "Ã³" -> "ó", etc.).
export function fixMojibake(s: string): string {
  if (!s || typeof s !== "string") return s;
  if (!/Ã[\x80-\xBF]|Â[\x80-\xBF]/.test(s)) return s;
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // Só usa se reduziu mojibake
    if ((decoded.match(/Ã/g)?.length || 0) < (s.match(/Ã/g)?.length || 0)) return decoded;
    return s;
  } catch { return s; }
}

export function classifyCategoria(relatorio: string, descricao = "", tipo = ""): ProtocoloCategoria {
  const t = (relatorio + " " + descricao + " " + tipo).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Documento fiscal: NFS-e, NF-e, CT-e, MDF-e, NFC-e
  if (/nota\s*fiscal\s*(de\s*)?servic[oa]s?\s*eletron/.test(t)) return "documento_fiscal";
  if (/\bnfs-?e\b|\bnf-?e\b|\bnfc-?e\b|\bct-?e\b|\bmdf-?e\b/.test(t)) return "documento_fiscal";
  if (/nota\s*fiscal\s*eletron/.test(t)) return "documento_fiscal";
  if (/conhecimento.*transporte.*eletron/.test(t)) return "documento_fiscal";

  // Declaração: Simples Nacional - Declaração / Recibo / Extrato, DCTF, DEFIS, ECD, ECF, etc.
  if (/simples\s*nacional.*(declarac|recibo|extrato)/.test(t)) return "declaracao";
  if (/(declarac|recibo|dctf|defis|ecd|ecf|sped|gia|dirf|dimob|reinf|esocial)/.test(t)) return "declaracao";
  if (/\bextrato\b/.test(t)) return "declaracao";

  // Retenção de PIS/CSLL/Cofins (e variantes) é imposto, não memória.
  if (/retenc.*(pis|csll|cofins|irrf|inss|iss)/.test(t) || /(pis|csll|cofins|irrf|iss).*retenc/.test(t)) return "imposto";

  // Memória de cálculo: demonstrativos, parcelamentos, apurações, Bloco M, retenções, cálculos
  if (/demonstrativo/.test(t)) return "memoria";
  if (/relat[oó]?rio\s*parcelament/.test(t)) return "memoria";
  if (/bloco\s*m/.test(t)) return "memoria";
  if (/relatorio\s+de\s+retenc/.test(t)) return "memoria";
  if (/(memoria|apurac|memoria\s*de\s*calculo)/.test(t)) return "memoria";

  // Demais relatórios = impostos (guias, DARF, DAS, GPS, GARE, etc.)
  return "imposto";
}

const norm = (s: unknown) =>
  String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function decodeCsvText(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const win1252 = new TextDecoder("windows-1252", { fatal: false }).decode(bytes);
  const score = (s: string) => {
    const head = s.slice(0, 2000);
    return (head.match(/�/g)?.length || 0) * 10 +
      (head.match(/Ã|Â/g)?.length || 0) * 2 -
      (/Refer[eê�]ncia|Refer.ncia/i.test(head) ? 30 : 0) -
      (/Relat[oó]rio|Relat.rio/i.test(head) ? 10 : 0);
  };
  return score(win1252) < score(utf8) ? win1252 : utf8;
}

function parseCsvRows(text: string): any[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiters = [";", ",", "\t"];
  const delim = delimiters.sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      row.push(cell); cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

function findCol(headers: string[], candidates: string[]): number {
  const normalizedCandidates = candidates.map((c) => norm(c));
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (!h) continue;
    for (const c of normalizedCandidates) {
      if (h === c || h.includes(c)) return i;
    }
  }
  return -1;
}

function findColLoose(headers: string[], candidates: (string | RegExp)[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (!h) continue;
    for (const c of candidates) {
      if (typeof c === "string") {
        const n = norm(c);
        if (h === n || h.includes(n)) return i;
      } else if (c.test(h)) return i;
    }
  }
  return -1;
}

function findContentCol(rows: any[][], headerIdx: number, patterns: RegExp[]): number {
  const maxCols = Math.max(...rows.slice(headerIdx, headerIdx + 40).map((r) => r?.length || 0), 0);
  let best = -1;
  let bestScore = 0;
  for (let col = 0; col < maxCols; col++) {
    let score = 0;
    for (let r = headerIdx + 1; r < Math.min(rows.length, headerIdx + 80); r++) {
      const value = norm(rows[r]?.[col]);
      if (value && patterns.some((p) => p.test(value))) score++;
    }
    if (score > bestScore) { bestScore = score; best = col; }
  }
  return bestScore > 0 ? best : -1;
}

// Converte valores com vírgula decimal (pt-BR) ou ponto (en-US) para number.
// Heurística: se houver "," é separador decimal e "." separador de milhar (pt-BR).
// Caso contrário, "." é decimal.
export function parseBR(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[R$\s]/g, "").replace(/[^\d.,\-]/g, "");
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    // Se houver mais de um ponto, são separadores de milhar (pt-BR sem vírgula)
    const dots = s.match(/\./g)?.length || 0;
    if (dots > 1) {
      s = s.replace(/\./g, "");
    }
    // se houver apenas 1 ponto, mantém como decimal
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Normaliza "Referência" do SCI para o formato canônico "MM/AAAA".
// Aceita: "dd/mm/aaaa", "jan/26", "Jan/2026", "01/2026", "01/26", "2026-01", "1/26", etc.
const MES_ABREV: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};
export function normalizeReferencia(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
  }
  if (typeof v === "number" && isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d?.m && d?.y) return `${String(d.m).padStart(2, "0")}/${d.y}`;
  }
  const s = String(v).trim();
  if (!s) return "";
  const norm2 = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // dd/mm/aaaa ou dd-mm-aaaa: a referência vem como data; usa somente mm/aaaa.
  let m = norm2.match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let y = m[3];
    if (y.length === 2) y = (Number(y) >= 70 ? "19" : "20") + y;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${String(month).padStart(2, "0")}/${y}`;
    }
  }
  // jan/26 ou jan/2026
  m = norm2.match(/^([a-z]{3,})\s*[\/\-\s]\s*(\d{2,4})$/);
  if (m) {
    const mo = MES_ABREV[m[1].slice(0, 3)];
    if (mo) {
      let y = m[2];
      if (y.length === 2) y = (Number(y) >= 70 ? "19" : "20") + y;
      return `${mo}/${y}`;
    }
  }
  // 01/2026 ou 01/26 ou 1/26
  m = norm2.match(/^(\d{1,2})\s*[\/\-]\s*(\d{2,4})$/);
  if (m) {
    const mo = String(Number(m[1])).padStart(2, "0");
    let y = m[2];
    if (y.length === 2) y = (Number(y) >= 70 ? "19" : "20") + y;
    if (Number(mo) >= 1 && Number(mo) <= 12) return `${mo}/${y}`;
  }
  // 2026-01 ou 2026/01
  m = norm2.match(/^(\d{4})\s*[\/\-]\s*(\d{1,2})/);
  if (m) {
    const mo = String(Number(m[2])).padStart(2, "0");
    if (Number(mo) >= 1 && Number(mo) <= 12) return `${mo}/${m[1]}`;
  }
  return s; // mantém original se não conseguir normalizar
}

export function referenciaToMesKey(v: unknown): string | null {
  const ref = normalizeReferencia(v);
  const m = ref.match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[2]}-${m[1].padStart(2, "0")}`;
}

function parseDate(v: unknown): { iso: string; obj: Date | null } {
  if (v == null || v === "") return { iso: "", obj: null };
  if (v instanceof Date) {
    return { iso: v.toISOString().slice(0, 10), obj: v };
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
      return { iso: dt.toISOString().slice(0, 10), obj: dt };
    }
  }
  const s = String(v).trim();
  // dd/mm/yyyy (pt-BR): preserva a string ORIGINAL (dd/mm/aaaa) no campo `data`,
  // sem converter para ISO, para garantir que mm/aaaa seja lido direto da string.
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    const dayN = Number(d), moN = Number(mo), yN = Number(y);
    if (moN >= 1 && moN <= 12 && dayN >= 1 && dayN <= 31) {
      const dt = new Date(Date.UTC(yN, moN - 1, dayN));
      if (!isNaN(dt.getTime()) && dt.getUTCMonth() === moN - 1 && dt.getUTCDate() === dayN) {
        // mantém formato pt-BR original: "dd/mm/aaaa"
        return { iso: `${String(dayN).padStart(2, "0")}/${String(moN).padStart(2, "0")}/${yN}`, obj: dt };
      }
    }
  }
  // yyyy-mm-dd (ISO) — construir em UTC
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) {
    const yN = Number(m2[1]), moN = Number(m2[2]), dayN = Number(m2[3]);
    const dt = new Date(Date.UTC(yN, moN - 1, dayN));
    if (!isNaN(dt.getTime())) return { iso: m2[0], obj: dt };
  }
  return { iso: s, obj: null };
}

export async function parseSciProtocolos(file: File): Promise<ProtocoloRow[]> {
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);
  let json: any[][];
  if (isCsv) {
    json = parseCsvRows(decodeCsvText(buf));
  } else {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  }
  if (!json.length) return [];

  // Conserta mojibake célula a célula (defesa em profundidade).
  for (let i = 0; i < json.length; i++) {
    const row = json[i] || [];
    for (let j = 0; j < row.length; j++) {
      if (typeof row[j] === "string") row[j] = fixMojibake(row[j]);
    }
  }

  let headerIdx = 0;
  let bestHeaderScore = 0;
  for (let i = 0; i < Math.min(25, json.length); i++) {
    const row = json[i] || [];
    const txt = row.map((c) => norm(c)).join("|");
    const score =
      (/(cliente|empresa|razao social|nome empresarial)/.test(txt) ? 2 : 0) +
      (/(protocolo|numero|n\.|nº|n°)/.test(txt) ? 2 : 0) +
      (/(relatorio|relatorios|modulo)/.test(txt) ? 3 : 0) +
      (/(referencia|competencia|periodo|mes\/ano)/.test(txt) ? 1 : 0) +
      (/(valor|vlr|total)/.test(txt) ? 1 : 0) +
      (/(data|responsavel|status|situacao|tipo)/.test(txt) ? 1 : 0);
    if (score > bestHeaderScore && row.filter(Boolean).length > 1) {
      bestHeaderScore = score;
      headerIdx = i;
    }
  }
  const headers: string[] = (json[headerIdx] || []).map((c: unknown) => fixMojibake(String(c || "")));

  const colNumero = findCol(headers, ["protocolo", "numero", "nº", "n°", "n."]);
  const colData = findCol(headers, ["data emissao", "data emissão", "data abertura", "data prot", "data"]);
  const colCliente = findCol(headers, ["razao social", "razão social", "cliente", "empresa"]);
  const colCnpj = findCol(headers, ["cnpj", "cpf"]);
  const colTipo = findCol(headers, ["tipo", "servico", "serviço", "categoria"]);
  const colDesc = findCol(headers, ["descricao", "descrição", "assunto", "documento"]);
  const colStatus = findCol(headers, ["status", "situacao", "situação"]);
  const colResp = findCol(headers, ["responsavel", "responsável", "usuario", "usuário", "atendente"]);
  const colOrigem = findCol(headers, ["origem", "entrada", "saida", "saída", "tipo de movimento"]);
  const colObs = findCol(headers, ["observacao", "observação", "obs"]);
  let colRel = findCol(headers, ["relatorio", "relatório", "relatorios", "relatórios", "nome relatorio", "nome relatório", "modulo", "módulo"]);
  if (colRel < 0) {
    colRel = findContentCol(json, headerIdx, [/simples\s+nacional/, /relatorio/, /declarac/, /recibo/, /bloco\s*m/, /retenc/, /darf|das|gps|gare|irpj|csll|pis|cofins|inss|fgts/]);
  }
  const colRef = findColLoose(headers, ["referencia", "referência", /refer.ncia/, "competencia", "competência", /compet.ncia/, "ref.", "periodo", "período", "mes/ano", "mês/ano"]);
  const colVal = findCol(headers, ["valor", "vl ", "vlr", "total"]);

  const out: ProtocoloRow[] = [];
  for (let i = headerIdx + 1; i < json.length; i++) {
    const row = json[i] || [];
    if (!row.length) continue;
    const cliente = colCliente >= 0 ? fixMojibake(String(row[colCliente] || "")).trim() : "";
    const numero = colNumero >= 0 ? String(row[colNumero] || "").trim() : "";
    if (!cliente && !numero) continue;
    const d = parseDate(colData >= 0 ? row[colData] : null);
    const relatorio = colRel >= 0 ? fixMojibake(String(row[colRel] || "")).trim() : "";
    const descricao = colDesc >= 0 ? fixMojibake(String(row[colDesc] || "")).trim() : "";
    const tipo = colTipo >= 0 ? fixMojibake(String(row[colTipo] || "")).trim() : "";
    out.push({
      numero,
      data: d.iso,
      dataObj: d.obj,
      cliente,
      cnpj: colCnpj >= 0 ? String(row[colCnpj] || "").trim() : "",
      tipo,
      descricao,
      status: colStatus >= 0 ? fixMojibake(String(row[colStatus] || "")).trim() : "",
      responsavel: colResp >= 0 ? fixMojibake(String(row[colResp] || "")).trim() : "",
      origem: colOrigem >= 0 ? fixMojibake(String(row[colOrigem] || "")).trim() : "",
      observacao: colObs >= 0 ? fixMojibake(String(row[colObs] || "")).trim() : "",
      relatorio,
      referencia: colRef >= 0 ? normalizeReferencia(row[colRef]) : "",
      valor: colVal >= 0 ? parseBR(row[colVal]) : 0,
      categoria: classifyCategoria(relatorio, descricao, tipo),
    });
  }
  return out;
}

// Aplica mapa de responsáveis vindo do checklist (CNPJ -> responsável) sobre rows
// de protocolos sem responsável atribuído. Retorna nova lista (não muta a original).
export function applyResponsaveisFromChecklist(
  rows: ProtocoloRow[],
  mapa: Map<string, string>,
): ProtocoloRow[] {
  if (!mapa.size) return rows;
  const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
  const empresaNumero = (s: string) => {
    const m = String(s || "").trim().match(/^(\d+)\s*-/);
    return m ? m[1].replace(/^0+/, "") || "0" : "";
  };
  return rows.map((r) => {
    if (r.responsavel) return r;
    const k = onlyDigits(r.cnpj);
    const cod = empresaNumero(r.cliente);
    const resp = (cod && mapa.get(`sci:${cod}`)) || (k && mapa.get(k)) || mapa.get((r.cliente || "").toLowerCase().trim()) || "";
    return resp ? { ...r, responsavel: resp } : r;
  });
}

export function buildResponsavelMap(checklist: { cnpj?: string; empresa?: string; responsavel?: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of checklist) {
    if (!c.responsavel) continue;
    const sci = String((c as any).sci || "").replace(/\D/g, "").replace(/^0+/, "") || "";
    if (sci) m.set(`sci:${sci}`, c.responsavel);
    const cnpj = (c.cnpj || "").replace(/\D/g, "");
    if (cnpj) m.set(cnpj, c.responsavel);
    if (c.empresa) m.set(c.empresa.toLowerCase().trim(), c.responsavel);
  }
  return m;
}

// =================== Resumo ===================
export interface ProtocolosSummary {
  total: number;
  totalClientes: number;
  porStatus: { chave: string; quantidade: number }[];
  porTipo: { chave: string; quantidade: number }[];
  porResponsavel: { chave: string; quantidade: number; qtdImpostos: number; valorImpostos: number }[];
  porCliente: { chave: string; cnpj: string; quantidade: number; qtdImpostos: number; valorImpostos: number }[];
  porMes: { mes: string; quantidade: number }[];
  porRelatorio: { chave: string; quantidade: number; valor: number }[];
  porReferencia: { chave: string; quantidade: number; valor: number }[];
  porCategoria: { chave: string; quantidade: number; valor: number }[];
  declaracoes: { relatorio: string; quantidade: number; valor: number }[];
  memoriasCalculo: { relatorio: string; quantidade: number; valor: number }[];
  impostos: { relatorio: string; quantidade: number; valor: number }[];
  documentosFiscais: { relatorio: string; quantidade: number; valor: number }[];
  abertos: number;
  concluidos: number;
  valorTotal: number;
  valorTotalImpostos: number;
}

const MES_NOMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Reidrata dataObj se a row foi serializada via JSON (em string ISO).
function ensureDate(r: ProtocoloRow): Date | null {
  if (r.dataObj instanceof Date && !isNaN(r.dataObj.getTime())) return r.dataObj;
  if (typeof r.dataObj === "string" && r.dataObj) {
    const d = new Date(r.dataObj);
    if (!isNaN(d.getTime())) return d;
  }
  if (r.data) {
    const d = new Date(r.data);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function summarizeProtocolos(rows: ProtocoloRow[]): ProtocolosSummary {
  const groupBy = (key: (r: ProtocoloRow) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = key(r) || "—";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([chave, quantidade]) => ({ chave, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  };

  const groupByValor = (key: (r: ProtocoloRow) => string) => {
    const m = new Map<string, { q: number; v: number }>();
    for (const r of rows) {
      const k = key(r) || "—";
      const cur = m.get(k) || { q: 0, v: 0 };
      cur.q += 1;
      cur.v += r.valor || 0;
      m.set(k, cur);
    }
    return [...m.entries()].map(([chave, x]) => ({ chave, quantidade: x.q, valor: x.v }))
      .sort((a, b) => b.quantidade - a.quantidade);
  };

  const porCliente = (() => {
    const m = new Map<string, { cnpj: string; q: number; qi: number; vi: number }>();
    for (const r of rows) {
      const k = r.cliente || "—";
      const cur = m.get(k) || { cnpj: r.cnpj, q: 0, qi: 0, vi: 0 };
      cur.q += 1;
      if (r.categoria === "imposto") { cur.qi += 1; cur.vi += r.valor || 0; }
      m.set(k, cur);
    }
    return [...m.entries()].map(([chave, v]) => ({
      chave, cnpj: v.cnpj, quantidade: v.q, qtdImpostos: v.qi, valorImpostos: v.vi,
    })).sort((a, b) => b.valorImpostos - a.valorImpostos || b.quantidade - a.quantidade);
  })();

  const porResponsavel = (() => {
    const m = new Map<string, { q: number; qi: number; vi: number }>();
    for (const r of rows) {
      const k = r.responsavel || "—";
      const cur = m.get(k) || { q: 0, qi: 0, vi: 0 };
      cur.q += 1;
      if (r.categoria === "imposto") { cur.qi += 1; cur.vi += r.valor || 0; }
      m.set(k, cur);
    }
    return [...m.entries()].map(([chave, v]) => ({
      chave, quantidade: v.q, qtdImpostos: v.qi, valorImpostos: v.vi,
    })).sort((a, b) => b.valorImpostos - a.valorImpostos || b.quantidade - a.quantidade);
  })();

  // Agrupamento mensal: USA EXCLUSIVAMENTE r.referencia (coluna "Referência" do CSV).
  // Se vier como dd/mm/aaaa, usa somente mm/aaaa.
  const mensal = new Map<string, number>();
  for (const r of rows) {
    const k = referenciaToMesKey(r.referencia);
    if (!k) continue;
    mensal.set(k, (mensal.get(k) || 0) + 1);
  }
  const porMes = [...mensal.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, q]) => {
      const [y, mo] = k.split("-");
      return { mes: `${MES_NOMES[Number(mo) - 1]}/${y.slice(2)}`, quantidade: q };
    });

  const isConcluido = (s: string) => /conclu|finaliz|entreg|encerr|baixa/i.test(s);
  const concluidos = rows.filter((r) => isConcluido(r.status)).length;
  const valorTotal = rows.reduce((a, r) => a + (r.valor || 0), 0);

  const porRelatorio = groupByValor((r) => r.relatorio);
  const declaracoes = porRelatorio
    .filter((p) => rows.some((r) => r.relatorio === p.chave && r.categoria === "declaracao"))
    .map((p) => ({ relatorio: p.chave, quantidade: p.quantidade, valor: p.valor }));
  const memoriasCalculo = porRelatorio
    .filter((p) => rows.some((r) => r.relatorio === p.chave && r.categoria === "memoria"))
    .map((p) => ({ relatorio: p.chave, quantidade: p.quantidade, valor: p.valor }));
  const impostos = porRelatorio
    .filter((p) => rows.some((r) => r.relatorio === p.chave && r.categoria === "imposto"))
    .map((p) => ({ relatorio: p.chave, quantidade: p.quantidade, valor: p.valor }));
  const documentosFiscais = porRelatorio
    .filter((p) => rows.some((r) => r.relatorio === p.chave && r.categoria === "documento_fiscal"))
    .map((p) => ({ relatorio: p.chave, quantidade: p.quantidade, valor: p.valor }));

  // Por referência: somente NÃO-declarações (declarações não totalizam valor por referência).
  const porReferencia = (() => {
    const m = new Map<string, { q: number; v: number }>();
    for (const r of rows) {
      if (r.categoria === "declaracao") continue;
      const k = r.referencia || "—";
      const cur = m.get(k) || { q: 0, v: 0 };
      cur.q += 1;
      cur.v += r.valor || 0;
      m.set(k, cur);
    }
    return [...m.entries()].map(([chave, x]) => ({ chave, quantidade: x.q, valor: x.v }))
      .sort((a, b) => b.valor - a.valor);
  })();

  const valorTotalImpostos = rows.reduce((a, r) => a + (r.categoria === "imposto" ? (r.valor || 0) : 0), 0);


  const catLabel = (c: string) =>
    c === "declaracao" ? "Declaração" : c === "memoria" ? "Memória de cálculo" : c === "imposto" ? "Imposto" : c === "documento_fiscal" ? "Documento fiscal" : "Outros";
  const porCategoria = (() => {
    const m = new Map<string, { q: number; v: number }>();
    for (const r of rows) {
      const k = catLabel(r.categoria);
      const cur = m.get(k) || { q: 0, v: 0 };
      cur.q += 1;
      cur.v += r.valor || 0;
      m.set(k, cur);
    }
    return [...m.entries()].map(([chave, x]) => ({ chave, quantidade: x.q, valor: x.v }))
      .sort((a, b) => b.quantidade - a.quantidade);
  })();

  return {
    total: rows.length,
    totalClientes: new Set(rows.map((r) => r.cliente).filter(Boolean)).size,
    porStatus: groupBy((r) => r.status),
    porTipo: groupBy((r) => r.tipo),
    porResponsavel,
    porCliente,
    porMes,
    porRelatorio,
    porReferencia,
    porCategoria,
    declaracoes,
    memoriasCalculo,
    impostos,
    documentosFiscais,
    abertos: rows.length - concluidos,
    concluidos,
    valorTotal,
    valorTotalImpostos,
  };
}
