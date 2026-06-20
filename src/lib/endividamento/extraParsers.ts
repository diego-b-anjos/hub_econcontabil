/**
 * Parsers adicionais para formatos não cobertos pelo pdfParser original:
 *  - PGFN — CSV consolidado da Dívida Ativa (export direto do site Regularize)
 *  - SEFAZ-SP — Relatório de Pendências Fiscais (PDF impresso)
 *  - PGE-SP — Consulta de Débitos Inscritos na Dívida Ativa (impressão do site)
 *  - CND Municipal de São Paulo (Certidão Conjunta SF/PGM)
 *
 * Cada função retorna `{ data, diagnostico }` no mesmo formato do parser principal.
 */
import type {
  RelatorioFiscal,
  Debito,
  Parcelamento,
  DadosCadastrais,
  CertidaoNegativa,
  DiagnosticoImport,
} from "./types";
import * as pdfjsLib from "pdfjs-dist";

const toNumber = (s: string) =>
  Number(String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;

/* ===================== PGFN — CSV consolidado ===================== */

/** Detecta se o arquivo CSV/TXT veio do "Relatório Consolidado da Dívida" da PGFN. */
export function isPGFNCsv(file: File, head: string): boolean {
  const nome = file.name.toLowerCase();
  if (!/\.(csv|txt)$/i.test(nome)) return false;
  return /Relat[óo]rio Consolidado da D[ií]vida|Inscri[çc][ãa]o;\s*Valor Total Consolidado/i.test(head);
}

/** Quebra uma linha CSV separada por ';' respeitando aspas. */
function splitCsvLine(line: string, sep = ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === sep && !inQ) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function parsePGFNCsv(
  file: File,
): Promise<{ data: Partial<RelatorioFiscal>; diagnostico: DiagnosticoImport }> {
  // BOM-safe
  let text = await file.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/);

  const diag: DiagnosticoImport = {
    arquivo: file.name,
    paginas: 1,
    paginasComTabela: [1],
    debitosEncontrados: 0,
    parcelamentosEncontrados: 0,
    camposNaoEncontrados: [],
    avisos: [],
    linhasNaoReconhecidas: [],
    tipoDetectado: "pgfn-csv",
  };

  const cad: DadosCadastrais = {};
  let dataAtualizacao = new Date().toLocaleString("pt-BR");
  for (const ln of lines.slice(0, 20)) {
    const m = ln.match(/Devedor:\s*(.+)/i);
    if (m) cad.razaoSocial = m[1].trim().replace(/^"|"$/g, "");
    const c = ln.match(/CPF\/CNPJ:\s*([\d./-]{11,18})/i);
    if (c) cad.cnpj = c[1].trim();
    const dt = ln.match(/Relat[óo]rio gerado em\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i);
    if (dt) dataAtualizacao = dt[1];
  }

  // Localiza a linha de cabeçalho: "Inscrição;Valor Total Consolidado;Natureza;..."
  const headIdx = lines.findIndex((l) => /^Inscri[çc][ãa]o;\s*Valor Total Consolidado/i.test(l));
  if (headIdx < 0) {
    diag.avisos.push("Cabeçalho do CSV PGFN não encontrado.");
    return { data: { cadastro: cad, dataAtualizacao }, diagnostico: diag };
  }

  const header = splitCsvLine(lines[headIdx]);
  const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iInsc = idx(/Inscri/i);
  const iValor = idx(/Valor Total Consolidado/i);
  const iNatureza = idx(/Natureza/i);
  const iSituacao = idx(/Situa/i);
  const iData = idx(/Data da Inscri/i);
  const iProc = idx(/Processo Administrativo/i);
  const iJud = idx(/Processo Judicial/i);

  const debitos: Debito[] = [];
  for (let i = headIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.includes(";")) continue;
    const cells = splitCsvLine(raw);
    const inscricao = cells[iInsc];
    if (!inscricao || !/\d/.test(inscricao)) continue;
    const total = toNumber(cells[iValor] || "0");
    const natureza = cells[iNatureza] || "";
    const situacao = (cells[iSituacao] || "").toUpperCase();
    const dataInsc = cells[iData] || "";
    const procAdm = iProc >= 0 ? cells[iProc] : "";
    const procJud = iJud >= 0 ? cells[iJud] : "";

    const negociado = /NEGOCI|TRANSAC|GARANTID|SUSPENS/.test(situacao);
    const ajuizada = /AJUIZADA/.test(situacao);
    const extinta = /EXTINTA/.test(situacao);
    if (extinta) continue; // não soma extintas

    debitos.push({
      id: crypto.randomUUID(),
      orgao: "PGFN",
      receita: `Inscrição em Dívida Ativa — ${natureza}`,
      competencia: dataInsc ? dataInsc.slice(3) : "",
      vencimento: dataInsc || undefined,
      valorOriginal: total,
      saldoDevedor: total,
      multa: 0,
      juros: 0,
      total,
      parcelado: negociado,
      situacao: situacao || (ajuizada ? "ATIVA AJUIZADA" : "ATIVA EM COBRANÇA"),
      statusParc: negociado ? "em-dia" : "divida-ativa",
      observacao: [
        `Inscrição ${inscricao}`,
        dataInsc && `Inscrita em ${dataInsc}`,
        procAdm && procAdm !== "-" && `Proc. Adm. ${procAdm}`,
        procJud && procJud !== "-" && `Proc. Jud. ${procJud}`,
      ].filter(Boolean).join(" • "),
    });
  }

  // Resumo geral exibido no CSV
  const resumo = lines.find((l) => /Valor das inscri[çc][õo]es selecionadas/i.test(l));
  if (resumo) {
    const m = resumo.match(/R\$\s*([\d.,]+)/);
    if (m) diag.avisos.push(`PGFN — Total informado pelo CSV: R$ ${m[1]}.`);
  }

  diag.debitosEncontrados = debitos.length;
  if (!debitos.length) diag.avisos.push("Nenhuma inscrição encontrada no CSV PGFN.");
  return { data: { cadastro: cad, dataAtualizacao, debitos }, diagnostico: diag };
}

