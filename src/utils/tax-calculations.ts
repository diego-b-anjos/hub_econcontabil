// ==================================================================================
// FUNÇÕES UTILITÁRIAS - CÁLCULOS TRIBUTÁRIOS
// ==================================================================================

import type { 
  AnexoSimples, 
  DistribuicaoFaixa, 
  ResultadoAnalise,
  PeriodoTransicao,
  NBSDatabase,
  OpcaoNBS,
} from '@/types/tax';

import {
  TABELAS_SIMPLES_NACIONAL_ORIGINAL,
  TABELAS_SIMPLES_NACIONAL_REFORMA,
  DISTRIBUICAO_TRIBUTOS_LEI123,
  ANEXOS_LC214,
  IMPOSTO_SELETIVO,
  PERIODO_TRANSICAO,
  MAPEAMENTO_CST_CLASSTRIB,
  ANEXO_PARA_CLASSTRIB,
  OPERACOES_IMOBILIARIAS,
} from '@/constants/tax-tables';

import { obterCSTdeClassificacao } from '@/utils/nbs-database-loader';

// ==================================================================================
// FUNÇÕES DE FORMATAÇÃO
// ==================================================================================

export function formatarMoeda(valor: string): string {
  if (!valor) return '';
  const numero = valor.replace(/\D/g, '');
  const valorDecimal = (Number(numero) / 100).toFixed(2);
  return Number(valorDecimal).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function extrairValor(valorFormatado: string): number {
  if (!valorFormatado) return 0;
  return Number(valorFormatado.replace(/\./g, '').replace(',', '.'));
}

export function formatarValorBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ==================================================================================
// FUNÇÕES DE CÁLCULO - SIMPLES NACIONAL
// ==================================================================================

export function calcularAliquotaSimples(
  faturamento12Meses: number, 
  anexo: AnexoSimples, 
  usarReforma: boolean = false
): number {
  const tabelaBase = usarReforma ? TABELAS_SIMPLES_NACIONAL_REFORMA : TABELAS_SIMPLES_NACIONAL_ORIGINAL;
  const tabela = tabelaBase[anexo];
  if (!tabela) return 0;

  for (const faixa of tabela.faixas) {
    if (faturamento12Meses <= faixa.ate) {
      // Alíquota efetiva = ((RBT12 × Aliq) - PD) / RBT12
      const aliquotaEfetiva = ((faturamento12Meses * faixa.aliquota / 100) - faixa.deducao) / faturamento12Meses * 100;
      return Math.max(aliquotaEfetiva, 0);
    }
  }
  
  // Se ultrapassar limite
  const ultimaFaixa = tabela.faixas[tabela.faixas.length - 1];
  return ultimaFaixa.aliquota;
}

export function obterDistribuicaoFaixa(anexo: string, faturamento12Meses: number): DistribuicaoFaixa | null {
  const distribuicao = DISTRIBUICAO_TRIBUTOS_LEI123[anexo];
  if (!distribuicao) return null;

  for (const faixa of distribuicao.faixas) {
    if (faturamento12Meses <= faixa.ate) {
      return faixa;
    }
  }
  
  return distribuicao.faixas[distribuicao.faixas.length - 1];
}

// TRANSPORTADORA: Anexo III - ISS + ICMS do Anexo I
export function calcularAliquotaTransportadora(faturamento12Meses: number, usarReforma: boolean): number {
  const aliquotaBase = calcularAliquotaSimples(faturamento12Meses, 'anexo3', usarReforma);
  
  const distAnexo3 = obterDistribuicaoFaixa('anexo3', faturamento12Meses);
  if (!distAnexo3) return aliquotaBase;
  
  const distAnexo1 = obterDistribuicaoFaixa('anexo1', faturamento12Meses);
  if (!distAnexo1) return aliquotaBase;
  
  const percentualRemover = distAnexo3.iss || 0;
  const percentualAdicionar = distAnexo1.icms || 0;
  
  const aliquotaAjustada = aliquotaBase * (1 - percentualRemover/100) * (1 + percentualAdicionar/100);
  
  return Math.max(aliquotaAjustada, 0);
}

// LOCAÇÃO DE EQUIPAMENTOS: Anexo III - ISS
export function calcularAliquotaLocacao(faturamento12Meses: number, usarReforma: boolean): number {
  const aliquotaBase = calcularAliquotaSimples(faturamento12Meses, 'anexo3', usarReforma);
  
  const distribuicao = obterDistribuicaoFaixa('anexo3', faturamento12Meses);
  if (!distribuicao) return aliquotaBase;
  
  const percentualISS = distribuicao.iss || 0;
  const aliquotaAjustada = aliquotaBase * (1 - percentualISS/100);
  
  return Math.max(aliquotaAjustada, 0);
}

// EXPORTAÇÃO DE SERVIÇOS: Anexo escolhido - ISS - PIS - COFINS
export function calcularAliquotaExportacaoServicos(
  faturamento12Meses: number, 
  anexo: AnexoSimples, 
  usarReforma: boolean
): number {
  const aliquotaBase = calcularAliquotaSimples(faturamento12Meses, anexo, true);
  
  const distribuicao = obterDistribuicaoFaixa(anexo, faturamento12Meses);
  if (!distribuicao) return aliquotaBase;
  
  const percentualISS = distribuicao.iss || 0;
  const percentualPIS = distribuicao.pis || 0;
  const percentualCOFINS = distribuicao.cofins || 0;
  const percentualTotal = percentualISS + percentualPIS + percentualCOFINS;
  
  const aliquotaAjustada = aliquotaBase * (1 - percentualTotal/100);
  
  return Math.max(aliquotaAjustada, 0);
}

// EXPORTAÇÃO DE MERCADORIAS: Anexo escolhido - ICMS - PIS - COFINS (- IPI se Anexo II)
export function calcularAliquotaExportacaoMercadorias(
  faturamento12Meses: number, 
  anexo: AnexoSimples, 
  usarReforma: boolean
): number {
  const aliquotaBase = calcularAliquotaSimples(faturamento12Meses, anexo, true);
  
  const distribuicao = obterDistribuicaoFaixa(anexo, faturamento12Meses);
  if (!distribuicao) return aliquotaBase;
  
  const percentualICMS = distribuicao.icms || 0;
  const percentualPIS = distribuicao.pis || 0;
  const percentualCOFINS = distribuicao.cofins || 0;
  const percentualIPI = (anexo === 'anexo2' && distribuicao.ipi) ? distribuicao.ipi : 0;
  const percentualTotal = percentualICMS + percentualPIS + percentualCOFINS + percentualIPI;
  
  const aliquotaAjustada = aliquotaBase * (1 - percentualTotal/100);
  
  return Math.max(aliquotaAjustada, 0);
}

// ==================================================================================
// FUNÇÕES DE MAPEAMENTO CST/CLASSTRIB
// ==================================================================================

export function obterCSTporClassTrib(classtrib: string): { cst_ibs: string; cst_cbs: string; descricao: string } {
  const classtribStr = String(classtrib).padStart(6, '0');
  
  // Primeiro, tentar buscar na base de classificação tributária (JSON)
  const detalhesClass = obterCSTdeClassificacao(classtribStr);
  
  if (detalhesClass && detalhesClass.cst) {
    return {
      cst_ibs: detalhesClass.cst,
      cst_cbs: detalhesClass.cst,
      descricao: detalhesClass.descricao
    };
  }
  
  // Fallback para mapeamento estático
  const mapeamento = MAPEAMENTO_CST_CLASSTRIB[classtribStr];
  
  if (mapeamento) {
    return {
      cst_ibs: mapeamento.cst,
      cst_cbs: mapeamento.cst,
      descricao: mapeamento.desc
    };
  }
  
  return {
    cst_ibs: '000',
    cst_cbs: '000',
    descricao: 'Tributação integral'
  };
}

export function obterClassTribPorAnexo(numeroAnexo: number, percentualReducao: number): string {
  const anexo = ANEXO_PARA_CLASSTRIB[numeroAnexo];
  if (!anexo) {
    if (percentualReducao === 100) return '200001';
    if (percentualReducao === 60) return '200001';
    return '000001';
  }
  
  if (percentualReducao === 100 && anexo[100]) return anexo[100];
  if (percentualReducao === 60 && anexo[60]) return anexo[60];
  
  return anexo[100] || anexo[60] || '200001';
}

export function determinarAnexo(classtrib: string): string {
  if (classtrib === '200028') return 'ANEXO II';
  if (classtrib === '200029') return 'ANEXO III';
  if (classtrib === '200039') return 'ANEXO X';
  if (classtrib === '200043' || classtrib === '200044') return 'ANEXO XI';
  if (classtrib === '200016') return 'P&D ICT';
  if (classtrib.startsWith('200045')) return 'Reabilitação Urbana';
  if (classtrib.startsWith('200046')) return 'Operações Imóveis';
  if (classtrib.startsWith('200052')) return 'Profissões Intelectuais';
  return '-';
}

// ==================================================================================
// FUNÇÕES DE ANÁLISE NCM/NBS
// ==================================================================================

function compararNCM(ncmProduto: string, ncmBase: string): boolean {
  const produtoLimpo = String(ncmProduto).replace(/[^0-9.]/g, '');
  const baseLimpo = String(ncmBase).replace(/[^0-9.]/g, '');
  
  if (produtoLimpo === baseLimpo) return true;
  
  const baseSemPonto = baseLimpo.replace(/\./g, '');
  const produtoSemPonto = produtoLimpo.replace(/\./g, '');
  if (produtoSemPonto.startsWith(baseSemPonto)) return true;
  
  return false;
}

export function buscarPorDescricao(termo: string, tipo: 'NCM' | 'NBS'): Array<{
  codigo: string;
  nome: string;
  anexo: number;
  regime: string;
}> {
  const termoLimpo = termo.toLowerCase().trim();
  const resultados: Array<{ codigo: string; nome: string; anexo: number; regime: string }> = [];

  if (tipo === 'NCM') {
    for (const [key, anexo] of Object.entries(ANEXOS_LC214)) {
      if (!anexo.ncms) continue;
      
      for (const item of anexo.ncms) {
        if (item.nome.toLowerCase().includes(termoLimpo)) {
          resultados.push({
            codigo: item.ncm,
            nome: item.nome,
            anexo: anexo.numero,
            regime: anexo.nome
          });
        }
      }
    }
  } else if (tipo === 'NBS') {
    for (const [key, anexo] of Object.entries(ANEXOS_LC214)) {
      if (!anexo.nbs) continue;
      
      for (const item of anexo.nbs) {
        if (item.nome.toLowerCase().includes(termoLimpo)) {
          resultados.push({
            codigo: item.nbs,
            nome: item.nome,
            anexo: anexo.numero,
            regime: anexo.nome
          });
        }
      }
    }
  }

  return resultados;
}

export function analisarNCM(ncm: string, ano: number = 2033): ResultadoAnalise {
  if (!ncm) {
    return {
      codigo: ncm,
      validez: 'invalido',
      mensagem: 'NCM não informado',
      regime: '-',
      anexo: '-',
      classtrib: '-',
      cst_ibs: '-',
      cst_cbs: '-',
      ibsBase: '-',
      cbsBase: '-',
      reducao_ibs: '-',
      reducao_cbs: '-',
      ibsEfetiva: 0,
      cbsEfetiva: 0,
      impostoSeletivo: 'NÃO',
      cst_is: '-',
      classtrib_is: '-',
      aliquota_is: '-',
      anexo_is: '-'
    };
  }

  const aliquotasAno = PERIODO_TRANSICAO[ano] || PERIODO_TRANSICAO[2033];

  for (const [key, anexo] of Object.entries(ANEXOS_LC214)) {
    if (!anexo.ncms) continue;
    
    for (const item of anexo.ncms) {
      if (compararNCM(ncm, item.ncm)) {
        const fatorReducao = (100 - anexo.reducao_ibs) / 100;
        const ibsEfetiva = aliquotasAno.ibs * fatorReducao;
        const cbsEfetiva = aliquotasAno.cbs * fatorReducao;
        
        const classtribCalculado = obterClassTribPorAnexo(anexo.numero, anexo.reducao_ibs);
        const cstInfo = obterCSTporClassTrib(classtribCalculado);
        
        return {
          codigo: ncm,
          validez: 'ok',
          mensagem: `${anexo.nome}: ${item.nome}`,
          regime: anexo.reducao_ibs === 100 ? 'Alíquota Zero (100% Redução)' : `Redução de ${anexo.reducao_ibs}%`,
          anexo: `ANEXO ${anexo.numero}`,
          classtrib: classtribCalculado,
          cst_ibs: cstInfo.cst_ibs,
          cst_cbs: cstInfo.cst_cbs,
          ibsBase: aliquotasAno.ibs.toFixed(2),
          cbsBase: aliquotasAno.cbs.toFixed(2),
          reducao_ibs: anexo.reducao_ibs.toString(),
          reducao_cbs: anexo.reducao_cbs.toString(),
          ibsEfetiva: ibsEfetiva.toFixed(2),
          cbsEfetiva: cbsEfetiva.toFixed(2),
          impostoSeletivo: 'NÃO',
          cst_is: '-',
          classtrib_is: '-',
          aliquota_is: '-',
          anexo_is: '-'
        };
      }
    }
  }

  // Verificar Imposto Seletivo
  for (const item of IMPOSTO_SELETIVO) {
    if (compararNCM(ncm, item.ncm)) {
      let classtribIS: string;
      let anexoIS: string;
      const cstIS = '0';
      
      if (item.nome.toLowerCase().includes('bebida') || item.nome.toLowerCase().includes('cerveja')) {
        classtribIS = '800001';
        anexoIS = 'ANEXO 12';
      } else if (item.nome.toLowerCase().includes('cigarro') || item.nome.toLowerCase().includes('tabaco')) {
        classtribIS = '810001';
        anexoIS = 'ANEXO 13';
      } else if (item.nome.toLowerCase().includes('veículo') || item.nome.toLowerCase().includes('aeronave')) {
        classtribIS = '820001';
        anexoIS = 'ANEXO 14';
      } else {
        classtribIS = '830001';
        anexoIS = 'ANEXO 15';
      }
      
      return {
        codigo: ncm,
        validez: 'atencao',
        mensagem: `Imposto Seletivo: ${item.nome} (${item.aliquota}%)`,
        regime: `Regime Padrão + IS (${item.aliquota}%)`,
        anexo: '-',
        classtrib: '000001',
        cst_ibs: '000',
        cst_cbs: '000',
        ibsBase: aliquotasAno.ibs.toFixed(2),
        cbsBase: aliquotasAno.cbs.toFixed(2),
        reducao_ibs: '0',
        reducao_cbs: '0',
        ibsEfetiva: aliquotasAno.ibs.toFixed(2),
        cbsEfetiva: aliquotasAno.cbs.toFixed(2),
        impostoSeletivo: 'SIM',
        cst_is: cstIS,
        classtrib_is: classtribIS,
        aliquota_is: item.aliquota,
        anexo_is: anexoIS
      };
    }
  }

  // Regime padrão
  return {
    codigo: ncm,
    validez: 'ok',
    mensagem: 'NCM válido - Regime padrão',
    regime: 'Regime Padrão',
    anexo: '-',
    classtrib: '000001',
    cst_ibs: '000',
    cst_cbs: '000',
    ibsBase: aliquotasAno.ibs.toFixed(2),
    cbsBase: aliquotasAno.cbs.toFixed(2),
    reducao_ibs: '0',
    reducao_cbs: '0',
    ibsEfetiva: aliquotasAno.ibs.toFixed(2),
    cbsEfetiva: aliquotasAno.cbs.toFixed(2),
    impostoSeletivo: 'NÃO',
    cst_is: '-',
    classtrib_is: '-',
    aliquota_is: '-',
    anexo_is: '-'
  };
}

export function analisarNBS(
  nbs: string, 
  ano: number = 2033, 
  nbsDatabase: NBSDatabase | null = null,
  opcaoEscolhida: number | null = null
): ResultadoAnalise {
  if (!nbs) {
    return {
      codigo: nbs,
      validez: 'invalido',
      mensagem: 'NBS não informado',
      regime: '-',
      anexo: '-',
      classtrib: '-',
      cst_ibs: '-',
      cst_cbs: '-',
      ibsBase: '-',
      cbsBase: '-',
      reducao_ibs: '-',
      reducao_cbs: '-',
      ibsEfetiva: 0,
      cbsEfetiva: 0,
      impostoSeletivo: 'NÃO',
      cst_is: '-',
      classtrib_is: '-',
      aliquota_is: '-',
      anexo_is: '-',
      temMultiplasOpcoes: false,
      totalOpcoes: 0,
      opcoes: []
    };
  }

  const aliquotasAno = PERIODO_TRANSICAO[ano] || PERIODO_TRANSICAO[2033];

  // Se não há base de dados carregada, usar o método antigo
  if (!nbsDatabase || !nbsDatabase[nbs]) {
    const beneficiosEncontrados: Array<{
      anexo: string;
      nome: string;
      reducao_ibs: number;
      reducao_cbs: number;
      ibsEfetiva: string;
      cbsEfetiva: string;
      classtrib: string;
      cst_ibs: string;
      cst_cbs: string;
    }> = [];

    for (const [key, anexo] of Object.entries(ANEXOS_LC214)) {
      if (!anexo.nbs) continue;
      
      for (const item of anexo.nbs) {
        if (String(nbs).replace(/[^0-9.]/g, '') === String(item.nbs).replace(/[^0-9.]/g, '')) {
          const fatorReducao = (100 - anexo.reducao_ibs) / 100;
          const ibsEfetiva = aliquotasAno.ibs * fatorReducao;
          const cbsEfetiva = aliquotasAno.cbs * fatorReducao;
          
          const classtribCalculado = obterClassTribPorAnexo(anexo.numero, anexo.reducao_ibs);
          const cstInfo = obterCSTporClassTrib(classtribCalculado);
          
          beneficiosEncontrados.push({
            anexo: `ANEXO ${anexo.numero}`,
            nome: `${anexo.nome}: ${item.nome}`,
            reducao_ibs: anexo.reducao_ibs,
            reducao_cbs: anexo.reducao_cbs,
            ibsEfetiva: ibsEfetiva.toFixed(2),
            cbsEfetiva: cbsEfetiva.toFixed(2),
            classtrib: classtribCalculado,
            cst_ibs: cstInfo.cst_ibs,
            cst_cbs: cstInfo.cst_cbs
          });
        }
      }
    }

    if (beneficiosEncontrados.length >= 1) {
      const beneficio = beneficiosEncontrados[0];
      return {
        codigo: nbs,
        validez: 'ok',
        mensagem: beneficio.nome,
        regime: beneficio.reducao_ibs === 100 ? 'Alíquota Zero (100% Redução)' : `Redução de ${beneficio.reducao_ibs}%`,
        anexo: beneficio.anexo,
        classtrib: beneficio.classtrib,
        cst_ibs: beneficio.cst_ibs,
        cst_cbs: beneficio.cst_cbs,
        ibsBase: aliquotasAno.ibs.toFixed(2),
        cbsBase: aliquotasAno.cbs.toFixed(2),
        reducao_ibs: beneficio.reducao_ibs.toString(),
        reducao_cbs: beneficio.reducao_cbs.toString(),
        ibsEfetiva: beneficio.ibsEfetiva,
        cbsEfetiva: beneficio.cbsEfetiva,
        impostoSeletivo: 'NÃO',
        cst_is: '-',
        classtrib_is: '-',
        aliquota_is: '-',
        anexo_is: '-',
        temMultiplasOpcoes: false,
        totalOpcoes: 1,
        opcoes: []
      };
    }

    // Regime padrão
    return {
      codigo: nbs,
      validez: 'ok',
      mensagem: 'NBS válido - Regime padrão',
      regime: 'Regime Padrão',
      anexo: '-',
      classtrib: '000001',
      cst_ibs: '000',
      cst_cbs: '000',
      ibsBase: aliquotasAno.ibs.toFixed(2),
      cbsBase: aliquotasAno.cbs.toFixed(2),
      reducao_ibs: '0',
      reducao_cbs: '0',
      ibsEfetiva: aliquotasAno.ibs.toFixed(2),
      cbsEfetiva: aliquotasAno.cbs.toFixed(2),
      impostoSeletivo: 'NÃO',
      cst_is: '-',
      classtrib_is: '-',
      aliquota_is: '-',
      anexo_is: '-',
      temMultiplasOpcoes: false,
      totalOpcoes: 0,
      opcoes: []
    };
  }

  // Método novo: usar base de dados oficial
  const nbsInfo = nbsDatabase[nbs];
  
  // Se tem múltiplas opções e nenhuma foi escolhida
  if (nbsInfo.opcoes.length > 1 && opcaoEscolhida === null) {
    return {
      codigo: nbs,
      validez: 'multiplas_opcoes',
      mensagem: `⚠️ Este NBS possui ${nbsInfo.opcoes.length} opções de tributação`,
      regime: '-',
      anexo: '-',
      classtrib: '-',
      cst_ibs: '-',
      cst_cbs: '-',
      ibsBase: '-',
      cbsBase: '-',
      reducao_ibs: '-',
      reducao_cbs: '-',
      ibsEfetiva: 0,
      cbsEfetiva: 0,
      impostoSeletivo: 'NÃO',
      cst_is: '-',
      classtrib_is: '-',
      aliquota_is: '-',
      anexo_is: '-',
      temMultiplasOpcoes: true,
      totalOpcoes: nbsInfo.opcoes.length,
      opcoes: nbsInfo.opcoes,
      descricao: nbsInfo.descricao
    };
  }
  
  // Usar a opção escolhida ou a primeira se houver apenas uma
  const indiceOpcao = opcaoEscolhida !== null ? opcaoEscolhida : 0;
  const opcao = nbsInfo.opcoes[indiceOpcao];
  
  // Obter informações de redução do ClassTrib
  const cstInfo = obterCSTporClassTrib(opcao.classtrib);
  
  // Calcular reduções baseado no ClassTrib
  let reducao_ibs = 0;
  let reducao_cbs = 0;
  
  if (opcao.classtrib === '200028' || opcao.classtrib === '200029' ||
      opcao.classtrib === '200043' || opcao.classtrib === '200044' ||
      opcao.classtrib === '200039' || opcao.classtrib === '200045' ||
      opcao.classtrib === '200046' || opcao.classtrib === '200052') {
    reducao_ibs = 60;
    reducao_cbs = 60;
  } else if (opcao.classtrib === '200016') {
    reducao_ibs = 100;
    reducao_cbs = 100;
  } else if (opcao.classtrib.startsWith('010')) {
    reducao_ibs = 0;
    reducao_cbs = 0;
  }
  
  const fatorReducao = (100 - reducao_ibs) / 100;
  const ibsEfetiva = aliquotasAno.ibs * fatorReducao;
  const cbsEfetiva = aliquotasAno.cbs * fatorReducao;
  
  return {
    codigo: nbs,
    validez: 'ok',
    mensagem: nbsInfo.descricao,
    regime: reducao_ibs === 0 ? 'Tributação Integral' : `Redução de ${reducao_ibs}%`,
    anexo: determinarAnexo(opcao.classtrib),
    classtrib: opcao.classtrib,
    cst_ibs: cstInfo.cst_ibs,
    cst_cbs: cstInfo.cst_cbs,
    ibsBase: aliquotasAno.ibs.toFixed(2),
    cbsBase: aliquotasAno.cbs.toFixed(2),
    reducao_ibs: reducao_ibs.toString(),
    reducao_cbs: reducao_cbs.toString(),
    ibsEfetiva: ibsEfetiva.toFixed(2),
    cbsEfetiva: cbsEfetiva.toFixed(2),
    impostoSeletivo: 'NÃO',
    cst_is: '-',
    classtrib_is: '-',
    aliquota_is: '-',
    anexo_is: '-',
    temMultiplasOpcoes: nbsInfo.opcoes.length > 1,
    totalOpcoes: nbsInfo.opcoes.length,
    opcaoSelecionada: indiceOpcao,
    opcoes: nbsInfo.opcoes
  };
}

export function analisarImovel(tipoOperacao: string, valorOperacao: number, ano: number = 2033): ResultadoAnalise & { descricao?: string } {
  const operacao = OPERACOES_IMOBILIARIAS[tipoOperacao];
  if (!operacao) {
    return {
      codigo: '-',
      validez: 'invalido',
      mensagem: 'Tipo de operação inválido',
      regime: '-',
      anexo: '-',
      classtrib: '-',
      cst_ibs: '-',
      cst_cbs: '-',
      ibsBase: '-',
      cbsBase: '-',
      reducao_ibs: '-',
      reducao_cbs: '-',
      ibsEfetiva: 0,
      cbsEfetiva: 0,
      impostoSeletivo: 'NÃO',
      cst_is: '-',
      classtrib_is: '-',
      aliquota_is: '-',
      anexo_is: '-'
    };
  }

  const aliquotasAno = PERIODO_TRANSICAO[ano] || PERIODO_TRANSICAO[2033];

  let ibsEfetiva: number;
  let cbsEfetiva: number;

  if (tipoOperacao === 'venda_ret' && operacao.aliquota_fixa_ibs && operacao.aliquota_fixa_cbs) {
    ibsEfetiva = operacao.aliquota_fixa_ibs;
    cbsEfetiva = operacao.aliquota_fixa_cbs;
  } else {
    const fatorReducao = (100 - operacao.reducao_ibs) / 100;
    ibsEfetiva = aliquotasAno.ibs * fatorReducao;
    cbsEfetiva = aliquotasAno.cbs * fatorReducao;
  }

  return {
    codigo: tipoOperacao.toUpperCase(),
    validez: 'ok',
    mensagem: operacao.observacao,
    regime: operacao.nome,
    anexo: tipoOperacao === 'locacao' ? 'ART. 127' : 'ART. 124',
    classtrib: operacao.classtrib,
    cst_ibs: operacao.cst_ibs,
    cst_cbs: operacao.cst_cbs,
    ibsBase: aliquotasAno.ibs.toFixed(2),
    cbsBase: aliquotasAno.cbs.toFixed(2),
    reducao_ibs: operacao.reducao_ibs.toString(),
    reducao_cbs: operacao.reducao_cbs.toString(),
    ibsEfetiva: ibsEfetiva.toFixed(2),
    cbsEfetiva: cbsEfetiva.toFixed(2),
    impostoSeletivo: 'NÃO',
    cst_is: '-',
    classtrib_is: '-',
    aliquota_is: '-',
    anexo_is: '-',
    descricao: operacao.descricao
  };
}
