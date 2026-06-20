import { useState, type RefObject } from "react";
import html2canvas from "html2canvas";
import { exportPDF, exportXLSX, type ExportLayout, type ExportSections } from "@/lib/exporters";
import type { SimulationInput, SimulationResult } from "@/lib/tax-engine";

export type ExportMeta = {
  simulationName: string;
  clientName?: string;
  companyName?: string;
  cnpj?: string;
  contadorName: string;
  year: number;
};

export function useExportLayout(opts: {
  input: SimulationInput;
  result: SimulationResult;
  meta: ExportMeta;
  isCompare: boolean;
  chartBarRef: RefObject<HTMLDivElement>;
  chartSavingsRef: RefObject<HTMLDivElement>;
}) {
  const { input, result, meta, isCompare, chartBarRef, chartSavingsRef } = opts;

  const [exportOpen, setExportOpen] = useState(false);
  const [expFormat, setExpFormat] = useState<"pdf" | "xlsx">("pdf");
  const [expLayout, setExpLayout] = useState<ExportLayout>("resumido");
  const [expMonths, setExpMonths] = useState<number>(0);
  const [expSections, setExpSections] = useState<Required<ExportSections>>({
    identificacao: true,
    resumo: true,
    recomendacao: true,
    graficos: false,
    tabelaMensal: true,
    detalhamentoSN: true,
    detalhamentoLP: true,
    baseLegal: true,
    cabecalhoDeclaracao: false,
    textoDeclaratorio: false,
    tabelaFaturamento: false,
    assinaturas: false,
  });

  const [decCidade, setDecCidade] = useState("");
  const [decSocioNome, setDecSocioNome] = useState("");
  const [decSocioCPF, setDecSocioCPF] = useState("");
  const [decContadorNome, setDecContadorNome] = useState("");
  const [decContadorCPF, setDecContadorCPF] = useState("");
  const [decContadorCRC, setDecContadorCRC] = useState("");

  const applyLayoutDefaults = (lay: ExportLayout) => {
    setExpLayout(lay);
    if (lay === "declaracao") {
      setExpSections({
        identificacao: false, resumo: false, recomendacao: false, graficos: false,
        tabelaMensal: false, detalhamentoSN: false, detalhamentoLP: false, baseLegal: false,
        cabecalhoDeclaracao: true, textoDeclaratorio: true, tabelaFaturamento: true, assinaturas: true,
      });
    } else if (lay === "resumido") {
      setExpSections({
        identificacao: true, resumo: true, recomendacao: true, graficos: false,
        tabelaMensal: true, detalhamentoSN: false, detalhamentoLP: false, baseLegal: false,
        cabecalhoDeclaracao: false, textoDeclaratorio: false, tabelaFaturamento: false, assinaturas: false,
      });
    } else {
      setExpSections({
        identificacao: true, resumo: true, recomendacao: true, graficos: true,
        tabelaMensal: false, detalhamentoSN: true, detalhamentoLP: true, baseLegal: true,
        cabecalhoDeclaracao: false, textoDeclaratorio: false, tabelaFaturamento: false, assinaturas: false,
      });
    }
  };

  const captureRef = async (ref: RefObject<HTMLDivElement>): Promise<string | undefined> => {
    if (!ref.current) return undefined;
    try {
      const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2 });
      return canvas.toDataURL("image/png");
    } catch { return undefined; }
  };

  const runExport = async () => {
    const charts: { title: string; image: string }[] = [];
    if (expSections.graficos) {
      const bar = await captureRef(chartBarRef);
      if (bar) charts.push({ title: "Comparativo mensal por regime", image: bar });
      const sav = await captureRef(chartSavingsRef);
      if (sav && isCompare) charts.push({ title: "Economia mensal e acumulada", image: sav });
    }
    const exportOpts = {
      charts,
      monthsLimit: expMonths > 0 ? expMonths : undefined,
      sections: expSections,
      cidadeEmissao: decCidade || undefined,
      socioNome: decSocioNome || undefined,
      socioCPF: decSocioCPF || undefined,
      contadorNome: decContadorNome || undefined,
      contadorCPF: decContadorCPF || undefined,
      contadorCRC: decContadorCRC || undefined,
    };
    if (expFormat === "pdf") await exportPDF(input, result, meta, expLayout, exportOpts);
    else exportXLSX(input, result, meta, expLayout, exportOpts);
    setExportOpen(false);
  };

  return {
    exportOpen, setExportOpen,
    expFormat, setExpFormat,
    expLayout, applyLayoutDefaults,
    expMonths, setExpMonths,
    expSections, setExpSections,
    decCidade, setDecCidade,
    decSocioNome, setDecSocioNome,
    decSocioCPF, setDecSocioCPF,
    decContadorNome, setDecContadorNome,
    decContadorCPF, setDecContadorCPF,
    decContadorCRC, setDecContadorCRC,
    runExport,
  };
}
