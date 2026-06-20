import * as XLSX from "xlsx";

export const exportTemplateEmpresas = () => {
  const wb = XLSX.utils.book_new();
  const data = [
    ["SCI", "NOME EMPRESARIAL", "CNPJ", "IE", "MUNICIPIO", "TIPO", "EQUIPE"],
    ["001", "Empresa Exemplo Ltda", "12.345.678/0001-90", "123456789", "São Paulo", "MATRIZ", "LUCRO PRESUMIDO"],
    ["002", "Filial Exemplo Ltda", "12.345.678/0002-71", "987654321", "Campinas", "FILIAL", "LUCRO REAL"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 8 }, { wch: 35 }, { wch: 22 }, { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, "Empresas");

  const instrucoes = [
    ["Campo", "Obrigatório", "Descrição", "Valores Aceitos"],
    ["SCI", "Não", "Código interno da empresa", "Texto livre"],
    ["NOME EMPRESARIAL", "Sim", "Razão social da empresa", "Texto livre"],
    ["CNPJ", "Sim", "CNPJ com ou sem formatação", "00.000.000/0000-00"],
    ["IE", "Não", "Inscrição Estadual", "Números"],
    ["MUNICIPIO", "Não", "Município da empresa", "Texto livre"],
    ["TIPO", "Não", "Tipo do estabelecimento", "MATRIZ ou FILIAL"],
    ["EQUIPE", "Sim", "Regime tributário", "LUCRO PRESUMIDO, LUCRO REAL ou SIMPLES NACIONAL"],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInst["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 40 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsInst, "Instruções");

  XLSX.writeFile(wb, "Modelo_Importacao_Empresas.xlsx");
};

export const exportTemplateBeneficios = () => {
  const wb = XLSX.utils.book_new();
  const data = [
    ["CFOP OU NCM", "CST", "cBenef", "Destinatário"],
    ["5102", "00", "SP800046", "Contribuintes"],
    ["84818099", "41", "SP100001", "Não Contribuintes"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 15 }, { wch: 8 }, { wch: 14 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "Benefícios");

  const instrucoes = [
    ["Campo", "Obrigatório", "Descrição", "Valores Aceitos"],
    ["CFOP OU NCM", "Sim", "Código CFOP (4 dígitos) ou NCM (8 dígitos)", "Ex: 5102, 84818099"],
    ["CST", "Não", "Código de Situação Tributária", "Ex: 00, 20, 41"],
    ["cBenef", "Sim", "Código do benefício fiscal", "Ex: SP800046, SP100001"],
    ["Destinatário", "Não", "Tipo de destinatário da operação", "Contribuintes, Não Contribuintes, Órgãos Públicos, Templos e Cultos Religiosos"],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInst["!cols"] = [{ wch: 15 }, { wch: 12 }, { wch: 45 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsInst, "Instruções");

  XLSX.writeFile(wb, "Modelo_Importacao_Beneficios.xlsx");
};
