// ==================================================================================
// CONSTANTES E TABELAS - REFORMA TRIBUTÁRIA LC 214/2025
// ==================================================================================

import type {
  TabelasSimplesNacional,
  DistribuicaoTributos,
  AtividadeLucroPresumido,
  AnexoLC214,
  OperacaoImobiliaria,
  ImpostoSeletivo,
  PeriodoTransicao,
  MapeamentoCST,
  RegimeTributario,
  RegimeEmpresarial,
} from '@/types/tax';

// ==================================================================================
// TABELAS DO SIMPLES NACIONAL - LEI 123/06 (ORIGINAL)
// ==================================================================================

export const TABELAS_SIMPLES_NACIONAL_ORIGINAL: TabelasSimplesNacional = {
  anexo1: {
    nome: "Anexo I - Comércio",
    faixas: [
      { ate: 180000, aliquota: 4.00, deducao: 0 },
      { ate: 360000, aliquota: 7.30, deducao: 5940 },
      { ate: 720000, aliquota: 9.50, deducao: 13860 },
      { ate: 1800000, aliquota: 10.70, deducao: 22500 },
      { ate: 3600000, aliquota: 14.30, deducao: 87300 },
      { ate: 4800000, aliquota: 19.00, deducao: 378000 },
    ]
  },
  anexo2: {
    nome: "Anexo II - Indústria",
    faixas: [
      { ate: 180000, aliquota: 4.50, deducao: 0 },
      { ate: 360000, aliquota: 7.80, deducao: 5940 },
      { ate: 720000, aliquota: 10.00, deducao: 13860 },
      { ate: 1800000, aliquota: 11.20, deducao: 22500 },
      { ate: 3600000, aliquota: 14.70, deducao: 85500 },
      { ate: 4800000, aliquota: 30.00, deducao: 720000 },
    ]
  },
  anexo3: {
    nome: "Anexo III - Serviços",
    faixas: [
      { ate: 180000, aliquota: 6.00, deducao: 0 },
      { ate: 360000, aliquota: 11.20, deducao: 9360 },
      { ate: 720000, aliquota: 13.50, deducao: 17640 },
      { ate: 1800000, aliquota: 16.00, deducao: 35640 },
      { ate: 3600000, aliquota: 21.00, deducao: 125640 },
      { ate: 4800000, aliquota: 33.00, deducao: 648000 },
    ]
  },
  anexo4: {
    nome: "Anexo IV - Serviços",
    faixas: [
      { ate: 180000, aliquota: 4.50, deducao: 0 },
      { ate: 360000, aliquota: 9.00, deducao: 8100 },
      { ate: 720000, aliquota: 10.20, deducao: 12420 },
      { ate: 1800000, aliquota: 14.00, deducao: 39780 },
      { ate: 3600000, aliquota: 22.00, deducao: 183780 },
      { ate: 4800000, aliquota: 33.00, deducao: 828000 },
    ]
  },
  anexo5: {
    nome: "Anexo V - Serviços c/ Fator R",
    faixas: [
      { ate: 180000, aliquota: 15.50, deducao: 0 },
      { ate: 360000, aliquota: 18.00, deducao: 4500 },
      { ate: 720000, aliquota: 19.50, deducao: 9900 },
      { ate: 1800000, aliquota: 20.50, deducao: 17100 },
      { ate: 3600000, aliquota: 23.00, deducao: 62100 },
      { ate: 4800000, aliquota: 30.50, deducao: 540000 },
    ]
  }
};

// ==================================================================================
// TABELAS DO SIMPLES NACIONAL PÓS-REFORMA - LC 214/2025
// IBS e CBS cobrados por fora (alíquotas reduzidas)
// ==================================================================================

