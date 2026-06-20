export interface Empresa {
  id: string;
  sci: string;
  nomeEmpresarial: string;
  cnpj: string;
  ie: string;
  municipio: string;
  tipo: string;
  equipe: string;
}

export type Destinatario = 'Contribuintes' | 'Não Contribuintes' | 'Órgãos Públicos' | 'Templos e Cultos Religiosos' | '';

export interface BeneficioFiscal {
  id: string;
  cfopOuNcm: string;
  naturezaOperacao: string;
  cst: string;
  csosn: string;
  cBenef: string;
  tipo: 'CFOP' | 'NCM';
  destinatario: Destinatario;
}

export interface RelatorioItem {
  id: string;
  empresaId: string;
  beneficioId: string;
}
