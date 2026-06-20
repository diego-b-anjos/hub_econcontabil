import { tabelaCbenefSP } from "@/data/tabelaCbenef";
import { tabelaCST } from "@/data/tabelaCST";
import { tabelaCSOSN } from "@/data/tabelaCSOSN";

export function getDescricaoCbenef(codigo: string): string {
  const item = tabelaCbenefSP.find((c) => c.codigo === codigo);
  return item?.descricao || "";
}

export function getDispositivoCbenef(codigo: string): string {
  const item = tabelaCbenefSP.find((c) => c.codigo === codigo);
  return item?.dispositivo || "";
}

export function getDescricaoCST(codigo: string): string {
  // Check CST first
  const cst = tabelaCST.find((c) => c.codigo === codigo);
  if (cst) return cst.descricao;
  // Then check CSOSN
  const csosn = tabelaCSOSN.find((c) => c.codigo === codigo);
  return csosn?.descricao || "";
}

export function isCSOSN(codigo: string): boolean {
  return tabelaCSOSN.some((c) => c.codigo === codigo);
}

export function isCST(codigo: string): boolean {
  return tabelaCST.some((c) => c.codigo === codigo);
}

export function isEmpresaSimplesNacional(equipe: string): boolean {
  return equipe.toUpperCase().includes("SIMPLES");
}

export function isEmpresaLucro(equipe: string): boolean {
  const upper = equipe.toUpperCase();
  return upper.includes("LUCRO PRESUMIDO") || upper.includes("LUCRO REAL");
}

export function validarCompatibilidadeCstEmpresa(cst: string, csosn: string, equipe: string): { valido: boolean; mensagem: string } {
  const simplesNacional = isEmpresaSimplesNacional(equipe);

  if (simplesNacional && !csosn) {
    return {
      valido: false,
      mensagem: `Benefício sem CSOSN preenchido não pode ser vinculado a empresa do Simples Nacional.`,
    };
  }

  if (!simplesNacional && !cst) {
    return {
      valido: false,
      mensagem: `Benefício sem CST preenchido não pode ser vinculado a empresa de ${equipe}.`,
    };
  }

  return { valido: true, mensagem: "" };
}

export function getCodigoParaEmpresa(beneficio: { cst: string; csosn: string }, equipe: string): string {
  return isEmpresaSimplesNacional(equipe) ? beneficio.csosn : beneficio.cst;
}
