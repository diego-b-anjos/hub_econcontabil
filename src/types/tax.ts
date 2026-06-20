// ==================================================================================
// TIPOS TYPESCRIPT - ANALISADOR DA REFORMA TRIBUTÁRIA LC 214/2025
// ==================================================================================

export interface FaixaSimples {
  ate: number;
  aliquota: number;
  deducao: number;
}

export interface TabelaSimples {
  nome: string;
  faixas: FaixaSimples[];
}

export interface TabelasSimplesNacional {
  anexo1: TabelaSimples;
  anexo2: TabelaSimples;
  anexo3: TabelaSimples;
  anexo4: TabelaSimples;
  anexo5: TabelaSimples;
}

export interface DistribuicaoFaixa {
  ate: number;
  irpj: number;
  csll: number;
  cofins: number;
  pis: number;
  cpp: number;
  icms: number;
  iss?: number;
  ipi?: number;
}

export interface DistribuicaoTributos {
  faixas: DistribuicaoFaixa[];
}

export interface AtividadeLucroPresumido {
  id: string;
  nome: string;
  presuncaoIRPJ: number;
  presuncaoCSLL: number;
}

export interface ItemNCM {
  ncm: string;
  nome: string;
}

export interface ItemNBS {
  nbs: string;
  nome: string;
}

export interface AnexoLC214 {
  numero: number;
  nome: string;
  reducao_ibs: number;
  reducao_cbs: number;
  ncms?: ItemNCM[];
  nbs?: ItemNBS[];
}

export interface OperacaoImobiliaria {
  nome: string;
  descricao: string;
  reducao_ibs: number;
  reducao_cbs: number;
  classtrib: string;
  cst_ibs: string;
  cst_cbs: string;
  observacao: string;
  aliquota_fixa_ibs?: number;
  aliquota_fixa_cbs?: number;
}

export interface ImpostoSeletivo {
  ncm: string;
  nome: string;
  aliquota: number;
  categoria: string;
  observacao?: string;
}

export interface PeriodoTransicao {
  ibs: number;
  cbs: number;
  icms: number;
  iss: number;
  fase: string;
  descricao: string;
  reducaoICMS: number;
  reducaoISS: number;
}

export interface MapeamentoCST {
  cst: string;
  desc: string;
}

export interface RegimeTributario {
  id: string;
  nome: string;
  reducao_ibs: number;
  reducao_cbs: number;
  aliquota_fixa_ibs?: number;
  aliquota_fixa_cbs?: number;
}

export interface RegimeEmpresarial {
  id: string;
  nome: string;
  categoria: 'empresarial' | 'imobiliario' | 'simples';
}

// Resultado de análise
export interface ResultadoAnalise {
  codigo: string;
  validez: 'ok' | 'atencao' | 'invalido' | 'multiplas_opcoes';
  mensagem: string;
  regime: string;
  anexo: string;
  classtrib: string;
  cst_ibs: string;
  cst_cbs: string;
  ibsBase: string;
  cbsBase: string;
  reducao_ibs: string;
  reducao_cbs: string;
  ibsEfetiva: string | number;
  cbsEfetiva: string | number;
  impostoSeletivo: 'SIM' | 'NÃO';
  cst_is: string;
  classtrib_is: string;
  aliquota_is: string | number;
  anexo_is: string;
  temMultiplasOpcoes?: boolean;
  totalOpcoes?: number;
  opcaoSelecionada?: number;
  opcoes?: OpcaoNBS[];
  descricao?: string;
}

export interface OpcaoNBS {
  classtrib: string;
  descricao: string;
}

export interface NBSItem {
  nbs: string;
  descricao: string;
  opcoes: OpcaoNBS[];
}

export interface NBSDatabase {
  [key: string]: NBSItem;
}

// Estados do módulo de cálculo
export interface ReceitasPorAtividade {
  comercio: string;
  servicos: string;
  transporte: string;
  transporte_passageiros: string;
  servicos_hospitalares: string;
  profissionais: string;
  intermediacao: string;
  construcao: string;
  venda_ret: string;
  locacao: string;
  [key: string]: string;
}

export interface FaturamentosPorAnexo {
  anexo1: string;
  anexo2: string;
  anexo3: string;
  anexo4: string;
  anexo5: string;
  [key: string]: string;
}

export interface ImpostoPorAnexo {
  anexo: string;
  faturamento: number;
  aliquota: number;
  valor: number;
}

export interface DetalheOperacao {
  nome: string;
  tipo: string;
  receita: number;
  ibsValor: number;
  cbsValor: number;
  presuncaoIRPJ: number;
  presuncaoCSLL: number;
  baseIRPJ: number;
  baseCSLL: number;
  irpj: number;
  csll: number;
  descricao?: string;
}

export interface FolhaPagamento {
  valor: number;
  inssPatronal: number;
  sistemaS: number;
  total: number;
}

export interface SimplesNacionalResult {
  faturamento12Meses: number;
  impostosPorAnexo: ImpostoPorAnexo[];
  valorTotal: number;
  aliquotaMedia: number;
  tabelaUsada: string;
  fatorR?: string;
  folhaPagamento?: number;
}

export interface ResultadoCalculo {
  erro?: string;
  receita?: number;
  regime?: string;
  regimeEmpresarial?: string;
  ano?: number;
  ibsAliquota?: string;
  cbsAliquota?: string;
  ibsValor?: number;
  cbsValor?: number;
  icmsAliquota?: string;
  icmsAliquotaCheia?: string;
  icmsPercentual?: string;
  icmsValor?: number;
  issAliquota?: string;
  issAliquotaCheia?: string;
  issPercentual?: string;
  issValor?: number;
  pisAliquota?: string;
  pisValor?: number;
  cofinsAliquota?: string;
  cofinsValor?: number;
  ipiAliquota?: string;
  ipiValor?: number;
  irpjValor?: number;
  csllValor?: number;
  totalImpostos?: number;
  observacao?: string;
  observacaoExtincao?: string;
  simplesNacional?: SimplesNacionalResult;
  operacoes?: DetalheOperacao[];
  atividades?: DetalheOperacao[];
  folhaPagamento?: FolhaPagamento;
}

export interface ModalSelecaoNBS {
  aberto: boolean;
  nbs: string | null;
  descricao: string;
  opcoes: OpcaoNBS[];
  callback: ((opcao: number) => void) | null;
}

// Tipo do módulo ativo
export type ModuloAtivo = 'pesquisa' | 'calculo' | 'simples' | 'transicao' | 'regimes' | 'mapeamento' | 'seletivo' | 'folha' | 'imobiliario';
export type TipoCodigo = 'NCM' | 'NBS' | 'IMOVEL';
export type AnexoSimples = 'anexo1' | 'anexo2' | 'anexo3' | 'anexo4' | 'anexo5';
