// Engine da Reforma Tributária (LC 214/2025).
// Wrapper PURO sobre `tax-engine.ts` — não duplica regras de cálculo.
// Centraliza a projeção pós-reforma (IVA-Dual pleno) e o cronograma 2026-2033,
// para uso pelo `TaxAnalyzerDashboard` e pela aba "Pós-Reforma" do `SimulationEditor`.

import {
  ALIQ_REFERENCIA,
  AnoTransicao,
  RegimeKey,
  ReformaParams,
  SimulationInput,
  SimulationResult,
  TRANSICAO_REFORMA,
  calcAliquotaIVA,
  calculateSimulation,
  getTransicao,
} from "./tax-engine";

export const ANOS_TRANSICAO = Object.keys(TRANSICAO_REFORMA)
  .map(Number)
  .sort((a, b) => a - b);

/** Ano em que a Reforma entra em vigência plena (IVA-Dual sem residuais). */
export const ANO_PLENO = 2033;

export interface ProjecaoPosReformaInput {
  /** Input base — usado como cenário do usuário (regime atual). */
  input: SimulationInput;
  /** Ano alvo da projeção pós-reforma. Default: 2033 (alíquota cheia). */
  yearAlvo?: number;
  /** Forçar alíquota cheia ignorando cronograma. Default: true quando yearAlvo>=2033. */
  aliquotaCheia?: boolean;
}

export interface ProjecaoPosReformaResult {
  /** Resultado anual base (cenário atual do usuário, ano original do input). */
  resultAtual: SimulationResult;
  /** Resultado projetado para o cenário pós-reforma (ano alvo, IVA-Dual). */
  resultPos: SimulationResult;
  /** Ano efetivamente projetado. */
  yearAlvo: number;
  /** Alíquotas IBS/CBS aplicadas na projeção (decimal). */
  aliquotaIVA: { ibs: number; cbs: number };
  /** Snapshot da fase de transição do ano alvo. */
  transicao: AnoTransicao;
  /** Carga total atual e pós-reforma (R$). */
  cargaAtual: number;
  cargaPos: number;
  /** Variação absoluta (positivo = pós-reforma é mais cara). */
  delta: number;
  /** Variação percentual sobre a carga atual (0..1). */
  deltaPct: number;
  /** Regime "atual" considerado (melhor regime habilitado pelo usuário). */
  regimeAtual: RegimeKey;
}

/** Identifica o regime "atual" do usuário (o melhor entre os habilitados, excluindo IVA/SNH). */
export function regimeAtualOf(result: SimulationResult, enabled: RegimeKey[]): RegimeKey {
  const candidatos = enabled.filter((r) => r !== "IVA" && r !== "SNH");
  const totals = result.totals;
  const totalOf = (r: RegimeKey): number => {
    switch (r) {
      case "SN": return totals.snTotal;
      case "LP": return totals.lpTotal;
      case "LR": return totals.lrTotal;
      case "IVA": return totals.ivaTotal;
      case "SNH": return totals.snhTotal;
    }
  };
  if (candidatos.length === 0) return totals.bestRegime;
  return candidatos.reduce((best, r) => (totalOf(r) < totalOf(best) ? r : best), candidatos[0]);
}

function totalByRegime(result: SimulationResult, regime: RegimeKey): number {
  switch (regime) {
    case "SN": return result.totals.snTotal;
    case "LP": return result.totals.lpTotal;
    case "LR": return result.totals.lrTotal;
    case "IVA": return result.totals.ivaTotal;
    case "SNH": return result.totals.snhTotal;
  }
}

/**
 * Projeta o `SimulationInput` no regime IVA-Dual pleno (LC 214/2025).
 * Mantém o motor `calculateSimulation` como única fonte da verdade — apenas
 * troca o ano e força alíquota cheia para obter o cenário pós-reforma.
 */
