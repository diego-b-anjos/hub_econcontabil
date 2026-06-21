/**
 * ============================================================================
 *  CATÁLOGO ÚNICO DE TRIBUTOS, OBRIGAÇÕES E INTEGRAÇÕES — ECON HUB
 * ----------------------------------------------------------------------------
 *  Esta é a ÚNICA fonte de verdade do escritório para:
 *    1. Tributos calculáveis no comparativo (Simulações / Apuração Trimestral)
 *    2. Obrigações fiscais e prazos exibidos no Calendário
 *    3. Mapeamento "qual integração é a fonte de cada dado"
 *       (SCI, Acessórias, importação manual, parser SPED, parser PGDAS-D, etc.)
 *
 *  Quando você acrescentar/alterar:
 *    - um tributo: edite TRIBUTOS
 *    - uma obrigação: edite OBRIGACOES (referencia tributoId)
 *    - uma integração: edite INTEGRACOES_FONTE
 *
 *  As páginas devem importar daqui em vez de duplicar listas.
 * ============================================================================
 */

import type { LucideIcon } from "lucide-react";

// ----------------------------------------------------------------------------
// TIPOS
// ----------------------------------------------------------------------------

export type Esfera = "federal" | "estadual" | "municipal" | "trabalhista";

export type RegimeAplicavel =
  | "Simples Nacional"
  | "Lucro Presumido"
  | "Lucro Real"
  | "MEI"
  | "Imune/Isenta"
  | "Todos";

/** Identificador único do tributo dentro do escritório (slug-style). */
export type TributoId =
  // Federais — empresa
  | "irpj" | "csll" | "pis" | "cofins" | "ipi"
  | "irrf_folha" | "irrf_servicos_pj" | "irrf_dividendos"
  | "inss_patronal" | "rat" | "terceiros" | "fgts"
  | "cprb_desoneracao"
  | "ret_imobiliario"
  | "pcc_retencao"            // PIS/COFINS/CSLL retidos (4,65%) — Lei 10.833/03 art. 30
  | "das_simples"
  | "ibs" | "cbs"             // Reforma tributária — LC 214/2025
  // Estadual
  | "icms" | "icms_st" | "icms_difal"
  // Municipal
  | "iss";

export interface Tributo {
  id: TributoId;
  sigla: string;
  nome: string;
  esfera: Esfera;
  regimes: RegimeAplicavel[];
  baseCalculo: string;
  descricao: string;
  embasamento: string;
  /** Campos do `tax-engine` que referenciam este tributo (chaves do MonthEntry/result). */
  camposEngine?: string[];
  /** Códigos DARF/GPS/GNRE/etc usados para recolhimento. */
  codigos?: string[];
}

export interface Obrigacao {
  id: string;
  /** Tributos que esta obrigação recolhe ou declara (referência ao catálogo). */
  tributoIds: TributoId[];
  /** Dia padrão de vencimento. Se variar (decêndio etc.), descreva em `regraVencimento`. */
  dia: number;
  /** Override do dia de vencimento para meses específicos (ex: mês 7 → dia 31). */
  diasPorMes?: Record<number, number>;
  /** Meses em que ocorre (1..12). Vazio/undefined = mensal todo mês. */
  mesesEspeciais?: number[];
  /** Se true, NÃO é recorrente mensal — só nos meses em `mesesEspeciais`. */
  apenasNosMesesEspeciais?: boolean;
  nome: string;
  tipo: Esfera;
  ente?: string;
  regimes?: RegimeAplicavel[];
  descricao: string;
  regraVencimento?: string;
  embasamento: string;
  /** Sistema de origem dos dados que alimentam essa obrigação. */
  fonteDados?: FonteDadosId[];
  link?: string;
}

export type FonteDadosId =
  | "SCI"           // Sistema Contábil Integrado (módulo SCI Faturamento/Protocolos)
  | "ACESSORIAS"    // Plataforma Acessorias (gestão de entregas)
  | "SPED_FISCAL"   // Parser de SPED Fiscal interno
  | "PGDAS_D"       // Parser do PGDAS-D
  | "FOLHA"         // Folha de pagamento (eSocial)
  | "MANUAL"        // Lançamento manual no Hub
  | "RECEITA";      // Consulta direta no portal RFB/SEFAZ

export interface IntegracaoFonte {
  id: FonteDadosId;
  nome: string;
  descricao: string;
  /** Tributos cujos dados podem vir desta integração. */
  tributos: TributoId[];
  /** Páginas do Hub que consomem esta fonte. */
  paginas: string[];
}

// ============================================================================
// 1. TRIBUTOS
// ============================================================================

