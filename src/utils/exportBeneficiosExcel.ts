import * as XLSX from "xlsx";
import { BeneficioFiscal } from "@/types/cbenef";
import { getDescricaoCbenef, getDescricaoCST, getDispositivoCbenef } from "@/utils/descricaoUtils";

export const exportBeneficiosExcel = (beneficios: BeneficioFiscal[]) => {
  const wb = XLSX.utils.book_new();

  const cfopBeneficios = beneficios.filter((b) => b.tipo === "CFOP").sort((a, b) => a.cfopOuNcm.localeCompare(b.cfopOuNcm));
  const ncmBeneficios = beneficios.filter((b) => b.tipo === "NCM").sort((a, b) => a.cfopOuNcm.localeCompare(b.cfopOuNcm));
  const sorted = [...cfopBeneficios, ...ncmBeneficios];

  const data: (string | undefined)[][] = [
    ["Tipo", "CFOP / NCM", "Natureza da Operação", "CST", "Descrição CST", "CSOSN", "Descrição CSOSN", "cBenef", "Descrição cBenef", "Legislação", "Destinatário"],
  ];

  sorted.forEach((b) => {
    data.push([b.tipo, b.cfopOuNcm, b.naturezaOperacao, b.cst, b.cst ? getDescricaoCST(b.cst) : "", b.csosn || "", b.csosn ? getDescricaoCST(b.csosn) : "", b.cBenef, getDescricaoCbenef(b.cBenef), getDispositivoCbenef(b.cBenef), b.destinatario || ""]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 8 }, { wch: 35 }, { wch: 8 }, { wch: 35 }, { wch: 14 }, { wch: 40 }, { wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws, "Benefícios");

  XLSX.writeFile(wb, `Base_Beneficios_Fiscais.xlsx`);
};