export function projetarPosReforma(opts: ProjecaoPosReformaInput): ProjecaoPosReformaResult {
  const { input } = opts;
  const yearAlvo = opts.yearAlvo ?? ANO_PLENO;
  const aliquotaCheia = opts.aliquotaCheia ?? (yearAlvo >= ANO_PLENO);

  // Cenário "Pós-Reforma plena": IVA-Dual cheio SEM redutor de transição
  // (LC 214/2025 art. 130). Forçamos `reducaoLC214: 0` e `aliquotaCheia: true`
  // sempre que o ano alvo for >= ANO_PLENO. Antes disso, respeita o input
  // (modelagem de cenário hipotético dentro da transição).
  const reformaPos: ReformaParams = {
    ...(input.reforma ?? {}),
    aliquotaCheia,
    reducaoLC214: yearAlvo >= ANO_PLENO ? 0 : (input.reforma?.reducaoLC214 ?? 0),
  };

  // Cenário atual: input do usuário sem alteração (ano e parâmetros originais).
  const resultAtual = calculateSimulation(input);

  // Cenário pós-reforma: mesmo input, ano alvo, regime IVA-Dual habilitado.
  const enabledPos = Array.from(new Set([...(input.enabledRegimes ?? ["SN", "LP"]), "IVA"])) as RegimeKey[];
  const inputPos: SimulationInput = {
    ...input,
    year: yearAlvo,
    enabledRegimes: enabledPos,
    reforma: reformaPos,
  };
  const resultPos = calculateSimulation(inputPos);

  const aliquotaIVA = calcAliquotaIVA(yearAlvo, reformaPos);
  const transicao = getTransicao(yearAlvo);

  const enabledAtual = input.enabledRegimes ?? ["SN", "LP"];
  const regimeAtual = regimeAtualOf(resultAtual, enabledAtual);
  const cargaAtual = totalByRegime(resultAtual, regimeAtual);
  const cargaPos = resultPos.totals.ivaTotal;
  const delta = cargaPos - cargaAtual;
  const deltaPct = cargaAtual > 0 ? delta / cargaAtual : 0;

  return {
    resultAtual,
    resultPos,
    yearAlvo,
    aliquotaIVA,
    transicao,
    cargaAtual,
    cargaPos,
    delta,
    deltaPct,
    regimeAtual,
  };
}

export interface EvolucaoTransicaoPonto {
  year: number;
  fase: string;
  ibs: number;        // % decimal
  cbs: number;        // % decimal
  cargaIVA: number;   // total IVA (R$) projetado para o ano
  cargaAtual: number; // total do regime atual (R$) projetado para o ano
}

/**
 * Gera a série 2026..2033 (ou faixa equivalente) projetando o input
 * em cada ano da transição. Útil para o gráfico "evolução pós-reforma".
 */
export function projecaoTransicao(
  input: SimulationInput,
  opts?: { fromYear?: number; toYear?: number; reducaoLC214?: number; regimeAtual?: RegimeKey },
): EvolucaoTransicaoPonto[] {
  const from = opts?.fromYear ?? 2026;
  const to = opts?.toYear ?? 2033;
  // Por default, série pós-reforma SEM redutor LC 214 — alinhada à projeção
  // plena de `projetarPosReforma`. Caller pode passar redutor explicitamente
  // se quiser modelar cenário hipotético com benefício mantido.
  const reducaoLC214 = opts?.reducaoLC214 ?? 0;

  const baseEnabled = input.enabledRegimes ?? ["SN", "LP"];

  // Regime "atual" para a série: usa override do chamador (alinhamento com
  // `projetarPosReforma`) ou recomputa o melhor regime habilitado a partir
  // do ano original do input — NUNCA usa heurística "primeiro selecionado",
  // que causaria mismatch label/dado no gráfico.
  const regimeAtualKey: RegimeKey = opts?.regimeAtual
    ?? regimeAtualOf(calculateSimulation(input), baseEnabled);

  const out: EvolucaoTransicaoPonto[] = [];
  for (let y = from; y <= to; y++) {
    const reforma: ReformaParams = {
      reducaoLC214: y >= ANO_PLENO ? 0 : reducaoLC214,
      aliquotaCheia: y >= ANO_PLENO,
    };
    const r = calculateSimulation({
      ...input,
      year: y,
      enabledRegimes: Array.from(new Set([...baseEnabled, "IVA"])) as RegimeKey[],
      reforma,
    });
    const ali = calcAliquotaIVA(y, reforma);
    out.push({
      year: y,
      fase: r.totals.transicao.fase,
      ibs: ali.ibs,
      cbs: ali.cbs,
      cargaIVA: r.totals.ivaTotal,
      cargaAtual: totalByRegime(r, regimeAtualKey),
    });
  }
  return out;
}