export const TRIBUTOS: Record<TributoId, Tributo> = {
  // ===== FEDERAIS — EMPRESA =====
  irpj: {
    id: "irpj", sigla: "IRPJ", nome: "Imposto de Renda Pessoa Jurídica",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Lucro real, presumido ou arbitrado",
    descricao: "Imposto sobre o lucro das pessoas jurídicas. Presumido: alíquota 15% + adicional 10% sobre excedente trimestral de R$ 60 mil.",
    embasamento: "RIR/2018 (Decreto 9.580/2018), arts. 218 e ss.; Lei 9.249/1995",
    camposEngine: ["irpj"],
    codigos: ["DARF 2089 (LP)", "DARF 2362 (LR estimativa)", "DARF 0220 (LR ajuste)"],
  },
  csll: {
    id: "csll", sigla: "CSLL", nome: "Contribuição Social sobre Lucro Líquido",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Lucro presumido (12%/32%) ou real",
    descricao: "Contribuição social sobre o lucro. Alíquota 9% (15% para instituições financeiras).",
    embasamento: "Lei 7.689/1988; Lei 9.249/1995, art. 20",
    camposEngine: ["csll"],
    codigos: ["DARF 2372 (LP)", "DARF 2484 (LR)"],
  },
  pis: {
    id: "pis", sigla: "PIS", nome: "PIS/Pasep",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real", "Simples Nacional"],
    baseCalculo: "Receita bruta (cumulativo 0,65% / não-cumulativo 1,65%)",
    descricao: "Contribuição para o Programa de Integração Social. Apurado no DAS pelo SN.",
    embasamento: "Lei 9.715/1998; Lei 10.637/2002 (não-cumulativo)",
    camposEngine: ["pis"],
    codigos: ["DARF 8109 (cumulativo)", "DARF 6912 (não-cumulativo)"],
  },
  cofins: {
    id: "cofins", sigla: "COFINS", nome: "Contribuição para o Financiamento da Seguridade Social",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real", "Simples Nacional"],
    baseCalculo: "Receita bruta (cumulativo 3% / não-cumulativo 7,6%)",
    descricao: "Contribuição para a seguridade social. Apurada no DAS pelo SN.",
    embasamento: "LC 70/1991; Lei 10.833/2003 (não-cumulativo)",
    camposEngine: ["cofins"],
    codigos: ["DARF 2172 (cumulativo)", "DARF 5856 (não-cumulativo)"],
  },
  ipi: {
    id: "ipi", sigla: "IPI", nome: "Imposto sobre Produtos Industrializados",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real", "Simples Nacional"],
    baseCalculo: "Valor da operação de saída do produto industrializado",
    descricao: "Imposto seletivo sobre produtos industrializados. Alíquotas conforme TIPI.",
    embasamento: "RIPI — Decreto 7.212/2010; Lei 4.502/1964",
    camposEngine: ["ipi"],
    codigos: ["DARF conforme TIPI"],
  },
  irrf_folha: {
    id: "irrf_folha", sigla: "IRRF/Folha", nome: "IRRF — Rendimentos do Trabalho",
    esfera: "federal", regimes: ["Todos"],
    baseCalculo: "Tabela progressiva mensal sobre salários e pró-labore",
    descricao: "Imposto de Renda Retido na Fonte sobre rendimentos do trabalho assalariado e pró-labore.",
    embasamento: "RIR/2018, art. 776; Lei 11.196/2005, art. 70",
    camposEngine: ["irrf"],
    codigos: ["DARF 0561"],
  },
  irrf_servicos_pj: {
    id: "irrf_servicos_pj", sigla: "IRRF/Serv.", nome: "IRRF — Serviços PJ",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Receita bruta de serviços profissionais prestados (1,5% ou 1%)",
    descricao: "Retenção de IR sobre serviços de natureza profissional prestados por PJ a outra PJ (auditoria, consultoria, advocacia, etc.).",
    embasamento: "Lei 7.713/1988, art. 55; IN RFB 1.234/2012",
    codigos: ["DARF 1708"],
  },
  irrf_dividendos: {
    id: "irrf_dividendos", sigla: "IRRF/Div.", nome: "IRRF — Distribuição de Lucros",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Lucros e dividendos distribuídos a sócios/acionistas",
    descricao: "Tributação dos lucros distribuídos. Em vigor a partir de 2026 conforme reforma do IR (PL 1.087/2025 / LC 214/2025): 10% sobre lucros distribuídos acima de R$ 50.000/mês ao mesmo beneficiário PF, retido pelo pagador.",
    embasamento: "Lei 9.249/1995, art. 10 (isenção histórica); PL 1.087/2025 (Reforma IR); LC 214/2025",
    codigos: ["DARF — código a ser definido pela RFB"],
  },
  inss_patronal: {
    id: "inss_patronal", sigla: "INSS Pat.", nome: "Contribuição Previdenciária Patronal",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Folha de pagamento (20% sobre salários e pró-labore)",
    descricao: "CPP de 20% sobre a folha. SN Anexos I, II, III e V não recolhem (incluso no DAS); Anexo IV recolhe.",
    embasamento: "Lei 8.212/1991, art. 22, I; IN RFB 2.110/2022",
    camposEngine: ["inssEmployer"],
    codigos: ["GPS 2100"],
  },
  rat: {
    id: "rat", sigla: "RAT/SAT", nome: "Risco Ambiental do Trabalho",
    esfera: "federal", regimes: ["Todos"],
    baseCalculo: "Folha (1%, 2% ou 3% conforme grau de risco × FAP)",
    descricao: "Contribuição para custeio dos benefícios decorrentes de acidente de trabalho.",
    embasamento: "Lei 8.212/1991, art. 22, II; Decreto 6.957/2009 (FAP)",
    camposEngine: ["rat"],
  },
  terceiros: {
    id: "terceiros", sigla: "Terceiros", nome: "Contribuições a Terceiros (Sistema S)",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Folha (5,8% padrão — SESI/SESC, SENAI/SENAC, SEBRAE, INCRA, Salário-Educação)",
    descricao: "Contribuições destinadas ao Sistema S e outras entidades.",
    embasamento: "Decreto-Lei 4.048/1942 e seguintes; Lei 11.457/2007",
  },
  fgts: {
    id: "fgts", sigla: "FGTS", nome: "Fundo de Garantia por Tempo de Serviço",
    esfera: "federal", regimes: ["Todos"],
    baseCalculo: "Folha (8% sobre remunerações de empregados CLT)",
    descricao: "Depósito mensal em conta vinculada do trabalhador.",
    embasamento: "Lei 8.036/1990, art. 15; Decreto 99.684/1990",
    camposEngine: ["fgts"],
  },
  cprb_desoneracao: {
    id: "cprb_desoneracao", sigla: "CPRB", nome: "Contribuição Previdenciária sobre Receita Bruta — Desoneração da Folha",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Receita bruta (1% a 4,5% conforme CNAE)",
    descricao: "Substitui a CPP de 20% sobre folha pelo recolhimento sobre a receita bruta — opção anual irretratável. Lei 14.973/2024 prorrogou e definiu transição: 2024 100% CPRB → 2025 80%/20% folha → 2026 60%/40% → 2027 40%/60% → 2028 fim.",
    embasamento: "Lei 12.546/2011, arts. 7º a 9º; Lei 14.973/2024 (prorrogação até 2027 com transição)",
    codigos: ["DARF 2985 / 2991"],
  },
  ret_imobiliario: {
    id: "ret_imobiliario", sigla: "RET", nome: "Regime Especial de Tributação — Patrimônio de Afetação",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Receita mensal das incorporações afetadas (4% — equivalente a IRPJ + CSLL + PIS + COFINS)",
    descricao: "Incorporações imobiliárias submetidas a patrimônio de afetação podem optar pelo RET — recolhimento unificado mensal de 4% (1,92% IRPJ; 0,98% CSLL; 0,37% PIS; 1,71% COFINS). Programa MCMV: alíquota reduzida 1%.",
    embasamento: "Lei 10.931/2004, arts. 1º a 11; IN RFB 1.435/2013",
    codigos: ["DARF 4095 (RET 4%)", "DARF 1068 (RET-MCMV 1%)"],
  },
  pcc_retencao: {
    id: "pcc_retencao", sigla: "PCC", nome: "Retenção PIS/COFINS/CSLL (4,65%) — Serviços PJ",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Receita bruta de serviços profissionais prestados (PIS 0,65% + COFINS 3% + CSLL 1% = 4,65%)",
    descricao: "Retenção das contribuições federais por PJ tomadora de serviços profissionais (limpeza, vigilância, consultoria, etc.) prestados por outra PJ. Dispensada se ≤ R$ 215,05.",
    embasamento: "Lei 10.833/2003, arts. 30 a 36; IN SRF 459/2004",
    codigos: ["DARF 5952 (CSRF unificado)"],
  },
  das_simples: {
    id: "das_simples", sigla: "DAS", nome: "DAS — Simples Nacional",
    esfera: "federal", regimes: ["Simples Nacional", "MEI"],
    baseCalculo: "Receita bruta dos últimos 12 meses (RBT12) × alíquota efetiva por anexo",
    descricao: "Documento de arrecadação unificado que recolhe IRPJ, CSLL, PIS, COFINS, IPI (se aplicável), CPP (Anexos I/II/III/V), ICMS e ISS.",
    embasamento: "LC 123/2006, art. 21, III; Resolução CGSN 140/2018, art. 38",
    codigos: ["DAS"],
  },
  ibs: {
    id: "ibs", sigla: "IBS", nome: "Imposto sobre Bens e Serviços",
    esfera: "estadual", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Valor agregado de operações com bens e serviços",
    descricao: "Substitui ICMS e ISS. Estado + Município. Implantação 2026-2033 (transição) — alíquota teste 0,1% em 2026.",
    embasamento: "EC 132/2023; LC 214/2025",
  },
  cbs: {
    id: "cbs", sigla: "CBS", nome: "Contribuição sobre Bens e Serviços",
    esfera: "federal", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Valor agregado de operações com bens e serviços (federal)",
    descricao: "Substitui PIS/COFINS. Implantação 2026-2027 — alíquota teste 0,9% em 2026.",
    embasamento: "EC 132/2023; LC 214/2025",
  },

  // ===== ESTADUAL =====
  icms: {
    id: "icms", sigla: "ICMS", nome: "Imposto sobre Circulação de Mercadorias e Serviços",
    esfera: "estadual", regimes: ["Lucro Presumido", "Lucro Real"],
    baseCalculo: "Valor da operação de circulação ou prestação (transporte/comunicação)",
    descricao: "Imposto estadual não-cumulativo. SP: alíquota interna padrão 18%.",
    embasamento: "LC 87/1996 (Lei Kandir); RICMS/SP — Decreto 45.490/2000",
    camposEngine: ["icms"],
  },
  icms_st: {
    id: "icms_st", sigla: "ICMS-ST", nome: "ICMS — Substituição Tributária",
    esfera: "estadual", regimes: ["Lucro Presumido", "Lucro Real", "Simples Nacional"],
    baseCalculo: "MVA/IVA-ST sobre o preço do substituto",
    descricao: "Recolhimento antecipado do ICMS pelo substituto tributário (indústria/importador) referente às operações subsequentes.",
    embasamento: "RICMS/SP — Decreto 45.490/2000, arts. 268 e ss.; Portaria CAT 68/2019",
  },
  icms_difal: {
    id: "icms_difal", sigla: "DIFAL", nome: "Diferencial de Alíquotas — EC 87/2015",
    esfera: "estadual", regimes: ["Lucro Presumido", "Lucro Real", "Simples Nacional"],
    baseCalculo: "Diferença entre alíquota interna do destinatário e interestadual",
    descricao: "DIFAL nas operações interestaduais a consumidor final não contribuinte do ICMS.",
    embasamento: "EC 87/2015; LC 190/2022; Convênio ICMS 236/2021",
  },

  // ===== MUNICIPAL =====
  iss: {
    id: "iss", sigla: "ISS", nome: "Imposto sobre Serviços de Qualquer Natureza",
    esfera: "municipal", regimes: ["Lucro Presumido", "Lucro Real", "Simples Nacional"],
    baseCalculo: "Preço do serviço (alíquota: 2% a 5% conforme município e LC 116/2003)",
    descricao: "Imposto municipal sobre prestação de serviços. Lista de serviços tributáveis na LC 116/2003.",
    embasamento: "LC 116/2003; LC 175/2020 (DEC nacional); legislação municipal",
    camposEngine: ["iss"],
  },
};