/* ===================== Util — extrair texto bruto e itens de um PDF ===================== */
interface PageItem { x: number; y: number; str: string; }

async function pdfText(file: File): Promise<{ text: string; pages: PageItem[][] }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: PageItem[][] = [];
  const partes: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: PageItem[] = (content.items as Array<{ str: string; transform: number[] }>)
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ x: it.transform[4], y: it.transform[5], str: it.str.trim() }));
    pages.push(items);
    // Bucketiza linhas com tolerância de ~3px para que células de tabela
    // ligeiramente desalinhadas verticalmente fiquem na mesma "linha visual".
    const sorted = [...items].sort((a, b) => b.y - a.y);
    const lines: PageItem[][] = [];
    const TOL = 6;
    for (const it of sorted) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last[0].y - it.y) <= TOL) last.push(it);
      else lines.push([it]);
    }
    for (const ln of lines) {
      partes.push([...ln].sort((a, b) => a.x - b.x).map((r) => r.str).join(" "));
    }
  }
  return { text: partes.join("\n"), pages };
}

/* ===================== SEFAZ-SP — Pendências Fiscais ===================== */

export function isSefazSP(text: string): boolean {
  return /Relat[óo]rio de Pend[eê]ncias Fiscais/i.test(text) &&
    /Secretaria da Fazenda.*S[ãa]o Paulo|Inscri[çc][ãa]o Estadual/i.test(text);
}

