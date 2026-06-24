import React, { useMemo, useState } from 'react';
import { Project, Task } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  AlertCircle, 
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PhysicalFinancialTabProps {
  project: Project;
}

export default function PhysicalFinancialTab({ project }: PhysicalFinancialTabProps) {
  const { getTasksForProject, loading } = useProjects();
  const tasks = getTasksForProject(project.id);

  // Filter only subtasks (tasks that have a parentId) to avoid double counting
  const subtasks = useMemo(() => tasks.filter(t => t.parentId && t.startDate && t.endDate), [tasks]);
  const parentTasks = useMemo(() => tasks.filter(t => !t.parentId), [tasks]);

  // 1. Calculate project-wide cost aggregates
  const totalBudget = useMemo(() => {
    return subtasks.reduce((sum, t) => sum + (t.cost || 0), 0);
  }, [subtasks]);

  const totalRealized = useMemo(() => {
    return subtasks.reduce((sum, t) => sum + ((t.cost || 0) * (t.percentComplete || 0) / 100), 0);
  }, [subtasks]);

  const overallProgress = useMemo(() => {
    if (totalBudget === 0) return 0;
    return Math.round((totalRealized / totalBudget) * 100);
  }, [totalBudget, totalRealized]);

  const financialDeviation = totalRealized - (totalBudget * (overallProgress / 100)); // Deviation to budget

  // 2. Generate list of months (YYYY-MM) spanning the project duration
  const monthsList = useMemo(() => {
    if (subtasks.length === 0) return [];
    
    // Find absolute bounds
    let minDateStr = project.startDate || subtasks[0].startDate;
    let maxDateStr = project.endDate || subtasks[0].endDate;

    subtasks.forEach(t => {
      if (t.startDate && t.startDate < minDateStr) minDateStr = t.startDate;
      if (t.endDate && t.endDate > maxDateStr) maxDateStr = t.endDate;
    });

    const start = new Date(minDateStr + 'T12:00:00');
    const end = new Date(maxDateStr + 'T12:00:00');
    
    const list: string[] = [];
    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    const limit = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= limit) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      list.push(`${year}-${month}`);
      current.setMonth(current.getMonth() + 1);
      
      // Safety break to prevent infinite loops
      if (list.length > 60) break;
    }
    return list;
  }, [subtasks, project]);

  // Format month YYYY-MM to pt-BR (e.g. "Jan/26")
  const formatMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  // 3. Distribute planned & realized costs monthly for each task
  const taskDistributions = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    return subtasks.map(task => {
      const start = new Date(task.startDate + 'T12:00:00');
      const end = new Date(task.endDate + 'T12:00:00');
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      
      const cost = task.cost || 0;
      const pct = task.percentComplete || 0;
      const realizedCost = cost * (pct / 100);

      // Monthly distribution map
      const distribution: Record<string, { planned: number; realized: number; physicalPlanned: number; physicalRealized: number }> = {};
      
      monthsList.forEach(mStr => {
        const [y, m] = mStr.split('-').map(Number);
        
        // Boundaries of this month
        const monthStart = new Date(y, m - 1, 1);
        const monthEnd = new Date(y, m, 0); // Last day of month

        // Find overlap days between task period and this month
        const overlapStart = new Date(Math.max(start.getTime(), monthStart.getTime()));
        const overlapEnd = new Date(Math.min(end.getTime(), monthEnd.getTime()));

        if (overlapStart <= overlapEnd) {
          const overlapDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const ratio = overlapDays / totalDays;
          
          distribution[mStr] = {
            planned: cost * ratio,
            realized: realizedCost * ratio,
            physicalPlanned: ratio * 100,
            physicalRealized: ratio * pct
          };
        } else {
          distribution[mStr] = { planned: 0, realized: 0, physicalPlanned: 0, physicalRealized: 0 };
        }
      });

      return {
        taskId: task.id,
        name: task.name,
        totalCost: cost,
        percentComplete: pct,
        distribution
      };
    });
  }, [subtasks, monthsList]);

  // 4. Calculate monthly aggregated project data for chart and tables
  const monthlyAggregates = useMemo(() => {
    let cumulativePlannedCost = 0;
    let cumulativeRealizedCost = 0;

    return monthsList.map(monthStr => {
      let plannedCost = 0;
      let realizedCost = 0;

      taskDistributions.forEach(taskDist => {
        const dist = taskDist.distribution[monthStr];
        if (dist) {
          plannedCost += dist.planned;
          realizedCost += dist.realized;
        }
      });

      cumulativePlannedCost += plannedCost;
      cumulativeRealizedCost += realizedCost;

      const cumPlannedPct = totalBudget > 0 ? (cumulativePlannedCost / totalBudget) * 100 : 0;
      const cumRealizedPct = totalBudget > 0 ? (cumulativeRealizedCost / totalBudget) * 100 : 0;

      return {
        month: monthStr,
        label: formatMonthLabel(monthStr),
        plannedCost,
        realizedCost,
        cumulativePlannedCost,
        cumulativeRealizedCost,
        plannedProgress: Math.min(100, cumPlannedPct),
        realizedProgress: Math.min(100, cumRealizedPct)
      };
    });
  }, [monthsList, taskDistributions, totalBudget]);

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (loading) {
    return (
      <div className="card-elevated p-12 text-center text-muted-foreground animate-pulse">
        Carregando dados físico-financeiros...
      </div>
    );
  }

  if (subtasks.length === 0) {
    return (
      <div className="card-elevated p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
        <Layers className="w-12 h-12 text-muted-foreground/35 animate-bounce-subtle" />
        <p className="font-semibold text-foreground/80">Nenhuma subetapa cadastrada no planejamento.</p>
        <p className="text-xs max-w-sm text-muted-foreground">Cadastre atividades com datas e orçamentos na aba de Planejamento para visualizar o cronograma físico-financeiro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-xl text-foreground tracking-tight">Cronograma Físico-Financeiro</h2>
          <p className="text-xs text-muted-foreground">Acompanhamento de desembolso mensal, desvio financeiro e curvas de progresso agregadas.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-elevated p-5 space-y-2 border-l-4 border-l-primary relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10"><DollarSign className="w-10 h-10 text-primary" /></div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Orçamento Total da Obra</p>
          <p className="text-2xl font-display font-black text-foreground tracking-tight">{formatCurrency(totalBudget)}</p>
          <p className="text-[10px] text-muted-foreground">Soma de todas as subetapas planejadas.</p>
        </div>

        <div className="card-elevated p-5 space-y-2 border-l-4 border-l-emerald-500 relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10"><CheckCircle2 className="w-10 h-10 text-emerald-500" /></div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Valor Realizado (Medição)</p>
          <p className="text-2xl font-display font-black text-emerald-600 tracking-tight">{formatCurrency(totalRealized)}</p>
          <p className="text-[10px] text-emerald-600/85 font-semibold">Corresponde a {overallProgress}% físico-financeiro.</p>
        </div>

        <div className="card-elevated p-5 space-y-2 border-l-4 border-l-amber-500 relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10"><TrendingUp className="w-10 h-10 text-amber-500" /></div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Desvio Financeiro</p>
          <p className={`text-2xl font-display font-black tracking-tight ${financialDeviation >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {financialDeviation >= 0 ? `+${formatCurrency(financialDeviation)}` : formatCurrency(financialDeviation)}
          </p>
          <p className="text-[10px] text-muted-foreground">Desvio em relação ao progresso físico real.</p>
        </div>

        <div className="card-elevated p-5 space-y-2 border-l-4 border-l-blue-600 relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10"><Percent className="w-10 h-10 text-blue-600" /></div>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">PPC Físico-Financeiro</p>
          <p className="text-2xl font-display font-black text-blue-600 tracking-tight">{overallProgress}%</p>
          <p className="text-[10px] text-muted-foreground">Progresso agregado ponderado pelo custo.</p>
        </div>
      </div>

      {/* Dual Axis S-Curve Chart */}
      <div className="card-elevated p-5">
        <h3 className="text-xs font-black uppercase text-muted-foreground mb-4 tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-primary" /> Curvas S Físico-Financeiras Acumuladas
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyAggregates} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
              <YAxis 
                yAxisId="left" 
                tick={{ fontSize: 10 }} 
                stroke="hsl(var(--primary))" 
                unit="%" 
                label={{ value: 'Progresso Físico (%)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--primary))' } }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10 }} 
                stroke="hsl(var(--emerald-600))" 
                label={{ value: 'Desembolso (R$)', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: 'hsl(var(--emerald-600))' } }}
              />
              <Tooltip 
                formatter={(value: any, name: string) => {
                  if (name.includes('Progress')) return [`${Number(value).toFixed(1)}%`, name === 'realizedProgress' ? 'Progresso Realizado' : 'Progresso Planejado'];
                  return [formatCurrency(Number(value)), name === 'cumulativeRealizedCost' ? 'Desembolso Realizado' : 'Desembolso Planejado'];
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11 }} />
              
              {/* Bars for monthly planned disbursement */}
              <Bar yAxisId="right" name="Desembolso Planejado" dataKey="plannedCost" fill="hsl(var(--primary)/0.15)" stroke="hsl(var(--primary)/0.3)" barSize={25} />
              
              {/* Lines for Cumulative Progress */}
              <Line yAxisId="left" type="monotone" name="Progresso Planejado (%)" dataKey="plannedProgress" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line yAxisId="left" type="monotone" name="Progresso Realizado (%)" dataKey="realizedProgress" stroke="hsl(var(--chart-actual))" strokeWidth={3} dot={{ r: 5 }} />
              
              {/* Lines for Cumulative Costs */}
              <Line yAxisId="right" type="monotone" name="Desembolso Planejado Acumulado" dataKey="cumulativePlannedCost" stroke="hsl(var(--primary)/0.6)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              <Line yAxisId="right" type="monotone" name="Desembolso Realizado Acumulado" dataKey="cumulativeRealizedCost" stroke="hsl(var(--emerald-600))" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Physical Financial Matrix Grid */}
      <div className="card-elevated p-0 overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" /> Matriz de Distribuição Mensal
          </h3>
          <Badge variant="secondary" className="text-[10px] font-bold">Total: {monthsList.length} meses</Badge>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-muted-foreground font-bold">
                <th className="py-3 px-4 text-left border-r border-border min-w-[220px]">Etapa / Atividade</th>
                <th className="py-3 px-3 text-right border-r border-border min-w-[110px]">Orçamento</th>
                <th className="py-3 px-2 text-center border-r border-border min-w-[70px]">% Fís.</th>
                {monthsList.map(mStr => (
                  <th key={mStr} className="py-3 px-3 text-center border-r border-border min-w-[120px] last:border-r-0">
                    {formatMonthLabel(mStr)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Project Total / Summary row */}
              <tr className="border-b border-border bg-primary/[0.04] font-bold text-foreground">
                <td className="py-2.5 px-4 border-r border-border flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span>TOTAL DO PROJETO</span>
                </td>
                <td className="py-2.5 px-3 text-right border-r border-border text-primary font-black">
                  {formatCurrency(totalBudget)}
                </td>
                <td className="py-2.5 px-2 text-center border-r border-border text-primary font-black">
                  {overallProgress}%
                </td>
                {monthlyAggregates.map(agg => (
                  <td key={agg.month} className="py-2 px-3 border-r border-border last:border-r-0 text-[10px] space-y-1">
                    <div className="flex justify-between gap-1 text-primary">
                      <span>Plan:</span>
                      <span>{formatCurrency(agg.plannedCost)}</span>
                    </div>
                    <div className="flex justify-between gap-1 text-emerald-600">
                      <span>Real:</span>
                      <span>{formatCurrency(agg.realizedCost)}</span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Individual task rows */}
              {parentTasks.map(parent => {
                const parentSubs = subtasks.filter(t => t.parentId === parent.id);
                const parentBudget = parentSubs.reduce((sum, s) => sum + (s.cost || 0), 0);
                const parentRealizedVal = parentSubs.reduce((sum, s) => sum + ((s.cost || 0) * (s.percentComplete || 0) / 100), 0);
                const parentPhys = parentBudget > 0 ? Math.round((parentRealizedVal / parentBudget) * 100) : 0;

                return (
                  <React.Fragment key={parent.id}>
                    {/* Stage Header Row */}
                    <tr className="border-b border-border bg-muted/10 font-bold">
                      <td className="py-2.5 px-4 border-r border-border text-foreground uppercase tracking-tight text-[10px]">
                        📁 {parent.name}
                      </td>
                      <td className="py-2.5 px-3 text-right border-r border-border text-foreground">
                        {formatCurrency(parentBudget)}
                      </td>
                      <td className="py-2.5 px-2 text-center border-r border-border text-foreground">
                        {parentPhys}%
                      </td>
                      {monthsList.map(mStr => {
                        let monthlyPlan = 0;
                        let monthlyReal = 0;

                        parentSubs.forEach(sub => {
                          const dist = taskDistributions.find(d => d.taskId === sub.id);
                          const mData = dist?.distribution[mStr];
                          if (mData) {
                            monthlyPlan += mData.planned;
                            monthlyReal += mData.realized;
                          }
                        });

                        return (
                          <td key={mStr} className="py-2 px-3 border-r border-border last:border-r-0 text-[10px] space-y-0.5">
                            {monthlyPlan > 0 && (
                              <div className="flex justify-between gap-1 text-muted-foreground/80 font-medium">
                                <span>Plan:</span>
                                <span>{formatCurrency(monthlyPlan)}</span>
                              </div>
                            )}
                            {monthlyReal > 0 && (
                              <div className="flex justify-between gap-1 text-emerald-600/90 font-bold">
                                <span>Real:</span>
                                <span>{formatCurrency(monthlyReal)}</span>
                              </div>
                            )}
                            {monthlyPlan === 0 && monthlyReal === 0 && (
                              <span className="text-muted-foreground/35 block text-center">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Subtasks rows */}
                    {parentSubs.map(sub => {
                      const dist = taskDistributions.find(d => d.taskId === sub.id);

                      return (
                        <tr key={sub.id} className="border-b border-border/60 hover:bg-muted/5 transition-colors">
                          <td className="py-2 px-4 border-r border-border text-foreground/80 pl-8 truncate max-w-[260px]" title={sub.name}>
                            ↳ {sub.name}
                          </td>
                          <td className="py-2 px-3 text-right border-r border-border font-medium text-foreground/75">
                            {formatCurrency(sub.cost || 0)}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-border font-semibold text-foreground/75">
                            {sub.percentComplete}%
                          </td>
                          {monthsList.map(mStr => {
                            const mData = dist?.distribution[mStr];
                            
                            return (
                              <td key={mStr} className="py-2 px-3 border-r border-border last:border-r-0 text-[10px] space-y-0.5">
                                {mData && mData.planned > 0 && (
                                  <div className="flex justify-between gap-1 text-muted-foreground/70">
                                    <span>P: {Math.round(mData.physicalPlanned)}%</span>
                                    <span>{formatCurrency(mData.planned)}</span>
                                  </div>
                                )}
                                {mData && mData.realized > 0 && (
                                  <div className="flex justify-between gap-1 text-emerald-600/80 font-medium">
                                    <span>R: {Math.round(mData.physicalRealized / mData.physicalPlanned)}%</span>
                                    <span>{formatCurrency(mData.realized)}</span>
                                  </div>
                                )}
                                {(!mData || (mData.planned === 0 && mData.realized === 0)) && (
                                  <span className="text-muted-foreground/30 block text-center">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
