// Tabela CST ICMS - Código de Situação Tributária

export interface CstRef {
  codigo: string;
  descricao: string;
  origem?: string;
}

export const tabelaCST: CstRef[] = [
  { codigo: "00", descricao: "Tributada integralmente" },
  { codigo: "02", descricao: "Tributação monofásica própria sobre combustíveis" },
  { codigo: "10", descricao: "Tributada e com cobrança do ICMS por substituição tributária" },
  { codigo: "15", descricao: "Tributação monofásica própria e com responsabilidade pela retenção sobre combustíveis" },
  { codigo: "20", descricao: "Com redução de base de cálculo" },
  { codigo: "30", descricao: "Isenta ou não tributada e com cobrança do ICMS por substituição tributária" },
  { codigo: "40", descricao: "Isenta" },
  { codigo: "41", descricao: "Não tributada" },
  { codigo: "50", descricao: "Suspensão" },
  { codigo: "51", descricao: "Diferimento" },
  { codigo: "53", descricao: "Tributação monofásica sobre combustíveis com recolhimento diferido" },
  { codigo: "60", descricao: "ICMS cobrado anteriormente por substituição tributária" },
  { codigo: "61", descricao: "Tributação monofásica sobre combustíveis cobrada anteriormente" },
  { codigo: "70", descricao: "Com redução de base de cálculo e cobrança do ICMS por substituição tributária" },
  { codigo: "90", descricao: "Outras" },
];

// Origem da mercadoria (primeiro dígito do CST completo)
export const tabelaOrigem: CstRef[] = [
  { codigo: "0", descricao: "Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8" },
  { codigo: "1", descricao: "Estrangeira - Importação direta, exceto a indicada no código 6" },
  { codigo: "2", descricao: "Estrangeira - Adquirida no mercado interno, exceto a indicada no código 7" },
  { codigo: "3", descricao: "Nacional, mercadoria ou bem com Conteúdo de Importação superior a 40% e inferior ou igual a 70%" },
  { codigo: "4", descricao: "Nacional, cuja produção tenha sido feita em conformidade com os processos produtivos básicos (PPB)" },
  { codigo: "5", descricao: "Nacional, mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%" },
  { codigo: "6", descricao: "Estrangeira - Importação direta, sem similar nacional, constante em lista de Resolução CAMEX e gás natural" },
  { codigo: "7", descricao: "Estrangeira - Adquirida no mercado interno, sem similar nacional, constante em lista de Resolução CAMEX e gás natural" },
  { codigo: "8", descricao: "Nacional, mercadoria ou bem com Conteúdo de Importação superior a 70%" },
];
