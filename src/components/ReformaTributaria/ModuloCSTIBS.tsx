import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Search } from "lucide-react";
import { MAPEAMENTO_CST_CLASSTRIB } from "@/constants/tax-tables";

const CST_LABELS: Record<string, { label: string; color: string }> = {
  "000": { label: "Tributação Integral",   color: "bg-red-100 text-red-800 border-red-200" },
  "010": { label: "Alíquotas Uniformes",   color: "bg-blue-100 text-blue-800 border-blue-200" },
  "200": { label: "Alíquota Reduzida",     color: "bg-amber-100 text-amber-800 border-amber-200" },
  "410": { label: "Imunidade",             color: "bg-green-100 text-green-800 border-green-200" },
};

export default function ModuloCSTIBS() {
  const [busca, setBusca] = useState("");
  const [filtroCst, setFiltroCst] = useState<string>("todos");

  const cstOptions = ["todos", "000", "010", "200", "410"];

  const entries = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return Object.entries(MAPEAMENTO_CST_CLASSTRIB)
      .filter(([classtrib, item]) => {
        const matchCst = filtroCst === "todos" || item.cst === filtroCst;
        const matchBusca =
          !q ||
          classtrib.includes(q) ||
          item.cst.includes(q) ||
          item.desc.toLowerCase().includes(q);
        return matchCst && matchBusca;
      })
      .sort((a, b) => a[1].cst.localeCompare(b[1].cst) || a[0].localeCompare(b[0]));
  }, [busca, filtroCst]);

  return (
    <div className="space-y-4">
      {/* Descrição */}
      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800 leading-relaxed">
            O <strong>CST IBS/CBS</strong> (Código de Situação Tributária) identifica o tratamento fiscal de cada operação
            no novo IVA Dual. A <strong>ClassTrib</strong> é o código interno do Comitê Gestor que mapeia cada situação
            para o CST correspondente, conforme a <strong>LC 214/2025</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-52 space-y-1">
          <Label className="text-xs">Buscar por código ou descrição</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Ex: 200003, educação, imunidade…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {cstOptions.map((c) => (
            <button
              key={c}
              onClick={() => setFiltroCst(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                filtroCst === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {c === "todos" ? "Todos" : `CST ${c}`}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">ClassTrib</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">CST</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Situação</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    Nenhum resultado encontrado.
                  </td>
                </tr>
              ) : (
                entries.map(([classtrib, item]) => {
                  const badge = CST_LABELS[item.cst] ?? { label: item.cst, color: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={classtrib} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{classtrib}</td>
                      <td className="px-4 py-2.5 font-mono font-bold">{item.cst}</td>
                      <td className="px-4 py-2.5 text-xs">{item.desc}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
          {entries.length} registro(s) encontrado(s) · Fonte: LC 214/2025 + Comitê Gestor do IBS
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(CST_LABELS).map(([cst, info]) => (
          <div key={cst} className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium ${info.color}`}>
            <span className="font-mono font-bold">{cst}</span>
            <span>·</span>
            <span>{info.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
