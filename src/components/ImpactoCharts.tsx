import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Comparativo } from "@/lib/apuracao-trim";
import { formatBRL } from "@/lib/tax-engine";

export function ComparativoBarChart({ comp }: { comp: Comparativo }) {
  const data = [
    { name: "IRPJ", "Sem Majoração": Math.round(comp.semMajoracao.irpjAPagar), "Com Majoração": Math.round(comp.comMajoracao.irpjAPagar) },
    { name: "CSLL", "Sem Majoração": Math.round(comp.semMajoracao.csllAPagar), "Com Majoração": Math.round(comp.comMajoracao.csllAPagar) },
    { name: "TOTAL", "Sem Majoração": Math.round(comp.semMajoracao.totalAPagar), "Com Majoração": Math.round(comp.comMajoracao.totalAPagar) },
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Sem Majoração" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Com Majoração" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ImpactoReceitaPie({ comp }: { comp: Comparativo }) {
  const receita = comp.comMajoracao.receitaTotal;
  const imposto = comp.comMajoracao.totalAPagar;
  const liquido = Math.max(0, receita - imposto);
  const aumento = comp.diffTotal;
  const data = [
    { name: "Receita Líquida", value: Math.round(liquido), color: "hsl(var(--secondary))" },
    { name: "Imposto (sem majoração)", value: Math.round(comp.semMajoracao.totalAPagar), color: "hsl(var(--muted-foreground))" },
    { name: "Aumento da majoração", value: Math.round(Math.max(0, aumento)), color: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}
          label={({ percent }) => `${((percent ?? 0) * 100).toFixed(1)}%`} labelLine={false}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v: number) => formatBRL(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
