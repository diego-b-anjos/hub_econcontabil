export type Orgao = "RFB" | "PGFN" | "Estadual" | "Municipal";

/**
 * Status do débito quanto à exigibilidade / parcelamento.
 * - "devedor": débito em aberto, soma no Total Devido.
 * - "em-dia": parcelamento em dia → soma no Total Regularizado (não soma no Devido).
 * - "em-atraso": parcelamento com parcelas em atraso → soma no Total Devido / Parc. em Atraso.
 * - "rescisao": parcelamento em fase de rescisão → soma no Total Devido.
 * - "divida-ativa": débito inscrito em Dívida Ativa → soma no Total Devido.
 */
export type StatusParc = "devedor" | "em-dia" | "em-atraso" | "rescisao" | "divida-ativa";

export interface Debito {
  id: string;
  orgao: Orgao;
  receita: string;          // ex: "2985-06 - CONTRIB-PREV" ou "ICMS"
  competencia: string;      // ex: "12/2025"
  vencimento?: string;      // dd/mm/aaaa
  valorOriginal: number;
  saldoDevedor: number;
  multa: number;
  juros: number;
  total: number;            // Sdo. Dev. Cons.
  parcelado: boolean;
  parcelamento?: string;    // identificador
  situacao?: string;        // DEVEDOR / EM PARCELAMENTO / etc
  observacao?: string;
  statusParc?: StatusParc;  // classificação semântica para totais
  /** Marca débitos do tipo "pendência de declaração" (ex.: SEFAZ EFD/GIA — Saldo Credor Incorreto, RFB pendência de declaração).
   *  Permite ocultá-los seletivamente nas exportações sem afetar a soma dos verdadeiros débitos. */
  pendenciaDeclaracao?: boolean;
  /** Quando `true`, o valor informado em `total` (e `valorOriginal`) já vem
   *  atualizado pelo órgão com multa e juros embutidos — comum em CDAs da
   *  Dívida Ativa (PGE, PGFN) cujo extrato não discrimina principal/multa/juros.
   *  Os campos `multa` e `juros` ficam zerados, mas a UI/exports devem deixar
   *  claro que o `total` já contempla essas rubricas. */
  valorJaAtualizado?: boolean;
}

export interface Parcelamento {
  id: string;
  orgao: Orgao;
  identificador: string;   // número do parcelamento ou nome
  modalidade?: string;
  valorEmAtraso?: number;
  parcelasEmAtraso?: number;
  situacao?: string;
}

export interface DadosCadastrais {
  cnpj?: string;
  inscricaoMunicipal?: string;
  inscricaoEstadual?: string;
  razaoSocial?: string;
  endereco?: string;
  municipio?: string;
  uf?: string;
  responsavel?: string;
  abertura?: string;
}

export interface CertidaoNegativa {
  id: string;
  orgao: Orgao;
  emissor: string;          // ex: "PGE-SP", "SEFAZ-SP"
  numero?: string;
  dataEmissao?: string;
  validade?: string;
  arquivo: string;
}

export interface RelatorioFiscal {
  cadastro: DadosCadastrais;
  dataAtualizacao: string; // dd/mm/aaaa hh:mm
  debitos: Debito[];
  parcelamentos: Parcelamento[];
  certidoesNegativas?: CertidaoNegativa[];
  /** Número de versão sequencial do relatório de endividamento (ex: 1, 2, 3...). */
  versao?: number;
  /** Data de atualização específica por órgão (vinda do relatório do ente). */
  datasPorOrgao?: Partial<Record<Orgao, string>>;
  /** Quando true, débitos marcados como "pendência de declaração" são omitidos das exportações. */
  ocultarPendenciasDeclaracao?: boolean;
}

export interface DiagnosticoImport {
  arquivo: string;
  paginas: number;
  paginasComTabela: number[];
  debitosEncontrados: number;
  parcelamentosEncontrados: number;
  camposNaoEncontrados: string[];      // ex: "Razão Social", "CNPJ"
  avisos: string[];                     // mensagens livres
  linhasNaoReconhecidas: string[];      // amostras
  tipoDetectado:
    | "situacao-fiscal"
    | "darf"
    | "parcelamento-rfb"
    | "municipal-osasco"
    | "cnd-negativa"
    | "pgfn-regularize"
    | "pgfn-csv"
    | "sefaz-sp"
    | "pge-sp"
    | "generico"
    | "desconhecido";
  modo?: "auto" | "coluna";
}
