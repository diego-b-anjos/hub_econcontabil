import type { Annex, MonthEntry, SimulationInput } from "@/lib/tax-engine";

export const emptyMonth = (m: number): MonthEntry => ({
  month: m, revenue: 0, activities: [], payroll: 0, hasEmployees: true,
  inssEmployer: 0, rat: 0, fgts: 0, irrf: 0, inssSegurado: 0, iss: 0,
  purchases: 0, purchasesIcmsRate: 0, purchasesIpiRate: 0,
});

export const defaultInput = (year: number): SimulationInput => ({
  year,
  compareMode: "compare",
  enabledRegimes: ["SN", "LP"],
  reforma: { reducaoLC214: 0, aliquotaCheia: false },
  annex: "III",
  autoFatorR: true,
  prev12mRevenue: 0,
  prev12mPayroll: 0,
  presumptionRate: 0.32,
  cssllPresumptionRate: 0.32,
  issRate: 0.05,
  icmsRate: 0,
  ipiRate: 0,
  pisRate: 0.0065,
  cofinsRate: 0.03,
  irpjRate: 0.15,
  csllRate: 0.09,
  months: Array.from({ length: 12 }, (_, i) => emptyMonth(i + 1)),
});

export function snAnnexToPresumption(annex: Annex): { irpj: number; csll: number } {
  if (annex === "I" || annex === "II") return { irpj: 0.08, csll: 0.12 };
  return { irpj: 0.32, csll: 0.32 };
}

export function presumptionToSnAnnex(rate: number, current: Annex): Annex {
  if (rate === 0.08) return "I";
  if (rate === 0.16) return "II";
  if (current === "I" || current === "II") return "III";
  return current;
}
