// Engine de cálculo Simples Nacional + Lucro Presumido
// Base legal: LC 123/2006 (atualizada), tabelas vigentes 2024+.

export type Annex = "I" | "II" | "III" | "IV" | "V";

// Atividade/faturamento — permite múltiplas linhas por mês (ex.: comércio + serviço)
export interface ActivityEntry {
  label?: string;          // descrição (ex.: "Revenda", "Consultoria")
  revenue: number;          // faturamento desta atividade no mês
  annex?: Annex;            // anexo SN específico desta atividade (opcional)
  presumptionRate?: number; // override da presunção IRPJ (0.08/0.16/0.32). Se ausente, usa global
  cssllPresumptionRate?: number; // override presunção CSLL
  issRate?: number;         // ISS específico (serviços)
  icmsRate?: number;        // ICMS específico (comércio/indústria)
  ipiRate?: number;         // IPI específico (indústria) — débito sobre faturamento
}

export interface MonthEntry {
  month: number; // 1..12
  revenue: number; // faturamento total do mês (soma das atividades, se houver)
  activities?: ActivityEntry[]; // opcional — múltiplas atividades/faturamentos
  payroll: number; // folha bruta (salários + pró-labore)
  hasEmployees?: boolean; // se true, considera RAT/FGTS/INSS patronal sobre folha de empregados (LP)
  inssEmployer: number; // INSS patronal (CPP) - apenas Anexo IV; SN III/V isenta
  rat: number; // RAT
  fgts: number; // FGTS sobre folha
  irrf: number; // IRRF retido sobre pró-labore
  inssSegurado: number; // INSS retido empregado/pró-labore
  iss: number; // ISS retido na fonte (informativo)
  annexOverride?: Annex; // override do anexo SN para este mês específico
  // Compras (não-cumulativo / crédito de ICMS e IPI no LP)
  purchases?: number;          // total de compras no mês
  purchasesIcmsRate?: number;  // alíquota média de ICMS sobre compras (gera crédito)
  purchasesIpiRate?: number;   // alíquota média de IPI sobre compras (crédito p/ indústria)
}

export type CompareMode = "compare" | "sn" | "lp";

// Regimes que podem ser comparados na simulação
export type RegimeKey = "SN" | "LP" | "IVA" | "SNH";
export const REGIME_LABELS: Record<RegimeKey, string> = {
  SN: "Simples Nacional",
  LP: "Lucro Presumido",
  IVA: "IBS/CBS (IVA-Dual)",
  SNH: "Simples Nacional Híbrido",
};

// ===== Reforma Tributária (LC 214/2025) =====
// Alíquotas de referência (estimativa atual: IBS 17,7% + CBS 8,8% = 26,5% em 2033).
// Durante a transição, vigora um IBS+CBS reduzido somado a ICMS/ISS/PIS/COFINS proporcionais.
export const ALIQ_REFERENCIA = { ibs: 17.7, cbs: 8.8 } as const;

// Cronograma: % de IBS+CBS sobre referência e % residual de ICMS/ISS e PIS/COFINS.
// Base legal: EC 132/2023 + LC 214/2025 (cronograma oficial).
export interface AnoTransicao {
  year: number;
  ibsPct: number;      // % sobre IBS de referência (0..1)
  cbsPct: number;      // % sobre CBS de referência (0..1)
  icmsIssResid: number; // % residual ICMS/ISS (0..1)
  pisCofinsResid: number; // % residual PIS/COFINS (0..1) — extintos a partir de 2027
  fase: string;
}

