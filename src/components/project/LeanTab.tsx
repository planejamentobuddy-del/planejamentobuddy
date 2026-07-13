import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Project, DELAY_REASONS, WeeklyPlan, Task, Constraint, CONSTRAINT_CATEGORIES, ConstraintCategory, StatusComment } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, ChevronRight, Calendar, Eye, BarChart3, 
  AlertTriangle, CheckCircle2, Plus, Trash2, Filter,
  Lock, Unlock, Clock, AlertCircle, MessageSquare,
  ChevronDown, ChevronUp, Pencil, ListTodo, Printer,
  EyeOff, HelpCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'sonner';
import { setISOWeekYear, setISOWeek, startOfISOWeek, endOfISOWeek, getISOWeekYear, getISOWeek, addWeeks } from 'date-fns';
import StatusCommentLog from './StatusCommentLog';

function getWeekRange(weekStr: string): { start: Date; end: Date; label: string } {
  const match = weekStr.match(/(\d{4})-S(\d{2})/);
  if (!match) return { start: new Date(), end: new Date(), label: weekStr };
  
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);
  
  // Build a date initialized to the middle of the requested ISO year/week
  let date = new Date(year, 0, 4); // Jan 4th is always in week 1
  date = setISOWeekYear(date, year);
  date = setISOWeek(date, weekNum);
  
  const start = startOfISOWeek(date);
  start.setHours(0, 0, 0, 0);
  
  const end = endOfISOWeek(date);
  end.setHours(23, 59, 59, 999);
  
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return { start, end, label: `${fmt(start)} — ${fmt(end)}` };
}

export function getCurrentWeek(): string {
  const d = new Date();
  const year = getISOWeekYear(d);
  const weekNo = getISOWeek(d);
  return `${year}-S${weekNo.toString().padStart(2, '0')}`;
}

