import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyInput } from "@/components/MoneyInput";
import { PercentInput } from "@/components/PercentInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  ALIQ_REFERENCIA,
  ANNEX_LABELS,
  Annex,
  REGIME_LABELS,
  RegimeKey,
  SimulationInput,
  SimulationResult,
  TRANSICAO_REFORMA,
  formatBRL,
} from "@/lib/tax-engine";

export type ClientOption = { id: string; name: string; cnpj?: string | null };
import { Prev12Breakdown } from "./helpers";

export interface ParametrosTabProps {
  input: SimulationInput;
  setInput: React.Dispatch<React.SetStateAction<SimulationInput>>;
  enabled: RegimeKey[];
  toggleRegime: (k: RegimeKey, v: boolean) => void;
  showSN: boolean;
  showLP: boolean;
  showLR: boolean;
  showIVA: boolean;
  showSNH: boolean;
  multiYears: number[];
  setMultiYears: (v: number[]) => void;
  toggleMultiYear: (y: number, v: boolean) => void;
  multiYearResults: { year: number; result: SimulationResult }[];
  name: string;
  setName: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  clients: ClientOption[];
  setNewClientOpen: (v: boolean) => void;
  setAnnex: (a: Annex) => void;
  setPresumption: (rate: number) => void;
}

