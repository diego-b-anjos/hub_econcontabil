import { Kpi } from "./helpers";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatBRL, formatPct, type RegimeKey } from "@/lib/tax-engine";

export type KpisRowProps = {
  isCompare: boolean;
  showSN: boolean;
  showLP: boolean;
  showLR: boolean;
  bestRegime: RegimeKey;
  revenue: number;
  snTotal: number;
  lpTotal: number;
  lrTotal: number;
  saving: number;
  snBurden: number;
  lpBurden: number;
  lrBurden: number;
  savingsPct: number;
};

export function KpisRow(p: KpisRowProps) {
  return (
    <div className={`grid gap-4 ${p.isCompare ? "md:grid-cols-4" : "md:grid-cols-2"}`}>
      <Kpi label="Receita anual" value={formatBRL(p.revenue)} />
      {p.showSN && (
        <Kpi
          label="Total Simples Nacional"
          value={formatBRL(p.snTotal)}
          sub={p.revenue > 0 ? `Carga: ${formatPct(p.snBurden, 2)}` : undefined}
          highlight={p.isCompare && p.bestRegime === "SN"}
        />
      )}
      {p.showLP && (
        <Kpi
          label="Total Lucro Presumido"
          value={formatBRL(p.lpTotal)}
          sub={p.revenue > 0 ? `Carga: ${formatPct(p.lpBurden, 2)}` : undefined}
          highlight={p.isCompare && p.bestRegime === "LP"}
        />
      )}
      {p.showLR && (
        <Kpi
          label="Total Lucro Real"
          value={formatBRL(p.lrTotal)}
          sub={p.revenue > 0 ? `Carga: ${formatPct(p.lrBurden, 2)}` : undefined}
          highlight={p.isCompare && p.bestRegime === "LR"}
        />
      )}
      {p.isCompare && (
        <Kpi
          label={p.bestRegime === "SN" ? "Economia no Simples" : "Economia no Lucro Pres."}
          value={formatBRL(p.saving)}
          sub={`${formatPct(p.savingsPct, 1)} sobre o pior cenário`}
          icon={p.bestRegime === "SN" ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
          accent
        />
      )}
    </div>
  );
}