export async function parseSefazSP(
  file: File,
): Promise<{ data: Partial<RelatorioFiscal>; diagnostico: DiagnosticoImport }> {
  const { text } = await pdfText(file);
  const diag: DiagnosticoImport = {
    arquivo: file.name,
    paginas: 0,
    paginasComTabela: [],
    debitosEncontrados: 0,
    parcelamentosEncontrados: 0,
    camposNaoEncontrados: [],
    avisos: [],
    linhasNaoReconhecidas: [],
    tipoDetectado: "sefaz-sp",
  };

  const cad: DadosCadastrais = { uf: "SP" };
  const cnpj = text.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (cnpj) cad.cnpj = cnpj[1];
  const ie = text.match(/Inscri[çc][ãa]o Estadual\s+([\d.\s/-]{8,})/i);
  if (ie) cad.inscricaoEstadual = ie[1].trim().replace(/\s+/g, "");
  const razao = text.match(/Raz[ãa]o Social\s+([A-ZÇÃÁÉÍÓÚÂÊÔÀÜÑ][^\n]{4,})/i);
  if (razao) cad.razaoSocial = razao[1].split(/Inscri[çc][ãa]o/)[0].trim();

  const dt = text.match(/Data e hora da pesquisa\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/i);
  const dataAtualizacao = dt ? dt[1] : new Date().toLocaleString("pt-BR");

  const debitos: Debito[] = [];
  const parcelamentos: Parcelamento[] = [];

  // Quadro "Resumo": linhas como "ICMS Declarado  Não há Débitos" / "AIIM  Há Débitos"
  const resumoItens = [...text.matchAll(/^(ICMS Declarado|ICMS Parcelamento|IPVA|ITCMD|AIIM|ICMS Pend[eê]ncia)\s+(N[ãa]o h[áa] D[ée]bitos|H[áa] D[ée]bitos|H[áa] Pend[eê]ncias)/gim)];
  resumoItens.forEach((m) => {
    diag.avisos.push(`SEFAZ-SP — ${m[1]}: ${m[2]}.`);
  });

  // Pendências (declarações): CNPJ  IE  REF  DOC  DESCRIÇÃO
  const pendRe = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+([\d.\s/-]{8,})\s+(\d{2}\/\d{4})\s+(EFD|GIA|DCTF|DCTFWeb)\s+([^\n]+)/g;
  let pm: RegExpExecArray | null;
  while ((pm = pendRe.exec(text))) {
    debitos.push({
      id: crypto.randomUUID(),
      orgao: "Estadual",
      receita: `${pm[4]} — ${pm[5].trim()}`,
      competencia: pm[3],
      valorOriginal: 0,
      saldoDevedor: 0,
      multa: 0,
      juros: 0,
      total: 0,
      parcelado: false,
      situacao: "PENDÊNCIA DE DECLARAÇÃO",
      statusParc: "devedor",
      pendenciaDeclaracao: true,
      observacao: `Pendência ${pm[4]} — sem valor financeiro associado`,
    });
  }

  // AIIM parcelados: "CNPJ  Nº AIIM  R$ valor  Situação"
  const aiimRe = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+(\d{6,})\s+R\$\s*([\d.,]+)\s+(PARCELADO|ATIVO|BAIXADO|DEVEDOR)([^\n]*)/g;
  let am: RegExpExecArray | null;
  while ((am = aiimRe.exec(text))) {
    const sit = am[4].toUpperCase();
    const valor = toNumber(am[3]);
    if (sit === "PARCELADO") {
      parcelamentos.push({
        id: crypto.randomUUID(),
        orgao: "Estadual",
        identificador: `AIIM ${am[2]}`,
        modalidade: "Parcelamento de AIIM (SEFAZ-SP)",
        valorEmAtraso: undefined,
        situacao: "EM PARCELAMENTO",
      });
    } else {
      debitos.push({
        id: crypto.randomUUID(),
        orgao: "Estadual",
        receita: `AIIM ${am[2]}`,
        competencia: "",
        valorOriginal: valor,
        saldoDevedor: valor,
        multa: 0,
        juros: 0,
        total: valor,
        parcelado: false,
        situacao: sit,
        statusParc: "devedor",
        observacao: `Auto de Infração e Imposição de Multa nº ${am[2]}`,
      });
    }
  }

  diag.debitosEncontrados = debitos.length;
  diag.parcelamentosEncontrados = parcelamentos.length;
  if (!debitos.length && !parcelamentos.length) {
    diag.avisos.push("Nenhuma pendência ou AIIM extraído do relatório SEFAZ-SP.");
  }
  return { data: { cadastro: cad, dataAtualizacao, debitos, parcelamentos }, diagnostico: diag };
}

/* ===================== PGE-SP — Dívida Ativa Estadual (impressão do site) ===================== */

export function isPgeSP(text: string): boolean {
  return /Consulta de D[ée]bitos Inscritos na D[ií]vida Ativa|dataTableDebitosRelativo|N[°º] de Registro\/CDA/i.test(text) &&
    /Governo do Estado de S[ãa]o Paulo|dividaativa\.pge\.sp\.gov\.br|Procuradoria Geral do Estado|Site do Contribuinte/i.test(text);
}

export function isPgeSPHtml(html: string): boolean {
  return /<html[\s>]/i.test(html) && isPgeSP(html);
}

