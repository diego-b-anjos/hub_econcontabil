import type {
  RelatorioFiscal,
  Debito,
  Parcelamento,
  DadosCadastrais,
  Orgao,
  DiagnosticoImport,
  CertidaoNegativa,
} from "./types";

let _pdfjsLib: typeof import("pdfjs-dist") | null = null;
async function getPdfjs() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import("pdfjs-dist");
    _pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${_pdfjsLib.version}/build/pdf.worker.min.js`;
  }
  return _pdfjsLib;
}

const toNumber = (s: string) =>
  Number(String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;

const isMoney = (s: string) => /^[\d.]+,\d{2}$/.test(s);
// Competência aceita:
//  - Mensal:     MM/AAAA       (ex.: 01/2024)
//  - Trimestral: NT/AAAA       (ex.: 1T/2024, 2T/2024) — IRPJ e CSLL
//  - Anual:      AAAA          (ex.: 2024) — usado em INSS/CP do 13º
const isComp = (s: string) =>
  /^\d{2}\/\d{4}$/.test(s) || /^[1-4]T\/\d{4}$/i.test(s) || /^(19|20)\d{2}$/.test(s);
const isDate = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s);
const isReceitaCode = (s: string) => /^\d{4}-\d{2}\s*-\s*\S/.test(s);
const isStatus = (s: string) =>
  /^(DEVEDOR|EM PARCELAMENTO|SUSPENSO|EXIGIBILIDADE|REGULAR)$/i.test(s);

function normalizeCompetencia(comp: string, receita = "", contexto = ""): string {
  const c = comp.trim().toUpperCase();
  const base = `${receita} ${contexto}`.toUpperCase();
  const data = c.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (data && /\b(IRPJ|CSLL)\b/.test(base)) {
    const mes = Number(data[2]);
    const tri = Math.min(4, Math.max(1, Math.ceil(mes / 3)));
    return `${tri}T/${data[3]}`;
  }
  if (/^(19|20)\d{2}$/.test(c) && /\bCP\b|INSS|PREVID|13[ºO]?\s*SAL[ÁA]RIO/.test(base)) {
    return `13º/${c}`;
  }
  return c;
}

interface PageItem { x: number; y: number; str: string; }

async function pdfToPages(file: File): Promise<{ pages: PageItem[][]; rawText: string }> {
  const pdfjsLib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: PageItem[][] = [];
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Algumas páginas (relatório RFB em paisagem) vêm com rotação 90° na matriz
    // de transformação do texto: [a,b,c,d,e,f] = [0, h, -h, 0, x, y].
    // Nesse caso, transform[4] varia POUCO entre itens da mesma "linha visual"
    // (é a coordenada vertical do PDF) e transform[5] é a coordenada horizontal.
    // Para que toda a lógica de "x = horizontal, y = vertical (DESC = topo)" funcione,
    // detectamos se o texto está rotacionado e trocamos os eixos.
    const itemsRaw = (content.items as Array<{ str: string; transform: number[] }>).filter(
      (it) => it.str && it.str.trim(),
    );
    const isRotated = itemsRaw.some((it) => it.transform[1] !== 0 || it.transform[2] !== 0);
    const items: PageItem[] = itemsRaw.map((it) => {
      if (isRotated) {
        // Texto rotacionado em 90° (a=0, d=0, b>0, c<0):
        //   X visual = transform[5]
        //   Y visual = transform[4]  (cresce para BAIXO, então invertemos para que DESC = topo)
        return { x: it.transform[5], y: -it.transform[4], str: it.str.trim() };
      }
      return { x: it.transform[4], y: it.transform[5], str: it.str.trim() };
    });
    pages.push(items);

    // Linhas reconstruídas só para extrair texto livre (cadastro, parcelamentos)
    const buckets = new Map<number, PageItem[]>();
    for (const it of items) {
      const yb = Math.round(it.y);
      if (!buckets.has(yb)) buckets.set(yb, []);
      buckets.get(yb)!.push(it);
    }
    for (const y of [...buckets.keys()].sort((a, b) => b - a)) {
      lines.push(buckets.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.str).join(" "));
    }
  }
  return { pages, rawText: lines.join("\n") };
}

/* ---------- Extração de cadastro a partir do texto livre ---------- */
function parseCadastro(raw: string): { cad: DadosCadastrais; dataAtualizacao: string; faltantes: string[] } {
  const cad: DadosCadastrais = {};
  const faltantes: string[] = [];

  const cnpj = raw.match(/CNPJ:\s*([\d./-]{14,18})/);
  if (cnpj) cad.cnpj = cnpj[1]; else faltantes.push("CNPJ");

  // Razão social: aparece como "33.385.917 - LDM CONSTRUCOES E REFORMAS LTDA"
  const razao = raw.match(/[\d.]{8,}\s*-\s*([A-ZÇÃÁÉÍÓÚÂÊÔÀÜÑ][A-ZÇÃÁÉÍÓÚÂÊÔÀÜÑ0-9 .&/-]{4,})/);
  if (razao) cad.razaoSocial = razao[1].trim().replace(/\s+/g, " ");
  else faltantes.push("Razão Social");

  const mun = raw.match(/Município:\s*([A-ZÇÃÁÉÍÓÚÂÊÔÀÜÑ ]+?)(?:\s+UF:|$|\n)/i);
  if (mun) cad.municipio = mun[1].trim();
  const uf = raw.match(/UF:\s*([A-Z]{2})/);
  if (uf) cad.uf = uf[1];
  if (!mun || !uf) faltantes.push("Município/UF");

  const ab = raw.match(/Data de Abertura:\s*(\d{2}\/\d{2}\/\d{4})/);
  if (ab) cad.abertura = ab[1];

  const dt = raw.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
  return { cad, dataAtualizacao: dt ? dt[1] : new Date().toLocaleString("pt-BR"), faltantes };
}

/* ---------- Reconstrução de tabelas pelo layout vertical de colunas ---------- */
type ColType = "money" | "comp" | "date" | "receita" | "status";

interface DetectedColumn {
  y: number;
  type: ColType;
  items: PageItem[];
}

function detectColumns(items: PageItem[], tolerance = 1): DetectedColumn[] {
  const buckets = new Map<number, PageItem[]>();
  for (const it of items) {
    const yb = Math.round(it.y);
    if (!buckets.has(yb)) buckets.set(yb, []);
    buckets.get(yb)!.push(it);
  }
  const cols: DetectedColumn[] = [];
  for (const [y, arr] of buckets) {
    const cleaned = arr.filter((a) => !/[:]/.test(a.str));
    if (cleaned.length < 2) continue;
    const types: ColType[] = cleaned.map((a) =>
      isMoney(a.str) ? "money"
        : isComp(a.str) ? "comp"
          : isDate(a.str) ? "date"
            : isReceitaCode(a.str) ? "receita"
              : isStatus(a.str) ? "status"
                : ("other" as ColType)
    );
    const counts: Record<string, number> = {};
    types.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
    const [topType, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] as [ColType, number];
    if ((topType as string) === "other") continue;
    const purityThreshold = tolerance > 1 ? 0.5 : 0.7;
    if (topCount / cleaned.length < purityThreshold) continue;
    const colItems = cleaned.filter((_, i) => types[i] === topType).sort((a, b) => a.x - b.x);
    if (colItems.length < 2) continue;
    cols.push({ y, type: topType, items: colItems });
  }
  return cols;
}

/** Mapeia itens de uma coluna para as N posições de uma coluna-base, pelo X mais próximo. */
function alignToBase(col: DetectedColumn | undefined, baseXs: number[], maxDistance = 35): string[] {
  const N = baseXs.length;
  const out = new Array<string>(N).fill("");
  if (!col) return out;
  const used = new Set<number>();
  for (const it of [...col.items].sort((a, b) => a.x - b.x)) {
    let bestI = -1, bestD = Infinity;
    for (let i = 0; i < N; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(it.x - baseXs[i]);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    if (bestI >= 0 && bestD <= maxDistance) {
      out[bestI] = (out[bestI] ? out[bestI] + " " : "") + it.str;
      used.add(bestI);
    }
  }
  return out;
}

function groupItemsByBaseX(
  items: PageItem[],
  baseXs: number[],
  matcher: (value: string) => boolean,
  opts: { maxDistance?: number; minY?: number; maxY?: number } = {},
): PageItem[][] {
  const { maxDistance = 35, minY = -Infinity, maxY = Infinity } = opts;
  const grouped = baseXs.map(() => [] as PageItem[]);

  for (const it of items) {
    if (!matcher(it.str) || it.y < minY || it.y > maxY) continue;
    let bestI = -1;
    let bestD = Infinity;
    for (let i = 0; i < baseXs.length; i++) {
      const d = Math.abs(it.x - baseXs[i]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    if (bestI >= 0 && bestD <= maxDistance) grouped[bestI].push(it);
  }

  grouped.forEach((group) => group.sort((a, b) => b.y - a.y || a.x - b.x));
  return grouped;
}

function nearestLabeledValue(
  items: PageItem[],
  labelPattern: RegExp,
  valuePattern: RegExp,
  opts: { maxDx?: number; maxDy?: number } = {},
): string | undefined {
  const { maxDx = 120, maxDy = 60 } = opts;
  const labels = items.filter((it) => labelPattern.test(it.str));
  const values = items.filter((it) => valuePattern.test(it.str));
  let best: PageItem | undefined;
  let bestScore = Infinity;

  for (const label of labels) {
    for (const value of values) {
      const dx = Math.abs(value.x - label.x);
      const dy = Math.abs(value.y - label.y);
      if (dx > maxDx || dy > maxDy) continue;
      const score = dy * 2 + dx;
      if (score < bestScore) {
        bestScore = score;
        best = value;
      }
    }
  }

  return best?.str;
}

function dedupeParcelamentos(parcelamentos: Parcelamento[]): Parcelamento[] {
  const byKey = new Map<string, Parcelamento>();
  parcelamentos.forEach((p) => byKey.set(`${p.orgao}|${p.identificador}`, p));
  return [...byKey.values()];
}

/** Tenta reconstruir débitos SIEF de uma página. */
interface HeaderRef {
  cabY: number;
  xRightVlOrig: number;
  xRightSdoDev: number;
  xRightMulta: number;
  xRightJuros: number;
  xRightSdoCons: number;
}

function extractDebitosFromPage(
  items: PageItem[],
  orgao: Orgao,
  opts: { tolerance: number; headerRef?: HeaderRef } = { tolerance: 1 },
): {
  debitos: Debito[];
  reconhecida: boolean;
  numLinhas: number;
  headerRef?: HeaderRef;
} {
  // ============================================================
  // ABORDAGEM: Cada linha do PDF é detectada por agrupamento Y
  // dos itens. As colunas são definidas pela posição X do cabeçalho:
  //   Receita | PA/Exerc. | Dt. Vcto | Vl. Original | Sdo. Devedor
  //         | Multa | Juros | Sdo. Dev. Cons. | Situação
  // ============================================================

  // 1) Localiza o cabeçalho — usamos a Y onde "PA/Exerc." aparece
  const cabPA = items.find((it) => /^PA\/Exerc\.?$/i.test(it.str) || /^PA$/i.test(it.str));
  let cabY: number | undefined;
  let xRightVlOrig = 0, xRightSdoDev = 0, xRightMulta = 0, xRightJuros = 0, xRightSdoCons = 0;
  let headerRef: HeaderRef | undefined;

  if (cabPA) {
    cabY = cabPA.y;
    const cabItems = items.filter((it) => Math.abs(it.y - cabY!) < 14).sort((a, b) => a.x - b.x);
    const findHeader = (re: RegExp) => cabItems.find((it) => re.test(it.str));
    const hVlOrig = findHeader(/Original/i);
    const hSdoDev = findHeader(/Devedor/i) ?? findHeader(/^Sdo\.?$/i);
    const hMulta = findHeader(/^Multa$/i);
    const hJuros = findHeader(/^Juros$/i);
    const hSdoCons = findHeader(/Cons\.?/i) ?? findHeader(/Consolidad/i);
    if (!hMulta || !hJuros || !hSdoCons) {
      return { debitos: [], reconhecida: false, numLinhas: 0 };
    }
    const widthOf = (it: PageItem | undefined) => (it ? it.x + it.str.length * 4.5 : 0);
    xRightVlOrig = hVlOrig ? widthOf(hVlOrig) : widthOf(hSdoDev) - 70;
    xRightSdoDev = widthOf(hSdoDev);
    xRightMulta = widthOf(hMulta);
    xRightJuros = widthOf(hJuros);
    xRightSdoCons = widthOf(hSdoCons);
    headerRef = { cabY, xRightVlOrig, xRightSdoDev, xRightMulta, xRightJuros, xRightSdoCons };
  } else if (opts.headerRef) {
    // Página de continuação — sem cabeçalho próprio, usamos o da página anterior.
    cabY = +Infinity; // não filtra nenhum item por estar "acima do cabeçalho"
    xRightVlOrig = opts.headerRef.xRightVlOrig;
    xRightSdoDev = opts.headerRef.xRightSdoDev;
    xRightMulta = opts.headerRef.xRightMulta;
    xRightJuros = opts.headerRef.xRightJuros;
    xRightSdoCons = opts.headerRef.xRightSdoCons;
  } else {
    return { debitos: [], reconhecida: false, numLinhas: 0 };
  }

  // 2) Agrupa todos os itens em linhas (Y ~ mesma).
  // Usamos um bucket por inteiro de Y arredondado.
  const ROW_TOL = 2 * opts.tolerance;
  const rows = new Map<number, PageItem[]>();
  for (const it of items) {
    if (it.y > (cabY as number) - 2) continue; // ignora cabeçalho e tudo acima
    const key = Math.round(it.y / ROW_TOL) * ROW_TOL;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(it);
  }

  // 3) Para cada linha, identifica competência e money-cells por X.
  // Algumas linhas (IRPJ/CSLL trimestral) o "PA/Exerc." é quebrado em 2 linhas:
  //   linha N:    "2º"
  //   linha N+1:  "TRIM/2025"
  // Tratamos isso unindo "Nº" + "TRIM/AAAA" em "NT/AAAA".
  const sortedYs = [...rows.keys()].sort((a, b) => b - a); // topo → fundo

  type ParsedRow = {
    y: number;
    receita?: string;
    comp?: string;
    vcto?: string;
    vlOrig?: number;
    sdoDev?: number;
    multa?: number;
    juros?: number;
    sdoCons?: number;
    situacao?: string;
  };

  const xRightOf = (it: PageItem) => it.x + (it.str.length * 4.5);
  const nearestRight = (val: PageItem, targets: { name: keyof ParsedRow; x: number }[]) => {
    const r = xRightOf(val);
    let best: typeof targets[number] | undefined;
    let bd = Infinity;
    for (const t of targets) {
      const d = Math.abs(r - t.x);
      if (d < bd) { bd = d; best = t; }
    }
    return bd <= 30 ? best : undefined;
  };

  const monetaryTargets: { name: keyof ParsedRow; x: number }[] = [
    ...(xRightVlOrig ? [{ name: "vlOrig" as const, x: xRightVlOrig }] : []),
    ...(xRightSdoDev ? [{ name: "sdoDev" as const, x: xRightSdoDev }] : []),
    { name: "multa", x: xRightMulta },
    { name: "juros", x: xRightJuros },
    { name: "sdoCons", x: xRightSdoCons },
  ];

  const parsed: ParsedRow[] = [];
  for (const y of sortedYs) {
    const lineItems = rows.get(y)!.sort((a, b) => a.x - b.x);
    const row: ParsedRow = { y };
    const textosEsq: { x: number; str: string }[] = [];

    for (const it of lineItems) {
      const s = it.str;
      // PA/Exerc. (mensal/trimestral/anual ou "Nº" como "1º".."4º")
      if (isComp(s)) {
        if (!row.comp) row.comp = s;
        continue;
      }
      if (/^[1-4][ºo]$/i.test(s)) {
        // Parte 1 do trimestre — completaremos com "TRIM/AAAA" da próxima linha
        if (!row.comp) row.comp = s;
        continue;
      }
      if (/^TRIM\/\d{4}$/i.test(s)) {
        // Vai ser usado para preencher row.comp se ele for "Nº"
        row.comp = (row.comp && /^[1-4][ºo]$/i.test(row.comp))
          ? `${row.comp.replace(/[ºo]/i, "T").toUpperCase()}/${s.split("/")[1]}`
          : (row.comp || s);
        continue;
      }
      if (isDate(s)) {
        if (!row.vcto) row.vcto = s;
        continue;
      }
      if (isStatus(s)) {
        row.situacao = s;
        continue;
      }
      if (isMoney(s)) {
        const tgt = nearestRight(it, monetaryTargets);
        if (tgt) (row as Record<string, unknown>)[tgt.name] = toNumber(s);
        continue;
      }
      // Demais textos (provável receita) — guarda para reconstrução
      textosEsq.push({ x: it.x, str: s });
    }

    // Receita = textos à esquerda concatenados (ex: "8109-02 - PIS")
    if (textosEsq.length) {
      row.receita = textosEsq.sort((a, b) => a.x - b.x).map((t) => t.str).join(" ").trim();
    }
    parsed.push(row);
  }

  // 4) Mescla linhas adjacentes do tipo "Nº" + "TRIM/AAAA" (IRPJ/CSLL).
  // Quando a linha N tem comp = "2º" e a linha N+1 começa com "TRIM/2025",
  // a linha N+1 não terá receita/valores: vai apenas completar a competência da N.
  for (let i = 0; i < parsed.length - 1; i++) {
    const cur = parsed[i];
    const nxt = parsed[i + 1];
    if (cur.comp && /^[1-4][ºo]$/i.test(cur.comp)) {
      // procura "TRIM/AAAA" próximo (próximas 1-3 linhas)
      for (let k = 1; k <= 3 && i + k < parsed.length; k++) {
        const cand = parsed[i + k];
        if (!cand.comp || cand.vlOrig || cand.sdoCons) continue;
        // Caso A: a linha de baixo já vem normalizada como "1T/2025"
        if (/^[1-4]T\/\d{4}$/i.test(cand.comp)) {
          cur.comp = cand.comp;
          parsed[i + k] = { ...cand, comp: undefined };
          break;
        }
        // Caso B: a linha de baixo é apenas "TRIM/2025"; combinamos o "Nº" desta linha
        // com o ano da próxima para formar "NT/AAAA".
        const tm = cand.comp.match(/^TRIM\/(\d{4})$/i);
        if (tm) {
          const tri = cur.comp.replace(/[ºo]/i, "").trim();
          cur.comp = `${tri}T/${tm[1]}`;
          parsed[i + k] = { ...cand, comp: undefined };
          break;
        }
      }
    }

    // Em alguns PDFs da RFB o PA/Exerc. fica em uma sublinha abaixo da linha
    // que contém Receita + valores. Nesses casos, trazemos a competência para
    // a linha financeira imediatamente anterior.
    const curTemValores = !!(cur.vlOrig || cur.sdoDev || cur.sdoCons);
    if (curTemValores && !cur.comp) {
      for (let k = 1; k <= 3 && i + k < parsed.length; k++) {
        const cand = parsed[i + k];
        if (cand.vlOrig || cand.sdoCons || cand.receita) break;
        if (!cand.comp) continue;
        if (/^[1-4][ºo]$/i.test(cand.comp)) {
          const prox = parsed[i + k + 1];
          if (prox?.comp && /^[1-4]T\/\d{4}$/i.test(prox.comp)) {
            cur.comp = prox.comp;
            parsed[i + k] = { ...cand, comp: undefined };
            parsed[i + k + 1] = { ...prox, comp: undefined };
            break;
          }
          const tm = prox?.comp?.match(/^TRIM\/(\d{4})$/i);
          if (tm) {
            const tri = cand.comp.replace(/[ºo]/i, "").trim();
            cur.comp = `${tri}T/${tm[1]}`;
            parsed[i + k] = { ...cand, comp: undefined };
            parsed[i + k + 1] = { ...prox!, comp: undefined };
            break;
          }
        } else if (isComp(cand.comp)) {
          cur.comp = cand.comp;
          parsed[i + k] = { ...cand, comp: undefined };
          break;
        }
      }
    }
  }

  // 5) Para cada linha "completa" (tem comp + algum valor), gera o débito.
  // Receita pode estar na linha anterior se ficar vazia (caso raro de quebra).
  let lastReceita = "";
  const debitos: Debito[] = [];
  for (const row of parsed) {
    if (row.receita) lastReceita = row.receita;
    if (!row.comp || !isComp(row.comp)) continue;
    if (!row.vlOrig && !row.sdoCons && !row.sdoDev) continue;

    const vlOrig = row.vlOrig || 0;
    const sdoDev = row.sdoDev || vlOrig;
    const multa = row.multa || 0;
    const juros = row.juros || 0;
    const sdoCons = row.sdoCons || (sdoDev + multa + juros);

    const receita = (row.receita || lastReceita || "Débito").trim();
    debitos.push({
      id: crypto.randomUUID(),
      orgao,
      receita,
      competencia: normalizeCompetencia(row.comp, receita),
      vencimento: row.vcto || undefined,
      valorOriginal: vlOrig,
      saldoDevedor: sdoDev,
      multa,
      juros,
      total: sdoCons,
      situacao: row.situacao || "DEVEDOR",
      parcelado: false,
    });
  }

  // Helpers legados não mais usados na nova abordagem.
  void groupItemsByBaseX; void detectColumns; void alignToBase;

  return { debitos, reconhecida: debitos.length > 0, numLinhas: parsed.length, headerRef };
}

/* ---------- Parcelamentos e PGFN a partir do texto livre ---------- */
function extractParcelamentos(rawText: string): Parcelamento[] {
  const out: Parcelamento[] = [];

  // PARCSN/PARCMEI – Simples Nacional
  if (/Parcelamento\s*\(PARCSN/i.test(rawText)) {
    const m = rawText.match(/PARCSN[\s\S]{0,400}?Parcelas em atraso\s*(\d+)/i);
    out.push({
      id: crypto.randomUUID(),
      orgao: "RFB",
      identificador: "PARCSN - Simples Nacional",
      modalidade: "Parcelamento Simples Nacional",
      parcelasEmAtraso: m ? Number(m[1]) : undefined,
      situacao: "EM PARCELAMENTO",
    });
  }

  // SIEFPAR
  const siefparRe = /Parcelamento:\s*([\d.\-]{8,})[\s\S]{0,400}?Parcelas em Atraso:\s*(\d+)[\s\S]{0,200}?Valor em Atraso:\s*([\d.]+,\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = siefparRe.exec(rawText))) {
    out.push({
      id: crypto.randomUUID(),
      orgao: "RFB",
      identificador: m[1],
      modalidade: "Parcelamento Simplificado (SIEFPAR)",
      parcelasEmAtraso: Number(m[2]),
      valorEmAtraso: toNumber(m[3]),
      situacao: "EM PARCELAMENTO",
    });
  }

  // SISPAR / PGFN
  const sisparRe = /(\b\d{8,9}\b)\s+(TRANSACAO[^\n]+)/g;
  while ((m = sisparRe.exec(rawText))) {
    out.push({
      id: crypto.randomUUID(),
      orgao: "PGFN",
      identificador: m[1],
      modalidade: m[2].trim().slice(0, 140),
      situacao: "EM TRANSAÇÃO",
    });
  }

  return out;
}

function extractParcelamentosFromPages(pages: PageItem[][]): Parcelamento[] {
  const out: Parcelamento[] = [];

  pages.forEach((items) => {
    const hasPARCSN = items.some((it) => /Parcelamento \(PARCSN\/PARCMEI\)/i.test(it.str));
    if (hasPARCSN) {
      const atraso = nearestLabeledValue(items, /Parcelas em atraso/i, /^\d+$/);
      out.push({
        id: crypto.randomUUID(),
        orgao: "RFB",
        identificador: "PARCSN - Simples Nacional",
        modalidade: "Parcelamento Simples Nacional",
        parcelasEmAtraso: atraso ? Number(atraso) : undefined,
        situacao: "EM PARCELAMENTO",
      });
    }

    const hasSIEFPAR = items.some((it) => /Parcelamento \(SIEFPAR\)/i.test(it.str));
    if (hasSIEFPAR) {
      const identificador = items.find((it) => /^[\d.\-]{12,}$/.test(it.str))?.str;
      const parcelasEmAtraso = nearestLabeledValue(items, /Parcelas em Atraso:?/i, /^\d+$/, { maxDx: 16, maxDy: 120 });
      const valorEmAtraso = nearestLabeledValue(items, /Valor em Atraso:?/i, /^[\d.]+,\d{2}$/, { maxDx: 16, maxDy: 120 });
      out.push({
        id: crypto.randomUUID(),
        orgao: "RFB",
        identificador: identificador || "SIEFPAR",
        modalidade: "Parcelamento Simplificado (SIEFPAR)",
        parcelasEmAtraso: parcelasEmAtraso ? Number(parcelasEmAtraso) : undefined,
        valorEmAtraso: valorEmAtraso ? toNumber(valorEmAtraso) : undefined,
        situacao: "EM PARCELAMENTO",
      });
    }
  });

  return dedupeParcelamentos(out);
}

function extractInscricoesPGFN(rawText: string): Debito[] {
  const out: Debito[] = [];
  const re = /(\d{2}\.\d\.\d{2}\.\d{6}-\d{2})\s+(\d{4}-[A-ZÇÃ ]+?)\s+(\d{2}\/\d{2}\/\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawText))) {
    out.push({
      id: crypto.randomUUID(),
      orgao: "PGFN",
      receita: m[2].trim(),
      competencia: m[3],
      valorOriginal: 0,
      saldoDevedor: 0,
      multa: 0,
      juros: 0,
      total: 0,
      parcelado: true,
      situacao: "Negociado no SISPAR",
      observacao: `Inscrição ${m[1]}`,
    });
  }
  return out;
}

/* ---------- DARF — Documento de Arrecadação de Receitas Federais ---------- */
function isDarfText(rawText: string): boolean {
  return /Documento de Arrecada[çc][ãa]o\s+de Receitas Federais/i.test(rawText) &&
    /Composi[çc][ãa]o do Documento de Arrecada[çc][ãa]o/i.test(rawText);
}

function parseDarfText(
  rawText: string,
  fileName: string,
  paginas: number,
  pages?: PageItem[][],
): { data: Partial<RelatorioFiscal>; diagnostico: DiagnosticoImport } {
  const diag: DiagnosticoImport = {
    arquivo: fileName,
    paginas,
    paginasComTabela: [],
    debitosEncontrados: 0,
    parcelamentosEncontrados: 0,
    camposNaoEncontrados: [],
    avisos: [],
    linhasNaoReconhecidas: [],
    tipoDetectado: "darf",
  };

  const cad: DadosCadastrais = {};
  const cnpj = rawText.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
  if (cnpj) cad.cnpj = cnpj[0];
  const razao = rawText.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+([^\n]{5,})/);
  if (razao) cad.razaoSocial = razao[1].trim().replace(/\s+/g, " ");

  const dataGeracao = rawText.match(/\b(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\b/);
  const dataAtualizacao = dataGeracao?.[1] || new Date().toLocaleString("pt-BR");

  // ===== Extração baseada em layout (pages) =====
  // O DARF tem uma "Composição" repetida em cada página com colunas:
  //   Código | Denominação | Principal | Multa | Juros | Total
  // A linha visual de cada débito ocupa 4 buckets de Y consecutivos:
  //   [A] <codigo 4d> + <denominação>
  //   [B] principal | multa | juros | total
  //   [C] <subcod 2d> + complemento
  //   [D] PA <comp> Vencimento <data>
  const debitos: Debito[] = [];
  if (pages && pages.length) {
    // Buffer para um débito cuja linha "PA ... Vencimento ..." caiu na página seguinte
    let carry: {
      codigo: string;
      denominacao: string;
      principal: number;
      multa: number;
      juros: number;
      total: number;
      complemento: string;
    } | null = null;

    for (let p = 0; p < pages.length; p++) {
      const items = pages[p];
      if (!items.length) continue;
      // Bucketiza por Y inteiro
      const buckets = new Map<number, PageItem[]>();
      for (const it of items) {
        const y = Math.round(it.y);
        if (!buckets.has(y)) buckets.set(y, []);
        buckets.get(y)!.push(it);
      }
      const ys = [...buckets.keys()].sort((a, b) => b - a);
      const lineStr = (y: number) =>
        buckets.get(y)!.sort((a, b) => a.x - b.x).map((it) => it.str).join(" ");
      // Se há débito pendente da página anterior, procura "PA ... Vencimento ..." no topo
      if (carry) {
        for (let j = 0; j < Math.min(ys.length, 12); j++) {
          const txt = lineStr(ys[j]).trim();
          const pm = txt.match(/PA\s+((?:\d{2}\/\d{2}\/\d{4})|(?:\d{2}\/\d{4})|(?:\d{4}))\s+Vencimento\s+(\d{2}\/\d{2}\/\d{4})/i);
          if (pm) {
            debitos.push({
              id: crypto.randomUUID(),
              orgao: "RFB",
              receita: `${carry.codigo} - ${carry.denominacao}`,
              competencia: normalizeCompetencia(pm[1], carry.denominacao, carry.complemento),
              vencimento: pm[2],
              valorOriginal: carry.principal,
              saldoDevedor: carry.principal,
              multa: carry.multa,
              juros: carry.juros,
              total: carry.total,
              parcelado: false,
              situacao: "DARF A PAGAR",
              observacao: carry.complemento || `Documento DARF ${fileName}`,
            });
            break;
          }
        }
        carry = null;
      }
      // Localiza linha do cabeçalho "Código ... Denominação ... Principal"
      const headerIdx = ys.findIndex((y) => /Código/i.test(lineStr(y)) && /Denominaç/i.test(lineStr(y)));
      if (headerIdx < 0) continue;
      diag.paginasComTabela.push(p + 1);

      let i = headerIdx + 1;
      while (i < ys.length) {
        const y = ys[i];
        const itemsA = buckets.get(y)!.sort((a, b) => a.x - b.x);
        const txtA = itemsA.map((it) => it.str).join(" ").trim();
        // Para de ler ao chegar no rodapé "SENDA ... Página: X/Y"
        if (/^SENDA|^Página:|AUTENTICA|Pague com|^Documento de Arrecada|^Número:|^CNPJ:|^Pagar até|^Valor:/i.test(txtA)) {
          i++;
          continue;
        }
        // Linha A: começa com código de 4 dígitos
        const codeMatch = txtA.match(/^(\d{4})\s+(.+)$/);
        if (!codeMatch) { i++; continue; }
        const codigo = codeMatch[1];
        const denominacao = codeMatch[2].replace(/\s+/g, " ").trim();

        // Linha B (próximo bucket): 4 valores monetários
        if (i + 1 >= ys.length) break;
        const itemsB = buckets.get(ys[i + 1])!.sort((a, b) => a.x - b.x);
        const moneys = itemsB.filter((it) => isMoney(it.str)).map((it) => it.str);
        if (moneys.length < 4) { i++; continue; }
        const principal = toNumber(moneys[0]);
        const multa = toNumber(moneys[1]);
        const juros = toNumber(moneys[2]);
        const total = toNumber(moneys[3]);

        // Linha C: "21 CP TERCEIROS - INCRA - 13 SALÁRIO" (complemento)
        let complemento = "";
        if (i + 2 < ys.length) {
          const txtC = lineStr(ys[i + 2]).trim();
          if (!/^PA\b/i.test(txtC) && !/^\d{4}\s/.test(txtC)) {
            complemento = txtC.replace(/\s+/g, " ");
          }
        }

        // Linha D (ou C se complemento ausente): "PA <comp> Vencimento <date>"
        let pa = "";
        let venc = "";
        for (let k = 2; k <= 4 && i + k < ys.length; k++) {
          const txt = lineStr(ys[i + k]).trim();
          const m = txt.match(/PA\s+((?:\d{2}\/\d{2}\/\d{4})|(?:\d{2}\/\d{4})|(?:\d{4}))\s+Vencimento\s+(\d{2}\/\d{2}\/\d{4})/i);
          if (m) {
            pa = m[1];
            venc = m[2];
            i += k; // avança até a linha do PA
            break;
          }
        }
        if (!pa) {
          // O "PA ... Vencimento" pode ter caído na próxima página; guarda como carry.
          carry = { codigo, denominacao, principal, multa, juros, total, complemento };
          i++;
          continue;
        }

        const receita = `${codigo} - ${denominacao}`;
        const competencia = normalizeCompetencia(pa, denominacao, complemento);
        debitos.push({
          id: crypto.randomUUID(),
          orgao: "RFB",
          receita,
          competencia,
          vencimento: venc,
          valorOriginal: principal,
          saldoDevedor: principal,
          multa,
          juros,
          total,
          parcelado: false,
          situacao: "DARF A PAGAR",
          observacao: complemento || `Documento DARF ${fileName}`,
        });
        i++;
      }
    }

    if (carry) {
      diag.linhasNaoReconhecidas.push(`${carry.codigo} ${carry.denominacao} — PA/Vencimento não localizado`);
    }
  }

  // ===== Fallback: extração baseada em rawText (caso pages não venha) =====
  const linhas = pages && pages.length ? [] : rawText.split("\n");
  const rowRe = /^(\d{4})\s+(.+?)\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})\s*$/;
  const paRe = /\bPA\s+((?:\d{2}\/\d{4})|(?:\d{2}\/\d{2}\/\d{4})|(?:\d{4}))\s+Vencimento\s+(\d{2}\/\d{2}\/\d{4})/i;
  let pendente: {
    codigo: string;
    denominacao: string;
    principal: number;
    multa: number;
    juros: number;
    total: number;
    complemento: string[];
  } | null = null;

  const finalizar = (comp?: string, venc?: string) => {
    if (!pendente || !comp) return;
    const contexto = pendente.complemento.join(" ");
    debitos.push({
      id: crypto.randomUUID(),
      orgao: "RFB",
      receita: `${pendente.codigo} - ${pendente.denominacao}`,
      competencia: normalizeCompetencia(comp, pendente.denominacao, contexto),
      vencimento: venc,
      valorOriginal: pendente.principal,
      saldoDevedor: pendente.principal,
      multa: pendente.multa,
      juros: pendente.juros,
      total: pendente.total,
      parcelado: false,
      situacao: "DARF A PAGAR",
      observacao: contexto || `Documento DARF ${fileName}`,
    });
    pendente = null;
  };

  for (const linha of linhas) {
    const s = linha.trim().replace(/\s+/g, " ");
    const row = s.match(rowRe);
    if (row) {
      if (pendente) {
        diag.linhasNaoReconhecidas.push(`${pendente.codigo} ${pendente.denominacao} — PA/Vencimento não localizado`);
      }
      pendente = {
        codigo: row[1],
        denominacao: row[2].trim(),
        principal: toNumber(row[3]),
        multa: toNumber(row[4]),
        juros: toNumber(row[5]),
        total: toNumber(row[6]),
        complemento: [],
      };
      continue;
    }

    if (!pendente) continue;
    const pa = s.match(paRe);
    if (pa) {
      finalizar(pa[1], pa[2]);
      continue;
    }
    if (s && !/^(SENDA|P[áa]gina:|Documento|Composi[çc][ãa]o|C[óo]digo|CNPJ|Per[ií]odo|Observa[çc][õo]es|web|Valor|Pague|AUTENTICA|\d{10,})/i.test(s)) {
      pendente.complemento.push(s);
    }
  }
  if (pendente) diag.linhasNaoReconhecidas.push(`${pendente.codigo} ${pendente.denominacao} — PA/Vencimento não localizado`);

  const totalDocM = rawText.match(/Valor Total do Documento\s*\n\s*([\d.]+,\d{2})/i) ||
    rawText.match(/Valor:\s*([\d.]+,\d{2})/i);
  const totalDoc = totalDocM ? toNumber(totalDocM[1]) : 0;
  const totalExtraido = debitos.reduce((s, d) => s + d.total, 0);
  if (totalDoc > 0) {
    const diff = Math.abs(totalDoc - totalExtraido);
    diag.avisos.push(`DARF — Total informado: ${totalDoc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}; total extraído: ${totalExtraido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
    if (diff > 0.05) diag.avisos.push("⚠ Divergência entre o total do DARF e a soma das linhas extraídas; confira o documento importado.");
  }

  diag.debitosEncontrados = debitos.length;
  if (!debitos.length) diag.avisos.push("Nenhuma composição de DARF foi reconhecida.");
  else if (!diag.paginasComTabela.length) {
    diag.paginasComTabela = Array.from({ length: paginas }, (_, i) => i + 1);
  }
  return { data: { cadastro: cad, dataAtualizacao, debitos }, diagnostico: diag };
}

