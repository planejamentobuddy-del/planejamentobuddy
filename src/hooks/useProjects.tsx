import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Project, Task, WeeklyPlan, WeeklyHistory, generateId, getCurrentWeek } from '@/types/project';

interface ProjectsContextType {
  projects: Project[];
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => Project;
  deleteProject: (id: string) => void;
  // Tasks
  getTasksForProject: (projectId: string) => Task[];
  addTask: (task: Omit<Task, 'id'>) => Task;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  // Weekly plans
  getPlansForProject: (projectId: string) => WeeklyPlan[];
  addWeeklyPlan: (plan: Omit<WeeklyPlan, 'id'>) => void;
  updateWeeklyPlan: (plan: WeeklyPlan) => void;
  deleteWeeklyPlan: (id: string) => void;
  // History
  getHistoryForProject: (projectId: string) => WeeklyHistory[];
  closeWeek: (projectId: string) => void;
}

const ProjectsContext = createContext<ProjectsContextType | null>(null);

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch { return fallback; }
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => loadFromStorage('buddy_projects', []));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage('buddy_tasks', []));
  const [plans, setPlans] = useState<WeeklyPlan[]>(() => loadFromStorage('buddy_plans', []));
  const [history, setHistory] = useState<WeeklyHistory[]>(() => loadFromStorage('buddy_history', []));

  useEffect(() => { localStorage.setItem('buddy_projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('buddy_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('buddy_plans', JSON.stringify(plans)); }, [plans]);
  useEffect(() => { localStorage.setItem('buddy_history', JSON.stringify(history)); }, [history]);

  const addProject = useCallback((p: Omit<Project, 'id' | 'createdAt'>) => {
    const proj: Project = { ...p, id: generateId(), createdAt: new Date().toISOString() };
    setProjects(prev => [...prev, proj]);
    return proj;
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.filter(t => t.projectId !== id));
    setPlans(prev => prev.filter(p => p.projectId !== id));
    setHistory(prev => prev.filter(h => h.projectId !== id));
  }, []);

  const getTasksForProject = useCallback((projectId: string) => tasks.filter(t => t.projectId === projectId), [tasks]);
  
  const addTask = useCallback((task: Omit<Task, 'id'>) => {
    const newTask: Task = { ...task, id: generateId() };
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

  const updateTask = useCallback((task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const getPlansForProject = useCallback((projectId: string) => plans.filter(p => p.projectId === projectId), [plans]);
  
  const addWeeklyPlan = useCallback((plan: Omit<WeeklyPlan, 'id'>) => {
    setPlans(prev => [...prev, { ...plan, id: generateId() }]);
  }, []);

  const updateWeeklyPlan = useCallback((plan: WeeklyPlan) => {
    setPlans(prev => prev.map(p => p.id === plan.id ? plan : p));
  }, []);

  const deleteWeeklyPlan = useCallback((id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
  }, []);

  const getHistoryForProject = useCallback((projectId: string) => history.filter(h => h.projectId === projectId), [history]);

  const closeWeek = useCallback((projectId: string) => {
    const week = getCurrentWeek();
    const projectPlans = plans.filter(p => p.projectId === projectId && p.week === week);
    if (projectPlans.length === 0) return;
    const completed = projectPlans.filter(p => p.status === 'completed').length;
    const ppc = Math.round((completed / projectPlans.length) * 100);
    const entry: WeeklyHistory = {
      id: generateId(),
      projectId,
      week,
      weekLabel: week,
      planned: projectPlans.length,
      completed,
      ppc,
      closedAt: new Date().toISOString(),
    };
    setHistory(prev => [...prev.filter(h => !(h.projectId === projectId && h.week === week)), entry]);
  }, [plans]);

  return (
    <ProjectsContext.Provider value={{
      projects, addProject, deleteProject,
      getTasksForProject, addTask, updateTask, deleteTask,
      getPlansForProject, addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan,
      getHistoryForProject, closeWeek,
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