// ============================================================================
// 2. OBRIGAÇÕES (vencimentos do calendário)
// ============================================================================

// --- Federais recorrentes ---
const OBR_FGTS: Obrigacao = {
  id: "fgts_mensal", tributoIds: ["fgts"], dia: 7, nome: "FGTS",
  tipo: "trabalhista",
  descricao: "Recolhimento do FGTS sobre a folha de pagamento da competência anterior (8% sobre remunerações).",
  embasamento: "Lei 8.036/1990, art. 15; Decreto 99.684/1990",
  fonteDados: ["FOLHA"],
};
const OBR_INSS: Obrigacao = {
  id: "inss_gps", tributoIds: ["inss_patronal", "rat", "terceiros"], dia: 20,
  nome: "INSS Patronal / GPS", tipo: "federal",
  descricao: "CPP 20% + RAT/SAT + Terceiros sobre a folha do mês anterior. Substituível pela CPRB (desoneração).",
  embasamento: "Lei 8.212/1991, arts. 22 e 30; IN RFB 2.110/2022",
  fonteDados: ["FOLHA"],
};
const OBR_CPRB: Obrigacao = {
  id: "cprb_desoneracao_mensal", tributoIds: ["cprb_desoneracao"], dia: 20,
  nome: "CPRB — Desoneração da Folha", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Recolhimento da Contribuição Previdenciária sobre a Receita Bruta (1% a 4,5% conforme CNAE) em substituição à CPP de 20% sobre folha. Vence no mesmo dia do INSS Patronal.",
  regraVencimento: "Até o dia 20 do mês subsequente ao da competência (mesmo prazo da CPP).",
  embasamento: "Lei 12.546/2011, arts. 7º a 9º; Lei 14.973/2024 (transição 2024-2027)",
  fonteDados: ["MANUAL", "SCI"],
};
const OBR_IRRF_FOLHA: Obrigacao = {
  id: "irrf_folha", tributoIds: ["irrf_folha"], dia: 20,
  nome: "IRRF — Trabalho Assalariado (DARF 0561)", tipo: "federal",
  descricao: "Imposto de Renda Retido na Fonte sobre rendimentos do trabalho assalariado e pró-labore.",
  embasamento: "RIR/2018, art. 776; Lei 11.196/2005, art. 70",
  fonteDados: ["FOLHA"],
};
const OBR_PCC_RETENCAO: Obrigacao = {
  id: "pcc_csrf", tributoIds: ["pcc_retencao"], dia: 20,
  nome: "Retenções Federais — PIS/COFINS/CSLL (CSRF 5952)", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Recolhimento unificado das retenções de PIS/COFINS/CSLL (4,65%) sobre serviços profissionais tomados de outra PJ. Dispensada se ≤ R$ 215,05.",
  regraVencimento: "Até o último dia útil do segundo decêndio do mês subsequente (≈ dia 20).",
  embasamento: "Lei 10.833/2003, art. 35; IN SRF 459/2004",
  fonteDados: ["MANUAL", "SCI"],
};
const OBR_IRRF_SERVICOS: Obrigacao = {
  id: "irrf_servicos_pj", tributoIds: ["irrf_servicos_pj"], dia: 20,
  nome: "IRRF — Serviços PJ (DARF 1708)", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Retenção de IR sobre serviços profissionais (1,5% / 1%) prestados por PJ a outra PJ.",
  regraVencimento: "Até o último dia útil do segundo decêndio do mês subsequente.",
  embasamento: "Lei 7.713/1988, art. 55; IN RFB 1.234/2012",
  fonteDados: ["MANUAL", "SCI"],
};
const OBR_IRRF_DIVIDENDOS: Obrigacao = {
  id: "irrf_dividendos", tributoIds: ["irrf_dividendos"], dia: 20,
  nome: "IRRF — Distribuição de Lucros (10%)", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Retenção de 10% sobre lucros distribuídos a PF acima de R$ 50.000/mês (mesmo beneficiário). Vigência a partir de 2026 conforme reforma do IR. Recolhimento pelo pagador.",
  regraVencimento: "Até o 3º dia útil do 2º decêndio subsequente ao do pagamento (regra geral IRRF).",
  embasamento: "PL 1.087/2025; LC 214/2025; Lei 9.249/1995, art. 10 (regra anterior)",
  fonteDados: ["MANUAL"],
};
const OBR_DAS: Obrigacao = {
  id: "das_simples", tributoIds: ["das_simples"], dia: 20,
  nome: "DAS — Simples Nacional", tipo: "federal",
  regimes: ["Simples Nacional"],
  descricao: "Documento de Arrecadação do Simples Nacional (PGDAS-D) referente ao mês anterior.",
  embasamento: "LC 123/2006, art. 21, III; Resolução CGSN 140/2018, art. 38",
  fonteDados: ["PGDAS_D", "SCI"],
};
const OBR_DCTFWEB: Obrigacao = {
  id: "dctfweb", tributoIds: ["inss_patronal", "cprb_desoneracao"], dia: 25,
  nome: "DCTFWeb", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Declaração de Débitos e Créditos Tributários Federais Previdenciários — competência anterior.",
  embasamento: "IN RFB 2.005/2021; MP 2.158-35/2001",
  fonteDados: ["FOLHA", "ACESSORIAS"],
};
const OBR_EFD_CONTRIB: Obrigacao = {
  id: "efd_contribuicoes", tributoIds: ["pis", "cofins"], dia: 14,
  nome: "EFD-Contribuições", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "EFD-Contribuições (PIS/COFINS) — até o 10º dia útil do 2º mês subsequente ao de referência.",
  embasamento: "IN RFB 1.252/2012",
  fonteDados: ["SPED_FISCAL", "SCI"],
};
const OBR_EFD_REINF: Obrigacao = {
  id: "efd_reinf", tributoIds: ["pcc_retencao", "irrf_servicos_pj"], dia: 15,
  nome: "EFD-Reinf", tipo: "federal",
  descricao: "Escrituração Fiscal Digital de Retenções e Outras Informações Fiscais. Substitui parcialmente a antiga DIRF a partir de 2024.",
  embasamento: "IN RFB 2.043/2021; Decreto 8.373/2014",
  fonteDados: ["FOLHA", "ACESSORIAS"],
};
const OBR_ESOCIAL: Obrigacao = {
  id: "esocial_folha", tributoIds: ["irrf_folha", "inss_patronal", "fgts"], dia: 15,
  nome: "eSocial — Folha", tipo: "trabalhista",
  descricao: "Eventos periódicos da folha (S-1200, S-1210, S-1299) — até o dia 15 do mês seguinte.",
  embasamento: "Decreto 8.373/2014; Portaria Conjunta SEPRT/RFB/ME 71/2021",
  fonteDados: ["FOLHA"],
};
const OBR_DIRBI: Obrigacao = {
  id: "dirbi_mensal", tributoIds: ["irpj", "csll", "pis", "cofins", "ipi"], dia: 20,
  nome: "DIRBI — Declaração de Incentivos, Renúncias e Benefícios Tributários",
  tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Declaração mensal obrigatória para PJ que usufruam de benefícios fiscais federais (lista da IN). Inclui Perse, RECAP, Reidi, SUDAM/SUDENE, depreciação acelerada, etc.",
  regraVencimento: "Até o 20º dia do segundo mês subsequente ao período de apuração.",
  embasamento: "Lei 14.973/2024, arts. 43 e 44; IN RFB 2.198/2024 (alterada pela IN 2.216/2024)",
  fonteDados: ["MANUAL", "SCI"],
};
const OBR_RET: Obrigacao = {
  id: "ret_imobiliario", tributoIds: ["ret_imobiliario"], dia: 20,
  nome: "RET — Patrimônio de Afetação (DARF 4095/1068)", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Recolhimento mensal unificado do RET para incorporações imobiliárias com patrimônio de afetação. Alíquota 4% (RET) ou 1% (RET-MCMV).",
  regraVencimento: "Até o dia 20 do mês subsequente ao do recebimento das receitas.",
  embasamento: "Lei 10.931/2004, arts. 1º a 11; IN RFB 1.435/2013",
  fonteDados: ["MANUAL", "SCI"],
};