/* ---------- Função pública ---------- */
export type ForceType = "rfb" | "pgfn-regularize" | "municipal-osasco" | "municipal-generico";

export async function parsePdf(
  file: File,
  orgaoHint?: Orgao,
  mode: "auto" | "coluna" = "auto",
  forceType?: ForceType,
): Promise<{ data: Partial<RelatorioFiscal>; diagnostico: DiagnosticoImport }> {
  const { pages, rawText } = await pdfToPages(file);

  const diag: DiagnosticoImport = {
    arquivo: file.name,
    paginas: pages.length,
    paginasComTabela: [],
    debitosEncontrados: 0,
    parcelamentosEncontrados: 0,
    camposNaoEncontrados: [],
    avisos: [],
    linhasNaoReconhecidas: [],
    tipoDetectado: "desconhecido",
    modo: mode,
  };
  const tolerance = mode === "coluna" ? 2 : 1;

  const isSituacao =
    forceType === "rfb" ||
    /INFORMA[ÇC][OÕ]ES DE APOIO PARA EMISS[ÃA]O DE CERTID[ÃA]O|Diagn[oó]stico Fiscal/i.test(rawText);
  const isParcRFB = /Minhas D[ií]vidas e Pend[eê]ncias|Valor em atraso/i.test(rawText) && !isSituacao;
  const isOsasco =
    forceType === "municipal-osasco" ||
    (forceType !== "municipal-generico" &&
      /PREFEITURA DO MUNIC[ÍI]PIO DE OSASCO|SECRETARIA DE FINAN[ÇC]AS\s*-?\s*SF|Inscri[çc][ãa]o Municipal/i.test(rawText));
  // Quando o usuário escolhe explicitamente "PGFN — Regularize" no upload, forçamos o branch
  // mesmo que o texto extraído pelo pdf.js não bata com a heurística automática.
  const isPGFNRegularize =
    forceType === "pgfn-regularize" ||
    (/REGULARIZE/i.test(rawText) &&
      /Relat[óo]rio.*?(inscri[çc][õo]es em d[ií]vida ativa|Consolidado da D[ií]vida)/i.test(rawText));

  if (isDarfText(rawText)) {
    return parseDarfText(rawText, file.name, pages.length, pages);
  }

  // ===== Certidão Negativa de Débitos =====
  const isCNDNegativa =
    /n[ãa]o constam d[ée]bitos/i.test(rawText) &&
    /(Certid[ãa]o Negativa|D[ée]bitos\s+Tribut[áa]rios\s+N[ãa]o\s+Inscritos|D[ií]vida Ativa)/i.test(rawText);

  if (isCNDNegativa) {
    diag.tipoDetectado = "cnd-negativa";
    const cad: DadosCadastrais = {};
    const cnpjM = rawText.match(/CNPJ(?:\s*Base)?:\s*([\d./-]{8,18})/i);
    if (cnpjM) cad.cnpj = cnpjM[1];

    let emissor = "Fazenda Estadual";
    let orgao: Orgao = "Estadual";
    if (/PROCURADORIA\s+GERAL\s+DO\s+ESTADO|Procuradoria da D[ií]vida Ativa|PGE/i.test(rawText)) {
      emissor = "PGE — Procuradoria Geral do Estado";
    } else if (/Secretaria da Fazenda|SEFAZ|Fazenda e Planejamento/i.test(rawText)) {
      emissor = "SEFAZ — Secretaria da Fazenda Estadual";
    } else if (/Receita Federal|RFB/i.test(rawText)) {
      emissor = "Receita Federal do Brasil";
      orgao = "RFB";
    } else if (/Munic[ií]pio|Prefeitura/i.test(rawText)) {
      emissor = "Prefeitura Municipal";
      orgao = "Municipal";
    }
    const ufM = rawText.match(/Estado de\s+([A-ZÇÃÁÉÍÓÚ ]{3,})/);
    if (ufM) emissor += ` (${ufM[1].trim()})`;

    const numM = rawText.match(/Certid[ãa]o\s*n[ºo°]?\s*([\d.\-/]+)/i);
    const dtM = rawText.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/);
    const valM = rawText.match(/Validade\s*([^\n]+?)(?:Certid|Qualquer|$)/i);

    const cnd: CertidaoNegativa = {
      id: crypto.randomUUID(),
      orgao,
      emissor,
      numero: numM?.[1],
      dataEmissao: dtM?.[1],
      validade: valM?.[1]?.trim().slice(0, 80),
      arquivo: file.name,
    };
    diag.avisos.push(`Certidão NEGATIVA reconhecida — sem débitos no órgão "${emissor}".`);
    return {
      data: {
        cadastro: cad,
        dataAtualizacao: dtM?.[1] || new Date().toLocaleString("pt-BR"),
        certidoesNegativas: [cnd],
      },
      diagnostico: diag,
    };
  }

  if (isPGFNRegularize) {
    diag.tipoDetectado = "pgfn-regularize";
    const cad: DadosCadastrais = {};
    // No Regularize aparecem 2 linhas "CPF/CNPJ:" — uma do usuário logado (pode ser CPF)
    // e outra do devedor (CNPJ da empresa). Pegamos preferencialmente o CNPJ.
    const cnpjMatches = [...rawText.matchAll(/CPF\/CNPJ:\s*([\d./-]{11,18})/gi)].map((m) => m[1]);
    const cnpjEmpresa = cnpjMatches.find((c) => /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(c)) || cnpjMatches[0];
    if (cnpjEmpresa) cad.cnpj = cnpjEmpresa;
    const razaoM = rawText.match(/Devedor:\s*([A-ZÇÃÁÉÍÓÚÂÊÔÀÜÑ][A-ZÇÃÁÉÍÓÚÂÊÔÀÜÑ0-9 .&/-]{4,})/);
    if (razaoM) cad.razaoSocial = razaoM[1].trim().replace(/\s+/g, " ");
    const dtM = rawText.match(/Dados obtidos em\s*(\d{2}\/\d{2}\/\d{4}\s+[àa]s?\s*\d{2}:\d{2})/i);
    const dataAtualizacao = dtM ? dtM[1].replace(/\s+[àa]s?\s+/i, " ") : new Date().toLocaleString("pt-BR");

    const debitos: Debito[] = [];
    const parcelamentos: Parcelamento[] = [];

    // Classifica situação do parcelamento PGFN/SISPAR a partir do texto da coluna "Situação"
    // e de palavras-chave eventualmente presentes no relatório.
    const classificarSituacaoPGFN = (situacao: string, contexto: string): {
      parcelado: boolean;
      statusParc: "em-dia" | "em-atraso" | "rescisao" | "ativa";
      label: string;
    } => {
      const s = situacao.toUpperCase();
      const ctx = contexto.toUpperCase();
      const rescisao = /RESCIN|RESCIS[ÃA]O|CANCELAD/.test(s + " " + ctx);
      const atraso = /EM ATRASO|PARCELA[S]?\s+EM\s+ATRASO|INADIMPL|PENDENTE\s+DE\s+REGULARIZA/.test(s + " " + ctx);
      const negociado = /NEGOCIAD|SISPAR|SUSPENSA|GARANTIDA|TRANSAC/.test(s);
      if (rescisao) {
        return { parcelado: true, statusParc: "rescisao", label: "EM RESCISÃO (acordo PGFN)" };
      }
      if (atraso && negociado) {
        return { parcelado: true, statusParc: "em-atraso", label: "PARCELAMENTO EM ATRASO (PGFN/SISPAR)" };
      }
      if (negociado) {
        return { parcelado: true, statusParc: "em-dia", label: "SUSPENSO — parcelamento em dia (PGFN/SISPAR)" };
      }
      return { parcelado: false, statusParc: "ativa", label: situacao || "ATIVA EM COBRANÇA" };
    };

    // ===== Extração robusta por âncora de inscrição =====
    // Localiza TODAS as inscrições no texto (formatos PGFN comuns + variantes):
    //   - Previdenciária:   "18.512.463-1"   (NN.NNN.NNN-N)
    //   - Simples Nacional: "80 4 21 433423-03" ou "80.4.21.433423-03"
    //   - Numérico cheio:   "80421433423-03" (sem separadores)
    //   - PGFN clássico:    "1 2 345 678901-23" (variável)
    const inscRe = /(\d{2}[.\s]\d{1,2}[.\s]\d{2}[.\s]\d{6}-\d{2}|\d{2}\.\d{3}\.\d{3}-\d|\d{11,12}-\d{2})\b/g;
    type Anchor = { inscricao: string; index: number };
    const anchorsAll: Anchor[] = [];
    let am: RegExpExecArray | null;
    while ((am = inscRe.exec(rawText))) {
      anchorsAll.push({ inscricao: am[1].replace(/\s+/g, " ").trim(), index: am.index });
    }
    // De-duplica âncoras consecutivas/próximas que apontam para a mesma inscrição
    const anchors: Anchor[] = [];
    const seenAt = new Map<string, number>();
    for (const a of anchorsAll) {
      const last = seenAt.get(a.inscricao);
      if (last === undefined || a.index - last > 200) {
        anchors.push(a);
        seenAt.set(a.inscricao, a.index);
      }
    }

    const moneyRe = /R\$\s*([\d.]+,\d{2})/;
    const dateRe = /(\d{2}\/\d{2}\/\d{4})/;
    const grabAfter = (block: string, label: RegExp): string | undefined => {
      const m = block.match(label);
      if (!m || m.index === undefined) return undefined;
      const after = block.slice(m.index, m.index + 200);
      const mv = after.match(moneyRe);
      return mv?.[1];
    };

    for (let i = 0; i < anchors.length; i++) {
      const cur = anchors[i];
      const next = anchors[i + 1];
      const blockEnd = next ? next.index : Math.min(cur.index + 2500, rawText.length);
      // Estende um pouco para capturar "Encargo legal" que pode vir após a próxima âncora
      const block = rawText.slice(cur.index, Math.min(blockEnd + 400, rawText.length));

      const dataInscM = block.match(dateRe);
      const dataInsc = dataInscM?.[1] || "";

      // Situação inline (texto antes do "R$ valor consolidado")
      let situacao = "";
      const situacaoM = block.match(/(ATIVA[^\n\r]*?|NEGOCIAD[OA][^\n\r]*?|SUSPENSA[^\n\r]*?|GARANTIDA[^\n\r]*?|RESCIN[^\n\r]*?|EXTINTA[^\n\r]*?)\s+R\$/i);
      if (situacaoM) situacao = situacaoM[1].trim().replace(/\s+/g, " ");
      // Fallback: cabeçalho de seção ("Negociada (n)", "Ativa em Cobrança (n)")
      if (!situacao) {
        const ctxAntes = rawText.slice(Math.max(0, cur.index - 600), cur.index);
        const secM = ctxAntes.match(/(Negociad[ao]|Ativa em Cobran[çc]a|Suspens[ao]|Garantid[ao]|Rescindid[ao]|Extint[ao])/i);
        if (secM) situacao = secM[1].toUpperCase();
      }

      // Valor consolidado: primeiro R$ encontrado próximo da situação
      const vlConsM = block.match(moneyRe);
      const vlCons = vlConsM?.[1];

      const principal = grabAfter(block, /Principal/i);
      const multa = grabAfter(block, /\bMulta\b/i);
      const juros = grabAfter(block, /Juros\s*de\s*mora/i);
      const encargo = grabAfter(block, /Encargo\s*legal/i);

      const cls = classificarSituacaoPGFN(situacao, block);
      const totalNum = toNumber(vlCons || "0") ||
        (toNumber(principal || "0") + toNumber(multa || "0") + toNumber(juros || "0") + toNumber(encargo || "0"));

      debitos.push({
        id: crypto.randomUUID(),
        orgao: "PGFN",
        receita: `Inscrição em Dívida Ativa ${cur.inscricao}`,
        competencia: dataInsc ? dataInsc.slice(3) : "",
        vencimento: dataInsc || undefined,
        valorOriginal: toNumber(principal || vlCons || "0"),
        saldoDevedor: toNumber(principal || vlCons || "0"),
        multa: toNumber(multa || "0"),
        juros: toNumber(juros || "0") + toNumber(encargo || "0"),
        total: totalNum,
        parcelado: cls.parcelado,
        situacao: cls.label,
        statusParc: cls.statusParc === "ativa" ? "devedor" : cls.statusParc,
        observacao: `Inscrição ${cur.inscricao}${dataInsc ? ` • Inscrita em ${dataInsc}` : ""} • Situação Regularize: ${situacao || "—"}${encargo ? ` • Encargo legal R$ ${encargo}` : ""}`,
      });
    }

    // Consolida parcelamentos PGFN/SISPAR a partir das inscrições negociadas
    const negociadas = debitos.filter((d) => d.parcelado);
    if (negociadas.length) {
      const valorTotal = negociadas.reduce((s, d) => s + d.total, 0);
      const temAtraso = negociadas.some((d) => /ATRASO/i.test(d.situacao || ""));
      const temRescisao = negociadas.some((d) => /RESCIS/i.test(d.situacao || ""));
      let situacao = "EM PARCELAMENTO (em dia)";
      if (temRescisao) situacao = "EM RESCISÃO";
      else if (temAtraso) situacao = "PARCELAMENTO COM PARCELAS EM ATRASO";
      parcelamentos.push({
        id: crypto.randomUUID(),
        orgao: "PGFN",
        identificador: "SISPAR — Negociações PGFN",
        modalidade: `Negociação PGFN/SISPAR (${negociadas.length} inscrição(ões))`,
        valorEmAtraso: temAtraso || temRescisao ? valorTotal : undefined,
        situacao,
      });
      if (temRescisao) {
        diag.avisos.push("⚠ Acordo PGFN/SISPAR em RESCISÃO — exigibilidade pode ser restabelecida; valide com a Fazenda.");
      } else if (temAtraso) {
        diag.avisos.push("⚠ Parcelamento PGFN/SISPAR com parcelas em atraso — risco de rescisão do acordo.");
      } else {
        diag.avisos.push("Inscrições negociadas no SISPAR estão SUSPENSAS enquanto o acordo se mantiver em dia.");
      }
    }

    // Resumo: Quantidade e valor total
    const totQtd = rawText.match(/Quantidade de inscri[çc][õo]es selecionadas\*?:\s*(\d+)/i);
    const totVal = rawText.match(/Valor das inscri[çc][õo]es selecionadas\*?:\s*R\$\s*([\d.]+,\d{2})/i);
    if (totQtd && totVal) {
      diag.avisos.push(`PGFN — Resumo do relatório: ${totQtd[1]} inscrições, total R$ ${totVal[1]}.`);
    }

    diag.debitosEncontrados = debitos.length;
    diag.parcelamentosEncontrados = parcelamentos.length;
    if (!debitos.length) {
      // Fallback: varre linhas em busca de qualquer padrão numérico parecido com inscrição PGFN
      // (xx xxx xxxx ou xx.xxx.xxx) seguido por valor monetário R$.
      const linhaRe = /([0-9][0-9.\s/-]{8,}[0-9])\s+(?:.*?)R\$\s*([\d.]+,\d{2})/g;
      let lm: RegExpExecArray | null;
      let achou = 0;
      while ((lm = linhaRe.exec(rawText)) && achou < 50) {
        const insc = lm[1].replace(/\s+/g, " ").trim();
        if (!/\d{6,}/.test(insc)) continue;
        const v = toNumber(lm[2]);
        if (v <= 0) continue;
        debitos.push({
          id: crypto.randomUUID(),
          orgao: "PGFN",
          receita: `Inscrição em Dívida Ativa ${insc}`,
          competencia: "",
          valorOriginal: v,
          saldoDevedor: v,
          multa: 0,
          juros: 0,
          total: v,
          parcelado: false,
          situacao: "ATIVA EM COBRANÇA",
          statusParc: "devedor",
          observacao: `Inscrição ${insc} • Extração tolerante (layout alternativo)`,
        });
        achou++;
      }
      diag.debitosEncontrados = debitos.length;
      if (achou) diag.avisos.push(`Layout PGFN não padrão — extração tolerante usada (${achou} inscrição(ões)).`);
      else diag.avisos.push("Nenhuma inscrição reconhecida no relatório PGFN/Regularize.");
    }
    diag.paginasComTabela = pages.map((_, i) => i + 1);
    return { data: { cadastro: cad, dataAtualizacao, debitos, parcelamentos }, diagnostico: diag };
  }

  if (isOsasco) {
    diag.tipoDetectado = "municipal-osasco";
    const cad: DadosCadastrais = {};
    const insc = rawText.match(/Inscri[çc][ãa]o Municipal\s*([\d]{6,})/i);
    if (insc) cad.inscricaoMunicipal = insc[1];
    else diag.camposNaoEncontrados.push("Inscrição Municipal");
    // CNPJ STRICT: 14 dígitos no formato 00.000.000/0000-00.
    // Evita capturar CPF (11 dígitos) que aparece no campo "CNPJ/CPF".
    const cnpjStrict = rawText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (cnpjStrict) {
      cad.cnpj = cnpjStrict[1];
    } else {
      // tenta CNPJ só dígitos (14)
      const cnpjDig = rawText.match(/CNPJ(?:\/CPF)?:?\s*(\d{14})\b/i);
      if (cnpjDig) {
        const v = cnpjDig[1];
        cad.cnpj = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12,14)}`;
      } else {
        // detecta CPF e registra como pendência (não preenche CNPJ)
        const cpfM = rawText.match(/CNPJ\/CPF:?\s*(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})/i);
        if (cpfM) {
          diag.avisos.push(`O relatório municipal traz um CPF (${cpfM[1]}) no lugar do CNPJ — campo CNPJ não preenchido para evitar erro. Edite manualmente se necessário.`);
        }
        diag.camposNaoEncontrados.push("CNPJ");
      }
    }
    const nome = rawText.match(/Nome\s+([A-ZÇÃÁÉÍÓÚÂÊÔÀÜÑ][A-ZÇÃÁÉÍÓÚÂÊÔÀÜÑ0-9 .&/-]{4,})\s+Endere/i);
    if (nome) cad.razaoSocial = nome[1].trim().replace(/\s+/g, " ");
    else diag.camposNaoEncontrados.push("Nome do Contribuinte");
    cad.municipio = "Osasco"; cad.uf = "SP";
    const dt = rawText.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
    const dataAtualizacao = dt ? dt[1] : new Date().toLocaleString("pt-BR");

    const debitos: Debito[] = [];
    const parcelamentos: Parcelamento[] = [];

    // O relatório de Osasco usa layout em DUAS COLUNAS lado a lado.
    // Estratégia: separar items por X (esquerda x direita) por página, reconstruir
    // cada coluna individualmente como texto e processar blocos CDC.
    const tributoNome = (t: string) =>
      t === "ISSN" ? "ISS" : t === "TXAS" ? "Taxas Diversas" : t;

    const processarColuna = (texto: string) => {
      const blocoRe = /CDC\s+Livro\s+D[ií]vida\s+Tributo\s+Situa[çc][ãa]o([\s\S]*?)(?=CDC\s+Livro\s+D[ií]vida|Total da Sit\.|Total desta|Total Geral|$)/gi;
      let bm: RegExpExecArray | null;
      let count = 0;
      while ((bm = blocoRe.exec(texto))) {
        const body = bm[1];
        // Cabeçalho do CDC: 0000136452   ISSN19   0022613   ISSN   Remetido a SAJ
        const head = body.match(/(\d{6,})\s+(\S+)\s+(\d{3,})\s+(\S+)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú ]+?)(?=\s*(?:Parcela|$|\n))/);
        if (!head) continue;
        const [, cdc, livro, divida, tributo, situacaoRaw] = head;
        const situacao = situacaoRaw.trim();
        const isParcelado = /Parcelado|RRPD/i.test(situacao);
        // Linhas: PP AAAA [Seq?] DD/MM/AAAA  N.NNN,NN
        const linhaRe = /(\d{2})\s+(\d{4})\s+(?:\d+\s+)?(\d{2}\/\d{2}\/\d{4})\s+([\d.]+,\d{2})/g;
        let lm: RegExpExecArray | null;
        while ((lm = linhaRe.exec(body))) {
          const [, parcela, exercicio, venc, valor] = lm;
          const v = toNumber(valor);
          debitos.push({
            id: crypto.randomUUID(),
            orgao: "Municipal",
            receita: tributoNome(tributo),
            competencia: parcela === "00" ? `01/${exercicio}` : `${parcela.padStart(2, "0")}/${exercicio}`,
            vencimento: venc,
            valorOriginal: v,
            saldoDevedor: v,
            multa: 0,
            juros: 0,
            total: v,
            parcelado: isParcelado,
            situacao,
            observacao: `CDC ${cdc} • Livro ${livro} • Dívida ${divida}`,
          });
          count++;
        }
      }
      return count;
    };

    let blocosOk = 0;
    pages.forEach((items) => {
      if (!items.length) return;
      const xs = items.map((i) => i.x).sort((a, b) => a - b);
      const minX = xs[0];
      const maxX = xs[xs.length - 1];
      const meio = (minX + maxX) / 2;
      const buildText = (filtered: PageItem[]) => {
        const buckets = new Map<number, PageItem[]>();
        for (const it of filtered) {
          const yb = Math.round(it.y);
          if (!buckets.has(yb)) buckets.set(yb, []);
          buckets.get(yb)!.push(it);
        }
        return [...buckets.keys()]
          .sort((a, b) => b - a)
          .map((y) => buckets.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.str).join(" "))
          .join("\n");
      };
      const esq = items.filter((it) => it.x < meio);
      const dir = items.filter((it) => it.x >= meio);
      blocosOk += processarColuna(buildText(esq));
      blocosOk += processarColuna(buildText(dir));
    });

    // Fallback: se o particionamento por colunas não pegou nada, tenta o texto inteiro
    if (!debitos.length) {
      blocosOk += processarColuna(rawText);
    }

    // Parcelamento detalhado (página de detalhes)
    const parcRe = /N[uú]mero do Parcelamento\s+([\d/]+)[\s\S]{0,400}?Valor Parcelado[\s\S]{0,200}?([\d.]+,\d{2})\s+(Parcelamento [^\n]+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\w+)\s+([\d.]+,\d{2})/i;
    const pm = rawText.match(parcRe);
    if (pm) {
      parcelamentos.push({
        id: crypto.randomUUID(),
        orgao: "Municipal",
        identificador: `Parcelamento ${pm[1]}`,
        modalidade: pm[7],
        parcelasEmAtraso: Number(pm[5]) - Number(pm[4]) > 0 ? undefined : 0,
        valorEmAtraso: toNumber(pm[8]),
        situacao: pm[3].trim(),
      });
    }

    diag.debitosEncontrados = debitos.length;
    diag.parcelamentosEncontrados = parcelamentos.length;
    if (!blocosOk) diag.avisos.push("Nenhum bloco de CDC reconhecido no relatório.");
    if (!debitos.length) diag.avisos.push("Não foi possível extrair linhas de débito do relatório municipal.");
    diag.paginasComTabela = pages.map((_, i) => i + 1);

    return { data: { cadastro: cad, dataAtualizacao, debitos, parcelamentos }, diagnostico: diag };
  }

  if (isSituacao) {
    diag.tipoDetectado = "situacao-fiscal";
    const { cad, dataAtualizacao, faltantes } = parseCadastro(rawText);
    diag.camposNaoEncontrados.push(...faltantes);

    let allDebitos: Debito[] = [];
    let temSecaoPGFN = false;
    // Marcadores que confirmam que a PÁGINA atual pertence à seção da PGFN.
    // A simples menção a "Procuradoria-Geral da Fazenda Nacional" no rodapé NÃO conta —
    // o documento da Receita repete esse texto em quase todo rodapé.
    const REGEX_INICIO_PGFN = /Diagn[oó]stico Fiscal na Procuradoria(?:-Geral)?\s+da\s+Fazenda\s+Nacional/i;
    // Marcadores fortes de que a página é da Receita Federal (SIEF / Diagnóstico RFB).
    const REGEX_RFB_FORTE = /Diagn[oó]stico Fiscal na Receita Federal|Pend[eê]ncia\s*-\s*D[ée]bito\s*\(SIEF\)|D[ée]bito\s*\(SIEF\)/i;

    let headerRef: HeaderRef | undefined;
    pages.forEach((items, idx) => {
      const pageRaw = items.map((i) => i.str).join(" ");
      const inicioPGFN = REGEX_INICIO_PGFN.test(pageRaw);
      const ehRFB = REGEX_RFB_FORTE.test(pageRaw);

      // Decisão por página (não persistente entre páginas):
      // Se a página tem cabeçalho da PGFN E NÃO tem cabeçalho RFB, ignoramos os débitos.
      // O usuário deve importar o relatório oficial do Regularize/PGFN.
      const paginaEhPGFN = inicioPGFN && !ehRFB;

      if (paginaEhPGFN) {
        temSecaoPGFN = true;
        return;
      }

      // Tudo o mais (incluindo páginas com SIEF e o rodapé da PGFN) é tratado como RFB.
      const result = extractDebitosFromPage(items, "RFB", { tolerance, headerRef });
      const { debitos, reconhecida, numLinhas } = result;
      if (result.headerRef) headerRef = result.headerRef;
      if (reconhecida) {
        diag.paginasComTabela.push(idx + 1);
        allDebitos = allDebitos.concat(debitos);
        if (debitos.length < numLinhas) {
          diag.avisos.push(`Página ${idx + 1}: ${numLinhas} linhas detectadas, mas apenas ${debitos.length} reconhecidas como débito.`);
        }
      } else if (/Pend[eê]ncia.*D[eé]bito|SIEF/i.test(pageRaw)) {
        diag.avisos.push(`Página ${idx + 1}: cabeçalho de débitos detectado, mas tabela não pôde ser reconstruída.`);
      }
    });

    if (temSecaoPGFN) {
      diag.avisos.push(
        "⚠ O relatório contém a seção 'Diagnóstico Fiscal na Procuradoria-Geral da Fazenda Nacional', " +
        "mas estes débitos NÃO foram importados a partir deste arquivo. " +
        "Para atualizar a Dívida Ativa Federal corretamente, extraia o relatório direto no portal Regularize (PGFN) e importe-o separadamente."
      );
    }

    // OBS: não importamos mais inscrições PGFN do relatório da RFB — devem vir do Regularize.

    const parcelamentos = dedupeParcelamentos([
      ...extractParcelamentos(rawText),
      ...extractParcelamentosFromPages(pages),
    ]);

    // Marcar débitos como SUSPENSOS quando estiverem cobertos por parcelamento ativo
    const temPARCSN = parcelamentos.some((p) =>
      /PARCSN|Simples Nacional/i.test(p.identificador + " " + (p.modalidade || ""))
    );
    const temSIEFPAR = parcelamentos.some((p) => /SIEFPAR|Simplificado/i.test(p.modalidade || ""));

    if (temPARCSN) {
      allDebitos.forEach((d) => {
        if (/SIMPLES NAC/i.test(d.receita) && /PARCELAMENTO|SUSPENSO/i.test(d.situacao || "")) {
          d.parcelado = true;
          d.situacao = "SUSPENSO (em parcelamento — PARCSN)";
        }
      });
    }
    // Inscrições PGFN negociadas: garantir flag suspenso
    allDebitos.forEach((d) => {
      if (d.orgao === "PGFN" && /NEGOCIAD|SISPAR/i.test(d.situacao || "")) {
        d.parcelado = true;
        d.situacao = "SUSPENSO (em parcelamento — SISPAR/PGFN)";
      }
    });

    // Avisos sobre parcelas em atraso
    parcelamentos.forEach((p) => {
      if (p.parcelasEmAtraso && p.parcelasEmAtraso > 0) {
        const valor = p.valorEmAtraso ? ` (R$ ${p.valorEmAtraso.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})` : "";
        diag.avisos.push(
          `⚠ Parcelamento ${p.identificador} (${p.orgao}) com ${p.parcelasEmAtraso} parcela(s) em atraso${valor} — risco de rescisão do acordo.`
        );
      }
    });
    if (allDebitos.some((d) => d.parcelado)) {
      diag.avisos.push("Débitos cobertos por parcelamento ativo foram marcados como SUSPENSOS no relatório.");
    }

    diag.debitosEncontrados = allDebitos.length;
    diag.parcelamentosEncontrados = parcelamentos.length;
    if (!allDebitos.length) diag.avisos.push("Nenhuma linha de débito SIEF foi reconhecida.");

    return { data: { cadastro: cad, dataAtualizacao, debitos: allDebitos, parcelamentos }, diagnostico: diag };
  }

  if (isParcRFB) {
    diag.tipoDetectado = "parcelamento-rfb";
    const idMatch = rawText.match(/Parcelamento\s+([\d.\-]{10,})/);
    const valMatch = rawText.match(/Valor em atraso\s*([\d.]+,\d{2})/i);
    const atrasoMatch = rawText.match(/Parcelas em atraso\s*(\d+)/i);
    const modMatch = rawText.match(/Modalidade\s+([A-Za-zÇÃÁÉÍÓ ]+)/);
    const parc: Parcelamento[] = [];
    if (idMatch || valMatch) {
      parc.push({
        id: crypto.randomUUID(),
        orgao: "RFB",
        identificador: idMatch ? idMatch[1] : "Parcelamento RFB",
        modalidade: modMatch ? modMatch[1].trim() : undefined,
        valorEmAtraso: valMatch ? toNumber(valMatch[1]) : undefined,
        parcelasEmAtraso: atrasoMatch ? Number(atrasoMatch[1]) : undefined,
        situacao: "EM PARCELAMENTO",
      });
    }
    diag.parcelamentosEncontrados = parc.length;
    if (!parc.length) diag.avisos.push("Não foi possível identificar dados do parcelamento.");
    return { data: { parcelamentos: parc }, diagnostico: diag };
  }

  // Genérico — Estadual / Municipal
  diag.tipoDetectado = "generico";
  const orgao: Orgao = orgaoHint || "Estadual";
  const debitos: Debito[] = [];
  const lines = rawText.split("\n");
  const re = /^(.+?)\s+(\d{2}\/\d{4})\s+(?:(\d{2}\/\d{2}\/\d{4})\s+)?([\d.]+,\d{2})(?:\s+([\d.]+,\d{2}))?(?:\s+([\d.]+,\d{2}))?(?:\s+([\d.]+,\d{2}))?$/;
  for (const ln of lines) {
    const m = ln.match(re);
    if (m) {
      const valores = [m[4], m[5], m[6], m[7]].filter(Boolean).map(toNumber);
      const total = valores[valores.length - 1] || valores[0];
      debitos.push({
        id: crypto.randomUUID(),
        orgao,
        receita: m[1].trim(),
        competencia: m[2],
        vencimento: m[3],
        valorOriginal: valores[0] || 0,
        saldoDevedor: valores[0] || 0,
        multa: valores.length >= 3 ? valores[1] : 0,
        juros: valores.length >= 4 ? valores[2] : 0,
        total,
        parcelado: false,
        situacao: "DEVEDOR",
      });
    } else if (/\d{2}\/\d{4}/.test(ln) && diag.linhasNaoReconhecidas.length < 8) {
      diag.linhasNaoReconhecidas.push(ln);
    }
  }
  diag.debitosEncontrados = debitos.length;
  if (!debitos.length) diag.avisos.push(`Formato não reconhecido para ${orgao}.`);
  return { data: { debitos, dataAtualizacao: new Date().toLocaleString("pt-BR") }, diagnostico: diag };
}
