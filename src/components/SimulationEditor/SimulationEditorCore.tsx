import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClients, apiSimulations } from "@/lib/api";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";
import { ActiveClientFilterChip } from "@/components/ActiveClientFilterChip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Annex,
  MONTH_NAMES,
  RegimeKey,
  SimulationInput,
  calculateSimulation,
} from "@/lib/tax-engine";
import { ParametrosTab, type ClientOption } from "@/components/SimulationEditor/ParametrosTab";
import { LancamentosTab } from "@/components/SimulationEditor/LancamentosTab";
import { ResultadoTab, type ChartDatum, type SavingsDatum } from "@/components/SimulationEditor/ResultadoTab";
import { PosReformaTab } from "@/components/SimulationEditor/PosReformaTab";
import { NewClientDialog } from "@/components/SimulationEditor/NewClientDialog";
import { ExportDialog } from "@/components/SimulationEditor/ExportDialog";
import { EditorHeader } from "@/components/SimulationEditor/EditorHeader";
import { BannerEconomia } from "@/components/SimulationEditor/BannerEconomia";
import { KpisRow } from "@/components/SimulationEditor/KpisRow";
import { useExportLayout } from "@/components/SimulationEditor/useExportLayout";
import { useNewClient } from "@/components/SimulationEditor/useNewClient";
import { useActivityHandlers } from "@/components/SimulationEditor/useActivityHandlers";
import { defaultInput, presumptionToSnAnnex, snAnnexToPresumption } from "@/components/SimulationEditor/simulationHelpers";

export interface SimulationEditorCoreProps {
  /** ID de simulação existente. undefined = nova simulação. */
  id?: string;
  /** Chamado quando o usuário clica em "Voltar". */
  onBack: () => void;
  /** Chamado após criar/salvar uma simulação (passa o ID). */
  onAfterSave?: (id: string) => void;
  /** Quando true: omite ActiveClientFilterChip e padding externo de página. */
  embeddedMode?: boolean;
}

