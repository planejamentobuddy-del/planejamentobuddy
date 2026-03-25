import { useState, useMemo } from 'react';
import { Project, DELAY_REASONS, WeeklyPlan, Task } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, Calendar, Eye, BarChart3, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function getWeekRange(weekStr: string): { start: Date; end: Date; label: string } {
  // Parse "YYYY-SWW" format
  const match = weekStr.match(/(\d{4})-S(\d{2})/);
  if (!match) return { start: new Date(), end: new Date(), label: weekStr };
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);
  const jan1 = new Date(year, 0, 1);
  const dayOffset = (weekNum - 1) * 7 - jan1.getDay() + 1;
  const start = new Date(year, 0, 1 + dayOffset);
  const end = new Date(start.getTime() + 6 * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return { start, end, label: `${fmt(start)} — ${fmt(end)}` };
}

function getCurrentWeek(): string {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${now.getFullYear()}-S${weekNum.toString().padStart(2, '0')}`;
}

function offsetWeek(weekStr: string, offset: number): string {
  const match = weekStr.match(/(\d{4})-S(\d{2})/);
  if (!match) return weekStr;
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]) + offset;
  if (weekNum < 1) return `${year - 1}-S52`;
  if (weekNum > 52) return `${year + 1}-S01`;
  return `${year}-S${weekNum.toString().padStart(2, '0')}`;
}

const statusOptions = [
  { value: 'planned', label: 'Planejado', color: 'bg-muted text-muted-foreground' },
  { value: 'completed', label: 'Concluído', color: 'bg-[hsl(152_60%_42%/0.15)] text-status-ok' },
  { value: 'not_completed', label: 'Não concluído', color: 'bg-destructive/10 text-destructive' },
];

export default function LeanTab({ project }: { project: Project }) {
  const {
    getTasksForProject, getPlansForProject, addWeeklyPlan, updateWeeklyPlan,
    deleteWeeklyPlan, getHistoryForProject, closeWeek
  } = useProjects();

  const tasks = getTasksForProject(project.id);
  const plans = getPlansForProject(project.id);
  const history = getHistoryForProject(project.id);

  const [currentWeekStr, setCurrentWeekStr] = useState(getCurrentWeek);
  const weekRange = getWeekRange(currentWeekStr);
  const weekPlans = plans.filter(p => p.week === currentWeekStr);
  const weekCompleted = weekPlans.filter(p => p.status === 'completed').length;
  const ppc = weekPlans.length > 0 ? Math.round((weekCompleted / weekPlans.length) * 100) : null;
  const ppcColor = ppc === null ? 'text-muted-foreground' : ppc >= 80 ? 'text-status-ok' : ppc >= 60 ? 'text-status-warning' : 'text-status-danger';

  // Add a task from planning to the weekly plan
  const handleAddFromPlanning = async (task: Task) => {
    // Don't add duplicates
    if (weekPlans.some(p => p.taskId === task.id)) return;
    await addWeeklyPlan({
      projectId: project.id,
      taskId: task.id,
      taskName: task.name,
      responsible: task.responsible,
      week: currentWeekStr,
      weekLabel: currentWeekStr,
      status: 'planned',
      reason: '',
      observations: '',
    });
  };

  const handleChange = async (plan: WeeklyPlan, field: keyof WeeklyPlan, value: string) => {
    await updateWeeklyPlan({ ...plan, [field]: value });
  };

  const handleCloseWeek = async () => {
    await closeWeek(project.id);
  };

  // Tasks not yet in this week's plan
  const availableTasks = tasks.filter(t => !weekPlans.some(p => p.taskId === t.id));

  const chartData = history.sort((a, b) => a.week.localeCompare(b.week)).map(h => ({
    week: h.weekLabel,
    PPC: h.ppc,
  }));

  const formatDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

  return (
    <div className="space-y-5">
      <Tabs defaultValue="semanal">
        {/* Sub-tabs */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList className="bg-transparent border-0 p-0 h-auto gap-1">
            <TabsTrigger value="semanal" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calendar className="w-4 h-4" /> Semanal
            </TabsTrigger>
            <TabsTrigger value="lookahead" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground">
              <Eye className="w-4 h-4" /> Lookahead
            </TabsTrigger>
            <TabsTrigger value="indicadores" className="gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground">
              <BarChart3 className="w-4 h-4" /> Indicadores
            </TabsTrigger>
          </TabsList>

          {/* Week navigation + PPC */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCurrentWeekStr(w => offsetWeek(w, -1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium text-foreground min-w-[140px] text-center">{weekRange.label}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCurrentWeekStr(w => offsetWeek(w, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setCurrentWeekStr(getCurrentWeek())}>
                Hoje
              </Button>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-card">
              <span className="text-xs font-medium text-muted-foreground">PPC</span>
              <span className={`text-lg font-display font-bold ${ppcColor}`}>{ppc !== null ? `${ppc}%` : '—'}</span>
            </div>
          </div>
        </div>

        {/* Semanal Tab */}
        <TabsContent value="semanal" className="mt-5 space-y-5">
          {/* Add tasks from planning */}
          {availableTasks.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Adicionar do planejamento:</span>
              <Select onValueChange={v => {
                const task = tasks.find(t => t.id === v);
                if (task) handleAddFromPlanning(task);
              }}>
                <SelectTrigger className="h-8 w-[250px] text-xs rounded-xl">
                  <SelectValue placeholder="Selecionar tarefa..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTasks.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Weekly table */}
          <div className="card-elevated overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '900px' }}>
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tarefa</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Responsável</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Início</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Término</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Progresso</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status Lean</th>
                  <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Motivo</th>
                  <th className="text-center py-3 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Restrição</th>
                </tr>
              </thead>
              <tbody>
                {weekPlans.map(plan => {
                  const linkedTask = tasks.find(t => t.id === plan.taskId);
                  const stOpt = statusOptions.find(s => s.value === plan.status) || statusOptions[0];
                  const progress = linkedTask?.percentComplete ?? 0;
                  const progressColor = progress >= 100 ? 'bg-status-ok' : progress > 0 ? 'bg-accent' : 'bg-muted-foreground/20';

                  return (
                    <tr key={plan.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{plan.taskName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{plan.responsible || '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{linkedTask ? formatDate(linkedTask.startDate) : '—'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{linkedTask ? formatDate(linkedTask.endDate) : '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: progress > 0 ? 'hsl(243 76% 58%)' : 'hsl(228 15% 80%)' }} />
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${progressColor} transition-all`} style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Select value={plan.status} onValueChange={v => handleChange(plan, 'status', v)}>
                          <SelectTrigger className="h-8 text-xs border-0 bg-transparent px-0 w-[140px]">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${stOpt.color}`}>
                              {stOpt.label}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 px-4">
                        {plan.status === 'not_completed' ? (
                          <Input
                            className="h-8 text-sm border-0 bg-transparent px-1"
                            value={plan.reason}
                            onChange={e => handleChange(plan, 'reason', e.target.value)}
                            placeholder="Motivo..."
                          />
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {linkedTask?.hasRestriction ? (
                          <AlertTriangle className="w-4 h-4 text-status-warning mx-auto" />
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {weekPlans.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                      Selecione tarefas do planejamento para adicionar à semana
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button onClick={handleCloseWeek} className="rounded-xl gap-2 px-6">
              Fechar Semana
            </Button>
          </div>

          {/* PPC History badges */}
          {history.length > 0 && (
            <div className="card-elevated p-5">
              <h3 className="font-display font-bold text-sm mb-4">Histórico PPC por Semana</h3>
              <div className="flex flex-wrap gap-3">
                {history.sort((a, b) => a.week.localeCompare(b.week)).map(h => {
                  const range = getWeekRange(h.week);
                  const bgColor = h.ppc >= 80
                    ? 'bg-[hsl(152_60%_42%/0.08)] border-[hsl(152_60%_42%/0.2)]'
                    : h.ppc >= 60
                    ? 'bg-[hsl(38_92%_50%/0.08)] border-[hsl(38_92%_50%/0.2)]'
                    : 'bg-destructive/5 border-destructive/20';
                  const textColor = h.ppc >= 80 ? 'text-status-ok' : h.ppc >= 60 ? 'text-status-warning' : 'text-destructive';

                  return (
                    <div key={h.id} className={`flex flex-col items-center px-4 py-2.5 rounded-xl border ${bgColor}`}>
                      <span className="text-[10px] text-muted-foreground">{range.start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      <span className={`text-lg font-display font-bold ${textColor}`}>{h.ppc}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Lookahead Tab */}
        <TabsContent value="lookahead" className="mt-5">
          <div className="card-elevated p-8 text-center text-muted-foreground text-sm">
            Lookahead — planejamento de 3 a 6 semanas à frente (em desenvolvimento)
          </div>
        </TabsContent>

        {/* Indicadores Tab */}
        <TabsContent value="indicadores" className="mt-5 space-y-5">
          {chartData.length > 0 ? (
            <div className="card-elevated p-6">
              <h3 className="font-display font-bold text-base mb-5">Evolução do PPC</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 15% 90%)" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(224 10% 48%)" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(224 10% 48%)" tickFormatter={v => `${v}%`} />
                    <Tooltip />
                    <ReferenceLine y={80} stroke="hsl(152 60% 42%)" strokeDasharray="4 4" label="Meta 80%" />
                    <Line type="monotone" dataKey="PPC" stroke="hsl(243 76% 58%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(243 76% 58%)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="card-elevated p-12 text-center text-muted-foreground text-sm">
              Feche semanas para ver os indicadores de PPC
            </div>
          )}

          {/* Delay reasons ranking */}
          {(() => {
            const reasonCount: Record<string, number> = {};
            plans.filter(p => p.status === 'not_completed' && p.reason).forEach(p => {
              reasonCount[p.reason] = (reasonCount[p.reason] || 0) + 1;
            });
            const ranked = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]);
            if (ranked.length === 0) return null;
            return (
              <div className="card-elevated p-6">
                <h3 className="font-display font-bold text-base mb-4">Motivos de Não Cumprimento</h3>
                <div className="space-y-2.5">
                  {ranked.map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{reason}</span>
                      <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
