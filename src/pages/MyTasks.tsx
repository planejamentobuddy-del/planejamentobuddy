import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, AlertCircle, LayoutDashboard, Calendar, ClipboardCheck, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Task, Constraint, CONSTRAINT_CATEGORIES } from '@/types/project';

export default function MyTasks() {
  const { tasks, constraints, updateTask, updateConstraint, projects } = useProjects();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tasks' | 'constraints'>('tasks');

  const userName = profile?.full_name || '';

  const myTasks = useMemo(() => {
    return tasks.filter(t => t.responsible?.toLowerCase() === userName.toLowerCase())
      .sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [tasks, userName]);

  const myConstraints = useMemo(() => {
    return constraints.filter(c => c.responsible?.toLowerCase() === userName.toLowerCase())
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [constraints, userName]);

  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Projeto Desconhecido';
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'in_progress' : 'completed';
    const newPercent = newStatus === 'completed' ? 100 : Math.max(0, task.percentComplete);
    await updateTask({ ...task, status: newStatus, percentComplete: newPercent });
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
                          className={`mt-1 transition-colors ${task.status === 'completed' ? 'text-green-500 hover:text-green-600' : 'text-slate-300 hover:text-primary'}`}
                        >
                          {task.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                            <h4 className={`font-bold text-slate-800 truncate ${task.status === 'completed' ? 'line-through opacity-50' : ''}`}>
                              {task.name}
                            </h4>
                            <Badge variant="secondary" className="w-fit text-[10px] font-bold bg-slate-100 text-slate-500 border-none px-2 rounded-md uppercase tracking-wide">
                              {getProjectName(task.projectId)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(task.endDate).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="flex items-center gap-1 font-medium text-slate-400">
                              {task.percentComplete}% concluído
                            </span>
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
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span className={`flex items-center gap-1 font-bold ${new Date(c.dueDate) < new Date() && c.status === 'open' ? 'text-red-500' : 'text-slate-500'}`}>
                                <Calendar className="w-3.5 h-3.5" />
                                Prazo: {new Date(c.dueDate).toLocaleDateString('pt-BR')}
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
