import { useState } from "react";
import { Calculator, FileCode, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ModuloCSTIBS from "@/components/ReformaTributaria/ModuloCSTIBS";
import ModuloImpostoSeletivo from "@/components/ReformaTributaria/ModuloImpostoSeletivo";
import type { AliquotasCustom } from "@/components/ReformaTributaria/ModuloImpostoSeletivo";

const DEFAULT_ALIQUOTAS: AliquotasCustom = { ibsRef: 17.70, cbsRef: 8.80, isOverrides: {} };

function loadAliquotas(): AliquotasCustom {
  try {
    const saved = localStorage.getItem("econ:aliquotas-custom");
    return saved ? { ...DEFAULT_ALIQUOTAS, ...JSON.parse(saved) } : DEFAULT_ALIQUOTAS;
  } catch {
    return DEFAULT_ALIQUOTAS;
  }
}

export default function ReformaTributaria() {
  const [aliquotasCustom] = useState<AliquotasCustom>(loadAliquotas);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold">Reforma Tributária</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            CST IBS/CBS e Imposto Seletivo — LC 214/2025.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cst">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="cst" className="gap-1.5">
            <FileCode className="h-3.5 w-3.5" /> Mapeamento CST
          </TabsTrigger>
          <TabsTrigger value="is" className="gap-1.5">
            <Calculator className="h-3.5 w-3.5" /> Imposto Seletivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cst" className="mt-6">
          <ModuloCSTIBS />
        </TabsContent>

        <TabsContent value="is" className="mt-6">
          <ModuloImpostoSeletivo aliquotasCustom={aliquotasCustom} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
