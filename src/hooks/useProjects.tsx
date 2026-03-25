import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, Task, WeeklyPlan, WeeklyHistory, getCurrentWeek } from '@/types/project';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface ProjectsContextType {
  projects: Project[];
  loading: boolean;
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
  // Tasks
  getTasksForProject: (projectId: string) => Task[];
  addTask: (task: Omit<Task, 'id'>) => Promise<Task | null>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  // Weekly plans
  getPlansForProject: (projectId: string) => WeeklyPlan[];
  addWeeklyPlan: (plan: Omit<WeeklyPlan, 'id'>) => Promise<void>;
  updateWeeklyPlan: (plan: WeeklyPlan) => Promise<void>;
  deleteWeeklyPlan: (id: string) => Promise<void>;
  // History
  getHistoryForProject: (projectId: string) => WeeklyHistory[];
  closeWeek: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [history, setHistory] = useState<WeeklyHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setTasks([]);
      setPlans([]);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: projData, error: projErr } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      const { data: taskData, error: taskErr } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
      const { data: planData, error: planErr } = await supabase.from('weekly_plans').select('*');
      const { data: histData, error: histErr } = await supabase.from('weekly_history').select('*').order('closed_at', { ascending: false });

      if (projErr) throw projErr;
      if (taskErr) throw taskErr;
      if (planErr) throw planErr;
      if (histErr) throw histErr;

      if (projData) {
        setProjects(projData.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          startDate: p.start_date,
          endDate: p.end_date,
          createdAt: p.created_at,
        })));
      }
      
      if (taskData) {
        setTasks(taskData.map(t => ({
          id: t.id,
          projectId: t.project_id,
          parentId: t.parent_id || undefined,
          name: t.name,
          startDate: t.start_date,
          endDate: t.end_date,
          duration: t.duration,
          percentComplete: t.percent_complete,
          responsible: t.responsible || '',
          predecessors: t.predecessors || [],
          hasRestriction: t.has_restriction,
          restrictionType: t.restriction_type || '',
          status: t.status as any,
          observations: t.observations || '',
        })));
      }

      if (planData) {
        setPlans(planData.map(p => ({
          id: p.id,
          projectId: p.project_id,
          taskId: p.task_id,
          taskName: p.task_name,
          responsible: p.responsible || '',
          week: p.week,
          weekLabel: p.week_label,
          status: p.status as any,
          reason: p.reason || '',
          observations: p.observations || '',
        })));
      }

      if (histData) {
        setHistory(histData.map(h => ({
          id: h.id,
          projectId: h.project_id,
          week: h.week,
          weekLabel: h.week_label,
          planned: h.planned,
          completed: h.completed,
          ppc: h.ppc,
          closedAt: h.closed_at,
        })));
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addProject = useCallback(async (p: Omit<Project, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('projects')
      .insert([{
        name: p.name,
        description: p.description,
        start_date: p.startDate,
        end_date: p.endDate,
        created_by: user?.id,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding project:', error);
      toast.error('Erro ao criar obra. Verifique sua conexão e tente novamente.');
      return null;
    }

    const newProj: Project = {
      id: data.id,
      name: data.name,
      description: data.description || '',
      startDate: data.start_date,
      endDate: data.end_date,
      createdAt: data.created_at,
    };
    setProjects(prev => [newProj, ...prev]);
    toast.success('Obra criada com sucesso!');
    return newProj;
  }, [user]);

  const deleteProject = useCallback(async (id: string) => {
    const original = [...projects];
    setProjects(prev => prev.filter(p => p.id !== id));
    
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      setProjects(original);
      toast.error('Erro ao excluir obra. Verifique suas permissões.');
    } else {
      toast.success('Obra excluída.');
    }
  }, [projects]);

  const getTasksForProject = useCallback((projectId: string) => 
    tasks.filter(t => t.projectId === projectId), [tasks]);
  
  const addTask = useCallback(async (task: Omit<Task, 'id'>) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        project_id: task.projectId,
        parent_id: task.parentId,
        name: task.name,
        description: task.observations,
        start_date: task.startDate,
        end_date: task.endDate,
        duration: task.duration,
        percent_complete: task.percentComplete,
        responsible: task.responsible,
        predecessors: task.predecessors,
        has_restriction: task.hasRestriction,
        restriction_type: task.restrictionType,
        status: task.status,
        observations: task.observations,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding task:', error);
      toast.error('Erro ao criar tarefa: ' + error.message);
      return null;
    }

    const newTask: Task = {
      id: data.id,
      projectId: data.project_id,
      parentId: data.parent_id || undefined,
      name: data.name,
      startDate: data.start_date,
      endDate: data.end_date,
      duration: data.duration,
      percentComplete: data.percent_complete,
      responsible: data.responsible || '',
      predecessors: data.predecessors || [],
      hasRestriction: data.has_restriction,
      restrictionType: data.restriction_type || '',
      status: data.status as any,
      observations: data.observations || '',
    };
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

  const updateTask = useCallback(async (task: Task) => {
    const original = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));

    // Sanitize: never send empty strings for date fields
    const startDate = task.startDate || null;
    const endDate = task.endDate || null;

    // Skip update if dates are invalid
    if (!startDate || !endDate) {
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .update({
        name: task.name,
        start_date: startDate,
        end_date: endDate,
        duration: task.duration,
        percent_complete: task.percentComplete,
        responsible: task.responsible,
        predecessors: task.predecessors,
        has_restriction: task.hasRestriction,
        restriction_type: task.restrictionType,
        status: task.status,
        observations: task.observations,
      })
      .eq('id', task.id);

    if (error) {
      setTasks(original);
      console.error('[updateTask] Supabase error:', error);
      toast.error('Erro ao salvar. Verifique os campos e tente novamente.');
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    const original = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== id));

    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      setTasks(original);
      toast.error('Erro ao excluir tarefa.');
    }
  }, [tasks]);

  const getPlansForProject = useCallback((projectId: string) => 
    plans.filter(p => p.projectId === projectId), [plans]);
  
  const addWeeklyPlan = useCallback(async (plan: Omit<WeeklyPlan, 'id'>) => {
    const { data, error } = await supabase
      .from('weekly_plans')
      .insert([{
        project_id: plan.projectId,
        task_id: plan.taskId,
        task_name: plan.taskName,
        responsible: plan.responsible,
        week: plan.week,
        week_label: plan.weekLabel,
        status: plan.status,
        reason: plan.reason,
        observations: plan.observations,
      }])
      .select()
      .single();

    if (!error && data) {
      setPlans(prev => [...prev, {
        id: data.id,
        projectId: data.project_id,
        taskId: data.task_id,
        taskName: data.task_name,
        responsible: data.responsible || '',
        week: data.week,
        weekLabel: data.week_label,
        status: data.status as any,
        reason: data.reason || '',
        observations: data.observations || '',
      }]);
    } else if (error) {
      toast.error('Erro ao adicionar plano semanal.');
    }
  }, []);

  const updateWeeklyPlan = useCallback(async (plan: WeeklyPlan) => {
    const original = [...plans];
    setPlans(prev => prev.map(p => p.id === plan.id ? plan : p));

    const { error } = await supabase
      .from('weekly_plans')
      .update({
        status: plan.status,
        reason: plan.reason,
        observations: plan.observations,
      })
      .eq('id', plan.id);

    if (error) {
      setPlans(original);
      toast.error('Erro ao atualizar plano semanal.');
    }
  }, [plans]);

  const deleteWeeklyPlan = useCallback(async (id: string) => {
    const original = [...plans];
    setPlans(prev => prev.filter(p => p.id !== id));

    const { error } = await supabase.from('weekly_plans').delete().eq('id', id);
    if (error) {
      setPlans(original);
      toast.error('Erro ao remover plano semanal.');
    }
  }, [plans]);

  const getHistoryForProject = useCallback((projectId: string) => 
    history.filter(h => h.projectId === projectId), [history]);

  const closeWeek = useCallback(async (projectId: string) => {
    const week = getCurrentWeek();
    const projectPlans = plans.filter(p => p.projectId === projectId && p.week === week);
    if (projectPlans.length === 0) {
      toast.error('Não há planos para fechar nesta semana.');
      return;
    }
    const completed = projectPlans.filter(p => p.status === 'completed').length;
    const ppc = Math.round((completed / projectPlans.length) * 100);
    
    const { data, error } = await supabase
      .from('weekly_history')
      .insert([{
        project_id: projectId,
        week,
        week_label: week,
        planned: projectPlans.length,
        completed,
        ppc,
      }])
      .select()
      .single();

    if (!error && data) {
      const entry: WeeklyHistory = {
        id: data.id,
        projectId: data.project_id,
        week: data.week,
        weekLabel: data.week_label,
        planned: data.planned,
        completed: data.completed,
        ppc: data.ppc,
        closedAt: data.closed_at,
      };
      setHistory(prev => [...prev.filter(h => !(h.projectId === projectId && h.week === week)), entry]);
      toast.success(`Semana fechada! PPC: ${ppc}%`);
    } else if (error) {
      toast.error('Erro ao fechar semana.');
    }
  }, [plans]);

  return (
    <ProjectsContext.Provider value={{
      projects, loading, addProject, deleteProject,
      getTasksForProject, addTask, updateTask, deleteTask,
      getPlansForProject, addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan,
      getHistoryForProject, closeWeek,
      refresh: fetchData,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be inside ProjectsProvider');
  return ctx;
}
