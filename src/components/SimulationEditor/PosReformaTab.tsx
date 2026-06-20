import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Scale, TrendingUp } from "lucide-react";
import { REGIME_LABELS, SimulationInput, formatBRL, formatPct } from "@/lib/tax-engine";
import {
  ANO_PLENO,
  projecaoTransicao,
  projetarPosReforma,
} from "@/lib/reforma-engine";

export interface PosReformaTabProps {
  input: SimulationInput;
}

export function PosReformaTab({ input }: PosReformaTabProps) {
  const projecao = useMemo(() => projetarPosReforma({ input, yearAlvo: ANO_PLENO }), [input]);
  const serie = useMemo(
    () => projecaoTransicao(input, { fromYear: 2026, toYear: 2033, regimeAtual: projecao.regimeAtual }),
    [input, projecao.regimeAtual],
  );

  const {
    aliquotaIVA,
    transicao,
    cargaAtual,
    cargaPos,
    delta,
    deltaPct,
    regimeAtual,
    resultAtual,
    resultPos,
  } = projecao;

  const burdenAtual = resultAtual.totals.revenue > 0 ? cargaAtual / resultAtual.totals.revenue : 0;
  const burdenPos = resultPos.totals.revenue > 0 ? cargaPos / resultPos.totals.revenue : 0;

  const barData = serie.map((p) => ({
    name: String(p.year),
    "IVA Pós-Reforma": Math.round(p.cargaIVA),
    [`Atual (${REGIME_LABELS[regimeAtual]})`]: Math.round(p.cargaAtual),
  }));

  const lineData = serie.map((p) => ({
    name: String(p.year),
    IBS: +(p.ibs * 100).toFixed(2),
    CBS: +(p.cbs * 100).toFixed(2),
    Total: +((p.ibs + p.cbs) * 100).toFixed(2),
  }));

  const piorouMuito = deltaPct > 0.1;
  const melhorouMuito = deltaPct < -0.1;

  return (
    <TabsContent value="pos-reforma" className="mt-4 space-y-4">
      <Card className="border-brand/40 bg-brand/5">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Scale className="w-4 h-4 text-brand" />
            Projeção Pós-Reforma {ANO_PLENO} — IVA-Dual pleno (LC 214/2025)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Mesmo cenário ({input.months.length} meses, receita {formatBRL(resultAtual.totals.revenue)}) projetado para o regime IBS+CBS pleno.
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-600 font-semibold">IBS {formatPct(aliquotaIVA.ibs)}</span>
            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 font-semibold">CBS {formatPct(aliquotaIVA.cbs)}</span>
            <span className="px-2 py-1 rounded bg-muted text-muted-foreground">Fase: {transicao.fase}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Carga atual ({REGIME_LABELS[regimeAtual]})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{formatBRL(cargaAtual)}</div>
            <div className="text-xs text-muted-foreground">Carga sobre receita: {formatPct(burdenAtual)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Carga pós-reforma (IVA-Dual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{formatBRL(cargaPos)}</div>
            <div className="text-xs text-muted-foreground">Carga sobre receita: {formatPct(burdenPos)}</div>
          </CardContent>
        </Card>

        <Card className={delta > 0 ? "border-destructive/40" : delta < 0 ? "border-success/40" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              {delta > 0 ? <ArrowUp className="w-3 h-3 text-destructive" /> : <ArrowDown className="w-3 h-3 text-success" />}
              Variação (Δ vs atual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-display font-bold ${delta > 0 ? "text-destructive" : delta < 0 ? "text-success" : ""}`}>
              {delta >= 0 ? "+" : ""}{formatBRL(delta)}
            </div>
            <div className="text-xs text-muted-foreground">
              {deltaPct >= 0 ? "+" : ""}{formatPct(deltaPct)}
              {piorouMuito && " — atenção: aumento > 10%"}
              {melhorouMuito && " — economia > 10%"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand" />
            Carga ano a ano — atual × IVA-Dual (2026–2033)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 bg-background">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number | string) => formatBRL(Number(v))} />
                <Legend />
                <Bar dataKey={`Atual (${REGIME_LABELS[regimeAtual]})`} fill="hsl(var(--primary))" />
                <Bar dataKey="IVA Pós-Reforma" fill="hsl(var(--brand))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Evolução das alíquotas IBS+CBS na transição (%)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 bg-background">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                <Tooltip formatter={(v: number | string) => `${Number(v).toFixed(2)}%`} />
                <Legend />
                <Line type="monotone" dataKey="IBS" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="CBS" stroke="hsl(var(--brand))" strokeWidth={2} />
                <Line type="monotone" dataKey="Total" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
