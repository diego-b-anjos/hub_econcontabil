// Cálculo IRPJ/CSLL Lucro Presumido com majoração (LC nº 224/2025 + IN RFB nº 2.305/2025)
// 1º Trim/2026: majoração apenas IRPJ. A partir do 2º Trim/2026: IRPJ + CSLL.
// Limite trimestral majoração: R$ 1.250.000,00 (excedente => +10% sobre presunção)
// IRPJ adicional: 10% sobre BC que excede R$ 60.000,00 no trimestre

export const LIMITE_MAJORACAO = 1_250_000;
export const LIMITE_ADICIONAL_IRPJ = 60_000;

export type TrimestreId =
  | "1T2026" | "2T2026" | "3T2026" | "4T2026"
  | "1T2027" | "2T2027" | "3T2027" | "4T2027";

export const TRIMESTRES: { id: TrimestreId; label: string; majoraIR: boolean; majoraCSLL: boolean }[] = [
  { id: "1T2026", label: "1º Trimestre / 2026", majoraIR: true, majoraCSLL: false },
  { id: "2T2026", label: "2º Trimestre / 2026", majoraIR: true, majoraCSLL: true },
  { id: "3T2026", label: "3º Trimestre / 2026", majoraIR: true, majoraCSLL: true },
  { id: "4T2026", label: "4º Trimestre / 2026", majoraIR: true, majoraCSLL: true },
  { id: "1T2027", label: "1º Trimestre / 2027", majoraIR: true, majoraCSLL: true },
  { id: "2T2027", label: "2º Trimestre / 2027", majoraIR: true, majoraCSLL: true },
  { id: "3T2027", label: "3º Trimestre / 2027", majoraIR: true, majoraCSLL: true },
  { id: "4T2027", label: "4º Trimestre / 2027", majoraIR: true, majoraCSLL: true },
];

export interface AtividadeTrim {
  id: string;
  nome: string;
  presuncaoIR: number;   // em %, ex.: 8, 32
  presuncaoCSLL: number; // em %, ex.: 12, 32
  receita: number;
}

export interface ApuracaoInput {
  atividades: AtividadeTrim[];
  receitaFinanceira: number;
  irrfRetido: number;
  csllRetida: number;
  pisRetido: number;
  cofinsRetida: number;
  trimestre: TrimestreId;
}

export interface ResultadoAtividade {
  atividade: AtividadeTrim;
  receitaNormal: number;
  receitaMajorada: number;
  bcIRNormal: number;
  bcIRMajorada: number;
  bcCSLLNormal: number;
  bcCSLLMajorada: number;
}

export interface Resultado {
  receitaTotal: number;
  pctNormal: number;
  pctMajorado: number;
  detalhes: ResultadoAtividade[];
  bcIRTotal: number;
  bcCSLLTotal: number;
  bcIRComFinanceira: number;
  bcCSLLComFinanceira: number;
  irpj: number;
  adicionalIR: number;
  irpjTotal: number;
  irpjAPagar: number;
  csll: number;
  csllAPagar: number;
  totalAPagar: number;
}

export interface Comparativo {
  comMajoracao: Resultado;
  semMajoracao: Resultado;
  diffIRPJ: number;
  diffCSLL: number;
  diffTotal: number;
  pctIRPJ: number;
  pctCSLL: number;
  pctTotal: number;
}

function calcularInterno(input: ApuracaoInput, majoraIR: boolean, majoraCSLL: boolean): Resultado {
  const receitaTotal = input.atividades.reduce((s, a) => s + (a.receita || 0), 0);
  const excedente = Math.max(0, receitaTotal - LIMITE_MAJORACAO);
  const pctMajorado = receitaTotal > 0 ? excedente / receitaTotal : 0;
  const pctNormal = 1 - pctMajorado;

  const detalhes: ResultadoAtividade[] = input.atividades.map((a) => {
    const receitaNormal = a.receita * pctNormal;
    const receitaMajorada = a.receita * pctMajorado;
    const fatorIR = majoraIR ? 1.1 : 1;
    const fatorCSLL = majoraCSLL ? 1.1 : 1;
    return {
      atividade: a,
      receitaNormal,
      receitaMajorada,
      bcIRNormal: receitaNormal * (a.presuncaoIR / 100),
      bcIRMajorada: receitaMajorada * (a.presuncaoIR * fatorIR / 100),
      bcCSLLNormal: receitaNormal * (a.presuncaoCSLL / 100),
      bcCSLLMajorada: receitaMajorada * (a.presuncaoCSLL * fatorCSLL / 100),
    };
  });

  const bcIRTotal = detalhes.reduce((s, d) => s + d.bcIRNormal + d.bcIRMajorada, 0);
  const bcCSLLTotal = detalhes.reduce((s, d) => s + d.bcCSLLNormal + d.bcCSLLMajorada, 0);
  const bcIRComFinanceira = bcIRTotal + input.receitaFinanceira;
  const bcCSLLComFinanceira = bcCSLLTotal + input.receitaFinanceira;

  const irpj = bcIRComFinanceira * 0.15;
  const adicionalIR = Math.max(0, bcIRComFinanceira - LIMITE_ADICIONAL_IRPJ) * 0.10;
  const irpjTotal = irpj + adicionalIR;
  const irpjAPagar = Math.max(0, irpjTotal - input.irrfRetido);

  const csll = bcCSLLComFinanceira * 0.09;
  const csllAPagar = Math.max(0, csll - input.csllRetida);

  return {
    receitaTotal, pctNormal, pctMajorado, detalhes,
    bcIRTotal, bcCSLLTotal, bcIRComFinanceira, bcCSLLComFinanceira,
    irpj, adicionalIR, irpjTotal, irpjAPagar,
    csll, csllAPagar, totalAPagar: irpjAPagar + csllAPagar,
  };
}

