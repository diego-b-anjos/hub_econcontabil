import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MoneyInput } from "@/components/MoneyInput";
import { PercentInput } from "@/components/PercentInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ActivityEntry, Annex, MONTH_NAMES, MonthEntry, SimulationInput, formatBRL } from "@/lib/tax-engine";
import { Field } from "./helpers";

export interface LancamentosTabProps {
  input: SimulationInput;
  setInput: React.Dispatch<React.SetStateAction<SimulationInput>>;
  annualRevenue: number;
  setAnnualRevenue: (n: number) => void;
  annualPayroll: number;
  setAnnualPayroll: (n: number) => void;
  annualPurchases: number;
  setAnnualPurchases: (n: number) => void;
  distributeAnnual: (field: "revenue" | "payroll" | "purchases", total: number) => void;
  setHasEmployeesAll: (v: boolean) => void;
  autoFillPayroll: (i: number) => void;
  autoFillAllPayroll: () => void;
  updateMonth: (i: number, patch: Partial<MonthEntry>) => void;
  addActivity: (i: number) => void;
  updateActivity: (mi: number, ai: number, patch: Partial<ActivityEntry>) => void;
  removeActivity: (mi: number, ai: number) => void;
  applyAnnexToAllActivities: (mi: number, ai: number) => void;
  showSN: boolean;
  showLP: boolean;
  cumulative12m: number[];
  nav: (path: string) => void;
}