export const TRANSICAO_REFORMA: Record<number, AnoTransicao> = {
  2025: { year: 2025, ibsPct: 0,      cbsPct: 0,      icmsIssResid: 1,    pisCofinsResid: 1, fase: "Pré-reforma" },
  2026: { year: 2026, ibsPct: 0.1/17.7, cbsPct: 0.9/8.8, icmsIssResid: 1, pisCofinsResid: 1, fase: "Teste" },
  2027: { year: 2027, ibsPct: 1.0/17.7, cbsPct: 1.0,    icmsIssResid: 1,    pisCofinsResid: 0, fase: "CBS plena (PIS/COFINS extintos)" },
  2028: { year: 2028, ibsPct: 1.0/17.7, cbsPct: 1.0,    icmsIssResid: 1,    pisCofinsResid: 0, fase: "Transição" },
  2029: { year: 2029, ibsPct: 0.10,    cbsPct: 1.0,    icmsIssResid: 0.9,  pisCofinsResid: 0, fase: "Início redução ICMS/ISS (10%)" },
  2030: { year: 2030, ibsPct: 0.20,    cbsPct: 1.0,    icmsIssResid: 0.8,  pisCofinsResid: 0, fase: "Redução 20%" },
  2031: { year: 2031, ibsPct: 0.30,    cbsPct: 1.0,    icmsIssResid: 0.7,  pisCofinsResid: 0, fase: "Redução 30%" },
  2032: { year: 2032, ibsPct: 0.40,    cbsPct: 1.0,    icmsIssResid: 0.6,  pisCofinsResid: 0, fase: "Redução 40%" },
  2033: { year: 2033, ibsPct: 1.0,     cbsPct: 1.0,    icmsIssResid: 0,    pisCofinsResid: 0, fase: "Implementação plena" },
};

export function getTransicao(year: number): AnoTransicao {
  return TRANSICAO_REFORMA[year] ?? (year < 2026 ? TRANSICAO_REFORMA[2025] : TRANSICAO_REFORMA[2033]);
}

export interface ReformaParams {
  /** % de redução LC 214 sobre IBS e CBS (0..1). Ex: 0.6 = redução de 60% (saúde/educação). */
  reducaoLC214?: number;
  /** Forçar alíquota cheia (ignora cronograma de transição). Default false. */
  aliquotaCheia?: boolean;
  /** Override da alíquota de referência IBS (em %). Quando informado, substitui ALIQ_REFERENCIA.ibs. */
  ibsRefOverride?: number;
  /** Override da alíquota de referência CBS (em %). Quando informado, substitui ALIQ_REFERENCIA.cbs. */
  cbsRefOverride?: number;
}

// === Majoração LC 224/2025 (regulamentada pela IN RFB nº 2.305/2025) ===
// Acima de R$ 1.250.000 de receita por TRIMESTRE, a parcela excedente
// tem as presunções de IRPJ e CSLL acrescidas de 10% (multiplicador 1.10).
// Vigência: IRPJ a partir de 2026; CSLL a partir do 2º trimestre de 2026.
export const MAJ_LIMITE_TRIMESTRAL = 1_250_000;
export function majoracaoVigente(year: number, month: number): { ir: boolean; csll: boolean } {
  if (year < 2026) return { ir: false, csll: false };
  // 1T2026 (jan/fev/mar): só IRPJ
  if (year === 2026 && month <= 3) return { ir: true, csll: false };
  return { ir: true, csll: true };
}

export interface SimulationInput {
  year: number;
  /** Aplica majoração LC 224/2025 ao Lucro Presumido (default: true a partir de 2026). */
  applyMajoracao2026?: boolean;
  /** Modo legado — mantido para retrocompatibilidade. Se `enabledRegimes` for informado, ele prevalece. */
  compareMode: CompareMode;
  /** Novo: regimes ativos para comparação (checkboxes). Default: ["SN","LP"]. */
  enabledRegimes?: RegimeKey[];
  /** Parâmetros da Reforma (LC 214/2025). */
  reforma?: ReformaParams;
  annex: Annex; // anexo escolhido (ou "auto" tratado fora)
  autoFatorR: boolean; // se true, alterna entre III e V conforme Fator R
  prev12mRevenue: number; // RBT12 inicial (receita dos 12 meses anteriores) — fallback se prev12mMonthlyRevenue não informado
  prev12mPayroll: number; // folha dos 12 meses anteriores (para Fator R) — fallback
  prev12mMonthlyRevenue?: number[]; // detalhamento mês a mês dos 12 meses anteriores (índice 0 = mais antigo)
  prev12mMonthlyPayroll?: number[]; // idem para folha
  presumptionRate: number; // 0.08 / 0.16 / 0.32 (global, usada quando atividade não tem override)
  cssllPresumptionRate: number; // 0.12 (com/ind) ou 0.32 (serviços)
  issRate: number; // 0.02 a 0.05
  icmsRate: number; // ICMS global (0 a 0.18). Aplicado a comércio/indústria no LP
  ipiRate?: number; // IPI global (indústria) — débito sobre faturamento no LP
  pisRate: number; // 0.0065 (cumulativo LP)
  cofinsRate: number; // 0.03 (cumulativo LP)
  irpjRate: number; // 0.15 + 0.10 adicional
  csllRate: number; // 0.09
  months: MonthEntry[];
}