const cleanHtmlText = (value?: string | null) =>
  (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const formatCnpj = (digits: string) => {
  const d = digits.replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : digits;
};

const normalizePgeReferencia = (referencia: string, dataInsc = "") => {
  const ref = cleanHtmlText(referencia);
  if (/possui\s+mais\s+de\s+uma/i.test(ref)) {
    return { refNorm: "Diversas Competências", competencia: "Diversas Competências" };
  }
  const data = ref.match(/^(\d{2})\/\d{2}\/(\d{4})$/);
  if (data) return { refNorm: ref, competencia: `${data[1]}/${data[2]}` };
  if (/^\d{2}\/\d{4}$/.test(ref)) return { refNorm: ref, competencia: ref };
  return { refNorm: ref, competencia: dataInsc ? dataInsc.slice(3) : "" };
};

const cleanTableCell = (cell: HTMLTableCellElement) => {
  const clone = cell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script,style,input,select,option").forEach((el) => el.remove());
  return cleanHtmlText(clone.textContent);
};

const tableCells = (root: ParentNode, selector = "td,th") =>
  Array.from(root.querySelectorAll(selector)).filter((el): el is HTMLTableCellElement => el instanceof HTMLTableCellElement);

export async function parsePgeSPHtml(
  file: File,
): Promise<{ data: Partial<RelatorioFiscal>; diagnostico: DiagnosticoImport }> {
  const html = await file.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const bodyText = cleanHtmlText(doc.body?.textContent || html);
  const diag: DiagnosticoImport = {
    arquivo: file.name,
    paginas: 1,
    paginasComTabela: [],
    debitosEncontrados: 0,
    parcelamentosEncontrados: 0,
    camposNaoEncontrados: [],
    avisos: [],
    linhasNaoReconhecidas: [],
    tipoDetectado: "pge-sp",
  };

  const cad: DadosCadastrais = { uf: "SP" };
  const rows = Array.from(doc.querySelectorAll("tr"));
  for (const row of rows) {
    const cells = tableCells(row).map(cleanTableCell);
    if (cells.length < 2) continue;
    if (/^Devedor:?$/i.test(cells[0])) cad.razaoSocial = cells[1];
    if (/^CPF\/CNPJ:?$/i.test(cells[0])) cad.cnpj = formatCnpj(cells[1]);
  }
  if (!cad.cnpj) {
    const cnpj = bodyText.match(/CPF\/CNPJ:\s*([\d./-]{14,18}|\d{14})/i);
    if (cnpj) cad.cnpj = formatCnpj(cnpj[1]);
  }
  if (!cad.razaoSocial) {
    const dev = bodyText.match(/Devedor:\s*(.+?)\s+CPF\/CNPJ:/i);
    if (dev) cad.razaoSocial = cleanHtmlText(dev[1]);
  }

  const debitos: Debito[] = [];
  const parcelamentos: Parcelamento[] = [];
  let tipoNome = "Dívida Ativa Estadual";
  let pepCount = 0;
  const tables = Array.from(doc.querySelectorAll("table"));

  for (const table of tables) {
    const tableText = cleanHtmlText(table.textContent);
    const tipoM = tableText.match(/D[ée]bitos relativos a\s+(.+?)(?:\s*$|\s{2,}|CPF\/CNPJ)/i);
    if (tipoM) tipoNome = cleanHtmlText(tipoM[1]);

    const headers = tableCells(table, "thead th").map(cleanTableCell).join(" ");
    if (!/N[°º]\s*de\s*Registro\/CDA|Registro\/CDA/i.test(headers) || !/Valor Atualizado/i.test(headers)) continue;

    const dataRows = Array.from(table.querySelectorAll("tbody tr"));
    for (const tr of dataRows) {
      const cells = tableCells(tr, ":scope > td").map(cleanTableCell);
      if (cells.length < 6) continue;
      const [cnpjCell, ie, cda, referencia, dataInsc, valorTxt, , observacao = ""] = cells;
      if (!/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(cnpjCell) || !/\d/.test(cda)) continue;
      const valor = toNumber(valorTxt);
      if (!valor) continue;

      const vinculadoPEP = /vinculado ao PEP|Parcelamento em\s*Andamento/i.test(observacao);
      const { refNorm, competencia } = normalizePgeReferencia(referencia, dataInsc);
      if (!cad.inscricaoEstadual && ie) cad.inscricaoEstadual = ie;
      if (vinculadoPEP) pepCount++;

      debitos.push({
        id: crypto.randomUUID(),
        orgao: "Estadual",
        receita: tipoNome,
        competencia,
        vencimento: dataInsc,
        valorOriginal: valor,
        saldoDevedor: valor,
        multa: 0,
        juros: 0,
        total: valor,
        parcelado: vinculadoPEP,
        situacao: vinculadoPEP ? "PEP — Parcelamento em Andamento" : "ATIVA EM COBRANÇA",
        statusParc: vinculadoPEP ? "em-dia" : "divida-ativa",
        valorJaAtualizado: true,
        observacao: [
          `CDA ${cda}`,
          ie && `IE ${ie}`,
          refNorm && `Ref. ${refNorm}`,
          dataInsc && `Inscrita em ${dataInsc}`,
          observacao,
        ].filter(Boolean).join(" • "),
      });
    }
  }

  if (debitos.length) diag.paginasComTabela.push(1);
  if (pepCount > 0) {
    parcelamentos.push({
      id: crypto.randomUUID(),
      orgao: "Estadual",
      identificador: "PEP — Programa Especial de Parcelamento",
      modalidade: `PEP/ICMS — ${pepCount} CDA(s) vinculada(s)`,
      situacao: "EM PARCELAMENTO",
    });
    diag.avisos.push(`PGE-SP: ${pepCount} CDA(s) vinculada(s) ao PEP — débitos suspensos enquanto o parcelamento estiver em dia.`);
  }
  const totM = bodyText.match(/Valor Total Atualizado\s*\(R\$\):\s*([\d.,]+)/i);
  if (totM) diag.avisos.push(`PGE-SP — Total informado: R$ ${totM[1]}.`);
  if (debitos.length) {
    diag.avisos.push(
      "PGE-SP — Valores Atualizados (R$) já contemplam multa e juros (extrato da PGE não discrimina principal/multa/juros).",
    );
  }

  diag.debitosEncontrados = debitos.length;
  diag.parcelamentosEncontrados = parcelamentos.length;
  if (!debitos.length) diag.avisos.push("Nenhuma CDA reconhecida no HTML PGE-SP.");
  return { data: { cadastro: cad, dataAtualizacao: new Date().toLocaleString("pt-BR"), debitos, parcelamentos }, diagnostico: diag };
}

export async function parsePgeSP(
  file: File,
): Promise<{ data: Partial<RelatorioFiscal>; diagnostico: DiagnosticoImport }> {
  const { text, pages } = await pdfText(file);
  const diag: DiagnosticoImport = {
    arquivo: file.name,
    paginas: 0,
    paginasComTabela: [],
    debitosEncontrados: 0,
    parcelamentosEncontrados: 0,
    camposNaoEncontrados: [],
    avisos: [],
    linhasNaoReconhecidas: [],
    tipoDetectado: "pge-sp",
  };
  diag.paginas = pages.length;

  const cad: DadosCadastrais = { uf: "SP" };
  const cnpj = text.match(/CPF\/CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
  if (cnpj) cad.cnpj = cnpj[1];
  // O nome do devedor pode aparecer na mesma linha de "CPF/CNPJ:" (quando o pdf.js
  // junta tudo) ou em linha separada. Capturamos até qualquer próximo rótulo.
  const dev = text.match(/Devedor:\s*([^\n]+?)(?=\s+CPF\/CNPJ:|\s+Para detalhar|\n|$)/i);
  if (dev) {
    cad.razaoSocial = dev[1]
      .replace(/\s+/g, " ")
      .replace(/\s*Libera[çc][ãa]o:.*$/i, "")
      .trim();
  }

  const dtTopo = text.match(/(\d{2}\/\d{2}\/\d{4})[, ]+\s*(\d{2}:\d{2})/);
  const dataAtualizacao = dtTopo ? `${dtTopo[1]} ${dtTopo[2]}` : new Date().toLocaleString("pt-BR");

  const debitos: Debito[] = [];
  const parcelamentos: Parcelamento[] = [];
  let pepCount = 0;

  // ===== Extração ROW-BASED a partir dos itens das páginas =====
  // Cada página tem cabeçalho "Débitos relativos a XXX" definindo o tipo.
  // As linhas de tabela contêm: CNPJ, IE, CDA, Referência (data ou "Possui mais de uma"),
  // Data de Inscrição, Valor Atualizado e Observação.
  type Row = { y: number; items: PageItem[] };
  const buildRows = (items: PageItem[]): Row[] => {
    const sorted = [...items].sort((a, b) => b.y - a.y);
    const rows: Row[] = [];
    const TOL = 6;
    for (const it of sorted) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - it.y) <= TOL) last.items.push(it);
      else rows.push({ y: it.y, items: [it] });
    }
    rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
    return rows;
  };

  const cnpjCellRe = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
  const ieRe = /^(?:\d{8,14}|\d{3}\.\d{3}\.\d{3}\.\d{3}|ISENTO)$/i;
  const dateRe = /^\d{2}\/\d{2}\/\d{4}$/;
  const moneyRe = /^(?:R\$\s*)?[\d.]+,\d{2}$/;
  const digitCount = (s: string) => s.replace(/\D/g, "").length;
  const isCdaLike = (s: string) =>
    /^[\d./-]+$/.test(s) &&
    digitCount(s) >= 6 &&
    digitCount(s) <= 15 &&
    !cnpjCellRe.test(s) &&
    !dateRe.test(s) &&
    !moneyRe.test(s);
  const normalizeMoneyCell = (s: string) => s.replace(/^R\$\s*/i, "");

  const mergeCurrencyCells = (cells: string[]) => {
    const out: string[] = [];
    for (let i = 0; i < cells.length; i++) {
      if (/^R\$$/i.test(cells[i]) && cells[i + 1] && /^[\d.]+,\d{2}$/.test(cells[i + 1])) {
        out.push(`R$ ${cells[i + 1]}`);
        i++;
      } else {
        out.push(cells[i]);
      }
    }
    return out;
  };

  for (let p = 0; p < pages.length; p++) {
    const items = pages[p];
    if (!items.length) continue;
    const rows = buildRows(items);

    // Determina o tipo do débito vigente em cada Y (pelo último cabeçalho acima)
    let tipoNome = "ICMS";
    let tabelaNestaPagina = false;

    for (const row of rows) {
      const txt = row.items.map((i) => i.str).join(" ");

      const tipoM = txt.match(/D[ée]bitos relativos a\s+(.+?)(?:\s*$|\s{2,})/i);
      if (tipoM) {
        tipoNome = tipoM[1].trim().replace(/\s+/g, " ");
        continue;
      }

      // Linha de débito: começa com CNPJ
      const cells = mergeCurrencyCells(row.items.map((i) => i.str));
      const cnpjIdx = cells.findIndex((cell) => cnpjCellRe.test(cell));
      if (cnpjIdx < 0) continue;

      // Junta tokens consecutivos para reconstruir células multi-token
      // (ex.: "Possui", "mais", "de", "uma" -> "Possui mais de uma";
      //  "O", "débito", ... -> observação)
      let i = cnpjIdx + 1;
      // IE
      let ie = "";
      if (i < cells.length && ieRe.test(cells[i]) && cells.slice(i + 1).some(isCdaLike)) { ie = cells[i]; i++; }
      // CDA
      let cda = "";
      while (i < cells.length && !cda) {
        if (isCdaLike(cells[i])) cda = cells[i];
        i++;
      }

      // Referência: data OU sequência de palavras até a próxima data
      let referencia = "";
      const refTokens: string[] = [];
      while (i < cells.length && !dateRe.test(cells[i]) && !moneyRe.test(cells[i])) {
        refTokens.push(cells[i]); i++;
      }
      if (i < cells.length && dateRe.test(cells[i])) {
        // Verifica se a PRÓXIMA célula também é data: se sim, esta data é a referência
        if (i + 1 < cells.length && dateRe.test(cells[i + 1])) {
          referencia = cells[i]; i++;
        }
      }
      if (refTokens.length) referencia = refTokens.join(" ").trim();

      // Data de Inscrição
      let dataInsc = "";
      if (i < cells.length && dateRe.test(cells[i])) { dataInsc = cells[i]; i++; }

      // Valor
      let valor = 0;
      if (i < cells.length && moneyRe.test(cells[i])) { valor = toNumber(normalizeMoneyCell(cells[i])); i++; }

      if (!cda || !valor) continue;
      tabelaNestaPagina = true;

      const restoTxt = cells.slice(i).join(" ");
      const vinculadoPEP = /vinculado ao PEP|Parcelamento em\s*Andamento/i.test(restoTxt);
      if (!cad.inscricaoEstadual) cad.inscricaoEstadual = ie;
      if (vinculadoPEP) pepCount++;

      const { refNorm, competencia } = normalizePgeReferencia(referencia, dataInsc);

      debitos.push({
        id: crypto.randomUUID(),
        orgao: "Estadual",
        receita: tipoNome,
        competencia,
        vencimento: dataInsc,
        valorOriginal: valor,
        saldoDevedor: valor,
        multa: 0,
        juros: 0,
        total: valor,
        parcelado: vinculadoPEP,
        situacao: vinculadoPEP ? "PEP — Parcelamento em Andamento" : "ATIVA EM COBRANÇA",
        statusParc: vinculadoPEP ? "em-dia" : "divida-ativa",
        valorJaAtualizado: true,
        observacao: [
          `CDA ${cda}`,
          ie && `IE ${ie}`,
          refNorm && `Ref. ${refNorm}`,
          dataInsc && `Inscrita em ${dataInsc}`,
          restoTxt && restoTxt.replace(/\s+/g, " ").trim(),
        ].filter(Boolean).join(" • "),
      });
    }
    if (tabelaNestaPagina) diag.paginasComTabela.push(p + 1);
  }

  if (!debitos.length) {
    let tipoAtual = "Dívida Ativa Estadual";
    const linhas = text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    for (const linha of linhas) {
      const tipoM = linha.match(/D[ée]bitos relativos a\s+(.+)/i);
      if (tipoM) {
        tipoAtual = tipoM[1].replace(/CPF\/CNPJ.*$/i, "").trim() || tipoAtual;
        continue;
      }
      const m = linha.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+(\S+)\s+([\d./-]{5,})\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:R\$\s*)?([\d.]+,\d{2})(?:\s+(.*))?$/i);
      if (!m) continue;
      const [, , ie, cda, referencia, dataInsc, valorTxt, resto = ""] = m;
      if (!isCdaLike(cda)) continue;
      const valor = toNumber(valorTxt);
      if (!valor) continue;
      const vinculadoPEP = /vinculado ao PEP|Parcelamento em\s*Andamento/i.test(resto);
      const { refNorm, competencia } = normalizePgeReferencia(referencia, dataInsc);
      if (!cad.inscricaoEstadual && ie) cad.inscricaoEstadual = ie;
      if (vinculadoPEP) pepCount++;
      debitos.push({
        id: crypto.randomUUID(),
        orgao: "Estadual",
        receita: tipoAtual,
        competencia,
        vencimento: dataInsc,
        valorOriginal: valor,
        saldoDevedor: valor,
        multa: 0,
        juros: 0,
        total: valor,
        parcelado: vinculadoPEP,
        situacao: vinculadoPEP ? "PEP — Parcelamento em Andamento" : "ATIVA EM COBRANÇA",
        statusParc: vinculadoPEP ? "em-dia" : "divida-ativa",
        valorJaAtualizado: true,
        observacao: [
          `CDA ${cda}`,
          ie && `IE ${ie}`,
          refNorm && `Ref. ${refNorm}`,
          dataInsc && `Inscrita em ${dataInsc}`,
          resto && resto.replace(/\s+/g, " ").trim(),
        ].filter(Boolean).join(" • "),
      });
    }
    if (debitos.length && !diag.paginasComTabela.length) diag.paginasComTabela.push(1);
  }

  if (pepCount > 0) {
    parcelamentos.push({
      id: crypto.randomUUID(),
      orgao: "Estadual",
      identificador: "PEP — Programa Especial de Parcelamento",
      modalidade: `PEP/ICMS — ${pepCount} CDA(s) vinculada(s)`,
      situacao: "EM PARCELAMENTO",
    });
    diag.avisos.push(`PGE-SP: ${pepCount} CDA(s) vinculada(s) ao PEP — débitos suspensos enquanto o parcelamento estiver em dia.`);
  }

  // "Valor Total Atualizado (R$): 28.577.153,82"
  const totM = text.match(/Valor Total Atualizado.*?R\$\)?:?\s*([\d.,]+)/i);
  if (totM) diag.avisos.push(`PGE-SP — Total informado: R$ ${totM[1]}.`);
  if (debitos.length) {
    diag.avisos.push(
      "PGE-SP — Valores Atualizados (R$) já contemplam multa e juros (extrato da PGE não discrimina principal/multa/juros).",
    );
  }

  diag.debitosEncontrados = debitos.length;
  diag.parcelamentosEncontrados = parcelamentos.length;
  if (!debitos.length) diag.avisos.push("Nenhuma CDA reconhecida no relatório PGE-SP.");
  return { data: { cadastro: cad, dataAtualizacao, debitos, parcelamentos }, diagnostico: diag };
}

