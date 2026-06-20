export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatIE(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14);
}

export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(digits[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };

  return calc(12) === parseInt(digits[12]) && calc(13) === parseInt(digits[13]);
}

export interface CNPJData {
  razaoSocial: string;
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
}

async function fetchCodigoMunicipioIBGE(uf: string, nomeMunicipio: string): Promise<string> {
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
    );
    if (!res.ok) return "";
    const municipios: Array<{ id: number; nome: string }> = await res.json();
    const normalize = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const target = normalize(nomeMunicipio);
    const found = municipios.find((m) => normalize(m.nome) === target);
    if (found) return String(found.id);
    const partial = municipios.find((m) => normalize(m.nome).includes(target) || target.includes(normalize(m.nome)));
    return partial ? String(partial.id) : "";
  } catch {
    return "";
  }
}

export async function fetchCNPJData(cnpj: string): Promise<CNPJData | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!res.ok) return null;
    const data = await res.json();
    const uf = data.uf || "";
    const municipio = data.municipio || "";
    const codigoIBGE = await fetchCodigoMunicipioIBGE(uf, municipio);
    return {
      razaoSocial: data.razao_social || "",
      inscricaoEstadual: "",
      uf,
      codigoMunicipio: codigoIBGE,
      endereco: `${data.descricao_tipo_de_logradouro || ""} ${data.logradouro || ""}`.trim(),
      numero: data.numero || "",
      complemento: data.complemento || "",
      bairro: data.bairro || "",
      cep: (data.cep || "").replace(/\D/g, ""),
      telefone: (data.ddd_telefone_1 || "").replace(/\D/g, ""),
      email: data.email || "",
    };
  } catch {
    return null;
  }
}