/** Resolve quais regimes estão ativos, dando precedência ao novo `enabledRegimes`. */
export function resolveRegimes(input: Pick<SimulationInput, "enabledRegimes" | "compareMode">): RegimeKey[] {
  if (input.enabledRegimes && input.enabledRegimes.length > 0) return input.enabledRegimes;
  if (input.compareMode === "sn") return ["SN"];
  if (input.compareMode === "lp") return ["LP"];
  return ["SN", "LP"];
}

// Tabelas Simples Nacional 2024 — alíquota nominal e parcela a deduzir.
// Faixas (RBT12): 180.000, 360.000, 720.000, 1.800.000, 3.600.000, 4.800.000
export const SN_TABLES: Record<Annex, { aliquot: number; deduct: number }[]> = {
  I: [
    { aliquot: 0.04, deduct: 0 },
    { aliquot: 0.073, deduct: 5940 },
    { aliquot: 0.095, deduct: 13860 },
    { aliquot: 0.107, deduct: 22500 },
    { aliquot: 0.143, deduct: 87300 },
    { aliquot: 0.19, deduct: 378000 },
  ],
  II: [
    { aliquot: 0.045, deduct: 0 },
    { aliquot: 0.078, deduct: 5940 },
    { aliquot: 0.10, deduct: 13860 },
    { aliquot: 0.112, deduct: 22500 },
    { aliquot: 0.147, deduct: 85500 },
    { aliquot: 0.30, deduct: 720000 },
  ],
  III: [
    { aliquot: 0.06, deduct: 0 },
    { aliquot: 0.112, deduct: 9360 },
    { aliquot: 0.135, deduct: 17640 },
    { aliquot: 0.16, deduct: 35640 },
    { aliquot: 0.21, deduct: 125640 },
    { aliquot: 0.33, deduct: 648000 },
  ],
  IV: [
    { aliquot: 0.045, deduct: 0 },
    { aliquot: 0.09, deduct: 8100 },
    { aliquot: 0.102, deduct: 12420 },
    { aliquot: 0.14, deduct: 39780 },
    { aliquot: 0.22, deduct: 183780 },
    { aliquot: 0.33, deduct: 828000 },
  ],
  V: [
    { aliquot: 0.155, deduct: 0 },
    { aliquot: 0.18, deduct: 4500 },
    { aliquot: 0.195, deduct: 9900 },
    { aliquot: 0.205, deduct: 17100 },
    { aliquot: 0.23, deduct: 62100 },
    { aliquot: 0.305, deduct: 540000 },
  ],
};

export const FAIXAS_SN = [180000, 360000, 720000, 1800000, 3600000, 4800000];
const FAIXAS = FAIXAS_SN; // alias interno

/** Retorna o índice (0..5) da faixa SN aplicada conforme RBT12. */
export function snFaixaIndex(rbt12: number): number {
  if (rbt12 <= 0) return 0;
  if (rbt12 > 4800000) return 5;
  const idx = FAIXAS.findIndex((f) => rbt12 < f);
  return idx === -1 ? 5 : idx;
}

export function snEffectiveRate(rbt12: number, annex: Annex): number {
  if (rbt12 <= 0) return SN_TABLES[annex][0].aliquot;
  if (rbt12 > 4800000) return 0; // sublimite
  const i = snFaixaIndex(rbt12);
  const { aliquot, deduct } = SN_TABLES[annex][i];
  return (rbt12 * aliquot - deduct) / rbt12;
}

