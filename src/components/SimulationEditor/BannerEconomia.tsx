import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatBRL, formatPct, type RegimeKey } from "@/lib/tax-engine";

export type BannerEconomiaProps = {
  bestRegime: RegimeKey;
  saving: number;
  savingsPct: number;
  monthlyAvgSaving: number;
  showSN: boolean;
  showLP: boolean;
  snBurden: number;
  lpBurden: number;
  snTotal: number;
  lpTotal: number;
};

export function BannerEconomia(p: BannerEconomiaProps) {
  const isSN = p.bestRegime === "SN";
  return (
    <Card className="bg-gradient-dark text-primary-foreground border-transparent overflow-hidden relative">
      <CardContent className="p-6 md:p-8">
        <div className="grid md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-2">
            <div className="text-xs uppercase tracking-widest font-semibold text-brand flex items-center gap-2">
              {isSN ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              Economia anual estimada
            </div>
            <div className="text-4xl md:text-5xl font-display font-bold text-brand leading-tight">
              {formatBRL(p.saving)}
            </div>
            <p className="text-sm md:text-base text-primary-foreground/85 max-w-xl">
              Optando pelo <strong className="text-brand">{isSN ? "Simples Nacional" : "Lucro Presumido"}</strong>,
              sua empresa economiza <strong>{formatPct(p.savingsPct, 1)}</strong> em impostos no ano —
              uma média de <strong>{formatBRL(p.monthlyAvgSaving)}/mês</strong>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {p.showSN && (
              <div className={`rounded-lg p-3 ${isSN ? "bg-brand text-foreground" : "bg-white/5"}`}>
                <div className={`text-[10px] uppercase font-semibold tracking-wider ${isSN ? "text-foreground/70" : "text-primary-foreground/60"}`}>Carga SN</div>
                <div className="text-lg font-display font-bold mt-1">{formatPct(p.snBurden, 2)}</div>
                <div className={`text-[11px] mt-0.5 ${isSN ? "text-foreground/70" : "text-primary-foreground/60"}`}>{formatBRL(p.snTotal)}</div>
              </div>
            )}
            {p.showLP && (
              <div className={`rounded-lg p-3 ${p.bestRegime === "LP" ? "bg-brand text-foreground" : "bg-white/5"}`}>
                <div className={`text-[10px] uppercase font-semibold tracking-wider ${p.bestRegime === "LP" ? "text-foreground/70" : "text-primary-foreground/60"}`}>Carga LP</div>
                <div className="text-lg font-display font-bold mt-1">{formatPct(p.lpBurden, 2)}</div>
                <div className={`text-[11px] mt-0.5 ${p.bestRegime === "LP" ? "text-foreground/70" : "text-primary-foreground/60"}`}>{formatBRL(p.lpTotal)}</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