/* ===================== CND Municipal de São Paulo ===================== */

export function isCndSaoPaulo(text: string): boolean {
  return /SECRETARIA MUNICIPAL DA FAZENDA[\s\S]{0,200}Certid[ãa]o Conjunta de D[ée]bitos de Tributos Mobili[áa]rios/i.test(text);
}

export async function parseCndSaoPaulo(
  file: File,
): Promise<{ data: Partial<RelatorioFiscal>; diagnostico: DiagnosticoImport }> {
  const { text } = await pdfText(file);
  const diag: DiagnosticoImport = {
    arquivo: file.name,
    paginas: 0,
    paginasComTabela: [],
    debitosEncontrados: 0,
    parcelamentosEncontrados: 0,
    camposNaoEncontrados: [],
    avisos: [],
    linhasNaoReconhecidas: [],
    tipoDetectado: "cnd-negativa",
  };

  const cad: DadosCadastrais = { municipio: "São Paulo", uf: "SP" };
  const numero = text.match(/Certid[ãa]o N[uú]mero:\s*([\d./\s-]+?)(?:\n|CPF|Contribuinte)/i);
  const cnpj = text.match(/CPF\/CNPJ Raiz:\s*([\d./-]{8,18})/i);
  if (cnpj) cad.cnpj = cnpj[1].trim();
  const contrib = text.match(/Contribuinte:\s*([^\n]+)/i);
  if (contrib) {
    let nome = contrib[1].trim();
    // Quando a reconstrução por linha junta rótulos vizinhos (CCM, Liberação,
    // Validade, etc.), corta o nome no primeiro rótulo encontrado.
    nome = nome.split(/\s+(?:CCM|Libera[çc][ãa]o|Validade|CPF|CNPJ|Endere[çc]o|Inscri[çc][ãa]o)\b/i)[0];
    cad.razaoSocial = nome.trim().replace(/\s+/g, " ");
  }
  const ccm = text.match(/CCM\s*([\d.\-]+)/i);
  if (ccm) cad.inscricaoMunicipal = ccm[1].trim();
  const lib = text.match(/Libera[çc][ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const val = text.match(/Validade:\s*(\d{2}\/\d{2}\/\d{4})/i);
  const emit = text.match(/Certid[ãa]o emitida [àa]s\s*(\d{2}:\d{2}(?::\d{2})?)\s*horas do dia\s*(\d{2}\/\d{2}\/\d{4})/i);
  const dataEmissao = lib ? lib[1] : (emit ? `${emit[2]} ${emit[1]}` : undefined);
  const validade = val?.[1];
  const dataAtualizacao = emit ? `${emit[2]} ${emit[1]}` : (lib?.[1] || new Date().toLocaleString("pt-BR"));

  const cnd: CertidaoNegativa = {
    id: crypto.randomUUID(),
    orgao: "Municipal",
    emissor: "Prefeitura de São Paulo — SF/PGM",
    numero: numero?.[1].trim().replace(/\s+/g, " "),
    dataEmissao,
    validade,
    arquivo: file.name,
  };
  diag.avisos.push(`Certidão NEGATIVA reconhecida — Prefeitura de São Paulo (CCM ${cad.inscricaoMunicipal || "—"}).`);

  return {
    data: { cadastro: cad, dataAtualizacao, certidoesNegativas: [cnd] },
    diagnostico: diag,
  };
}

/* ===================== Roteador unificado ===================== */

export interface UnifiedResult {
  data: Partial<RelatorioFiscal>;
  diagnostico: DiagnosticoImport;
  /** Quando true, o pdfParser principal não deve ser executado para este arquivo. */
  consumido: boolean;
}

/** Tenta tratar arquivos com os parsers extras. Retorna null quando não reconhece. */
export async function tentarParserExtra(file: File): Promise<UnifiedResult | null> {
  const nome = file.name.toLowerCase();

  if (/\.(csv|txt)$/i.test(nome)) {
    const head = await file.slice(0, 4096).text();
    if (isPGFNCsv(file, head)) {
      const r = await parsePGFNCsv(file);
      return { ...r, consumido: true };
    }
    return null; // CSV desconhecido — não consumimos
  }

  if (/\.(html?|xhtml)$/i.test(nome) || file.type === "text/html") {
    const html = await file.text();
    if (isPgeSPHtml(html)) {
      const r = await parsePgeSPHtml(file);
      return { ...r, consumido: true };
    }
    return null;
  }

  if (!/\.pdf$/i.test(nome) && file.type !== "application/pdf") return null;

  // Para PDFs, lemos o texto uma vez e despachamos.
  const { text } = await pdfText(file);
  if (isPgeSP(text)) {
    const r = await parsePgeSP(file);
    return { ...r, consumido: true };
  }
  if (isSefazSP(text)) {
    const r = await parseSefazSP(file);
    return { ...r, consumido: true };
  }
  if (isCndSaoPaulo(text)) {
    const r = await parseCndSaoPaulo(file);
    return { ...r, consumido: true };
  }
  return null;
}