/** Calcula IBS+CBS efetivos (em decimal) para um determinado ano e parâmetros LC 214. */
export function calcAliquotaIVA(year: number, reforma?: ReformaParams): { ibs: number; cbs: number } {
  const t = getTransicao(year);
  const reduc = reforma?.reducaoLC214 ?? 0;
  const ibsRef = (reforma?.ibsRefOverride ?? ALIQ_REFERENCIA.ibs) / 100;
  const cbsRef = (reforma?.cbsRefOverride ?? ALIQ_REFERENCIA.cbs) / 100;
  const ibs = (reforma?.aliquotaCheia ? ibsRef : ibsRef * t.ibsPct) * (1 - reduc);
  const cbs = (reforma?.aliquotaCheia ? cbsRef : cbsRef * t.cbsPct) * (1 - reduc);
  return { ibs, cbs };
}

export interface MonthResult {
  month: number;
  revenue: number;
  rbt12: number;
  fatorR: number; // 0..1
  annexApplied: Annex;
  snRate: number;
  snTax: number; // DAS
  snFaixa: number; // 0..5 — faixa de RBT12 aplicada
  payrollTaxes: number;
  // Lucro presumido — detalhamento de impostos
  lpIRPJ: number;
  lpAdicional: number;
  lpCSLL: number;
  lpPIS: number;
  lpCOFINS: number;
  lpISS: number;
  lpICMS: number;
  lpICMSCredito: number;
  lpIPI: number;
  lpIPICredito: number;
  lpINSSPatronal: number;
  /** IBS incorporado ao LP a partir de 2027 (cronograma da Reforma). */
  lpIBS: number;
  /** CBS incorporado ao LP a partir de 2027. */
  lpCBS: number;
  lpTotal: number;
  // Reforma — IBS/CBS (IVA-Dual) substituindo PIS/COFINS/ICMS/ISS conforme transição
  ivaIBS: number;
  ivaCBS: number;
  ivaResidual: number; // ICMS/ISS/PIS/COFINS residuais que ainda incidem no ano
  ivaIRPJ: number;     // mantém IRPJ/CSLL/INSS patronal do LP
  ivaCSLL: number;
  ivaINSSPatronal: number;
  ivaTotal: number;    // total IVA-Dual + IRPJ/CSLL + folha
  // Simples Nacional Híbrido — DAS reduzido (sem PIS/COFINS/ICMS/ISS) + IBS/CBS por fora
  snhDAS: number;
  snhIBS: number;
  snhCBS: number;
  snhTotal: number;
  // Totais comparativos
  totalSN: number;
  totalLP: number;
  totalIVA: number;
  totalSNH: number;
}

export interface SimulationResult {
  months: MonthResult[];
  totals: {
    revenue: number;
    snDAS: number;
    snTotal: number;
    lpTotal: number;
    ivaTotal: number;
    snhTotal: number;
    payrollGross: number;
    payrollEmployerCost: number;
    bestRegime: RegimeKey;
    saving: number;
    avgFatorR: number;
    /** Totais por regime habilitado, na ordem de `enabledRegimes`. */
    byRegime: { regime: RegimeKey; total: number }[];
    /** Parâmetros da transição usados (para exibição). */
    transicao: AnoTransicao;
    aliquotaIVA: { ibs: number; cbs: number };
  };
}