// --- Estadual SP ---
const OBR_ICMS_RPA: Obrigacao = {
  id: "icms_rpa_sp", tributoIds: ["icms"], dia: 20, nome: "ICMS — RPA (SP)",
  tipo: "estadual", ente: "SP",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "ICMS apurado pelo Regime Periódico de Apuração. Vencimento varia por CPR e CNAE.",
  embasamento: "RICMS/SP — Decreto 45.490/2000, art. 112; Portaria CAT 173/2020",
  fonteDados: ["SPED_FISCAL"],
};
const OBR_GIA_SP: Obrigacao = {
  id: "gia_sp", tributoIds: ["icms"], dia: 16, nome: "GIA-ICMS/SP",
  tipo: "estadual", ente: "SP",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Guia de Informação e Apuração do ICMS — entrega mensal conforme dígito final da IE (dias 16 a 21).",
  embasamento: "RICMS/SP, art. 254; Portaria CAT 92/1998, Anexo IV",
  fonteDados: ["SPED_FISCAL", "ACESSORIAS"],
};
const OBR_SPED_FISCAL: Obrigacao = {
  id: "sped_fiscal_sp", tributoIds: ["icms", "ipi"], dia: 20,
  nome: "SPED Fiscal (EFD ICMS/IPI)", tipo: "estadual", ente: "SP",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Transmissão da Escrituração Fiscal Digital (EFD ICMS/IPI). Prazo nacional unificado: dia 20 do mês subsequente (alterado pelo Convênio ICMS 31/2024 e ratificado pela Portaria CAT/SP atual).",
  regraVencimento: "Até o dia 20 do mês subsequente ao de apuração (regra nacional vigente).",
  embasamento: "Convênio ICMS 143/2006; Ajuste SINIEF 2/2009; Convênio ICMS 31/2024 (unificação dia 20)",
  fonteDados: ["SPED_FISCAL"],
};
const OBR_DIFAL: Obrigacao = {
  id: "icms_difal", tributoIds: ["icms_difal"], dia: 20, nome: "DIFAL — EC 87/2015",
  tipo: "estadual", ente: "SP",
  regimes: ["Lucro Presumido", "Lucro Real", "Simples Nacional"],
  descricao: "Diferencial de Alíquota nas operações interestaduais a consumidor final.",
  embasamento: "EC 87/2015; LC 190/2022; Convênio ICMS 236/2021",
  fonteDados: ["SPED_FISCAL"],
};
const OBR_ICMS_ST: Obrigacao = {
  id: "icms_st", tributoIds: ["icms_st"], dia: 9, nome: "ICMS-ST — Substituição Tributária",
  tipo: "estadual", ente: "SP",
  regimes: ["Lucro Presumido", "Lucro Real", "Simples Nacional"],
  descricao: "ICMS retido por substituição tributária — em regra dia 9 do mês subsequente para SP.",
  embasamento: "RICMS/SP, arts. 268 e ss.; Portaria CAT 68/2019",
  fonteDados: ["SPED_FISCAL"],
};

