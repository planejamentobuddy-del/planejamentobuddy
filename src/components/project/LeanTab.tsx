import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Project, DELAY_REASONS, WeeklyPlan, Task, Constraint, CONSTRAINT_CATEGORIES, ConstraintCategory } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, ChevronRight, Calendar, Eye, BarChart3, 
  AlertTriangle, CheckCircle2, Plus, Trash2, Filter,
  Lock, Unlock, Clock, AlertCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'sonner';

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
  { value: 'in_progress', label: 'Em andamento', color: 'bg-blue-500/15 text-blue-600' },
  { value: 'completed', label: 'Concluído', color: 'bg-[hsl(152_60%_42%/0.15)] text-status-ok' },
  { value: 'not_completed', label: 'Não concluído', color: 'bg-destructive/10 text-destructive' },
];

export default function LeanTab({ project }: { project: Project }) {
  const {
    getTasksForProject, getPlansForProject, addWeeklyPlan, updateWeeklyPlan,
    deleteWeeklyPlan, getHistoryForProject, closeWeek,
    getConstraintsForProject, addConstraint, updateConstraint, deleteConstraint,
    users, loading
  } = useProjects();

  const tasks = getTasksForProject(project.id);
  const plans = getPlansForProject(project.id);
  const history = getHistoryForProject(project.id);
  const constraints = getConstraintsForProject(project.id);

  const [currentWeekStr, setCurrentWeekStr] = useState(getCurrentWeek);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('subtab') || 'semanal');

  useEffect(() => {
    const subtab = searchParams.get('subtab');
    if (subtab && subtab !== activeTab) {
      setActiveTab(subtab);
    }
  }, [searchParams]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams(prev => {
      prev.set('subtab', val);
      return prev;
    });
  };
  
  // Constraint Form State
  const [showAddConstraint, setShowAddConstraint] = useState(false);
  const [newConstraint, setNewConstraint] = useState({
    taskId: '',
    description: '',
    category: 'material' as ConstraintCategory,
    responsible: '',
    dueDate: ''
  });

  const weekRange = getWeekRange(currentWeekStr);
  const weekPlans = plans.filter(p => p.week === currentWeekStr);
  const weekCompleted = weekPlans.filter(p => p.status === 'completed' || p.status === 'in_progress').length;
  const ppc = weekPlans.length > 0 ? Math.round((weekCompleted / weekPlans.length) * 100) : null;
  const ppcColor = ppc === null ? 'text-muted-foreground' : ppc >= 80 ? 'text-status-ok' : ppc >= 60 ? 'text-status-warning' : 'text-status-danger';

  const isTaskInWeek = (task: Task) => {
    const s = new Date(task.startDate + 'T12:00:00').getTime();
    const e = new Date(task.endDate + 'T12:00:00').getTime();
    const ws = weekRange.start.getTime();
    const we = weekRange.end.getTime();
    // Overlap condition: start <= weekEnd AND end >= weekStart
    return s <= we && e >= ws;
  };

  // Lookahead weeks (Next 4 weeks)
  const lookaheadWeeks = useMemo(() => {
    return [0, 1, 2, 3].map(offset => {
      const wStr = offsetWeek(currentWeekStr, offset);
      const range = getWeekRange(wStr);
      return { weekStr: wStr, label: range.label, range };
    });
  }, [currentWeekStr]);

  // Tasks sorted by start date
  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')), [tasks]);

  // Chart data for PPC
  const chartData = useMemo(() => {
    return [...history].sort((a, b) => a.week.localeCompare(b.week)).map(h => ({
      week: h.week.split('-')[1], // Just "S01", "S02" etc.
      PPC: h.ppc
    }));
  }, [history]);

  // AUTO-SYNC EFFECT:
  // Automatically add tasks that fall within the current week to the weekly plan
  useEffect(() => {
    const autoSync = async () => {
      const tasksInWeek = tasks.filter(t => isTaskInWeek(t));
      const missingTasks = tasksInWeek.filter(t => !weekPlans.some(p => p.taskId === t.id));
      
      if (missingTasks.length > 0) {
        await Promise.all(missingTasks.map(task => 
          addWeeklyPlan({
            projectId: project.id,
            taskId: task.id,
            taskName: task.name,
            responsible: task.responsible,
            week: currentWeekStr,
            weekLabel: currentWeekStr,
            status: 'planned',
            reason: '',
            observations: '',
          })
        ));
      }
    };

    autoSync();
  }, [currentWeekStr, tasks.length]); // Re-run when week or task count changes

  const handleAddFromPlanning = async (task: Task) => {
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

  const handleCreateConstraint = async () => {
    if (!newConstraint.description) {
      toast.error('Descrição é obrigatória');
      return;
    }
    await addConstraint({
      projectId: project.id,
      taskId: newConstraint.taskId || undefined,
      description: newConstraint.description,
      category: newConstraint.category,
      status: 'open',
      responsible: newConstraint.responsible,
      dueDate: newConstraint.dueDate,
    });
    setShowAddConstraint(false);
    setNewConstraint({ taskId: '', description: '', category: 'material', responsible: '', dueDate: '' });
  };

  const toggleConstraintStatus = async (c: Constraint) => {
    await updateConstraint({
      ...c,
      status: c.status === 'open' ? 'closed' : 'open',
      closedAt: c.status === 'open' ? new Date().toISOString() : undefined
    });
  };

  const formatDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

  return (
    <div className="space-y-5">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* Header with Navigation and Info */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-card p-4 rounded-2xl border border-border/50 shadow-sm">
          <TabsList className="bg-muted/50 p-1 h-auto gap-1 rounded-xl">
            <TabsTrigger value="semanal" className="gap-2 rounded-lg px-4 py-2 text-sm">
              <Calendar className="w-4 h-4" /> Semanal
            </TabsTrigger>
            <TabsTrigger value="lookahead" className="gap-2 rounded-lg px-4 py-2 text-sm">
              <Eye className="w-4 h-4" /> Lookahead
            </TabsTrigger>
            <TabsTrigger value="restricoes" className="gap-2 rounded-lg px-4 py-2 text-sm">
              <Lock className="w-4 h-4" /> Restrições
            </TabsTrigger>
            <TabsTrigger value="indicadores" className="gap-2 rounded-lg px-4 py-2 text-sm">
              <BarChart3 className="w-4 h-4" /> Indicadores
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted" onClick={() => setCurrentWeekStr(w => offsetWeek(w, -1))}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col items-center min-w-[160px]">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">{currentWeekStr}</span>
                <span className="text-sm font-medium text-muted-foreground">{weekRange.label}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted" onClick={() => setCurrentWeekStr(w => offsetWeek(w, 1))}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="h-10 w-px bg-border/60 mx-2 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase tracking-tighter font-bold text-muted-foreground">Progresso Semanal</p>
                <p className={`text-xl font-display font-black leading-none ${ppcColor}`}>{ppc !== null ? `${ppc}%` : '—'}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center border-2 ${ppcColor.replace('text-', 'border-').replace('text-', 'bg-')}/10 ${ppcColor}`}>
                <BarChart3 className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Semanal Tab Contents */}
        <TabsContent value="semanal" className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground leading-tight">Plano de Trabalho Semanal</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-status-ok animate-pulse" />
                  Sincronizado automaticamente com o Planejamento S13
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select onValueChange={v => {
                const task = tasks.find(t => t.id === v);
                if (task) handleAddFromPlanning(task);
              }}>
                <SelectTrigger className="h-10 w-[240px] rounded-xl bg-card border-dashed">
                  <SelectValue placeholder="Puxar do Planejamento..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Tarefas desta semana</SelectLabel>
                    {tasks.filter(t => isTaskInWeek(t) && !weekPlans.some(p => p.taskId === t.id)).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Outras tarefas</SelectLabel>
                    {tasks.filter(t => !isTaskInWeek(t) && !weekPlans.some(p => p.taskId === t.id)).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                onClick={() => addWeeklyPlan({
                  projectId: project.id,
                  taskName: 'Atividade Avulsa',
                  responsible: '',
                  week: currentWeekStr,
                  weekLabel: currentWeekStr,
                  status: 'planned',
                  reason: '',
                  observations: '',
                })}
                className="rounded-xl h-10 border-dashed"
              >
                + Avulsa
              </Button>

              <Button onClick={() => closeWeek(project.id)} className="rounded-xl h-10 px-6 font-semibold shadow-lg shadow-primary/20">
                Fechar Semana
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {weekPlans.length > 0 ? (
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50">
                      <th className="p-0 text-left border-r border-border/50 last:border-0 relative group">
                        <div className="py-4 px-4 min-w-[200px] overflow-hidden flex items-center" style={{ resize: 'horizontal' }}>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atividade</span>
                        </div>
                      </th>
                      <th className="p-0 text-left border-r border-border/50 last:border-0 relative group">
                        <div className="py-4 px-4 min-w-[120px] overflow-hidden flex items-center" style={{ resize: 'horizontal' }}>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Responsável</span>
                        </div>
                      </th>
                      <th className="p-0 text-center border-r border-border/50 last:border-0 relative group">
                        <div className="py-4 px-4 min-w-[180px] overflow-hidden flex justify-center" style={{ resize: 'horizontal' }}>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Status</span>
                        </div>
                      </th>
                      <th className="p-0 text-left border-r border-border/50 last:border-0 relative group">
                        <div className="py-4 px-4 min-w-[140px] overflow-hidden flex items-center" style={{ resize: 'horizontal' }}>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Restrições</span>
                        </div>
                      </th>
                      <th className="p-0 text-left border-r border-border/50 last:border-0 relative group">
                        <div className="py-4 px-4 min-w-[250px] overflow-hidden flex items-center" style={{ resize: 'horizontal' }}>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Situação Atual</span>
                        </div>
                      </th>
                      <th className="p-0 text-left border-r border-border/50 last:border-0 relative group">
                        <div className="py-4 px-4 min-w-[200px] overflow-hidden flex items-center" style={{ resize: 'horizontal' }}>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Observações</span>
                        </div>
                      </th>
                      <th className="py-4 px-4 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {weekPlans.map(plan => {
                      const linkedTask = tasks.find(t => t.id === plan.taskId);
                      const stOpt = statusOptions.find(s => s.value === plan.status) || statusOptions[0];
                      const taskConstraints = constraints.filter(c => c.taskId === plan.taskId && c.status === 'open');
                      
                      return (
                        <tr key={plan.id} className="group hover:bg-muted/10 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              {plan.taskId ? (
                                <span className="text-sm font-bold text-foreground">{plan.taskName}</span>
                              ) : (
                                <Input 
                                  className="h-7 text-sm p-0 border-0 bg-transparent font-bold focus-visible:ring-1 focus-visible:ring-primary/20 rounded px-1"
                                  value={plan.taskName}
                                  onChange={e => updateWeeklyPlan({ ...plan, taskName: e.target.value })}
                                />
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {plan.taskId && <Clock className="w-3 h-3 text-muted-foreground" />}
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tabular-nums">
                                  {linkedTask ? `${formatDate(linkedTask.startDate)} → ${formatDate(linkedTask.endDate)}` : 'Atividade Avulsa'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-sm text-muted-foreground font-medium">
                            <Input 
                              list="users-list-lean"
                              className={`h-7 text-sm p-0 border-0 bg-transparent rounded px-1 ${plan.taskId ? 'opacity-70 cursor-not-allowed font-bold text-primary' : 'focus-visible:ring-1 focus-visible:ring-primary/20'}`}
                              value={plan.responsible || ''}
                              onChange={e => !plan.taskId && updateWeeklyPlan({ ...plan, responsible: e.target.value })}
                              placeholder="Responsável..."
                              disabled={!!plan.taskId}
                              title={plan.taskId ? "Responsável definido no planejamento mestre" : ""}
                            />
                          </td>

                          <td className="py-4 px-6">
                            <Select value={plan.status} onValueChange={v => updateWeeklyPlan({ ...plan, status: v as any })}>
                              <SelectTrigger className="h-8 w-full min-w-[150px] rounded-lg border-0 bg-transparent hover:bg-muted font-bold text-xs mx-auto">
                                <span className={`flex items-center justify-center px-3 py-1 rounded-full w-full ${stOpt.color}`}>
                                  {stOpt.label}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>

                          <td className="py-4 px-6">
                            {taskConstraints.length > 0 ? (
                              <button 
                                onClick={() => handleTabChange('restricoes')}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-danger/10 text-status-danger hover:bg-status-danger/20 transition-colors"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span className="text-[10px] font-bold">{taskConstraints.length} Pendentes</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-[10px] font-bold">Liberada</span>
                              </div>
                            )}
                          </td>

                          <td className="py-4 px-6">
                            <div className="space-y-1">
                              <Input
                                className="h-8 text-xs bg-white border border-slate-200 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-lg px-2 text-primary font-medium"
                                value={plan.lastStatus || ''}
                                onChange={e => {
                                  const now = new Date().toISOString();
                                  updateWeeklyPlan({ ...plan, lastStatus: e.target.value, lastStatusDate: now });
                                }}
                                placeholder="Status atual..."
                              />
                              {plan.lastStatusDate && (
                                <div className="text-[8px] text-muted-foreground/50 px-1">
                                  {new Date(plan.lastStatusDate).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <Input
                              className="h-8 text-xs bg-transparent border-0 border-b border-transparent focus-visible:border-primary shadow-none rounded-none p-0 italic text-muted-foreground placeholder:text-muted-foreground/30"
                              defaultValue={plan.observations || ''}
                              onBlur={e => {
                                const val = e.target.value;
                                if (val !== (plan.observations || '')) {
                                  updateWeeklyPlan({ ...plan, observations: val });
                                }
                              }}
                              placeholder="Observações..."
                            />
                          </td>

                          <td className="py-4 px-6 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteWeeklyPlan(plan.id)}>
                              <Trash2 className="w-4 h-4 text-destructive/60 hover:text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 bg-muted/20">
                <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h4 className="text-base font-bold text-muted-foreground">Nenhuma atividade planejada</h4>
                <p className="text-xs text-muted-foreground/70 max-w-[280px] text-center mt-1">Arraste ou selecione atividades do planejamento mestre para compor o plano desta semana.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Lookahead Tab Contents */}
        <TabsContent value="lookahead" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">Lookahead (Horizonte 4 Semanas)</h3>
              <p className="text-xs text-muted-foreground">Análise de restrições e processo de "Make Ready"</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-4 bg-card px-4 py-2 rounded-xl border border-border/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Liberada</div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> C/ Restrição</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {lookaheadWeeks.map(w => {
              const weekTasks = sortedTasks.filter(t => {
                const startDate = new Date(t.startDate + 'T00:00:00');
                const endDate = new Date(t.endDate + 'T23:59:59');
                return (startDate <= w.range.end && endDate >= w.range.start);
              });

              return (
                <div key={w.weekStr} className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                  <div className="bg-muted/30 px-6 py-3 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-primary">{w.weekStr}</span>
                      <span className="text-xs font-bold text-muted-foreground">{w.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{weekTasks.length} Atividades</span>
                  </div>
                  <div className="px-6 py-2 divide-y divide-border/40">
                    {weekTasks.map(t => {
                      const openConstrs = constraints.filter(c => c.taskId === t.id && c.status === 'open');
                      const progressColor = t.percentComplete >= 100 ? 'bg-status-ok' : t.percentComplete > 0 ? 'bg-accent' : 'bg-muted-foreground/20';

                      return (
                        <div key={t.id} className="py-4 flex items-center justify-between group">
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`w-1 h-10 rounded-full ${openConstrs.length > 0 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`} />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-foreground">{t.name}</span>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{t.responsible || 'Sem resp.'}</span>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-20 h-1 rounded-full bg-muted overflow-hidden">
                                    <div className={`h-full ${progressColor}`} style={{ width: `${t.percentComplete}%` }} />
                                  </div>
                                  <span className="text-[10px] font-bold text-muted-foreground">{t.percentComplete}%</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {openConstrs.length > 0 ? (
                              <div className="flex flex-col items-end">
                                <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                  {openConstrs.slice(0, 3).map(c => (
                                    <div key={c.id} className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 whitespace-nowrap">
                                      {c.description}
                                    </div>
                                  ))}
                                  {openConstrs.length > 3 && <div className="text-[9px] font-bold text-muted-foreground">+{openConstrs.length - 3}</div>}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-wider">Livre</span>
                              </div>
                            )}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 rounded-lg text-xs gap-1.5 hover:bg-muted font-bold"
                              onClick={() => {
                                setNewConstraint({ ...newConstraint, taskId: t.id });
                                setShowAddConstraint(true);
                                setActiveTab('restricoes');
                              }}
                            >
                              <Plus className="w-3 h-3" /> Restrição
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {weekTasks.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground/60 text-xs italic">Nenhuma atividade prevista para esta semana no cronograma geral.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Restrições Tab Contents */}
        <TabsContent value="restricoes" className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-lg text-amber-600 border border-amber-500/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground leading-tight">Gestão de Restrições (Log de Impedimentos)</h3>
                <p className="text-xs text-muted-foreground">Acompanhamento de pendências que impedem o início das tarefas</p>
              </div>
            </div>

            <Button onClick={() => setShowAddConstraint(!showAddConstraint)} variant={showAddConstraint ? "outline" : "default"} className="rounded-xl h-10 gap-2 font-bold transition-all">
              {showAddConstraint ? <ChevronLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showAddConstraint ? "Voltar ao Log" : "Nova Restrição"}
            </Button>
          </div>

          {showAddConstraint ? (
            <div className="card-elevated p-6 animate-in fade-in slide-in-from-top-4 duration-300">
              <h4 className="font-bold text-base mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Registrar Impedimento / Restrição
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tarefa Vinculada</label>
                  <Select value={newConstraint.taskId} onValueChange={v => setNewConstraint({ ...newConstraint, taskId: v })}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Opcional (Sem vínculo)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (Geral da Obra)</SelectItem>
                      {tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Categoria</label>
                  <Select value={newConstraint.category} onValueChange={v => setNewConstraint({ ...newConstraint, category: v as any })}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSTRAINT_CATEGORIES.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${cat.color.split(' ')[0]}`} />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Descrição do Impedimento</label>
                  <Input 
                    placeholder="Ex: Definir cor do forro na sala técnica..." 
                    value={newConstraint.description} 
                    onChange={e => setNewConstraint({ ...newConstraint, description: e.target.value })}
                    className="rounded-xl h-11 shadow-inner bg-muted/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quem Resolve? (Responsável)</label>
                  <Input 
                    list="users-list-lean"
                    placeholder="Nome do responsável..." 
                    value={newConstraint.responsible} 
                    onChange={e => setNewConstraint({ ...newConstraint, responsible: e.target.value })}
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Data Limite (Deadline)</label>
                  <Input 
                    type="date" 
                    value={newConstraint.dueDate} 
                    onChange={e => setNewConstraint({ ...newConstraint, dueDate: e.target.value })}
                    className="rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowAddConstraint(false)} className="rounded-xl px-6">Cancelar</Button>
                <Button onClick={handleCreateConstraint} className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20">Registrar Impedimento</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50">
                    <th className="py-4 px-6 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">H</th>
                    <th className="py-4 px-6 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Restrição / Pendência</th>
                    <th className="py-4 px-6 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tarefa Alvo</th>
                    <th className="py-4 px-6 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prazo</th>
                    <th className="py-4 px-6 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Situação Atual</th>
                    <th className="py-4 px-6 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Responsável</th>
                    <th className="py-4 px-6 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {constraints.sort((a,b) => (a.status === 'open' ? -1 : 1)).map(c => {
                    const cat = CONSTRAINT_CATEGORIES.find(cat => cat.id === c.category) || CONSTRAINT_CATEGORIES[5];
                    const linkedTask = tasks.find(t => t.id === c.taskId);
                    const isOverdue = c.status === 'open' && c.dueDate && new Date(c.dueDate) < new Date();
                    
                    return (
                      <tr key={c.id} className={`group ${c.status === 'closed' ? 'opacity-50' : ''} hover:bg-muted/10 transition-colors`}>
                        <td className="py-4 px-6">
                           <div className={`w-1.5 h-8 rounded-full ${c.status === 'closed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className={`font-bold ${c.status === 'closed' ? 'line-through' : 'text-foreground'}`}>{c.description}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${cat.color}`}>{cat.label}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-medium text-xs text-muted-foreground italic">
                          {linkedTask ? linkedTask.name : 'Geral da Obra'}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col items-start min-w-[80px]">
                            <span className={`text-xs font-bold ${isOverdue ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
                              {c.dueDate ? formatDate(c.dueDate) : '—'}
                            </span>
                            {isOverdue && <span className="text-[8px] font-black tracking-tighter uppercase text-destructive">Atrasado</span>}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-1 min-w-[150px]">
                            <Input
                              className="h-8 text-xs bg-white border border-slate-200 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-lg px-2 text-primary font-medium"
                              value={c.lastStatus || ''}
                              onChange={e => {
                                const now = new Date().toISOString();
                                updateConstraint({ ...c, lastStatus: e.target.value, lastStatusDate: now });
                              }}
                              placeholder="Status da pendência..."
                            />
                            {c.lastStatusDate && (
                              <div className="text-[8px] text-muted-foreground/50 px-1">
                                {new Date(c.lastStatusDate).toLocaleDateString('pt-BR')}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm font-medium text-muted-foreground uppercase">{c.responsible || '—'}</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant={c.status === 'open' ? 'outline' : 'ghost'} 
                              size="sm" 
                              className={`h-8 rounded-lg text-xs gap-1.5 font-bold transition-all ${c.status === 'open' ? 'hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200' : 'text-emerald-600 bg-emerald-50'}`}
                              onClick={() => toggleConstraintStatus(c)}
                            >
                              {c.status === 'open' ? (
                                <>
                                  <Unlock className="w-3 h-3 text-amber-500" /> Liberar
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3" /> OK
                                </>
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteConstraint(c.id)}>
                              <Trash2 className="w-4 h-4 text-destructive/40" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {constraints.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500/20 mb-3" />
                        Obra sem restrições ativas. Comece analisando o Lookahead.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Indicadores Tab Contents */}
        <TabsContent value="indicadores" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart */}
            <div className="lg:col-span-2 card-elevated p-8">
               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Performance Semanal (PPC)</h3>
                    <p className="text-xs text-muted-foreground">Percentual de Pacotes Completados por semana</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Meta de Obra</p>
                      <p className="text-sm font-black text-status-ok uppercase tracking-wider">85%</p>
                    </div>
                  </div>
               </div>
               
               {chartData.length > 0 ? (
                 <div className="h-72">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={chartData}>
                       <defs>
                         <linearGradient id="ppcGradient" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="hsl(243 76% 58%)" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="hsl(243 76% 58%)" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(228 15% 90%)" />
                       <XAxis 
                         dataKey="week" 
                         axisLine={false}
                         tickLine={false}
                         tick={{ fontSize: 10, fontWeight: 700 }} 
                         stroke="hsl(224 10% 48%)" 
                         dy={10}
                       />
                       <YAxis 
                         domain={[0, 100]} 
                         axisLine={false}
                         tickLine={false}
                         tick={{ fontSize: 10, fontWeight: 600 }} 
                         stroke="hsl(224 10% 48%)" 
                         tickFormatter={v => `${v}%`} 
                       />
                       <Tooltip 
                         contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                         labelStyle={{ fontWeight: 800, fontSize: '12px', color: '#1e293b', marginBottom: '4px' }}
                       />
                       <ReferenceLine y={80} stroke="hsl(152 60% 42%)" strokeDasharray="3 3" strokeWidth={1.5} />
                       <Line 
                         type="monotone" 
                         dataKey="PPC" 
                         stroke="hsl(243 76% 58%)" 
                         strokeWidth={4} 
                         dot={{ r: 6, fill: '#fff', stroke: 'hsl(243 76% 58%)', strokeWidth: 3 }}
                         activeDot={{ r: 8, fill: 'hsl(243 76% 58%)', stroke: '#fff', strokeWidth: 3 }}
                         animationDuration={2000}
                       />
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center h-72 text-muted-foreground/50 italic border-2 border-dashed border-border/30 rounded-2xl">
                    Aguardando encerramento da primeira semana...
                 </div>
               )}
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              <div className="card-elevated p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-5 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Resumo de Campo
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Pacotes Exec.</p>
                    <p className="text-2xl font-black text-foreground">{weekPlans.length}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Concluídos</p>
                    <p className="text-2xl font-black text-status-ok">{weekCompleted}</p>
                  </div>
                </div>
              </div>

              {(() => {
                const reasonCount: Record<string, number> = {};
                plans.filter(p => p.status === 'not_completed' && (p.reason || p.observations)).forEach(p => {
                  const r = p.reason || p.observations || 'Outros';
                  reasonCount[r] = (reasonCount[r] || 0) + 1;
                });
                const ranked = Object.entries(reasonCount).sort((a, b) => b[1] - a[1]);
                return (
                  <div className="card-elevated p-6">
                    <h4 className="text-xs font-black uppercase tracking-widest text-foreground mb-4">Motivos de Não Cumprimento</h4>
                    <div className="space-y-3">
                      {ranked.length > 0 ? ranked.map(([reason, count]) => (
                        <div key={reason} className="group flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground truncate max-w-[150px]">{reason}</span>
                          <span className="text-[10px] font-black bg-muted px-2 py-0.5 rounded-full">{count}x</span>
                        </div>
                      )) : (
                        <div className="text-[10px] text-muted-foreground/60 italic text-center py-4">Sem falhas registradas.</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <datalist id="users-list-lean">
        {users.map(u => <option key={u.id} value={u.full_name} />)}
      </datalist>
    </div>
  );
}
