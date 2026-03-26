import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, AlertCircle, LayoutDashboard, Calendar, ClipboardCheck, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Task, Constraint, CONSTRAINT_CATEGORIES, StatusComment } from '@/types/project';
import StatusCommentLog from '@/components/project/StatusCommentLog';

export default function MyTasks() {
  const { tasks, constraints, updateTask, updateConstraint, projects, plans, updateWeeklyPlan } = useProjects();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tasks' | 'constraints'>('tasks');

  const userName = profile?.full_name || '';

  const myTasks = useMemo(() => {
    const me = userName.toLowerCase().trim();
    if (!me) return [];
    // Strict match: user's name must be included in or include the responsible name
    const match = (name?: string) => {
      const n = name?.toLowerCase().trim() || '';
      return n && me && (n === me || n.includes(me) || me.includes(n));
    };

    // 1. Gantt Tasks where user is responsible AND not completed
    const ganttTasks = tasks.filter(t => match(t.responsible) && t.status !== 'completed');

    // Collect task IDs already represented by Gantt tasks (avoid duplicates in combined list)
    const ganttTaskIds = new Set(ganttTasks.map(t => t.id));

    // 2. ALL Weekly Plans where user is responsible
    //    - linked plans (taskId set) show if the responsible from the linked task matches
    //    - standalone/ad-hoc plans (no taskId) also show
    const myPlans = plans.filter(p => {
      if (!match(p.responsible)) return false;
      if (p.status === 'completed') return false; // Filter out completed plans
      // If this plan is linked to a Gantt task already shown, skip it to avoid duplicate
      if (p.taskId && ganttTaskIds.has(p.taskId)) return false;
      return true;
    });

    return [
      ...ganttTasks.map(t => ({ ...t, type: 'gantt' as const })),
      ...myPlans.map(p => ({
        id: p.id,
        name: p.taskName,
        responsible: p.responsible,
        projectId: p.projectId,
        status: (p.status === 'completed' ? 'completed' : 'in_progress') as any,
        endDate: '',
        type: p.taskId ? 'lean_linked' as const : 'lean' as const,
        lastStatus: p.lastStatus,
        lastStatusDate: p.lastStatusDate,
        statusComments: p.statusComments || [],
        original: p,
      }))
    ].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, plans, userName]);

  const myConstraints = useMemo(() => {
    const me = userName.toLowerCase().trim();
    const match = (name?: string) => {
      const n = name?.toLowerCase().trim() || '';
      return n && me && (n === me || n.includes(me) || me.includes(n));
    };

    return constraints.filter(c => match(c.responsible) && c.status === 'open')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [constraints, userName]);

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Projeto Desconhecido';
  };

  const addTaskComment = async (item: any, newComments: StatusComment[]) => {
    if (item.type === 'gantt') {
      await updateTask({ ...item, statusComments: newComments });
    } else {
      await updateWeeklyPlan({ ...item.original, statusComments: newComments });
    }
  };

  const addConstraintComment = async (c: Constraint, newComments: StatusComment[]) => {
    await updateConstraint({ ...c, statusComments: newComments });
  };

  const handleToggleTask = async (item: any) => {
    if (item.type === 'gantt') {
      const newStatus = item.status === 'completed' ? 'in_progress' : 'completed';
      const newPercent = newStatus === 'completed' ? 100 : Math.max(0, item.percentComplete);
      await updateTask({ ...item, status: newStatus, percentComplete: newPercent });
    } else {
      const newStatus = item.status === 'completed' ? 'planned' : 'completed';
      await updateWeeklyPlan({ ...item.original, status: newStatus });
    }
  };

  const handleToggleConstraint = async (c: Constraint) => {
    await updateConstraint({ ...c, status: c.status === 'closed' ? 'open' : 'closed', closedAt: c.status === 'closed' ? undefined : new Date().toISOString() });
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="border-b bg-white sticky top-0 z-30">
        <div className="container mx-auto py-4 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-display font-bold text-slate-900 leading-tight">Minhas Atribuições</h1>
              <p className="text-xs text-slate-500 font-medium">Tarefas e restrições sob sua responsabilidade</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
              {userName}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="tasks" className="space-y-6" onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="bg-slate-200/50 p-1 rounded-xl border border-slate-200/60">
              <TabsTrigger value="tasks" className="rounded-lg gap-2 px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ClipboardCheck className="w-4 h-4" />
                Tarefas 
                <span className="ml-1 opacity-60">({myTasks.length})</span>
              </TabsTrigger>
              <TabsTrigger value="constraints" className="rounded-lg gap-2 px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <AlertCircle className="w-4 h-4" />
                Restrições 
                <span className="ml-1 opacity-60">({myConstraints.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="tasks" className="m-0">
            {myTasks.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <LayoutDashboard className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-slate-600 font-semibold">Nenhuma tarefa encontrada</h3>
                <p className="text-slate-400 text-sm">Você não tem tarefas atribuídas ao seu nome.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence mode="popLayout">
                  {myTasks.map((task) => (
                    <motion.div
                      layout
                      key={task.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <button 
                          onClick={() => handleToggleTask(task)}
                          className={`shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-status-ok border-status-ok text-white' : 'border-slate-300 hover:border-primary'}`}
                        >
                          {task.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">{getProjectName(task.projectId)}</span>
                            {task.type === 'lean' && <Badge variant="secondary" className="text-[8px] h-4 py-0 uppercase bg-primary/10 text-primary">Avulsa</Badge>}
                            {task.type === 'lean_linked' && <Badge variant="secondary" className="text-[8px] h-4 py-0 uppercase bg-blue-50 text-blue-600">Plano Semanal</Badge>}
                          </div>
                          <h4 className={`text-sm font-bold truncate ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.name}</h4>
                          
                          {/* Status Update Section */}
                          <div className="mt-3">
                            <StatusCommentLog 
                              comments={task.statusComments || []} 
                              onAddComment={(newComments) => addTaskComment(task, newComments)}
                            />
                          </div>

                          <div className="flex items-center gap-3 mt-3">
                            {task.type === 'gantt' && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                <Calendar className="w-3 h-3" />
                                {task.endDate ? new Date(task.endDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem prazo'}
                              </div>
                            )}
                            {task.type === 'lean' && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                <Calendar className="w-3 h-3" />
                                {task.original.weekLabel}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                              <LayoutDashboard className="w-3 h-3" />
                              {task.type === 'gantt' ? 'Gantt' : 'Lean'}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-primary hover:bg-primary/5 gap-1.5 font-bold text-xs rounded-lg hidden sm:flex"
                          onClick={() => navigate(`/obra/${task.projectId}?tab=kanban`)}
                        >
                          Ver no Kanban
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="constraints" className="m-0">
            {myConstraints.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-slate-600 font-semibold">Nenhuma restrição encontrada</h3>
                <p className="text-slate-400 text-sm">Tudo limpo! Nenhuma restrição pendente para você.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence mode="popLayout">
                  {myConstraints.map((c) => {
                    const cat = CONSTRAINT_CATEGORIES.find(cat => cat.id === c.category);
                    return (
                      <motion.div
                        layout
                        key={c.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-primary/30 transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <button 
                            onClick={() => handleToggleConstraint(c)}
                            className={`mt-1 transition-colors ${c.status === 'closed' ? 'text-green-500 hover:text-green-600' : 'text-slate-300 hover:text-primary'}`}
                          >
                            {c.status === 'closed' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <h4 className={`font-bold text-slate-800 truncate ${c.status === 'closed' ? 'line-through opacity-50' : ''}`}>
                                  {c.description}
                                </h4>
                                <Badge className={`text-[9px] px-1.5 py-0 border-none font-black uppercase ${cat?.color || ''}`}>
                                  {cat?.label || 'Outros'}
                                </Badge>
                              </div>
                              <Badge variant="secondary" className="w-fit text-[10px] font-bold bg-slate-100 text-slate-500 border-none px-2 rounded-md uppercase tracking-wide">
                                {getProjectName(c.projectId)}
                              </Badge>
                            </div>
                            
                            {/* Status Update Section */}
                      <div className="mt-4">
                        <StatusCommentLog 
                          comments={c.statusComments || []} 
                          onAddComment={(newComments) => addConstraintComment(c, newComments)}
                        />
                      </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span className={`flex items-center gap-1 font-bold ${c.dueDate && new Date(c.dueDate + 'T12:00:00') < new Date() && c.status === 'open' ? 'text-red-500' : 'text-slate-500'}`}>
                                <Calendar className="w-3.5 h-3.5" />
                                Prazo: {c.dueDate ? new Date(c.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem prazo'}
                              </span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary hover:bg-primary/5 gap-1.5 font-bold text-xs rounded-lg hidden sm:flex"
                            onClick={() => navigate(`/obra/${c.projectId}?tab=lean&subtab=restricoes`)}
                          >
                            Ver no Lean
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
