import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export function FiltrosExportacaoCard({
  excluirAtrasadas,
  setExcluirAtrasadas,
}: {
  excluirAtrasadas: boolean;
  setExcluirAtrasadas: (v: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Filtros de exportação</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={excluirAtrasadas} onCheckedChange={(v) => setExcluirAtrasadas(!!v)} />
          Não exportar tarefas atrasadas (Acessórias) — recalcula percentuais
        </label>
        <p className="text-[11px] text-muted-foreground">
          Quando ativado, todas as métricas e tabelas de Acessórias (KPIs, pontualidade, obrigações, responsáveis, empresas críticas) são recalculadas desconsiderando as tarefas com status atrasada.
        </p>
      </CardContent>
    </Card>
  );
}
