import React, { createContext, useContext } from 'react';
import { Project, Task, WeeklyPlan, WeeklyHistory, Constraint, DailyLog, PaymentReceipt } from '@/types/project';

export interface ProjectsContextType {
  projects: Project[];
  loading: boolean;
  tasks: Task[];
  constraints: Constraint[];
  plans: WeeklyPlan[];
  dailyLogs: DailyLog[];
  paymentReceipts: PaymentReceipt[];
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => Promise<Project | null>;
  updateProject: (p: Project) => Promise<boolean>;
  deleteProject: (id: string) => Promise<void>;
  // Tasks
  getTasksForProject: (projectId: string) => Task[];
  addTask: (task: Omit<Task, 'id'>) => Promise<Task | null>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTasks: (updates: { id: string, orderIndex: number }[]) => Promise<void>;
  // Weekly plans
  getPlansForProject: (projectId: string) => WeeklyPlan[];
  addWeeklyPlan: (plan: Omit<WeeklyPlan, 'id'>) => Promise<void>;
  updateWeeklyPlan: (plan: WeeklyPlan) => Promise<void>;
  deleteWeeklyPlan: (id: string) => Promise<void>;
  // History
  getHistoryForProject: (projectId: string) => WeeklyHistory[];
  // Constraints
  getConstraintsForProject: (projectId: string) => Constraint[];
  addConstraint: (c: Omit<Constraint, 'id' | 'createdAt'>) => Promise<Constraint | null>;
  updateConstraint: (c: Constraint) => Promise<void>;
  deleteConstraint: (id: string) => Promise<void>;
  // Daily Logs
  getDailyLogsForProject: (projectId: string) => DailyLog[];
  addDailyLog: (log: Omit<DailyLog, 'id' | 'createdAt'>) => Promise<DailyLog | null>;
  updateDailyLog: (log: DailyLog) => Promise<void>;
  deleteDailyLog: (id: string) => Promise<void>;
  // Payment Receipts
  getReceiptsForProject: (projectId: string) => PaymentReceipt[];
  addPaymentReceipt: (r: Omit<PaymentReceipt, 'id' | 'createdAt'>) => Promise<PaymentReceipt | null>;
  deletePaymentReceipt: (id: string) => Promise<void>;
  closeWeek: (projectId: string) => Promise<void>;
  refresh: () => Promise<void>;
  users: any[];
}

export const ProjectsContext = createContext<ProjectsContextType | null>(null);

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be inside ProjectsProvider');
  return ctx;
}
