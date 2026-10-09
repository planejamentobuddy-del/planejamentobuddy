import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { StageSummary } from '@/hooks/useBudget';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatPercent(val: number, dec: number = 2): string {
  return `${val.toFixed(dec)}%`;
}

// Paleta de cores vibrantes e contrastantes para cada etapa (como no mockup)
const DONUT_COLORS = [
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#8b5cf6', // purple-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#64748b', // slate-500
  '#84cc16', // lime-500
  '#d946ef', // fuchsia-500
  '#0284c7', // sky-600
  '#e11d48', // rose-600
];

interface BudgetDonutChartProps {
  summaries: StageSummary[];
  viewMode: 'cost' | 'selling';
  totalArea: number;
}

export function BudgetDonutChart({ summaries, viewMode, totalArea }: BudgetDonutChartProps) {
  const chartData = useMemo(() => {
    return summaries
      .filter((s) => (viewMode === 'selling' ? s.sellingPrice : s.directCost) > 0)
      .map((s, idx) => {
        const val = viewMode === 'selling' ? s.sellingPrice : s.directCost;
        const valPerM2 = totalArea > 0 ? val / totalArea : 0;
        return {
          name: `Etapa ${s.code} – ${s.title.toUpperCase()}`,
          shortName: `Etapa ${s.code}`,
          code: s.code,
          title: s.title,
          value: val,
          valPerM2,
          percentage: s.percentageOfTotal,
          color: DONUT_COLORS[idx % DONUT_COLORS.length],
        };
      });
  }, [summaries, viewMode, totalArea]);

  const totalValue = useMemo(() => {
    return chartData.reduce((acc, d) => acc + d.value, 0);
  }, [chartData]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-2xl border p-5 sm:p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h4 className="text-sm sm:text-base font-bold font-display text-foreground">
            Distribuição Gráfica do Orçamento por Etapa
          </h4>
          <p className="text-xs text-muted-foreground">
            Visualização consolidada para apresentação ao cliente ({viewMode === 'selling' ? 'Preço de Venda com BDI' : 'Custo Direto'})
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Total Consolidado
          </span>
          <span className="text-sm sm:text-base font-black font-display text-primary">
            {formatCurrency(totalValue)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Rosca Central */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[280px]">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={105}
                paddingAngle={2}
                animationDuration={800}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: number, name: string, props: any) => {
                  const entry = props.payload;
                  return [
                    `${formatCurrency(val)} (${formatPercent(entry.percentage, 2)}) - ${formatCurrency(entry.valPerM2)}/m²`,
                    entry.name,
                  ];
                }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '12px',
                  fontSize: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Badge central do Donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              {viewMode === 'selling' ? 'Venda' : 'Custo'}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-foreground font-mono">
              {formatCurrency(totalValue)}
            </span>
            {totalArea > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {formatCurrency(totalValue / totalArea)}/m²
              </span>
            )}
          </div>
        </div>

        {/* Callouts e Detalhamento das Etapas (estilo Imagem 4) */}
        <div className="lg:col-span-7 space-y-2.5 max-h-[380px] overflow-y-auto pr-2">
          {chartData.map((item) => (
            <div
              key={item.code}
              className="p-2.5 sm:p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-all flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <span className="font-bold text-foreground block truncate">
                    Etapa {item.code} – {item.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatCurrency(item.valPerM2)} / m²
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-bold font-mono text-foreground block">
                  {formatCurrency(item.value)}
                </span>
                <span className="text-[11px] font-bold text-primary font-mono">
                  ({formatPercent(item.percentage, 2)})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