// --- Municipais ---
const mkISS = (
  id: string, ente: string, dia: number, descricao: string, embasamento: string,
): Obrigacao => ({
  id, tributoIds: ["iss"], dia, nome: `ISS — ${ente}`,
  tipo: "municipal", ente, descricao, embasamento,
  fonteDados: ["SCI", "ACESSORIAS"],
});

const ISS_SP        = mkISS("iss_sp", "São Paulo/SP", 10,
  "ISS próprio e retido. Vencimento padrão dia 10 do mês seguinte.",
  "Lei Municipal 13.701/2003; Decreto 53.151/2012 (RISS-SP); IN SF/SUREM 19/2011");
const ISS_OSASCO    = mkISS("iss_osasco", "Osasco/SP", 10,
  "ISS próprio e retido — vencimento dia 10. DEISS na mesma data.",
  "LC Municipal 169/2008; Decreto 11.051/2014 (RISS)");
const ISS_BARUERI   = mkISS("iss_barueri", "Barueri/SP", 9,
  "ISS próprio e retido — vencimento até o dia 9 do mês subsequente. DMS-Barueri também na mesma data.",
  "LC Municipal 118/2002; Decreto 6.270/2007 e alterações");
const ISS_SANTANA   = mkISS("iss_santana_parnaiba", "Santana de Parnaíba/SP", 15,
  "ISS próprio e retido — vencimento dia 15 do mês seguinte. NFS-e municipal.",
  "LC Municipal 31/2003; Decreto 3.567/2009");
const ISS_COTIA     = mkISS("iss_cotia", "Cotia/SP", 10,
  "ISS próprio e retido — vencimento dia 10. DMS-Cotia mensal.",
  "Lei Municipal 1.481/2003; Decreto 7.012/2009");
const ISS_SANTOANDRE= mkISS("iss_santo_andre", "Santo André/SP", 15,
  "ISS próprio e retido — vencimento dia 15. DES-IF até o último dia útil.",
  "Lei Municipal 9.302/2013; Decreto 16.450/2014");
const ISS_SBC       = mkISS("iss_sbc", "São Bernardo do Campo/SP", 10,
  "ISS próprio e retido — vencimento dia 10. DMS via portal NFS-e SBC.",
  "Lei Municipal 6.073/2010; Decreto 17.380/2010");

const MUNICIPAIS: Obrigacao[] = [
  ISS_SP, ISS_OSASCO, ISS_BARUERI, ISS_SANTANA, ISS_COTIA, ISS_SANTOANDRE, ISS_SBC,
];

