// Leitor de SPED Fiscal (EFD ICMS/IPI) e SPED Contribuições (EFD-Contribuições).
// Extrai faturamento (saídas), compras (entradas) e impostos por mês.
// Os arquivos SPED são texto, registros pipe-delimited iniciando e terminando em "|".

export type SpedTipo = "fiscal" | "contribuicoes" | "pgdas" | "desconhecido";

export interface SpedMonthly {
  /** "AAAA-MM" */
  periodo: string;
  /** Mês 1..12 */
  mes: number;
  ano: number;
  faturamento: number;
  compras: number;
  icmsDebito: number;
  icmsCredito: number;
  ipiDebito: number;
  ipiCredito: number;
  pis: number;
  cofins: number;
  iss: number;
}

export interface SpedParseResult {
  tipo: SpedTipo;
  cnpj?: string;
  razaoSocial?: string;
  inicio?: string; // AAAA-MM-DD
  fim?: string;
  meses: SpedMonthly[];
  totais: Omit<SpedMonthly, "periodo" | "mes" | "ano">;
  registrosLidos: number;
  alertas: string[];
}

const toNumber = (s: string | undefined): number => {
  if (!s) return 0;
  const v = s.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const parseDateBR = (s: string | undefined): Date | undefined => {
  if (!s || s.length !== 8) return undefined;
  const d = Number(s.slice(0, 2));
  const m = Number(s.slice(2, 4));
  const y = Number(s.slice(4, 8));
  return new Date(y, m - 1, d);
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function ensureMonth(map: Map<string, SpedMonthly>, d: Date): SpedMonthly {
  const key = monthKey(d);
  let m = map.get(key);
  if (!m) {
    m = {
      periodo: key, mes: d.getMonth() + 1, ano: d.getFullYear(),
      faturamento: 0, compras: 0,
      icmsDebito: 0, icmsCredito: 0, ipiDebito: 0, ipiCredito: 0,
      pis: 0, cofins: 0, iss: 0,
    };
    map.set(key, m);
  }
  return m;
}

export function parseSped(text: string): SpedParseResult {
  const linhas = text.split(/\r?\n/);
  const meses = new Map<string, SpedMonthly>();
  let cnpj: string | undefined;
  let razaoSocial: string | undefined;
  let inicio: string | undefined;
  let fim: string | undefined;
  let tipo: SpedTipo = "desconhecido";
  let registrosLidos = 0;
  const alertas: string[] = [];

  let currentDoc: { tipo: "saida" | "entrada"; data?: Date; valor: number } | null = null;

  for (const linha of linhas) {
    if (!linha.startsWith("|")) continue;
    const campos = linha.split("|");
    // campos[0] = "" (antes do primeiro |), campos[1] = registro
    const reg = campos[1];
    if (!reg) continue;
    registrosLidos++;

    // Identifica tipo do SPED pelo registro 0000
    if (reg === "0000") {
      // Fiscal: |0000|COD_VER|COD_FIN|DT_INI|DT_FIN|NOME|CNPJ|...
      // Contribuições: |0000|COD_VER|TIPO_ESCRIT|IND_SIT_ESP|NUM_REC_ANTERIOR|DT_INI|DT_FIN|NOME|CNPJ|...
      const possivelDataFiscal = parseDateBR(campos[4]);
      if (possivelDataFiscal) {
        tipo = "fiscal";
        inicio = campos[4];
        fim = campos[5];
        razaoSocial = campos[6];
        cnpj = campos[7];
      } else {
        // tenta layout EFD-Contribuições
        const dt = parseDateBR(campos[6]);
        if (dt) {
          tipo = "contribuicoes";
          inicio = campos[6];
          fim = campos[7];
          razaoSocial = campos[8];
          cnpj = campos[9];
        }
      }
      continue;
    }

    // ===== SPED Fiscal — C100 (NF-e/NF) =====
    // |C100|IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|SER|NUM_DOC|CHV_NFE|DT_DOC|DT_E_S|VL_DOC|...
    if (reg === "C100") {
      const indOper = campos[2]; // 0=entrada, 1=saída
      const dt = parseDateBR(campos[10]) ?? parseDateBR(campos[11]);
      const vlDoc = toNumber(campos[12]);
      if (dt) {
        const m = ensureMonth(meses, dt);
        if (indOper === "1") m.faturamento += vlDoc;
        else m.compras += vlDoc;
      }
      currentDoc = { tipo: indOper === "1" ? "saida" : "entrada", data: dt, valor: vlDoc };
      continue;
    }

    // C170 — itens do C100 (não somar valor do doc — usar para validação se necessário)

    // C190 — totalização ICMS por CFOP/CST do documento C100
    // |C190|CST_ICMS|CFOP|ALIQ_ICMS|VL_OPR|VL_BC_ICMS|VL_ICMS|VL_BC_ICMS_ST|VL_ICMS_ST|VL_RED_BC|VL_IPI|COD_OBS|
    if (reg === "C190" && currentDoc) {
      const vlIcms = toNumber(campos[7]);
      const vlIpi = toNumber(campos[11]);
      if (currentDoc.data) {
        const m = ensureMonth(meses, currentDoc.data);
        if (currentDoc.tipo === "saida") {
          m.icmsDebito += vlIcms;
          m.ipiDebito += vlIpi;
        } else {
          m.icmsCredito += vlIcms;
          m.ipiCredito += vlIpi;
        }
      }
      continue;
    }

    // E110 — Apuração ICMS
    // |E110|VL_TOT_DEBITOS|VL_AJ_DEBITOS|VL_TOT_AJ_DEBITOS|VL_ESTORNOS_CRED|VL_TOT_CREDITOS|VL_AJ_CREDITOS|VL_TOT_AJ_CREDITOS|VL_ESTORNOS_DEB|VL_SLD_CREDOR_ANT|VL_SLD_APURADO|...
    // (não usamos diretamente — preferimos C190 para granularidade)

    // ===== SPED Contribuições =====
    // M210 — Detalhamento da contribuição PIS
    // |M210|COD_CONT|VL_REC_BRT|VL_BC_CONT|...|VL_CONT_APUR|...
    // VL_REC_BRT (campo 3) é a receita bruta da apuração — usamos como faturamento.
    if (reg === "M210") {
      const vlRecBrt = toNumber(campos[3]);
      const vlCont = toNumber(campos[campos.length - 2] || campos[6]);
      if (inicio) {
        const dt = parseDateBR(inicio);
        if (dt) {
          const m = ensureMonth(meses, dt);
          m.pis += vlCont;
          // Soma a receita bruta declarada no M210 (pode haver mais de uma linha por COD_CONT).
          m.faturamento += vlRecBrt;
        }
      }
      continue;
    }
    // M610 — COFINS (não somar faturamento aqui para evitar duplicidade com M210)
    if (reg === "M610") {
      const vlCont = toNumber(campos[campos.length - 2] || campos[6]);
      if (inicio) {
        const dt = parseDateBR(inicio);
        if (dt) {
          const m = ensureMonth(meses, dt);
          m.cofins += vlCont;
        }
      }
      continue;
    }
  }

  if (tipo === "desconhecido") {
    alertas.push("Não foi possível identificar o tipo de SPED (registro 0000).");
  }
  if (meses.size === 0) {
    alertas.push("Nenhum período identificado. Verifique se o arquivo é EFD ICMS/IPI ou EFD-Contribuições.");
  }

  const mesesArr = Array.from(meses.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
  const totais = mesesArr.reduce(
    (acc, m) => ({
      faturamento: acc.faturamento + m.faturamento,
      compras: acc.compras + m.compras,
      icmsDebito: acc.icmsDebito + m.icmsDebito,
      icmsCredito: acc.icmsCredito + m.icmsCredito,
      ipiDebito: acc.ipiDebito + m.ipiDebito,
      ipiCredito: acc.ipiCredito + m.ipiCredito,
      pis: acc.pis + m.pis,
      cofins: acc.cofins + m.cofins,
      iss: acc.iss + m.iss,
    }),
    { faturamento: 0, compras: 0, icmsDebito: 0, icmsCredito: 0, ipiDebito: 0, ipiCredito: 0, pis: 0, cofins: 0, iss: 0 },
  );

  return { tipo, cnpj, razaoSocial, inicio, fim, meses: mesesArr, totais, registrosLidos, alertas };
}