export const TABELAS_SIMPLES_NACIONAL_REFORMA: TabelasSimplesNacional = {
  anexo1: {
    nome: "Anexo I - Comércio (sem IBS/CBS)",
    faixas: [
      { ate: 180000, aliquota: 3.00, deducao: 0 },
      { ate: 360000, aliquota: 5.50, deducao: 4500 },
      { ate: 720000, aliquota: 7.00, deducao: 9900 },
      { ate: 1800000, aliquota: 7.80, deducao: 15660 },
      { ate: 3600000, aliquota: 10.50, deducao: 64260 },
      { ate: 4800000, aliquota: 14.00, deducao: 280800 },
    ]
  },
  anexo2: {
    nome: "Anexo II - Indústria (sem IBS/CBS)",
    faixas: [
      { ate: 180000, aliquota: 3.30, deducao: 0 },
      { ate: 360000, aliquota: 5.70, deducao: 4320 },
      { ate: 720000, aliquota: 7.30, deducao: 10080 },
      { ate: 1800000, aliquota: 8.20, deducao: 16560 },
      { ate: 3600000, aliquota: 10.80, deducao: 63360 },
      { ate: 4800000, aliquota: 22.00, deducao: 532800 },
    ]
  },
  anexo3: {
    nome: "Anexo III - Serviços (sem IBS/CBS)",
    faixas: [
      { ate: 180000, aliquota: 4.50, deducao: 0 },
      { ate: 360000, aliquota: 8.40, deducao: 7020 },
      { ate: 720000, aliquota: 10.10, deducao: 13140 },
      { ate: 1800000, aliquota: 12.00, deducao: 26820 },
      { ate: 3600000, aliquota: 15.70, deducao: 93420 },
      { ate: 4800000, aliquota: 24.70, deducao: 486000 },
    ]
  },
  anexo4: {
    nome: "Anexo IV - Serviços (sem IBS/CBS)",
    faixas: [
      { ate: 180000, aliquota: 3.40, deducao: 0 },
      { ate: 360000, aliquota: 6.80, deducao: 6120 },
      { ate: 720000, aliquota: 7.70, deducao: 9360 },
      { ate: 1800000, aliquota: 10.50, deducao: 29520 },
      { ate: 3600000, aliquota: 16.50, deducao: 137520 },
      { ate: 4800000, aliquota: 24.70, deducao: 619200 },
    ]
  },
  anexo5: {
    nome: "Anexo V - Serviços c/ Fator R (sem IBS/CBS)",
    faixas: [
      { ate: 180000, aliquota: 11.60, deducao: 0 },
      { ate: 360000, aliquota: 13.50, deducao: 3420 },
      { ate: 720000, aliquota: 14.60, deducao: 7380 },
      { ate: 1800000, aliquota: 15.40, deducao: 13140 },
      { ate: 3600000, aliquota: 17.20, deducao: 45540 },
      { ate: 4800000, aliquota: 22.80, deducao: 414000 },
    ]
  }
};

// ==================================================================================
// DISTRIBUIÇÃO DE TRIBUTOS POR ANEXO - LEI 123/06
// ==================================================================================