// Recorrentes mensais (todas as competências)
const OBR_PIS_COFINS_MENSAL: Obrigacao = {
  id: "pis_cofins_mensal", tributoIds: ["pis", "cofins"], dia: 25,
  nome: "PIS/COFINS — Apuração mensal", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Recolhimento de PIS (DARF 8109/6912) e COFINS (DARF 2172/5856) apurados no mês anterior. Cumulativo (LP) ou não-cumulativo (LR).",
  regraVencimento: "Até o 25º dia do mês subsequente ao de apuração.",
  embasamento: "Lei 10.637/2002, art. 10; Lei 10.833/2003, art. 11; Lei 11.933/2009",
  fonteDados: ["SCI", "MANUAL"],
};

const RECORRENTES: Obrigacao[] = [
  OBR_FGTS,
  OBR_EFD_CONTRIB,
  OBR_EFD_REINF,
  OBR_ESOCIAL,
  OBR_INSS,
  OBR_CPRB,
  OBR_IRRF_FOLHA,
  OBR_PCC_RETENCAO,
  OBR_IRRF_SERVICOS,
  OBR_IRRF_DIVIDENDOS,
  OBR_DAS,
  OBR_DCTFWEB,
  OBR_DIRBI,
  OBR_RET,
  OBR_PIS_COFINS_MENSAL,
  OBR_ICMS_ST,
  OBR_GIA_SP,
  OBR_ICMS_RPA,
  OBR_DIFAL,
  OBR_SPED_FISCAL,
  ...MUNICIPAIS,
];

// Anuais / eventuais
const OBR_OPCAO_SN: Obrigacao = {
  id: "opcao_simples", tributoIds: ["das_simples"], dia: 31,
  mesesEspeciais: [1], apenasNosMesesEspeciais: true,
  nome: "Opção pelo Simples Nacional", tipo: "federal",
  regimes: ["Simples Nacional"],
  descricao: "Prazo final para PJ já constituídas optarem pelo regime do Simples Nacional para o ano-calendário corrente. A opção é irretratável para todo o ano. LC 214/2025 trouxe ajustes — atenção a vedações novas para PJ ligadas a setores da reforma tributária.",
  regraVencimento: "Até o último dia útil de janeiro de cada ano.",
  embasamento: "LC 123/2006, art. 16; Resolução CGSN 140/2018, art. 6º; LC 214/2025 (ajustes)",
  fonteDados: ["RECEITA"],
};
const OBR_INFORME_RENDIMENTOS: Obrigacao = {
  id: "informe_rendimentos", tributoIds: ["irrf_folha"], dia: 28,
  mesesEspeciais: [2], apenasNosMesesEspeciais: true,
  nome: "Informe de Rendimentos (PF)", tipo: "federal",
  descricao: "Entrega aos beneficiários (empregados, sócios, prestadores PF) do Comprovante de Rendimentos referente ao ano-calendário anterior. Substitui a função informativa da extinta DIRF a partir de 2024.",
  regraVencimento: "Até o último dia útil de fevereiro.",
  embasamento: "IN RFB 2.060/2021 (atualizada); IN RFB 2.181/2024 (extinção da DIRF para fatos a partir de 1º/01/2024)",
  fonteDados: ["FOLHA", "SCI"],
};
const OBR_DASN_SIMEI: Obrigacao = {
  id: "dasn_simei", tributoIds: ["das_simples"], dia: 31,
  mesesEspeciais: [5], apenasNosMesesEspeciais: true,
  nome: "DASN-SIMEI (MEI)", tipo: "federal", regimes: ["MEI"],
  descricao: "Declaração Anual do MEI — ano-base anterior.",
  regraVencimento: "Até 31 de maio.",
  embasamento: "Resolução CGSN 140/2018, art. 109",
  fonteDados: ["RECEITA"],
};
const OBR_ECD: Obrigacao = {
  id: "ecd", tributoIds: ["irpj", "csll"], dia: 31,
  mesesEspeciais: [5], apenasNosMesesEspeciais: true,
  nome: "ECD — Escrituração Contábil Digital", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Entrega da ECD (ano-base anterior). Prazo: último dia útil de maio.",
  embasamento: "IN RFB 2.003/2021; Decreto 6.022/2007",
  fonteDados: ["SCI", "MANUAL"],
};
const OBR_DIRPF_INI: Obrigacao = {
  id: "dirpf_inicio", tributoIds: ["irrf_folha"], dia: 15,
  mesesEspeciais: [3], apenasNosMesesEspeciais: true,
  nome: "Início — DIRPF", tipo: "federal",
  descricao: "Início do prazo para entrega da Declaração de IRPF (até 31 de maio).",
  embasamento: "IN RFB anual; Lei 9.250/1995", fonteDados: ["RECEITA"],
};
const OBR_DIRPF_FIM: Obrigacao = {
  id: "dirpf_fim", tributoIds: ["irrf_folha"], dia: 31,
  mesesEspeciais: [5], apenasNosMesesEspeciais: true,
  nome: "DIRPF — Prazo final", tipo: "federal",
  descricao: "Prazo final para entrega da Declaração de IRPF.",
  embasamento: "IN RFB anual; Lei 9.250/1995, art. 7º", fonteDados: ["RECEITA"],
};
const OBR_DEFIS: Obrigacao = {
  id: "defis", tributoIds: ["das_simples"], dia: 31,
  mesesEspeciais: [3], apenasNosMesesEspeciais: true,
  nome: "DEFIS (Simples Nacional)", tipo: "federal", regimes: ["Simples Nacional"],
  descricao: "Declaração de Informações Socioeconômicas e Fiscais — ano-base anterior. Prazo legal: 31 de março (art. 72 da Resolução CGSN 140/2018). Verifique se a Receita Federal emitiu prorrogação para o ano vigente.",
  regraVencimento: "Até 31 de março do ano subsequente (prazo legal). Frequentemente prorrogado por Ato CGSN — confirmar no portal do Simples Nacional.",
  embasamento: "Resolução CGSN 140/2018, art. 72; LC 123/2006, art. 25", fonteDados: ["PGDAS_D"],
};
const OBR_ECF: Obrigacao = {
  id: "ecf", tributoIds: ["irpj", "csll"], dia: 31,
  mesesEspeciais: [7], apenasNosMesesEspeciais: true,
  nome: "ECF — Escrituração Contábil Fiscal", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Entrega da ECF — ano-base anterior. Prazo: último dia útil de julho.",
  embasamento: "IN RFB 2.004/2021; Decreto 6.022/2007", fonteDados: ["SCI"],
};
const OBR_DIMOB: Obrigacao = {
  id: "dimob", tributoIds: ["irpj"], dia: 28,
  mesesEspeciais: [2], apenasNosMesesEspeciais: true,
  nome: "DIMOB — Declaração de Atividades Imobiliárias", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Declaração obrigatória para construtoras, incorporadoras, imobiliárias e administradoras de imóveis. Informa operações de aquisição/alienação, locação e intermediação.",
  regraVencimento: "Até o último dia útil de fevereiro do ano subsequente.",
  embasamento: "IN RFB 1.115/2010 (alterada pela IN 1.192/2011 e IN 2.155/2023)",
  fonteDados: ["MANUAL", "SCI"],
};
const OBR_DMED: Obrigacao = {
  id: "dmed", tributoIds: ["irpj"], dia: 28,
  mesesEspeciais: [2], apenasNosMesesEspeciais: true,
  nome: "DMED — Declaração de Serviços Médicos e de Saúde", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Declaração obrigatória para PJ prestadoras de serviços de saúde e operadoras de planos. Informa pagamentos recebidos de PF (com identificação) e reembolsos.",
  regraVencimento: "Até o último dia útil de fevereiro do ano subsequente.",
  embasamento: "IN RFB 985/2009 (alterações posteriores); art. 11 da Lei 10.450/2002",
  fonteDados: ["MANUAL", "SCI"],
};
// IRPJ e CSLL — apuração trimestral (Lucro Presumido / Lucro Real trimestral).
// Vencimento: último dia útil do mês subsequente ao encerramento do trimestre
// (1T: abr, 2T: jul, 3T: out, 4T: jan do ano seguinte). Cota única ou em até 3
// quotas mensais (mín. R$ 1.000, +Selic). Embasamento: art. 5º da Lei 9.430/1996.
const OBR_IRPJ_TRIM: Obrigacao = {
  id: "irpj_trimestral", tributoIds: ["irpj"], dia: 30,
  // Mês 1, 7, 10 têm 31 dias → vence no 31; mês 4 (abril) tem 30 dias → vence no 30
  diasPorMes: { 1: 31, 7: 31, 10: 31 },
  mesesEspeciais: [1, 4, 7, 10], apenasNosMesesEspeciais: true,
  nome: "IRPJ — Apuração Trimestral", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Recolhimento do IRPJ apurado no trimestre encerrado em 31/mar (vence 30/abr), 30/jun (vence 31/jul), 30/set (vence 31/out) e 31/dez (vence 31/jan). Pode ser pago em cota única ou em até 3 quotas mensais (mín. R$ 1.000, acrescidas de Selic). Adicional de 10% sobre lucro trimestral excedente a R$ 60.000.",
  regraVencimento: "Último dia útil do mês subsequente ao encerramento do trimestre (abril=30, julho=31, outubro=31, janeiro=31).",
  embasamento: "Lei 9.430/1996, arts. 1º a 5º; RIR/2018, arts. 217 e 856; IN RFB 1.700/2017",
  fonteDados: ["MANUAL", "SCI"],
};
const OBR_CSLL_TRIM: Obrigacao = {
  id: "csll_trimestral", tributoIds: ["csll"], dia: 30,
  diasPorMes: { 1: 31, 7: 31, 10: 31 },
  mesesEspeciais: [1, 4, 7, 10], apenasNosMesesEspeciais: true,
  nome: "CSLL — Apuração Trimestral", tipo: "federal",
  regimes: ["Lucro Presumido", "Lucro Real"],
  descricao: "Recolhimento da CSLL apurada no trimestre. Mesmas regras de quotas do IRPJ. Alíquota 9% (15% para instituições financeiras).",
  regraVencimento: "Último dia útil do mês subsequente ao encerramento do trimestre (mesmo prazo do IRPJ).",
  embasamento: "Lei 9.430/1996, art. 28; Lei 7.689/1988; IN RFB 1.700/2017",
  fonteDados: ["MANUAL", "SCI"],
};
const OBR_13_1: Obrigacao = {
  id: "13_primeira", tributoIds: ["fgts", "inss_patronal"], dia: 30,
  mesesEspeciais: [11], apenasNosMesesEspeciais: true,
  nome: "13º Salário — 1ª parcela", tipo: "trabalhista",
  descricao: "Pagamento da 1ª parcela do 13º salário (50% sobre a remuneração de novembro).",
  embasamento: "Lei 4.090/1962; Lei 4.749/1965", fonteDados: ["FOLHA"],
};
const OBR_13_2: Obrigacao = {
  id: "13_segunda", tributoIds: ["fgts", "inss_patronal", "irrf_folha"], dia: 20,
  mesesEspeciais: [12], apenasNosMesesEspeciais: true,
  nome: "13º Salário — 2ª parcela", tipo: "trabalhista",
  descricao: "Pagamento da 2ª parcela do 13º com desconto de INSS e IRRF.",
  embasamento: "Lei 4.090/1962; Lei 4.749/1965", fonteDados: ["FOLHA"],
};