export function LancamentosTab(props: LancamentosTabProps) {
  const {
    input, setInput,
    annualRevenue, setAnnualRevenue,
    annualPayroll, setAnnualPayroll,
    annualPurchases, setAnnualPurchases,
    distributeAnnual, setHasEmployeesAll,
    autoFillPayroll, autoFillAllPayroll,
    updateMonth, addActivity, updateActivity, removeActivity, applyAnnexToAllActivities,
    showSN, showLP, cumulative12m, nav,
  } = props;

  return (
    <TabsContent value="meses" className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Distribuição anual proporcional</CardTitle>
          <p className="text-xs text-muted-foreground">
            Informe o total anual de receita, folha e/ou compras; o valor será dividido em 12 parcelas iguais nos meses abaixo.
          </p>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Receita anual total</Label>
            <div className="flex gap-2">
              <MoneyInput value={annualRevenue} onValueChange={setAnnualRevenue} />
              <Button variant="outline" onClick={() => distributeAnnual("revenue", annualRevenue)}>
                Distribuir
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Folha anual total</Label>
            <div className="flex gap-2">
              <MoneyInput value={annualPayroll} onValueChange={setAnnualPayroll} />
              <Button variant="outline" onClick={() => distributeAnnual("payroll", annualPayroll)}>
                Distribuir
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Compras anuais totais</Label>
            <div className="flex gap-2">
              <MoneyInput value={annualPurchases} onValueChange={setAnnualPurchases} />
              <Button variant="outline" onClick={() => distributeAnnual("purchases", annualPurchases)}>
                Distribuir
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Gera crédito de ICMS/IPI no Lucro Presumido conforme as alíquotas informadas em cada mês.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Importar dados do Leitor de SPED</CardTitle>
          <p className="text-xs text-muted-foreground">
            Use os faturamentos, compras e créditos de ICMS/IPI extraídos no módulo "Leitor de SPED". Os meses do SPED são casados com Jan–Dez do ano-base.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const raw = localStorage.getItem("sped_extracao");
              if (!raw) return toast.error("Nenhum SPED processado. Acesse 'Leitor de SPED' primeiro.");
              try {
                const dados = JSON.parse(raw);
                const porMes: Record<number, any> = {};
                for (const m of dados.meses || []) porMes[m.mes] = m;
                setInput((p) => ({
                  ...p,
                  months: p.months.map((mm) => {
                    const sm = porMes[mm.month];
                    if (!sm) return mm;
                    return {
                      ...mm,
                      revenue: sm.faturamento || mm.revenue,
                      purchases: sm.compras || mm.purchases || 0,
                      purchasesIcmsRate: sm.compras > 0 ? (sm.icmsCredito / sm.compras) : (mm.purchasesIcmsRate || 0),
                      purchasesIpiRate: sm.compras > 0 ? (sm.ipiCredito / sm.compras) : (mm.purchasesIpiRate || 0),
                    };
                  }),
                }));
                toast.success(`Importados ${Object.keys(porMes).length} mês(es) do SPED`);
              } catch (e: any) {
                toast.error("Falha ao ler dados SPED: " + e.message);
              }
            }}
          >
            Importar últimos dados do SPED
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => nav("/app/sped-leitor")}>
            Abrir Leitor de SPED →
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="font-display text-base">Configuração global de folha</CardTitle>
            <p className="text-xs text-muted-foreground">
              Marque/desmarque "Tem funcionários" em todos os meses de uma só vez (afeta RAT e FGTS).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setHasEmployeesAll(true)}>
              Todos com funcionários
            </Button>
            <Button variant="outline" size="sm" onClick={() => setHasEmployeesAll(false)}>
              Todos sem funcionários
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="font-display text-base">Lançamentos mensais</CardTitle>
            <p className="text-xs text-muted-foreground">
              Informe receita, folha e compras de cada mês. Use o botão da varinha para calcular automaticamente INSS/IRRF/RAT/FGTS a partir da folha bruta.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={autoFillAllPayroll}>
            <Wand2 className="w-3.5 h-3.5 mr-1" /> Calcular encargos (todos)
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto space-y-4">
          {input.months.map((m, i) => {
            const acts = m.activities || [];
            const hasMulti = acts.length > 0;
            return (
              <div key={i} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/60">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="font-semibold text-sm w-12">{MONTH_NAMES[i]}</div>
                    {showSN && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Anexo SN</span>
                        <Select
                          value={m.annexOverride ?? input.annex}
                          onValueChange={(v) => updateMonth(i, { annexOverride: v as Annex })}
                        >
                          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["I","II","III","IV","V"] as Annex[]).map((a) => (
                              <SelectItem key={a} value={a}>{a}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {m.annexOverride && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                            onClick={() => updateMonth(i, { annexOverride: undefined })}>
                            usar global
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`emp-${i}`}
                        checked={m.hasEmployees !== false}
                        onCheckedChange={(v) => updateMonth(i, { hasEmployees: v })}
                      />
                      <Label htmlFor={`emp-${i}`} className="text-[11px] font-normal cursor-pointer">
                        Tem funcionários (RAT/FGTS)
                      </Label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      Acum. 12m: <span className="font-semibold text-foreground">{formatBRL(cumulative12m[i] || 0)}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => autoFillPayroll(i)} title="Calcular INSS/IRRF/RAT/FGTS">
                      <Wand2 className="w-3.5 h-3.5 mr-1" /> Calcular folha
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2 min-w-0">
                    <Field label="Receita">
                      <MoneyInput
                        value={m.revenue}
                        onValueChange={(v) => updateMonth(i, { revenue: v })}
                        disabled={hasMulti}
                      />
                    </Field>
                    <Field label="Folha bruta">
                      <MoneyInput value={m.payroll} onValueChange={(v) => updateMonth(i, { payroll: v })} />
                    </Field>
                    <Field label="RAT">
                      <MoneyInput value={m.rat} onValueChange={(v) => updateMonth(i, { rat: v })} />
                    </Field>
                    <Field label="FGTS">
                      <MoneyInput value={m.fgts} onValueChange={(v) => updateMonth(i, { fgts: v })} />
                    </Field>
                    <Field label="IRRF">
                      <MoneyInput value={m.irrf} onValueChange={(v) => updateMonth(i, { irrf: v })} />
                    </Field>
                    <Field label="INSS segurado">
                      <MoneyInput value={m.inssSegurado} onValueChange={(v) => updateMonth(i, { inssSegurado: v })} />
                    </Field>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => addActivity(i)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Atividade
                  </Button>
                </div>

                {/* Compras / créditos LP */}
                {showLP && (
                  <div className="bg-muted/20 rounded-md p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                      Compras (gera crédito de ICMS/IPI no Lucro Presumido)
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <Field label="Total de compras">
                        <MoneyInput value={m.purchases || 0} onValueChange={(v) => updateMonth(i, { purchases: v })} />
                      </Field>
                      <Field label="Alíq. ICMS sobre compras">
                        <PercentInput value={m.purchasesIcmsRate || 0} onValueChange={(v) => updateMonth(i, { purchasesIcmsRate: v })} />
                      </Field>
                      <Field label="Alíq. IPI sobre compras">
                        <PercentInput value={m.purchasesIpiRate || 0} onValueChange={(v) => updateMonth(i, { purchasesIpiRate: v })} />
                      </Field>
                    </div>
                  </div>
                )}

                {hasMulti && (
                  <div className="bg-muted/30 rounded-md p-2 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Atividades do mês — receita = {formatBRL(m.revenue)}
                    </div>
                    {acts.map((a, ai) => (
                      <div key={ai} className="grid grid-cols-2 md:grid-cols-9 gap-2 items-end">
                        <Field label="Descrição">
                          <Input
                            className="h-9"
                            value={a.label || ""}
                            onChange={(e) => updateActivity(i, ai, { label: e.target.value })}
                            placeholder="Ex.: Revenda"
                          />
                        </Field>
                        <Field label="Receita">
                          <MoneyInput value={a.revenue} onValueChange={(v) => updateActivity(i, ai, { revenue: v })} />
                        </Field>
                        {showSN && (
                          <Field label="Anexo SN">
                            <div className="flex gap-1">
                              <Select
                                value={a.annex ?? "_global"}
                                onValueChange={(v) =>
                                  updateActivity(i, ai, { annex: v === "_global" ? undefined : (v as Annex) })
                                }
                              >
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_global">Global</SelectItem>
                                  {(["I","II","III","IV","V"] as Annex[]).map((ax) => (
                                    <SelectItem key={ax} value={ax}>{ax}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {(acts.length > 1) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 px-2 shrink-0"
                                  title="Aplicar este anexo a todas as atividades do mês"
                                  onClick={() => applyAnnexToAllActivities(i, ai)}
                                >
                                  <Wand2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </Field>
                        )}
                        <Field label="Presunção IRPJ">
                          <Select
                            value={String(a.presumptionRate ?? input.presumptionRate)}
                            onValueChange={(v) => {
                              const r = Number(v);
                              updateActivity(i, ai, { presumptionRate: r, cssllPresumptionRate: r === 0.32 ? 0.32 : 0.12 });
                            }}
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0.08">8% Com./Ind.</SelectItem>
                              <SelectItem value="0.16">16% Transp.</SelectItem>
                              <SelectItem value="0.32">32% Serviços</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="ISS">
                          <PercentInput value={a.issRate ?? input.issRate}
                            onValueChange={(v) => updateActivity(i, ai, { issRate: v })} />
                        </Field>
                        <Field label="ICMS">
                          <PercentInput value={a.icmsRate ?? input.icmsRate}
                            onValueChange={(v) => updateActivity(i, ai, { icmsRate: v })} />
                        </Field>
                        <Field label="IPI">
                          <PercentInput value={a.ipiRate ?? (input.ipiRate || 0)}
                            onValueChange={(v) => updateActivity(i, ai, { ipiRate: v })} />
                        </Field>
                        <div className="md:col-span-2 flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => removeActivity(i, ai)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