export const DISTRIBUICAO_TRIBUTOS_LEI123: Record<string, DistribuicaoTributos> = {
  anexo1: {
    faixas: [
      { ate: 180000, irpj: 5.50, csll: 3.50, cofins: 12.74, pis: 2.76, cpp: 41.50, icms: 34.00 },
      { ate: 360000, irpj: 5.50, csll: 3.50, cofins: 12.74, pis: 2.76, cpp: 41.50, icms: 34.00 },
      { ate: 720000, irpj: 5.50, csll: 3.50, cofins: 12.74, pis: 2.76, cpp: 41.50, icms: 34.00 },
      { ate: 1800000, irpj: 5.50, csll: 3.50, cofins: 12.74, pis: 2.76, cpp: 41.50, icms: 34.00 },
      { ate: 3600000, irpj: 5.50, csll: 3.50, cofins: 12.74, pis: 2.76, cpp: 41.50, icms: 34.00 },
      { ate: 4800000, irpj: 13.50, csll: 10.00, cofins: 28.27, pis: 6.13, cpp: 42.10, icms: 0 }
    ]
  },
  anexo2: {
    faixas: [
      { ate: 180000, irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, icms: 32.00, ipi: 7.50 },
      { ate: 360000, irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, icms: 32.00, ipi: 7.50 },
      { ate: 720000, irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, icms: 32.00, ipi: 7.50 },
      { ate: 1800000, irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, icms: 32.00, ipi: 7.50 },
      { ate: 3600000, irpj: 5.50, csll: 3.50, cofins: 11.51, pis: 2.49, cpp: 37.50, icms: 32.00, ipi: 7.50 },
      { ate: 4800000, irpj: 8.50, csll: 7.50, cofins: 20.96, pis: 4.54, cpp: 23.50, icms: 0, ipi: 35.00 }
    ]
  },
  anexo3: {
    faixas: [
      { ate: 180000, irpj: 4.00, csll: 3.50, cofins: 12.82, pis: 2.78, cpp: 43.40, icms: 33.50, iss: 0 },
      { ate: 360000, irpj: 4.00, csll: 3.50, cofins: 14.05, pis: 3.05, cpp: 43.40, icms: 32.00, iss: 0 },
      { ate: 720000, irpj: 4.00, csll: 3.50, cofins: 13.64, pis: 2.96, cpp: 43.40, icms: 32.50, iss: 0 },
      { ate: 1800000, irpj: 4.00, csll: 3.50, cofins: 13.64, pis: 2.96, cpp: 43.40, icms: 32.50, iss: 0 },
      { ate: 3600000, irpj: 4.00, csll: 3.50, cofins: 12.82, pis: 2.78, cpp: 43.40, icms: 33.50, iss: 0 },
      { ate: 4800000, irpj: 35.00, csll: 15.00, cofins: 16.03, pis: 3.47, cpp: 30.50, icms: 0, iss: 0 }
    ]
  },
  anexo4: {
    faixas: [
      { ate: 180000, irpj: 18.80, csll: 15.20, cofins: 17.67, pis: 3.83, cpp: 0, icms: 0, iss: 44.50 },
      { ate: 360000, irpj: 19.80, csll: 15.20, cofins: 19.73, pis: 4.27, cpp: 0, icms: 0, iss: 40.00 },
      { ate: 720000, irpj: 20.80, csll: 15.20, cofins: 20.77, pis: 4.50, cpp: 0, icms: 0, iss: 38.73 },
      { ate: 1800000, irpj: 17.80, csll: 19.20, cofins: 19.73, pis: 4.27, cpp: 0, icms: 0, iss: 39.00 },
      { ate: 3600000, irpj: 18.80, csll: 19.20, cofins: 18.90, pis: 4.09, cpp: 0, icms: 0, iss: 39.01 },
      { ate: 4800000, irpj: 53.50, csll: 21.50, cofins: 20.96, pis: 4.54, cpp: 0, icms: 0, iss: 0 }
    ]
  },
  anexo5: {
    faixas: [
      { ate: 180000, irpj: 25.00, csll: 15.00, cofins: 14.10, pis: 3.05, cpp: 28.85, icms: 0, iss: 14.00 },
      { ate: 360000, irpj: 23.00, csll: 15.00, cofins: 14.10, pis: 3.05, cpp: 27.85, icms: 0, iss: 17.00 },
      { ate: 720000, irpj: 24.00, csll: 15.00, cofins: 14.92, pis: 3.23, cpp: 23.85, icms: 0, iss: 19.00 },
      { ate: 1800000, irpj: 21.00, csll: 15.00, cofins: 15.74, pis: 3.41, cpp: 23.85, icms: 0, iss: 21.00 },
      { ate: 3600000, irpj: 23.00, csll: 12.50, cofins: 14.10, pis: 3.05, cpp: 23.85, icms: 0, iss: 23.50 },
      { ate: 4800000, irpj: 35.00, csll: 15.50, cofins: 16.44, pis: 3.56, cpp: 29.50, icms: 0, iss: 0 }
    ]
  }
};

