import { useState } from "react";
import { Building2, ScrollText, FileText, HelpCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Dashboard from "@/components/beneficio/Dashboard";
import EmpresasTab from "@/components/beneficio/EmpresasTab";
import BeneficiosTab from "@/components/beneficio/BeneficiosTab";
import RelatoriosTab from "@/components/beneficio/RelatoriosTab";
import GuiaTab from "@/components/beneficio/GuiaTab";
import { ActiveClientFilterChip } from "@/components/ActiveClientFilterChip";

const BeneficioFiscal = () => {
  const [activeTab, setActiveTab] = useState("empresas");

  return (
    <div className="space-y-6 p-6">
      <ActiveClientFilterChip />
      <div>
        <h1 className="text-2xl font-bold">Benefício Fiscal Master</h1>
        <p className="text-muted-foreground mt-1">
          Gestão completa de benefícios fiscais cBenef — Portaria SRE 70/2025.
        </p>
      </div>

      <Dashboard />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex flex-wrap gap-1">
          <TabsTrigger value="empresas" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="beneficios" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Benefícios Fiscais
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="guia" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Guia de Uso
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="mt-4">
          <EmpresasTab />
        </TabsContent>
        <TabsContent value="beneficios" className="mt-4">
          <BeneficiosTab />
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4">
          <RelatoriosTab />
        </TabsContent>
        <TabsContent value="guia" className="mt-4">
          <GuiaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BeneficioFiscal;