export function SimulationEditorCore({
  id,
  onBack,
  onAfterSave,
  embeddedMode = false,
}: SimulationEditorCoreProps) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const preselectClient = params.get("cliente") || "";

  const isNew = !id;
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>(preselectClient);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [contadorName, setContadorName] = useState("");
  const [input, setInput] = useState<SimulationInput>(defaultInput(currentYear));
  const [saving, setSaving] = useState(false);
  const [annualRevenue, setAnnualRevenue] = useState<number>(0);
  const [annualPayroll, setAnnualPayroll] = useState<number>(0);
  const [annualPurchases, setAnnualPurchases] = useState<number>(0);

  const newClientCtl = useNewClient({ setClients, setClientId });

  // Pré-seleciona o primeiro cliente do filtro global do header,
  // apenas em simulação nova e quando não veio cliente via query string.
  const { selectedIds: globalSelectedIds } = useSelectedClients();
  useEffect(() => {
    if (!isNew) return;
    if (preselectClient) return;
    if (clientId) return;
    if (!clients.length || !globalSelectedIds.length) return;
    const first = globalSelectedIds.find((gid) => clients.some((c) => c.id === gid));
    if (first) setClientId(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, globalSelectedIds, isNew, preselectClient]);

  const distributeAnnual = (field: "revenue" | "payroll" | "purchases", total: number) => {
    if (total < 0) return toast.error("Informe um valor válido");
    const per = +(total / 12).toFixed(2);
    const lastAdj = +(total - per * 11).toFixed(2);
    setInput((p) => ({
      ...p,
      months: p.months.map((m, i) => ({
        ...m,
        [field]: i === 11 ? lastAdj : per,
        ...(field === "revenue" ? { activities: [] } : {}),
      })),
    }));
    const labels = { revenue: "Receita", payroll: "Folha", purchases: "Compras" } as const;
    toast.success(`${labels[field]} distribuída nos 12 meses`);
  };

  const setHasEmployeesAll = (v: boolean) => {
    setInput((p) => ({ ...p, months: p.months.map((m) => ({ ...m, hasEmployees: v })) }));
    toast.success(v ? "Marcado: todos os meses com funcionários" : "Marcado: todos os meses sem funcionários");
  };

  useEffect(() => {
    (async () => {
      try { setClients(await apiClients.list()); } catch { /* ignore */ }
      try {
        const raw = localStorage.getItem("econ_local_user");
        const localName = raw ? (JSON.parse(raw).name || "") : "";
        const email = raw ? (JSON.parse(raw).email || "") : "";
        if (email) {
          try {
            const { apiUsers } = await import("@/lib/api");
            const me = await apiUsers.me(email);
            setContadorName(me.contador?.name || localName);
          } catch {
            setContadorName(localName);
          }
        } else {
          setContadorName(localName);
        }
      } catch { /* ignore */ }
      if (!isNew && id) {
        try {
          const data = await apiSimulations.get(id);
          setName(data.name);
          setClientId(data.clientId || "");
          const stored = (data.data as Partial<SimulationInput>) || {};
          setInput({
            ...defaultInput(data.year),
            ...stored,
            annex: (data.snAnnex as Annex) || "III",
            presumptionRate: Number(data.presumptionRate),
            cssllPresumptionRate: stored.cssllPresumptionRate ?? Number(Number(data.presumptionRate) === 0.08 || Number(data.presumptionRate) === 0.16 ? 0.12 : 0.32),
            issRate: Number(data.issRate),
            icmsRate: stored.icmsRate ?? 0,
            compareMode: stored.compareMode ?? "compare",
            enabledRegimes: stored.enabledRegimes
              ?? (stored.compareMode === "sn" ? ["SN"]
                : stored.compareMode === "lp" ? ["LP"]
                : ["SN", "LP"]) as RegimeKey[],
            reforma: stored.reforma ?? { reducaoLC214: 0, aliquotaCheia: false },
            year: data.year,
            months: stored.months || defaultInput(data.year).months,
          });
        } catch {
          toast.error("Simulação não encontrada");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  const result = useMemo(() => calculateSimulation(input), [input]);
  const t = result.totals;
  const enabled = (input.enabledRegimes && input.enabledRegimes.length > 0)
    ? input.enabledRegimes
    : (input.compareMode === "sn" ? ["SN"] : input.compareMode === "lp" ? ["LP"] : ["SN", "LP"]) as RegimeKey[];
  const isCompare = enabled.length >= 2;
  const showSN = enabled.includes("SN");
  const showLP = enabled.includes("LP");
  const showLR = enabled.includes("LR");
  const showIVA = enabled.includes("IVA");
  const showSNH = enabled.includes("SNH");
  const toggleRegime = (r: RegimeKey, v: boolean) => {
    if (v && (r === "IVA" || r === "SNH") && input.year === 2026) {
      toast.error("2026 é fase de testes da Reforma Tributária — IBS/CBS não pode ser simulado neste ano. Use 2027–2033.");
      return;
    }
    const next = v
      ? Array.from(new Set([...(input.enabledRegimes || enabled), r]))
      : (input.enabledRegimes || enabled).filter((x) => x !== r);
    if (next.length === 0) { toast.error("Selecione ao menos um regime"); return; }
    setInput({ ...input, enabledRegimes: next as RegimeKey[] });
  };

  const [multiYears, setMultiYears] = useState<number[]>([]);
  const toggleMultiYear = (y: number, v: boolean) => {
    setMultiYears((p) => v ? Array.from(new Set([...p, y])).sort() : p.filter((x) => x !== y));
  };
  const multiYearResults = useMemo(
    () => multiYears.map((y) => ({ year: y, result: calculateSimulation({ ...input, year: y }) })),
    [multiYears, input],
  );

  const acts = useActivityHandlers(input, setInput);

  const setAnnex = (a: Annex) => {
    const { irpj, csll } = snAnnexToPresumption(a);
    setInput((prev) => ({
      ...prev,
      annex: a,
      presumptionRate: irpj,
      cssllPresumptionRate: csll,
      months: prev.months.map((m) => {
        if (!m.annexOverride || m.annexOverride === prev.annex) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { annexOverride: _drop, ...rest } = m;
          return rest;
        }
        return m;
      }),
    }));
  };
  const setPresumption = (rate: number) => {
    const csll = rate === 0.32 ? 0.32 : 0.12;
    setInput({ ...input, presumptionRate: rate, cssllPresumptionRate: csll, annex: presumptionToSnAnnex(rate, input.annex) });
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Dê um nome para a simulação");
    setSaving(true);
    const payload = {
      client_id: clientId || null,
      name,
      year: input.year,
      sn_annex: input.annex,
      presumption_rate: input.presumptionRate,
      iss_rate: input.issRate,
      data: input as unknown as Record<string, unknown>,
      result: result as unknown as Record<string, unknown>,
    };
    try {
      if (isNew) {
        const { id: newId } = await apiSimulations.create(payload);
        setSaving(false);
        toast.success("Simulação criada");
        onAfterSave?.(newId);
      } else {
        await apiSimulations.update(id!, payload);
        setSaving(false);
        toast.success("Salvo com sucesso");
        onAfterSave?.(id!);
      }
    } catch (e) {
      setSaving(false);
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const selectedClient = clients.find((c) => c.id === clientId);
  const meta = {
    simulationName: name || "Simulação sem nome",
    clientName: selectedClient?.name,
    companyName: selectedClient?.name,
    cnpj: selectedClient?.cnpj || undefined,
    contadorName,
    year: input.year,
  };

  const chartData: ChartDatum[] = result.months.map((m) => ({
    name: MONTH_NAMES[m.month - 1],
    SN: Math.round(m.totalSN),
    LP: Math.round(m.totalLP),
    Receita: Math.round(m.revenue),
  }));

  const savingsData: SavingsDatum[] = useMemo(() => {
    let acc = 0;
    return result.months.map((m) => {
      const diff = Math.abs(m.totalLP - m.totalSN);
      const better: "SN" | "LP" = m.totalSN <= m.totalLP ? "SN" : "LP";
      acc += diff;
      return { name: MONTH_NAMES[m.month - 1], Economia: Math.round(diff), Acumulado: Math.round(acc), Melhor: better };
    });
  }, [result.months]);

  const snBurden = t.revenue > 0 ? t.snTotal / t.revenue : 0;
  const lpBurden = t.revenue > 0 ? t.lpTotal / t.revenue : 0;
  const lrBurden = t.revenue > 0 ? t.lrTotal / t.revenue : 0;
  const worstTotal = Math.max(t.snTotal, t.lpTotal, t.lrTotal);
  const savingsPct = worstTotal > 0 ? t.saving / worstTotal : 0;
  const monthlyAvgSaving = t.saving / 12;

  const cumulative12m = useMemo(() => {
    const prev = input.prev12mMonthlyRevenue && input.prev12mMonthlyRevenue.length === 12
      ? [...input.prev12mMonthlyRevenue]
      : Array.from({ length: 12 }, () => input.prev12mRevenue / 12);
    const out: number[] = [];
    const win = [...prev];
    for (const m of input.months) {
      out.push(win.reduce((a, b) => a + b, 0));
      win.shift(); win.push(m.revenue);
    }
    return out;
  }, [input.months, input.prev12mMonthlyRevenue, input.prev12mRevenue]);

  const chartBarRef = useRef<HTMLDivElement>(null);
  const chartLineRef = useRef<HTMLDivElement>(null);
  const chartSavingsRef = useRef<HTMLDivElement>(null);

  const exp = useExportLayout({ input, result, meta, isCompare, chartBarRef, chartSavingsRef });

  return (
    <div className={embeddedMode ? "space-y-4" : "space-y-6"}>
      {!embeddedMode && <ActiveClientFilterChip />}

      <EditorHeader
        name={name} saving={saving}
        onBack={onBack}
        onExport={() => exp.setExportOpen(true)}
        onSave={save}
      />

      {isCompare && t.revenue > 0 && (
        <BannerEconomia
          bestRegime={t.bestRegime}
          saving={t.saving} savingsPct={savingsPct} monthlyAvgSaving={monthlyAvgSaving}
          showSN={showSN} showLP={showLP}
          snBurden={snBurden} lpBurden={lpBurden}
          snTotal={t.snTotal} lpTotal={t.lpTotal}
        />
      )}

      <KpisRow
        isCompare={isCompare}
        showSN={showSN} showLP={showLP} showLR={showLR}
        bestRegime={t.bestRegime}
        revenue={t.revenue}
        snTotal={t.snTotal} lpTotal={t.lpTotal} lrTotal={t.lrTotal}
        saving={t.saving}
        snBurden={snBurden} lpBurden={lpBurden} lrBurden={lrBurden}
        savingsPct={savingsPct}
      />

      <Tabs defaultValue="parametros" className="w-full">
        <TabsList className="w-full md:w-auto grid grid-cols-2 md:grid-cols-4 md:inline-flex">
          <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          <TabsTrigger value="meses">Lançamentos</TabsTrigger>
          <TabsTrigger value="resultado">Resultado</TabsTrigger>
          <TabsTrigger value="pos-reforma">Pós-Reforma 2033</TabsTrigger>
        </TabsList>

        <ParametrosTab
          input={input} setInput={setInput}
          enabled={enabled} toggleRegime={toggleRegime}
          showSN={showSN} showLP={showLP} showLR={showLR} showIVA={showIVA} showSNH={showSNH}
          multiYears={multiYears} setMultiYears={setMultiYears} toggleMultiYear={toggleMultiYear}
          multiYearResults={multiYearResults}
          name={name} setName={setName}
          clientId={clientId} setClientId={setClientId}
          clients={clients}
          setNewClientOpen={newClientCtl.setNewClientOpen}
          setAnnex={setAnnex} setPresumption={setPresumption}
        />

        <LancamentosTab
          input={input} setInput={setInput}
          annualRevenue={annualRevenue} setAnnualRevenue={setAnnualRevenue}
          annualPayroll={annualPayroll} setAnnualPayroll={setAnnualPayroll}
          annualPurchases={annualPurchases} setAnnualPurchases={setAnnualPurchases}
          distributeAnnual={distributeAnnual}
          setHasEmployeesAll={setHasEmployeesAll}
          autoFillPayroll={acts.autoFillPayroll} autoFillAllPayroll={acts.autoFillAllPayroll}
          updateMonth={acts.updateMonth}
          addActivity={acts.addActivity} updateActivity={acts.updateActivity}
          removeActivity={acts.removeActivity}
          applyAnnexToAllActivities={acts.applyAnnexToAllActivities}
          showSN={showSN} showLP={showLP}
          cumulative12m={cumulative12m}
          nav={nav}
        />

        <ResultadoTab
          input={input} result={result} t={t}
          enabled={enabled}
          showSN={showSN} showLP={showLP} showLR={showLR} showIVA={showIVA} showSNH={showSNH}
          isCompare={isCompare}
          chartData={chartData} savingsData={savingsData} savingsPct={savingsPct}
          chartBarRef={chartBarRef} chartLineRef={chartLineRef} chartSavingsRef={chartSavingsRef}
          multiYearResults={multiYearResults}
        />

        <PosReformaTab input={input} />
      </Tabs>

      <ExportDialog
        open={exp.exportOpen} onOpenChange={exp.setExportOpen}
        expFormat={exp.expFormat} setExpFormat={exp.setExpFormat}
        expLayout={exp.expLayout} applyLayoutDefaults={exp.applyLayoutDefaults}
        expMonths={exp.expMonths} setExpMonths={exp.setExpMonths}
        expSections={exp.expSections} setExpSections={exp.setExpSections}
        decCidade={exp.decCidade} setDecCidade={exp.setDecCidade}
        decSocioNome={exp.decSocioNome} setDecSocioNome={exp.setDecSocioNome}
        decSocioCPF={exp.decSocioCPF} setDecSocioCPF={exp.setDecSocioCPF}
        decContadorNome={exp.decContadorNome} setDecContadorNome={exp.setDecContadorNome}
        decContadorCPF={exp.decContadorCPF} setDecContadorCPF={exp.setDecContadorCPF}
        decContadorCRC={exp.decContadorCRC} setDecContadorCRC={exp.setDecContadorCRC}
        showSN={showSN} showLP={showLP} isCompare={isCompare}
        runExport={exp.runExport}
      />

      <NewClientDialog
        open={newClientCtl.newClientOpen} onOpenChange={newClientCtl.setNewClientOpen}
        newClient={newClientCtl.newClient} setNewClient={newClientCtl.setNewClient}
        lookupNewCNPJ={newClientCtl.lookupNewCNPJ} createClient={newClientCtl.createClient}
        creatingClient={newClientCtl.creatingClient}
      />
    </div>
  );
}