export function calcularTrim(input: ApuracaoInput): Resultado {
  const t = TRIMESTRES.find((x) => x.id === input.trimestre) ?? TRIMESTRES[0];
  return calcularInterno(input, t.majoraIR, t.majoraCSLL);
}

export function compararTrim(input: ApuracaoInput): Comparativo {
  const t = TRIMESTRES.find((x) => x.id === input.trimestre) ?? TRIMESTRES[0];
  const comMajoracao = calcularInterno(input, t.majoraIR, t.majoraCSLL);
  const semMajoracao = calcularInterno(input, false, false);
  const diffIRPJ = comMajoracao.irpjAPagar - semMajoracao.irpjAPagar;
  const diffCSLL = comMajoracao.csllAPagar - semMajoracao.csllAPagar;
  const diffTotal = comMajoracao.totalAPagar - semMajoracao.totalAPagar;
  return {
    comMajoracao, semMajoracao, diffIRPJ, diffCSLL, diffTotal,
    pctIRPJ: semMajoracao.irpjAPagar > 0 ? diffIRPJ / semMajoracao.irpjAPagar : 0,
    pctCSLL: semMajoracao.csllAPagar > 0 ? diffCSLL / semMajoracao.csllAPagar : 0,
    pctTotal: semMajoracao.totalAPagar > 0 ? diffTotal / semMajoracao.totalAPagar : 0,
  };
}

export const fmtPctTrim = (n: number) =>
  (n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + "%";

export const FUNDAMENTACAO_LEGAL = `EMBASAMENTO LEGAL DA MAJORAÇÃO

A majoração dos percentuais de presunção do Lucro Presumido foi instituída pela Lei Complementar nº 224, de 26 de dezembro de 2025, que classificou o regime do Lucro Presumido como benefício de natureza tributária e determinou a redução linear de tais benefícios mediante o acréscimo de 10% (dez por cento) sobre os percentuais de presunção, nos termos da Lei Complementar nº 210/2024 (que dispõe sobre a sustentabilidade fiscal e a redução linear de incentivos tributários).

A regulamentação operacional foi disciplinada pela Instrução Normativa RFB nº 2.305, de 31 de dezembro de 2025 (DOU 31/12/2025), com alterações promovidas pelas IN RFB nº 2.306/2026 e nº 2.307/2026.

Principais regras aplicadas no presente cálculo:

1) LIMITE DE RECEITA TRIMESTRAL: A parcela da receita bruta trimestral que exceder R$ 1.250.000,00 (um milhão, duzentos e cinquenta mil reais) sofre a majoração de 10% (dez por cento) sobre os percentuais de presunção da base de cálculo do IRPJ e da CSLL.

2) APURAÇÃO PROPORCIONAL: Havendo mais de uma atividade, a majoração é aplicada proporcionalmente sobre cada receita, considerando a participação relativa de cada atividade na parcela da receita total que excede o limite trimestral.

3) VIGÊNCIA ESCALONADA (art. 4º da LC nº 224/2025 c/c IN RFB nº 2.305/2025):
   • IRPJ: majoração aplicável a partir de 1º de janeiro de 2026 (1º Trimestre/2026).
   • CSLL: majoração aplicável a partir de 1º de abril de 2026 (2º Trimestre/2026), em observância à anterioridade nonagesimal (art. 195, §6º, da CF/88).

4) ADICIONAL DE IRPJ: Permanece o adicional de 10% sobre a parcela da base de cálculo trimestral do IRPJ que exceder R$ 60.000,00 (sessenta mil reais), nos termos do art. 3º, §1º, da Lei nº 9.249/1995.

5) ALÍQUOTAS NOMINAIS MANTIDAS: IRPJ 15% + adicional de 10%; CSLL 9%.

OBSERVAÇÃO: A constitucionalidade da LC nº 224/2025 vem sendo questionada no Poder Judiciário, sob os argumentos de violação aos princípios da capacidade contributiva, da isonomia tributária e da vedação ao confisco (art. 150, II e IV, da CF/88). Recomenda-se acompanhamento da jurisprudência e avaliação da pertinência de medida judicial protetiva.`;

// Helper de formatação BRL (caso ainda não esteja em escopo)
export const fmtBRLTrim = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