export function calculateSimulation(input: SimulationInput): SimulationResult {
  // Janela móvel RBT12 e folha 12m
  const revenueWindow: number[] = [];
  const payrollWindow: number[] = [];
  // Inicialização: usa detalhamento mês-a-mês se informado; senão distribui uniformemente
  const prevRev = input.prev12mMonthlyRevenue;
  const prevPay = input.prev12mMonthlyPayroll;
  for (let i = 0; i < 12; i++) {
    revenueWindow.push(
      prevRev && prevRev.length === 12 ? (prevRev[i] || 0) : input.prev12mRevenue / 12
    );
    payrollWindow.push(
      prevPay && prevPay.length === 12 ? (prevPay[i] || 0) : input.prev12mPayroll / 12
    );
  }

  const monthsResult: MonthResult[] = [];
  let totalRevenue = 0,
    totalSnDAS = 0,
    totalSnAll = 0,
    totalLpAll = 0,
    totalIvaAll = 0,
    totalSnhAll = 0,
    totalPayroll = 0,
    totalEmployerCost = 0,
    fatorRSum = 0;

  // Acumulador de receita por trimestre p/ majoração LC 224/2025
  const trimRevenueAcc: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const applyMaj = input.applyMajoracao2026 !== false; // default: ligado

  // Acumulador de base IRPJ por trimestre para calcular adicional corretamente
  // (Lei 9.249/95: limite de R$ 60.000 por trimestre, não por mês)
  const trimIRPJBaseAcc: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

  // Reforma — alíquotas IBS/CBS conforme ano da simulação
  const transicao = getTransicao(input.year);
  const aliquotaIVA = calcAliquotaIVA(input.year, input.reforma);

  for (const m of input.months) {
    const rbt12 = revenueWindow.reduce((a, b) => a + b, 0);
    const folha12 = payrollWindow.reduce((a, b) => a + b, 0);
    const fatorR = rbt12 > 0 ? folha12 / rbt12 : 0;
    const snFaixa = snFaixaIndex(rbt12);

    // Anexo: override do mês > Fator R automático > anexo global
    // Fator R só se aplica ao Anexo V: se Fator R >= 28% → usa Anexo III (mais favorável)
    // Anexo III nunca tem Fator R — fica fixo em III independente da folha.
    let annexApplied: Annex = m.annexOverride ?? input.annex;
    if (!m.annexOverride && input.autoFatorR && input.annex === "V") {
      annexApplied = fatorR >= 0.28 ? "III" : "V";
    }

    let snTax = 0;
    let snRate = 0;
    const actsForSN: ActivityEntry[] = m.activities && m.activities.length > 0 ? m.activities : [];
    const hasPerActivityAnnex = actsForSN.some((a) => !!a.annex);
    if (hasPerActivityAnnex) {
      for (const a of actsForSN) {
        const ax = a.annex ?? annexApplied;
        const rate = snEffectiveRate(rbt12, ax);
        snTax += a.revenue * rate;
      }
      snRate = m.revenue > 0 ? snTax / m.revenue : 0;
    } else {
      snRate = snEffectiveRate(rbt12, annexApplied);
      snTax = m.revenue * snRate;
    }

    const payrollDirect = m.fgts + m.irrf + m.inssSegurado;

    const acts: ActivityEntry[] = (m.activities && m.activities.length > 0)
      ? m.activities
      : [{ revenue: m.revenue, presumptionRate: input.presumptionRate, cssllPresumptionRate: input.cssllPresumptionRate, issRate: input.issRate, icmsRate: input.icmsRate, ipiRate: input.ipiRate }];

    const trimNum = Math.ceil(m.month / 3);
    const accBefore = trimRevenueAcc[trimNum] || 0;
    const accAfter = accBefore + m.revenue;
    const trigger = MAJ_LIMITE_TRIMESTRAL;
    const monthExcedente = applyMaj
      ? Math.max(0, accAfter - trigger) - Math.max(0, accBefore - trigger)
      : 0;
    trimRevenueAcc[trimNum] = accAfter;
    const vig = applyMaj ? majoracaoVigente(input.year, m.month) : { ir: false, csll: false };
    const pctExc = m.revenue > 0 ? monthExcedente / m.revenue : 0;
    const pctNor = 1 - pctExc;

    let lpIRPJBase = 0, lpCSLLBase = 0, lpISS = 0, lpICMSDeb = 0, lpIPIDeb = 0;
    for (const a of acts) {
      const pres = a.presumptionRate ?? input.presumptionRate;
      const cpres = a.cssllPresumptionRate ?? input.cssllPresumptionRate;
      const iss = a.issRate ?? input.issRate;
      const icms = a.icmsRate ?? input.icmsRate;
      const ipi = a.ipiRate ?? input.ipiRate ?? 0;
      const isService = (pres ?? input.presumptionRate) >= 0.32;
      const aRevNor = a.revenue * pctNor;
      const aRevExc = a.revenue * pctExc;
      const fIR = vig.ir ? 1.10 : 1;
      const fCS = vig.csll ? 1.10 : 1;
      lpIRPJBase += aRevNor * pres + aRevExc * pres * fIR;
      lpCSLLBase += aRevNor * cpres + aRevExc * cpres * fCS;
      lpISS += isService ? a.revenue * iss : 0;
      lpICMSDeb += !isService ? a.revenue * icms : 0;
      if (!isService && ipi > 0) lpIPIDeb += a.revenue * ipi;
    }
    const lpCSLL = lpCSLLBase * input.csllRate;
    const purchases = m.purchases || 0;
    const lpICMSCredito = purchases * (m.purchasesIcmsRate || 0);
    const lpIPICredito = purchases * (m.purchasesIpiRate || 0);
    const lpICMS = Math.max(0, lpICMSDeb - lpICMSCredito);
    const lpIPI = Math.max(0, lpIPIDeb - lpIPICredito);
    // Adicional IRPJ: limite de R$ 60.000 por trimestre (Lei 9.249/95, art. 3º §1º)
    // Calcula incrementalmente para manter a corretude mesmo com receita desigual entre meses
    const trimBaseAntes = trimIRPJBaseAcc[trimNum];
    trimIRPJBaseAcc[trimNum] += lpIRPJBase;
    const trimBaseDepois = trimIRPJBaseAcc[trimNum];
    const adicTrimDepois = Math.max(0, trimBaseDepois - 60_000) * 0.10;
    const adicTrimAntes  = Math.max(0, trimBaseAntes  - 60_000) * 0.10;
    const lpIRPJ = lpIRPJBase * input.irpjRate;
    const lpAdicional = adicTrimDepois - adicTrimAntes;
    const lpPIS = m.revenue * input.pisRate;
    const lpCOFINS = m.revenue * input.cofinsRate;
    const ratValue = m.rat > 0 ? m.rat : (m.hasEmployees !== false ? m.payroll * 0.02 : 0);
    const lpINSSPatronal = m.payroll * 0.20 + ratValue;
    // A partir de 2027 a Reforma Tributária se incorpora automaticamente ao LP
    // conforme o cronograma oficial (LC 214/2025): IBS+CBS sobre receita,
    // com PIS/COFINS já extintos e ICMS/ISS sendo gradualmente reduzidos.
    const incorporaReforma = input.year >= 2027;
    const lpIBS = incorporaReforma ? m.revenue * aliquotaIVA.ibs : 0;
    const lpCBS = incorporaReforma ? m.revenue * aliquotaIVA.cbs : 0;
    // Se a reforma já se incorpora, aplica os percentuais residuais sobre PIS/COFINS/ICMS/ISS
    const lpPISFinal  = incorporaReforma ? lpPIS    * transicao.pisCofinsResid : lpPIS;
    const lpCOFFinal  = incorporaReforma ? lpCOFINS * transicao.pisCofinsResid : lpCOFINS;
    const lpICMSFinal = incorporaReforma ? lpICMS   * transicao.icmsIssResid   : lpICMS;
    const lpISSFinal  = incorporaReforma ? lpISS    * transicao.icmsIssResid   : lpISS;
    const lpTotal = lpIRPJ + lpAdicional + lpCSLL + lpPISFinal + lpCOFFinal + lpISSFinal + lpICMSFinal + lpIPI + lpINSSPatronal + lpIBS + lpCBS;

    // ===== Reforma — IBS/CBS (IVA-Dual) =====
    // No regime IVA-Dual (substituindo o LP): IBS+CBS sobre receita;
    // residuais ICMS/ISS/PIS/COFINS conforme cronograma de transição.
    const ivaIBS = m.revenue * aliquotaIVA.ibs;
    const ivaCBS = m.revenue * aliquotaIVA.cbs;
    const lpResidualICMSISS = (lpICMS + lpISS) * transicao.icmsIssResid;
    const lpResidualPISCOF = (lpPIS + lpCOFINS) * transicao.pisCofinsResid;
    const ivaResidual = lpResidualICMSISS + lpResidualPISCOF;
    const ivaTotalImpostos = ivaIBS + ivaCBS + ivaResidual + lpIRPJ + lpAdicional + lpCSLL + lpINSSPatronal;
    const totalIVA = ivaTotalImpostos + payrollDirect;

    // ===== Simples Nacional Híbrido =====
    // DAS sem PIS/COFINS/ICMS/ISS (estimativa: faixa SN da reforma quando 2027+; senão SN normal)
    // + IBS e CBS por fora.
    const useReformaSN = input.year >= 2027;
    let snhDASRate = snRate;
    if (useReformaSN) {
      // Aproximação: usa a tabela SN-pós-reforma (constants/tax-tables) — aplica fator de redução.
      // Para manter independência de imports, replicamos as alíquotas reduzidas inline.
      snhDASRate = snEffectiveRateReforma(rbt12, annexApplied);
    }
    const snhDAS = m.revenue * snhDASRate;
    const snhIBS = ivaIBS;
    const snhCBS = ivaCBS;
    const totalSNH = snhDAS + snhIBS + snhCBS + payrollDirect;

    const totalSN = snTax + payrollDirect;
    const totalLP = lpTotal + payrollDirect;

    monthsResult.push({
      month: m.month,
      revenue: m.revenue,
      rbt12,
      fatorR,
      annexApplied,
      snRate,
      snTax,
      snFaixa,
      payrollTaxes: payrollDirect,
      lpIRPJ,
      lpAdicional,
      lpCSLL,
      lpPIS: lpPISFinal,
      lpCOFINS: lpCOFFinal,
      lpISS: lpISSFinal,
      lpICMS: lpICMSFinal,
      lpICMSCredito,
      lpIPI,
      lpIPICredito,
      lpINSSPatronal,
      lpIBS,
      lpCBS,
      lpTotal,
      ivaIBS,
      ivaCBS,
      ivaResidual,
      ivaIRPJ: lpIRPJ + lpAdicional,
      ivaCSLL: lpCSLL,
      ivaINSSPatronal: lpINSSPatronal,
      ivaTotal: ivaTotalImpostos,
      snhDAS,
      snhIBS,
      snhCBS,
      snhTotal: snhDAS + snhIBS + snhCBS,
      totalSN,
      totalLP,
      totalIVA,
      totalSNH,
    });

    totalRevenue += m.revenue;
    totalSnDAS += snTax;
    totalSnAll += totalSN;
    totalLpAll += totalLP;
    totalIvaAll += totalIVA;
    totalSnhAll += totalSNH;
    totalPayroll += m.payroll;
    totalEmployerCost += lpINSSPatronal;
    fatorRSum += fatorR;

    revenueWindow.shift();
    revenueWindow.push(m.revenue);
    payrollWindow.shift();
    payrollWindow.push(m.payroll);
  }

  // Determina o melhor entre os regimes habilitados
  const regimes = resolveRegimes(input);
  const totalsByRegime: Record<RegimeKey, number> = {
    SN: totalSnAll, LP: totalLpAll, IVA: totalIvaAll, SNH: totalSnhAll,
  };
  const byRegime = regimes.map((r) => ({ regime: r, total: totalsByRegime[r] }));
  const sorted = [...byRegime].sort((a, b) => a.total - b.total);
  const bestRegime: RegimeKey = sorted[0]?.regime ?? "SN";
  const saving = sorted.length > 1 ? Math.abs(sorted[sorted.length - 1].total - sorted[0].total) : 0;

  return {
    months: monthsResult,
    totals: {
      revenue: totalRevenue,
      snDAS: totalSnDAS,
      snTotal: totalSnAll,
      lpTotal: totalLpAll,
      ivaTotal: totalIvaAll,
      snhTotal: totalSnhAll,
      payrollGross: totalPayroll,
      payrollEmployerCost: totalEmployerCost,
      bestRegime,
      saving,
      avgFatorR: input.months.length ? fatorRSum / input.months.length : 0,
      byRegime,
      transicao,
      aliquotaIVA,
    },
  };
}

