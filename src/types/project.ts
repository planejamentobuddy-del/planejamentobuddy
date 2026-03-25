export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  duration: number; // days
  percentComplete: number;
  responsible: string;
  predecessors: string[]; // task IDs
  hasRestriction: boolean;
  restrictionType: string;
  status: TaskStatus;
}

export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';

export interface WeeklyPlan {
  id: string;
  projectId: string;
  taskId: string;
  taskName: string;
  responsible: string;
  week: string; // ISO week string e.g. "2024-W03"
  weekLabel: string;
  status: 'planned' | 'completed' | 'not_completed';
  reason: string;
  observations: string;
}

export interface WeeklyHistory {
  id: string;
  projectId: string;
  week: string;
  weekLabel: string;
  planned: number;
  completed: number;
  ppc: number;
  closedAt: string;
}

export const DELAY_REASONS = [
  'Falta de material',
  'Mão de obra',
  'Clima',
  'Planejamento',
  'Dependência',
  'Outros',
] as const;

export type DelayReason = typeof DELAY_REASONS[number];

export function getProjectProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round(tasks.reduce((sum, t) => sum + t.percentComplete, 0) / tasks.length);
}

export function getProjectStatus(tasks: Task[]): 'ok' | 'warning' | 'danger' {
  if (tasks.length === 0) return 'ok';
  const delayed = tasks.filter(t => t.status === 'delayed').length;
  const ratio = delayed / tasks.length;
  if (ratio > 0.3) return 'danger';
  if (ratio > 0.1) return 'warning';
  // Check if any task is past due
  const now = new Date().toISOString().split('T')[0];
  const overdue = tasks.filter(t => t.endDate < now && t.percentComplete < 100).length;
  if (overdue > tasks.length * 0.3) return 'danger';
  if (overdue > 0) return 'warning';
  return 'ok';
}

export function getEstimatedEndDate(project: Project, tasks: Task[]): string {
  if (tasks.length === 0) return project.endDate;
  const progress = getProjectProgress(tasks);
  if (progress >= 100) return new Date().toISOString().split('T')[0];
  if (progress === 0) return project.endDate;
  
  const start = new Date(project.startDate).getTime();
  const now = Date.now();
  const elapsed = now - start;
  const totalEstimated = elapsed / (progress / 100);
  const estimatedEnd = new Date(start + totalEstimated);
  return estimatedEnd.toISOString().split('T')[0];
}

export function getCurrentWeek(): string {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${now.getFullYear()}-S${weekNum.toString().padStart(2, '0')}`;
}

export function isCriticalPath(task: Task, allTasks: Task[]): boolean {
  // Simple: task is critical if it has no float (predecessors chain to end)
  // For MVP: tasks with predecessors that are delayed, or tasks on the longest path
  if (task.status === 'delayed') return true;
  if (task.predecessors.length > 0) {
    const predTasks = allTasks.filter(t => task.predecessors.includes(t.id));
    return predTasks.some(p => p.status === 'delayed' || p.percentComplete < 100 && new Date(p.endDate) < new Date());
  }
  return false;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}