const ANUAIS: Obrigacao[] = [
  OBR_OPCAO_SN, OBR_INFORME_RENDIMENTOS, OBR_DASN_SIMEI, OBR_ECD,
  OBR_DIRPF_INI, OBR_DIRPF_FIM, OBR_DEFIS, OBR_ECF, OBR_DIMOB, OBR_DMED,
  OBR_IRPJ_TRIM, OBR_CSLL_TRIM,
  OBR_13_1, OBR_13_2,
];

/** Catálogo plano de todas as obrigações (recorrentes + anuais). */
export const OBRIGACOES: Obrigacao[] = [...RECORRENTES, ...ANUAIS];

/** Aplica override de dia por mês quando disponível. */
function aplicarDiaMes(o: Obrigacao, mes: number): Obrigacao {
  if (o.diasPorMes?.[mes] !== undefined) return { ...o, dia: o.diasPorMes[mes] };
  return o;
}

/** Retorna as obrigações que vencem em determinado mês (1..12). */
export function obrigacoesDoMes(mes: number): Obrigacao[] {
  const recorrentes = RECORRENTES;
  const especiais = ANUAIS.filter(
    (o) => o.mesesEspeciais?.includes(mes) ?? false,
  );
  return [...recorrentes, ...especiais].map((o) => aplicarDiaMes(o, mes));
}