function offsetWeek(weekStr: string, offset: number): string {
  const match = weekStr.match(/(\d{4})-S(\d{2})/);
  if (!match) return weekStr;
  
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);
  
  let date = new Date(year, 0, 4);
  date = setISOWeekYear(date, year);
  date = setISOWeek(date, weekNum);
  
  date = addWeeks(date, offset);
  
  const newYear = getISOWeekYear(date);
  const newWeek = getISOWeek(date);
  return `${newYear}-S${newWeek.toString().padStart(2, '0')}`;
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
    supplyPackages, users, loading
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

  // ── SUBTAREFAS & PROGRAMAÇÃO DIÁRIA SEMANAL ESTADOS ──
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [showAddSubtaskTaskId, setShowAddSubtaskTaskId] = useState<string | null>(null);
  const [newSubtaskName, setNewSubtaskName] = useState('');
  const [ignoredDiscrepancyTaskIds, setIgnoredDiscrepancyTaskIds] = useState<string[]>([]);

  const weekRange = getWeekRange(currentWeekStr);
  const weekPlans = plans.filter(p => p.week === currentWeekStr);
  
  // PPC no Lean = planos concluídos (progresso atual >= progresso esperado ou progresso atual >= 100) / planos planejados
  const completedPlansCount = weekPlans.filter(p => (p.currentProgress !== undefined ? p.currentProgress : 0) >= (p.expectedProgress !== undefined ? p.expectedProgress : 100)).length;
  const weekCompleted = completedPlansCount;
  const ppc = weekPlans.length > 0 ? Math.round((completedPlansCount / weekPlans.length) * 100) : null;
  const ppcColor = ppc === null ? 'text-muted-foreground' : ppc >= 80 ? 'text-status-ok' : ppc >= 60 ? 'text-status-warning' : 'text-status-danger';

  // Médias de previsto e executado
  const previstoMedia = useMemo(() => {
    if (weekPlans.length === 0) return 0;
    const sum = weekPlans.reduce((acc, p) => acc + (p.expectedProgress !== undefined ? p.expectedProgress : 100), 0);
    return Number((sum / weekPlans.length).toFixed(2));
  }, [weekPlans]);

  const executadoMedia = useMemo(() => {
    if (weekPlans.length === 0) return 0;
    const sum = weekPlans.reduce((acc, p) => acc + (p.currentProgress !== undefined ? p.currentProgress : 0), 0);
    return Number((sum / weekPlans.length).toFixed(2));
  }, [weekPlans]);

  // ── HELPERS PARA SUBTAREFAS DO PLANO SEMANAL ──
  const getSubtasks = (plan: WeeklyPlan): { name: string; completed: boolean }[] => {
    if (!plan.subtasks) return [];
    try {
      const parsed = JSON.parse(plan.subtasks);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const updateSubtaskStatus = async (plan: WeeklyPlan, subtaskIdx: number, completed: boolean) => {
    const subtasks = getSubtasks(plan);
    if (subtasks[subtaskIdx]) {
      subtasks[subtaskIdx].completed = completed;
      
      // Auto-calcular progresso com base nas subtarefas concluídas
      const completedCount = subtasks.filter(s => s.completed).length;
      const progressPct = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
      
      await updateWeeklyPlan({
        ...plan,
        subtasks: JSON.stringify(subtasks),
        currentProgress: progressPct // Sincroniza automaticamente o progresso real
      });
    }
  };

  const handleAddSubtask = async (plan: WeeklyPlan) => {
    if (!newSubtaskName.trim()) return;
    const subtasks = getSubtasks(plan);
    subtasks.push({ name: newSubtaskName.trim(), completed: false });
    
    // Auto-calcular progresso com base nas subtarefas
    const completedCount = subtasks.filter(s => s.completed).length;
    const progressPct = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
    
    await updateWeeklyPlan({
      ...plan,
      subtasks: JSON.stringify(subtasks),
      currentProgress: progressPct
    });
    setNewSubtaskName('');
    setShowAddSubtaskTaskId(null);
    toast.success('Subtarefa adicionada!');
  };

  const handleDeleteSubtask = async (plan: WeeklyPlan, subtaskIdx: number) => {
    const subtasks = getSubtasks(plan);
    const updated = subtasks.filter((_, i) => i !== subtaskIdx);
    
    // Auto-calcular progresso após deletar
    const completedCount = updated.filter(s => s.completed).length;
    const progressPct = updated.length > 0 ? Math.round((completedCount / updated.length) * 100) : 0;
    
    await updateWeeklyPlan({
      ...plan,
      subtasks: JSON.stringify(updated),
      currentProgress: progressPct
    });
    toast.success('Subtarefa removida!');
  };

  const isTaskInWeek = (task: Task) => {
    if (!task.startDate || !task.endDate) return false;
    
    // Convert YYYY-MM-DD to proper local midnight dates securely
    const [sy, sm, sd] = task.startDate.split('-').map(Number);
    const [ey, em, ed] = task.endDate.split('-').map(Number);
    const startObj = new Date(sy, sm - 1, sd, 0, 0, 0);
    const endObj = new Date(ey, em - 1, ed, 23, 59, 59);
    
    const s = startObj.getTime();
    const e = endObj.getTime();
    const ws = weekRange.start.getTime();
    const we = weekRange.end.getTime();
    
    // Overlaps if Task Start is Before/Equal to Week End AND Task End is After/Equal to Week Start
    return s <= we && e >= ws;
  };

  // Lookahead weeks (Next 8 weeks)
  const lookaheadWeeks = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
      const wStr = offsetWeek(currentWeekStr, offset);
      const range = getWeekRange(wStr);
      return { weekStr: wStr, label: range.label, range };
    });
  }, [currentWeekStr]);

  // Identify parent tasks (stages) to filter them out from Lean
  const leafTasks = useMemo(() => {
    const parentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId!));
    return tasks.filter(t => !parentIds.has(t.id));
  }, [tasks]);

  // Tasks sorted by start date
  const sortedTasks = useMemo(() => [...leafTasks].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')), [leafTasks]);

  // Chart data for PPC
  const chartData = useMemo(() => {
    return [...history].sort((a, b) => a.week.localeCompare(b.week)).map(h => ({
      week: h.week.split('-')[1], // Just "S01", "S02" etc.
      PPC: h.ppc
    }));
  }, [history]);

  // AUTO-SYNC EFFECT:
  // Automatically add tasks that fall within the current week to the weekly plan
  // Only pulls leaf tasks (subetapas), never parent stages (etapas)
  useEffect(() => {
    const autoSync = async () => {
      const tasksInWeek = leafTasks.filter(t => isTaskInWeek(t));
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
  }, [currentWeekStr, leafTasks.length]); // Re-run when week or leaf task count changes

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
          {/* Métricas e Estatísticas Semanal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 border border-border rounded-2xl p-4 shadow-inner">
            <div className="flex flex-col justify-center p-3 bg-card border rounded-xl shadow-sm text-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">PPC Semanal</span>
              <span className={`text-3xl font-black mt-1 ${ppcColor}`}>{ppc !== null ? `${ppc}%` : '0%'}</span>
              <span className="text-[10px] text-muted-foreground mt-1">Percentual de Planos Concluídos</span>
            </div>
            <div className="flex flex-col justify-center p-3 bg-card border rounded-xl shadow-sm text-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Previsto Médio</span>
              <span className="text-3xl font-black text-blue-600 mt-1">{previstoMedia}%</span>
              <span className="text-[10px] text-muted-foreground mt-1">Progresso médio planejado</span>
            </div>
            <div className="flex flex-col justify-center p-3 bg-card border rounded-xl shadow-sm text-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Executado Médio</span>
              <span className="text-3xl font-black text-amber-600 mt-1">{executadoMedia}%</span>
              <span className="text-[10px] text-muted-foreground mt-1">Progresso médio executado</span>
            </div>
            <div className="flex flex-col justify-center p-3 bg-card border rounded-xl shadow-sm text-center">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Concluídas</span>
              <span className="text-3xl font-black text-emerald-600 mt-1">
                {completedPlansCount} de {weekPlans.length}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">Atividades 100% finalizadas</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground leading-tight">Plano de Trabalho Semanal</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-status-ok animate-pulse" />
                  Sincronizado automaticamente com o Planejamento {currentWeekStr}
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
                    {leafTasks.filter(t => isTaskInWeek(t) && !weekPlans.some(p => p.taskId === t.id)).map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Outras tarefas</SelectLabel>
                    {leafTasks.filter(t => !isTaskInWeek(t) && !weekPlans.some(p => p.taskId === t.id)).map(t => (
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
                  scheduledDays: '[]',
                  subtasks: '[]',
                  expectedProgress: 100,
                  currentProgress: 0,
                })}
                className="rounded-xl h-10 border-dashed"
              >
                + Avulsa
              </Button>

              <Button onClick={() => closeWeek(project.id, currentWeekStr)} className="rounded-xl h-10 px-6 font-semibold shadow-lg shadow-primary/20">
                Fechar Semana
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {weekPlans.length > 0 ? (() => {
              // 7 dias da semana de Domingo a Sábado
              const baseDate = new Date(weekRange.start);
              baseDate.setDate(baseDate.getDate() - 1); // Volta 1 dia de segunda para domingo
              
              const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
              const daysOfWeek = Array.from({ length: 7 }).map((_, idx) => {
                const d = new Date(baseDate);
                d.setDate(baseDate.getDate() + idx);
                const dayLabel = weekdays[idx];
                const dateLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                return {
                  index: idx,
                  dateStr: d.toISOString().split('T')[0],
                  label: `${dayLabel}, ${dateLabel}`
                };
              });

              return (
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/50 text-muted-foreground select-none">
                          <th className="py-3 px-3 w-8 text-center"><input type="checkbox" className="rounded border-gray-300" disabled /></th>
                          <th className="py-3 px-3 w-28">Status</th>
                          <th className="py-3 px-3 w-10 text-center">#</th>
                          <th className="py-3 px-4 min-w-[220px]">Nome</th>
                          <th className="py-3 px-3 w-20">Início</th>
                          <th className="py-3 px-3 w-20">Término</th>
                          <th className="py-3 px-3 w-16 text-center">Esperado</th>
                          <th className="py-3 px-3 w-20 text-center">Progresso</th>
                          <th className="py-3 px-3 w-28">Responsável</th>
                          
                          {/* Dias de Domingo a Sábado */}
                          {daysOfWeek.map(day => (
                            <th key={day.index} className="py-3 px-1 w-14 text-center border-l border-border/40 font-semibold text-[10px]">
                              <div>{day.label.split(',')[0]}</div>
                              <div className="opacity-60 font-mono">{day.label.split(',')[1]}</div>
                            </th>
                          ))}
                          
                          <th className="py-3 px-3 w-10 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {weekPlans.map((plan, idx) => {
                          const linkedTask = tasks.find(t => t.id === plan.taskId);
                          const taskConstraints = constraints.filter(c => c.taskId === plan.taskId && c.status === 'open');
                          const taskSupplies = plan.taskId ? supplyPackages.filter(sp => sp.projectId === project.id && sp.taskId === plan.taskId) : [];
                          const pendingSupplies = taskSupplies.filter(sp => sp.status !== 'delivered' && sp.status !== 'cancelled');

                          const expProg = plan.expectedProgress !== undefined ? plan.expectedProgress : 100;
                          const curProg = plan.currentProgress !== undefined ? plan.currentProgress : 0;
                          
                          // Lógica de cálculo de Status inteligente
                          let statusLabel = 'Planejado';
                          let statusColor = 'bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-400';
                          
                          if (curProg >= expProg) {
                            statusLabel = 'Concluído';
                            statusColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
                          } else {
                            // Se a data de término do plano (ou da tarefa vinculada) já passou de hoje e não está concluída, está atrasada
                            const today = new Date().toISOString().split('T')[0];
                            const deadline = linkedTask?.endDate || today;
                            if (deadline < today) {
                              statusLabel = 'Atrasada';
                              statusColor = 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400';
                            } else {
                              statusLabel = 'Atual';
                              statusColor = 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
                            }
                          }

                          // Ler dias marcados e subtarefas
                          const getScheduledDays = (): number[] => {
                            if (!plan.scheduledDays) return [];
                            try { const val = JSON.parse(plan.scheduledDays); return Array.isArray(val) ? val : []; } catch { return []; }
                          };
                          const scheduledDays = getScheduledDays();

                          const getSubtasksList = (): { name: string; completed: boolean }[] => {
                            if (!plan.subtasks) return [];
                            try { const val = JSON.parse(plan.subtasks); return Array.isArray(val) ? val : []; } catch { return []; }
                          };
                          const subtasks = getSubtasksList();
                          const completedSubtasksCount = subtasks.filter(s => s.completed).length;
                          const subtaskProgressPct = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;
                          
                          // Alerta de desvio de progresso vs subtarefas
                          const hasDiscrepancy = subtasks.length > 0 && curProg !== subtaskProgressPct && !ignoredDiscrepancyTaskIds.includes(plan.id);

                          const isExpanded = expandedTaskIds.includes(plan.id);

                          return (
                            <React.Fragment key={plan.id}>
                              <tr className="group hover:bg-muted/10 transition-colors">
                                <td className="py-3 px-3 text-center"><input type="checkbox" className="rounded border-gray-300" disabled /></td>
                                <td className="py-3 px-3">
                                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider w-full text-center ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    {subtasks.length > 0 && (
                                      <button 
                                        type="button"
                                        onClick={() => setExpandedTaskIds(prev => prev.includes(plan.id) ? prev.filter(id => id !== plan.id) : [...prev, plan.id])}
                                        className="p-0.5 hover:bg-muted rounded"
                                      >
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                      </button>
                                    )}
                                    <div className="flex flex-col">
                                      <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                        {plan.taskName}
                                        {plan.taskId && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" title="Tarefa vinculada ao planejamento" />}
                                      </span>
                                      {/* Restrições / Suprimentos badges */}
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {taskConstraints.length > 0 && (
                                          <span className="inline-flex items-center gap-0.5 text-[9px] text-red-600 bg-red-500/5 px-1.5 rounded">
                                            <AlertTriangle className="w-2.5 h-2.5" /> {taskConstraints.length} restrições
                                          </span>
                                        )}
                                        {pendingSupplies.length > 0 && (
                                          <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600 bg-amber-500/5 px-1.5 rounded">
                                            📦 {pendingSupplies.length} compras pendentes
                                          </span>
                                        )}
                                        {subtasks.length > 0 && (
                                          <span className="text-[9px] text-muted-foreground bg-muted/40 px-1 rounded font-medium">
                                            {completedSubtasksCount}/{subtasks.length} subtarefas ({subtaskProgressPct}%)
                                          </span>
                                        )}
                                        <button 
                                          type="button"
                                          onClick={() => setShowAddSubtaskTaskId(plan.id)}
                                          className="text-[9px] text-primary hover:underline ml-1 font-semibold"
                                        >
                                          + Add Subtarefa
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-muted-foreground font-mono">
                                  {linkedTask ? formatDate(linkedTask.startDate) : '—'}
                                </td>
                                <td className="py-3 px-3 text-muted-foreground font-mono">
                                  {linkedTask ? formatDate(linkedTask.endDate) : '—'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <input 
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={expProg}
                                    onChange={e => {
                                      const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                      updateWeeklyPlan({ ...plan, expectedProgress: val });
                                    }}
                                    className="w-12 h-6 text-center border bg-transparent rounded text-xs font-semibold focus:ring-1 focus:ring-primary"
                                  />
                                </td>
                                <td className="py-3 px-3 text-center relative">
                                  <div className="flex items-center justify-center gap-1">
                                    <input 
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={curProg}
                                      onChange={e => {
                                        const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                        updateWeeklyPlan({ ...plan, currentProgress: val });
                                      }}
                                      className="w-12 h-6 text-center border bg-transparent rounded text-xs font-semibold focus:ring-1 focus:ring-primary"
                                    />
                                    <Pencil className="w-2.5 h-2.5 text-muted-foreground/40" />
                                  </div>

                                  {/* Alerta de discrepância popup */}
                                  {hasDiscrepancy && (
                                    <div className="absolute z-30 bottom-8 left-1/2 -translate-x-1/2 w-64 bg-card border shadow-lg rounded-xl p-3 text-left space-y-2 text-xs">
                                      <p className="font-medium text-foreground leading-normal">
                                        ⚠️ O progresso da tarefa ({curProg}%) está diferente da conclusão das subtarefas ({completedSubtasksCount}/{subtasks.length} = {subtaskProgressPct}%).
                                      </p>
                                      <div className="flex justify-end gap-1.5 pt-1">
                                        <Button 
                                          type="button" 
                                          variant="outline" 
                                          size="sm" 
                                          className="text-[10px] h-6 px-2"
                                          onClick={() => setIgnoredDiscrepancyTaskIds(prev => [...prev, plan.id])}
                                        >
                                          Ignorar
                                        </Button>
                                        <Button 
                                          type="button" 
                                          size="sm" 
                                          className="text-[10px] h-6 px-2"
                                          onClick={() => {
                                            updateWeeklyPlan({ ...plan, currentProgress: subtaskProgressPct });
                                          }}
                                        >
                                          Usar subtarefas
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-muted-foreground font-medium truncate max-w-[120px]">
                                  {plan.responsible || 'Sem resp.'}
                                </td>

                                {/* Células de Domingo a Sábado */}
                                {daysOfWeek.map(day => {
                                  const isScheduled = scheduledDays.includes(day.index);
                                  return (
                                    <td 
                                      key={day.index} 
                                      onClick={() => {
                                        let updatedDays;
                                        if (isScheduled) {
                                          updatedDays = scheduledDays.filter(i => i !== day.index);
                                        } else {
                                          updatedDays = [...scheduledDays, day.index].sort();
                                        }
                                        updateWeeklyPlan({ ...plan, scheduledDays: JSON.stringify(updatedDays) });
                                      }}
                                      className={`py-3 px-1 border-l border-border/45 text-center cursor-pointer hover:bg-muted/10 transition-all ${
                                        isScheduled ? 'bg-amber-300/80 dark:bg-amber-500/60' : 'bg-transparent'
                                      }`}
                                    >
                                      <div className="h-6 w-full" />
                                    </td>
                                  );
                                })}

                                <td className="py-3 px-3 text-right">
                                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteWeeklyPlan(plan.id)}>
                                    <Trash2 className="w-3.5 h-3.5 text-destructive/60 hover:text-destructive" />
                                  </Button>
                                </td>
                              </tr>

                              {/* Diálogo rápido para criar Subtarefa */}
                              {showAddSubtaskTaskId === plan.id && (
                                <tr className="bg-muted/5 dark:bg-muted/2">
                                  <td colSpan={17} className="p-3">
                                    <div className="flex items-center gap-2 max-w-md ml-8">
                                      <Input 
                                        placeholder="Nome da subtarefa... (Ex: Fôrma, Armação)" 
                                        className="h-8 text-xs rounded-lg"
                                        value={newSubtaskName}
                                        onChange={e => setNewSubtaskName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddSubtask(plan)}
                                      />
                                      <Button size="sm" className="h-8 text-xs rounded-lg font-bold" onClick={() => handleAddSubtask(plan)}>
                                        Adicionar
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 text-xs rounded-lg" onClick={() => setShowAddSubtaskTaskId(null)}>
                                        Cancelar
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {/* Linhas de Subtarefas expandidas */}
                              {isExpanded && subtasks.map((sub, sIdx) => (
                                <tr key={sIdx} className="bg-muted/10 dark:bg-muted/5 border-b border-border/30">
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td className="py-2 px-4 pl-12 font-medium text-muted-foreground text-xs">
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="checkbox"
                                        checked={sub.completed}
                                        onChange={e => {
                                          updateSubtaskStatus(plan, sIdx, e.target.checked);
                                        }}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                      />
                                      <span className={sub.completed ? 'line-through opacity-60' : ''}>
                                        {sub.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td></td>
                                  <td></td>
                                  <td></td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${
                                      sub.completed 
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                      {sub.completed ? 'Concluído' : 'Não Iniciada'}
                                    </span>
                                  </td>
                                  <td></td>
                                  {/* Colunas vazias para os dias da semana */}
                                  {daysOfWeek.map(d => <td key={d.index} className="border-l border-border/30"></td>)}
                                  <td className="py-2 px-3 text-right">
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive/50 hover:text-destructive" onClick={() => handleDeleteSubtask(plan, sIdx)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })() : (
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
              <h3 className="text-lg font-bold text-foreground">Lookahead (Horizonte 8 Semanas)</h3>
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
                                {t.startDate && (
                                  <span className="text-[10px] font-bold text-muted-foreground/80 bg-muted/65 px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm">
                                    Início: {new Date(t.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                )}
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
                        <td className="py-2 px-6 min-w-[300px]">
                          <StatusCommentLog 
                            compact 
                            comments={c.statusComments || []} 
                            onAddComment={(newComments) => updateConstraint({ ...c, statusComments: newComments })}
                          />
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