// ===== Tabelas SN pós-reforma (LC 214/2025) — sem PIS/COFINS/ICMS/ISS =====
// Usadas no regime "Simples Nacional Híbrido".
const SN_REFORMA_TABLES: Record<Annex, { aliquot: number; deduct: number }[]> = {
  I: [
    { aliquot: 0.030, deduct: 0 },     { aliquot: 0.055, deduct: 4500 },
    { aliquot: 0.070, deduct: 9900 },  { aliquot: 0.078, deduct: 15660 },
    { aliquot: 0.105, deduct: 64260 }, { aliquot: 0.140, deduct: 280800 },
  ],
  II: [
    { aliquot: 0.033, deduct: 0 },      { aliquot: 0.057, deduct: 4320 },
    { aliquot: 0.073, deduct: 10080 },  { aliquot: 0.082, deduct: 16560 },
    { aliquot: 0.108, deduct: 63360 },  { aliquot: 0.220, deduct: 532800 },
  ],
  III: [
    { aliquot: 0.045, deduct: 0 },      { aliquot: 0.084, deduct: 7020 },
    { aliquot: 0.101, deduct: 13140 },  { aliquot: 0.120, deduct: 26820 },
    { aliquot: 0.157, deduct: 93420 },  { aliquot: 0.247, deduct: 486000 },
  ],
  IV: [
    { aliquot: 0.034, deduct: 0 },      { aliquot: 0.068, deduct: 6120 },
    { aliquot: 0.077, deduct: 9360 },   { aliquot: 0.105, deduct: 29520 },
    { aliquot: 0.165, deduct: 137520 }, { aliquot: 0.247, deduct: 619200 },
  ],
  V: [
    { aliquot: 0.116, deduct: 0 },      { aliquot: 0.135, deduct: 3420 },
    { aliquot: 0.146, deduct: 7380 },   { aliquot: 0.154, deduct: 13140 },
    { aliquot: 0.172, deduct: 45540 },  { aliquot: 0.228, deduct: 414000 },
  ],
};