/** Mapeia o código de regime do cadastro de clientes para o rótulo usado em Obrigacao.regimes. */
const REGIME_CODE_TO_LABEL: Record<string, RegimeAplicavel> = {
  SN: "Simples Nacional",
  LP: "Lucro Presumido",
  LR: "Lucro Real",
  MEI: "MEI",
};

export interface ClienteFiltro {
  municipio?: string | null;
  uf?: string | null;
  /** Código curto do regime (SN, LP, LR, MEI) ou rótulo completo. */
  taxRegime?: string | null;
}

/**
 * Filtra obrigações de um mês de acordo com o perfil do cliente:
 *  - Federais e trabalhistas sempre aparecem (com filtro de regime se aplicável).
 *  - Estaduais só aparecem se a UF do cliente bater (hoje todas são SP).
 *  - Municipais só aparecem se o ente bater com `${municipio}/${uf}` do cliente.
 *  - Se o cliente tiver regime definido, exclui obrigações cujo `regimes` não contenha esse regime.
 */
/** Normaliza string para comparação tolerante a acento, case e espaços. */
const normEnte = (s: string | null | undefined): string =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export function obrigacoesParaCliente(mes: number, cli: ClienteFiltro): Obrigacao[] {
  const todas = obrigacoesDoMes(mes);
  const regimeLabel = cli.taxRegime
    ? REGIME_CODE_TO_LABEL[cli.taxRegime] || (cli.taxRegime as RegimeAplicavel)
    : null;
  const enteClienteNorm = cli.municipio && cli.uf
    ? normEnte(`${cli.municipio}/${cli.uf}`)
    : null;
  const ufNorm = cli.uf ? cli.uf.trim().toUpperCase() : null;
  return todas.filter((o) => {
    // Filtro de regime — só aplica se a obrigação restringe regime e o cliente tem regime
    if (regimeLabel && o.regimes && o.regimes.length && !o.regimes.includes(regimeLabel)) {
      return false;
    }
    if (o.tipo === "federal" || o.tipo === "trabalhista") return true;
    if (o.tipo === "estadual") {
      // Sem UF cadastrada: ocultar estaduais (incluir indevidamente induz a entrega errada)
      if (!ufNorm) return false;
      // Estaduais hoje são todas SP — `ente` armazena a UF
      return !o.ente || o.ente.trim().toUpperCase() === ufNorm;
    }
    if (o.tipo === "municipal") {
      if (!enteClienteNorm) return false; // sem município, ocultar municipais
      return normEnte(o.ente) === enteClienteNorm;
    }
    return true;
  });
}

// ============================================================================
// 3. INTEGRAÇÕES — fonte dos dados de cada tributo
// ============================================================================

export const INTEGRACOES_FONTE: Record<FonteDadosId, IntegracaoFonte> = {
  SCI: {
    id: "SCI", nome: "SCI — Sistema Contábil Integrado",
    descricao: "Faturamento e protocolos importados do SCI alimentam ICMS, ISS, PIS/COFINS, retenções e RET.",
    tributos: ["icms", "iss", "pis", "cofins", "irrf_servicos_pj", "pcc_retencao", "ret_imobiliario", "das_simples"],
    paginas: ["/app/integracoes/sci/faturamento", "/app/integracoes/sci/protocolos"],
  },
  ACESSORIAS: {
    id: "ACESSORIAS", nome: "Acessórias — Gestão de Entregas",
    descricao: "Calendário e status das obrigações acessórias (DCTFWeb, EFD-Reinf, GIA, ISS).",
    tributos: ["inss_patronal", "irrf_folha", "icms", "iss"],
    paginas: ["/app/integracoes/acessorias/gestao-entregas"],
  },
  SPED_FISCAL: {
    id: "SPED_FISCAL", nome: "SPED Fiscal (EFD ICMS/IPI)",
    descricao: "Parser interno de SPED — alimenta ICMS, ICMS-ST, IPI e DIFAL.",
    tributos: ["icms", "icms_st", "icms_difal", "ipi"],
    paginas: ["/app/sped-leitor", "/app/sped-inventario"],
  },
  PGDAS_D: {
    id: "PGDAS_D", nome: "PGDAS-D",
    descricao: "Parser do PDF do PGDAS-D — extrai DAS, RBT12 e composição por anexo.",
    tributos: ["das_simples"],
    paginas: ["/app/sped-leitor"],
  },
  FOLHA: {
    id: "FOLHA", nome: "Folha de Pagamento (eSocial)",
    descricao: "Eventos S-1200/S-1210/S-1299 — alimentam FGTS, INSS, IRRF e CPRB.",
    tributos: ["fgts", "inss_patronal", "rat", "terceiros", "irrf_folha", "cprb_desoneracao"],
    paginas: ["/app/integracoes"],
  },
  MANUAL: {
    id: "MANUAL", nome: "Lançamento manual no Hub",
    descricao: "Lançado diretamente nas telas de Apuração, Endividamento ou Comparativo.",
    tributos: ["irpj", "csll", "irrf_dividendos", "ret_imobiliario", "pcc_retencao"],
    paginas: ["/app/apuracao-trimestral", "/app/envidamento", "/app/simulacoes"],
  },
  RECEITA: {
    id: "RECEITA", nome: "Portais Oficiais (RFB, SEFAZ, Prefeituras)",
    descricao: "Consulta direta nos portais para opções, parcelamentos e CNDs.",
    tributos: ["das_simples", "irpj", "csll"],
    paginas: ["/app/links-uteis"],
  },
};

// ============================================================================
// 4. HELPERS — usados por Calendario, Simulações e Integrações
// ============================================================================

export function tributoById(id: TributoId): Tributo | undefined {
  return TRIBUTOS[id];
}

export function obrigacoesPorTributo(id: TributoId): Obrigacao[] {
  return OBRIGACOES.filter((o) => o.tributoIds.includes(id));
}

export function fontesPorTributo(id: TributoId): IntegracaoFonte[] {
  return Object.values(INTEGRACOES_FONTE).filter((f) =>
    f.tributos.includes(id),
  );
}

/** Re-exportado para reaproveitar o tipo legado em Calendario.tsx sem refactor profundo. */
export type Tipo = Esfera;

export type CategoriaIcone = LucideIcon | undefined;