// Atividades do Lucro Presumido
export const ATIVIDADES_LUCRO_PRESUMIDO: AtividadeLucroPresumido[] = [
  { id: 'comercio', nome: 'Comércio e Indústria', presuncaoIRPJ: 8, presuncaoCSLL: 12 },
  { id: 'servicos', nome: 'Serviços em Geral', presuncaoIRPJ: 32, presuncaoCSLL: 32 },
  { id: 'transporte', nome: 'Transporte de Cargas', presuncaoIRPJ: 8, presuncaoCSLL: 12 },
  { id: 'transporte_passageiros', nome: 'Transporte de Passageiros', presuncaoIRPJ: 16, presuncaoCSLL: 12 },
  { id: 'servicos_hospitalares', nome: 'Serviços Hospitalares', presuncaoIRPJ: 8, presuncaoCSLL: 12 },
  { id: 'profissionais', nome: 'Serviços Profissionais', presuncaoIRPJ: 32, presuncaoCSLL: 32 },
  { id: 'intermediacao', nome: 'Intermediação de Negócios', presuncaoIRPJ: 32, presuncaoCSLL: 32 },
  { id: 'construcao', nome: 'Construção Civil', presuncaoIRPJ: 8, presuncaoCSLL: 12 },
];

// ==================================================================================
// BASES DE DADOS - LC 214/2025
// ==================================================================================

export const ANEXOS_LC214: Record<string, AnexoLC214> = {
  anexo1: {
    numero: 1,
    nome: "Cesta Básica Nacional",
    reducao_ibs: 100,
    reducao_cbs: 100,
    ncms: [
      { ncm: '1006.20', nome: 'Arroz descascado' },
      { ncm: '1006.30', nome: 'Arroz semibranqueado' },
      { ncm: '0401.10.10', nome: 'Leite <= 1% gordura' },
      { ncm: '0402.10.10', nome: 'Leite em pó' },
      { ncm: '1901.10.10', nome: 'Fórmulas infantis' },
      { ncm: '0405.10.00', nome: 'Manteiga' },
      { ncm: '0713.33.19', nome: 'Feijão preto' },
      { ncm: '09.01', nome: 'Café' },
      { ncm: '1106.20.00', nome: 'Farinha de mandioca' },
      { ncm: '1102.20.00', nome: 'Farinha de milho' },
      { ncm: '1101.00.10', nome: 'Farinha de trigo' },
      { ncm: '1701.14.00', nome: 'Açúcar de cana' },
      { ncm: '02.01', nome: 'Carnes bovinas' },
      { ncm: '02.02', nome: 'Carnes bovinas congeladas' },
      { ncm: '02.03', nome: 'Carnes suínas' },
      { ncm: '02.04', nome: 'Carnes ovinas/caprinas' },
      { ncm: '02.07', nome: 'Carnes de aves' },
      { ncm: '03.02', nome: 'Peixes frescos' },
      { ncm: '0406.10.10', nome: 'Queijo mozzarela' },
    ]
  },
  anexo2: {
    numero: 2,
    nome: "Serviços de Educação",
    reducao_ibs: 60,
    reducao_cbs: 60,
    nbs: [
      { nbs: '1.2201.11.00', nome: 'Serviços de creche' },
      { nbs: '1.2204.20.00', nome: 'Pós-graduação' },
      { nbs: '1.2205.13.00', nome: 'Educação em línguas' },
    ]
  },
  anexo3: {
    numero: 3,
    nome: "Serviços de Saúde",
    reducao_ibs: 60,
    reducao_cbs: 60,
    nbs: [
      { nbs: '1.2301.22.00', nome: 'Serviços médicos' },
      { nbs: '1.2603.00.00', nome: 'Serviços funerários' },
    ]
  },
  anexo12: {
    numero: 12,
    nome: "Dispositivos Médicos (Zero)",
    reducao_ibs: 100,
    reducao_cbs: 100,
    ncms: [
      { ncm: '9018.11.00', nome: 'Eletrocardiógrafos' },
      { ncm: '9018.12.10', nome: 'Aparelhos de ultrassom' },
      { ncm: '9018.13.10', nome: 'Ressonância magnética' },
    ]
  },
  anexo14: {
    numero: 14,
    nome: "Medicamentos (Zero)",
    reducao_ibs: 100,
    reducao_cbs: 100,
    ncms: [
      { ncm: '3003', nome: 'Medicamentos não misturados' },
      { ncm: '3004', nome: 'Medicamentos em doses' },
    ]
  },
  anexo15: {
    numero: 15,
    nome: "Hortícolas, Frutas e Ovos",
    reducao_ibs: 100,
    reducao_cbs: 100,
    ncms: [
      { ncm: '07.01', nome: 'Batatas' },
      { ncm: '07.02', nome: 'Tomates' },
      { ncm: '08.03', nome: 'Bananas' },
      { ncm: '08.05', nome: 'Frutas cítricas' },
      { ncm: '04.07', nome: 'Ovos de aves' },
    ]
  },
};

