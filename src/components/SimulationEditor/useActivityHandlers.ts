import { toast } from "sonner";
import { MONTH_NAMES, type ActivityEntry, type MonthEntry, type SimulationInput, autoCalcPayrollCharges } from "@/lib/tax-engine";

export function useActivityHandlers(
  input: SimulationInput,
  setInput: React.Dispatch<React.SetStateAction<SimulationInput>>,
) {
  const updateMonth = (idx: number, patch: Partial<MonthEntry>) => {
    setInput((p) => ({
      ...p,
      months: p.months.map((m, i) => {
        if (i !== idx) return m;
        const next = { ...m, ...patch };
        // Remove keys explicitly set to undefined so checks like `m.annexOverride &&` work correctly
        (Object.keys(patch) as (keyof MonthEntry)[]).forEach((k) => {
          if (patch[k] === undefined) delete next[k];
        });
        return next;
      }),
    }));
  };

  const recalc = (acts: ActivityEntry[]) => acts.reduce((s, a) => s + (a.revenue || 0), 0);

  const addActivity = (idx: number) => {
    const m = input.months[idx];
    const acts = [...(m.activities || [])];
    acts.push({
      label: "",
      revenue: 0,
      presumptionRate: input.presumptionRate,
      cssllPresumptionRate: input.cssllPresumptionRate,
      issRate: input.issRate,
      icmsRate: input.icmsRate,
    });
    updateMonth(idx, { activities: acts, revenue: recalc(acts) });
  };

  const updateActivity = (idx: number, ai: number, patch: Partial<ActivityEntry>) => {
    const m = input.months[idx];
    const acts = (m.activities || []).map((a, i) => (i === ai ? { ...a, ...patch } : a));
    updateMonth(idx, { activities: acts, revenue: recalc(acts) });
  };

  const removeActivity = (idx: number, ai: number) => {
    const m = input.months[idx];
    const acts = (m.activities || []).filter((_, i) => i !== ai);
    updateMonth(idx, { activities: acts, revenue: acts.length ? recalc(acts) : m.revenue });
  };

  const applyAnnexToAllActivities = (idx: number, ai: number) => {
    const m = input.months[idx];
    const src = (m.activities || [])[ai];
    if (!src) return;
    const annex = src.annex;
    const acts = (m.activities || []).map((a) => ({ ...a, annex }));
    updateMonth(idx, { activities: acts });
    toast.success(`Anexo ${annex ?? "Global"} aplicado a todas as atividades de ${MONTH_NAMES[idx]}`);
  };

  const autoFillPayroll = (idx: number) => {
    const m = input.months[idx];
    if (!m.payroll) return toast.error("Informe a folha bruta primeiro");
    const c = autoCalcPayrollCharges(m.payroll, m.hasEmployees !== false);
    updateMonth(idx, { ...c });
    toast.success(`${MONTH_NAMES[idx]}: encargos calculados`);
  };

  const autoFillAllPayroll = () => {
    setInput((p) => ({
      ...p,
      months: p.months.map((m) => {
        if (!m.payroll) return m;
        const c = autoCalcPayrollCharges(m.payroll, m.hasEmployees !== false);
        return { ...m, ...c };
      }),
    }));
    toast.success("Encargos calculados em todos os meses");
  };

  return { updateMonth, addActivity, updateActivity, removeActivity, applyAnnexToAllActivities, autoFillPayroll, autoFillAllPayroll };
}