/**
 * Constrói um `SimulationInput` anual (12 meses uniformes) a partir de totais.
 * Útil para os atalhos da Reforma (Cálculo SN, Cálculo LP, Comparativo) que
 * trabalham só com receita/folha anuais — sem reescrever fórmulas.
 */
export interface BuildAnnualInputOpts {
  year: number;
  receitaAnual: number;
  folhaAnual: number;
  enabledRegimes: RegimeKey[];
  annex?: import("./tax-engine").Annex;
  presumptionRate?: number;
  cssllPresumptionRate?: number;
  issRate?: number;
  icmsRate?: number;
  ipiRate?: number;
  reforma?: ReformaParams;
}

export function buildAnnualInput(opts: BuildAnnualInputOpts): SimulationInput {
  const revenuePer = +(opts.receitaAnual / 12).toFixed(2);
  const revenueLast = +(opts.receitaAnual - revenuePer * 11).toFixed(2);
  const payrollPer = +(opts.folhaAnual / 12).toFixed(2);
  const payrollLast = +(opts.folhaAnual - payrollPer * 11).toFixed(2);
  const issRate = opts.issRate ?? 0;
  const icmsRate = opts.icmsRate ?? 0;
  const months = Array.from({ length: 12 }, (_, i) => {
    const revenue = i === 11 ? revenueLast : revenuePer;
    const payroll = i === 11 ? payrollLast : payrollPer;
    return {
      month: i + 1,
      revenue,
      activities: [],
      payroll,
      hasEmployees: payroll > 0,
      inssEmployer: +(payroll * 0.20).toFixed(2),
      rat: +(payroll * 0.03).toFixed(2),
      fgts: +(payroll * 0.08).toFixed(2),
      irrf: 0,
      inssSegurado: +(payroll * 0.09).toFixed(2),
      iss: +(revenue * issRate).toFixed(2),
      purchases: 0,
      purchasesIcmsRate: 0,
      purchasesIpiRate: 0,
    };
  });
  return {
    year: opts.year,
    compareMode: "compare",
    enabledRegimes: opts.enabledRegimes,
    reforma: opts.reforma ?? { reducaoLC214: 0, aliquotaCheia: false },
    annex: opts.annex ?? "III",
    autoFatorR: true,
    prev12mRevenue: opts.receitaAnual,
    prev12mPayroll: opts.folhaAnual,
    presumptionRate: opts.presumptionRate ?? 0.32,
    cssllPresumptionRate: opts.cssllPresumptionRate ?? 0.32,
    issRate,
    icmsRate,
    ipiRate: opts.ipiRate ?? 0,
    pisRate: 0.0065,
    cofinsRate: 0.03,
    irpjRate: 0.15,
    csllRate: 0.09,
    months,
  };
}

/** Re-exporta utilitários para evitar imports duplicados nos consumidores. */
export { ALIQ_REFERENCIA, TRANSICAO_REFORMA, calcAliquotaIVA, getTransicao };
export type { AnoTransicao, ReformaParams };