export const OPERACOES_IMOBILIARIAS: Record<string, OperacaoImobiliaria> = {
  locacao: {
    nome: "Locação de Imóveis",
    descricao: "Locação, cessão onerosa e arrendamento de bens imóveis",
    reducao_ibs: 60,
    reducao_cbs: 60,
    classtrib: "200027",
    cst_ibs: "00",
    cst_cbs: "00",
    observacao: "Redução de 60% conforme art. 127 LC 214/2025"
  },
  venda_normal: {
    nome: "Venda de Imóveis",
    descricao: "Venda de imóveis - Regime Normal",
    reducao_ibs: 0,
    reducao_cbs: 0,
    classtrib: "200046",
    cst_ibs: "00",
    cst_cbs: "00",
    observacao: "Tributação integral - Regime normal"
  },
  venda_ret: {
    nome: "Venda de Imóveis com RET",
    descricao: "Venda de imóveis - Regime Especial de Tributação (RET)",
    reducao_ibs: 0,
    reducao_cbs: 0,
    aliquota_fixa_ibs: 2.0,
    aliquota_fixa_cbs: 2.0,
    classtrib: "200046-RET",
    cst_ibs: "50",
    cst_cbs: "50",
    observacao: "RET - Alíquota fixa de 2% IBS + 2% CBS sobre valor da operação (Total: 4%)"
  }
};

