import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyInput } from "@/components/MoneyInput";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MONTH_NAMES, type SimulationInput, formatBRL } from "@/lib/tax-engine";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  highlight,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Card className={`${accent ? "bg-gradient-dark text-primary-foreground border-transparent" : ""} ${highlight && !accent ? "ring-2 ring-brand" : ""}`}>
      <CardContent className="p-5">
        <div className={`text-xs uppercase tracking-widest font-semibold ${accent ? "text-brand" : "text-muted-foreground"} flex items-center gap-2`}>
          {icon} {label}
        </div>
        <div className="mt-2 text-2xl font-display font-bold">{value}</div>
        {sub && <div className={`text-[11px] mt-1 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</div>}
        {highlight && !accent && <div className="text-xs text-brand font-bold mt-1">★ Mais econômico</div>}
      </CardContent>
    </Card>
  );
}

export function Prev12Breakdown({
  input,
  setInput,
}: {
  input: SimulationInput;
  setInput: (i: SimulationInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const arr = input.prev12mMonthlyRevenue && input.prev12mMonthlyRevenue.length === 12
    ? input.prev12mMonthlyRevenue
    : Array.from({ length: 12 }, () => input.prev12mRevenue / 12);
  const arrPay = input.prev12mMonthlyPayroll && input.prev12mMonthlyPayroll.length === 12
    ? input.prev12mMonthlyPayroll
    : Array.from({ length: 12 }, () => input.prev12mPayroll / 12);
  const totalRev = arr.reduce((a, b) => a + b, 0);
  const totalPay = arrPay.reduce((a, b) => a + b, 0);

  const update = (idx: number, field: "rev" | "pay", v: number) => {
    const newRev = [...arr];
    const newPay = [...arrPay];
    if (field === "rev") newRev[idx] = v; else newPay[idx] = v;
    setInput({
      ...input,
      prev12mMonthlyRevenue: newRev,
      prev12mMonthlyPayroll: newPay,
      prev12mRevenue: newRev.reduce((a, b) => a + b, 0),
      prev12mPayroll: newPay.reduce((a, b) => a + b, 0),
    });
  };

  // Os 12 meses anteriores ao ano-base correspondem a jan..dez do ano (input.year - 1).
  // Índice 0 = janeiro (mês 1, M-12); índice 11 = dezembro (mês 12, M-1).
  const prevYear = input.year - 1;

  return (
    <div className="md:col-span-3 border-t border-border pt-3 mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
      >
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Detalhar receita e folha dos 12 meses anteriores (mês a mês)
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Informe o valor real de cada um dos 12 meses anteriores ao ano-base ({prevYear}). M-1 corresponde ao mês mais recente (dezembro/{prevYear}); M-12 ao mais antigo (janeiro/{prevYear}).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => {
              const monthNumber = i + 1; // 1..12
              const distanceFromYearBase = 12 - i; // M-12..M-1
              return (
                <div key={i} className="space-y-1 rounded-md border border-border p-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    M-{distanceFromYearBase} · {String(monthNumber).padStart(2, "0")}/{prevYear} ({MONTH_NAMES[i]})
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground">Receita</div>
                    <MoneyInput value={arr[i] || 0} onValueChange={(v) => update(i, "rev", v)} />
                    <div className="text-[10px] text-muted-foreground">Folha</div>
                    <MoneyInput value={arrPay[i] || 0} onValueChange={(v) => update(i, "pay", v)} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
            <span>Total receita 12m: <span className="font-semibold text-foreground">{formatBRL(totalRev)}</span></span>
            <span>Total folha 12m: <span className="font-semibold text-foreground">{formatBRL(totalPay)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
