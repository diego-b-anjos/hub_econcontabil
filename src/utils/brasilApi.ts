const BRASIL_API = "https://brasilapi.com.br/api";

export interface CnpjData {
  razao_social: string;
  cnpj: string;
  municipio: string;
  uf: string;
  descricao_situacao_cadastral: string;
  opcao_pelo_simples: boolean | null;
  nome_fantasia: string;
  inscricoes_estaduais?: Array<{ inscricao_estadual: string; ativo: boolean; estado: string }>;
}

export interface NcmData {
  codigo: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  tipo_ato: string;
  numero_ato: string;
  ano_ato: string;
}

export async function fetchCnpjData(cnpj: string): Promise<CnpjData> {
  const clean = cnpj.replace(/\D/g, "");
  const res = await fetch(`${BRASIL_API}/cnpj/v1/${clean}`);
  if (!res.ok) throw new Error("CNPJ não encontrado");
  return res.json();
}

export async function searchNcm(query: string): Promise<NcmData[]> {
  const res = await fetch(`${BRASIL_API}/ncm/v1?search=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchNcmByCodigo(codigo: string): Promise<NcmData | null> {
  const clean = codigo.replace(/\D/g, "");
  try {
    const res = await fetch(`${BRASIL_API}/ncm/v1/${clean}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