export function ParametrosTab(props: ParametrosTabProps) {
  const {
    input, setInput, enabled, toggleRegime,
    showSN, showLP, showLR, showIVA, showSNH,
    multiYears, setMultiYears, toggleMultiYear, multiYearResults,
    name, setName, clientId, setClientId, clients, setNewClientOpen,
    setAnnex, setPresumption,
  } = props;

  return (
    <TabsContent value="parametros" className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Regimes a comparar</CardTitle>
          <p className="text-xs text-muted-foreground">
            Marque os regimes que deseja calcular e comparar lado a lado. Pelo menos um precisa estar ativo.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              { k: "SN",  title: "Simples Nacional",         desc: "Apuração via DAS conforme anexo e RBT12." },
              { k: "LP",  title: "Lucro Presumido",          desc: "IRPJ/CSLL/PIS/COFINS/ICMS/ISS sobre presunção." },
              { k: "LR",  title: "Lucro Real",               desc: "IRPJ/CSLL sobre lucro efetivo; PIS/COFINS não-cumulativos." },
              { k: "IVA", title: "IBS/CBS (IVA-Dual)",       desc: "Reforma LC 214/2025: IBS+CBS conforme ano." },
              { k: "SNH", title: "Simples Nacional Híbrido", desc: "DAS reduzido + IBS/CBS por fora." },
            ] as { k: RegimeKey; title: string; desc: string }[]).map((opt) => {
              const checked = enabled.includes(opt.k);
              return (
                <Label
                  key={opt.k}
                  htmlFor={`reg-${opt.k}`}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <Checkbox
                    id={`reg-${opt.k}`}
                    checked={checked}
                    onCheckedChange={(v) => toggleRegime(opt.k, !!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-sm">{opt.title}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                </Label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {(showIVA || showSNH) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Reforma Tributária — IBS/CBS</CardTitle>
            <p className="text-xs text-muted-foreground">
              Parâmetros aplicados ao ano-base <strong>{input.year}</strong>:{" "}
              fase <strong>{(TRANSICAO_REFORMA[input.year] ?? TRANSICAO_REFORMA[2033]).fase}</strong>.
              Alíquotas de referência (2033): IBS {ALIQ_REFERENCIA.ibs}% + CBS {ALIQ_REFERENCIA.cbs}% = {ALIQ_REFERENCIA.ibs + ALIQ_REFERENCIA.cbs}%.
            </p>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Alíquota de referência IBS (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={input.reforma?.ibsRefOverride ?? ALIQ_REFERENCIA.ibs}
                onChange={(e) =>
                  setInput({
                    ...input,
                    reforma: { ...(input.reforma || {}), ibsRefOverride: Number(e.target.value) },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Padrão estimado: {ALIQ_REFERENCIA.ibs}%. Ajuste conforme regulamentação oficial do CONFAZ.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Alíquota de referência CBS (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={input.reforma?.cbsRefOverride ?? ALIQ_REFERENCIA.cbs}
                onChange={(e) =>
                  setInput({
                    ...input,
                    reforma: { ...(input.reforma || {}), cbsRefOverride: Number(e.target.value) },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Padrão estimado: {ALIQ_REFERENCIA.cbs}%. Total IVA-Dual estimado: 26,5%.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Redução LC 214/2025</Label>
              <PercentInput
                value={input.reforma?.reducaoLC214 ?? 0}
                onValueChange={(v) =>
                  setInput({ ...input, reforma: { ...(input.reforma || {}), reducaoLC214: v } })
                }
              />
              <p className="text-xs text-muted-foreground">
                Ex.: 60% (educação/saúde), 100% (cesta básica), 0% (regra geral).
              </p>
            </div>
            <div className="space-y-1.5 flex flex-col">
              <Label>Aplicar alíquota cheia (ignorar transição)</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  id="aliq-cheia"
                  checked={!!input.reforma?.aliquotaCheia}
                  onCheckedChange={(v) =>
                    setInput({ ...input, reforma: { ...(input.reforma || {}), aliquotaCheia: v } })
                  }
                />
                <Label htmlFor="aliq-cheia" className="font-normal text-sm cursor-pointer">
                  Forçar IBS+CBS plenos (cenário 2033)
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start mt-2"
                onClick={() =>
                  setInput({
                    ...input,
                    reforma: {
                      ...(input.reforma || {}),
                      ibsRefOverride: undefined,
                      cbsRefOverride: undefined,
                    },
                  })
                }
              >
                Restaurar alíquotas padrão
              </Button>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Alíquotas efetivas no ano</Label>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                {(() => {
                  const tt = TRANSICAO_REFORMA[input.year] ?? TRANSICAO_REFORMA[2033];
                  const reduc = input.reforma?.reducaoLC214 ?? 0;
                  const cheia = !!input.reforma?.aliquotaCheia;
                  const ibsRef = input.reforma?.ibsRefOverride ?? ALIQ_REFERENCIA.ibs;
                  const cbsRef = input.reforma?.cbsRefOverride ?? ALIQ_REFERENCIA.cbs;
                  const ibs = (cheia ? ibsRef : ibsRef * tt.ibsPct) * (1 - reduc);
                  const cbs = (cheia ? cbsRef : cbsRef * tt.cbsPct) * (1 - reduc);
                  return (
                    <div className="space-y-0.5">
                      <div>IBS: <strong>{ibs.toFixed(3)}%</strong> (ref: {ibsRef}%)</div>
                      <div>CBS: <strong>{cbs.toFixed(3)}%</strong> (ref: {cbsRef}%)</div>
                      <div>Total IVA: <strong>{(ibs + cbs).toFixed(3)}%</strong></div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ICMS/ISS residual: {(tt.icmsIssResid * 100).toFixed(0)}% · PIS/COFINS residual: {(tt.pisCofinsResid * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Nome da simulação</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Estudo Tributação 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <div className="flex gap-2">
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente vinculado</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={() => setNewClientOpen(true)} title="Cadastrar cliente">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ano-base</Label>
            <Input
              type="number"
              value={input.year}
              onChange={(e) => {
                const newYear = Number(e.target.value);
                if (newYear === 2026 && (showIVA || showSNH)) {
                  toast.error("2026 é fase de testes da Reforma — IBS/CBS desativados automaticamente.");
                  const next = (input.enabledRegimes || enabled).filter((x) => x !== "IVA" && x !== "SNH");
                  setInput({ ...input, year: newYear, enabledRegimes: next.length ? next as RegimeKey[] : ["LP"] });
                  return;
                }
                setInput({ ...input, year: newYear });
              }}
            />
            {input.year === 2026 && (
              <p className="text-xs text-destructive">⚠ 2026 é fase de testes da Reforma. IBS/CBS não disponível.</p>
            )}
            {input.year >= 2027 && showLP && (
              <p className="text-xs text-brand">
                Reforma incorporada automaticamente ao Lucro Presumido (cronograma LC 214/2025).
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Simulação multi-ano (Reforma 2027–2033) */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Simulações por ano da Reforma (2027–2033)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Marque os anos para projetar a carga total considerando o cronograma oficial da LC 214/2025.
            Os mesmos parâmetros e lançamentos serão recalculados em cada ano.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm"
              onClick={() => setMultiYears([2027,2028,2029,2030,2031,2032,2033])}>
              Marcar todos
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMultiYears([])}>
              Limpar
            </Button>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
            {[2027,2028,2029,2030,2031,2032,2033].map((y) => {
              const checked = multiYears.includes(y);
              const fase = TRANSICAO_REFORMA[y]?.fase ?? "";
              return (
                <Label key={y} htmlFor={`my-${y}`}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-2 cursor-pointer transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border"
                  }`}>
                  <div className="flex items-center gap-2">
                    <Checkbox id={`my-${y}`} checked={checked} onCheckedChange={(v) => toggleMultiYear(y, !!v)} />
                    <span className="font-display font-bold">{y}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-tight">{fase}</span>
                </Label>
              );
            })}
          </div>

          {multiYearResults.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-2">Ano</th>
                    <th className="text-left py-2 px-2">Fase</th>
                    <th className="text-right py-2 px-2">Receita</th>
                    {enabled.map((r) => (
                      <th key={r} className="text-right py-2 px-2">{REGIME_LABELS[r]}</th>
                    ))}
                    <th className="text-right py-2 px-2">Melhor regime</th>
                  </tr>
                </thead>
                <tbody>
                  {multiYearResults.map(({ year, result: r }) => {
                    const vals: Record<RegimeKey, number> = {
                      SN: r.totals.snTotal, LP: r.totals.lpTotal, LR: r.totals.lrTotal, IVA: r.totals.ivaTotal, SNH: r.totals.snhTotal,
                    };
                    return (
                      <tr key={year} className="border-b border-border/50">
                        <td className="py-1.5 px-2 font-bold">{year}</td>
                        <td className="py-1.5 px-2">{r.totals.transicao.fase}</td>
                        <td className="text-right">{formatBRL(r.totals.revenue)}</td>
                        {enabled.map((rk) => (
                          <td key={rk} className={`text-right ${r.totals.bestRegime === rk ? "font-bold text-brand" : ""}`}>
                            {formatBRL(vals[rk])}
                          </td>
                        ))}
                        <td className="text-right font-semibold">{REGIME_LABELS[r.totals.bestRegime]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showSN && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Simples Nacional</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Anexo</Label>
              <Select value={input.annex} onValueChange={(v) => setAnnex(v as Annex)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["I","II","III","IV","V"] as Annex[]).map((a) => (
                    <SelectItem key={a} value={a}>{ANNEX_LABELS[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sincroniza automaticamente a presunção do Lucro Presumido.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Receita 12 meses anteriores (RBT12)</Label>
              <MoneyInput value={input.prev12mRevenue} onValueChange={(v) => setInput({ ...input, prev12mRevenue: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>Folha 12 meses anteriores</Label>
              <MoneyInput value={input.prev12mPayroll} onValueChange={(v) => setInput({ ...input, prev12mPayroll: v })} />
            </div>
            <div className="md:col-span-3 flex items-center gap-3 pt-2">
              <Switch checked={input.autoFatorR} onCheckedChange={(v) => setInput({ ...input, autoFatorR: v })} id="fr" />
              <Label htmlFor="fr" className="font-normal text-sm cursor-pointer">
                Aplicar Fator R automaticamente — <strong>aplicável apenas ao Anexo V</strong>: promove para o Anexo III quando Fator R ≥ 28%.
              </Label>
            </div>
            {input.annex === "III" && (
              <div className="md:col-span-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Anexo III fixo:</strong>{" "}
                quando o usuário seleciona explicitamente o Anexo III, o sistema não rebaixa para o V mesmo que o Fator R fique &lt; 28%.
                O Fator R continua sendo calculado e exibido como métrica (gráfico "Evolução do Fator R"), mas não altera o anexo aplicado.
              </div>
            )}
            {input.annex === "V" && (
              <div className="md:col-span-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Fator R no Anexo V.</strong>{" "}
                Cálculo: <code>(folha 12 meses) ÷ (receita bruta 12 meses)</code>.
                Com "Auto Fator R" ligado: se ≥ 28% a empresa é promovida ao <strong>Anexo III</strong> (alíquotas mais baixas);
                se &lt; 28%, permanece no <strong>Anexo V</strong>. Confira o gráfico "Evolução do Fator R" após processar a simulação.
              </div>
            )}
            {input.annex === "IV" && (
              <div className="md:col-span-3 rounded-lg border bg-amber-50 border-amber-200 p-3 text-xs text-amber-900">
                <strong>Anexo IV — INSS Patronal por fora:</strong> diferentemente dos Anexos I, II, III e V, no Anexo IV
                a CPP de 20% (INSS Patronal) <strong>não está incluída no DAS</strong>. O sistema calcula automaticamente
                20% sobre os valores informados em "Folha de pagamento" (mais RAT) e adiciona aos encargos da folha do SN.
                <span className="block mt-1 text-amber-700">Base legal: LC 123/2006, art. 18, §5º-C; Lei 8.212/1991, art. 22.</span>
              </div>
            )}
            <Prev12Breakdown input={input} setInput={setInput} />
          </CardContent>
        </Card>
      )}

      {showLR && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Lucro Real</CardTitle>
            <p className="text-xs text-muted-foreground">
              IRPJ e CSLL incidem sobre o lucro efetivo. PIS/COFINS são não-cumulativos (crédito sobre compras).
            </p>
          </CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Margem de lucro real (%)</Label>
              <PercentInput
                value={input.lrProfitRate ?? 0.10}
                onValueChange={(v) => setInput({ ...input, lrProfitRate: v })}
              />
              <p className="text-xs text-muted-foreground">Lucro tributável / receita. IRPJ 15% + 10% adicional.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Crédito PIS/COFINS s/ compras (%)</Label>
              <PercentInput
                value={input.lrPisCofinsCredRate ?? 0.0825}
                onValueChange={(v) => setInput({ ...input, lrPisCofinsCredRate: v })}
              />
              <p className="text-xs text-muted-foreground">Taxa de crédito sobre valor das compras. PIS 1,65% + COFINS 7,6% = 9,25%.</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm col-span-1 flex flex-col justify-center space-y-0.5">
              <div>PIS débito: <strong>1,65%</strong></div>
              <div>COFINS débito: <strong>7,6%</strong></div>
              <div>CSLL: <strong>9%</strong></div>
              <div className="text-xs text-muted-foreground mt-1">IRPJ calculado sobre lucro efetivo: 15% + 10% (adicional acima de R$ 20k/mês).</div>
            </div>
          </CardContent>
        </Card>
      )}

      {showLP && (
        <Card>
          <CardHeader><CardTitle className="font-display text-base">Lucro Presumido</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Atividade (presunção IRPJ)</Label>
              <Select value={String(input.presumptionRate)} onValueChange={(v) => setPresumption(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.08">8% — Comércio / Indústria</SelectItem>
                  <SelectItem value="0.16">16% — Transporte de passageiros</SelectItem>
                  <SelectItem value="0.32">32% — Serviços em geral</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sincroniza automaticamente o Anexo do Simples Nacional.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Alíquota ISS (serviços)</Label>
              <PercentInput value={input.issRate} onValueChange={(v) => setInput({ ...input, issRate: v })} />
              <p className="text-xs text-muted-foreground">Use 2% a 5% conforme município.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Alíquota ICMS (comércio/indústria)</Label>
              <PercentInput value={input.icmsRate} onValueChange={(v) => setInput({ ...input, icmsRate: v })} />
              <p className="text-xs text-muted-foreground">Ex.: 18% (interno SP). Aplicado para comércio/indústria.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Alíquota IPI (indústria)</Label>
              <PercentInput value={input.ipiRate || 0} onValueChange={(v) => setInput({ ...input, ipiRate: v })} />
              <p className="text-xs text-muted-foreground">Débito sobre faturamento de indústria (variável por TIPI).</p>
            </div>
            <div className="space-y-1.5">
              <Label>Presunção CSLL</Label>
              <PercentInput value={input.cssllPresumptionRate} onValueChange={(v) => setInput({ ...input, cssllPresumptionRate: v })} />
              <p className="text-xs text-muted-foreground">12% comércio/indústria · 32% serviços.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
}
