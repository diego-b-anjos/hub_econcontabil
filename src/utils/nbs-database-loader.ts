// ==================================================================================
// CARREGADOR DE BASE NBS E CLASSIFICAÇÃO TRIBUTÁRIA
// ==================================================================================

import nbsClasstribData from '@/data/nbs-classtrib.json';
import classificacaoTributariaData from '@/data/classificacao-tributaria.json';

export interface NBSClasstribItem {
  'Item LC 116': number | string;
  'Descrição Item': string;
  NBS: string;
  'DESCRIÇÃO NBS': string;
  'PS ONEROSA? (S/N)': string;
  'ADQ EXTERIOR? (S/N)': string;
  INDOP: number;
  'Local incidência IBS': string;
  cClassTrib: number;
  'nome cClassTrib': string;
}

export interface ClassificacaoTributariaItem {
  'Código da Situação Tributária': string;
  'Descrição da Situação Tributária': string;
  'Código da Classificação Tributária': string;
  'Descrição do Código da Classificação Tributária': string;
  'Percentual Redução IBS': string;
  'Percentual Redução CBS': string;
  'Tipo de Alíquota': string;
  'Número do Anexo': string;
  'Url da Legislação': string;
}

export interface NBSProcessado {
  nbs: string;
  descricao: string;
  itemLC116: string;
  descricaoItemLC116: string;
  localIncidencia: string;
  opcoes: Array<{
    classtrib: string;
    nomeClasstrib: string;
    indop: number;
  }>;
}

// Carregar e processar base NBS
export function carregarBaseNBS(): Map<string, NBSProcessado> {
  const nbsMap = new Map<string, NBSProcessado>();
  
  for (const item of nbsClasstribData as NBSClasstribItem[]) {
    const nbs = String(item.NBS).replace(/[^0-9.]/g, '');
    if (!nbs) continue;
    
    const classtrib = String(item.cClassTrib).padStart(6, '0');
    const opcao = {
      classtrib,
      nomeClasstrib: item['nome cClassTrib'] || '',
      indop: item.INDOP || 0
    };
    
    if (nbsMap.has(nbs)) {
      const existente = nbsMap.get(nbs)!;
      // Verificar se já existe essa opção
      const jaExiste = existente.opcoes.some(o => o.classtrib === classtrib);
      if (!jaExiste) {
        existente.opcoes.push(opcao);
      }
    } else {
      nbsMap.set(nbs, {
        nbs,
        descricao: item['DESCRIÇÃO NBS'] || '',
        itemLC116: String(item['Item LC 116'] || ''),
        descricaoItemLC116: item['Descrição Item'] || '',
        localIncidencia: item['Local incidência IBS'] || '',
        opcoes: [opcao]
      });
    }
  }
  
  return nbsMap;
}

// Carregar e processar classificação tributária
export function carregarClassificacaoTributaria(): Map<string, ClassificacaoTributariaItem[]> {
  const classMap = new Map<string, ClassificacaoTributariaItem[]>();
  
  for (const item of classificacaoTributariaData as ClassificacaoTributariaItem[]) {
    const codigo = item['Código da Classificação Tributária'];
    if (!codigo) continue;
    
    if (classMap.has(codigo)) {
      classMap.get(codigo)!.push(item);
    } else {
      classMap.set(codigo, [item]);
    }
  }
  
  return classMap;
}

// Obter detalhes da classificação tributária
export function obterDetalhesClassificacao(classtrib: string): ClassificacaoTributariaItem | null {
  const classMap = carregarClassificacaoTributaria();
  const codigo = String(classtrib).padStart(6, '0');
  const items = classMap.get(codigo);
  return items?.[0] || null;
}

// Obter CST a partir da classificação tributária
export function obterCSTdeClassificacao(classtrib: string): { cst: string; descricao: string; reducaoIBS: number; reducaoCBS: number } {
  const detalhes = obterDetalhesClassificacao(classtrib);
  
  if (detalhes) {
    return {
      cst: detalhes['Código da Situação Tributária'] || '000',
      descricao: detalhes['Descrição da Situação Tributária'] || 'Tributação integral',
      reducaoIBS: parseFloat(detalhes['Percentual Redução IBS']) || 0,
      reducaoCBS: parseFloat(detalhes['Percentual Redução CBS']) || 0
    };
  }
  
  // Tentar derivar CST do código da classificação tributária
  // Os 3 primeiros dígitos do ClassTrib geralmente indicam o CST
  const codigo = String(classtrib).padStart(6, '0');
  const cstDerived = codigo.substring(0, 3);
  
  return {
    cst: cstDerived || '000',
    descricao: 'Tributação integral',
    reducaoIBS: 0,
    reducaoCBS: 0
  };
}

// Cache para melhor performance
let nbsCacheData: Map<string, NBSProcessado> | null = null;

export function getNBSDatabase(): Map<string, NBSProcessado> {
  if (!nbsCacheData) {
    nbsCacheData = carregarBaseNBS();
  }
  return nbsCacheData;
}

// Buscar NBS com suporte a múltiplas opções
export function buscarNBS(nbs: string): NBSProcessado | null {
  const nbsLimpo = String(nbs).replace(/[^0-9.]/g, '');
  const database = getNBSDatabase();
  
  // Busca exata
  if (database.has(nbsLimpo)) {
    return database.get(nbsLimpo)!;
  }
  
  // Busca por prefixo
  for (const [key, value] of database.entries()) {
    if (key.startsWith(nbsLimpo) || nbsLimpo.startsWith(key)) {
      return value;
    }
  }
  
  return null;
}

// Buscar por descrição
export function buscarNBSPorDescricao(termo: string): NBSProcessado[] {
  const termoLower = termo.toLowerCase();
  const database = getNBSDatabase();
  const resultados: NBSProcessado[] = [];
  
  for (const item of database.values()) {
    if (
      item.descricao.toLowerCase().includes(termoLower) ||
      item.descricaoItemLC116.toLowerCase().includes(termoLower)
    ) {
      resultados.push(item);
    }
  }
  
  return resultados.slice(0, 50); // Limitar resultados
}

// Buscar NBS por código da LC 116/2003
export function buscarNBSPorLC116(codigoLC116: string): NBSProcessado[] {
  // Normalizar código: 07.01, 7.01, 7.1 -> "7.01"
  const codigoNormalizado = codigoLC116
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map((parte, idx) => idx === 0 ? String(parseInt(parte) || 0) : parte.padStart(2, '0'))
    .join('.');
  
  const database = getNBSDatabase();
  const resultados: NBSProcessado[] = [];
  
  for (const item of database.values()) {
    // Normalizar o itemLC116 para comparação
    const itemNormalizado = String(item.itemLC116)
      .replace(/[^0-9.]/g, '')
      .split('.')
      .map((parte, idx) => idx === 0 ? String(parseInt(parte) || 0) : parte.padStart(2, '0'))
      .join('.');
    
    if (itemNormalizado === codigoNormalizado) {
      resultados.push(item);
    }
  }
  
  return resultados;
}
