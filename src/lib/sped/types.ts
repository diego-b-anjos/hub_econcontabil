export interface InventoryItem {
  codigo: string;
  descricao: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  contaContabil: string;
}

export interface ClientData {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  uf: string;
  codigoMunicipio: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  telefone: string;
  email: string;
  codFinalidade: string;
  perfil: string;
  contabilistaNome: string;
  contabilistaCpf: string;
  contabilistaCrc: string;
  contabilistaCnpj: string;
}

export interface InventoryMeta {
  dataInventario: string;
  motivoInventario: string;
  dataInicial: string;
  dataFinal: string;
  versaoSped: string;
  contaContabilPadrao: string;
}

export interface ValidationWarning {
  linha: number;
  campo: string;
  mensagem: string;
}

export const VERSOES_SPED = [
  { value: "001", label: "001 (2008)" },
  { value: "002", label: "002 (2009)" },
  { value: "003", label: "003 (2010)" },
  { value: "004", label: "004 (2010)" },
  { value: "005", label: "005 (2011)" },
  { value: "006", label: "006 (2012)" },
  { value: "007", label: "007 (2013)" },
  { value: "008", label: "008 (2013)" },
  { value: "009", label: "009 (2014)" },
  { value: "010", label: "010 (2015)" },
  { value: "011", label: "011 (2016)" },
  { value: "012", label: "012 (2017)" },
  { value: "013", label: "013 (2018)" },
  { value: "014", label: "014 (2019)" },
  { value: "015", label: "015 (2020)" },
  { value: "016", label: "016 (2021)" },
  { value: "017", label: "017 (2022)" },
  { value: "018", label: "018 (2023)" },
  { value: "019", label: "019 (2024/2025)" },
  { value: "020", label: "020 (2026)" },
];

export const MOTIVOS_INVENTARIO = [
  { value: "01", label: "01 - No final no período" },
  { value: "02", label: "02 - Na mudança de forma de tributação da mercadoria (ICMS)" },
  { value: "03", label: "03 - Na solicitação da baixa cadastral, paralisação temporária e outras situações" },
  { value: "04", label: "04 - Na alteração de regime de pagamento – condição do contribuinte" },
  { value: "05", label: "05 - Por determinação dos fiscos" },
];

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

export const PERFIS = [
  { value: "A", label: "A - Perfil A" },
  { value: "B", label: "B - Perfil B" },
  { value: "C", label: "C - Perfil C" },
];
