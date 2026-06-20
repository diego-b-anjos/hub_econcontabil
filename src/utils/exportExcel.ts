import * as XLSX from "xlsx";
import { Empresa, BeneficioFiscal } from "@/types/cbenef";
import { getDescricaoCbenef, getDescricaoCST, getDispositivoCbenef, isEmpresaSimplesNacional } from "@/utils/descricaoUtils";

export const generateExcel = (empresa: Empresa, beneficios: BeneficioFiscal[], observacoes?: string) => {
  const wb = XLSX.utils.book_new();

  // Company info sheet (without SCI)
  const infoData: (string | undefined)[][] = [
    ["Econ Escritório Contábil Ltda - Relatório cBenef"],
    [],
    ["Dados da Empresa"],
    ["Nome Empresarial", empresa.nomeEmpresarial],
    ["CNPJ", empresa.cnpj],
    ["Inscrição Estadual", empresa.ie],
    ["Município", empresa.municipio],
    ["Regime Tributário", empresa.equipe],
    [],
    ["Embasamento Legal", "Portaria SRE 70/2025 - Secretaria da Receita Estadual de São Paulo"],
    ["Data de Emissão", new Date().toLocaleDateString("pt-BR")],
  ];

  if (observacoes && observacoes.trim()) {
    infoData.push([]);
    infoData.push(["Observações"]);
    infoData.push([observacoes.trim()]);
  }

  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo["!cols"] = [{ wch: 20 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Empresa");

  // Benefits sheet with descriptions
  const cfopBeneficios = beneficios.filter((b) => b.tipo === "CFOP");
  const ncmBeneficios = beneficios.filter((b) => b.tipo === "NCM");

  const isSN = isEmpresaSimplesNacional(empresa.equipe);
  const cstLabel = isSN ? "CSOSN" : "CST";
  const getCodigo = (b: BeneficioFiscal) => isSN ? (b.csosn || "") : b.cst;

  const benefData: (string | undefined)[][] = [
    ["Tipo", "CFOP / NCM", "Natureza da Operação", cstLabel, `Descrição ${cstLabel}`, "cBenef", "Descrição cBenef", "Legislação", "Destinatário"],
  ];

  cfopBeneficios.forEach((b) => {
    benefData.push([b.tipo, b.cfopOuNcm, b.naturezaOperacao, getCodigo(b), getDescricaoCST(getCodigo(b)), b.cBenef, getDescricaoCbenef(b.cBenef), getDispositivoCbenef(b.cBenef), b.destinatario || ""]);
  });

  if (ncmBeneficios.length > 0) {
    benefData.push([]);
    benefData.push(["* Os benefícios por NCM abaixo são utilizados para todas as demais operações fiscais."]);
    benefData.push([]);
    ncmBeneficios.forEach((b) => {
      benefData.push([b.tipo, b.cfopOuNcm, b.naturezaOperacao, getCodigo(b), getDescricaoCST(getCodigo(b)), b.cBenef, getDescricaoCbenef(b.cBenef), getDispositivoCbenef(b.cBenef), b.destinatario || ""]);
    });
  }

  const wsBenef = XLSX.utils.aoa_to_sheet(benefData);
  wsBenef["!cols"] = [{ wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 8 }, { wch: 35 }, { wch: 14 }, { wch: 40 }, { wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsBenef, "Benefícios");

  XLSX.writeFile(wb, `cBenef_${empresa.nomeEmpresarial.replace(/\s+/g, "_")}.xlsx`);
};
