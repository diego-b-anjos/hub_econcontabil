import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface ResultadoPorAno {
  ano: number;
  fase: string;
  simples: { totalTributos: number; cargaEfetiva: number };
  presumido: { totalTributos: number; cargaEfetiva: number };
  real: { totalTributos: number; cargaEfetiva: number };
  melhorOpcao: string;
}

interface Props {
  resultadosPorAno: ResultadoPorAno[];
  receitaAnual: number;
}

const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor);
};

const GraficoTransicao: React.FC<Props> = ({ resultadosPorAno, receitaAnual }) => {
  const dadosGrafico = useMemo(() => {
    return resultadosPorAno.map(r => ({
      ano: r.ano,
      fase: r.fase,
      'Simples Nacional': r.simples.totalTributos,
      'Lucro Presumido': r.presumido.totalTributos,
      'Lucro Real': r.real.totalTributos,
      simplesPercent: r.simples.cargaEfetiva,
      presumidoPercent: r.presumido.cargaEfetiva,
      realPercent: r.real.cargaEfetiva,
      melhor: r.melhorOpcao
    }));
  }, [resultadosPorAno]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg">
          <p className="font-bold text-foreground mb-2">Ano {label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-mono font-medium" style={{ color: entry.color }}>
                {formatarMoeda(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomTooltipPercent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur border rounded-lg p-3 shadow-lg">
          <p className="font-bold text-foreground mb-2">Ano {label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-mono font-medium" style={{ color: entry.color }}>
                {entry.value.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (resultadosPorAno.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Gráfico de Linha - Carga Tributária em R$ */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução da Carga Tributária (R$) - Período de Transição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosGrafico} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="ano" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tickFormatter={(v) => formatarMoeda(v)}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="Simples Nacional" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'hsl(142, 76%, 36%)' }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Lucro Presumido" 
                  stroke="hsl(221, 83%, 53%)" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'hsl(221, 83%, 53%)' }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Lucro Real" 
                  stroke="hsl(262, 83%, 58%)" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'hsl(262, 83%, 58%)' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Área - Carga Efetiva % */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução da Carga Efetiva (%) - Período de Transição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosGrafico} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="ano" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  domain={[0, 'auto']}
                />
                <Tooltip content={<CustomTooltipPercent />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="simplesPercent" 
                  name="Simples Nacional"
                  stroke="hsl(142, 76%, 36%)" 
                  fill="hsl(142, 76%, 36%)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="presumidoPercent" 
                  name="Lucro Presumido"
                  stroke="hsl(221, 83%, 53%)" 
                  fill="hsl(221, 83%, 53%)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="realPercent"
                  name="Lucro Real" 
                  stroke="hsl(262, 83%, 58%)" 
                  fill="hsl(262, 83%, 58%)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Barras Comparativo */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Comparativo por Ano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="ano" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tickFormatter={(v) => formatarMoeda(v)}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  dataKey="Simples Nacional" 
                  fill="hsl(142, 76%, 36%)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="Lucro Presumido" 
                  fill="hsl(221, 83%, 53%)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="Lucro Real" 
                  fill="hsl(262, 83%, 58%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GraficoTransicao;