export function snEffectiveRateReforma(rbt12: number, annex: Annex): number {
  if (rbt12 <= 0) return SN_REFORMA_TABLES[annex][0].aliquot;
  if (rbt12 > 4800000) return 0;
  const i = snFaixaIndex(rbt12);
  const { aliquot, deduct } = SN_REFORMA_TABLES[annex][i];
  return (rbt12 * aliquot - deduct) / rbt12;
}

export { SN_REFORMA_TABLES };

export const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const ANNEX_LABELS: Record<Annex, string> = {
  I: "Anexo I — Comércio",
  II: "Anexo II — Indústria",
  III: "Anexo III — Serviços (Fator R ≥ 28%)",
  IV: "Anexo IV — Construção/Vigilância",
  V: "Anexo V — Serviços (Fator R < 28%)",
};

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export function formatPct(v: number, digits = 2): string {
  return `${(v * 100).toFixed(digits)}%`;
}

// ===== Auto cálculo de encargos sobre folha =====
// Tabela INSS segurado 2024 (progressiva). Retorna o valor retido do empregado.
export function calcINSSSegurado(salario: number): number {
  if (salario <= 0) return 0;
  const faixas = [
    { ate: 1412.00, aliq: 0.075 },
    { ate: 2666.68, aliq: 0.09 },
    { ate: 4000.03, aliq: 0.12 },
    { ate: 7786.02, aliq: 0.14 },
  ];
  let inss = 0;
  let anterior = 0;
  for (const f of faixas) {
    if (salario > f.ate) {
      inss += (f.ate - anterior) * f.aliq;
      anterior = f.ate;
    } else {
      inss += (salario - anterior) * f.aliq;
      return +inss.toFixed(2);
    }
  }
  return +(7786.02 * 0.14).toFixed(2);
}

