import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { TrendingDown } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ANNEX_LABELS,
  FAIXAS_SN,
  MONTH_NAMES,
  REGIME_LABELS,
  RegimeKey,
  SN_REFORMA_TABLES,
  SN_TABLES,
  SimulationInput,
  SimulationResult,
  formatBRL,
  formatPct,
} from "@/lib/tax-engine";

export type ChartDatum = { name: string; SN: number; LP: number; Receita: number };
export type SavingsDatum = { name: string; Economia: number; Acumulado: number; Melhor: "SN" | "LP" };

export interface ResultadoTabProps {
  input: SimulationInput;
  result: SimulationResult;
  t: SimulationResult["totals"];
  enabled: RegimeKey[];
  showSN: boolean;
  showLP: boolean;
  showLR: boolean;
  showIVA: boolean;
  showSNH: boolean;
  isCompare: boolean;
  chartData: ChartDatum[];
  savingsData: SavingsDatum[];
  savingsPct: number;
  chartBarRef: React.RefObject<HTMLDivElement>;
  chartLineRef: React.RefObject<HTMLDivElement>;
  chartSavingsRef: React.RefObject<HTMLDivElement>;
  multiYearResults: { year: number; result: SimulationResult }[];
}

export function ResultadoTab(props: ResultadoTabProps) {
  const {
    input, result, t, enabled,
    showSN, showLP, showLR, showIVA, showSNH, isCompare,
    chartData, savingsData, savingsPct,
    chartBarRef, chartLineRef, chartSavingsRef,
    multiYearResults,
  } = props;

  return (
    <TabsContent value="resultado" className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            {isCompare ? "Comparativo mês a mês" : showSN ? "Imposto mensal — Simples Nacional" : "Imposto mensal — Lucro Presumido"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={chartBarRef} className="h-72 bg-background">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Legend />
                {showSN && <Bar dataKey="SN" fill="hsl(var(--brand))" name="Simples Nacional" />}
                {showLP && <Bar dataKey="LP" fill="hsl(var(--primary))" name="Lucro Presumido" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {isCompare && t.saving > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-brand" />
              Economia mensal e acumulada — total de {formatBRL(t.saving)} ({formatPct(savingsPct, 1)})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Diferença entre o regime mais caro e o regime escolhido em cada mês.
            </p>
          </CardHeader>
          <CardContent>
            <div ref={chartSavingsRef} className="h-72 bg-background">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={savingsData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis yAxisId="left" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Economia" fill="hsl(var(--brand))" name="Economia no mês" />
                  <Line yAxisId="right" type="monotone" dataKey="Acumulado" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} name="Economia acumulada" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {showSN && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Simples Nacional — Detalhamento mensal</CardTitle></CardHeader>
          <CardContent className="overflow-auto max-h-[520px]">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  {["Mês","Receita","RBT12","Fator R","Anexo","Alíq.","DAS","Encargos folha","Total SN"].map((h) => (
                    <th key={h} className="text-right py-2 px-2 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.months.map((m: any) => (
                  <tr key={m.month} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-semibold">{MONTH_NAMES[m.month - 1]}</td>
                    <td className="text-right">{formatBRL(m.revenue)}</td>
                    <td className="text-right">{formatBRL(m.rbt12)}</td>
                    <td className="text-right">{formatPct(m.fatorR)}</td>
                    <td className="text-right">{m.annexApplied}</td>
                    <td className="text-right">{formatPct(m.snRate)}</td>
                    <td className="text-right">{formatBRL(m.snTax)}</td>
                    <td className="text-right">{formatBRL(m.payrollTaxes)}</td>
                    <td className="text-right font-bold">{formatBRL(m.totalSN)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr>
                  <td className="py-2 px-2 font-bold">Total</td>
                  <td className="text-right font-bold">{formatBRL(t.revenue)}</td>
                  <td colSpan={4}></td>
                  <td className="text-right font-bold">{formatBRL(t.snDAS)}</td>
                  <td></td>
                  <td className="text-right font-bold text-brand">{formatBRL(t.snTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {showSN && (() => {
        // Faixa SN aplicada no último mês com receita > 0 (referência atual de cálculo)
        const lastWithRev = [...result.months].reverse().find((mr: any) => mr.revenue > 0) ?? result.months[result.months.length - 1];
        const annexAtual = lastWithRev?.annexApplied ?? input.annex;
        const faixaAtual = lastWithRev?.snFaixa ?? 0;
        const tabela = SN_TABLES[annexAtual];
        return (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">
                Tabela do Simples Nacional — {ANNEX_LABELS[annexAtual]}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Faixa em uso destacada conforme RBT12 atual ({formatBRL(lastWithRev?.rbt12 || 0)}).
              </p>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[520px]">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-2">Faixa</th>
                    <th className="text-right py-2 px-2">RBT12 até</th>
                    <th className="text-right py-2 px-2">Alíquota nominal</th>
                    <th className="text-right py-2 px-2">Parcela a deduzir</th>
                  </tr>
                </thead>
                <tbody>
                  {tabela.map((f: any, i: number) => {
                    const isAtual = i === faixaAtual;
                    return (
                      <tr key={i} className={`border-b border-border/50 ${isAtual ? "bg-brand/15 font-bold" : ""}`}>
                        <td className="py-1.5 px-2">
                          {i + 1}ª {isAtual && <span className="ml-1 text-[10px] uppercase text-brand">em uso</span>}
                        </td>
                        <td className="text-right">{formatBRL(FAIXAS_SN[i])}</td>
                        <td className="text-right">{(f.aliquot * 100).toFixed(2)}%</td>
                        <td className="text-right">{formatBRL(f.deduct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })()}

      {showLR && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Lucro Real — Detalhamento mensal</CardTitle>
            <p className="text-xs text-muted-foreground">
              PIS/COFINS não-cumulativos · Margem: {formatPct(input.lrProfitRate ?? 0.10, 1)}
            </p>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[520px]">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  {["Mês","Receita","IRPJ","Adic.","CSLL","PIS","COFINS","ISS","ICMS","INSS Pat.","Total LR"].map((h) => (
                    <th key={h} className="text-right py-2 px-2 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.months.map((m: any) => (
                  <tr key={m.month} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-semibold">{MONTH_NAMES[m.month - 1]}</td>
                    <td className="text-right">{formatBRL(m.revenue)}</td>
                    <td className="text-right">{formatBRL(m.lrIRPJ)}</td>
                    <td className="text-right">{formatBRL(m.lrAdicional)}</td>
                    <td className="text-right">{formatBRL(m.lrCSLL)}</td>
                    <td className="text-right">{formatBRL(m.lrPIS)}</td>
                    <td className="text-right">{formatBRL(m.lrCOFINS)}</td>
                    <td className="text-right">{formatBRL(m.lrISS)}</td>
                    <td className="text-right">{formatBRL(m.lrICMS)}</td>
                    <td className="text-right">{formatBRL(m.lrINSSPatronal)}</td>
                    <td className="text-right font-bold">{formatBRL(m.lrTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr>
                  <td className="py-2 px-2 font-bold">Total</td>
                  <td className="text-right font-bold">{formatBRL(t.revenue)}</td>
                  <td colSpan={8}></td>
                  <td className="text-right font-bold text-primary">{formatBRL(t.lrTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {showIVA && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">IBS/CBS (IVA-Dual) — Detalhamento mensal</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ano {input.year} · IBS {(t.aliquotaIVA.ibs * 100).toFixed(3)}% · CBS {(t.aliquotaIVA.cbs * 100).toFixed(3)}% · {t.transicao.fase}
            </p>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[520px]">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  {["Mês","Receita","IBS","CBS","Residual","IRPJ+Adic.","CSLL","INSS Pat.","Total IVA"].map((h) => (
                    <th key={h} className="text-right py-2 px-2 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.months.map((m: any) => (
                  <tr key={m.month} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-semibold">{MONTH_NAMES[m.month - 1]}</td>
                    <td className="text-right">{formatBRL(m.revenue)}</td>
                    <td className="text-right">{formatBRL(m.ivaIBS)}</td>
                    <td className="text-right">{formatBRL(m.ivaCBS)}</td>
                    <td className="text-right" title="ICMS/ISS/PIS/COFINS residuais conforme transição">{formatBRL(m.ivaResidual)}</td>
                    <td className="text-right">{formatBRL(m.ivaIRPJ)}</td>
                    <td className="text-right">{formatBRL(m.ivaCSLL)}</td>
                    <td className="text-right">{formatBRL(m.ivaINSSPatronal)}</td>
                    <td className="text-right font-bold">{formatBRL(m.totalIVA)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr>
                  <td className="py-2 px-2 font-bold">Total</td>
                  <td className="text-right font-bold">{formatBRL(t.revenue)}</td>
                  <td colSpan={6}></td>
                  <td className="text-right font-bold text-brand">{formatBRL(t.ivaTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {showSNH && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Simples Nacional Híbrido — Detalhamento mensal</CardTitle>
            <p className="text-xs text-muted-foreground">
              DAS reduzido (sem PIS/COFINS/ICMS/ISS) + IBS e CBS por fora.
            </p>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[520px]">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  {["Mês","Receita","DAS reduzido","IBS","CBS","Encargos folha","Total SNH"].map((h) => (
                    <th key={h} className="text-right py-2 px-2 first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.months.map((m: any) => (
                  <tr key={m.month} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-semibold">{MONTH_NAMES[m.month - 1]}</td>
                    <td className="text-right">{formatBRL(m.revenue)}</td>
                    <td className="text-right">{formatBRL(m.snhDAS)}</td>
                    <td className="text-right">{formatBRL(m.snhIBS)}</td>
                    <td className="text-right">{formatBRL(m.snhCBS)}</td>
                    <td className="text-right">{formatBRL(m.payrollTaxes)}</td>
                    <td className="text-right font-bold">{formatBRL(m.totalSNH)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2">
                <tr>
                  <td className="py-2 px-2 font-bold">Total</td>
                  <td className="text-right font-bold">{formatBRL(t.revenue)}</td>
                  <td colSpan={4}></td>
                  <td className="text-right font-bold text-brand">{formatBRL(t.snhTotal)}</td>
                </tr>
              </tfoot>
            </table>
            {input.year >= 2027 && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Tabela usada: SN Reforma — {SN_REFORMA_TABLES[result.months[0]?.annexApplied || input.annex] && ANNEX_LABELS[result.months[0]?.annexApplied || input.annex]}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {showLP && (() => {
        const reformaLP = input.year >= 2027;
        const headers = reformaLP
          ? ["Mês","Receita","IRPJ","Adic.","CSLL","PIS*","COF*","ISS*","ICMS*","IPI","IBS","CBS","INSS Pat.","Total LP"]
          : ["Mês","Receita","IRPJ","Adicional","CSLL","PIS","COFINS","ISS","ICMS","IPI","INSS Pat.","Total LP"];
        return (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-base">Lucro Presumido — Detalhamento mensal de impostos</CardTitle>
              {reformaLP && (
                <p className="text-xs text-muted-foreground">
                  Reforma incorporada ({input.year}): IBS+CBS sobre receita; PIS/COFINS extintos e ICMS/ISS reduzidos conforme cronograma.
                  <br /><span className="text-[10px]">* valores residuais conforme transição.</span>
                </p>
              )}
            </CardHeader>
            <CardContent className="overflow-auto max-h-[520px]">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="text-right py-2 px-2 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.months.map((m: any) => (
                    <tr key={m.month} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-semibold">{MONTH_NAMES[m.month - 1]}</td>
                      <td className="text-right">{formatBRL(m.revenue)}</td>
                      <td className="text-right">{formatBRL(m.lpIRPJ)}</td>
                      <td className="text-right">{formatBRL(m.lpAdicional)}</td>
                      <td className="text-right">{formatBRL(m.lpCSLL)}</td>
                      <td className="text-right">{formatBRL(m.lpPIS)}</td>
                      <td className="text-right">{formatBRL(m.lpCOFINS)}</td>
                      <td className="text-right">{formatBRL(m.lpISS)}</td>
                      <td className="text-right" title={m.lpICMSCredito ? `Crédito ICMS: ${formatBRL(m.lpICMSCredito)}` : undefined}>{formatBRL(m.lpICMS)}</td>
                      <td className="text-right" title={m.lpIPICredito ? `Crédito IPI: ${formatBRL(m.lpIPICredito)}` : undefined}>{formatBRL(m.lpIPI)}</td>
                      {reformaLP && <td className="text-right text-brand">{formatBRL(m.lpIBS)}</td>}
                      {reformaLP && <td className="text-right text-brand">{formatBRL(m.lpCBS)}</td>}
                      <td className="text-right">{formatBRL(m.lpINSSPatronal)}</td>
                      <td className="text-right font-bold">{formatBRL(m.totalLP)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr>
                    <td className="py-2 px-2 font-bold">Total</td>
                    <td className="text-right font-bold">{formatBRL(t.revenue)}</td>
                    <td colSpan={reformaLP ? 11 : 9}></td>
                    <td className="text-right font-bold text-primary">{formatBRL(t.lpTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        );
      })()}

      {isCompare && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Comparativo consolidado</CardTitle>
            <p className="text-xs text-muted-foreground">
              Totais por regime ativo · Melhor regime: <strong>{REGIME_LABELS[t.bestRegime]}</strong> · Economia: <strong>{formatBRL(t.saving)}</strong>
            </p>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[520px]">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="text-left py-2 px-2">Mês</th>
                  <th className="text-right py-2 px-2">Receita</th>
                  {enabled.map((r) => (
                    <th key={r} className="text-right py-2 px-2">{REGIME_LABELS[r]}</th>
                  ))}
                  <th className="text-right py-2 px-2">Mais econômico</th>
                </tr>
              </thead>
              <tbody>
                {result.months.map((m: any) => {
                  const vals: Record<RegimeKey, number> = {
                    SN: m.totalSN, LP: m.totalLP, LR: m.totalLR, IVA: m.totalIVA, SNH: m.totalSNH,
                  };
                  const best = enabled.reduce((acc, r) => vals[r] < vals[acc] ? r : acc, enabled[0]);
                  return (
                    <tr key={m.month} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-semibold">{MONTH_NAMES[m.month - 1]}</td>
                      <td className="text-right">{formatBRL(m.revenue)}</td>
                      {enabled.map((r) => (
                        <td key={r} className={`text-right ${r === best ? "font-bold text-success" : ""}`}>
                          {formatBRL(vals[r])}
                        </td>
                      ))}
                      <td className="text-right font-semibold">{best}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2">
                <tr>
                  <td className="py-2 px-2 font-bold">Total</td>
                  <td className="text-right font-bold">{formatBRL(t.revenue)}</td>
                  {enabled.map((r) => {
                    const totals: Record<RegimeKey, number> = {
                      SN: t.snTotal, LP: t.lpTotal, LR: t.lrTotal, IVA: t.ivaTotal, SNH: t.snhTotal,
                    };
                    return (
                      <td key={r} className={`text-right font-bold ${r === t.bestRegime ? "text-success" : ""}`}>
                        {formatBRL(totals[r])}
                      </td>
                    );
                  })}
                  <td className="text-right font-bold">{t.bestRegime}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {showSN && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Evolução do Fator R e alíquota efetiva</CardTitle></CardHeader>
          <CardContent>
            <div ref={chartLineRef} className="h-64 bg-background">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.months.map((m: any) => ({
                  name: MONTH_NAMES[m.month - 1],
                  "Fator R": +(m.fatorR * 100).toFixed(2),
                  "Alíq. SN": +(m.snRate * 100).toFixed(2),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="Fator R" stroke="hsl(var(--brand))" strokeWidth={2} />
                  <Line type="monotone" dataKey="Alíq. SN" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
      {multiYearResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Detalhamento por ano da Reforma</CardTitle>
            <p className="text-xs text-muted-foreground">
              Cada ano usa os mesmos lançamentos do ano-base ({input.year}), recalculados conforme cronograma LC 214/2025 e parâmetros de IBS/CBS.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {multiYearResults.map(({ year, result: r }) => {
              const tt = r.totals;
              return (
                <div key={year} className="rounded-lg border border-border">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 border-b bg-muted/30">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Ano {year}</div>
                      <div className="text-sm font-display font-bold">
                        {tt.transicao.fase} · IBS {(tt.aliquotaIVA.ibs * 100).toFixed(2)}% · CBS {(tt.aliquotaIVA.cbs * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Melhor regime: </span>
                      <strong className="text-brand">{REGIME_LABELS[tt.bestRegime]}</strong>
                    </div>
                  </div>
                  <div className="overflow-auto max-h-[360px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="text-left py-2 px-2">Mês</th>
                          <th className="text-right py-2 px-2">Receita</th>
                          {enabled.map((rk) => (
                            <th key={rk} className="text-right py-2 px-2">{REGIME_LABELS[rk]}</th>
                          ))}
                          <th className="text-right py-2 px-2">Mais econômico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.months.map((m: any) => {
                          const vals: Record<RegimeKey, number> = {
                            SN: m.totalSN, LP: m.totalLP, LR: m.totalLR, IVA: m.totalIVA, SNH: m.totalSNH,
                          };
                          const best = enabled.reduce((acc, rk) => vals[rk] < vals[acc] ? rk : acc, enabled[0]);
                          return (
                            <tr key={m.month} className="border-b border-border/50">
                              <td className="py-1.5 px-2 font-semibold">{MONTH_NAMES[m.month - 1]}</td>
                              <td className="text-right">{formatBRL(m.revenue)}</td>
                              {enabled.map((rk) => (
                                <td key={rk} className={`text-right ${rk === best ? "font-bold text-success" : ""}`}>
                                  {formatBRL(vals[rk])}
                                </td>
                              ))}
                              <td className="text-right font-semibold">{best}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2">
                        <tr>
                          <td className="py-2 px-2 font-bold">Total {year}</td>
                          <td className="text-right font-bold">{formatBRL(tt.revenue)}</td>
                          {enabled.map((rk) => {
                            const totals: Record<RegimeKey, number> = {
                              SN: tt.snTotal, LP: tt.lpTotal, LR: tt.lrTotal, IVA: tt.ivaTotal, SNH: tt.snhTotal,
                            };
                            return (
                              <td key={rk} className={`text-right font-bold ${rk === tt.bestRegime ? "text-success" : ""}`}>
                                {formatBRL(totals[rk])}
                              </td>
                            );
                          })}
                          <td className="text-right font-bold">{tt.bestRegime}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
}
