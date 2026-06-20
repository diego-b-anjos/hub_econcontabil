import { Empresa, BeneficioFiscal } from "@/types/cbenef";

export const initialEmpresas: Empresa[] = [
  { id: "1", sci: "41", nomeEmpresarial: "DAMASCO", cnpj: "03.206.517/0001-20", ie: "115.269.093.114", municipio: "São Paulo", tipo: "MATRIZ", equipe: "LUCRO PRESUMIDO" },
  { id: "2", sci: "693", nomeEmpresarial: "LINE LIFE CARDIOVASCULAR COM.", cnpj: "01.197.835/0001-46", ie: "114.659.720.116", municipio: "São Paulo", tipo: "MATRIZ", equipe: "LUCRO PRESUMIDO" },
  { id: "3", sci: "855", nomeEmpresarial: "CARTON-BOX INDUSTRIA E COMERCIO LTDA", cnpj: "03.339.077/0001-89", ie: "708.052.549.114", municipio: "Valinhos", tipo: "MATRIZ", equipe: "LUCRO PRESUMIDO" },
  { id: "4", sci: "965", nomeEmpresarial: "C14 COMERCIO DE VEICULOS LTDA", cnpj: "45.718.596/0001-06", ie: "708.277.452.110", municipio: "Valinhos", tipo: "MATRIZ", equipe: "LUCRO PRESUMIDO" },
];

export const initialBeneficios: BeneficioFiscal[] = [
  { id: "1", cfopOuNcm: "5915", naturezaOperacao: "Remessa de mercadoria ou bem para conserto ou reparo", cst: "41", csosn: "", cBenef: "SP070090", tipo: "CFOP", destinatario: "" },
  { id: "2", cfopOuNcm: "6915", naturezaOperacao: "Remessa de mercadoria ou bem para conserto ou reparo", cst: "41", csosn: "", cBenef: "SP070090", tipo: "CFOP", destinatario: "" },
  { id: "3", cfopOuNcm: "5916", naturezaOperacao: "Retorno de mercadoria ou bem recebido para conserto ou reparo", cst: "41", csosn: "", cBenef: "SP070100", tipo: "CFOP", destinatario: "" },
  { id: "4", cfopOuNcm: "6916", naturezaOperacao: "Retorno de mercadoria ou bem recebido para conserto ou reparo", cst: "41", csosn: "", cBenef: "SP070100", tipo: "CFOP", destinatario: "" },
  { id: "5", cfopOuNcm: "5908", naturezaOperacao: "Remessa de bem por conta de contrato de comodato ou locação", cst: "41", csosn: "", cBenef: "SP070090", tipo: "CFOP", destinatario: "" },
  { id: "6", cfopOuNcm: "6908", naturezaOperacao: "Remessa de bem por conta de contrato de comodato ou locação", cst: "41", csosn: "", cBenef: "SP070090", tipo: "CFOP", destinatario: "" },
  { id: "7", cfopOuNcm: "5909", naturezaOperacao: "Retorno de bem recebido por conta de contrato de comodato ou locação", cst: "41", csosn: "", cBenef: "SP070100", tipo: "CFOP", destinatario: "" },
  { id: "8", cfopOuNcm: "6909", naturezaOperacao: "Retorno de bem recebido por conta de contrato de comodato ou locação", cst: "41", csosn: "", cBenef: "SP070100", tipo: "CFOP", destinatario: "" },
  { id: "9", cfopOuNcm: "5912", naturezaOperacao: "Remessa de mercadoria ou bem para demonstração, mostruário ou treinamento", cst: "50", csosn: "", cBenef: "SP053190", tipo: "CFOP", destinatario: "" },
  { id: "10", cfopOuNcm: "6912", naturezaOperacao: "Remessa de mercadoria ou bem para demonstração, mostruário ou treinamento", cst: "50", csosn: "", cBenef: "SP053190", tipo: "CFOP", destinatario: "" },
  { id: "11", cfopOuNcm: "5913", naturezaOperacao: "Retorno de mercadoria ou bem recebido para demonstração ou mostruário", cst: "50", csosn: "", cBenef: "SP053190", tipo: "CFOP", destinatario: "" },
  { id: "12", cfopOuNcm: "6913", naturezaOperacao: "Retorno de mercadoria ou bem recebido para demonstração ou mostruário", cst: "50", csosn: "", cBenef: "SP053190", tipo: "CFOP", destinatario: "" },
  { id: "13", cfopOuNcm: "5914", naturezaOperacao: "Remessa de mercadoria ou bem para exposição ou feira", cst: "40", csosn: "", cBenef: "SP010330", tipo: "CFOP", destinatario: "" },
  { id: "14", cfopOuNcm: "6914", naturezaOperacao: "Remessa de mercadoria ou bem para exposição ou feira", cst: "40", csosn: "", cBenef: "SP010330", tipo: "CFOP", destinatario: "" },
  { id: "15", cfopOuNcm: "5901", naturezaOperacao: "Remessa para industrialização por encomenda", cst: "50", csosn: "", cBenef: "SP054020", tipo: "CFOP", destinatario: "" },
  { id: "16", cfopOuNcm: "6901", naturezaOperacao: "Remessa para industrialização por encomenda", cst: "50", csosn: "", cBenef: "SP054020", tipo: "CFOP", destinatario: "" },
  { id: "17", cfopOuNcm: "5110", naturezaOperacao: "Venda de mercadoria destinada à Zona Franca de Manaus", cst: "40", csosn: "", cBenef: "SP010840", tipo: "CFOP", destinatario: "" },
  { id: "18", cfopOuNcm: "6110", naturezaOperacao: "Venda de mercadoria destinada à Zona Franca de Manaus", cst: "40", csosn: "", cBenef: "SP010840", tipo: "CFOP", destinatario: "" },
  { id: "19", cfopOuNcm: "90181980", naturezaOperacao: "Outros", cst: "40", csosn: "", cBenef: "SP010140", tipo: "NCM", destinatario: "" },
  { id: "20", cfopOuNcm: "90183922", naturezaOperacao: "Cateteres de poli(cloreto de vinila), para embolectomia arterial", cst: "40", csosn: "", cBenef: "SP010140", tipo: "NCM", destinatario: "" },
  { id: "21", cfopOuNcm: "90183929", naturezaOperacao: "Outros", cst: "40", csosn: "", cBenef: "SP010140", tipo: "NCM", destinatario: "" },
  { id: "22", cfopOuNcm: "90189099", naturezaOperacao: "Outros", cst: "40", csosn: "", cBenef: "SP010140", tipo: "NCM", destinatario: "" },
  { id: "23", cfopOuNcm: "90219080", naturezaOperacao: "Outros", cst: "40", csosn: "", cBenef: "SP010140", tipo: "NCM", destinatario: "" },
];
