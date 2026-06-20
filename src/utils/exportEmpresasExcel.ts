import * as XLSX from "xlsx";
import { Empresa } from "@/types/cbenef";

export const exportEmpresasExcel = (empresas: Empresa[]) => {
  const wb = XLSX.utils.book_new();
  const data: string[][] = [
    ["SCI", "Nome Empresarial", "CNPJ", "IE", "Município", "Regime Tributário"],
  ];
  empresas.forEach((e) => {
    data.push([e.sci, e.nomeEmpresarial, e.cnpj, e.ie, e.municipio, e.equipe]);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, "Empresas");
  XLSX.writeFile(wb, "Empresas_Cadastradas.xlsx");
};
