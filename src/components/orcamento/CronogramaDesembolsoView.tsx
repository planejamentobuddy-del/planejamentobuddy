import React, { useState } from 'react';
import { useBudget } from '@/hooks/useBudget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus } from 'lucide-react';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatPercent(val: number, dec: number = 2): string {
  return `${val.toFixed(dec)}%`;
}

export function CronogramaDesembolsoView() {
  const {
    activeProject,
    sellingPriceTotal,
    stageSummaries,
    updateDisbursementSchedule,
  } = useBudget();

  const schedule = activeProject?.disbursementSchedule || {
    monthsCount: 6,
    monthsLabels: ['Mês 1', 'Mês 2', 'Mês 3', 'Mês 4', 'Mês 5', 'Mês 6'],
    distributions: {},
  };

  const [monthsCount, setMonthsCount] = useState(schedule.monthsCount);

  const handlePercentageChange = (stageId: string, monthIndex: number, valueStr: string) => {
    const val = parseFloat(valueStr) || 0;
    const currentDist = schedule.distributions[stageId]
      ? [...schedule.distributions[stageId]]
      : new Array(monthsCount).fill(0);

    while (currentDist.length < monthsCount) currentDist.push(0);
    currentDist[monthIndex] = Math.max(0, Math.min(100, val));

    const newDistributions = {
      ...schedule.distributions,
      [stageId]: currentDist,
    };

    updateDisbursementSchedule({
      ...schedule,
      monthsCount,
      distributions: newDistributions,
    });
  };

  const handleMonthsChange = (newCount: number) => {
    if (newCount < 2 || newCount > 24) return;
    setMonthsCount(newCount);

    const newLabels = Array.from({ length: newCount }, (_, i) => `Mês ${i + 1}`);

    const newDistributions: Record<string, number[]> = {};
    Object.keys(schedule.distributions).forEach(stageId => {
      const arr = [...(schedule.distributions[stageId] || [])];
      while (arr.length < newCount) arr.push(0);
      newDistributions[stageId] = arr.slice(0, newCount);
    });

    updateDisbursementSchedule({
      monthsCount: newCount,
      monthsLabels: newLabels,
      distributions: newDistributions,
    });
  };

  const monthCalculations = React.useMemo(() => {
    const totals = new Array(monthsCount).fill(0);

    stageSummaries.forEach(s => {
      const dist = schedule.distributions[s.stageId] || new Array(monthsCount).fill(0);
      dist.forEach((pct, idx) => {
        if (idx < monthsCount) {
          totals[idx] += (s.sellingPrice * (pct || 0)) / 100;
        }
      });
    });

    let running = 0;
    const accumulated = totals.map(val => {
      running += val;
      return running;
    });

    const percentages = totals.map(val => {
      return sellingPriceTotal > 0 ? (val / sellingPriceTotal) * 100 : 0;
    });

    let runningPct = 0;
    const accumulatedPercentages = percentages.map(pct => {
      runningPct += pct;
      return Math.min(100, runningPct);
    });

    return {
      totals,
      accumulated,
      percentages,
      accumulatedPercentages,
    };
  }, [stageSummaries, schedule, monthsCount, sellingPriceTotal]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-card rounded-2xl border shadow-sm">
        <div>
          <h3 className="font-bold font-display text-base text-foreground">
            Cronograma Físico-Financeiro de Desembolso
          </h3>
          <p className="text-xs text-muted-foreground">
            Distribua a evolução percentual de cada etapa pelos meses da obra para calcular o fluxo de caixa
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl text-xs">
            <span className="px-2 text-muted-foreground font-medium">Prazo:</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => handleMonthsChange(monthsCount - 1)}
              disabled={monthsCount <= 2}
            >
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <span className="font-bold text-foreground px-1">{monthsCount} Meses</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => handleMonthsChange(monthsCount + 1)}
              disabled={monthsCount >= 24}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
              <tr>
                <th className="p-3 w-16 text-center">Item</th>
                <th className="p-3 min-w-[200px]">Etapa da Obra</th>
                <th className="p-3 text-right min-w-[130px]">Valor c/ BDI</th>
                <th className="p-3 text-center w-20">Soma %</th>
                {Array.from({ length: monthsCount }).map((_, i) => (
                  <th key={i} className="p-3 text-center min-w-[85px]">
                    Mês {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {stageSummaries.map(stage => {
                const dist =
                  schedule.distributions[stage.stageId] || new Array(monthsCount).fill(0);
                const sumPct = dist.reduce((acc, v) => acc + (v || 0), 0);
                const isComplete = Math.abs(sumPct - 100) < 0.1;

                return (
                  <tr key={stage.stageId} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-center font-mono font-bold text-muted-foreground">
                      {stage.code}
                    </td>
                    <td className="p-3 font-medium text-foreground">{stage.title}</td>
                    <td className="p-3 text-right font-display font-semibold text-foreground">
                      {formatCurrency(stage.sellingPrice)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] w-12 inline-block py-0.5 rounded-full font-bold border ${
                          isComplete
                            ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                        }`}
                      >
                        {formatPercent(sumPct, 0)}
                      </span>
                    </td>

                    {Array.from({ length: monthsCount }).map((_, mIdx) => {
                      const pct = dist[mIdx] || 0;
                      const monthVal = (stage.sellingPrice * pct) / 100;

                      return (
                        <td key={mIdx} className="p-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <Input
                              type="number"
                              step="5"
                              min="0"
                              max="100"
                              value={pct || ''}
                              placeholder="0"
                              onChange={e =>
                                handlePercentageChange(stage.stageId, mIdx, e.target.value)
                              }
                              className="h-7 w-16 text-xs text-center p-1 rounded-lg border-muted-foreground/30"
                            />
                            {monthVal > 0 && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {formatCurrency(monthVal)}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="bg-muted/60 font-semibold border-t-2 border-border">
              <tr>
                <td colSpan={2} className="p-3 font-bold text-foreground">
                  DESEMBOLSO MENSAL PREVISTO
                </td>
                <td className="p-3 text-right font-display font-bold text-primary text-sm">
                  {formatCurrency(sellingPriceTotal)}
                </td>
                <td className="p-3 text-center text-xs text-muted-foreground">100%</td>
                {monthCalculations.totals.map((val, i) => (
                  <td key={i} className="p-3 text-center font-mono font-bold text-foreground">
                    {formatCurrency(val)}
                  </td>
                ))}
              </tr>

              <tr className="text-muted-foreground font-normal">
                <td colSpan={2} className="p-2.5 pl-3 text-xs">
                  Participação no Mês (%)
                </td>
                <td className="p-2.5 text-right font-mono text-xs">100,00%</td>
                <td></td>
                {monthCalculations.percentages.map((pct, i) => (
                  <td key={i} className="p-2.5 text-center font-mono text-xs">
                    {formatPercent(pct, 1)}
                  </td>
                ))}
              </tr>

              <tr className="bg-primary/5 text-primary font-bold">
                <td colSpan={2} className="p-3 text-xs uppercase tracking-wider">
                  Avanço Físico-Financeiro Acumulado
                </td>
                <td className="p-3 text-right font-mono text-xs">100,00%</td>
                <td></td>
                {monthCalculations.accumulatedPercentages.map((accPct, i) => (
                  <td key={i} className="p-3 text-center font-mono text-xs">
                    {formatPercent(accPct, 1)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
