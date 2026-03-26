import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, Task, WeeklyPlan, WeeklyHistory, Constraint, ChecklistItem, getCurrentWeek } from '@/types/project';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

import { ProjectsContext, ProjectsContextType, useProjects } from './ProjectsContext';
export { useProjects };

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [history, setHistory] = useState<WeeklyHistory[]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setTasks([]);
      setPlans([]);
      setHistory([]);
      setConstraints([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: projData, error: projErr } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      const { data: taskData, error: taskErr } = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
      const { data: planData, error: planErr } = await supabase.from('weekly_plans').select('*');
      const { data: histData, error: histErr } = await supabase.from('weekly_history').select('*').order('closed_at', { ascending: false });
      const { data: constrData, error: constrErr } = await supabase.from('constraints').select('*').order('created_at', { ascending: true });
      const { data: userData, error: userErr } = await supabase.from('profiles').select('id, full_name, email').in('status', ['active', 'pending']);

      if (projErr) throw projErr;
      if (taskErr) throw taskErr;
      if (planErr) throw planErr;
      if (histErr) throw histErr;
      
      // We don't throw for constraints if the table doesn't exist yet to avoid breaking the app
      if (constrErr && (constrErr as any).code !== 'PGRST116' && (constrErr as any).code !== '42P01' && (constrErr as any).code !== 'PGRST205') {
        console.error('Constraints fetch error:', constrErr);
      }

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
        const today = new Date().toISOString().split('T')[0];
        setTasks(taskData.map(t => {
          let st = t.status as any;
          if (st !== 'completed' && t.end_date && t.end_date < today) {
            st = 'delayed';
          } else if (st === 'delayed' && t.end_date && t.end_date >= today) {
            st = 'in_progress';
          }
          return {
            id: t.id,
            projectId: t.project_id,
            parentId: t.parent_id || undefined,
            name: t.name,
            startDate: t.start_date || '',
            endDate: t.end_date || '',
            duration: t.duration || 0,
            percentComplete: t.percent_complete || 0,
            responsible: t.responsible || '',
            predecessors: t.predecessors || [],
            hasRestriction: t.has_restriction || false,
            restrictionType: t.restriction_type || '',
            status: st,
            observations: t.observations || '',
            lastStatus: t.last_status || '',
            lastStatusDate: t.last_status_date || '',
            statusComments: (Array.isArray(t.status_comments) ? t.status_comments : []) as any,
            checklists: (Array.isArray(t.checklists) ? t.checklists : []) as unknown as ChecklistItem[],
          };
        }));
      }

      if (planData) {
        setPlans(planData.map(p => {
          const linkedTask = taskData?.find(t => t.id === p.task_id);
          return {
            id: p.id,
            projectId: p.project_id,
            taskId: p.task_id,
            taskName: p.task_name,
            responsible: linkedTask ? (linkedTask.responsible || '') : (p.responsible || ''),
            week: p.week,
            weekLabel: p.week_label,
            status: p.status as any,
            reason: p.reason || '',
            observations: p.observations || '',
            lastStatus: p.last_status || '',
            lastStatusDate: p.last_status_date || '',
            statusComments: (Array.isArray(p.status_comments) ? p.status_comments : []) as any,
          };
        }));
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

      if (constrData) {
        setConstraints(constrData.map((c: any) => ({
          id: c.id,
          projectId: c.project_id,
          taskId: c.task_id || undefined,
          description: c.description,
          category: c.category as any,
          status: c.status as any,
          responsible: c.responsible || '',
          dueDate: c.due_date || '',
          closedAt: c.closed_at || undefined,
          createdAt: c.created_at,
          lastStatus: c.last_status || '',
          lastStatusDate: c.last_status_date || '',
          statusComments: (Array.isArray(c.status_comments) ? c.status_comments : []) as any,
        })));
      }

      if (userData) {
        setUsersList(userData);
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
        checklists: (task.checklists as any) || [],
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
      checklists: (Array.isArray(data.checklists) ? data.checklists : []) as unknown as ChecklistItem[],
    };
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

  const updateTask = useCallback(async (task: Task) => {
    const original = [...tasks];

    // Sanitize: never send empty strings for date fields
    const startDate = task.startDate || null;
    const endDate = task.endDate || null;

    let finalStatus = task.status;
    const today = new Date().toISOString().split('T')[0];
    
    // Only calculate delayed status if we have an end date
    if (endDate) {
      if (finalStatus !== 'completed' && endDate < today) {
        finalStatus = 'delayed';
      } else if (finalStatus === 'delayed' && endDate >= today) {
        finalStatus = 'in_progress';
      }
    }

    setTasks(prev => prev.map(t => t.id === task.id ? { ...task, status: finalStatus } : t));

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
        status: finalStatus,
        observations: task.observations,
        last_status: task.lastStatus,
        last_status_date: task.lastStatusDate,
        status_comments: (finalStatus === 'completed' ? [] : (task.statusComments as any) || []),
        checklists: (task.checklists as any) || [],
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
        task_name: plan.taskName,
        responsible: plan.taskId ? (tasks.find(t => t.id === plan.taskId)?.responsible || '') : plan.responsible,
        last_status: plan.lastStatus,
        last_status_date: plan.lastStatusDate,
        status_comments: (plan.status === 'completed' ? [] : (plan.statusComments as any) || []),
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
    const completed = projectPlans.filter(p => p.status === 'completed' || p.status === 'in_progress').length;
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

  const getConstraintsForProject = useCallback((projectId: string) => 
    constraints.filter(c => c.projectId === projectId), [constraints]);

  const addConstraint = useCallback(async (c: Omit<Constraint, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase.from('constraints')
      .insert([{
        project_id: c.projectId,
        task_id: c.taskId,
        description: c.description,
        category: c.category,
        status: c.status,
        responsible: c.responsible,
        due_date: c.dueDate || null,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding constraint:', error);
      toast.error('Erro ao adicionar restrição: ' + error.message);
      return null;
    }

    const newConstraint: Constraint = {
      id: data.id,
      projectId: data.project_id,
      taskId: data.task_id || undefined,
      description: data.description,
      category: data.category as any,
      status: data.status as any,
      responsible: data.responsible || '',
      dueDate: data.due_date || '',
      createdAt: data.created_at,
    };
    setConstraints(prev => [...prev, newConstraint]);
    toast.success('Restrição adicionada!');
    return newConstraint;
  }, [user]);

  const updateConstraint = useCallback(async (c: Constraint) => {
    const original = [...constraints];
    setConstraints(prev => prev.map(item => item.id === c.id ? c : item));

    const { error } = await supabase.from('constraints')
      .update({
        description: c.description,
        category: c.category,
        status: c.status,
        responsible: c.responsible,
        due_date: c.dueDate || null,
        last_status: c.lastStatus,
        last_status_date: c.lastStatusDate,
        status_comments: (c.status === 'closed' ? [] : (c.statusComments as any) || []),
        closed_at: c.status === 'closed' ? new Date().toISOString() : null
      })
      .eq('id', c.id);

    if (error) {
      setConstraints(original);
      toast.error('Erro ao atualizar restrição.');
    }
  }, [constraints]);

  const deleteConstraint = useCallback(async (id: string) => {
    const original = [...constraints];
    setConstraints(prev => prev.filter(c => c.id !== id));

    const { error } = await supabase.from('constraints').delete().eq('id', id);
    if (error) {
      setConstraints(original);
      toast.error('Erro ao excluir restrição.');
    }
  }, [constraints]);

  return (
    <ProjectsContext.Provider value={{
      projects, loading, tasks, constraints,
      addProject, deleteProject,
      getTasksForProject, addTask, updateTask, deleteTask,
      getPlansForProject, addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan,
      getConstraintsForProject, addConstraint, updateConstraint, deleteConstraint,
      getHistoryForProject, closeWeek,
      refresh: fetchData,
      users: usersList,
      plans,
    }}>
      {children}
    </ProjectsContext.Provider>
  );
}
