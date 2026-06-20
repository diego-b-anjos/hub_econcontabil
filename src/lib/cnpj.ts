/**
 * Helper unificado de consulta de CNPJ.
 * Usa BrasilAPI como fonte primária e cai para ReceitaWS como backup.
 * Retorna objeto normalizado (chaves camelCase) pronto para popular o form
 * de clientes ou enviar via apiClients.create().
 */

export interface CnaeSecundario {
  codigo: string;
  descricao: string;
}

export interface CnpjLookup {
  cnpj: string;                // só dígitos (14)
  razaoSocial: string;
  nomeFantasia: string;
  cnaePrincipalCodigo: string;
  cnaePrincipalDescricao: string;
  cnaesSecundarios: CnaeSecundario[];
  // Endereço
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  enderecoFormatado: string;   // 1 linha p/ campo `address` legado
  // Contato
  telefone: string;
  telefoneSecundario: string;
  email: string;
  // Cadastrais
  inscricaoEstadual: string;
  naturezaJuridica: string;
  porte: string;
  dataAbertura: string;        // ISO yyyy-mm-dd
  situacaoCadastral: string;
  capitalSocial: string;       // como string formatada
  // Regime
  taxRegime: "" | "SN";        // só sabemos detectar SN; LP/LR fica em branco
  optanteSimples: boolean | null;
  optanteMei: boolean | null;
}

export function onlyDigitsCnpj(v: string): string {
  return v.replace(/\D/g, "").slice(0, 14);
}

