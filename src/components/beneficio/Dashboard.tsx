import { useState } from "react";
import { useCbenefStore } from "@/store/cbenefStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, ScrollText, LinkIcon, Unlink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type DetailType = "empresas" | "beneficios" | "comVinculo" | "semVinculo" | null;

const Dashboard = () => {
  const { empresas, beneficios, empresaBeneficios } = useCbenefStore();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<DetailType>(null);

  const empresasComVinculo = empresas.filter(
    (e) => (empresaBeneficios[e.id] || []).length > 0
  );
  const empresasSemVinculo = empresas.filter(
    (e) => (empresaBeneficios[e.id] || []).length === 0
  );

  const stats = [
    {
      title: "Total de Empresas",
      value: empresas.length,
      icon: Building2,
      color: "text-primary",
      type: "empresas" as DetailType,
    },
    {
      title: "Benefícios Cadastrados",
      value: beneficios.length,
      icon: ScrollText,
      color: "text-primary",
      type: "beneficios" as DetailType,
    },
    {
      title: "Empresas com Vínculos",
      value: empresasComVinculo.length,
      icon: LinkIcon,
      color: "text-green-600 dark:text-green-400",
      type: "comVinculo" as DetailType,
    },
    {
      title: "Empresas sem Vínculos",
      value: empresasSemVinculo.length,
      icon: Unlink,
      color: "text-orange-600 dark:text-orange-400",
      type: "semVinculo" as DetailType,
    },
  ];

  const handleCardClick = (type: DetailType) => {
    setDetailType(type);
    setDetailOpen(true);
  };

  const renderDetail = () => {
    switch (detailType) {
      case "empresas":
        return (
          <div className="space-y-2">
            {empresas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>}
            {empresas.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{e.nomeEmpresarial}</p>
                  <p className="text-xs text-muted-foreground">CNPJ: {e.cnpj} — {e.municipio}</p>
                </div>
                <Badge variant="outline" className="text-xs">{e.tipo || "N/A"}</Badge>
              </div>
            ))}
          </div>
        );
      case "beneficios":
        return (
          <div className="space-y-2">
            {beneficios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum benefício cadastrado.</p>}
            {beneficios.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{b.tipo}: {b.cfopOuNcm}</p>
                  <p className="text-xs text-muted-foreground">cBenef: {b.cBenef} — CST/CSOSN: {b.cst}</p>
                </div>
                {b.destinatario && <Badge variant="outline" className="text-xs">{b.destinatario}</Badge>}
              </div>
            ))}
          </div>
        );
      case "comVinculo":
        return (
          <div className="space-y-2">
            {empresasComVinculo.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa com vínculos.</p>}
            {empresasComVinculo.map((e) => {
              const qtd = (empresaBeneficios[e.id] || []).length;
              return (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="font-medium text-sm">{e.nomeEmpresarial}</p>
                    <p className="text-xs text-muted-foreground">CNPJ: {e.cnpj}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-0 text-xs">
                    {qtd} benefício{qtd !== 1 ? "s" : ""}
                  </Badge>
                </div>
              );
            })}
          </div>
        );
      case "semVinculo":
        return (
          <div className="space-y-2">
            {empresasSemVinculo.length === 0 && <p className="text-sm text-muted-foreground">Todas as empresas possuem vínculos.</p>}
            {empresasSemVinculo.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{e.nomeEmpresarial}</p>
                  <p className="text-xs text-muted-foreground">CNPJ: {e.cnpj} — {e.municipio}</p>
                </div>
                <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400">Sem vínculos</Badge>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  const getDialogTitle = () => {
    switch (detailType) {
      case "empresas": return "Todas as Empresas";
      case "beneficios": return "Todos os Benefícios Cadastrados";
      case "comVinculo": return "Empresas com Vínculos";
      case "semVinculo": return "Empresas sem Vínculos";
      default: return "";
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
            onClick={() => handleCardClick(stat.type)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            {renderDetail()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Dashboard;