// Imposto Seletivo — alíquotas LC 214/2025, Art. 74
export const IMPOSTO_SELETIVO: ImpostoSeletivo[] = [
  // ── Tabaco ──────────────────────────────────────────────────────
  { ncm: '2401', nome: 'Fumo não manufaturado; desperdícios de fumo', aliquota: 100, categoria: 'Tabaco', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2402', nome: 'Charutos, cigarrilhas e cigarros', aliquota: 100, categoria: 'Tabaco', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2403', nome: 'Outros produtos de fumo (tabaco para cachimbo, rapé, etc.)', aliquota: 100, categoria: 'Tabaco', observacao: 'LC 214/2025 Art. 74' },

  // ── Bebidas Alcoólicas ───────────────────────────────────────────
  { ncm: '2203', nome: 'Cerveja de malte', aliquota: 20, categoria: 'Bebidas Alcoólicas', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2204', nome: 'Vinhos de uvas frescas', aliquota: 20, categoria: 'Bebidas Alcoólicas', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2205', nome: 'Vermutes e outras bebidas de uvas', aliquota: 20, categoria: 'Bebidas Alcoólicas', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2206', nome: 'Outras bebidas fermentadas (sidra, hidromel, etc.)', aliquota: 20, categoria: 'Bebidas Alcoólicas', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2208', nome: 'Aguardentes, licores e outras bebidas espirituosas', aliquota: 20, categoria: 'Bebidas Alcoólicas', observacao: 'LC 214/2025 Art. 74' },

  // ── Bebidas Açucaradas ───────────────────────────────────────────
  { ncm: '2202', nome: 'Água, incluindo água mineral — adicionada de açúcar / adoçante / aromatizada; refrigerantes', aliquota: 20, categoria: 'Bebidas Açucaradas', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2009', nome: 'Sucos de frutas não fermentados com adição de açúcar', aliquota: 20, categoria: 'Bebidas Açucaradas', observacao: 'LC 214/2025 Art. 74' },

  // ── Veículos Automotores ─────────────────────────────────────────
  { ncm: '8703.21', nome: 'Automóveis (motor flex/gasolina ≤ 1.000 cm³)', aliquota: 7, categoria: 'Veículos', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '8703.22', nome: 'Automóveis (motor flex/gasolina 1.001–1.500 cm³)', aliquota: 11, categoria: 'Veículos', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '8703.23', nome: 'Automóveis (motor flex/gasolina 1.501–3.000 cm³)', aliquota: 18, categoria: 'Veículos', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '8703.24', nome: 'Automóveis (motor flex/gasolina > 3.000 cm³)', aliquota: 25, categoria: 'Veículos', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '8703.40', nome: 'Automóveis elétricos e híbridos plug-in', aliquota: 3.5, categoria: 'Veículos', observacao: 'LC 214/2025 Art. 74 — alíquota reduzida' },
  { ncm: '8711', nome: 'Motocicletas (cilindrada > 125 cm³, não elétricas)', aliquota: 8, categoria: 'Veículos', observacao: 'LC 214/2025 Art. 74' },

  // ── Embarcações e Aeronaves ──────────────────────────────────────
  { ncm: '8903', nome: 'Embarcações de recreio e esporte', aliquota: 15, categoria: 'Embarcações e Aeronaves', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '8802', nome: 'Aeronaves (aviões, helicópteros particulares)', aliquota: 15, categoria: 'Embarcações e Aeronaves', observacao: 'LC 214/2025 Art. 74' },

  // ── Armas e Munições ─────────────────────────────────────────────
  { ncm: '9301', nome: 'Armas de guerra (excl. revólveres, pistolas e armas brancas)', aliquota: 100, categoria: 'Armas e Munições', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '9302', nome: 'Revólveres e pistolas', aliquota: 100, categoria: 'Armas e Munições', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '9303', nome: 'Outras armas de fogo', aliquota: 100, categoria: 'Armas e Munições', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '9306', nome: 'Bombas, granadas, cartuchos e munições', aliquota: 100, categoria: 'Armas e Munições', observacao: 'LC 214/2025 Art. 74' },

  // ── Mineração ────────────────────────────────────────────────────
  { ncm: '2601', nome: 'Minérios de ferro e seus concentrados', aliquota: 0.5, categoria: 'Mineração', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2616', nome: 'Minérios de metais preciosos (ouro, prata)', aliquota: 0.5, categoria: 'Mineração', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2701', nome: 'Hulha e carvão mineral', aliquota: 1, categoria: 'Mineração', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2709', nome: 'Óleos brutos de petróleo', aliquota: 1, categoria: 'Mineração', observacao: 'LC 214/2025 Art. 74' },
  { ncm: '2711', nome: 'Gás natural e outros hidrocarbonetos gasosos', aliquota: 1, categoria: 'Mineração', observacao: 'LC 214/2025 Art. 74' },
];

// Cronograma de transição — EC 132/2023 + LC 214/2025 + Decreto 12955/2026 (CBS)
export const PERIODO_TRANSICAO: Record<number, PeriodoTransicao> = {
  2026: {
    ibs: 0.10,
    cbs: 0.90,
    icms: 100,
    iss: 100,
    fase: 'Teste',
    descricao: 'Fase de teste — IBS/CBS compensados com PIS/COFINS (Decreto 12955/2026)',
    reducaoICMS: 0,
    reducaoISS: 0,
  },
  2027: {
    ibs: 1.00,
    cbs: 8.80,
    icms: 100,
    iss: 100,
    fase: 'CBS Plena',
    descricao: 'CBS em vigor — PIS e COFINS extintos (alíquota de referência 8,8%)',
    reducaoICMS: 0,
    reducaoISS: 0,
  },
  2028: {
    ibs: 3.50,
    cbs: 8.80,
    icms: 100,
    iss: 100,
    fase: 'Transição IBS',
    descricao: 'Início da cobrança progressiva do IBS',
    reducaoICMS: 0,
    reducaoISS: 0,
  },
  2029: {
    ibs: 6.40,
    cbs: 8.80,
    icms: 90,
    iss: 90,
    fase: 'Transição',
    descricao: 'Redução de 10% no ICMS e ISS',
    reducaoICMS: 10,
    reducaoISS: 10,
  },
  2030: {
    ibs: 9.30,
    cbs: 8.80,
    icms: 80,
    iss: 80,
    fase: 'Transição',
    descricao: 'Redução de 20% no ICMS e ISS',
    reducaoICMS: 20,
    reducaoISS: 20,
  },
  2031: {
    ibs: 12.20,
    cbs: 8.80,
    icms: 70,
    iss: 70,
    fase: 'Transição',
    descricao: 'Redução de 30% no ICMS e ISS',
    reducaoICMS: 30,
    reducaoISS: 30,
  },
  2032: {
    ibs: 15.10,
    cbs: 8.80,
    icms: 60,
    iss: 60,
    fase: 'Transição',
    descricao: 'Redução de 40% no ICMS e ISS',
    reducaoICMS: 40,
    reducaoISS: 40,
  },
  2033: {
    ibs: 17.70,
    cbs: 8.80,
    icms: 0,
    iss: 0,
    fase: 'Plena',
    descricao: 'IVA Dual pleno — ICMS e ISS extintos (IBS 17,7% + CBS 8,8% = 26,5%)',
    reducaoICMS: 100,
    reducaoISS: 100,
  },
};

// ==================================================================================
// MAPEAMENTO CST <-> CLASSTRIB (LC 214/2025)
// ==================================================================================

export const MAPEAMENTO_CST_CLASSTRIB: Record<string, MapeamentoCST> = {
  '000001': { cst: '000', desc: 'Situações tributadas integralmente pelo IBS e CBS' },
  '000002': { cst: '000', desc: 'Tributação integral - Exploração de via' },
  '000003': { cst: '000', desc: 'Tributação integral - Regime automotivo' },
  '000004': { cst: '000', desc: 'Tributação integral - Regime automotivo' },
  '010001': { cst: '010', desc: 'Tributação com alíquotas uniformes - FGTS' },
  '010002': { cst: '010', desc: 'Tributação com alíquotas uniformes - Serviços financeiros' },
  '200001': { cst: '200', desc: 'Alíquota reduzida - Máquinas e equipamentos' },
  '200002': { cst: '200', desc: 'Alíquota reduzida - Tratores e implementos agrícolas' },
  '200003': { cst: '200', desc: 'Alíquota reduzida - Produtos alimentação humana Anexo I' },
  '200004': { cst: '200', desc: 'Alíquota reduzida - Dispositivos médicos Anexo XII' },
  '200005': { cst: '200', desc: 'Alíquota reduzida - Dispositivos médicos Anexo IV' },
  '200016': { cst: '200', desc: 'Alíquota reduzida - Pesquisa e desenvolvimento' },
  '200027': { cst: '200', desc: 'Alíquota reduzida - Locação bens imóveis' },
  '200028': { cst: '200', desc: 'Alíquota reduzida - Serviços de educação Anexo II' },
  '200029': { cst: '200', desc: 'Alíquota reduzida - Serviços de saúde Anexo III' },
  '200039': { cst: '200', desc: 'Alíquota reduzida - Serviços e licenciamento Anexo X' },
  '200043': { cst: '200', desc: 'Alíquota reduzida - Serviços admin pública Anexo XI' },
  '200044': { cst: '200', desc: 'Alíquota reduzida - Segurança informação Anexo XI' },
  '200045': { cst: '200', desc: 'Alíquota reduzida - Reabilitação urbana' },
  '200046': { cst: '200', desc: 'Alíquota reduzida - Operações imóveis' },
  '200052': { cst: '200', desc: 'Alíquota reduzida - Profissões intelectuais' },
  '410001': { cst: '410', desc: 'Imunidade - Bonificações' },
  '410004': { cst: '410', desc: 'Imunidade - Exportações' },
  '410008': { cst: '410', desc: 'Imunidade - Livros, jornais, periódicos' },
};

// Mapeamento de Anexos LC 214/2025 para ClassTribs
export const ANEXO_PARA_CLASSTRIB: Record<number, { 100?: string | null; 60?: string | null; desc: string }> = {
  1: { 100: '200003', 60: null, desc: 'Alimentos Anexo I' },
  2: { 100: null, 60: '200028', desc: 'Educação Anexo II' },
  3: { 100: null, 60: '200029', desc: 'Saúde Anexo III' },
  4: { 100: '200005', 60: '200030', desc: 'Dispositivos médicos Anexo IV' },
  5: { 100: '200008', 60: '200031', desc: 'Acessibilidade Anexo V' },
  6: { 100: '200011', 60: '200033', desc: 'Nutrição Anexo VI' },
  7: { 100: null, 60: '200034', desc: 'Alimentos Anexo VII' },
  8: { 100: null, 60: '200035', desc: 'Higiene Anexo VIII' },
  9: { 100: null, 60: '200038', desc: 'Insumos agro Anexo IX' },
  10: { 100: null, 60: '200039', desc: 'Serviços Anexo X' },
  11: { 100: null, 60: '200043', desc: 'Admin pública Anexo XI' },
  12: { 100: '200004', 60: null, desc: 'Dispositivos médicos Anexo XII' },
  13: { 100: '200007', 60: null, desc: 'Acessibilidade Anexo XIII' },
  14: { 100: '200009', 60: null, desc: 'Medicamentos Anexo XIV' },
  15: { 100: '200014', 60: null, desc: 'Hortícolas Anexo XV' }
};

// Lista de regimes para o módulo de cálculo
export const REGIMES_TRIBUTARIOS: RegimeTributario[] = [
  { id: 'padrao', nome: 'Regime Padrão', reducao_ibs: 0, reducao_cbs: 0 },
  { id: 'cesta_basica', nome: 'Cesta Básica Nacional (100% redução)', reducao_ibs: 100, reducao_cbs: 100 },
  { id: 'educacao', nome: 'Serviços de Educação (60% redução)', reducao_ibs: 60, reducao_cbs: 60 },
  { id: 'saude', nome: 'Serviços de Saúde (60% redução)', reducao_ibs: 60, reducao_cbs: 60 },
  { id: 'medicamentos', nome: 'Medicamentos (100% redução)', reducao_ibs: 100, reducao_cbs: 100 },
  { id: 'locacao', nome: 'Locação de Imóveis (60% redução)', reducao_ibs: 60, reducao_cbs: 60 },
  { id: 'ret', nome: 'Venda Imóveis RET (Alíquota fixa 4%)', reducao_ibs: 0, reducao_cbs: 0, aliquota_fixa_ibs: 2.0, aliquota_fixa_cbs: 2.0 },
];

// Regimes empresariais
export const REGIMES_EMPRESARIAIS: RegimeEmpresarial[] = [
  { id: 'lucro_presumido', nome: 'Lucro Presumido (Comércio/Indústria/Serviços)', categoria: 'empresarial' },
  { id: 'operacoes_imobiliarias', nome: 'Operações Imobiliárias', categoria: 'imobiliario' },
  { id: 'simples_nacional', nome: 'Simples Nacional (IBS/CBS inclusos)', categoria: 'simples' },
  { id: 'simples_por_fora', nome: 'Simples Nacional (IBS/CBS por fora)', categoria: 'simples' },
];