// IRRF 2024 (progressivo) — base = salário - INSS - dependentes.
export function calcIRRF(salario: number, inssRetido: number, dependentes = 0): number {
  const base = Math.max(0, salario - inssRetido - dependentes * 189.59);
  const faixas = [
    { ate: 2259.20, aliq: 0,    deduzir: 0 },
    { ate: 2826.65, aliq: 0.075, deduzir: 169.44 },
    { ate: 3751.05, aliq: 0.15,  deduzir: 381.44 },
    { ate: 4664.68, aliq: 0.225, deduzir: 662.77 },
  ];
  for (const f of faixas) {
    if (base <= f.ate) return +Math.max(0, base * f.aliq - f.deduzir).toFixed(2);
  }
  return +Math.max(0, base * 0.275 - 896.00).toFixed(2);
}

// Calcula automaticamente os encargos da folha a partir do bruto.
// hasEmployees=true → considera RAT 2% e FGTS 8% (empregados); false → apenas pró-labore (sem RAT/FGTS).
export function autoCalcPayrollCharges(payroll: number, hasEmployees = true) {
  const inssSegurado = calcINSSSegurado(payroll);
  const irrf = calcIRRF(payroll, inssSegurado);
  const rat = hasEmployees ? +(payroll * 0.02).toFixed(2) : 0;
  const fgts = hasEmployees ? +(payroll * 0.08).toFixed(2) : 0;
  return { inssSegurado, irrf, rat, fgts };
}