export function formatCNPJ(v: string): string {
  const d = onlyDigitsCnpj(v);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function s(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function formatPhone(ddd: string, raw: string): string {
  const digits = (ddd + raw).replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return digits ? digits : "";
}

function normalizeBrasilApi(d: any): CnpjLookup {
  const tipoLog = s(d.descricao_tipo_de_logradouro);
  const logradouro = [tipoLog, s(d.logradouro)].filter(Boolean).join(" ").trim();
  const cnaesSec: CnaeSecundario[] = Array.isArray(d.cnaes_secundarios)
    ? d.cnaes_secundarios.map((c: any) => ({
        codigo: s(c.codigo),
        descricao: s(c.descricao),
      })).filter((c: CnaeSecundario) => c.codigo)
    : [];
  const enderecoFormatado = [
    logradouro,
    s(d.numero),
    s(d.complemento),
    s(d.bairro),
    s(d.municipio) && s(d.uf) && `${s(d.municipio)}/${s(d.uf)}`,
    s(d.cep) && `CEP ${s(d.cep)}`,
  ].filter(Boolean).join(", ");
  return {
    cnpj: s(d.cnpj).replace(/\D/g, ""),
    razaoSocial: s(d.razao_social),
    nomeFantasia: s(d.nome_fantasia),
    cnaePrincipalCodigo: s(d.cnae_fiscal),
    cnaePrincipalDescricao: s(d.cnae_fiscal_descricao),
    cnaesSecundarios: cnaesSec,
    cep: s(d.cep).replace(/\D/g, ""),
    logradouro,
    numero: s(d.numero),
    complemento: s(d.complemento),
    bairro: s(d.bairro),
    municipio: s(d.municipio),
    uf: s(d.uf),
    enderecoFormatado,
    telefone: s(d.ddd_telefone_1),
    telefoneSecundario: s(d.ddd_telefone_2),
    email: s(d.email).toLowerCase(),
    inscricaoEstadual: "", // BrasilAPI não retorna IE
    naturezaJuridica: s(d.natureza_juridica),
    porte: s(d.porte),
    dataAbertura: s(d.data_inicio_atividade),
    situacaoCadastral: s(d.descricao_situacao_cadastral),
    capitalSocial: d.capital_social != null ? String(d.capital_social) : "",
    optanteSimples: typeof d.opcao_pelo_simples === "boolean" ? d.opcao_pelo_simples : null,
    optanteMei: typeof d.opcao_pelo_mei === "boolean" ? d.opcao_pelo_mei : null,
    taxRegime: d.opcao_pelo_simples === true || d.opcao_pelo_mei === true ? "SN" : "",
  };
}

function normalizeReceitaWs(d: any): CnpjLookup {
  const cnaesSec: CnaeSecundario[] = Array.isArray(d.atividades_secundarias)
    ? d.atividades_secundarias.map((c: any) => ({
        codigo: s(c.code).replace(/\D/g, ""),
        descricao: s(c.text),
      })).filter((c: CnaeSecundario) => c.codigo)
    : [];
  const principal = Array.isArray(d.atividade_principal) ? d.atividade_principal[0] : null;
  const enderecoFormatado = [
    s(d.logradouro),
    s(d.numero),
    s(d.complemento),
    s(d.bairro),
    s(d.municipio) && s(d.uf) && `${s(d.municipio)}/${s(d.uf)}`,
    s(d.cep) && `CEP ${s(d.cep)}`,
  ].filter(Boolean).join(", ");
  // ReceitaWS data_abertura vem em dd/mm/yyyy
  let dataAbertura = "";
  if (d.abertura && /^\d{2}\/\d{2}\/\d{4}$/.test(d.abertura)) {
    const [dd, mm, yy] = d.abertura.split("/");
    dataAbertura = `${yy}-${mm}-${dd}`;
  }
  return {
    cnpj: s(d.cnpj).replace(/\D/g, ""),
    razaoSocial: s(d.nome),
    nomeFantasia: s(d.fantasia),
    cnaePrincipalCodigo: principal ? s(principal.code).replace(/\D/g, "") : "",
    cnaePrincipalDescricao: principal ? s(principal.text) : "",
    cnaesSecundarios: cnaesSec,
    cep: s(d.cep).replace(/\D/g, ""),
    logradouro: s(d.logradouro),
    numero: s(d.numero),
    complemento: s(d.complemento),
    bairro: s(d.bairro),
    municipio: s(d.municipio),
    uf: s(d.uf),
    enderecoFormatado,
    telefone: formatPhone("", s(d.telefone).split("/")[0] || ""),
    telefoneSecundario: formatPhone("", s(d.telefone).split("/")[1] || ""),
    email: s(d.email).toLowerCase(),
    inscricaoEstadual: "",
    naturezaJuridica: s(d.natureza_juridica),
    porte: s(d.porte),
    dataAbertura,
    situacaoCadastral: s(d.situacao),
    capitalSocial: s(d.capital_social),
    optanteSimples: typeof d.simples?.optante === "boolean" ? d.simples.optante : null,
    optanteMei: typeof d.simei?.optante === "boolean" ? d.simei.optante : null,
    taxRegime: d.simples?.optante === true || d.simei?.optante === true ? "SN" : "",
  };
}

/**
 * Consulta um CNPJ. Aceita string com ou sem máscara.
 * Lança Error com mensagem amigável em caso de falha.
 */
export async function lookupCnpj(cnpj: string): Promise<CnpjLookup> {
  const digits = onlyDigitsCnpj(cnpj);
  if (digits.length !== 14) throw new Error("Informe um CNPJ válido (14 dígitos)");

  // 1) BrasilAPI (estável, sem CORS)
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (r.ok) {
      const data = await r.json();
      return normalizeBrasilApi(data);
    }
    if (r.status === 404) throw new Error("CNPJ não encontrado");
  } catch (e: any) {
    // se falhou por rede, tenta fallback abaixo
    if (e?.message === "CNPJ não encontrado") throw e;
  }

  // 2) ReceitaWS via proxy público (fallback)
  try {
    const r2 = await fetch(`https://www.receitaws.com.br/v1/cnpj/${digits}`);
    if (r2.ok) {
      const data = await r2.json();
      if (data?.status === "ERROR") throw new Error(data.message || "CNPJ inválido");
      return normalizeReceitaWs(data);
    }
  } catch (e: any) {
    throw new Error(e?.message || "Falha ao consultar CNPJ (rede)");
  }

  throw new Error("Falha ao consultar CNPJ");
}
